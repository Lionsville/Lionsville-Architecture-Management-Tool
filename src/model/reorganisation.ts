// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a change to the organisation does to the people in it (ADR-0036 §6):
 * a correction is an edit, a change has a day.
 *
 * **A reorganisation is a plan.** On its days it introduces units, retires
 * others and moves some under a new parent (`Transition.moves`); and a role
 * that stops existing ends the day before one of those days, naming its
 * successors. {@link planReorganisation} reads that off the plan and the
 * organisation, so nothing is said twice.
 *
 * **Nobody's new place is guessed.** Every assignment that runs past the last
 * day of its unit or its role is listed ({@link peopleToMove}), each with a
 * suggestion — where the unit went (its successor), the role's successor —
 * which a person accepts or changes. A team that moves takes its people with
 * it: an assignment in a moved unit does not end, so it is not listed.
 *
 * **Writing it is one step** ({@link peopleMoveSteps}): every old assignment
 * ends on its last day and every new one begins the day after, gathered per
 * scope — the scope that keeps the old assignment, the scope that answers for
 * the new unit — so each scope gets one step and the caller lands them all
 * together. A reorganisation that landed piece by piece would leave the
 * organisation wrong in between.
 *
 * **The same list serves the operating model.** A role that ends on a day,
 * outside any plan, lists its people with the role's successor in the same
 * unit ({@link roleEnding}).
 *
 * Pure, with no words: the screens and the agent have them.
 */
import { accountabilityGaps } from './operatingModel'
import type { Responsibility, RoleId, UnitTypeId } from './operatingModel'
import { isDay } from './lifecycle'
import { addDays } from './transition'
import type { Transition } from './transition'
import type { ElementId } from './types'
import type { Command } from './commands'
import { pickedPerson } from './person'
import type { PersonId } from './person'
import {
  dayBefore, isUnit, organisationOn, personOf, roleOn, runsOn, slotsOf, unitLastDay, unitOn, unitsAbove,
} from './units'
import type { Assignment, Organisation, UnitLike, UnitMove } from './units'

/** A unit that ends, and the last day it is there. */
export type UnitEnd = { unitId: ElementId; lastDay: string }

/** A role that ends, and its last day. */
export type RoleEnd = { roleId: RoleId; lastDay: string }

/**
 * What one plan does to the organisation, read off the plan and the units it
 * names: the units it introduces and the day each is there, the units it
 * retires and the last day each is there, the units it moves, and the roles
 * that end the day before one of its days. `days` is every day of those, in
 * order: the days the organisation is different from the day before.
 */
export type PlanReorganisation = {
  days: string[]
  introduces: { unitId: ElementId; on?: string }[]
  retires: UnitEnd[]
  moves: UnitMove[]
  roles: RoleEnd[]
}

/**
 * What a plan does to the organisation (ADR-0036 §6). A unit it introduces
 * is there from its live day; a unit it retires is there until the day before
 * it is retired; a move has its own day. A role ends under the plan when its
 * last day is the day before one of those days. An element the plan names
 * that is not a unit says nothing here, and a unit with no date says nothing
 * about a day.
 */
export function planReorganisation(plan: Pick<Transition, 'elements' | 'moves'>, organisation: Organisation): PlanReorganisation {
  const units = new Map(organisation.units.filter(isUnit).map((unit) => [unit.id, unit]))
  const introduces: PlanReorganisation['introduces'] = []
  const retires: UnitEnd[] = []
  for (const one of plan.elements) {
    const unit = units.get(one.elementId)
    if (!unit) continue
    if (one.role === 'introduces') {
      const live = unit.lifecycleDates?.live
      introduces.push({ unitId: unit.id, ...(isDay(live) ? { on: live } : {}) })
    }
    const lastDay = one.role === 'retires' ? unitLastDay(unit) : undefined
    if (lastDay !== undefined) retires.push({ unitId: unit.id, lastDay })
  }
  const moves = (plan.moves ?? []).filter((move) => isDay(move.on))
  const unitDays = [
    ...introduces.flatMap((one) => (one.on !== undefined ? [one.on] : [])),
    ...retires.map((one) => addDays(one.lastDay, 1)),
    ...moves.map((move) => move.on),
  ]
  const roles = organisation.roles
    .filter((role) => isDay(role.until) && unitDays.includes(addDays(role.until, 1)))
    .map((role) => ({ roleId: role.id, lastDay: role.until! }))
  return { days: [...new Set(unitDays)].sort(), introduces, retires, moves, roles }
}

