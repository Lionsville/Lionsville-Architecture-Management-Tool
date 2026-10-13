// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A unit made on the organisation chart (ADR-0036, as built 3.6.2): what may
 * sit where it is asked for, where it is filed unless the person says
 * otherwise, and the record it is.
 *
 * **Only what may sit there.** Under a parent, the types whose `within`
 * holds the parent's type; at the top, the types with `top` — the same rule
 * `check.unitMisplaced` reads (`model/units.mayHaveParent`), so a unit made
 * here is never a finding for where it sits. A type that has ended on the
 * day is not offered. In the one order every list of types reads: lane, then
 * `order`, then name (`model/unitOrder.unitTypeRank`).
 *
 * **Filed with its parent.** Under a parent, the parent's scope, which keeps
 * a subtree together under the same rights. At the top, the scope it serves
 * where it serves one domain and its type does not span — a domain's unit is
 * the domain's — and otherwise the chart's own scope.
 *
 * **One record.** An actor with `unitTypeId`, `parentId` where it sits in a
 * unit, and `scopes` only where domains were picked: a unit that says nothing
 * serves the scope it is filed in where that is a domain, and nothing where it
 * is the organisation (`model/serving.scopesServed`); one inside another
 * serves through it. Pure, and no words.
 */
import type { UnitType, UnitTypeId } from '../../model/operatingModel'
import { unitTypeRank } from '../../model/unitOrder'
import { mayHaveParent, unitTypeOn } from '../../model/units'
import type { DesignElement, ElementId } from '../../model/types'
import type { ScopePath } from '../../projects/scopePath'

/** The types a new unit may have under a unit of `parentType`, or at the top where it is absent, in rank order. */
export function typesThatMaySit(types: readonly UnitType[], parentType: UnitTypeId | undefined, day: string): UnitType[] {
  const rank = unitTypeRank(types)
  return types
    .filter((type) => unitTypeOn(type, day) && mayHaveParent(type, parentType))
    .sort((a, b) => (rank.get(a.id) ?? rank.size) - (rank.get(b.id) ?? rank.size))
}

/** Whether a new unit of `type` is asked which domains it serves: at the top, or where its type spans. */
export function asksServes(type: Pick<UnitType, 'spans'> | undefined, underParent: boolean): boolean {
  return !underParent || type?.spans === true
}

/** Where a new unit is filed unless the person says otherwise. */
export function filedInDefault(at: {
  /** The parent's scope, where the unit is made inside one. */
  parentScope?: ScopePath | undefined
  underParent: boolean
  serves: readonly ScopePath[]
  spans: boolean
  /** The scope the chart is open in. */
  chartScope: ScopePath
}): ScopePath {
  if (at.underParent) return at.parentScope ?? at.chartScope
  if (at.serves.length === 1 && !at.spans) return at.serves[0]
  return at.chartScope
}

/**
 * Where it is filed when the person may not write where it would be: the
 * default where they may, otherwise the chart's own scope where they may,
 * otherwise the first scope they may write — and none where they may write
 * nowhere.
 */
export function filedInChoice(preferred: ScopePath, chartScope: ScopePath, writable: readonly ScopePath[]): ScopePath | undefined {
  if (writable.includes(preferred)) return preferred
  if (writable.includes(chartScope)) return chartScope
  return writable[0]
}

/** The record a new unit is: an actor with a type, under its parent, serving the domains picked. */
export function newUnitElement(at: {
  id: ElementId; name: string; unitTypeId: UnitTypeId; parentId?: ElementId | undefined; scopes: readonly ScopePath[]
}): DesignElement {
  return {
    id: at.id, kind: 'actor', name: at.name.trim(), lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId: at.unitTypeId,
    ...(at.parentId !== undefined ? { parentId: at.parentId } : {}),
    ...(at.scopes.length > 0 ? { scopes: [...at.scopes] } : {}),
  }
}
