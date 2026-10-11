// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a person holds across the tree, as the People page shows it (ADR-0036
 * §4): every assignment the index lists under one of their ids, with the role
 * and the unit by the names the organisation gives them and the scope that
 * keeps it. Read off the index the shell already holds; nothing loads for it.
 */
import type { PersonId } from '../../model/person'
import { personOf } from '../../model/units'
import type { HeldAssignment } from '../../people/hold'
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
