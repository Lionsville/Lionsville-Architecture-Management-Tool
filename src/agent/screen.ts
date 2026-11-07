// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the app is, and where an agent may ask it to go (ADR-0019).
 *
 * Until this file the agent's world was the scope a person had opened: a
 * request with nothing open was refused, and a change to another landscape
 * meant a person clicking it open first. The app has become an organisation
 * of scopes with homes, registers, reports and pages, so an agent needs to
 * see the same map a person does and to move about it — which is this
 * vocabulary. `app.current` answers with a {@link Screen}; `app.open` takes
 * a {@link Destination}.
 *
 * A destination is *a scope path, a page and an id*: the same three things
 * the shell's own `InitialPage` says, so that a URL for the same place can be
 * written from it later without a second grammar. Pure: the shell maps it
 * onto its screens; this file only knows how to read one out of a call and
 * how to tell whether the app has arrived.
 */

import type { DesignDiagram } from '../model/types'
import { OBSERVATION_TABS } from '../observations/tabs'
import type { ObservationTab } from '../observations/tabs'

export { OBSERVATION_TABS }

/** The pages an agent can ask for. `home` is a scope's own screen, with nothing open. */
export const PAGES = [
  'home', 'board', 'sheet', 'map', 'technology', 'drawing', 'chart', 'conway',
  'decisions', 'observations', 'roadmap', 'plan', 'element', 'document', 'documentation',
  'platform', 'service', 'register', 'technologyRegister', 'people', 'operating', 'checks', 'principles', 'topics', 'blocks',
  'work', 'activity', 'settings', 'preferences', 'agents',
] as const

export type Page = (typeof PAGES)[number]

/** Pages that are a view's tab: the id is a diagram's. */
export const VIEW_PAGES: readonly Page[] = ['board', 'sheet', 'map', 'technology', 'drawing', 'chart', 'conway']

/**
 * Which page's tab a view is. The two drawn kinds are boards. A sheet, a map,
 * a technology landscape, a drawing, an organisation chart and a Conway map
 * are each their own page. Said once, for `app.open` to check a view against
 * and for a place to be written from the view on screen (`place.ts`).
 */
export function viewPage(kind: DesignDiagram['kind']): Page {
  switch (kind) {
    case 'layer7':
    case 'container':
      return 'board'
    case 'sheet':
      return 'sheet'
    case 'map':
      return 'map'
    case 'technology':
      return 'technology'
    case 'drawing':
      return 'drawing'
    case 'chart':
      return 'chart'
    case 'conway':
      return 'conway'
    default: {
      const unexpected: never = kind
      return unexpected
    }
  }
}

/**
 * The places the frame itself keeps rather than a screen under it (ADR-0033,
 * amended): *Your work* and *Activity* are panels beside whatever is up, and the
 * preferences are this person's, asked for over it. They have an address and an
 * agent reaches them, and moving to one moves nothing else. A scope's settings are
 * a page of its home.
 */
export const FRAME_PANELS = ['work', 'activity', 'settle'] as const
export type FramePanel = (typeof FRAME_PANELS)[number]
// Settling is a panel with no page of its own: it is reached only while something waits to be settled.
export const FRAME_PAGES: readonly Page[] = ['work', 'activity', 'preferences']

export function isFramePanel(value: unknown): value is FramePanel {
  return (FRAME_PANELS as readonly unknown[]).includes(value)
}

const homePages: Page[] = ['home', 'register', 'technologyRegister', 'people', 'checks', 'topics', 'blocks', 'settings', 'agents', ...FRAME_PAGES]

/** Pages that live on a scope's home rather than in the workspace. A source's own pages join when they are registered. */
export const HOME_PAGES: readonly Page[] = homePages

/**
 * Which pages have tabs, and the tabs each has: what `?tab=` may say
 * (ADR-0019, amended). A page with tabs reads the one it is on from
 * `usePlaceTab` and writes it there, so an agent and a link reach each one.
 * A tab is added here, in the table, or it has no address.
 */