/**
 * A role that ends on its own day (ADR-0036 §6, *when the model itself
 * changes*): its people are listed with its successor in the same unit.
 * Nothing where the role has no last day.
 */
export function roleEnding(role: { id: RoleId; until?: string }): RoleEnd[] {
  return isDay(role.until) ? [{ roleId: role.id, lastDay: role.until }] : []
}

// --- the people to move ----------------------------------------------------------------

/** Where a person goes from the day after: a unit and a role. */
export type Place = { unitId: ElementId; roleId: RoleId }

/**
 * One assignment that runs past the last day of its unit or its role: where
 * it ends, why, and a suggestion — or none, where the unit ended with no
 * successor or the role with none, and the assignment only ends.
 */
export type PeopleMove = {
  assignment: Assignment
  /** The last day it is held where it is: the earlier of its unit's and its role's. */
  lastDay: string
  /** Its unit ends by then. */
  unitEnds: boolean
  /** Its role ends by then. */
  roleEnds: boolean
  /** Where it would go from the day after: the unit's successor, the role's, or the same. */
  suggestion?: Place
}

/**
 * Every assignment that runs past the last day of its unit or its role (ADR-0036
 * §6), in the order the organisation lists them, each with a suggestion: the
 * unit where it went — its successor, where that is a unit — and the role's
 * first successor that runs the day after, or the same unit and role where
 * that one goes on. An assignment over by then is not listed, and neither is
 * one in a unit that only moves.
 */
export function peopleToMove(organisation: Organisation, ends: { units?: readonly UnitEnd[]; roles?: readonly RoleEnd[] }): PeopleMove[] {
  const unitLasts = new Map((ends.units ?? []).map((one) => [one.unitId, one.lastDay]))
  const roleLasts = new Map((ends.roles ?? []).map((one) => [one.roleId, one.lastDay]))
  const units = new Map(organisation.units.filter(isUnit).map((unit) => [unit.id, unit]))
  const moves: PeopleMove[] = []
  for (const assignment of organisation.assignments) {
    const unitLast = unitLasts.get(assignment.unitId)
    const roleLast = roleLasts.get(assignment.roleId)
    const lastDay = [unitLast, roleLast].filter(isDay).sort()[0]
    if (lastDay === undefined || (isDay(assignment.until) && assignment.until <= lastDay)) continue
    const unitEnds = unitLast !== undefined && unitLast <= lastDay
    const roleEnds = roleLast !== undefined && roleLast <= lastDay
    const suggestion = suggest(organisation, units, assignment, { unitEnds, roleEnds, next: addDays(lastDay, 1) })
    moves.push({ assignment, lastDay, unitEnds, roleEnds, ...(suggestion ? { suggestion } : {}) })
  }
  return moves
}

/** Where one assignment would go from `next`: the unit's successor and the role's, or the same where it goes on. */
function suggest(
  organisation: Organisation, units: ReadonlyMap<ElementId, UnitLike>, assignment: Assignment,
  at: { unitEnds: boolean; roleEnds: boolean; next: string },
): Place | undefined {
  const successor = units.get(assignment.unitId)?.successorId
  const unitId = at.unitEnds ? (successor !== undefined && units.has(successor) ? successor : undefined) : assignment.unitId
  if (unitId === undefined) return undefined
  if (!at.roleEnds) return { unitId, roleId: assignment.roleId }
  const role = organisation.roles.find((one) => one.id === assignment.roleId)
  const roles = new Map(organisation.roles.map((one) => [one.id, one]))
  const next = (role?.successors ?? []).find((id) => {
    const held = roles.get(id)
    return held !== undefined && roleOn(held, at.next)
  }) ?? role?.successors?.find((id) => roles.has(id))
  return next === undefined ? undefined : { unitId, roleId: next }
}

/**
 * The places a person may be put from `day` in each of these units: every
 * slot of the unit's type, and its extra ones, whose role runs that day — in
 * the order the units are given and each unit's slots in its type's order.
 * A unit not there that day offers none.
 */
