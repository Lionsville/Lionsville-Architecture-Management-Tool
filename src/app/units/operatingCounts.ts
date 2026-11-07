// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the operating model's page is told about the organisation it shapes
 * (ADR-0036, amended 11 October 2026), since the page knows the model and
 * nothing about units: how many units of each type there are today, for the
 * type's card, and who holds a role, before the role is removed. Both read
 * the tree with the open scope's session laid over it (`organisationHere`),
 * so a unit made a second ago is counted at once.
 */
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import type { RoleId, UnitTypeId } from '../../model/operatingModel'
import { pickedPerson } from '../../model/person'
import { holdingFrom, personOf, unitCountsOn } from '../../model/units'
import { organisationFacts } from '../../operating/organisationFacts'
import type { OrganisationFacts, OutsideTheModel } from '../../operating/organisationFacts'
import type { RoleHolders } from '../../operating/ui/RemoveConfirm'
import type { Person } from '../../people/person'
import { personText, registerOf } from '../../people/shown'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import type { Translate } from '../../i18n'
import { organisationHere } from './organisationHere'

/** How many units of each type there are on `day`. */
export function unitCountsHere(index: ScopeIndex, scope: ScopePath, model: HostModel, day: string): Map<UnitTypeId, number> {
  return unitCountsOn(organisationHere(index, scope, model).organisation, day)
}

/** Who holds a role on `day` or after: how many people, and the units they hold it in, by name, the first held first. */
export function roleHoldersHere(index: ScopeIndex, scope: ScopePath, model: HostModel, roleId: RoleId, day: string): RoleHolders {
  const at = organisationHere(index, scope, model).organisation
  const held = holdingFrom(at, roleId, day)
  const units = [...new Set(held.map((one) => one.unitId))]
  return {
    people: new Set(held.map(personOf)).size,
    units: units.map((id) => at.units.find((unit) => unit.id === id)?.name ?? id),
  }
}

/** The organisation as the page reads it today: its units, who holds what, and what says otherwise. */
export function operatingFactsHere(index: ScopeIndex, scope: ScopePath, model: HostModel, day: string, people: readonly Person[], s: Translate): OrganisationFacts {
  const at = organisationHere(index, scope, model)
  const register = registerOf([...people])
  return organisationFacts({
    organisation: at.organisation, day,
    personName: (assignment) => personText(pickedPerson(personOf(assignment)), register, s),
    scopeOfUnit: (id) => at.unitAt(id)?.scope,
    scopeOfAssignment: at.assignmentAt,
  })
}

/** The step that takes a unit's own line or a holder's own away, in the scope that keeps it. */
export function backToTheModel(one: OutsideTheModel): Command | undefined {
  if (one.on === 'unit' && one.unitId && one.own) return { type: 'element.update', id: one.unitId, patch: { reportingLines: one.own.length ? [...one.own] : undefined } } as Command
  if (one.on === 'holder' && one.assignmentId) return { type: 'assignment.update', id: one.assignmentId, patch: { reportsTo: one.ownHolder?.length ? [...one.ownHolder] : undefined } } as Command
  return undefined
}
