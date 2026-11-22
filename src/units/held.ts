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
import { holdersAt, isExceptionPlacement, linesOfHolder, managersOfHolder, personOf, runsOn } from '../../model/units'
import type { Assignment, Organisation } from '../../model/units'
import type { HeldAssignment, OwnedByRule, Reporting, ReportingPerson } from '../../people/hold'
import type { Person } from '../../people/person'
import type { ScopeIndex } from '../../projects/scopeIndex'

/** Every id that is one person's: the entry, and the ones a merge folded into it. */
export function idsOfPerson(id: PersonId, people: readonly Person[]): Set<PersonId> {
  return new Set([id, ...people.filter((one) => one.mergedInto === id).map((one) => one.id)])
}

/** The assignments of these ids across the tree, in the index's order. */
export function heldAssignments(index: ScopeIndex, ids: ReadonlySet<PersonId>, day?: string): HeldAssignment[] {
  const roles = new Map(index.operatingModel().roles.map((role) => [role.id, role.name]))
  const name = (id: string) => index.lookup(id)?.name ?? id
  // Where each holder reports on the day (ADR-0039, amended): the lines that hold for them and land, their own first, as roles in units.
  const organisation = index.organisation()
  return index.assignments()
    .filter(({ assignment }) => ids.has(personOf(assignment)))
    .map(({ scope, assignment }) => {
      const reportsTo = (day === undefined ? [] : linesOfHolder(organisation, assignment, day))
        .filter((line) => line.state === 'lands' && line.to)
        .map((line) => ({
          kind: line.kind, role: roles.get(line.to!.roleId) ?? line.to!.roleId, unit: name(line.to!.unitId),
          ...(line.to!.person !== undefined ? { person: line.to!.person } : {}), ...(line.override ? { override: true as const } : {}),
        }))
      return {
        id: assignment.id,
        scope,
        unit: name(assignment.unitId),
        unitId: assignment.unitId,
        role: roles.get(assignment.roleId) ?? assignment.roleId,
        ...(assignment.share !== undefined ? { share: assignment.share } : {}),
        ...(assignment.from !== undefined ? { from: assignment.from } : {}),
        ...(assignment.until !== undefined ? { until: assignment.until } : {}),
        ...(assignment.acting ? { acting: true as const } : {}),
        ...(reportsTo.length ? { reportsTo } : {}),
        ...(isExceptionPlacement(organisation, assignment) ? { exception: true as const } : {}),
      }
    })
}

/** Each person once per role in a unit, in the order first met: the nearest first. */
function once(lines: readonly ReportingPerson[]): ReportingPerson[] {
  const seen = new Set<string>()
  return lines.filter((line) => {
    const key = JSON.stringify([line.person, line.role, line.unit, line.functional ?? false])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Who a person reports to and who reports to them on `day`, by the same reads
 * as a holder's inspector (`managersOfHolder`), so nesting is said as a line
 * is. Manages is who has this person among their nearest managers, and whoever
 * has a functional line to them: the rest of the chain below is on the chart.
 */
export function reportingOf(index: ScopeIndex, ids: ReadonlySet<PersonId>, day: string): Reporting {
  const organisation: Organisation = index.organisation()
  const roles = new Map(index.operatingModel().roles.map((role) => [role.id, role.name]))
  const scopes = new Map(index.units().map(({ scope, unit }) => [unit.id, scope]))
  const said = (assignment: Pick<Assignment, 'person' | 'unitId' | 'roleId'>, via: ReportingPerson['via'], functional: boolean): ReportingPerson => {
    const scope = scopes.get(assignment.unitId)
    return {
      person: personOf(assignment), role: roles.get(assignment.roleId) ?? assignment.roleId, unit: index.lookup(assignment.unitId)?.name ?? assignment.unitId,
      via, unitId: assignment.unitId, ...(scope !== undefined ? { scope } : {}), ...(functional ? { functional: true as const } : {}),
    }
  }
  const running = organisation.assignments.filter((one) => runsOn(one, day))
  const mine = running.filter((one) => ids.has(personOf(one)))
  const others = running.filter((one) => !ids.has(personOf(one)) && !isBlankRef(personOf(one)))
  const functionalTo = (one: Assignment) => linesOfHolder(organisation, one, day)
    .filter((line) => line.kind === 'dotted' && line.state === 'lands' && line.to)
    .flatMap((line) => holdersAt(organisation.assignments, line.to!, day).map((to) => ({ to, via: line.override ? 'override' as const : 'line' as const })))
  const reportsTo = mine.flatMap((one) => [
    ...managersOfHolder(organisation, one, day).filter((up) => !ids.has(up.person)).map((up) => said(up.assignment, up.via, false)),
    ...functionalTo(one).filter(({ to }) => !ids.has(personOf(to))).map(({ to, via }) => said(to, via, true)),
  ])
  const manages = others.flatMap((one) => {
    // A holder of a managing role is among their own unit's managers: the nearest is the first who is somebody else.
    const nearest = managersOfHolder(organisation, one, day).find((up) => up.person !== personOf(one))
    const under = nearest && mine.some((held) => held.unitId === nearest.unitId && held.roleId === nearest.roleId) ? [said(one, nearest.via, false)] : []
    return [...under, ...functionalTo(one).filter(({ to }) => ids.has(personOf(to))).map(({ via }) => said(one, via, true))]
  })
  return { reportsTo: once(reportsTo), manages: once(manages) }
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
