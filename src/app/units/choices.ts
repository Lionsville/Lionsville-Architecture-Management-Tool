// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the pickers that link a unit offer (ADR-0036, amended 11 October
 * 2026), as rows for `widgets/PickToAdd`: the organisation's units for a
 * scope's *Served by* and a capability's *Assigned to*, the scopes for a
 * unit's *Serves*, and the areas, groupings and capabilities for its
 * *Responsible for*.
 *
 * **Units in the one order** every list of units reads (`compareUnits`):
 * grouped by their type in the type's rank, each saying where it is filed,
 * so two units of one name in two domains are told apart. A unit not there
 * on the day is not offered.
 */
import type { Translate } from '../../i18n'
import type { ElementId } from '../../model'
import type { HostModel } from '../../model/hostModel'
import { compareUnits, unitTypeRank } from '../../model/unitOrder'
import { organisationOn, unitsAbove, unitsBelow, unitsOn } from '../../model/units'
import type { Organisation, UnitLike } from '../../model/units'
import { isServable } from '../../model/serving'
import type { FiledIn } from '../../model/serving'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { scopeTrail } from '../../projects/scopeLabel'
import type { PickOption } from '../../widgets/PickToAdd'

/**
 * Where a picker's rows are said: what a scope is called, and the words.
 * Every scope a row names is said by its path (`scopeTrail`), because two
 * scopes of one name under different parents are otherwise one row twice.
 */
export type ChoiceWords = { scopeName: (path: ScopePath) => string; s: Translate }

/**
 * Every unit there on `day`, grouped by type in rank order. `leave` takes a
 * unit off the list — one already linked — and `refuse` shows one that may
 * not be picked, with why in place of where it is filed.
 */
export function unitChoices(at: ChoiceWords & {
  organisation: Organisation
  filedIn: FiledIn
  day: string
  leave?: (unit: UnitLike) => boolean
  refuse?: (unit: UnitLike) => string | undefined
}): PickOption[] {
  const { organisation, filedIn, day, s } = at
  const scopeName = (path: ScopePath) => scopeTrail(path, at.scopeName)
  const typeName = new Map(organisation.unitTypes.map((type) => [type.id, type.name]))
  return unitsOn(organisation, day)
    .filter((unit) => !at.leave?.(unit))
    .sort(compareUnits(unitTypeRank(organisation.unitTypes)))
    .map((unit) => {
      const refused = at.refuse?.(unit)
      const kept = filedIn(unit.id)
      return {
        id: unit.id,
        label: unit.name,
        group: typeName.get(unit.unitTypeId ?? '') ?? s('pick.otherUnits'),
        ...(refused !== undefined
          ? { note: refused, disabled: true }
          : kept !== undefined ? { note: s('pick.filedIn', { scope: scopeName(kept) }) } : {}),
      }
    })
}

/**
 * The scopes a unit may be said to serve, in the tree's order: each but
 * `leave`'s and the organisation, which is no domain (`isServable`), each
 * by its path from the organisation down, which the search matches too.
 */
export function scopeChoices(at: ChoiceWords & { scopes: readonly ScopePath[]; leave: readonly ScopePath[] }): PickOption[] {
  return at.scopes
    .filter((path) => isServable(path) && !at.leave.includes(path))
    .map((path) => ({ id: path, label: scopeTrail(path, at.scopeName) }))
}

/**
 * Every area, grouping and capability in the organisation a unit may be made
 * responsible for, by the scope that defines it — the open scope's as its
 * session has them first, then the tree's in path order — each with what it
 * sits in. `leave` takes off the ones it answers for already.
 */
export function functionChoices(at: ChoiceWords & {
  index: ScopeIndex; scope: ScopePath; model: HostModel; leave: ReadonlySet<ElementId>
}): PickOption[] {
  const { index, scope, model, leave, s } = at
  const scopeName = (path: ScopePath) => scopeTrail(path, at.scopeName)
  const here = model.elements.filter((element) => element.kind === 'function' && element.ref === undefined)
  const nameHere = new Map(here.map((element) => [element.id, element.name]))
  const named = (id: ElementId | undefined) => (id === undefined ? undefined : nameHere.get(id) ?? index.lookup(id)?.name)
  const row = (id: ElementId, name: string, parentId: ElementId | undefined, path: ScopePath): PickOption => {
    const parent = named(parentId)
    return { id, label: name, group: scopeName(path), ...(parent !== undefined ? { note: s('pick.in', { name: parent }) } : {}) }
  }
  const elsewhere = index.entries()
    .filter((entry) => entry.kind === 'function' && entry.master !== undefined && entry.master !== scope && !nameHere.has(entry.id))
    .sort((a, b) => a.master!.localeCompare(b.master!) || a.name.localeCompare(b.name))
  return [
    ...here.map((element) => row(element.id, element.name, element.parentId, scope)),
    ...elsewhere.map((entry) => row(entry.id, entry.name, entry.parentId, entry.master!)),
  ].filter((option) => !leave.has(option.id))
}

/** The row for *At the top*: no unit's id is the empty string. */
export const AT_THE_TOP = ''

/**
 * Where units may be moved to (3.7.1): *At the top* and every unit there on
 * `day`, the places where every unit moved may sit by its type first, then
 * the others under a heading of their own — a move there is allowed and
 * leaves the unit misplaced. Each unit says the units it sits in, by path, so
 * two of one name are told apart, and the search finds it by them too; one
 * the units moved hold, or the place they sit now, is shown and not offered.
 */
export function parentChoices(at: ChoiceWords & {
  organisation: Organisation
  /** The units moved; the first is the one the dialog is about. */
  unitIds: readonly ElementId[]
  /** Where the first sits now: its parent on the day, absent at the top. */
  current: ElementId | undefined
  day: string
  /** Whether every unit moved may sit under this parent — absent, the top — by its type. */
  fits: (parentId: ElementId | undefined) => boolean
}): PickOption[] {
  const { organisation, day, s } = at
  const on = organisationOn(organisation, day).units
  const inside = new Set(at.unitIds.flatMap((id) => [id, ...unitsBelow(on, id)]))
  const name = new Map(on.map((unit) => [unit.id, unit.name]))
  const fitting = s('unitMove.fitting')
  const others = s('unitMove.misfitting')
  const top: PickOption = {
    id: AT_THE_TOP, label: s('unitMove.top'), group: at.fits(undefined) ? fitting : others,
    ...(at.current === undefined ? { note: s('unitMove.current'), disabled: true } : {}),
  }
  const rows = unitsOn(organisation, day).sort(compareUnits(unitTypeRank(organisation.unitTypes))).map((unit): PickOption => {
    const trail = unitsAbove(on, unit.id).reverse().map((id) => name.get(id) ?? id).join(' › ')
    const refused = at.unitIds.includes(unit.id) ? s('unitMove.itself') : inside.has(unit.id) ? s('unitMove.inside') : unit.id === at.current ? s('unitMove.current') : undefined
    return {
      id: unit.id, label: unit.name, group: at.fits(unit.id) ? fitting : others,
      ...(refused !== undefined ? { note: refused, disabled: true } : trail ? { note: s('pick.in', { name: trail }) } : {}),
    }
  })
  const all = [top, ...rows]
  return [...all.filter((one) => one.group === fitting), ...all.filter((one) => one.group !== fitting)]
}