export const PAGE_TABS: Partial<Record<Page, readonly string[]>> = {
  observations: OBSERVATION_TABS,
  people: ['people', 'review', 'privacy'],
  register: ['applications', 'services', 'platforms'],
  technologyRegister: ['services', 'platforms'],
  operating: ['structure', 'roles', 'responsibilities', 'exceptions', 'libraries'],
  principles: ['principles', 'topics', 'blocks'],
  checks: ['found', 'accepted'],
  blocks: ['about', 'requirements', 'options', 'used'],
  decisions: ['all', 'here', 'above'],
  roadmap: ['plans', 'findings'],
  settings: ['general', 'links', 'exports', 'landscapes'],
  agents: ['changes', 'connect'],
  /** A Conway map's two readings. */
  conway: ['grid', 'lines'],
  plan: ['changes', 'interfaces', 'units', 'milestones', 'restsOn', 'document', 'boards', 'principles', 'history', 'comments'],
  technology: ['chain', 'matrix'],
  // A view has tabs too where it reads at two levels: the sheet's are its level (ADR-0019, amended).
  sheet: ['names', 'overview', 'poster'],
}

/**
 * What an organisation chart's Lines menu draws: nothing, the lines of the
 * person picked, every dotted line, every exception. Kept in the address with
 * the unit a chart is focused on, so a link and an agent reach that reading.
 */
export const CHART_LINES = ['off', 'person', 'dotted', 'exceptions'] as const
export type ChartLines = (typeof CHART_LINES)[number]

export function isChartLines(said: unknown): said is ChartLines {
  return typeof said === 'string' && (CHART_LINES as readonly string[]).includes(said)
}

const sourcePages = new Set<string>()

/**
 * A page a source provider keeps of its own (ADR-0022, amended): it has an
 * address, an agent's `app.open` and a home to be drawn over, as the core's own
 * pages have, and core knows nothing else about it. Registered with the
 * provider, before the first address is read. A name core uses already is
 * refused, since it would change what an old link opens.
 *
 * The name then travels as a {@link Page}, which it is at run time and not in
 * the type: the union stays the core's own list, so every switch over it still
 * has to say something about each of them.
 */
export function registerSourcePage(page: string, tabs: readonly string[] = []): void {
  if ((PAGES as readonly string[]).includes(page)) throw new Error(`a source's page may not be called ${page}`)
  if (sourcePages.has(page)) return
  sourcePages.add(page)
  homePages.push(page as Page)
  if (tabs.length > 0) PAGE_TABS[page as Page] = tabs
}

export function isSourcePage(value: unknown): boolean {
  return typeof value === 'string' && sourcePages.has(value)
}

/** The pages that are anywhere to be asked for now: the core's own, and any source's. */
export function pagesKnown(): readonly string[] {
  return [...PAGES, ...sourcePages]
}

/** Whether a page has this tab; a page with none has no tab at all. */
export function isPageTab(page: Page | undefined, tab: unknown): tab is string {
  return page !== undefined && typeof tab === 'string' && (PAGE_TABS[page] ?? []).includes(tab)
}

/** Pages that need an id to mean anything. */
export const NEEDS_ID: readonly Page[] = ['plan', 'element', 'document', 'platform', 'service']

export { isObservationTab } from '../observations/tabs'
export type { ObservationTab }

/**
 * A place in the app, as plain data: three words, and two that say more about
 * the page (ADR-0019, amended). Strings only, so a destination is written into
 * an address and read back whole.
 */
