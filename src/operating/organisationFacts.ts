// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the operating model's page reads about the organisation it shapes: which
 * units there are today and which roles each has, who holds them and where places
 * are vacant, and everything that says otherwise than the model.
 *
 * Nothing here is stored. Units come from the type's slots and the unit's own,
 * holders from the assignments running today, vacant from a slot's minimum. A
 * host hands the page these, since the page knows the model and nobody's name.
 *
 * Pure, and no words: the page says them.
 */
import { linesSaid } from '../model/operatingModel'
import type { LineKind, Role, RoleId, RoleSlot, UnitType, UnitTypeId } from '../model/operatingModel'
import { holdersOn, isExceptionPlacement, runsOn, slotsOf, unitsOn } from '../model/units'
import type { Assignment, AssignmentReportingLine, Organisation, UnitLike } from '../model/units'
import type { UnitReportingLine } from '../model/types'

export type HolderFact = { readonly name: string; readonly acting: boolean }

export type UnitFact = {
  readonly id: string
  readonly name: string
  readonly scope: string
  readonly typeId?: UnitTypeId
  /** The type's slots, then the unit's own, then a role somebody holds there outside them. */
  readonly roles: readonly RoleId[]
}

export type RolePlace = { readonly unit: UnitFact; readonly holders: readonly HolderFact[]; readonly vacant: number }

export type OutsideTheModel = {
  /** Who says otherwise: a slot of a type, a unit, one holder, or a holder placed outside the slots. */
  readonly on: 'type' | 'unit' | 'holder' | 'outside'
  readonly key: string
  readonly roleId: RoleId
  readonly kind: LineKind
  /** The role it says, and in which unit where a unit or a holder names one. No role: by nesting. */
  readonly saysRole?: RoleId
  readonly saysUnit?: string
  readonly typeId?: UnitTypeId
  readonly slotIndex?: number
  readonly unitId?: string
  readonly unitName?: string
  readonly assignmentId?: string
  readonly holder?: string
  readonly units: number
  /** What it departs from: the role's line of that kind, or a type's where the unit's type says one. */
  readonly departsFrom?: RoleId
  /** Where the unit or the assignment is kept, for putting it back there. */
  readonly scope?: string
  /** A unit's own lines without this one, and a holder's: what is left once it is put back. */
  readonly own?: readonly UnitReportingLine[]
  readonly ownHolder?: readonly AssignmentReportingLine[]
}

export type OrganisationFacts = {
  readonly units: readonly UnitFact[]
  placesOf(roleId: RoleId): readonly RolePlace[]
  holdersIn(unitId: string, roleId: RoleId): readonly HolderFact[]
  /** What a unit's own and holders' own lines say, and who is placed outside the slots. A type's are read from the model. */
  readonly saidBelow: readonly OutsideTheModel[]
  /** How many units there are today of each type. */
  unitsOfType(typeId: UnitTypeId): readonly UnitFact[]
}

export type OrganisationSeen = {
  readonly organisation: Organisation
  readonly day: string
  /** A person's name as this reader may see it. */
  readonly personName: (assignment: Assignment) => string
  readonly scopeOfUnit: (unitId: string) => string | undefined
  readonly scopeOfAssignment: (assignment: Assignment) => string | undefined
}

const slotOfRole = (type: UnitType | undefined, roleId: RoleId): RoleSlot | undefined => type?.slots.find((slot) => slot.role === roleId)

/** The line a unit of this type holds by, of a kind, leaving out what the unit itself says. */
function lineByModel(type: UnitType | undefined, role: Role | undefined, roleId: RoleId, kind: LineKind) {
  return linesSaid(slotOfRole(type, roleId)?.reportsTo).find((one) => one.kind === kind) ?? linesSaid(role?.reportsTo).find((one) => one.kind === kind)
}

