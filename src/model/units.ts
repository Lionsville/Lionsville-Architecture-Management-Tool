// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation as it is (ADR-0036 §3, §4, §12): units, which are actors
 * with a type, the people assigned to roles in them, and the arithmetic over
 * the two on a day.
 *
 * **A unit is an actor with a type.** Nothing else marks one: its tree is the
 * actor's `parentId`, its dates are the actor's lifecycle dates, what it owns
 * is every application whose `partyId` names it. So a unit is any element
 * this file is handed with `kind: 'actor'` and a `unitTypeId`, wherever in the
 * tree it is kept — ids are unique across the organisation, so a parent kept
 * in another scope is found by its id like any other.
 *
 * **An assignment** is a record in the unit's scope: the unit, the role, the
 * person — an id in the register, never a name — a share of their time, the
 * days it runs and whether they are acting in the role.
 *
 * **Everything here is on a day.** A vacancy is not a record: it is a slot's
 * minimum less the people who hold the role on that day. Who manages a unit
 * is whoever holds a managing role in it, or in a unit above it, on that day.
 * Nothing here reads the clock; the caller says which day, and *today* is the
 * caller's (`lifecycle.today`).
 *
 * Pure, with no words and no paths: a server that grants a right from a
 * managing role (ADR-0036 §12) imports this file by its path and asks
 * {@link managersOf} and {@link managedBy} the same questions the screens do.
 */
import { isDay, phaseAt } from './lifecycle'
import type { PersonId, PickedPerson } from './person'
import type { Role, RoleId, RoleSlot, UnitType, UnitTypeId } from './operatingModel'
import type { DesignElement, ElementId } from './types'
import type { Command, CommandMeta } from './commands'

export type AssignmentId = string

/**
 * One person in one role in one unit, for a stretch of days.
 *
 * `person` is a reference into the register (`{ person: id }`), so the name
 * is asked for when it is drawn and a forgotten person reads as their
 * pseudonym everywhere at once. `share` is the part of the person's time, a
 * fraction above 0 and at most 1; absent is all of it. `from` and `until` are
 * the first and the last day, inclusive; absent is open-ended.
 */
export type Assignment = {
  id: AssignmentId
  /** The unit: an actor with a type, kept in the scope this record is kept in. */
  unitId: ElementId
  /** A role of the operating model, kept at the organisation. */
  roleId: RoleId
  person: PickedPerson
  share?: number
  /** `yyyy-mm-dd`, the first day. */
  from?: string
  /** `yyyy-mm-dd`, the last day. */
  until?: string
  /** Holding the role until somebody is appointed to it. */
  acting?: true
}

/** As much of an element as the arithmetic over units reads. */
export type UnitLike = Pick<DesignElement, 'id' | 'name' | 'kind' | 'parentId' | 'unitTypeId' | 'extraSlots' | 'lifecycle' | 'lifecycleDates' | 'scopes'>

/** As much of the organisation as a question about it needs: its units, its assignments, and its operating model. */
export type Organisation = {
  readonly units: readonly UnitLike[]
  readonly assignments: readonly Assignment[]
  readonly roles: readonly Role[]
  readonly unitTypes: readonly UnitType[]
}

/** Whether an element is a unit: an actor with a type. */
export function isUnit(element: Pick<DesignElement, 'kind' | 'unitTypeId'>): boolean {
  return element.kind === 'actor' && typeof element.unitTypeId === 'string' && element.unitTypeId !== ''
}

// --- days ------------------------------------------------------------------------

/** Whether a record dated by `from` and `until`, both inclusive, runs on `day`. A date that is not a day says nothing. */
export function runsOn(dated: { from?: string; until?: string }, day: string): boolean {
  if (isDay(dated.from) && day < dated.from) return false
  if (isDay(dated.until) && day > dated.until) return false
  return true
}

/**
 * Whether a unit is there on `day`: live or retiring by its lifecycle on that
 * day. Planned is not yet, and retired is gone.
 */
