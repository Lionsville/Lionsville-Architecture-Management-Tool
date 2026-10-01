// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a place in the history lands now (ADR-0033), from what the app holds.
 *
 * Asked by Back and Forward and by the boot, of the same facts: the listing
 * of scopes for whether a scope is there, and the scope's own document for
 * its views and its records — the open session's where the place is the scope
 * that is open, because a view made a minute ago is not where the work is
 * kept yet, and one read of the scope otherwise, which is what the agent's
 * `app.open` reads too. The rule itself is `agent/place.ts`'s `nearestPlace`;
 * this is the app gathering what it needs to know. No React.
 */
import { nearestPlace } from '../agent/place'
import type { Place, PlaceFacts } from '../agent/place'
import type { TreeView } from '../agent/tree'
import type { Adr } from '../model/adr'
import type { HostModel } from '../model/hostModel'

/** A scope's document as the history asks about it: what it holds, and the records it reads from above. */
export type HeldScope = { readonly model: HostModel; readonly ancestorDecisions: readonly Adr[] }

/**
 * What a scope's document says about a place in it: its views in order, and
 * whether it holds a record by id — a view, an element, a decision of its own
 * or one it reads from above, a plan, an observation, a cause, a solution or
 * an experiment.
 */
export function factsOf(held: HeldScope): Required<Pick<PlaceFacts, 'views' | 'holds'>> {
  const { model } = held
  const ids = new Set([
    ...model.diagrams, ...model.elements, ...(model.decisions ?? []), ...held.ancestorDecisions,
    ...(model.transitions ?? []), ...(model.observations ?? []), ...(model.causes ?? []),
    ...(model.solutions ?? []), ...(model.experiments ?? []),
  ].map((record) => record.id))
  return { views: model.diagrams, holds: (id) => ids.has(id) }
}

/** Does where a place lands depend on what its scope holds? A home's does not, nor a bare scope's while its views are not asked. */
export function asksTheScope(place: Place): boolean {
  return !(place.page === 'home' || place.page === 'register' || place.page === 'technologyRegister')
}

/**
 * Where a place lands now (`nearestPlace`), asked of the listing and of the
 * scope's document. A scope the listing has not caught up with yet is read
 * before it is taken for removed. A read that fails is said through `failed`
 * and lands as a removed scope does, above it: the place is not one this
 * person can be shown now, and the scope above is the nearest that is.
 */
export async function landingFor(
  place: Place, tree: TreeView, openScope: (path: string) => HeldScope | undefined,
  failed: (cause: unknown) => void = () => {},
): Promise<Place> {
  const listed = new Set(tree.scopes().map((scope) => scope.path))
  const read = async (path: string): Promise<HeldScope | undefined> => {
    const open = openScope(path)
    if (open) return open
    try {
      return await tree.read(path)
    } catch (cause) {
      failed(cause)
      return undefined
    }
  }
  const asks = asksTheScope(place)
  const held = asks || !listed.has(place.scope) ? await read(place.scope) : undefined
  const there = place.scope === '' || held !== undefined || (!asks && listed.has(place.scope))
  const facts: PlaceFacts = {
    scopeIs: (path) => (path === place.scope ? there : listed.has(path)),
    ...(held ? factsOf(held) : {}),
  }
  return nearestPlace(place, facts)
}
