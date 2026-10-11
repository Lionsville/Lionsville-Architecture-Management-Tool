// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which units serve a scope (ADR-0036 §3, amended 11 October 2026): one
 * field, `unit.scopes`, read from either end — a unit's *Serves* and a
 * scope's *Served by* — and never kept twice.
 *
 * - **A unit serves** the scopes in its `scopes`, or the scope it is filed in
 *   where it says nothing. Adding a scope keeps that reading: a unit that said
 *   nothing goes on serving its own scope beside the new one.
 * - **A unit under one that serves a scope serves it through that one.** So a
 *   scope's *Served by* lists the units that say so themselves, and a unit
 *   that says nothing is listed only where nothing above it serves the scope.
 * - **The serving unit filed highest** is the one a domain's owner is worked
 *   out from (`owners.domainOwnerOn`): one filed in the scope before one filed
 *   elsewhere, then the one with fewest units above it, then the one order.
 *
 * Everything is on a day, as every question about units is: the units there
 * that day, under the parents the plans' moves give them. Pure, with no words
 * and no paths: `filedIn` says where each unit is kept, and a caller that
 * reads scopes as nested says which served scope covers which (`covers`).
 */
import type { ElementId } from './types'
import { compareUnits, unitTypeRank } from './unitOrder'
import { isUnit, organisationOn, unitsAbove, unitsOn } from './units'
import type { Organisation, UnitLike } from './units'

/** Where a unit is kept: the scope it is filed in, where the caller knows it. */
export type FiledIn = (unitId: ElementId) => string | undefined

/** The scopes a unit serves itself: its `scopes`, or the scope it is filed in where it says nothing. */
export function scopesServed(unit: Pick<UnitLike, 'id' | 'scopes'>, filedIn: FiledIn): string[] {
  if (unit.scopes) return [...unit.scopes]
  const at = filedIn(unit.id)
  return at === undefined ? [] : [at]
}

/** The `scopes` a unit is written with to serve one more: what it serves now, its own scope kept, and `scope` once. */
export function scopesWith(unit: Pick<UnitLike, 'id' | 'scopes'>, scope: string, filedIn: FiledIn): string[] {
  const now = scopesServed(unit, filedIn)
  return now.includes(scope) ? now : [...now, scope]
}

/**
 * Whether taking `scope` out of a unit's `scopes` stops it serving `scope`:
 * only where it names it, and where something is left or it is filed
 * elsewhere — a unit with nothing left serves the scope it is filed in.
 */
export function mayStopServing(unit: Pick<UnitLike, 'id' | 'scopes'>, scope: string, filedIn: FiledIn): boolean {
  if (!unit.scopes?.includes(scope)) return false
  return unit.scopes.length > 1 || filedIn(unit.id) !== scope
}

/** The `scopes` a unit is written with to stop serving `scope`: absent, its own scope again, where none is left. */
export function scopesWithout(unit: Pick<UnitLike, 'scopes'>, scope: string): string[] | undefined {
  const rest = (unit.scopes ?? []).filter((held) => held !== scope)
  return rest.length ? rest : undefined
}

/**
 * Whether a unit serves a scope `covers` accepts on `day`, itself or through
 * a unit above it — the parents that day's moves give.
 */
export function servesOn(
  organisation: Organisation, unitId: ElementId, covers: (scope: string) => boolean, day: string, filedIn: FiledIn,
): boolean {
  const { units } = organisationOn(organisation, day)
  const byId = new Map(units.filter(isUnit).map((unit) => [unit.id, unit]))
  return [unitId, ...unitsAbove(units, unitId)].some((id) => {
    const unit = byId.get(id)
    return unit !== undefined && scopesServed(unit, filedIn).some(covers)
  })
}

/** Who serves a scope on a day: the units listed, and those that serve it only through a unit above them. */
export type ServingUnits = {
  /** In the one order every list of units reads (`compareUnits`). */
  units: UnitLike[]
  /** Units that say nothing, filed in the scope, under a unit that serves it. */
  through: UnitLike[]
}

/**
 * The units serving `scope` on `day` (*Served by*): every unit there that
 * names it, and every one filed there that says nothing — apart from those
 * under a unit that serves it, which serve it through that one.
 */
export function servingUnits(organisation: Organisation, scope: string, day: string, filedIn: FiledIn): ServingUnits {
  const there = unitsOn(organisation, day)
  const serving = there.filter((unit) => scopesServed(unit, filedIn).includes(scope))
  const servingIds = new Set(serving.map((unit) => unit.id))
  const order = compareUnits(unitTypeRank(organisation.unitTypes))
  const units: UnitLike[] = []
  const through: UnitLike[] = []
  for (const unit of serving) {
    const under = unit.scopes === undefined && unitsAbove(there, unit.id).some((id) => servingIds.has(id))
    if (under) through.push(unit)
    else units.push(unit)
  }
  return { units: units.sort(order), through: through.sort(order) }
}

/**
 * The serving unit filed highest in `scope` on `day`: of the units *Served
 * by* lists, one filed in the scope before one filed elsewhere, then the one
 * with fewest units above it, then the one order. None where nothing serves it.
 */
export function servingUnitFiledHighest(
  organisation: Organisation, scope: string, day: string, filedIn: FiledIn,
): UnitLike | undefined {
  const { units } = servingUnits(organisation, scope, day, filedIn)
  if (units.length === 0) return undefined
  const there = unitsOn(organisation, day)
  const depth = (unit: UnitLike) => unitsAbove(there, unit.id).length
  const elsewhere = (unit: UnitLike) => (filedIn(unit.id) === scope ? 0 : 1)
  // `units` is in the one order already, and a stable sort keeps it for a tie.
  return [...units].sort((a, b) => elsewhere(a) - elsewhere(b) || depth(a) - depth(b))[0]
}