export function organisationFacts({ organisation, day, personName, scopeOfUnit, scopeOfAssignment }: OrganisationSeen): OrganisationFacts {
  const types = new Map(organisation.unitTypes.map((type) => [type.id, type]))
  const roles = new Map(organisation.roles.map((role) => [role.id, role]))
  const running = organisation.assignments.filter((one) => runsOn(one, day))
  const seen = (unit: UnitLike): UnitFact => {
    const held = running.filter((one) => one.unitId === unit.id).map((one) => one.roleId)
    const slots = slotsOf(unit, unit.unitTypeId ? types.get(unit.unitTypeId) : undefined).map((slot) => slot.role)
    return {
      id: unit.id, name: unit.name, scope: scopeOfUnit(unit.id) ?? '',
      ...(unit.unitTypeId ? { typeId: unit.unitTypeId } : {}),
      roles: [...new Set([...slots, ...held])],
    }
  }
  const unitsLike = unitsOn(organisation, day)
  const units = unitsLike.map(seen).sort((a, b) => a.name.localeCompare(b.name))
  const holdersIn = (unitId: string, roleId: RoleId): HolderFact[] =>
    holdersOn(running, unitId, roleId, day).map((one) => ({ name: personName(one), acting: one.acting === true }))
  const saidBelow: OutsideTheModel[] = []
  for (const unit of unitsLike) {
    const type = unit.unitTypeId ? types.get(unit.unitTypeId) : undefined
    for (const line of unit.reportingLines ?? []) {
      if (!runsOn(line, day)) continue
      const departs = lineByModel(type, roles.get(line.role), line.role, line.kind)?.role
      saidBelow.push({
        on: 'unit', key: `unit/${unit.id}/${line.role}/${line.kind}`, roleId: line.role, kind: line.kind, unitId: unit.id, unitName: unit.name, units: 1,
        ...(line.to ? { saysRole: line.to.role, saysUnit: organisation.units.find((one) => one.id === line.to?.unit)?.name ?? line.to.unit } : {}),
        ...(departs ? { departsFrom: departs } : {}), scope: scopeOfUnit(unit.id) ?? '',
        own: (unit.reportingLines ?? []).filter((held) => held !== line),
      })
    }
  }
  for (const one of running) {
    const unit = organisation.units.find((held) => held.id === one.unitId)
    if (!unit) continue
    const type = unit.unitTypeId ? types.get(unit.unitTypeId) : undefined
    for (const line of one.reportsTo ?? []) {
      if (!runsOn(line, day)) continue
      const departs = lineByModel(type, roles.get(one.roleId), one.roleId, line.kind)?.role
      saidBelow.push({
        on: 'holder', key: `holder/${one.id}/${line.kind}`, roleId: one.roleId, kind: line.kind, unitId: unit.id, unitName: unit.name, assignmentId: one.id,
        holder: personName(one), units: 1, saysRole: line.to.role,
        saysUnit: organisation.units.find((held) => held.id === line.to.unit)?.name ?? line.to.unit,
        ...(departs ? { departsFrom: departs } : {}), scope: scopeOfAssignment(one) ?? '',
        ownHolder: (one.reportsTo ?? []).filter((held) => held !== line),
      })
    }
    if (isExceptionPlacement(organisation, one)) {
      saidBelow.push({
        on: 'outside', key: `outside/${one.id}`, roleId: one.roleId, kind: 'solid', unitId: unit.id, unitName: unit.name, assignmentId: one.id, holder: personName(one), units: 1,
      })
    }
  }
  return {
    units,
    holdersIn,
    saidBelow,
    unitsOfType: (typeId) => units.filter((unit) => unit.typeId === typeId),
    placesOf: (roleId) => units.filter((unit) => unit.roles.includes(roleId)).map((unit) => {
      const holders = holdersIn(unit.id, roleId)
      const like = unitsLike.find((held) => held.id === unit.id)
      const min = like ? slotsOf(like, unit.typeId ? types.get(unit.typeId) : undefined).find((slot) => slot.role === roleId)?.min ?? 0 : 0
      return { unit, holders, vacant: Math.max(0, min - holders.length) }
    }),
  }
}

