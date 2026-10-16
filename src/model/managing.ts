// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a right from a managing role reaches (ADR-0036 §12, ADR-0039 §4, §9),
 * worked out here and granted nowhere in core: core has no accounts. A build
 * that knows who people are grants the right on its own doors and says so to
 * the app (`SourcePeople.managingRight`), and the screens then offer exactly
 * what those doors will take — both asking this.
 *
 * - **Whose people**: the units a person holds a managing role in on the day,
 *   and every unit below each, under the parents the plans' moves give them
 *   that day — less the roles there whose holders report elsewhere by a solid
 *   line; and the roles whose solid line lands on a role they hold, with
 *   everything those holders manage in turn (`managedBy`). A dotted line
 *   reaches nothing.
 * - **What**: an assignment there added, corrected, ended or taken away, in
 *   the scope that keeps its unit — and nothing else in that scope: not the
 *   unit's name, its place in the tree or the operating model.
 * - **No self-escalation**: an assignment to a role that manages, whichever
 *   way it changes, only strictly below a unit the person holds one in. In
 *   their own unit a manager above, or scope rights, decide it — their own
 *   assignment included. A role reached by a line is never the person's own,
 *   so an assignment to it is theirs to change even where that role manages;
 *   one they hold themselves never is.
 * - **The day it is asked**: from the first day of the assignment to its
 *   last, never on a planned date.
 *
 * **What a host asks** (hosted's managing right): {@link managedReach} for a
 * person on the day, then {@link reachesAssignment} of each assignment as it
 * was and as it is after — or {@link onlyPeopleIn} of a whole step — with
 * {@link managingRoleIds}; {@link reachesPosition} where the managing rule is
 * not asked (whose people they are), and {@link holdsAllIn} for an answer
 * about two entries of the register. `units` alone is the nesting half: a
 * door that asks whose people a person manages asks {@link reachesPosition}
 * of the unit *and* the role.
 *
 * Pure, with no words and no paths, so a server imports it by its path.
 */
import type { Command } from './commands'
import { assignmentsOf } from './normalised'
import type { Model } from './normalised'
import type { RoleId } from './operatingModel'
import type { PersonId } from './person'
import { apply } from './reducer'
import type { ElementId } from './types'
import { isUnit, managedBy, personOf, positionKey, runsOn } from './units'
import type { Assignment, ManagedVia, Organisation } from './units'

/** What one person reaches by a managing role, or by the solid lines that land on their roles, on a day. */
export type ManagedReach = {
  /** The units they hold a running managing role in that day. */
  readonly held: readonly ElementId[]
  /** The units they manage the people of by nesting: those, and every unit below each (ADR-0039 §4 adds the units a line brings in). */
  readonly units: ReadonlySet<ElementId>
  /** The units strictly below one they manage by nesting: where an assignment to a managing role is theirs too. */
  readonly below: ReadonlySet<ElementId>
  /**
   * The roles in those units, as {@link positionKey}s, whose holders report
   * elsewhere by a solid line: not reached by nesting. Absent is none, as for
   * a reach worked out before reporting lines.
   */
  readonly elsewhere?: ReadonlySet<string>
  /** The roles reached by a solid line, as {@link positionKey}s: never one the person holds. Absent is none. */
  readonly lines?: ReadonlySet<string>
}

/**
 * What a person reaches on `day`: nothing where they hold no running managing
 * role and no solid line lands on a role of theirs. `canonical` is the entry
 * a merge kept for an id, so an assignment under an id merged into theirs
 * counts as theirs (ADR-0036 §9).
 */
export function managedReach(
  organisation: Organisation, person: PersonId, day: string, canonical?: (id: PersonId) => PersonId,
): ManagedReach | undefined {
  const reached = managedBy(organisation, person, day, canonical)
  if (reached.held.length === 0 && reached.lines.length === 0) return undefined
  return {
    held: reached.held,
    units: new Set(reached.units),
    below: new Set(reached.below),
    elsewhere: new Set(reached.elsewhere.map((at) => positionKey(at.unitId, at.roleId))),
    lines: new Set(reached.lines.map((at) => positionKey(at.unitId, at.roleId))),
  }
}

/** How a role in a unit is reached: by a line, by nesting, or not at all. */
export function reachVia(reach: ManagedReach | undefined, unitId: ElementId, roleId: RoleId): ManagedVia | undefined {
  if (!reach) return undefined
  const key = positionKey(unitId, roleId)
  if (reach.lines?.has(key)) return 'line'
  return reach.units.has(unitId) && !reach.elsewhere?.has(key) ? 'nesting' : undefined
}

/** Whether the holders of a role in a unit are among the people a person manages, the managing rule not asked. */
export function reachesPosition(reach: ManagedReach, unitId: ElementId, roleId: RoleId): boolean {
  return reachVia(reach, unitId, roleId) !== undefined
}

/** What a person reaches, with the roles that manage: what a screen asks of each unit and role it offers a change of. */
export type ManagesPeople = ManagedReach & {
  /** The roles marked as managing their unit: assigned only strictly below a unit held. */
  readonly managing: ReadonlySet<RoleId>
}

/** {@link managedReach} with the organisation's managing roles beside it, or nothing where the person manages nothing that day. */
export function managesPeople(
  organisation: Organisation, person: PersonId, day: string, canonical?: (id: PersonId) => PersonId,
): ManagesPeople | undefined {
  const reach = managedReach(organisation, person, day, canonical)
  return reach && { ...reach, managing: managingRoleIds(organisation) }
}

/** Whether a person who manages may change an assignment in this unit and role (a screen's question, before it offers one). */
export function mayChangeIn(manages: ManagesPeople | undefined, unitId: ElementId, roleId: RoleId): boolean {
  return manages !== undefined && reachesAssignment(manages, { unitId, roleId }, manages.managing)
}

/** The roles marked as managing their unit, whatever their days: a role that manages is one to hand out with care on any day. */
export function managingRoleIds(organisation: Pick<Organisation, 'roles'>): ReadonlySet<RoleId> {
  return new Set(organisation.roles.filter((role) => role.manages === true).map((role) => role.id))
}

/**
 * Whether an assignment in this unit and role is in reach: a role reached by
 * a line, whatever it is; else a unit reached by nesting where the role does
 * not report elsewhere, and a managing role's only strictly below one held.
 */
export function reachesAssignment(
  reach: ManagedReach, assignment: Pick<Assignment, 'unitId' | 'roleId'>, managing: ReadonlySet<RoleId>,
): boolean {
  const via = reachVia(reach, assignment.unitId, assignment.roleId)
  if (via === 'line') return true
  return via === 'nesting' && (!managing.has(assignment.roleId) || reach.below.has(assignment.unitId))
}

/**
 * Whether every one of these people holds an assignment running on `day`, in
 * any role, in a unit the reach covers: a manager whose units hold both of
 * two entries may answer that they are not the same person, or take that
 * back (ADR-0036 §12, as built in 3.6.1) — an answer merges and removes
 * nothing, and a manager knows their own people. `canonical` as for
 * {@link managedReach}, so a role held under a merged id counts.
 */
export function holdsAllIn(
  organisation: Pick<Organisation, 'assignments'>, reach: ManagedReach, people: readonly PersonId[], day: string,
  canonical: (id: PersonId) => PersonId = (id) => id,
): boolean {
  const wanted = new Set(people.map(canonical))
  const found = new Set<PersonId>()
  for (const assignment of organisation.assignments) {
    const who = canonical(personOf(assignment))
    if (wanted.has(who) && runsOn(assignment, day) && reachesPosition(reach, assignment.unitId, assignment.roleId)) found.add(who)
  }
  return wanted.size > 0 && found.size === wanted.size
}

const ASSIGNMENT_COMMANDS: ReadonlySet<string> = new Set(['assignment.add', 'assignment.update', 'assignment.remove'])

/** Whether a command changes nothing but assignments: one of the three, or a transaction of nothing else. */
export function onlyAssignments(command: { type: string; commands?: readonly { type: string }[] }): boolean {
  if (command.type === 'transaction') {
    const inner = command.commands ?? []
    return inner.length > 0 && inner.every((one) => onlyAssignments(one as typeof command))
  }
  return ASSIGNMENT_COMMANDS.has(command.type)
}

/** A transaction's commands in the order the reducer applies them, nested ones opened. */
function flat(commands: readonly Command[]): Command[] {
  return commands.flatMap((command) => (command.type === 'transaction' ? flat(command.commands) : [command]))
}

/** Whether the scope keeps this unit itself: an actor with a type that is not a stand-in. */
function keptHere(model: Model, unitId: ElementId): boolean {
  const element = model.elements[unitId]
  return element !== undefined && element.ref === undefined && isUnit(element)
}

/**
 * Whether every command changes only the people of units in reach, in the
 * scope whose model before them is `model`: each assignment as it was and as
 * it is after in reach (a managing role's only strictly below), the one after
 * in a unit this scope keeps. Applied in order with the reducer, so a
 * transaction's later commands are asked of what the earlier ones made; a
 * command the reducer refuses is not this right's to allow.
 */
export function onlyPeopleIn(
  model: Model, commands: readonly Command[], reach: ManagedReach, managing: ReadonlySet<RoleId>,
): boolean {
  const all = flat(commands)
  if (all.length === 0) return false
  let at = model
  for (const command of all) {
    if (!ASSIGNMENT_COMMANDS.has(command.type)) return false
    const result = apply(at, command)
    if (!result.ok) return false
    const id = command.type === 'assignment.add' ? command.assignment.id : (command as { id: string }).id
    const before = assignmentsOf(at)[id] as Assignment | undefined
    const after = assignmentsOf(result.model)[id] as Assignment | undefined
    if (before && !reachesAssignment(reach, before, managing)) return false
    if (after && (!reachesAssignment(reach, after, managing) || !keptHere(result.model, after.unitId))) return false
    at = result.model
  }
  return true
}