export function placesIn(organisation: Organisation, unitIds: readonly ElementId[], day: string): Place[] {
  const types = new Map(organisation.unitTypes.map((type) => [type.id, type]))
  const roles = new Map(organisation.roles.map((role) => [role.id, role]))
  const places: Place[] = []
  for (const unitId of [...new Set(unitIds)]) {
    const unit = organisation.units.find((one) => one.id === unitId)
    if (!unit || !isUnit(unit) || !unitOn(unit, day)) continue
    for (const slot of slotsOf(unit, types.get(unit.unitTypeId ?? ''))) {
      const role = roles.get(slot.role)
      if (role && roleOn(role, day)) places.push({ unitId, roleId: slot.role })
    }
  }
  return places
}

/** What a person decided for one row: a place from the day after, or only the end. */
export type PeopleChoice = Place | 'end'

/** Whether two places are the same unit and role. */
export function samePlace(a: Place | undefined, b: Place | undefined): boolean {
  return a !== undefined && b !== undefined && a.unitId === b.unitId && a.roleId === b.roleId
}

/**
 * The steps that write the people's moves (ADR-0036 §6), one list of commands
 * per scope: each old assignment ends on its last day — or, one that would
 * only have begun after it, is taken away — in the scope that keeps it, and
 * each new one begins the day after (or on its own first day, where that is
 * later) in the scope that answers for its unit, for the same person, the
 * same share, the same last day where it had one after that, and *acting*
 * where it was. The new one names the person by the entry a merge kept
 * (`canonical`), never by an id merged into it, so nothing new is written
 * under an id that is only a redirect. A row whose unit or assignment has no
 * scope is passed over. The caller makes each scope's list one step and lands
 * them together.
 */
export function peopleMoveSteps(
  rows: readonly { move: PeopleMove; choice: PeopleChoice }[],
  deps: {
    scopeOfAssignment: (assignment: Assignment) => string | undefined
    scopeOfUnit: (unitId: ElementId) => string | undefined
    makeId: (prefix: string) => string
    /** The id that answers for an id: the entry a merge kept, or the id itself. Absent, every id answers for itself. */
    canonical?: (id: PersonId) => PersonId
  },
): Map<string, Command[]> {
  const steps = new Map<string, Command[]>()
  const add = (scope: string, command: Command) => steps.set(scope, [...steps.get(scope) ?? [], command])
  for (const { move, choice } of rows) {
    const { assignment, lastDay } = move
    const kept = deps.scopeOfAssignment(assignment)
    if (kept === undefined) continue
    const begun = !isDay(assignment.from) || assignment.from <= lastDay
    add(kept, begun
      ? { type: 'assignment.update', id: assignment.id, patch: { until: lastDay } }
      : { type: 'assignment.remove', id: assignment.id })
    if (choice === 'end') continue
    const scope = deps.scopeOfUnit(choice.unitId)
    if (scope === undefined) continue
    const next = addDays(lastDay, 1)
    const from = isDay(assignment.from) && assignment.from > next ? assignment.from : next
    const fresh: Assignment = {
      id: deps.makeId('as'),
      unitId: choice.unitId,
      roleId: choice.roleId,
      person: pickedPerson(deps.canonical ? deps.canonical(personOf(assignment)) : personOf(assignment)),
      ...(assignment.share !== undefined ? { share: assignment.share } : {}),
      from,
      ...(isDay(assignment.until) && assignment.until >= from ? { until: assignment.until } : {}),
      ...(assignment.acting ? { acting: true as const } : {}),
    }
    add(scope, { type: 'assignment.add', assignment: fresh })
  }
  return steps
}

// --- before and after -----------------------------------------------------------------

/** One unit on a day, the people who hold a role in it that day, and the units under it. */
export type UnitNode = {
  unit: UnitLike
  holders: Assignment[]
  children: UnitNode[]
}

/**
 * The tree of units under each root on `day` (ADR-0036 §6): every unit there
 * that day, under the parent the moves give it, with who holds a role in it.
 * A root not there that day is left out. A loop is walked once.
 */
