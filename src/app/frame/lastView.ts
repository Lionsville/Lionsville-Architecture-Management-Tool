// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The view a person was last on, kept so that row two can offer the way back
 * to it from every page (ADR-0033, amended 22 November 2026).
 *
 * A home lists no views in row two, and a page of the organisation's stands
 * where a board was: without this the diagram somebody left is several presses
 * away, and nothing on screen says which one it was. So the frame keeps the
 * last view of each scope and which scope was worked in last
 * (`FrameState.lastViews`, `lastScope`), noted at every look at the screen that
 * finds a view under it, and row two draws the newest right after Home.
 *
 * **It lasts as the list of places last worked in does** (`recentPlaces.ts`):
 * on this computer, per source. The frame's own copy is the session's; as the
 * app comes up it is read from that list, whose newest view is by construction
 * the view last arrived at, so a reload offers the same way back. Nothing new is
 * stored for it.
 *
 * Pure: what a screen says, what the store holds next, and what the row draws.
 */
import { viewPage } from '../../agent/screen'
import type { Destination, Page, Screen } from '../../agent/screen'
import type { DesignDiagram } from '../../model/types'
import type { RecentPlace } from './recentPlaces'

/** A view somebody was on: where it is, what it and its scope were called then, and the page that opens it. */
export type LastView = {
  readonly scope: string
  /** The scope's name then, for a way back that says where it leads. */
  readonly in: string
  readonly page: Page
  readonly id: string
  readonly name: string
}

/** What the frame keeps: the last view of each scope, and the scope worked in last. */
export type LastViews = {
  readonly lastViews?: Readonly<Record<string, LastView>>
  readonly lastScope?: string
}

/** The view under whatever is on screen: the open scope's, whichever page stands over it. Nothing on a home. */
export function lastViewOf(screen: Screen): LastView | undefined {
  const open = screen.open
  const view = open?.view
  if (!open || !view) return undefined
  return { scope: open.path, in: open.name, page: viewPage(view.kind as DesignDiagram['kind']), id: view.id, name: view.name }
}

const sameView = (a: LastView | undefined, b: LastView) => a !== undefined && a.scope === b.scope && a.id === b.id && a.name === b.name && a.in === b.in && a.page === b.page

/** What the store holds once a view was seen: the same object where nothing moved, so a look that found nothing new draws nothing. */
export function withLastView(held: LastViews, seen: LastView): LastViews {
  if (held.lastScope === seen.scope && sameView(held.lastViews?.[seen.scope], seen)) return held
  return { lastViews: { ...held.lastViews, [seen.scope]: seen }, lastScope: seen.scope }
}

/** The view last worked on, of the scope last worked in. */
export function newestView(held: LastViews): LastView | undefined {
  return held.lastScope === undefined ? undefined : held.lastViews?.[held.lastScope]
}

/** A view renamed from somewhere that is not its tab — its row on a home — where the frame keeps it. */
export function renamedView(held: LastViews, scope: string, id: string, name: string): LastViews {
  const kept = held.lastViews?.[scope]
  if (!kept || kept.id !== id || kept.name === name) return held
  return { ...held, lastViews: { ...held.lastViews, [scope]: { ...kept, name } } }
}

/**
 * What the frame starts from: the views on the list of places last worked in,
 * the newest of each scope, and the scope of the newest of all. A page on that
 * list is no view, and is passed over.
 */
export function lastViewsFrom(recent: readonly RecentPlace[]): LastViews {
  const lastViews: Record<string, LastView> = {}
  let lastScope: string | undefined
  for (const place of recent) {
    if (place.name === undefined || place.id === undefined || place.scope in lastViews) continue
    lastViews[place.scope] = { scope: place.scope, in: place.in, page: place.page, id: place.id, name: place.name }
    lastScope ??= place.scope
  }
  return lastScope === undefined ? {} : { lastViews, lastScope }
}

/** What the screen that is up knows of the last view's scope: that it is there, and its views where the screen lists them. */
export type WayBackFacts = {
  readonly scopeIs: (path: string) => boolean
  /** The views of the scope whose home is up, where it has been read. */
  readonly homeViews?: { readonly scope: string; readonly views: readonly { readonly id: string; readonly name: string }[] }
}

/** The way back as row two draws it: where a press goes, the view's name, and its scope's where that is not the one in the trail. */
export type WayBack = { readonly to: Destination & { scope: string }; readonly name: string; readonly in?: string }

/**
 * The way back row two offers on this screen, or none: no view was worked on
 * yet, the view is the one that is up with nothing over it, its scope is gone,
 * or the home that is up lists its scope's views and it is not among them.
 */
export function wayBack(held: LastViews, screen: Screen, at: string, facts: WayBackFacts): WayBack | undefined {
  const last = newestView(held)
  if (!last) return undefined
  if (screen.page === undefined && screen.open?.path === last.scope && screen.open.view?.id === last.id) return undefined
  if (!facts.scopeIs(last.scope)) return undefined
  const listed = facts.homeViews?.scope === last.scope ? facts.homeViews.views : undefined
  const now = listed?.find((view) => view.id === last.id)
  if (listed && !now) return undefined
  return {
    to: { scope: last.scope, page: last.page, id: last.id },
    name: now?.name ?? last.name,
    ...(last.scope !== at ? { in: last.in } : {}),
  }
}
