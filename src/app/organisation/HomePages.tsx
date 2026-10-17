// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pages over a home's cards: the two registers, the people register and
 * the Checks page — one at a time (`useHomePages`), each below the home's bar
 * so the crumbs stay and the way home is the same as from every other page.
 *
 * The first view of a home is its cards, so each page's script arrives when
 * it is opened (`widgets/lazyPart`). The Checks page opens nothing that is a
 * part of its own — an instance opens where it is fixed, on another screen or
 * on the People page beside it — so it brings nothing with it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentProps } from 'react'
import Button from '@mui/material/Button'
import type { Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { ElementId } from '../../model'
import type { PeoplePage as PeoplePageShape } from '../../people/ui/PeoplePage'
import type { ScopePath } from '../../projects/scopePath'
import type { TechnologyRow } from '../../projects/technologyRegister'
import type { WindowChrome } from '../../platform/windowChrome'
import { useShownDays } from '../../editor/useShownDays'
import { RegisterIcon } from '../../widgets/icons'
import { lazyPart } from '../../widgets/lazyPart'
import { arrivingPage } from '../../widgets/Arriving'
import type { ChecksPage as ChecksPageShape } from './ChecksPage'
import { OnePage } from './OrganisationCards'
import type { RegisterRow } from './register'
import type { RegisterPage as RegisterPageShape, TechnologyPage as TechnologyPageShape } from './RegisterPage'
import type { CheckPlace } from './treeChecks'
import type { HomeChecks } from './useHomeChecks'
import type { HomePagesState } from './useHomePages'
import type { Organisation } from './useOrganisation'
import type { PeopleAccess } from './usePeopleRegister'
import type { OrgPageRequest } from '../useShellAgent'

const RegisterPage = lazyPart<ComponentProps<typeof RegisterPageShape>>(
  () => import('./RegisterPage').then((held) => held.RegisterPage), { until: (props) => props.open, fallback: arrivingPage },
)
const TechnologyPage = lazyPart<ComponentProps<typeof TechnologyPageShape>>(
  () => import('./RegisterPage').then((held) => held.TechnologyPage), { until: (props) => props.open, fallback: arrivingPage },
)
/** The people register's page (ADR-0036), fetched the first time it is opened, as the registers are. */
const PeoplePage = lazyPart<ComponentProps<typeof PeoplePageShape>>(
  () => import('../../people/ui/PeoplePage').then((held) => held.PeoplePage), { until: (props) => props.open, fallback: arrivingPage },
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

export function HomePages({ pages, at, heading, register, technology, registerScopeName, scopeName, checks, people, readOnly, open, onHome, onOpenRow, onOpenRowPage, onLink, s, windowChrome }: {
  pages: HomePagesState
  /** The home: what the Checks page keeps its weights under for the session. */
  at: ScopePath
  /** What the registers call the organisation or the scope whose home this is. */
  heading: string
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
  const go = useCallback((place: CheckPlace) => {
    if ('person' in place) pages.open('people', place.person)
    else if ('home' in place) { close(); onHome(place.home) }
    else open(place.scope, place.page)
  }, [pages, open, close, onHome])
  return (
    <>
      <RegisterPage
        open={openPage === 'register'} onClose={close} rows={register} organisation={heading} scopeName={registerScopeName}
        onOpen={onOpenRow} onOpenPage={onOpenRowPage} onLink={onLink} readOnly={readOnly} s={s} windowChrome={windowChrome}
      />
      <TechnologyPage
        open={openPage === 'technologyRegister'} onClose={close} rows={technology} organisation={heading} scopeName={registerScopeName}
        onOpen={onOpenRow} onOpenPage={onOpenRowPage} s={s} windowChrome={windowChrome}
      />
      <PeopleDoor open={openPage === 'people'} onClose={close} people={people} request={asked} s={s} windowChrome={windowChrome} />
      <ChecksPage
        open={openPage === 'checks'} onClose={close} rows={checks.rows} counts={checks.counts}
        request={asked?.page === 'checks' ? asked : undefined} remember={`checks\u0000${at}`} scopeName={scopeName} onGo={go}
        s={s} windowChrome={windowChrome}
      />
    </>
  )
}

/**
 * The Checks card on every home: what the page behind it is, how many checks
 * there are and how many find something here, and the way in — whether or not
 * anything is found, because the checks are worth reading either way.
 */
export function ChecksCard({ checks, onOpen, s }: { checks: HomeChecks; onOpen: () => void; s: Translate }) {
  const every = checks.rows.flatMap((one) => one.rows)
  const finding = every.filter((row) => row.shown.length > 0).length
  return (
    <OnePage
      icon={<RegisterIcon />}
      title={s('org.checks')}
      description={s('org.describeChecks')}
      count={[
        plural(s, { one: 'org.checksOne', other: 'org.checksOther' }, every.length),
        plural(s, { one: 'org.checksFoundOne', other: 'org.checksFoundOther' }, finding),
      ].join(' · ')}
      action={(
        <Button size="small" onClick={onOpen} sx={{ fontSize: 11, minWidth: 0, px: 1, whiteSpace: 'nowrap' }} data-testid="open-checks" data-guide="org.card.checks" aria-label={s('picker.openNamed', { name: s('org.checks') })}>
          {s('picker.open')}
        </Button>
      )}
    />
  )
}
