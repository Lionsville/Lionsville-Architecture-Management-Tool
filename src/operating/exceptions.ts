// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one list of every place that says otherwise than the model: a unit type's
 * slot against its role, a unit's own line, a holder's own, and a role held
 * outside the slots. And where many say the same, the suggestion the agent is
 * told to make too: the model is what to change. Pure, and no words.
 */
import { linesSaid } from '../model/operatingModel'
import type { LineKind, ReportsTo, Role, RoleId, UnitType } from '../model/operatingModel'
import type { OrganisationFacts, OutsideTheModel } from './organisationFacts'

/** What a type's slots say that their role does not. */
export function slotExceptions(types: readonly UnitType[], roles: readonly Role[], facts: OrganisationFacts | undefined): OutsideTheModel[] {
  const found: OutsideTheModel[] = []
  for (const type of types) {
    type.slots.forEach((slot, slotIndex) => {
      const role = roles.find((one) => one.id === slot.role)
      for (const line of linesSaid(slot.reportsTo)) {
        const own = linesSaid(role?.reportsTo).find((one) => one.kind === line.kind)
        if (own?.role === line.role && own?.within === line.within) continue
        found.push({
          on: 'type', key: `type/${type.id}/${slot.role}/${line.kind}`, roleId: slot.role, kind: line.kind, typeId: type.id, slotIndex,
          units: facts?.unitsOfType(type.id).length ?? 0,
          ...(line.role !== undefined ? { saysRole: line.role } : {}),
          ...(own?.role !== undefined ? { departsFrom: own.role } : {}),
        })
      }
    })
  }
  return found
}

export function exceptionsOf(types: readonly UnitType[], roles: readonly Role[], facts: OrganisationFacts | undefined): OutsideTheModel[] {
  const order = new Map(roles.map((role, at) => [role.id, at]))
  return [...slotExceptions(types, roles, facts), ...(facts?.saidBelow ?? [])]
    .sort((a, b) => (order.get(a.roleId) ?? 0) - (order.get(b.roleId) ?? 0))
}

export type ManySay = { readonly roleId: RoleId; readonly kind: LineKind; readonly saysRole: RoleId; readonly types: number; readonly units: number; readonly line: ReportsTo }

/** Where two or more unit types say the same line for a role: said as what the role could say instead. */
export function manySayTheSame(exceptions: readonly OutsideTheModel[]): ManySay[] {
  const groups = new Map<string, OutsideTheModel[]>()
  for (const one of exceptions) {
    if (one.on !== 'type' || one.saysRole === undefined) continue
    const key = `${one.roleId}/${one.kind}/${one.saysRole}`
    groups.set(key, [...groups.get(key) ?? [], one])
  }
  return [...groups.values()].filter((group) => group.length > 1).map((group) => ({
    roleId: group[0].roleId, kind: group[0].kind, saysRole: group[0].saysRole as RoleId, types: group.length,
    units: group.reduce((sum, one) => sum + one.units, 0),
    line: { kind: group[0].kind, role: group[0].saysRole as RoleId },
  }))
}
