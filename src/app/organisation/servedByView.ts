// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a scope's *Served by* says (ADR-0036, amended 11 October 2026), off
 * the index and nothing else: the units whose `scopes` name it — or that are
 * filed in it and say nothing, with nothing above them that serves it — in
 * the one order, each with its type, where it is filed and who holds its
 * managing role today; how many serve it only through them; the domain's
 * owner, worked out from the rule on the serving unit filed highest in it;
 * and the units a *+ Unit* offers.
 *
 * Read from the other end of the same field a unit's *Serves* writes, so
 * nothing here is kept: `model/serving.ts` is the arithmetic.
 */
import type { ElementId } from '../../model'
import type { UnitTypeId } from '../../model/operatingModel'
import { domainOwnerOn, ruleRole } from '../../model/owners'
import type { PersonId } from '../../model/person'
import { isServable, mayStopServing, scopesServed, servesOn, servingUnits } from '../../model/serving'
import { managersOf } from '../../model/units'
import type { UnitLike } from '../../model/units'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { typeLinkOf } from '../../projects/scopeType'
import type { TypeLink } from '../../projects/scopeType'

/** Moved to `projects/scopeType.ts`, where a host with no screen links a unit too (ADR-0040 §1). */
export { typeFollowingUnit } from '../../projects/scopeType'
import type { PickOption } from '../../widgets/PickToAdd'
import { unitChoices } from '../units/choices'
import type { ChoiceWords } from '../units/choices'

/** One unit serving the scope. */
export type ServingRow = {
  id: ElementId
  name: string
  /** Its unit type's name. */
  type: string
  /** Its unit type's id. */
  typeId: UnitTypeId | ''
  /** The scope that keeps it: where a change to what it serves is that scope's step. */
  filedIn: ScopePath
  /** Who holds a managing role in it today: the people, by register id. */
  managers: PersonId[]
  /** Whether taking the scope out of its `scopes` stops it serving here: only where it names it and has somewhere else. */
  mayStop: boolean
}

/**
 * The scope's type against the units that serve it (ADR-0036, amended 17
 * October 2026; `projects/scopeType.ts`): the unit type it says, by id and
 * name where the operating model still holds it, how it stands to the
 * serving units' types, and those types by name.
 */
export type ScopeTypeLink = {
  unitTypeId?: string
  name?: string
  link: TypeLink
  /** The types of the units that serve it, by name, each once. */
  servingTypes: string[]
}

export type ServedByView = {
  scope: ScopePath
  rows: ServingRow[]
  type: ScopeTypeLink
  /** How many units serve it only through a unit above them. */
  through: number
  /** The domain owner as the rule works it out; absent where the organisation has no such rule. */
  owner?: { role: string; unit?: string; people: PersonId[] }
  /** What *+ Unit* offers: every unit there today that does not serve the scope yet. */
  choices: PickOption[]
}

/**
 * The units *+ Unit* offers for `scope` on `day`: every unit there that does
 * not serve it yet, a unit of a type that serves one domain and serves one
 * already shown and said why it cannot take a second. `scope` absent is a
 * scope not made yet — the new-scope dialog's *Served by* — which nothing
 * serves. Nothing where the organisation has no units.
 */
export function servingChoicesOf(index: ScopeIndex, scope: ScopePath | undefined, day: string, words: ChoiceWords): PickOption[] {
  const organisation = index.organisation()
  if (organisation.units.length === 0) return []
  const kept = new Map(index.units().map(({ scope: at, unit }) => [unit.id, at]))
  const filedIn = (id: ElementId) => kept.get(id)
  const typeName = new Map(organisation.unitTypes.map((type) => [type.id, type.name]))
  const spans = new Set(organisation.unitTypes.filter((type) => type.spans === true).map((type) => type.id))
  const serving = (unit: UnitLike) => scope !== undefined && servesOn(organisation, unit.id, (one) => one === scope, day, filedIn)
  return unitChoices({
    organisation, filedIn, day, ...words,
    leave: serving,
    // A type that serves one domain is offered, and said why it cannot take a second.
    refuse: (unit) => (spans.has(unit.unitTypeId ?? '') || scopesServed(unit, filedIn).length === 0
      ? undefined
      : words.s('pick.servesOne', { type: typeName.get(unit.unitTypeId ?? '') ?? '' })),
  })
}

