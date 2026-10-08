// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A place in the window's history, and its address (ADR-0033).
 *
 * Back goes to the place before, so the history has to hold places, and a
 * place is not a new idea: it is what `app.current` says (ADR-0019's
 * {@link Screen}), written in the three words `app.open` takes — a scope, a
 * page and an id, a {@link Destination}. Nothing else is part of one: not the
 * element selected on a board, not the day a board is looked at on
 * (ADR-0027), not a dialog, a filter or a scroll position. A place that held
 * any of those would make every look at another day a step, and a Back that
 * walked through them would be useless.
 *
 * **The address.** A place is written into the address's fragment, so a
 * reload in a browser lands where the person was, and the fragment never
 * leaves the browser — the names of scopes reach no server's log on the way.
 * The grammar is a fixed prefix and a query string:
 *
 *     #place?scope=acme%2Frail&page=board&id=landscape
 *     #place?scope=&page=home                          the organisation's home
 *
 * The observations page says which of its tabs is up, so a place on it may
 * carry `tab` as well (ADR-0019, amended): a reload stays on the tab, and a
 * change of tab is another record on the same page as far as a step goes.
 *
 * The prefix is what tells a place from anything else a fragment may carry: a
 * source provider reads the address too (`SourceConnect.fromLocation`), and a
 * fragment that is not a place is left alone for whoever wrote it. The rest is
 * `URLSearchParams`, which is the browser's own encoding: a scope path holds
 * `/` and whatever a person named a folder, and every one of those characters
 * comes back as it went in. `scope` is always written, because the
 * organisation's path is the empty one and a place with no scope is no place.
 *
 * Pure, and the agent's module's because the vocabulary is: the shell keeps
 * the history (`app/placeHistory.ts`), and a test here says that every place
 * written is read back the same.
 */
import { HOME_PAGES, isObservationTab, PAGES, VIEW_PAGES, viewPage } from './screen'
import type { Destination, Page, Screen } from './screen'

/** A destination that names its scope: what the history holds, and what an address carries. */
export type Place = Destination & { readonly scope: string }

/** What a fragment that is a place begins with, after the `#`. */
export const PLACE_PREFIX = 'place?'

/** The key a place is kept under in a history entry's state, beside whatever other code keeps there. */
export const PLACE_STATE_KEY = 'lvarch.place'

const KEYS = new Set(['scope', 'page', 'id', 'tab'])

/** The fragment for a place, with its `#`. */
export function writePlace(place: Place): string {
  const query = new URLSearchParams()
  query.set('scope', place.scope)
  if (place.page !== undefined) query.set('page', place.page)
  if (place.id !== undefined) query.set('id', place.id)
  if (place.tab !== undefined) query.set('tab', place.tab)
  return `#${PLACE_PREFIX}${query.toString()}`
}

/**
 * A link to a place (ADR-0033, amended): the address somebody else reaches the
 * same work at, with the place as its fragment. Whatever fragment the address
 * had is dropped — a link names one place, and a fragment that is somebody
 * else's would be read before it — and its path and query are kept as they
 * were said, because which of those a link needs is the business of whoever
 * gave the address.
 */
export function linkTo(address: string, place: Place): string {
  const hash = address.indexOf('#')
  return `${hash < 0 ? address : address.slice(0, hash)}${writePlace(place)}`
}

/**
 * The place a fragment names, with or without its `#` — or `undefined` for a
 * fragment that is not one: no prefix, a key this grammar does not have, a
 * key said twice, no scope, a page there is no such thing as, or a tab that
 * is not one of the observations page's. Strict, because a fragment that
 * nearly is a place is somebody else's.
 */
export function readPlace(hash: string): Place | undefined {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  if (!fragment.startsWith(PLACE_PREFIX)) return undefined
  const query = new URLSearchParams(fragment.slice(PLACE_PREFIX.length))
  const seen = new Set<string>()
  for (const key of query.keys()) {
    if (!KEYS.has(key) || seen.has(key)) return undefined
    seen.add(key)
  }
  const scope = query.get('scope')
  if (scope === null) return undefined
  const page = query.get('page')
  if (page !== null && !isPage(page)) return undefined
  const id = query.get('id')
  const tab = query.get('tab')
  if (tab !== null && !isObservationTab(tab)) return undefined
  return { scope, ...(page !== null ? { page } : {}), ...(id !== null ? { id } : {}), ...(tab !== null ? { tab } : {}) }
}

function isPage(value: string): value is Page {
  return (PAGES as readonly string[]).includes(value)
}

/**
 * A place out of whatever a history entry's state holds — the window's
 * history is anybody's to write, so it is checked as an address is, by
 * writing what was found and reading it back.
 */
export function placeInState(state: unknown): Place | undefined {
  if (typeof state !== 'object' || state === null) return undefined
  const held = (state as Record<string, unknown>)[PLACE_STATE_KEY]
  if (typeof held !== 'object' || held === null) return undefined
  const { scope, page, id, tab } = held as Record<string, unknown>
  if (typeof scope !== 'string') return undefined
  if (page !== undefined && (typeof page !== 'string' || !isPage(page))) return undefined
  if (id !== undefined && typeof id !== 'string') return undefined
  if (tab !== undefined && !isObservationTab(tab)) return undefined
  return { scope, ...(page !== undefined ? { page } : {}), ...(id !== undefined ? { id } : {}), ...(tab !== undefined ? { tab } : {}) }
}