export function unitOn(unit: Pick<DesignElement, 'lifecycle' | 'lifecycleDates'>, day: string): boolean {
  const phase = phaseAt(unit, day)
  return phase === 'live' || phase === 'retiring'
}

/** Whether a unit has ended by `day`: retired by its lifecycle on that day. */
export function unitEnded(unit: Pick<DesignElement, 'lifecycle' | 'lifecycleDates'>, day: string): boolean {
  return phaseAt(unit, day) === 'retired'
}

/** The last day a unit is there, where its dates say: the day before it retires. */
export function unitLastDay(unit: Pick<DesignElement, 'lifecycleDates'>): string | undefined {
  const retired = unit.lifecycleDates?.retired
  return isDay(retired) ? dayBefore(retired) : undefined
}

/** The day before a day, `yyyy-mm-dd`, in UTC so no clock change moves it. */
export function dayBefore(day: string): string {
  const at = new Date(`${day}T00:00:00Z`)
  at.setUTCDate(at.getUTCDate() - 1)
  return at.toISOString().slice(0, 10)
}

/** The part of a person's time an assignment takes: its share, or all of it. */
export function shareOf(assignment: Pick<Assignment, 'share'>): number {
  const share = assignment.share
  return typeof share === 'number' && Number.isFinite(share) && share > 0 ? share : 1
}

/** The person an assignment names, by id. */
export function personOf(assignment: Pick<Assignment, 'person'>): PersonId {
  return assignment.person.person
}

// --- slots and holders -------------------------------------------------------------

/**
 * The role slots a unit holds: its type's, then its own extra ones for roles
 * the type does not hold. An extra slot for a role the type already holds is
 * passed over: the type's numbers are the organisation's.
 */
export function slotsOf(unit: Pick<UnitLike, 'extraSlots'>, type: Pick<UnitType, 'slots'> | undefined): RoleSlot[] {
  const slots = [...(type?.slots ?? [])]
  for (const extra of unit.extraSlots ?? []) {
    if (!slots.some((slot) => slot.role === extra.role)) slots.push(extra)
  }
  return slots
}

/** The assignments of one role in one unit that run on `day`. */
export function holdersOn(
  assignments: readonly Assignment[], unitId: ElementId, roleId: RoleId, day: string,
): Assignment[] {
  return assignments.filter((one) => one.unitId === unitId && one.roleId === roleId && runsOn(one, day))
}

/**
 * How much of a person's time their assignments take on `day`, across every
 * assignment handed in: 1 is all of it. `canonical` maps an id to the entry
 * that answers for it — a merged id to the one it was merged into — so two
 * ids of one person are counted as one.
 */
export function loadOn(
  assignments: readonly Assignment[], person: PersonId, day: string, canonical: (id: PersonId) => PersonId = same,
): number {
  const who = canonical(person)
  return assignments
    .filter((one) => canonical(personOf(one)) === who && runsOn(one, day))
    .reduce((sum, one) => sum + shareOf(one), 0)
}

function same(id: PersonId): PersonId {
  return id
}

/** A role's own dates: whether it runs on `day`. */
export function roleOn(role: Pick<Role, 'from' | 'until'>, day: string): boolean {
  return runsOn(role, day)
}

// --- the tree of units ----------------------------------------------------------------

/** The units by id. */
function byId(units: readonly UnitLike[]): Map<ElementId, UnitLike> {
  return new Map(units.filter(isUnit).map((unit) => [unit.id, unit]))
}

/**
 * The units above a unit, nearest first, following `parentId` through units
 * only: an actor that is not a unit ends the walk. A loop ends it too.
 */
export function unitsAbove(units: readonly UnitLike[], unitId: ElementId): ElementId[] {
  const held = byId(units)
  const above: ElementId[] = []
  const seen = new Set([unitId])
  let at = held.get(unitId)?.parentId
  while (at !== undefined && held.has(at) && !seen.has(at)) {
    above.push(at)
    seen.add(at)
    at = held.get(at)?.parentId
  }
  return above
}

