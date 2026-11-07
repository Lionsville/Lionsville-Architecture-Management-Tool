// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pages over a home's cards: the register, the people register, the
 * topics catalogue, the building blocks and the Checks page — one at a time (`useHomePages`), each below the home's bar
 * so the crumbs stay and the way home is the same as from every other page.
 *
 * The first view of a home is its cards, so each page's script arrives when
 * it is opened (`widgets/lazyPart`). The Checks page opens nothing that is a
 * part of its own — an instance opens where it is fixed, on another screen or
 * on the People page beside it — so it brings nothing with it.
 */
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { isSourcePage } from '../../agent/screen'
import type { Language, Translate } from '../../i18n'
import type { ElementId } from '../../model'
import type { PeoplePage as PeoplePageShape } from '../../people/ui/PeoplePage'
import type { ScopeSummary } from '../../projects/scope'
import type { ScopePath } from '../../projects/scopePath'
import type { TechnologyRow } from '../../projects/technologyRegister'
import type { WindowChrome } from '../../platform/windowChrome'
import { useShownDays } from '../../editor/useShownDays'
import { lazyPart } from '../../widgets/lazyPart'
import { arrivingPage } from '../../widgets/Arriving'
import type { ChecksPage as ChecksPageShape } from './ChecksPage'
import type { TopicsPage as TopicsPageShape } from './TopicsPage'
import type { BlocksRegisterPage as BlocksRegisterPageShape } from '../../blocks/ui/BlocksRegisterPage'
import type { BlockPage as BlockPageShape } from '../../blocks/ui/BlockPage'
import type { RegisterRow } from './register'
import type { RegisterPage as RegisterPageShape } from './RegisterPage'
import { FrameStoreContext } from '../frame/frameStore'
import { ROOT_SCOPE } from '../../projects/scopePath'
import type { CheckInstance, CheckPlace, CheckRow } from './treeChecks'
import type { HomeChecks, TreeRead } from './useHomeChecks'
import type { HomePagesState } from './useHomePages'
import type { Organisation } from './useOrganisation'
import type { PeopleAccess } from './usePeopleRegister'
import type { OrgPageRequest } from '../useShellAgent'

const RegisterPage = lazyPart<ComponentProps<typeof RegisterPageShape>>(
  () => import('./RegisterPage').then((held) => held.RegisterPage), { until: (props) => props.open, fallback: arrivingPage },
)
/** The people register's page (ADR-0036), fetched the first time it is opened, as the registers are. */
const PeoplePage = lazyPart<ComponentProps<typeof PeoplePageShape>>(
  () => import('../../people/ui/PeoplePage').then((held) => held.PeoplePage), { until: (props) => props.open, fallback: arrivingPage },
)
/** The topics catalogue (ADR-0042 §3), likewise: it reads the topics the home hands down. */
const TopicsPage = lazyPart<ComponentProps<typeof TopicsPageShape>>(
  () => import('./TopicsPage').then((held) => held.TopicsPage), { until: (props) => props.open, fallback: arrivingPage },
)
/** The register of building blocks and a block's page (ADR-0043 §8), likewise: they read the blocks the home hands down. */
const BlocksRegisterPage = lazyPart<ComponentProps<typeof BlocksRegisterPageShape>>(
  () => import('../../blocks/ui/BlocksRegisterPage').then((held) => held.BlocksRegisterPage), { until: (props) => props.open, fallback: arrivingPage },
)
const BlockPage = lazyPart<ComponentProps<typeof BlockPageShape>>(
  () => import('../../blocks/ui/BlockPage').then((held) => held.BlockPage), { until: (props) => props.open, fallback: arrivingPage },
)
/** The Checks page (ADR-0036, amended 11 October 2026), likewise. */
const ChecksPage = lazyPart<ComponentProps<typeof ChecksPageShape>>(
  () => import('./ChecksPage').then((held) => held.ChecksPage), { until: (props) => props.open, fallback: arrivingPage },
)

/** The People page has no day of its own: today is its day, and a look away is the window's (ADR-0027). */
const NO_SAVED_DAY = (): undefined => undefined
const PEOPLE_LOOK = 'people'

