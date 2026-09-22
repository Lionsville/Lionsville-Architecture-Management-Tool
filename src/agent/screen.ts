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

/** The pages an agent can ask for. `home` is a scope's own screen, with nothing open. */
export const PAGES = [
  'home', 'board', 'sheet', 'map', 'technology',
  'decisions', 'observations', 'roadmap', 'plan', 'element', 'document', 'documentation',
  'platform', 'service', 'register', 'technologyRegister',
] as const

export type Page = (typeof PAGES)[number]

/** Pages that are a view's tab: the id is a diagram's. */
export const VIEW_PAGES: readonly Page[] = ['board', 'sheet', 'map', 'technology']

/** Pages that live on a scope's home rather than in the workspace. */
export const HOME_PAGES: readonly Page[] = ['home', 'register', 'technologyRegister']

/** Pages that need an id to mean anything. */
export const NEEDS_ID: readonly Page[] = ['plan', 'element', 'document', 'platform', 'service']

export type Destination = {
  /** The scope, by path; "" is the organisation. Absent: the scope that is open. */
  readonly scope?: string
  readonly page?: Page
  readonly id?: string
}

/** What is up over a scope, or on its home. Absent on a Screen means the active view itself. */
export type ScreenPage =
  | { readonly page: 'decisions'; readonly id?: string }
  | { readonly page: 'observations'; readonly id?: string }
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

/** The scope a screen is about: the open one, else the home that is up. */
export function scopeOf(screen: Screen): string | undefined {
  return screen.open?.path ?? screen.home?.path
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
    case 'decisions': return screen.page?.page === 'decisions'
    case 'observations': return screen.page?.page === 'observations'
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