/**
 * The place a screen is: the scope that is open and its view or the page
 * over it, or, with nothing open, whose home is up and its page.
 *
 * `undefined` for a screen that is not a place yet: a scope whose workspace
 * has not said what is on it — there is no view and no page to name, for the
 * moment between a scope being chosen and its workspace being up — and a
 * screen that says nothing at all.
 */
export function placeOf(screen: Screen): Place | undefined {
  if (screen.open) {
    const scope = screen.open.path
    if (screen.page) {
      const up = screen.page
      return {
        scope, page: up.page, ...('id' in up && up.id !== undefined ? { id: up.id } : {}),
        ...(up.page === 'observations' && up.tab !== undefined ? { tab: up.tab } : {}),
      }
    }
    const view = screen.open.view
    return view ? { scope, page: viewPage(view.kind), id: view.id } : undefined
  }
  if (screen.home) return { scope: screen.home.path, page: screen.page?.page ?? 'home' }
  return undefined
}

/** The same place: the same scope, page, id and tab. */
export function samePlace(a: Place | undefined, b: Place | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return a.scope === b.scope && a.page === b.page && a.id === b.id && a.tab === b.tab
}

/** The two pages where moving from one record to the next is choosing, not going somewhere. */
const RECORD_PAGES: readonly Page[] = ['decisions', 'observations']

/**
 * What a move from one place to another does to the history.
 *
 * - **Nothing** for the same place: a look that found nothing new.
 * - **Replace** the entry for the first place there is — the entry the window
 *   opened on is the app's, and pushing would leave a Back that goes nowhere
 *   — and for another record or another tab on the same record page, because
 *   a Back that walked through every record looked at would be useless. The
 *   address still names the record and the tab on screen, so a reload stays
 *   on them.
 * - **Push** for every other move. Opening a record page on a record from
 *   anywhere else is one of those.
 */
export function stepBetween(from: Place | undefined, to: Place): 'push' | 'replace' | 'none' {
  if (from === undefined) return 'replace'
  if (samePlace(from, to)) return 'none'
  if (from.scope === to.scope && from.page === to.page && to.page !== undefined && RECORD_PAGES.includes(to.page)) return 'replace'
  return 'push'
}

/**
 * What the app knows about where a place was, when Back or a reload brings
 * it up again: which scopes are there now, and what the place's own scope
 * holds — its views in order, and whether a record is still in it. The last
 * two are absent where the scope was not read, and the place is then trusted.
 */
export type PlaceFacts = {
  readonly scopeIs: (path: string) => boolean
  readonly views?: readonly { readonly id: string; readonly kind: string }[]
  readonly holds?: (id: string) => boolean
}

/** The scopes above a path, nearest first, ending with the organisation's. */
function above(path: string): string[] {
  const parts = path.split('/')
  const out: string[] = []
  for (let n = parts.length - 1; n > 0; n -= 1) out.push(parts.slice(0, n).join('/'))
  if (path !== '') out.push('')
  return out
}

/**
 * Where a place lands now that the app may have changed under it.
 *
 * The history cannot skip an entry, so a place that is not there any more
 * lands as near to it as there is, and says nothing about the difference —
 * what was removed is in the Activity list:
 *
 * - a scope that was removed: the home of the nearest scope above it that is
 *   still there, the organisation's at the last;
 * - a view that was removed: its scope on the scope's first view, or the
 *   scope's home where it has none left;
 * - a record that was removed: its page without one — a plan's page is the
 *   roadmap — and a platform's or a service's report, which has no page
 *   without its record, the scope as its first view shows it.
 */
export function nearestPlace(place: Place, facts: PlaceFacts): Place {
  const { scope, page, id } = place
  if (scope !== '' && !facts.scopeIs(scope)) {
    const nearest = above(scope).find((path) => path === '' || facts.scopeIs(path)) ?? ''
    return { scope: nearest, page: 'home' }
  }
  if (page !== undefined && HOME_PAGES.includes(page)) return place
  const views = facts.views
  const first: Place = views === undefined
    ? { scope }
    : views.length > 0 ? { scope, page: viewPage(views[0].kind), id: views[0].id } : { scope, page: 'home' }
  if (page === undefined) return views !== undefined && views.length === 0 ? first : place
  if (VIEW_PAGES.includes(page)) {
    if (id === undefined || views === undefined || views.some((view) => view.id === id)) return place
    return first
  }
  if (id === undefined || facts.holds === undefined || facts.holds(id)) return place
  switch (page) {
    case 'decisions':
      return { scope, page }
    case 'observations':
      return { scope, page, ...(place.tab !== undefined ? { tab: place.tab } : {}) }
    case 'plan':
      return { scope, page: 'roadmap' }
    default:
      return first
  }
}
