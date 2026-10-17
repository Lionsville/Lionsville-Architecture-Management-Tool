// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation as an agent's write reads it (ADR-0036 §3, §6): every unit
 * the tree keeps, with this scope's own as the session holds them, and every
 * plan's moves — the other scopes' off the tree, this scope's off the session.
 * What `plan.move` and a unit's `element.update parentId` check a loop over,
 * so a parent kept in any scope is found by its id.
 */
import { rolesOf, transitionList, unitTypesOf } from '../../model/normalised'
import { movesOfPlans } from '../../model/transition'
import type { TransitionMove } from '../../model/transition'
import type { ElementId } from '../../model/types'
import { isUnit } from '../../model/units'
import type { Organisation, UnitLike } from '../../model/units'
import type { ReadView } from '../answer'

/** Every unit the organisation has, by id: the tree's, with this scope's own as the session holds them. */
export function unitsKnown(view: ReadView): Map<ElementId, UnitLike> {
  const here = Object.values(view.model.elements).filter((one) => one.ref === undefined && isUnit(one))
  const elsewhere = (view.tree?.units?.() ?? []).filter((one) => one.scope !== view.scopePath).map((one) => one.unit)
  return new Map([...elsewhere, ...here].map((unit) => [unit.id, unit]))
}

/** The scope that keeps a unit this scope does not, where the tree keeps one by that id. */
export function unitKeptElsewhere(view: ReadView, id: ElementId): string | undefined {
  return (view.tree?.units?.() ?? []).find((one) => one.unit.id === id && one.scope !== view.scopePath)?.scope
}

/** Every plan's moves: the other scopes' off the tree, this scope's as the session holds its plans. */
export function movesKnown(view: ReadView): TransitionMove[] {
  return [
    ...(view.tree?.moves?.() ?? []).filter((one) => one.scope !== view.scopePath).map((one) => one.move),
    ...movesOfPlans(transitionList(view.model)),
  ]
}

/**
 * The organisation's units, moves and operating model — the organisation's
 * own where it is open, the tree's otherwise. No assignments: what a write
 * checks here is where units sit, never who is in them.
 */
export function organisationKnown(view: ReadView): Organisation {
  const operating = view.scopePath === ''
    ? { unitTypes: Object.values(unitTypesOf(view.model)), roles: Object.values(rolesOf(view.model)) }
    : view.tree?.operatingModel?.()
  const moves = movesKnown(view)
  return {
    units: [...unitsKnown(view).values()], assignments: [], roles: operating?.roles ?? [], unitTypes: operating?.unitTypes ?? [],
    ...(moves.length ? { moves } : {}),
  }
}
