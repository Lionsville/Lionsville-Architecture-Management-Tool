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

import type { ObservationTab } from '../observations/tabs'

/** The pages an agent can ask for. `home` is a scope's own screen, with nothing open. */
export const PAGES = [
  'home', 'board', 'sheet', 'map', 'technology',
  'decisions', 'observations', 'roadmap', 'plan', 'element', 'document', 'documentation',
  'platform', 'service', 'register', 'technologyRegister',
] as const

export type Page = (typeof PAGES)[number]

/** Pages that are a view's tab: the id is a diagram's. */
export const VIEW_PAGES: readonly Page[] = ['board', 'sheet', 'map', 'technology']

/**
 * Which page's tab a view is: the two drawn kinds are boards, the laid-out
 * ones are their own. Said once, for `app.open` to check a view against and
 * for a place to be written from the view on screen (`place.ts`).
 */
export function viewPage(kind: string): Page {
  return kind === 'layer7' || kind === 'container' ? 'board' : kind as Page
}

/** Pages that live on a scope's home rather than in the workspace. */
export const HOME_PAGES: readonly Page[] = ['home', 'register', 'technologyRegister']

/** Pages that need an id to mean anything. */
export const NEEDS_ID: readonly Page[] = ['plan', 'element', 'document', 'platform', 'service']

export { OBSERVATION_TABS, isObservationTab } from '../observations/tabs'
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
  /** Which tab of the observations page; meaningful with `page: 'observations'` alone. */
  readonly tab?: ObservationTab
  /**
   * An element to select on the board, sheet, map or technology landscape
   * being opened. Not part of the place: where it is not drawn there, the
   * view opens with nothing selected.
   */
  readonly select?: string
}

/** What is up over a scope, or on its home. Absent on a Screen means the active view itself. */
export type ScreenPage =
  | { readonly page: 'decisions'; readonly id?: string }
  | { readonly page: 'observations'; readonly id?: string; readonly tab?: ObservationTab }
  | { readonly page: 'roadmap' }
  | { readonly page: 'plan'; readonly id: string }
  | { readonly page: 'platform'; readonly id: string }
  | { readonly page: 'service'; readonly id: string }
  | { readonly page: 'register' }
  | { readonly page: 'technologyRegister' }

/** The active view of an open scope, named so a reader does not have to look it up. */
export type ScreenView = {
  readonly id: string
  readonly name: string
  readonly kind: string
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
}

/**
 * Who moved the app to the screen it is on: the person, an agent, or a
 * source's provider.
 *
 * `provider` where a provider's chrome, menu line or bar button moved it and
 * said so (`SourceOpen`'s `by: 'provider'`): every screen the app shows in the
 * scope it was sent to, until it arrives where it was sent ({@link landed}) or
 * goes to another scope — a move a provider makes is never the person's.
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
function onRecord(screen: Screen, to: Destination & { page: 'decisions' | 'observations' }): boolean {
  const up = screen.page
  if (up?.page !== to.page || (to.id !== undefined && up.id !== to.id)) return false
  return to.tab === undefined || (up.page === 'observations' && up.tab === to.tab)
}

/**
 * Has the app arrived where it was asked to go? Judged on what the screen
 * can say: the scope, and the page or the view where the destination named
 * one. A page the shell cannot observe — the documentation page opens inside
 * the editor — counts as arrived once the scope is right.
 */
export function arrived(screen: Screen, to: Destination, scope: string): boolean {
  const page = to.page
  // No page: the scope open on whatever its tab shows, with nothing over it.
  if (page === undefined) return screen.open?.path === scope && screen.page === undefined
  if (HOME_PAGES.includes(page)) {
    if (!screen.home || screen.home.path !== scope || screen.open) return false
    return page === 'home' ? screen.page === undefined : screen.page?.page === page
  }
  if (!screen.open || screen.open.path !== scope) return false
  if (VIEW_PAGES.includes(page)) return screen.page === undefined && (to.id === undefined || screen.open.view?.id === to.id)
  switch (page) {
    case 'decisions':
    case 'observations':
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
  // An open of a view the scope does not have lands on its home.
  if (VIEW_PAGES.includes(page)) return screen.open === undefined || screen.page === undefined
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
  const ofKind = diagrams.filter((diagram) => viewPage(diagram.kind) === page)
  return (ofKind.find((diagram) => diagram.id === onTab) ?? ofKind[0])?.id
}
