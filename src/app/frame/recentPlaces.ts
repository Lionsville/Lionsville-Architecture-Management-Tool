// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where this person last worked, on this computer: what *Continue* leads the
 * organisation's home with, because work concentrates and a regular goes back
 * to the same few places. A preference and not a record: it travels nowhere,
 * and a place that has since gone is simply not offered.
 *
 * Kept per source, since a place in one organisation means nothing in another.
 * The name a place had when it was left is kept with it, because the index does
 * not say what a view is called and reading a scope per row is what a home must
 * not do (ADR-0004).
 */
import type { Destination, Screen } from '../../agent/screen'
import type { DesignDiagram } from '../../model/types'
import { viewPage } from '../../agent/screen'

export type RecentPlace = {
  readonly scope: string
  readonly page: NonNullable<Destination['page']>
  readonly id?: string
  /** What it was called when it was left: a view's name. Absent: the page's own word says it. */
  readonly name?: string
  /** The scope's name then, for a line that says where it is. */
  readonly in: string
  readonly at: string
}

/** How many are kept; a home shows fewer. */
const KEPT = 12

/** The pages a person works in: not a home, and not what is the organisation's whichever scope it was asked from. */
const WORKED_IN = new Set<string>(['decisions', 'observations', 'roadmap', 'documentation', 'plan', 'principles', 'element', 'document'])

/** Where a screen is, as a place worth coming back to; nothing for a bare home or a place of the organisation's own. */
export function recentOf(screen: Screen, at: string): RecentPlace | undefined {
  const open = screen.open
  const scope = open?.path ?? screen.home?.path
  if (scope === undefined) return undefined
  const named = open?.name ?? screen.home?.name ?? ''
  const page = screen.page
  if (page) {
    if (!WORKED_IN.has(page.page)) return undefined
    const id = 'id' in page ? page.id : undefined
    return { scope, page: page.page, ...(id !== undefined ? { id } : {}), in: named, at }
  }
  const view = open?.view
  if (!view) return undefined
  return { scope, page: viewPage(view.kind as DesignDiagram['kind']), id: view.id, name: view.name, in: named, at }
}

/**
 * What a row is told apart by. A view has a name of its own. A page does not, so
 * the records opened on it, which only its id tells apart, are one place: three
 * rows of *Observations* say nothing, and a row's press lands on the newest.
 * A plan is the roadmap's and an element's page the documentation's, as a row says them.
 */
const PAGE_OF: Partial<Record<string, string>> = { plan: 'roadmap', element: 'documentation', document: 'documentation' }
const placeKey = (place: RecentPlace) => (place.name === undefined
  ? `${place.scope}|${PAGE_OF[place.page] ?? place.page}`
  : `${place.scope}|${place.page}|${place.id ?? ''}`)
const same = (a: RecentPlace, b: RecentPlace) => placeKey(a) === placeKey(b)

/** The place put first, once: arriving again moves it up rather than listing it twice. */
export function remembered(list: readonly RecentPlace[], place: RecentPlace): RecentPlace[] {
  return [place, ...list.filter((one) => !same(one, place))].slice(0, KEPT)
}

/** A view renamed where a place on the list is that view: the list says what it is called now. */
export function renamedIn(list: readonly RecentPlace[], scope: string, id: string, name: string): RecentPlace[] {
  return list.map((one) => (one.scope === scope && one.id === id && one.name !== undefined && one.name !== name ? { ...one, name } : one))
}

/** What a preference holds, read as a stored value is: whatever is not a place is passed over. */
export function recentFrom(stored: unknown, key: string): RecentPlace[] {
  const held = (stored as Record<string, unknown> | undefined)?.[key]
  if (!Array.isArray(held)) return []
  return held.filter((one): one is RecentPlace => {
    const place = one as Partial<RecentPlace> | null
    return typeof place?.scope === 'string' && typeof place.page === 'string' && typeof place.at === 'string'
  })
}

/** Those that still have somewhere to land, newest first, each place once however an earlier build kept it. */
export function stillThere(list: readonly RecentPlace[], scopeIs: (path: string) => boolean, most = 3): RecentPlace[] {
  const seen = new Set<string>()
  return list.filter((one) => {
    if (!scopeIs(one.scope) || seen.has(placeKey(one))) return false
    seen.add(placeKey(one))
    return true
  }).slice(0, most)
}

export const RECENT_KEY = 'recentPlaces'