export function unitTree(organisation: Organisation, day: string, roots: readonly ElementId[]): UnitNode[] {
  const on = organisationOn(organisation, day)
  const there = on.units.filter((unit) => isUnit(unit) && unitOn(unit, day))
  const children = new Map<ElementId, UnitLike[]>()
  for (const unit of there) {
    if (unit.parentId !== undefined) children.set(unit.parentId, [...children.get(unit.parentId) ?? [], unit])
  }
  const seen = new Set<ElementId>()
  const node = (unit: UnitLike): UnitNode => {
    seen.add(unit.id)
    return {
      unit,
      holders: on.assignments.filter((one) => one.unitId === unit.id && runsOn(one, day)),
      children: (children.get(unit.id) ?? []).filter((child) => !seen.has(child.id)).map(node),
    }
  }
  return roots.flatMap((id) => {
    const unit = there.find((one) => one.id === id)
    return unit && !seen.has(id) ? [node(unit)] : []
  })
}

/**
 * The units a plan's before and after are drawn from: the parents, on the
 * day before and on the day after, of every unit it introduces, retires or
 * moves — and the unit itself where it has none — less every one that sits
 * under another of them on either day. The smallest trees that hold the
 * whole change, in the order first met.
 */
export function reorganisationRoots(organisation: Organisation, reorganisation: PlanReorganisation, before: string, after: string): ElementId[] {
  const touched = [
    ...reorganisation.introduces.map((one) => one.unitId),
    ...reorganisation.retires.map((one) => one.unitId),
    ...reorganisation.moves.flatMap((move) => [move.unitId, ...(move.parentId !== undefined ? [move.parentId] : [])]),
  ]
  const days = [organisationOn(organisation, before), organisationOn(organisation, after)]
  const candidates: ElementId[] = []
  for (const id of touched) {
    for (const on of days) {
      const parent = on.units.find((unit) => unit.id === id)?.parentId
      const top = parent !== undefined && on.units.some((unit) => unit.id === parent && isUnit(unit)) ? parent : id
      if (!candidates.includes(top)) candidates.push(top)
    }
  }
  // One candidate under another is drawn in that one's tree — but of two above each other, a loop,
  // the first is kept, or the loop would be drawn nowhere.
  const under = (on: Organisation, id: ElementId, other: ElementId) => unitsAbove(on.units, id).includes(other)
  return candidates.filter((id, at) => !days.some((on) => candidates.some((other, there) => (
    other !== id && under(on, id, other) && (!under(on, other, id) || there < at)
  ))))
}

/** The day before a plan's first day and its last day: the two the organisation is shown on. Nothing where it has no day. */
export function beforeAndAfter(reorganisation: Pick<PlanReorganisation, 'days'>): { before: string; after: string } | undefined {
  const { days } = reorganisation
  if (days.length === 0) return undefined
  return { before: dayBefore(days[0]), after: days[days.length - 1] }
}

// --- what is still open on the day -------------------------------------------------------

/**
 * The responsibilities that lose their *A* between two days (ADR-0036 §6):
 * exactly one running role's *A* on the first, and not on the second — a role
 * that ended took it with it, and somebody has to take it on.
 */
export function lostAccountability(
  responsibilities: readonly Responsibility[], organisation: Pick<Organisation, 'roles'>, before: string, after: string,
): Responsibility[] {
  const gapsOn = (day: string) => new Set(accountabilityGaps(responsibilities, organisation.roles.filter((role) => roleOn(role, day)))
    .map((gap) => gap.responsibility.id))
  const was = gapsOn(before)
  const is = gapsOn(after)
  return responsibilities.filter((one) => !was.has(one.id) && is.has(one.id))
}

/**
 * The units of a unit type still there the day after it ends, and who holds
 * a role in each that day: what a unit type that stops existing leaves to
 * decide (ADR-0036 §6). Nothing where the type has no last day.
 */
export function unitsOfEndedType(organisation: Organisation, type: { id: UnitTypeId; until?: string }): { unit: UnitLike; holders: Assignment[] }[] {
  if (!isDay(type.until)) return []
  const next = addDays(type.until, 1)
  return organisation.units
    .filter((unit) => isUnit(unit) && unit.unitTypeId === type.id && unitOn(unit, next))
    .map((unit) => ({ unit, holders: organisation.assignments.filter((one) => one.unitId === unit.id && runsOn(one, next)) }))
}
