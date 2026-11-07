// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's home, read: what it is, what it holds, and the way on. One-line
 * rows led by the views, because a view is why a person came; what the scope
 * does not hold folds into one line of names, so nothing is drawn as a zero. A
 * scope that holds nothing says so once, and that that is fine, which is what
 * most scopes do.
 *
 * Which rows is decided by what the scope holds and never by the label it gives
 * itself. Everything here is composed from the kit and nothing loads: what it
 * says comes from what the shell has read (`organisationPages`, the index).
 */
import type { ReactNode } from 'react'
import { LOCALE } from '../../i18n'
import type { Language, StringKey, Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { formatAdrNumber } from '../../decisions'
import type { DesignDiagram } from '../../model'
import { useBlocks } from '../../blocks/ui/BlocksContext'
import type { ScopeSummary } from '../../projects/scope'
import { flattenScopes } from '../../projects/scope'
import type { ScopePrinciples } from '../../projects/scopeIndex'
import { parentScope, ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { DecisionIcon, DocumentIcon, ObservationIcon, RegisterIcon, TimelineIcon, DeploymentIcon } from '../../widgets/icons'
import { Button } from '../../widgets/kit/Button'
import { List } from '../../widgets/kit/List'
import type { ListRow } from '../../widgets/kit/List'
import { MenuButton, MoreMenu } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { PageState } from '../../widgets/kit/PageState'
import { LinkLine, Section } from '../../widgets/kit/Section'
import type { LineLink } from '../../widgets/kit/Section'
import type { RecentPlace } from '../frame/recentPlaces'
import { BoardKindIcon } from './boardIcons'
import { outlineBoards } from './boardOutline'
import { heldInWords } from './ScopeTree'
import type { Holdings, NearbyWork } from './holdings'
import { nearestWork } from './holdings'
import { decisionsFact, holdsObservations, observationsFact, roadmapFact, viewFact } from './homeRows'
import type { OrganisationPages } from './organisationPages'
import { principleCounts } from './principleCounts'
import { useTopics } from './TopicsContext'
import type { RegisterSummary } from './register'
import type { TechnologySummary } from '../../projects/technologyRegister'
import { plural } from '../../i18n/strings'
import type { FindingTarget } from '../../roadmap/findingTarget'
import type { InitialPage } from '../App'
import type { OrgPage } from '../useShellAgent'

/** The presses a home's rows lead to. */
export type HomeDoors = {
  open: (path: ScopePath, page?: InitialPage) => void
  onGoHome: (path: ScopePath) => void
  /** A page over this home, in the shell's words: the register under it, the blocks. */
  onHomePage: (page: OrgPage) => void
  onFinding: (target: FindingTarget) => void
  /** The acts on a view, for somebody who may write here. */
  onDeleteView?: ((view: { id: string; name: string }) => void) | undefined
  onNewView: readonly MenuEntry[]
  onNewScope?: (() => void) | undefined
}

export type ScopeHomeProps = HomeDoors & {
  at: ScopePath
  atRoot: boolean
  home: ScopeSummary
  tree: ScopeSummary
  views: readonly DesignDiagram[]
  pages: OrganisationPages
  /** Is what this scope keeps read? Until then a row is not drawn rather than drawn as nothing. */
  ready: boolean
  /** Does its document say it has elements to describe. */
  draws: boolean
  writable: boolean
  localObservations: number
  initiatives: number
  register: RegisterSummary
  technology: TechnologySummary
  principlesAt?: ((path: ScopePath) => ScopePrinciples) | undefined
  holdings: Holdings
  /** Where this person worked last, on the organisation's home. */
  recent?: readonly RecentPlace[]
  onContinue?: ((place: RecentPlace) => void) | undefined
  today: string
  language: Language
  s: Translate
}

type Kept = {
  readonly id: string
  readonly label: string
  readonly icon: ReactNode
  readonly guide?: string
  readonly fact: string
  /** Something is kept here: a row. Otherwise a name on the one line. */
  readonly holds: boolean
  /** A row even so: *0 here, 52 in force*, which is worth a line on a scope with other things. */
  readonly row?: boolean
  /** Not the scope's own at all: a page of the organisation's, on a line of its own. */
  readonly across?: boolean
  readonly open: () => void
  readonly end?: ReactNode
}

function useKept(props: ScopeHomeProps): readonly Kept[] {
  const { at, atRoot, home, pages, draws, localObservations, initiatives, register, technology, principlesAt, open, onHomePage, onFinding, s } = props
  const blocks = useBlocks()
  const topics = useTopics()
  const principles = principlesAt ? principleCounts(at, principlesAt, topics?.inForceAt(at)) : undefined
  const blocksHere = blocks?.blocksAt(at)
  const blocksAll = blocks?.blocks().length ?? 0
  const latest = pages.decisions.latest
  const finding = pages.roadmap.findingOpens
  const under = !atRoot && home.children.length > 0
  const views = props.views
  const writes = props.writable
  const hasOf = (kind: DesignDiagram['kind']) => views.some((one) => one.kind === kind)
  const rows: (Kept | false)[] = [
    {
      id: 'open-observations', label: s('shell.observations'), icon: <ObservationIcon />, guide: 'org.card.observations',
      fact: observationsFact(pages, localObservations, s), holds: holdsObservations(pages, localObservations), open: () => open(at, { page: 'observations' }),
    },
    principlesAt !== undefined && principles !== undefined && {
      id: 'open-principles', label: s('principles.card'), icon: <DecisionIcon />, guide: 'org.card.principles',
      fact: s('principles.cardCount', { own: principles.own, inForce: principles.inForce }),
      holds: principles.own > 0, row: principles.inForce > 0, open: () => open(at, { page: 'principles' }),
    },
    {
      id: 'open-decisions', label: s('shell.decisions'), icon: <DecisionIcon />, guide: 'org.card.decisions',
      fact: decisionsFact(pages, s), holds: pages.decisions.total > 0, open: () => open(at, { page: 'decisions' }),
      ...(latest ? { end: (
        <Button variant="quiet" size="small" data-testid="open-latest-decision" title={s('org.latest', { name: `${formatAdrNumber(latest.number)} ${latest.title}` })} onClick={() => open(at, { page: 'decisions', id: latest.id })}>
          {s('org.latest', { name: formatAdrNumber(latest.number) })}
        </Button>
      ) } : {}),
    },
    {
      id: 'open-roadmap', label: s('shell.roadmap'), icon: <TimelineIcon />, guide: 'org.card.roadmap',
      fact: roadmapFact(pages, initiatives, s), holds: pages.roadmap.total + initiatives > 0, open: () => open(at, { page: 'roadmap' }),
      ...(finding ? { end: (
        <Button variant="quiet" size="small" data-testid="open-roadmap-finding" aria-label={s('org.openFinding')} onClick={() => onFinding(finding)}>{s('org.findingShow')}</Button>
      ) } : {}),
    },
    draws && {
      id: 'open-documentation', label: s('shell.documentation'), icon: <DocumentIcon />,
      fact: s(pages.documentation.described === 1 ? 'org.describedOne' : 'org.describedOther', { count: pages.documentation.described, total: pages.documentation.elements }),
      holds: pages.documentation.described > 0, open: () => open(at, { page: 'documentation' }),
    },
    !draws && {
      id: 'open-documentation', label: s('shell.documentation'), icon: <DocumentIcon />, fact: '', holds: false, open: () => open(at, { page: 'documentation' }),
    },
    blocks !== undefined && {
      id: 'open-block-register', label: s('homeBlocks.card'), icon: <RegisterIcon />, guide: 'org.card.blocks',
      fact: atRoot ? plural(s, { one: 'homeBlocks.countAllOne', other: 'homeBlocks.countAll' }, blocksAll) : s('homeBlocks.countHere', { kept: blocksHere?.kept.length ?? 0, evaluated: blocksHere?.evaluated.length ?? 0 }),
      holds: atRoot ? blocksAll > 0 : (blocksHere?.kept.length ?? 0) + (blocksHere?.evaluated.length ?? 0) > 0, open: () => onHomePage('blocks'),
    },
    // Over what is filed under this scope, the part that is its business. The organisation's whole register is at the tree's foot.
    under && {
      id: 'open-register', label: s('org.register'), icon: <RegisterIcon />, guide: 'org.card.register',
      fact: [
        plural(s, { one: 'register.applicationsOne', other: 'register.applicationsOther' }, register.applications),
        plural(s, { one: 'register.ownedOne', other: 'register.ownedOther' }, register.owned),
        plural(s, { one: 'register.outsideOne', other: 'register.outsideOther' }, register.outside),
      ].join(', '),
      holds: register.applications > 0, open: () => onHomePage('register'),
    },
    under && {
      id: 'open-technology', label: s('org.technology'), icon: <DeploymentIcon />, guide: 'org.card.technology',
      fact: [
        plural(s, { one: 'techRegister.servicesOne', other: 'techRegister.servicesOther' }, technology.services),
        plural(s, { one: 'techRegister.platformsOne', other: 'techRegister.platformsOther' }, technology.platforms),
      ].join(', '),
      holds: technology.services + technology.platforms > 0, open: () => onHomePage('technologyRegister'),
    },
    // A view the organisation has not been given yet is a word on the line, for somebody who may make it; one it has is a row of its views.
    atRoot && writes && !hasOf('sheet') && {
      id: 'open-business', label: s('org.newBoardSheet'), icon: null, guide: 'org.card.business', fact: '', holds: false, open: () => open(at, { page: 'make', kind: 'sheet' }),
    },
    atRoot && writes && !hasOf('map') && {
      id: 'open-map', label: s('org.newBoardMap'), icon: null, guide: 'org.card.map', fact: '', holds: false, open: () => open(at, { page: 'make', kind: 'map' }),
    },
    atRoot && writes && !hasOf('technology') && {
      id: 'open-technology-landscape', label: s('org.newBoardTechnology'), icon: null, guide: 'org.card.landscape', fact: '', holds: false, open: () => open(at, { page: 'make', kind: 'technology' }),
    },
    // More of the organisation's places, until they have merged into those at the tree's foot.
    atRoot && {
      id: 'open-technology', label: s('org.technology'), icon: null, guide: 'org.card.technology', across: true, holds: false, open: () => onHomePage('technologyRegister'),
      fact: [
        plural(s, { one: 'techRegister.servicesOne', other: 'techRegister.servicesOther' }, technology.services),
        plural(s, { one: 'techRegister.platformsOne', other: 'techRegister.platformsOther' }, technology.platforms),
      ].join(', '),
    },
    atRoot && topics !== undefined && {
      id: 'open-topic-catalogue', label: s('topics.title'), icon: null, guide: 'org.card.topics', across: true, holds: false, fact: '', open: () => onHomePage('topics'),
    },
  ]
  return rows.filter((row): row is Kept => row !== false)
}

function keptRow(kept: Kept): ListRow {
  return {
    id: kept.id, testId: kept.id, text: kept.label, mark: kept.icon, fact: kept.fact,
    ...(kept.guide ? { guide: kept.guide } : {}), ...(kept.end ? { end: kept.end } : {}),
  }
}

function keptLink(kept: Kept): LineLink {
  return { label: kept.label, onPress: kept.open, 'data-testid': kept.id, ...(kept.guide ? { 'data-guide': kept.guide } : {}), ...(kept.fact ? { title: kept.fact } : {}) }
}

function viewRows(views: readonly DesignDiagram[], pages: OrganisationPages, onDelete: HomeDoors['onDeleteView'], onOpen: (id: string) => void, language: Language, s: Translate): ListRow[] {
  const { entries, loose } = outlineBoards(views)
  const rowOf = (view: DesignDiagram, indent: number): ListRow => ({
    id: view.id, ...doorOf(view, pages), text: view.name, mark: <BoardKindIcon kind={view.kind} size={16} />, fact: viewFact(view, pages, language, s),
    ...(indent > 0 ? { indent } : {}),
    end: (
      <MoreMenu
        size="small" label={s('frame.scopeMenu', { name: view.name })}
        items={[
          { label: s('org.rowOpen'), onSelect: () => onOpen(view.id) },
          ...(onDelete ? [{ label: s('org.rowDelete'), final: true, onSelect: () => onDelete({ id: view.id, name: view.name }) }] : []),
        ]}
      />
    ),
  })
  return [
    // Container diagrams straight after their landscape: a closer look at one box on it, in the order they are read.
    ...entries.flatMap(({ board, containers }) => [rowOf(board, 0), ...containers.map((one) => rowOf(one, 1))]),
    ...loose.map((one) => rowOf(one, 1)),
  ]
}

/** The organisation's first sheet, map and technology landscape keep the stable names their cards had. */
function doorOf(view: DesignDiagram, pages: OrganisationPages): Pick<ListRow, 'testId' | 'guide'> {
  if (view.id === pages.business.sheetId) return { testId: 'open-business', guide: 'org.card.business' }
  if (view.id === pages.business.mapId) return { testId: 'open-map', guide: 'org.card.map' }
  if (view.id === pages.technology.landscapeId) return { testId: 'open-technology-landscape', guide: 'org.card.landscape' }
  return { testId: `board-${view.id}` }
}

/** Where this person worked last, across the scopes. */
function Continue({ recent, at, onContinue, language, s }: { recent: readonly RecentPlace[]; at: ScopePath; onContinue: (place: RecentPlace) => void; language: Language; s: Translate }) {
  if (recent.length === 0) return null
  const key = (place: RecentPlace) => `${place.scope}|${place.page}|${place.id ?? ''}`
  const rows: ListRow[] = recent.map((place) => ({
    id: key(place),
    text: place.name ?? s(PAGE_WORD[place.page] ?? 'frame.home'),
    mark: isViewPage(place.page) ? <BoardKindIcon kind={place.page === 'board' ? 'layer7' : place.page as DesignDiagram['kind']} size={16} /> : <DocumentIcon />,
    fact: place.scope === at ? s('org.continueHere') : place.in,
    note: formatDay(place.at.slice(0, 10), language),
  }))
  return (
    <Section title={s('org.continue')} data-testid="continue">
      <List label={s('org.continue')} density="compact" groups={[{ id: 'continue', label: '', rows }]} onOpen={(id) => { const found = recent.find((one) => key(one) === id); if (found) onContinue(found) }} />
    </Section>
  )
}

const isViewPage = (page: string) => ['board', 'sheet', 'map', 'technology', 'drawing', 'chart', 'conway'].includes(page)

/** What a place with no name of its own is called on a row. */
const PAGE_WORD: Partial<Record<string, StringKey>> = {
  decisions: 'shell.decisions', observations: 'shell.observations', roadmap: 'shell.roadmap', documentation: 'shell.documentation',
  principles: 'principles.card', plan: 'shell.roadmap', element: 'shell.documentation', document: 'shell.documentation',
}

const STANDS: Record<NearbyWork['stands'], StringKey> = { below: 'org.nearBelow', beside: 'org.nearBeside', above: 'org.nearAbove' }

/** The most common page in the product: a scope with nothing in it yet, which is fine, and the way on from it. */
function EmptyScope({ at, tree, kept, holdings, doors, writable, atRoot, principles, s }: {
  at: ScopePath; tree: ScopeSummary; kept: readonly Kept[]; holdings: Holdings; doors: HomeDoors; writable: boolean; atRoot: boolean
  principles: { inForce: number } | undefined; s: Translate
}) {
  const nearby = nearestWork(tree, at, holdings)
  const inForce = kept.find((one) => one.id === 'open-principles')
  return (
    <>
      <PageState
        state="empty" title={s('org.emptyTitle')} body={s('org.emptyBody')} dataGuide="org.cards"
        {...(writable ? { steps: (
          <>
            {!atRoot && <MenuButton label={s('org.stepView')} items={doors.onNewView} data-guide="org.newBoard" data-testid="new-board" />}
            <Button onClick={() => doors.open(at, { page: 'observations' })}>{s('org.stepObservation')}</Button>
            <Button onClick={() => doors.open(at, { page: 'decisions' })}>{s('org.stepDecision')}</Button>
            <Button onClick={() => doors.open(at, { page: 'roadmap' })}>{s('org.stepPlan')}</Button>
            {doors.onNewScope && <Button variant="quiet" data-testid="new-scope" data-guide="org.newScope" onClick={doors.onNewScope}>{s('org.stepScope')}</Button>}
          </>
        ) } : {})}
      />
      {inForce && (principles?.inForce ?? 0) > 0 && (
        <Section title={s('org.inForceHere')}>
          <List label={s('org.inForceHere')} density="compact" groups={[{ id: 'force', label: '', rows: [keptRow(inForce)] }]} onOpen={inForce.open} />
        </Section>
      )}
      {nearby.length > 0 && (
        <Section title={s('org.nearestWork')} data-testid="nearest-work">
          <List
            label={s('org.nearestWork')} density="compact" onOpen={doors.onGoHome}
            groups={[{ id: 'near', label: '', rows: nearby.map((one) => ({ id: one.path, text: one.name, fact: `${s(STANDS[one.stands])}: ${heldInWords(one.held, s)}` })) }]}
          />
        </Section>
      )}
      <LinkLine label={s('org.allPages')} links={kept.filter((one) => !one.across && !one.id.startsWith('open-business') && one.id !== 'open-map' && one.id !== 'open-technology-landscape').map(keptLink)} data-testid="all-pages" />
    </>
  )
}

export function ScopeHome(props: ScopeHomeProps) {
  const { at, atRoot, tree, views, pages, ready, writable, holdings, recent = [], onContinue, language, s, principlesAt, ...rest } = props
  const kept = useKept(props)
  const topics = useTopics()
  const doors: HomeDoors = rest
  if (!ready) return <div data-testid="organisation-cards" data-guide="org.cards" />
  const holdsAny = views.length > 0 || kept.some((one) => one.holds)
  const principles = principlesAt ? principleCounts(at, principlesAt, topics?.inForceAt(at)) : undefined
  if (!holdsAny) {
    return (
      <div data-testid="organisation-cards">
        <EmptyScope at={at} tree={tree} kept={kept} holdings={holdings} doors={doors} writable={writable} atRoot={atRoot} principles={principles} s={s} />
      </div>
    )
  }
  const shown = kept.filter((one) => one.holds || one.row === true)
  const across = kept.filter((one) => one.across)
  const onOpenView = (id: string) => {
    const view = views.find((one) => one.id === id)
    if (view) doors.open(at, { page: 'board', id })
  }
  return (
    <div data-testid="organisation-cards" data-guide="org.cards">
      {atRoot && onContinue && <Continue recent={recent} at={at} onContinue={onContinue} language={language} s={s} />}
      {views.length > 0 && (
        <Section title={s('org.viewsHere')} data-testid="boards" data-guide="org.boards">
          <List label={s('org.viewsHere')} density="compact" groups={[{ id: 'views', label: '', rows: viewRows(views, pages, writable ? doors.onDeleteView : undefined, onOpenView, language, s) }]} onOpen={onOpenView} />
        </Section>
      )}
      {shown.length > 0 && (
        <Section title={s('org.keptHere')}>
          <List
            label={s('org.keptHere')} density="compact" groups={[{ id: 'kept', label: '', rows: shown.map(keptRow) }]}
            onOpen={(id) => kept.find((one) => one.id === id)?.open()}
          />
        </Section>
      )}
      <LinkLine label={s('org.nothingYet')} links={kept.filter((one) => !shown.includes(one) && !one.across).map(keptLink)} data-testid="nothing-yet" />
      <LinkLine label={s('org.alsoAcross')} links={across.map(keptLink)} data-testid="also-across" />
    </div>
  )
}

/** The line under a home's name: what it is, where it is filed, how many scopes are under it, and when it last changed. */
export function homeMeta(home: ScopeSummary, tree: ScopeSummary, typeWord: string, changed: string | undefined, language: Language, s: Translate): string {
  const every = flattenScopes(tree)
  const above = parentScope(home.path)
  const parentName = above === undefined ? undefined : (above === ROOT_SCOPE ? tree.name : every.find((one) => one.path === above)?.name)
  const below = flattenScopes(home).length - 1
  return [
    home.client?.trim() && home.client.trim() !== home.name.trim() ? s('org.forClient', { name: home.client.trim() }) : '',
    [typeWord, parentName ? s('org.underName', { name: parentName }) : ''].filter(Boolean).join(', '),
    below > 0 ? s('org.scopesUnder', { direct: home.children.length, all: below }) : '',
    changed ? s('org.lastChanged', { when: new Date(changed).toLocaleString(LOCALE[language], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }) : '',
  ].filter(Boolean).join('. ')
}