/**
 * The choices as this person may pick them: a unit kept where they may only
 * read is shown, and said so, since adding it would be a step there.
 */
export function pickableBy(choices: readonly PickOption[], mayChange: (unitId: ElementId) => boolean, words: Pick<ChoiceWords, 's'>): PickOption[] {
  return choices.map((one) => (one.disabled || mayChange(one.id) ? one : { ...one, disabled: true, note: words.s('pick.readOnly') }))
}

/**
 * What *Served by* says about `scope` on `day`; nothing where the
 * organisation has no unit types and no units, which have nothing to say,
 * and nothing about the organisation itself, which is no domain and which no
 * unit serves (`model/serving.isServable`).
 */
export function servedByOf(index: ScopeIndex, scope: ScopePath, day: string, words: ChoiceWords): ServedByView | undefined {
  if (!isServable(scope)) return undefined
  const organisation = index.organisation()
  if (organisation.units.length === 0 && organisation.unitTypes.length === 0) return undefined
  const kept = new Map(index.units().map(({ scope: at, unit }) => [unit.id, at]))
  const filedIn = (id: ElementId) => kept.get(id)
  const typeName = new Map(organisation.unitTypes.map((type) => [type.id, type.name]))
  const { units, through } = servingUnits(organisation, scope, day, filedIn)
  const rows = units.map((unit) => ({
    id: unit.id,
    name: unit.name,
    type: typeName.get(unit.unitTypeId ?? '') ?? '',
    typeId: unit.unitTypeId ?? '',
    filedIn: filedIn(unit.id) ?? '',
    managers: managersOf(organisation, unit.id, day).filter((one) => one.unitId === unit.id).map((one) => one.person),
    mayStop: mayStopServing(unit, scope, filedIn),
  }))
  const { operatingRules } = index.operatingModel()
  const roleId = ruleRole(operatingRules, 'domainOwner')
  const worked = roleId ? domainOwnerOn(organisation, operatingRules, scope, day, filedIn) : undefined
  const role = organisation.roles.find((one) => one.id === roleId)?.name ?? roleId ?? ''
  const unitName = worked?.unitId === undefined ? undefined : organisation.units.find((one) => one.id === worked.unitId)?.name
  const choices = servingChoicesOf(index, scope, day, words)
  const unitTypeId = index.scopeTypes().get(scope)
  const servingIds = [...new Set(units.map((unit) => unit.unitTypeId ?? '').filter(Boolean))]
  const type: ScopeTypeLink = {
    ...(unitTypeId !== undefined ? { unitTypeId } : {}),
    ...(unitTypeId !== undefined && typeName.has(unitTypeId) ? { name: typeName.get(unitTypeId)! } : {}),
    link: typeLinkOf({ unitTypeId }, servingIds, (id) => typeName.has(id)),
    servingTypes: servingIds.map((id) => typeName.get(id) ?? id),
  }
  return {
    scope, rows, type, through: through.length, choices,
    ...(worked ? { owner: { role, people: worked.owners.map((one) => one.person), ...(unitName !== undefined ? { unit: unitName } : {}) } } : {}),
  }
}

/**
 * The unit types a scope may be typed by, live today: what the type picker
 * offers before the built-in kinds. Nothing where the organisation has no
 * operating model, and the picker is then as it always was.
 */
export function unitTypeChoicesOf(index: ScopeIndex, day: string): { id: UnitTypeId; name: string }[] {
  return index.organisation().unitTypes
    .filter((type) => (type.from === undefined || type.from <= day) && (type.until === undefined || type.until >= day))
    .map((type) => ({ id: type.id, name: type.name }))
}