/** Every unit below a unit, in the tree's order — its children, theirs, and so on. A loop is walked once. */
export function unitsBelow(units: readonly UnitLike[], unitId: ElementId): ElementId[] {
  const children = new Map<ElementId, ElementId[]>()
  for (const unit of units) {
    if (!isUnit(unit) || unit.parentId === undefined) continue
    children.set(unit.parentId, [...children.get(unit.parentId) ?? [], unit.id])
  }
  const below: ElementId[] = []
  const seen = new Set([unitId])
  const walk = (id: ElementId) => {
    for (const child of children.get(id) ?? []) {
      if (seen.has(child)) continue
      seen.add(child)
      below.push(child)
      walk(child)
    }
  }
  walk(unitId)
  return below
}

/**
 * Where a unit sits, as its type is asked: under the unit type of its parent,
 * or at the top where its parent is not a unit — the organisation itself, or
 * an actor that is only a group.
 */
export function parentTypeOf(units: readonly UnitLike[], unit: UnitLike): UnitTypeId | undefined {
  if (unit.parentId === undefined) return undefined
  const parent = byId(units).get(unit.parentId)
  return parent?.unitTypeId
}

/** Whether a unit may sit where it does, by its type's `top` and `within`. A type the model does not hold is not asked. */
export function mayHaveParent(type: Pick<UnitType, 'top' | 'within'>, parentType: UnitTypeId | undefined): boolean {
  return parentType === undefined ? type.top === true : type.within.includes(parentType)
}

// --- who manages ------------------------------------------------------------------------

/** One person who manages a unit on a day, and from where: the unit whose managing role they hold, and the role. */
export type Manager = {
  person: PersonId
  /** The unit the managing role is held in: the unit asked about, or one above it. */
  unitId: ElementId
  roleId: RoleId
  assignment: Assignment
}

/**
 * Who manages a unit on `day` (ADR-0036 §12): whoever holds a role marked
 * `manages` in it, or in a unit above it, on that day — the unit there and
 * the role running too. Nearest unit first, and in the order the assignments
 * are listed within a unit.
 *
 * Core grants nothing from this; a build that knows who people are may.
 */
export function managersOf(organisation: Organisation, unitId: ElementId, day: string): Manager[] {
  const units = byId(organisation.units)
  const managing = managingRoles(organisation.roles, day)
  const found: Manager[] = []
  for (const id of [unitId, ...unitsAbove(organisation.units, unitId)]) {
    const unit = units.get(id)
    if (!unit || !unitOn(unit, day)) continue
    for (const assignment of organisation.assignments) {
      if (assignment.unitId !== id || !managing.has(assignment.roleId) || !runsOn(assignment, day)) continue
      found.push({ person: personOf(assignment), unitId: id, roleId: assignment.roleId, assignment })
    }
  }
  return found
}

/** The roles marked `manages` that run on `day`. */
function managingRoles(roles: readonly Role[], day: string): Set<RoleId> {
  return new Set(roles.filter((role) => role.manages === true && roleOn(role, day)).map((role) => role.id))
}

/**
 * What one person manages on `day` (ADR-0036 §12): each unit in which they
 * hold a managing role, and every unit below it — the units whose people a
 * build with accounts lets them change. Each unit once, a unit they hold the
 * role in first and the units below it after, in the order the assignments
 * are listed.
 *
 * `canonical` maps an id to the entry that answers for it, so an assignment
 * kept under an id merged into this person's still counts.
 */
export function managedBy(
  organisation: Organisation, person: PersonId, day: string, canonical: (id: PersonId) => PersonId = same,
): { held: ElementId[]; units: ElementId[] } {
  const units = byId(organisation.units)
  const managing = managingRoles(organisation.roles, day)
  const who = canonical(person)
  const held: ElementId[] = []
  for (const assignment of organisation.assignments) {
    if (canonical(personOf(assignment)) !== who || !managing.has(assignment.roleId) || !runsOn(assignment, day)) continue
    const unit = units.get(assignment.unitId)
    if (!unit || !unitOn(unit, day) || held.includes(unit.id)) continue
    held.push(unit.id)
  }
  const reached: ElementId[] = []
  for (const id of held) {
    for (const one of [id, ...unitsBelow(organisation.units, id)]) {
      if (!reached.includes(one) && units.has(one)) reached.push(one)
    }
  }
  return { held, units: reached }
}

