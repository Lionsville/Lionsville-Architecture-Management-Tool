// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a person holds across the tree, as the People page shows it (ADR-0036
 * §4): every assignment the index lists under one of their ids, with the role
 * and the unit by the names the organisation gives them and the scope that
 * keeps it. Read off the index the shell already holds; nothing loads for it.
 */
import type { PersonId } from '../../model/person'
import { isBlankRef } from '../../model/person'
import { unitsByRule } from '../../model/owners'
import { scopesServed } from '../../model/serving'
import { personOf } from '../../model/units'
import type { HeldAssignment, OwnedByRule } from '../../people/hold'
import type { Person } from '../../people/person'
import type { ScopeIndex } from '../../projects/scopeIndex'

/** Every id that is one person's: the entry, and the ones a merge folded into it. */
export function idsOfPerson(id: PersonId, people: readonly Person[]): Set<PersonId> {
  return new Set([id, ...people.filter((one) => one.mergedInto === id).map((one) => one.id)])
}

/** The assignments of these ids across the tree, in the index's order. */
export function heldAssignments(index: ScopeIndex, ids: ReadonlySet<PersonId>): HeldAssignment[] {
  const roles = new Map(index.operatingModel().roles.map((role) => [role.id, role.name]))
  return index.assignments()
    .filter(({ assignment }) => ids.has(personOf(assignment)))
    .map(({ scope, assignment }) => ({
      id: assignment.id,
      scope,
      unit: index.lookup(assignment.unitId)?.name ?? assignment.unitId,
      role: roles.get(assignment.roleId) ?? assignment.roleId,
      ...(assignment.share !== undefined ? { share: assignment.share } : {}),
      ...(assignment.from !== undefined ? { from: assignment.from } : {}),
      ...(assignment.until !== undefined ? { until: assignment.until } : {}),
      ...(assignment.acting ? { acting: true as const } : {}),
    }))
}

/**
 * What the operating model's rules make these ids own on `day` (ADR-0036 §2):
 * every application nobody wrote an owner on whose unit (`partyId`) they hold
 * the `applicationOwner` role in, and every domain a unit they hold the
 * `domainOwner` role in serves — its `scopes`, or the scope it is filed in
 * where that is a domain (`model/serving.scopesServed`): never the organisation.
 * Off the index; worked out, never stored.
 */
export function ownedByRule(index: ScopeIndex, ids: ReadonlySet<PersonId>, day: string, scopeName: (path: string) => string): OwnedByRule[] {
  const organisation = index.organisation()
  const rules = index.operatingModel().operatingRules
  const mine = (kind: 'applicationOwner' | 'domainOwner') => new Set(
    [...ids].flatMap((id) => unitsByRule(organisation, rules, kind, id, day)),
  )
  const owning = mine('applicationOwner')
  const applications: OwnedByRule[] = owning.size === 0 ? [] : index.register()
    .filter((entry) => entry.partyId !== undefined && owning.has(entry.partyId) && isBlankRef(entry.owner))
    .map((entry) => ({ kind: 'application', scope: entry.master ?? '', id: entry.id, name: entry.name, day }))
  const serving = mine('domainOwner')
  const filedIn = new Map(index.units().map(({ scope, unit }) => [unit.id, scope]))
  const domains = [...new Set(organisation.units
    .filter((unit) => serving.has(unit.id))
    .flatMap((unit) => scopesServed(unit, (id) => filedIn.get(id))))]
    .map((path): OwnedByRule => ({ kind: 'domain', scope: path, id: path, name: scopeName(path), day }))
  return [...applications, ...domains]
}
