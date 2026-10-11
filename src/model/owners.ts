// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Owners worked out on the day from the operating model's rules (ADR-0036
 * §2): never stored, so the owner follows whoever holds the role, and a
 * person who leaves the role stops being the owner the day they leave it.
 *
 * - **An application's owner** (`applicationOwner`) is whoever holds the
 *   rule's role in the unit the application belongs to (`partyId`). Only
 *   where nobody wrote an owner on the application: a name written there is
 *   the answer, and wins.
 * - **A domain's owner** (`domainOwner`) is whoever holds the rule's role in
 *   a unit that serves the domain — the scopes in its `scopes`, or the scope
 *   it is filed in.
 *
 * Each holder of the role on the day is an owner: a role shared between two
 * people gives two, and a vacancy gives none. The unit must be there on the
 * day and the role running, as for every question asked of units.
 *
 * Pure, with no words and no paths beyond the scope a caller names.
 */
import type { OperatingRule, OperatingRuleKind, RoleId } from './operatingModel'
import type { PersonId } from './person'
import { isBlankRef } from './person'
import type { DesignElement, ElementId } from './types'
import { servingUnitFiledHighest } from './serving'
import type { FiledIn } from './serving'
import { organisationOn, personOf, roleOn, runsOn, unitOn } from './units'
import type { Assignment, Organisation } from './units'

/** An owner worked out from a rule: the person, and the role and unit that make them it. */
export type WorkedOutOwner = {
  person: PersonId
  roleId: RoleId
  unitId: ElementId
  assignment: Assignment
}

/** The role a rule of the organisation names, where it has that rule. */
export function ruleRole(rules: readonly OperatingRule[] | undefined, kind: OperatingRuleKind): RoleId | undefined {
  const role = rules?.find((rule) => rule.id === kind)?.role
  return role ? role : undefined
}

/** Who holds `roleId` in `unitId` on `day`, the unit there and the role running. */
function holdersIn(organisation: Organisation, roleId: RoleId, unitId: ElementId, day: string): WorkedOutOwner[] {
  const unit = organisation.units.find((one) => one.id === unitId)
  const role = organisation.roles.find((one) => one.id === roleId)
  if (!unit || !unitOn(unit, day) || !role || !roleOn(role, day)) return []
  return organisation.assignments
    .filter((one) => one.unitId === unitId && one.roleId === roleId && runsOn(one, day))
    .map((assignment) => ({ person: personOf(assignment), roleId, unitId, assignment }))
}

/**
 * An application's owners on `day`, as the rule works them out: nothing where
 * it has an owner written on it, belongs to no unit, or the organisation has
 * no rule — and nothing where nobody holds the role that day.
 */
export function applicationOwnersOn(
  organisation: Organisation,
  rules: readonly OperatingRule[] | undefined,
  application: Pick<DesignElement, 'owner' | 'partyId'>,
  day: string,
): WorkedOutOwner[] {
  if (!isBlankRef(application.owner) || application.partyId === undefined) return []
  const roleId = ruleRole(rules, 'applicationOwner')
  return roleId ? holdersIn(organisation, roleId, application.partyId, day) : []
}

/**
 * A domain's owners on `day`: whoever holds the rule's role in a unit that
 * serves the scope. `filedIn` says where a unit is kept, which is the scope it
 * serves when its `scopes` says nothing.
 */
export function domainOwnersOn(
  organisation: Organisation,
  rules: readonly OperatingRule[] | undefined,
  scope: string,
  day: string,
  filedIn: (unitId: ElementId) => string | undefined,
): WorkedOutOwner[] {
  const roleId = ruleRole(rules, 'domainOwner')
  if (!roleId) return []
  return organisation.units
    .filter((unit) => (unit.scopes ?? [filedIn(unit.id)]).includes(scope))
    .flatMap((unit) => holdersIn(organisation, roleId, unit.id, day))
}

/**
 * A domain's owner as its home says it (ADR-0036, amended 11 October 2026):
 * the rule applied to one unit, the serving unit filed highest in the scope
 * (`serving.servingUnitFiledHighest`) — so the owner of a domain is whoever
 * holds the role in the unit that answers for it, not in every unit that
 * also serves it. The unit, where one serves the scope, and its holders that
 * day: none where the organisation has no rule or the role is vacant.
 */
export function domainOwnerOn(
  organisation: Organisation,
  rules: readonly OperatingRule[] | undefined,
  scope: string,
  day: string,
  filedIn: FiledIn,
): { unitId?: ElementId; owners: WorkedOutOwner[] } {
  const unit = servingUnitFiledHighest(organisation, scope, day, filedIn)
  if (!unit) return { owners: [] }
  const on = organisationOn(organisation, day)
  return { unitId: unit.id, owners: domainOwnersOn({ ...on, units: on.units.filter((one) => one.id === unit.id) }, rules, scope, day, filedIn) }
}

/**
 * What a rule makes one person on `day`: the units in which they hold the
 * rule's role — under their id, or one `canonical` maps to it. A caller with
 * the applications and the scopes reads off them what each unit owns.
 */
export function unitsByRule(
  organisation: Organisation,
  rules: readonly OperatingRule[] | undefined,
  kind: OperatingRuleKind,
  person: PersonId,
  day: string,
  canonical: (id: PersonId) => PersonId = (id) => id,
): ElementId[] {
  const roleId = ruleRole(rules, kind)
  if (!roleId) return []
  const who = canonical(person)
  const units: ElementId[] = []
  for (const assignment of organisation.assignments) {
    if (assignment.roleId !== roleId || canonical(personOf(assignment)) !== who || units.includes(assignment.unitId)) continue
    if (holdersIn(organisation, roleId, assignment.unitId, day).some((one) => one.assignment === assignment)) units.push(assignment.unitId)
  }
  return units
}