/**
 * The People page over this home, where the source keeps a register; nothing
 * where it keeps none. The day it is looked at is a look the window holds, as
 * a board's is (ADR-0027): moving it writes nothing, and back on today it
 * forgets itself. A request that names a person — *Open in People* on the
 * organisation chart, a person over their time on the Checks page — picks
 * them, and closing the page lets that go, so the card opens it on whoever
 * the page last showed.
 */
function PeopleDoor({ people, open, onClose, request, s, windowChrome }: {
  people: PeopleAccess | undefined; open: boolean; onClose: () => void
  request: OrgPageRequest | undefined; s: Translate; windowChrome: WindowChrome
}) {
  const [asked, setAsked] = useState<string | undefined>(undefined)
  useEffect(() => { setAsked(request?.page === 'people' ? request.select : undefined) }, [request])
  const close = useCallback(() => { setAsked(undefined); onClose() }, [onClose])
  const viewing = useShownDays(NO_SAVED_DAY)
  const day = viewing.days[PEOPLE_LOOK]?.day
  const look = useMemo(() => ({
    ...(day !== undefined ? { day } : {}),
    onDay: (next: string | undefined) => viewing.show(PEOPLE_LOOK, next),
  }), [day, viewing])
  if (!people) return null
  return (
    <PeoplePage open={open} onClose={close} register={people} {...(asked !== undefined ? { select: asked } : {})} readText={people.readText}
      copyText={people.copyText} look={look} s={s} windowChrome={windowChrome} />
  )
}

