// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's type from the operating model, as the agent reads and follows it
 * (ADR-0036, amended 17 October 2026; `projects/scopeType.ts` is the rule).
 *
 * `scopes.list` says each scope's type — a unit type's id and name, or the
 * built-in kind — the units that serve it with their types, and how the two
 * stand (`typeLink`). A unit linked to a scope by `element.add` or
 * `element.update` gives the scope its type where the host can write that
 * scope's header (`SessionView.followScopeTypes`), and the answer says which
 * scopes followed and which did not.
 *
 * Over the tree's seams only — units, the operating model, the scopes — so
 * `agent` imports nothing from `projects`: the serving arithmetic is the
 * model's (`model/serving.ts`).
 */
import { isServable, servingUnits } from '../model/serving'
import type { Organisation, UnitLike } from '../model/units'
import type { TreeScope, TreeView } from './tree'

/** How a scope's type stands to the units that serve it; the rule's five words. */
export type TypeLink = 'agrees' | 'disagrees' | 'unserved' | 'gone' | 'unsaid'

/** What the tree says of units and types, read once per answer. */
type Serving = {
  organisation: Organisation
  filedIn: (unitId: string) => string | undefined
  typeName: ReadonlyMap<string, string>
}

function servingOf(tree: TreeView): Serving | undefined {
  const units = tree.units?.()
  if (!units) return undefined
  const operating = tree.operatingModel?.()
  const kept = new Map(units.map(({ scope, unit }) => [unit.id, scope]))
  const moves = tree.moves?.().map((one) => one.move) ?? []
  return {
    organisation: {
      units: units.map(({ unit }) => unit as UnitLike),
      assignments: tree.assignments?.().map((one) => one.assignment) ?? [],
      roles: operating?.roles ?? [],
      unitTypes: operating?.unitTypes ?? [],
      ...(moves.length ? { moves } : {}),
    },
    filedIn: (id) => kept.get(id),
    typeName: new Map((operating?.unitTypes ?? []).map((type) => [type.id, type.name])),
  }
}

/** The units serving `scope` today, by themselves (`servingUnits`), with their types named. */
function servedBy(serving: Serving, scope: string, day: string): { id: string; name: string; unitTypeId?: string; unitType?: string }[] {
  if (!isServable(scope)) return []
  return servingUnits(serving.organisation, scope, day, serving.filedIn).units.map((unit) => ({
    id: unit.id, name: unit.name,
    ...(unit.unitTypeId !== undefined ? { unitTypeId: unit.unitTypeId, ...(serving.typeName.has(unit.unitTypeId) ? { unitType: serving.typeName.get(unit.unitTypeId)! } : {}) } : {}),
  }))
}

function linkOf(unitTypeId: string | undefined, servingTypes: readonly string[], known: (id: string) => boolean): TypeLink {
  if (unitTypeId === undefined) return 'unsaid'
  if (!known(unitTypeId)) return 'gone'
  if (servingTypes.length === 0) return 'unserved'
  return servingTypes.includes(unitTypeId) ? 'agrees' : 'disagrees'
}

/** One scope as `scopes.list` says it: the listing's row, its type named, who serves it and how the two stand. */
export function scopeTyped(tree: TreeView, scope: TreeScope, day: string): Record<string, unknown> {
  const serving = servingOf(tree)
  if (!serving) return { ...scope }
  const units = servedBy(serving, scope.path, day)
  const types = [...new Set(units.map((unit) => unit.unitTypeId).filter((id): id is string => id !== undefined))]
  const link = linkOf(scope.unitTypeId, types, (id) => serving.typeName.has(id))
  return {
    ...scope,
    ...(scope.unitTypeId !== undefined && serving.typeName.has(scope.unitTypeId) ? { unitType: serving.typeName.get(scope.unitTypeId)! } : {}),
    ...(isServable(scope.path) ? { servedBy: units, typeLink: link } : {}),
  }
}

/** One scope's type to follow, as the handler's answer says it. */
export type ScopeTypeFollowed = { scope: string; unitTypeId: string; unitType?: string; set: boolean }

/**
 * The type each of `scopes` follows once `unit` serves it — the unit's,
 * unless the scope's own still agrees with a unit serving it — as the scopes
 * to write and what to write, with the type named for the answer. Nothing
 * for a unit with no type, or a scope the tree does not list.
 */
export function scopeTypesToFollow(
  tree: TreeView | undefined, unit: { id: string; unitTypeId?: string | undefined }, scopes: readonly string[], day: string,
): Map<string, ScopeTypeFollowed> {
  const follow = new Map<string, ScopeTypeFollowed>()
  const serving = tree && servingOf(tree)
  if (!tree || !serving || !unit.unitTypeId) return follow
  const listed = new Map(tree.scopes().map((scope) => [scope.path, scope]))
  for (const scope of scopes) {
    const held = listed.get(scope)
    if (!held || !isServable(scope)) continue
    const types: (string | undefined)[] = [...servedBy(serving, scope, day).map((one) => one.unitTypeId), unit.unitTypeId]
    const after: string[] = [...new Set(types.filter((id): id is string => id !== undefined))]
    if (held.unitTypeId !== undefined && after.includes(held.unitTypeId)) continue
    if (held.unitTypeId === unit.unitTypeId) continue
    const unitType = serving.typeName.get(unit.unitTypeId)
    follow.set(scope, { scope, unitTypeId: unit.unitTypeId, ...(unitType !== undefined ? { unitType } : {}), set: false })
  }
  return follow
}