export type Destination = {
  /** The scope, by path; "" is the organisation. Absent: the scope that is open. */
  readonly scope?: string
  readonly page?: Page
  readonly id?: string
  /** Which tab of the page, one of {@link PAGE_TABS}'s for it. */
  readonly tab?: string
  /**
   * The day a view is looked at, `yyyy-mm-dd` or `today`, where that is not its
   * own day (ADR-0027, amended): so a link and an agent reach the same look, and
   * whoever opens it sees the same band.
   */
  readonly day?: string
  /** What the page is looking at within its tab, in its own words as a query: the operating model's part and unit. */
  readonly look?: string
  /** A frame panel open beside the place (`FRAME_PANELS`); a page of `work` or `activity` says the same over a home. */
  readonly panel?: FramePanel
  /** What a list on the page is showing, as its own query (`widgets/kit/listView.ts`). */
  readonly list?: string
  /** A finding carried by the band to where it is fixed (`place.ts`'s `writeFinding`). */
  readonly finding?: string
  /** On an element's page, a line of it to select instead, and the field that puts a finding right to give the focus to. */
  readonly line?: string
  readonly field?: string
  /**
   * An element to select on the board, sheet, map or technology landscape
   * being opened. Not part of the place: where it is not drawn there, the
   * view opens with nothing selected. The shell's own *Open in People* names
   * the person the People page picks with it; `app.open` takes it for a view
   * only. The Checks page is asked which check to pick by `id`, a check's key.
   */
  readonly select?: string
  /** On a Conway map: the unit type it is grouped by. */
  readonly group?: string
  /** On a Conway map: the pair chosen, its two units' ids with a comma between, an end nobody owns empty. */
  readonly pair?: string
  /** What a sheet is coloured by, the reader's until kept: one of its questions, `none` for none. */
  readonly colour?: string
  /** The unit an organisation chart is focused on: the page draws it and what is under it, with one line for the way up. */
  readonly focus?: string
  /** Which lines an organisation chart draws. */
  readonly lines?: ChartLines
  /** A drawing's page only: in its editor, which `?edit` says in the address. */
  readonly edit?: boolean
}

/** What is up over a scope, or on its home. Absent on a Screen means the active view itself. */
export type ScreenPage =
  | { readonly page: 'decisions'; readonly id?: string; readonly tab?: string }
  | { readonly page: 'observations'; readonly id?: string; readonly tab?: string }
  | { readonly page: 'roadmap'; readonly tab?: string }
  /** The operating model (ADR-0036), at the organisation, on one item where one is picked. */
  | { readonly page: 'operating'; readonly id?: string; readonly tab?: string; readonly look?: string }
  /** The scope's principles (ADR-0041), on one principle where one is picked. */
  | { readonly page: 'principles'; readonly id?: string; readonly tab?: string }
  /** A record's page over the board (the documentation page), on the element whose page it is. */
  | { readonly page: 'document'; readonly id: string }
  | { readonly page: 'plan'; readonly id: string }
  | { readonly page: 'platform'; readonly id: string }
  | { readonly page: 'service'; readonly id: string }
  /** The register: applications, services and platforms, on one record where one is picked. */
  | { readonly page: 'register'; readonly id?: string; readonly tab?: string }
  /** Where the technology register was: a page of its own until 4.0.0, and an address that still lands on the register. */
  | { readonly page: 'technologyRegister'; readonly tab?: string }
  /** The people register (ADR-0036), on the organisation's home. */
  | { readonly page: 'people'; readonly id?: string; readonly tab?: string }
  /** Every check, by category, over a home (ADR-0036, amended 11 October 2026). */
  | { readonly page: 'checks'; readonly id?: string; readonly tab?: string }
  /** The topics catalogue (ADR-0042 §3), over a home, on a topic where one is picked. */
  | { readonly page: 'topics' }
  /** The register of building blocks (ADR-0043 §8), over a home, or a block's page where one is picked. */
  | { readonly page: 'blocks'; readonly id?: string; readonly tab?: string }
  | { readonly page: 'settings'; readonly tab?: string }
  | { readonly page: 'preferences' }
  /** What agents did, and how to connect one, where the source has a page for it. */
  | { readonly page: 'agents'; readonly tab?: string }