// --- what the organisation contradicts about itself on a day ------------------------------

/**
 * One thing the units and the assignments contradict on a day (ADR-0036 §3):
 * a finding, never a refusal, because an organisation being reorganised
 * passes through every one of them.
 *
 * - `vacant`: fewer people hold a role in a unit than its slot's minimum;
 * - `overMax`: more than the slot's maximum;
 * - `misplaced`: a unit under a type it may not sit in (`top`, `within`);
 * - `spans`: a unit that serves several domains under a type that serves one;
 * - `overLimit`: a unit that owns more applications than its type's limit;
 * - `endedUnit`, `endedRole`: an assignment running in a unit or a role that
 *   has ended;
 * - `overloaded`: a person whose shares add up to more than all of their
 *   time, with the assignments that make it up.
 */
export type UnitFinding =
  | { kind: 'vacant'; unitId: ElementId; roleId: RoleId; held: number; min: number }
  | { kind: 'overMax'; unitId: ElementId; roleId: RoleId; held: number; max: number }
  | { kind: 'misplaced'; unitId: ElementId; parentType?: UnitTypeId }
  | { kind: 'spans'; unitId: ElementId; serves: number }
  | { kind: 'overLimit'; unitId: ElementId; owns: number; limit: number }
  | { kind: 'endedUnit'; unitId: ElementId; assignment: Assignment }
  | { kind: 'endedRole'; unitId: ElementId; roleId: RoleId; assignment: Assignment }
  | { kind: 'overloaded'; person: PersonId; load: number; assignments: Assignment[] }

/**
 * Every finding of the organisation on `day`, unit by unit and then person
 * by person. `owns` says how many applications name a unit as theirs
 * (`partyId`), which the caller counts over the tree; absent, no limit is
 * read. `canonical` is as {@link loadOn} takes it.
 */
export function unitFindings(
  organisation: Organisation, day: string,
  deps: { owns?: (unitId: ElementId) => number; canonical?: (id: PersonId) => PersonId } = {},
): UnitFinding[] {
  const types = new Map(organisation.unitTypes.map((type) => [type.id, type]))
  const roles = new Map(organisation.roles.map((role) => [role.id, role]))
  const units = byId(organisation.units)
  const found: UnitFinding[] = []
  for (const unit of units.values()) {
    const type = types.get(unit.unitTypeId ?? '')
    if (!type || !unitOn(unit, day)) continue
    found.push(...slotFindings(organisation, unit, type, roles, day))
    if (!mayHaveParent(type, parentTypeOf(organisation.units, unit))) {
      const parentType = parentTypeOf(organisation.units, unit)
      found.push({ kind: 'misplaced', unitId: unit.id, ...(parentType !== undefined ? { parentType } : {}) })
    }
    const serves = unit.scopes?.length ?? 0
    if (serves > 1 && type.spans !== true) found.push({ kind: 'spans', unitId: unit.id, serves })
    const owns = deps.owns?.(unit.id) ?? 0
    if (type.limit !== undefined && owns > type.limit) found.push({ kind: 'overLimit', unitId: unit.id, owns, limit: type.limit })
  }
  found.push(...endedFindings(organisation.assignments, units, roles, day))
  found.push(...overloads(organisation.assignments, day, deps.canonical ?? same))
  return found
}

/** A unit's slots against who holds each on the day: too few, too many. A role that has ended asks for nobody. */
function slotFindings(
  organisation: Organisation, unit: UnitLike, type: UnitType, roles: ReadonlyMap<RoleId, Role>, day: string,
): UnitFinding[] {
  const found: UnitFinding[] = []
  for (const slot of slotsOf(unit, type)) {
    const role = roles.get(slot.role)
    if (!role || !roleOn(role, day)) continue
    const held = holdersOn(organisation.assignments, unit.id, slot.role, day).length
    if (held < slot.min) found.push({ kind: 'vacant', unitId: unit.id, roleId: slot.role, held, min: slot.min })
    if (slot.max !== undefined && held > slot.max) found.push({ kind: 'overMax', unitId: unit.id, roleId: slot.role, held, max: slot.max })
  }
  return found
}

