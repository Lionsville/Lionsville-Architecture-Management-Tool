// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's type from the operating model (ADR-0036, amended 17 October
 * 2026): the one rule, with no screen and no store in it.
 *
 * A scope says what it is in one of two vocabularies: a **unit type** of the
 * organisation's own operating model (`unitTypeId`), or one of the five
 * **built-in kinds** (`kind`). Where the organisation has an operating model
 * its unit types are offered first and the built-in kinds below them, still
 * allowed; without one the list is as it always was. One of the two is said,
 * never both: a unit type picked clears the kind, a kind picked clears the
 * unit type. Both are labels — nothing branches on either (`ScopeKind`) —
 * which is why a unit type needs no built-in kind behind it: what a scope
 * does is read off its shape, a scope with views or scopes under it.
 *
 * **The type follows the unit.** When a unit is linked to a scope — from a
 * home's *Served by*, a unit's *Serves*, a new unit's domains or the agent —
 * the scope's type becomes that unit's type in the same change, unless the
 * type it has still agrees with a unit that serves it: a scope served by a
 * division and a team under it keeps saying *Division* when the team is
 * added. Unlinking leaves the type as it is; undoing a link is unlinking.
 *
 * **The link is shown and checked.** A scope's type and the types of the
 * units that serve it agree, disagree, or there is nothing to compare —
 * nothing serves it, or its type is no unit type the operating model holds —
 * and the checks say the last three ({@link TypeLink}).
 */
import type { ElementId } from '../model'
import type { UnitTypeId } from '../model/operatingModel'
import { isServable, servingUnits } from '../model/serving'
import type { ScopeKind } from './scope'
import type { ScopeIndex } from './scopeIndex'
import type { ScopePath } from './scopePath'

/** A scope's type as it says it: one of the two, where it says either. */
export type ScopeTyped = { readonly kind?: ScopeKind | undefined; readonly unitTypeId?: string | undefined }

/**
 * How a scope's type stands to the units that serve it:
 * - `agrees` — a unit of its type serves it;
 * - `disagrees` — units serve it and none is of its type;
 * - `unserved` — it says a unit type and no unit serves it;
 * - `gone` — it says a unit type the operating model does not hold;
 * - `unsaid` — it says no unit type: nothing to compare.
 */
export type TypeLink = 'agrees' | 'disagrees' | 'unserved' | 'gone' | 'unsaid'

/**
 * The link between a scope's type and the types of the units that serve it
 * (`model/serving.servingUnits`), given whether its type is one the
 * operating model holds.
 */
export function typeLinkOf(scope: ScopeTyped, servingTypes: readonly string[], typeKnown: (unitTypeId: string) => boolean): TypeLink {
  if (scope.unitTypeId === undefined) return 'unsaid'
  if (!typeKnown(scope.unitTypeId)) return 'gone'
  if (servingTypes.length === 0) return 'unserved'
  return servingTypes.includes(scope.unitTypeId) ? 'agrees' : 'disagrees'
}

/**
 * The type a scope takes when a unit of `unitType` is linked to it, given
 * the types of every unit serving it once the link is made: the unit's,
 * unless its own type is among them already — then nothing, and the type is
 * left as it is. A unit with no type links nothing.
 */
export function typeToFollow(scope: ScopeTyped, unitType: string | undefined, servingTypesAfter: readonly string[]): string | undefined {
  if (unitType === undefined || unitType === '') return undefined
  if (scope.unitTypeId !== undefined && servingTypesAfter.includes(scope.unitTypeId)) return undefined
  return scope.unitTypeId === unitType ? undefined : unitType
}

/**
 * The header patch that gives a scope a unit type: the kind goes, since one
 * of the two is said — cleared with `null`, which a step kept as JSON keeps
 * where it would lose `undefined`.
 */
export function typedByUnitType(unitTypeId: string): { unitTypeId: string; kind: null } {
  return { unitTypeId, kind: null }
}

/** The header patch that gives a scope a built-in kind, or none: the unit type goes. */
export function typedByKind(kind: ScopeKind | undefined): { kind: ScopeKind | null; unitTypeId: null } {
  return { kind: kind ?? null, unitTypeId: null }
}

/**
 * The value a type picker holds for a scope: the unit type first, else the
 * kind, else nothing — and back again. `unit:<id>` and `kind:<kind>` keep
 * the two apart in one list, whatever a unit type is called.
 */
export type TypeChoice = `unit:${string}` | `kind:${ScopeKind}` | ''

export function typeChoiceOf(scope: ScopeTyped): TypeChoice {
  if (scope.unitTypeId !== undefined) return `unit:${scope.unitTypeId}`
  return scope.kind !== undefined ? `kind:${scope.kind}` : ''
}

/** What a picker's value says: the header's two fields, as a patch that sets one and clears the other. */
export function typeChosen(choice: string): { kind?: ScopeKind | null; unitTypeId?: string | null } {
  if (choice.startsWith('unit:') && choice.length > 5) return typedByUnitType(choice.slice(5))
  if (choice.startsWith('kind:')) return typedByKind(choice.slice(5) as ScopeKind)
  return typedByKind(undefined)
}

/**
 * The type a scope takes when `unitId` is linked to it (`typeToFollow`):
 * the unit's, unless the scope's own still agrees with a unit serving it
 * once the link is made. Nothing where the type stays.
 */
export function typeFollowingUnit(index: ScopeIndex, scope: ScopePath, unitId: ElementId, day: string): UnitTypeId | undefined {
  const organisation = index.organisation()
  const unit = organisation.units.find((one) => one.id === unitId)
  if (!unit?.unitTypeId || !isServable(scope)) return undefined
  const kept = new Map(index.units().map(({ scope: at, unit: one }) => [one.id, at]))
  const serving = servingUnits(organisation, scope, day, (id) => kept.get(id)).units
  const after = [...new Set([...serving.map((one) => one.unitTypeId ?? ''), unit.unitTypeId].filter(Boolean))]
  return typeToFollow({ unitTypeId: index.scopeTypes().get(scope) }, unit.unitTypeId, after)
}
