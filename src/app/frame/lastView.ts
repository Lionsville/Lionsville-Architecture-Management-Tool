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
 * (`FrameState.lastViews`, `lastScope`), noted wherever the window's history
 * settles on a view (`placeHistory.ts`), and row two draws the newest right
 * after Home.
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
import type { Destination, Screen } from '../../agent/screen'
import type { DesignDiagram } from '../../model/types'
import type { LastView } from '../../session/frameStore'
import type { RecentPlace } from '../../session/recentPlaces'

export type { LastView }

/** What the frame keeps: the last view of each scope, and the scope worked in last. */
export type LastViews = {
  readonly lastViews?: Readonly<Record<string, LastView>>
  readonly lastScope?: string
}

/**
 * The view that is up: the open scope's, with no page over it. A view under a
 * page is not noted — a scope opened straight on one of its pages has a tab
 * under it that nobody was on — and nothing is on a home.
 */
export function lastViewOf(screen: Screen): LastView | undefined {
  const open = screen.open
  const view = open?.view
  if (!open || !view || screen.page !== undefined) return undefined
  return { scope: open.path, in: open.name, page: viewPage(view.kind as DesignDiagram['kind']), id: view.id, name: view.name }
}

const sameView = (a: LastView | undefined, b: LastView) => a !== undefined && a.scope === b.scope && a.id === b.id && a.name === b.name && a.in === b.in && a.page === b.page

/** What the store holds once a view was seen: the same object where nothing moved, so a look that found nothing new draws nothing. */
export function withLastView(held: LastViews, seen: LastView): LastViews {
  if (held.lastScope === seen.scope && sameView(held.lastViews?.[seen.scope], seen)) return held
  return { lastViews: { ...held.lastViews, [seen.scope]: seen }, lastScope: seen.scope }
}

/**
 * A screen the app settled on, noted where a view is up on it. Asked of the
 * history's settled places and not of every screen: a scope opened on one of
 * its pages shows the view under it for a moment first, and nobody was on it.
 */
export function noteLastView(frame: { get(): LastViews; set(patch: LastViews): void } | undefined, settled: Screen): void {
  const seen = lastViewOf(settled)
  if (frame && seen) frame.set(withLastView(frame.get(), seen))
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
 * A view whose tab stands in row two while its scope is open: every kind but a
 * container diagram, which is a closer look at a landscape, and a map, which
 * may be a reading of the sheet. Those two have no tab of their own to press.
 */
const hasTab = (kind: string) => kind !== 'container' && kind !== 'map'

/**
 * The way back row two offers on this screen, or none.
 *
 * None before any view was worked on, where its scope is gone, and where the
 * home that is up lists its scope's views and it is not among them. And none
 * **while a view is up with nothing over it**, whichever view: either it is
 * the one last worked on, or it is about to be. The last view is noted only
 * once the window's history settles on it, and on a server that takes a
 * moment; offering the view just left in that moment drew a way back for an
 * instant between two tabs and pushed the whole row over and back.
 *
 * Under a page of the same scope its views' tabs stand in the row, and a tab
 * is the way back: a second press to the same place pushed the scope's pages
 * out of the row in a narrow window. So there it is offered only for the view
 * the page stands over, where that view has no tab of its own.
 */
export function wayBack(held: LastViews, screen: Screen, at: string, facts: WayBackFacts): WayBack | undefined {
  const last = newestView(held)
  if (!last) return undefined
  const open = screen.open
  if (open?.view && screen.page === undefined) return undefined
  if (open && open.path === last.scope) {
    const under = open.view
    if (!under || under.id !== last.id || hasTab(under.kind)) return undefined
  }
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
