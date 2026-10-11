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
import type { HostModel } from '../../model/hostModel'
import type { RoleId, UnitTypeId } from '../../model/operatingModel'
import { holdingFrom, personOf, unitCountsOn } from '../../model/units'
import type { RoleHolders } from '../../operating/ui/RemoveConfirm'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
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