/** The active view of an open scope, named so a reader does not have to look it up. */
export type ScreenView = {
  readonly id: string
  readonly name: string
  readonly kind: string
  /** The day it is looked at, where that is not its own (`Destination.day`). */
  readonly day?: string
  /** The reading it is on, where it has more than one and it is not its first. */
  readonly tab?: string
  /** What it is grouped by and which pair is chosen, on a Conway map. */
  readonly group?: string
  readonly pair?: string
  /** What a sheet or a map is coloured by, as a destination says it. */
  readonly colour?: string
  /** On an organisation chart: the unit it is focused on, and the lines it draws, where somebody chose them. */
  readonly focus?: string
  readonly lines?: ChartLines
  /** A drawing with its editor open. */
  readonly editing?: boolean
}

export type Screen = {
  /** The scope open in the workspace; absent while a home is up. */
  readonly open?: {
    readonly path: string
    readonly name: string
    readonly view?: ScreenView
  }
  /** Whose home is on screen while nothing is open. */
  readonly home?: {
    readonly path: string
    readonly name: string
  }
  /** The page over the view, or on the home. Absent: the view itself, or a bare home. */
  readonly page?: ScreenPage
  /** The frame's panel open beside it, where one is. */
  readonly panel?: FramePanel
  /** What a list on the page is showing, as its own query, where a page keeps one. */
  readonly list?: string
  /** A finding the band is carrying, where one is. */
  readonly finding?: string
}

/**
 * Who moved the app to the screen it is on: the person, an agent, or a
 * source's provider.
 *
 * `provider` where a provider's chrome, menu line or bar button moved it and
 * said so (`SourceOpen`'s `by: 'provider'`): every screen the app shows in the
 * scope it was sent to, until it arrives where it was sent ({@link landed})
 * and the page there has picked what it shows, or goes to another scope — a
 * move a provider makes is never the person's.
 * `agent` where the move was an agent's `app.open`, or happened while an
 * agent's driving session was up — whatever the person clicked in the middle of
 * it, since the banner says a click then changes what the agent sees and the
 * two cannot be told apart. `person` otherwise, and for the screen the app
 * started on. It is said of the move, not of the moment: a screen an agent
 * brought the app to stays the agent's after its session ends, until something
 * moves the app again.
 */
export type MovedBy = 'person' | 'agent' | 'provider'

/** The scope a screen is about: the open one, else the home that is up. */
export function scopeOf(screen: Screen): string | undefined {
  return screen.open?.path ?? screen.home?.path
}

/**
 * A record page, on the record asked for where one was. A page already up
 * says so at once, before the request for another record has reached it, so
 * the page alone is no arrival: the record it names is.
 */
function onRecord(screen: Screen, to: Destination & { page: 'decisions' | 'observations' | 'operating' | 'principles' }): boolean {
  const up = screen.page
  if (up?.page !== to.page || (to.id !== undefined && up.id !== to.id)) return false
  return to.tab === undefined || ('tab' in up && up.tab === to.tab)
}

/** On the tab asked for, where one was. */
function onTab(screen: Screen, tab: string | undefined): boolean {
  return tab === undefined || (screen.page !== undefined && 'tab' in screen.page && screen.page.tab === tab)
}

/** On the person asked for, where the People page was asked for one. */
function onPerson(screen: Screen, to: Destination): boolean {
  return to.page !== 'people' || to.id === undefined || (screen.page?.page === 'people' && screen.page.id === to.id)
}

/** A page of a scope's home, with nothing open over it: the home asked for, and the page on it. */
function onHome(screen: Screen, page: Page, scope: string): boolean {
  if (!screen.home || screen.home.path !== scope || screen.open) return false
  if (page === 'home') return screen.page === undefined
  // The technology register's address lands on the register, on its tab.
  return screen.page?.page === (page === 'technologyRegister' ? 'register' : page)
}

/**
 * The frame's own places. Its panels are said on the screen; a dialog asked for
 * is not, and a scope's own or the window's is up once the scope is right.
 */