/** Every assignment running on the day in a unit or a role that has ended by then. */
function endedFindings(
  assignments: readonly Assignment[], units: ReadonlyMap<ElementId, UnitLike>, roles: ReadonlyMap<RoleId, Role>, day: string,
): UnitFinding[] {
  const found: UnitFinding[] = []
  for (const assignment of assignments) {
    if (!runsOn(assignment, day)) continue
    const unit = units.get(assignment.unitId)
    const role = roles.get(assignment.roleId)
    if (unit && unitEnded(unit, day)) found.push({ kind: 'endedUnit', unitId: unit.id, assignment })
    else if (role && isDay(role.until) && day > role.until) {
      found.push({ kind: 'endedRole', unitId: assignment.unitId, roleId: role.id, assignment })
    }
  }
  return found
}

/** Every person whose running assignments take more than all of their time, once each, in the order first met. */
function overloads(assignments: readonly Assignment[], day: string, canonical: (id: PersonId) => PersonId): UnitFinding[] {
  const running = new Map<PersonId, Assignment[]>()
  for (const assignment of assignments) {
    if (!runsOn(assignment, day)) continue
    const who = canonical(personOf(assignment))
    running.set(who, [...running.get(who) ?? [], assignment])
  }
  const found: UnitFinding[] = []
  for (const [person, held] of running) {
    const load = held.reduce((sum, one) => sum + shareOf(one), 0)
    // Shares are fractions a person types: a hair over 1 from adding thirds is not a finding.
    if (load > 1 + 1e-9) found.push({ kind: 'overloaded', person, load, assignments: held })
  }
  return found
}

// --- leaving -------------------------------------------------------------------------------

/** What ending an assignment is, as the writer takes it: its last day set, or — one not begun — taken away. */
export type Ending =
  | { type: 'assignment.update'; id: AssignmentId; patch: { until: string } }
  | { type: 'assignment.remove'; id: AssignmentId }

/**
 * The ends a person's leaving makes in one scope's assignments (ADR-0036
 * §10): every assignment of theirs that runs past their last day ends on it,
 * and one that would only begin after it is taken away — a day nobody will
 * hold it. `persons` is every id that is theirs: the entry, and the ones a
 * merge folded into it. One already over by then is left as it is.
 */
export function endingFor(assignments: readonly Assignment[], persons: ReadonlySet<PersonId>, lastDay: string): Ending[] {
  const ends: Ending[] = []
  for (const assignment of assignments) {
    if (!persons.has(personOf(assignment))) continue
    if (isDay(assignment.from) && assignment.from > lastDay) ends.push({ type: 'assignment.remove', id: assignment.id })
    else if (!isDay(assignment.until) || assignment.until > lastDay) {
      ends.push({ type: 'assignment.update', id: assignment.id, patch: { until: lastDay } })
    }
  }
  return ends
}

/**
 * The one step a person's leaving makes in one scope's assignments (ADR-0036
 * §10): the ends {@link endingFor} says, as a single command — a transaction
 * where there are several — or nothing where there are none. What the app's
 * leave dispatches in each scope, and what a server applying a leave itself
 * applies there, so a leave means the same wherever it is made. `meta` marks
 * whose step it is: `{ origin: 'agent' }` for an agent's.
 */
export function leavingStep(
  assignments: readonly Assignment[], persons: ReadonlySet<PersonId>, lastDay: string, meta: CommandMeta = {},
): { command: Command; ended: number } | undefined {
  const ends = endingFor(assignments, persons, lastDay)
  if (ends.length === 0) return undefined
  const command: Command = ends.length === 1 ? { ...ends[0], ...meta } : { type: 'transaction', commands: [...ends], ...meta }
  return { command, ended: ends.length }
}