export function HomePages({ sourcePage, pages, at, register, technology, registerScopeName, scopeName, checks, people, readOnly, open, onHome, onOpenRow, onOpenRowPage, onLink, everyScope, treeRead, today, language, topics, s, windowChrome, ready = true }: {
  pages: HomePagesState
  /** A page of the open source's provider's own, where one is asked for: drawn by the shell, which holds what it is handed. */
  sourcePage?: ((page: string, onClose: () => void) => ReactNode) | undefined
  /** The tree's index has been read: until then a page that reads it is arriving, not empty. */
  ready?: boolean
  /** The home: what the Checks page keeps its weights under for the session. */
  at: ScopePath
  /** Every scope in the tree: what the Checks page can be over instead, and what the register's sentence is out of. */
  everyScope: readonly ScopeSummary[]
  /** The tree as read: what the fixes on a finding read and write by. */
  treeRead: TreeRead | undefined
  today: string
  language: Language
  /** Where a record a fix makes gets its id. */
  topics: { readonly makeId?: (prefix: string) => string } | undefined
  register: readonly RegisterRow[]
  technology: readonly TechnologyRow[]
  /** A scope as the registers say it: its own name, the organisation's heading at the root. */
  registerScopeName: (path: ScopePath) => string
  /** A scope as a finding says it. */
  scopeName: (path: ScopePath) => string
  checks: HomeChecks
  people: PeopleAccess | undefined
  readOnly: boolean
  /** Open a scope on a page, as the cards do. */
  open: Organisation['open']
  /** A scope's home, where a finding about the scope itself is put right (ADR-0036, amended 17 October 2026). */
  onHome: (path: ScopePath) => void
  onOpenRow: ((scope: ScopePath, id: ElementId) => void) | undefined
  onOpenRowPage: ((scope: ScopePath, id: ElementId) => void) | undefined
  onLink: ((scope: ScopePath, id: ElementId, to: ScopePath) => void) | undefined
  s: Translate
  windowChrome: WindowChrome
}) {
  const { openPage, asked, close } = pages
  const frame = useContext(FrameStoreContext)
  const go = useCallback((place: CheckPlace, row?: CheckRow, instance?: CheckInstance) => {
    // A band carries the finding to where it is fixed and back (`FindingBand`).
    if (row && instance) frame?.set({ finding: { home: at, check: row.key, id: instance.id } })
    if ('person' in place) pages.open('people', place.person)
    else if ('topic' in place) pages.open('topics', place.topic)
    else if ('home' in place) { close(); onHome(place.home) }
    else open(place.scope, place.page)
  }, [pages, open, close, onHome, frame, at])
  const toChecks = useCallback((instance: CheckInstance) => pages.open('checks', instance.key, undefined, instance.id), [pages])
  const report = useCallback((kind: 'service' | 'platform', scope: ScopePath, id: ElementId) => open(scope, { page: kind, id }), [open])
  const goHome = useCallback(() => close(), [close])
  const makeId = topics?.makeId
  const models = treeRead?.models
  const index = treeRead?.index
  const fixes = useMemo(() => ({
    makeId, people: people?.people, modelOf: (path: ScopePath) => models?.find((one) => one.path === path)?.model,
  }), [makeId, people?.people, models])
  const scopes = useMemo(() => everyScope.map((one) => (
    { path: one.path, name: scopeName(one.path), depth: one.path === ROOT_SCOPE ? 0 : one.path.split('/').length }
  )), [everyScope, scopeName])
  return (
    <>
      <RegisterPage
        open={openPage === 'register'} onClose={close} rows={register} technology={technology} instances={checks.split.shown} scopes={scopes.length}
        index={index} today={today} language={language} scopeName={registerScopeName} request={asked?.page === 'register' ? asked : undefined}
        onOpen={onOpenRow} onOpenPage={onOpenRowPage} onLink={onLink} onReport={report} onSeeInChecks={toChecks} onHome={goHome}
        readOnly={readOnly} s={s} windowChrome={windowChrome}
      />
      <PeopleDoor open={openPage === 'people'} onClose={close} people={people} request={asked} s={s} windowChrome={windowChrome} />
      <TopicsPage
        open={openPage === 'topics'} onClose={close} {...(asked?.page === 'topics' && asked.select !== undefined ? { select: asked.select } : {})}
        nonce={asked?.nonce ?? 0} windowChrome={windowChrome}
      />
      <BlocksDoors pages={pages} at={at} windowChrome={windowChrome} ready={ready} />
      {openPage !== undefined && isSourcePage(openPage) ? sourcePage?.(openPage, close) : null}
      <ChecksPage
        open={openPage === 'checks'} onClose={close} rows={checks.rows} counts={checks.counts}
        request={asked?.page === 'checks' ? asked : undefined} remember={`checks\u0000${at}`} at={at} scopes={scopes}
        onScope={(path) => { close(); onHome(path); pages.open('checks') }} scopeName={scopeName} index={index} today={today} onGo={go} onLink={onLink} fixes={fixes}
        {...(at !== ROOT_SCOPE ? { onOpenScope: () => open(at) } : {})} s={s} windowChrome={windowChrome}
      />
    </>
  )
}

/**
 * The register of building blocks over this home, and a block's page over it
 * where one is picked (ADR-0043 §8): closing a block's page comes back to the
 * register it was opened over.
 */
export function BlocksDoors({ pages, at, windowChrome, ready, back = () => window.history.back() }: {
  pages: HomePagesState; at: ScopePath; windowChrome: WindowChrome; ready: boolean
  /** The place before, for a block's page opened from another screen. */
  back?: () => void
}) {
  const { openPage, asked, close } = pages
  const picked = openPage === 'blocks' && asked?.page === 'blocks' ? asked.select : undefined
  // Opened before the tree is read — from a link, or by an agent — the block is
  // not yet anywhere to be found: the page is arriving, not the home bare.
  if (openPage === 'blocks' && !ready) return arrivingPage({ windowChrome })
  return (
    <>
      <BlocksRegisterPage open={openPage === 'blocks' && picked === undefined} at={at} onClose={close} windowChrome={windowChrome} />
      <BlockPage
        open={picked !== undefined} id={picked} {...(asked?.evaluation !== undefined ? { evaluation: asked.evaluation } : {})}
        // Back where it was opened from, as the POC's page over any screen closed onto it; from the register, to the register.
        nonce={asked?.nonce ?? 0} onClose={asked?.returns ? back : () => pages.open('blocks')} windowChrome={windowChrome}
      />
    </>
  )
}