function arrivedInFrame(screen: Screen, page: Page, scope: string): boolean {
  return scopeOf(screen) === scope && (!isFramePanel(page) || screen.panel === page)
}

/**
 * Has the app arrived where it was asked to go? Judged on what the screen
 * can say: the scope, and the page or the view where the destination named
 * one. A page the shell cannot observe — the documentation page opens inside
 * the editor — counts as arrived once the scope is right.
 */
export function arrived(screen: Screen, to: Destination, scope: string): boolean {
  const page = to.page
  if (page !== undefined && FRAME_PAGES.includes(page)) return arrivedInFrame(screen, page, scope)
  // No page: the scope open on whatever its tab shows, with nothing over it.
  if (page === undefined) return screen.open?.path === scope && screen.page === undefined
  if (HOME_PAGES.includes(page)) return onHome(screen, page, scope) && onTab(screen, to.tab) && onPerson(screen, to)
  if (!screen.open || screen.open.path !== scope) return false
  if (VIEW_PAGES.includes(page)) return screen.page === undefined && (to.id === undefined || screen.open.view?.id === to.id)
  switch (page) {
    case 'decisions':
    case 'observations':
    case 'operating':
    case 'principles':
      return onRecord(screen, { ...to, page })
    case 'roadmap': return screen.page?.page === 'roadmap'
    case 'plan':
    case 'platform':
    case 'service':
      return screen.page?.page === page && screen.page.id === to.id
    default:
      // An element is selected on a board, a document opens inside the
      // editor: neither is on the screen's face, so the scope is the answer.
      return true
  }
}

/**
 * Has a move landed, for the purpose of saying whose it was: in the scope it
 * was sent to, on the kind of page it asked for, whichever record or view
 * that page then shows. Kinder than {@link arrived}, which an agent waits on
 * and which holds out for the record asked for: a move that asked for a view
 * the scope does not have lands on the scope's home, and one that named
 * something the page could not show lands on the page all the same. Only
 * ever asked of a screen that is in the destination's scope.
 */
export function landed(screen: Screen, to: Destination & { scope: string }): boolean {
  if (scopeOf(screen) !== to.scope) return false
  const page = to.page
  if (page === undefined) return screen.open !== undefined && screen.page === undefined
  if (HOME_PAGES.includes(page)) {
    return screen.open === undefined && (page === 'home' ? screen.page === undefined : screen.page?.page === page)
  }
  // An open of a view the scope does not have lands on its home — with
  // nothing over the cards, as nothing is over the view it lands on otherwise.
  if (VIEW_PAGES.includes(page)) return screen.page === undefined
  if (screen.open === undefined) return false
  if (page === 'element' || page === 'document' || page === 'documentation') return true
  return screen.page?.page === page
}

/**
 * The view a destination of a view's page opens: the one it names, and with
 * no id the one on the scope's tab where it is of that kind, else the first
 * of that kind. Nothing where the scope has no view of that kind — an open
 * never makes one, and the scope's home is where it lands.
 */
export function viewFor(
  page: Page, id: string | undefined, diagrams: readonly { id: string; kind: string }[], onTab: string | undefined,
): string | undefined {
  if (!VIEW_PAGES.includes(page)) return undefined
  if (id !== undefined) return id
  const ofKind = diagrams.filter((diagram) => isViewKind(diagram.kind) && viewPage(diagram.kind) === page)
  return (ofKind.find((diagram) => diagram.id === onTab) ?? ofKind[0])?.id
}

/** Every kind of view, said as a table so a kind added to the model is a kind added here or a compile error. */
const VIEW_KINDS: Record<DesignDiagram['kind'], true> = {
  layer7: true, container: true, sheet: true, map: true, technology: true, drawing: true, chart: true, conway: true,
}

function isViewKind(kind: string): kind is DesignDiagram['kind'] {
  return Object.hasOwn(VIEW_KINDS, kind)
}
