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
 * is whoever holds a managing role in it, or in a unit above it, on that day
 * — except for the holders of a role a solid reporting line runs from that
 * day (ADR-0039): the holders of the role it lands on manage them, in place
 * of the nesting ({@link reportingLinesOn}, {@link managersOf}).
 * Nothing here reads the clock; the caller says which day, and *today* is the
 * caller's (`lifecycle.today`).
 *
 * **The organisation on a day** (ADR-0036 §6) is every date it holds read on
 * that day: a unit's lifecycle, a role's and a unit type's `from` and
 * `until`, an assignment's days — and the moves the plans make, which put a
 * unit under another parent from a day on ({@link organisationOn}). Every
 * question below asks it of the day it is given, so a plan's move is in the
 * answer from its day and not before.
 *
 * Pure, with no words and no paths: a server that grants a right from a
 * managing role (ADR-0036 §12) imports this file by its path and asks
 * {@link managersOf} and {@link managedBy} the same questions the screens do.
 */
import { isDay, phaseAt } from './lifecycle'
import type { PersonId, PickedPerson } from './person'
import type { LineKind, Role, RoleId, RoleSlot, UnitType, UnitTypeId } from './operatingModel'
import type { DesignElement, ElementId, UnitReportingLine } from './types'
import type { Command, CommandMeta } from './commands'
import type { TransitionMove } from './transition'

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

/** As much of an element as the arithmetic over units reads: `order` is its place among its siblings (`model/unitOrder.ts`). */
export type UnitLike = Pick<
  DesignElement,
  'id' | 'name' | 'kind' | 'parentId' | 'order' | 'unitTypeId' | 'extraSlots' | 'reportingLines' | 'lifecycle' | 'lifecycleDates'
  | 'scopes' | 'successorId'
>

/**
 * A unit put under another parent on a day, as a plan says it (ADR-0036 §6,
 * `model/transition.ts`): from `on`, the unit sits under `parentId`, or at the
 * top where there is none.
 */
export type UnitMove = TransitionMove

/**
 * As much of the organisation as a question about it needs: its units, its
 * assignments, its operating model — and the moves its plans make, every
 * plan's but an abandoned one's, absent where nobody gathered them.
 */
export type Organisation = {
  readonly units: readonly UnitLike[]
  readonly assignments: readonly Assignment[]
  readonly roles: readonly Role[]
  readonly unitTypes: readonly UnitType[]
  readonly moves?: readonly UnitMove[]
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
 * The assignments a unit type leaves where it stops holding a role (ADR-0036
 * §6, *when the model itself changes*): every one of the role in a unit of
 * the type that holds it through the type alone — not as an extra slot of its
 * own — and that runs past `lastDay`, or only begins after it. Read the same
 * whether the type still holds the role or has had it taken out.
 */
export function heldThroughType(organisation: Organisation, typeId: UnitTypeId, roleId: RoleId, lastDay: string): Assignment[] {
  const units = new Set(organisation.units
    .filter((unit) => isUnit(unit) && unit.unitTypeId === typeId && !(unit.extraSlots ?? []).some((slot) => slot.role === roleId))
    .map((unit) => unit.id))
  return organisation.assignments.filter((one) => one.roleId === roleId && units.has(one.unitId) && !(isDay(one.until) && one.until <= lastDay))
}

/**
 * The assignments a role taken out of the operating model altogether would
 * leave: every one of it, in any unit, that runs on `day` or only begins
 * after it — what the confirmation of its removal counts.
 */
export function holdingFrom(organisation: Organisation, roleId: RoleId, day: string): Assignment[] {
  return organisation.assignments.filter((one) => one.roleId === roleId && !(isDay(one.until) && one.until < day))
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

/** A unit type's own dates: whether it runs on `day`. */
export function unitTypeOn(type: Pick<UnitType, 'from' | 'until'>, day: string): boolean {
  return runsOn(type, day)
}

/** Whether a thing dated by `until` has ended by `day`: its last day has passed. */
export function endedBy(dated: { until?: string }, day: string): boolean {
  return isDay(dated.until) && day > dated.until
}

// --- the organisation on a day -------------------------------------------------------

/**
 * The parent a unit has on `day`: where the latest move on that day or before
 * it puts it — the last one listed where two fall on one day — and otherwise
 * its own `parentId`. A move with no day says nothing.
 */
export function parentOn(
  unit: Pick<UnitLike, 'id' | 'parentId'>, moves: readonly UnitMove[] | undefined, day: string,
): ElementId | undefined {
  let found: UnitMove | undefined
  for (const move of moves ?? []) {
    if (move.unitId !== unit.id || !isDay(move.on) || move.on > day) continue
    if (found === undefined || move.on >= found.on) found = move
  }
  return found ? found.parentId : unit.parentId
}

/**
 * The organisation on `day` (ADR-0036 §6): every unit under the parent the
 * plans' moves give it that day. Nothing else is taken away — a unit that has
 * ended, a role past its last day and an assignment that is over are all
 * still there, because the questions asked of the organisation read each
 * date themselves and an ended unit with people in it is a finding. The
 * organisation handed in where no move has come by then.
 *
 * Pure and exported, so every screen that shows the organisation on a day —
 * a unit's section, the chart, a plan's before and after — and a server
 * answering for a day ask the one function.
 */
export function organisationOn(organisation: Organisation, day: string): Organisation {
  const moves = organisation.moves ?? []
  if (!moves.some((move) => isDay(move.on) && move.on <= day)) return organisation
  return {
    ...organisation,
    units: organisation.units.map((unit) => {
      const parentId = parentOn(unit, moves, day)
      if (parentId === unit.parentId) return unit
      const { parentId: _was, ...rest } = unit
      return parentId === undefined ? rest : { ...rest, parentId }
    }),
  }
}

/**
 * Whether a move would put a unit under itself on some day from its own on
 * (ADR-0036 §6): under a unit below it then, or below it on any later day the
 * other moves reach. `organisation.moves` are the others — the move's own
 * plan's earlier move of the unit left out — and the move is laid over them.
 * A loop drawn would leave every unit in it with nobody above to hang from.
 */
export function makesLoop(organisation: Organisation, move: UnitMove): boolean {
  if (move.parentId === undefined || !isDay(move.on)) return false
  if (move.parentId === move.unitId) return true
  const moves = [...organisation.moves ?? [], move]
  const later = moves.filter((one) => isDay(one.on) && one.on > move.on).map((one) => one.on)
  const laid = { ...organisation, moves }
  return [move.on, ...later].some((day) => loopsAt(organisationOn(laid, day).units, move.unitId))
}

/** Whether following a unit's parents through units brings it back to itself. */
function loopsAt(units: readonly UnitLike[], unitId: ElementId): boolean {
  const held = byId(units)
  const seen = new Set<ElementId>()
  for (let at = held.get(unitId)?.parentId; at !== undefined && held.has(at); at = held.get(at)?.parentId) {
    if (at === unitId) return true
    if (seen.has(at)) return false
    seen.add(at)
  }
  return false
}

/** The units there on `day`, under the parent each has that day, in the order the organisation lists them. */
export function unitsOn(organisation: Organisation, day: string): UnitLike[] {
  return organisationOn(organisation, day).units.filter((unit) => isUnit(unit) && unitOn(unit, day))
}

/** How many units of each type are there on `day`: what a unit type's card says it has. */
export function unitCountsOn(organisation: Organisation, day: string): Map<UnitTypeId, number> {
  const counts = new Map<UnitTypeId, number>()
  for (const unit of unitsOn(organisation, day)) {
    const type = unit.unitTypeId ?? ''
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return counts
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

// --- reporting lines (ADR-0039) ------------------------------------------------------------

/**
 * How a reporting line stands on a day (ADR-0039 §2, §3, §6): it `lands` on a
 * role in a unit; it says the role reports by `nesting` here (a unit's line
 * with no target); or it can say nothing — `dangling`, no unit has the target
 * role (or the unit named is not there), or `ambiguous`, several have it and
 * none is above. Only a solid line that lands decides who manages.
 */
export type LineState = 'lands' | 'nesting' | 'dangling' | 'ambiguous'

/** A role in a unit: where a line runs from, and where it lands. */
export type LinePosition = { unitId: ElementId; roleId: RoleId }

/**
 * One reporting line on a day, from the holders of `roleId` in `unitId`:
 * whose it is (`type`, said on the unit type's slot, or `unit`, the unit's
 * own), its kind and days as written, and where it lands that day.
 */
export type ReportingLineOn = {
  unitId: ElementId
  roleId: RoleId
  kind: LineKind
  source: 'type' | 'unit'
  from?: string
  until?: string
  state: LineState
  /** Where it lands, where it does. */
  to?: LinePosition
  /** The units that have the target role where none is above, for an ambiguous line. */
  candidates?: ElementId[]
}

/** One key for a role in a unit, for a set or a map. */
export function positionKey(unitId: ElementId, roleId: RoleId): string {
  return `${unitId}\u0000${roleId}`
}

/** Whether anything in the organisation says a reporting line at all: where nothing does, nesting answers everywhere, as before. */
export function hasReportingLines(organisation: Pick<Organisation, 'units' | 'unitTypes'>): boolean {
  return organisation.unitTypes.some((type) => type.slots.some((slot) => slot.reportsTo !== undefined))
    || organisation.units.some((unit) => (unit.reportingLines?.length ?? 0) > 0)
}

/**
 * Every reporting line on `day` (ADR-0039 §2, §3), unit by unit in the
 * organisation's order and role by role in the unit's: a unit's own line
 * replaces its type's line of the same kind for that role on the days it
 * runs, and lands on the unit it names; a type's lands, under the parents the
 * day gives the units (the plans' moves included), on the nearest unit above
 * that has a slot for the target role, else on the one unit in the
 * organisation that has. Only units there that day and roles running that day
 * draw lines.
 */
export function reportingLinesOn(organisation: Organisation, day: string): ReportingLineOn[] {
  if (!hasReportingLines(organisation)) return []
  return linesOver(organisationOn(organisation, day), day)
}

/** {@link reportingLinesOn} over an organisation already laid on its day. */
function linesOver(on: Organisation, day: string): ReportingLineOn[] {
  if (!hasReportingLines(on)) return []
  const types = new Map(on.unitTypes.map((type) => [type.id, type]))
  const roles = new Map(on.roles.map((role) => [role.id, role]))
  const there = on.units.filter((unit) => isUnit(unit) && unitOn(unit, day))
  const holding = new Map<RoleId, ElementId[]>()
  for (const unit of there) {
    for (const slot of slotsOf(unit, types.get(unit.unitTypeId ?? ''))) holding.set(slot.role, [...holding.get(slot.role) ?? [], unit.id])
  }
  const thereIds = new Set(there.map((unit) => unit.id))
  const found: ReportingLineOn[] = []
  for (const unit of there) {
    const type = types.get(unit.unitTypeId ?? '')
    const own = (unit.reportingLines ?? []).filter((line) => runsOn(line, day))
    const typeSays = type && unitTypeOn(type, day) ? type.slots : []
    const roleIds = [...new Set([...slotsOf(unit, type).map((slot) => slot.role), ...own.map((line) => line.role)])]
    for (const roleId of roleIds) {
      const role = roles.get(roleId)
      if (!role || !roleOn(role, day)) continue
      for (const kind of ['solid', 'dotted'] as const) {
        const mine = own.find((line) => line.role === roleId && (line.to ? line.kind : 'solid') === kind)
        if (mine) {
          found.push({ unitId: unit.id, roleId, kind, source: 'unit', ...datedOf(mine), ...ownLanding(mine, thereIds) })
          continue
        }
        const says = typeSays.find((slot) => slot.role === roleId)?.reportsTo
        if (!says || says.kind !== kind || !runsOn(says, day)) continue
        found.push({ unitId: unit.id, roleId, kind, source: 'type', ...datedOf(says), ...landing(on.units, unit.id, roleId, says.role, holding, thereIds) })
      }
    }
  }
  return found
}

/** A line's days, as written. */
function datedOf(line: { from?: string; until?: string }): { from?: string; until?: string } {
  return { ...(line.from !== undefined ? { from: line.from } : {}), ...(line.until !== undefined ? { until: line.until } : {}) }
}

/** Where a unit's own line lands: by nesting where it names no target, on the unit it names where that is there. */
function ownLanding(line: UnitReportingLine, there: ReadonlySet<ElementId>): Pick<ReportingLineOn, 'state' | 'to'> {
  if (!line.to) return { state: 'nesting' }
  return there.has(line.to.unit) ? { state: 'lands', to: { unitId: line.to.unit, roleId: line.to.role } } : { state: 'dangling' }
}

/** Where a type's line lands: the nearest unit above with the target role, else the one unit that has it. */
function landing(
  units: readonly UnitLike[], unitId: ElementId, roleId: RoleId, target: RoleId,
  holding: ReadonlyMap<RoleId, readonly ElementId[]>, there: ReadonlySet<ElementId>,
): Pick<ReportingLineOn, 'state' | 'to' | 'candidates'> {
  const has = new Set(holding.get(target) ?? [])
  const above = unitsAbove(units, unitId).find((id) => there.has(id) && has.has(id))
  if (above !== undefined) return { state: 'lands', to: { unitId: above, roleId: target } }
  // The unit itself only where the target is another of its roles: a role does not report to itself.
  const anywhere = [...has].filter((id) => id !== unitId || target !== roleId)
  if (anywhere.length === 1) return { state: 'lands', to: { unitId: anywhere[0], roleId: target } }
  return anywhere.length === 0 ? { state: 'dangling' } : { state: 'ambiguous', candidates: anywhere }
}

/** The solid lines that land, by the role in the unit they run from. */
function solidLines(lines: readonly ReportingLineOn[]): Map<string, ReportingLineOn & { to: LinePosition }> {
  const solid = new Map<string, ReportingLineOn & { to: LinePosition }>()
  for (const line of lines) {
    if (line.kind === 'solid' && line.state === 'lands' && line.to) solid.set(positionKey(line.unitId, line.roleId), { ...line, to: line.to })
  }
  return solid
}

/** The solid line that decides who manages the holders of a role in a unit on `day`, where one does. */
export function solidLineOf(organisation: Organisation, unitId: ElementId, roleId: RoleId, day: string): ReportingLineOn | undefined {
  return reportingLinesOn(organisation, day)
    .find((line) => line.unitId === unitId && line.roleId === roleId && line.kind === 'solid' && line.state === 'lands')
}

/** The dotted lines from a unit's roles on `day` that land — or from one role's, where one is named: shown, and deciding nothing. */
export function dottedLinesOf(organisation: Organisation, unitId: ElementId, day: string, roleId?: RoleId): ReportingLineOn[] {
  return reportingLinesOn(organisation, day).filter((line) => (
    line.unitId === unitId && line.kind === 'dotted' && line.state === 'lands' && (roleId === undefined || line.roleId === roleId)
  ))
}

// --- who manages ------------------------------------------------------------------------

/** Why someone manages: they hold a managing role in the unit or above it, or a solid line lands on their role (ADR-0039 §4). */
export type ManagedVia = 'nesting' | 'line'

/** One person who manages a unit on a day, and from where: the unit whose role they hold, the role, and why. */
export type Manager = {
  person: PersonId
  /** The unit the role is held in: the unit asked about, one above it, or where a line lands. */
  unitId: ElementId
  roleId: RoleId
  assignment: Assignment
  via: ManagedVia
}

/**
 * Who manages on `day` (ADR-0036 §12, ADR-0039 §4): the people of a unit, or
 * — `roleId` given — the holders of one role in it.
 *
 * A role whose solid line runs that day and lands is managed by the holders
 * of the target role there (`via: 'line'`), and then by whoever manages
 * *those* holders, by the same rule. Otherwise, by nesting: whoever holds a
 * role marked `manages` in the unit or in a unit above it, nearest unit first
 * and in the order the assignments are listed within a unit — each managing
 * role on the way with a solid line of its own followed where it lands. A
 * chain that comes back to a role in a unit it has met stops there, so a loop
 * that time made still answers. Each assignment once. Dotted lines are
 * {@link dottedLinesOf}'s, and never a manager.
 *
 * Core grants nothing from this; a build that knows who people are may.
 */
export function managersOf(organisation: Organisation, unitId: ElementId, day: string, roleId?: RoleId): Manager[] {
  const on = organisationOn(organisation, day)
  const units = byId(on.units)
  const managing = managingRoles(on.roles, day)
  const solid = solidLines(linesOver(on, day))
  const found: Manager[] = []
  const listed = new Set<string>()
  const met = new Set<string>()
  const push = (assignment: Assignment, via: ManagedVia) => {
    if (listed.has(assignment.id)) return
    listed.add(assignment.id)
    found.push({ person: personOf(assignment), unitId: assignment.unitId, roleId: assignment.roleId, assignment, via })
  }
  const follow = (at: ElementId, role: RoleId | undefined): void => {
    if (role !== undefined) {
      const key = positionKey(at, role)
      if (met.has(key)) return
      met.add(key)
      const line = solid.get(key)
      if (line) {
        for (const one of holdersOn(on.assignments, line.to.unitId, line.to.roleId, day)) push(one, 'line')
        follow(line.to.unitId, line.to.roleId)
        return
      }
    }
    for (const id of [at, ...unitsAbove(on.units, at)]) {
      const unit = units.get(id)
      if (!unit || !unitOn(unit, day)) continue
      const here = on.assignments.filter((one) => one.unitId === id && managing.has(one.roleId) && runsOn(one, day))
      for (const one of here) push(one, 'nesting')
      for (const managingRole of new Set(here.map((one) => one.roleId))) {
        if (solid.has(positionKey(id, managingRole))) follow(id, managingRole)
      }
    }
  }
  follow(unitId, roleId)
  return found
}

/** The roles marked `manages` that run on `day`. */
function managingRoles(roles: readonly Role[], day: string): Set<RoleId> {
  return new Set(roles.filter((role) => role.manages === true && roleOn(role, day)).map((role) => role.id))
}

/**
 * What one person manages on a day (ADR-0036 §12, ADR-0039 §4), by unit and
 * by role in a unit:
 *
 * - `held`: the units in which they hold a managing role;
 * - `units`: those and every unit below each — and, where a solid line lands
 *   on a role they reach and the role it runs from manages, that role's unit
 *   and every unit below it — whose people they manage by nesting, a unit
 *   they hold the role in first and the units below it after;
 * - `below`: the units in `units` strictly below one of theirs;
 * - `elsewhere`: the roles in those units whose holders report elsewhere by a
 *   solid line, which nesting no longer reaches;
 * - `lines`: the roles whose solid line lands on a role they hold or reach,
 *   and in turn the roles whose line lands on those — never one they hold.
 *
 * `canonical` maps an id to the entry that answers for it, so an assignment
 * kept under an id merged into this person's still counts.
 */
export type ManagedPositions = {
  held: ElementId[]
  units: ElementId[]
  below: ElementId[]
  elsewhere: LinePosition[]
  lines: LinePosition[]
}

export function managedBy(
  organisation: Organisation, person: PersonId, day: string, canonical: (id: PersonId) => PersonId = same,
): ManagedPositions {
  const on = organisationOn(organisation, day)
  const units = byId(on.units)
  const managing = managingRoles(on.roles, day)
  const who = canonical(person)
  const theirs = on.assignments.filter((one) => {
    const unit = units.get(one.unitId)
    return canonical(personOf(one)) === who && runsOn(one, day) && unit !== undefined && unitOn(unit, day)
  })
  const own = new Set(theirs.map((one) => positionKey(one.unitId, one.roleId)))
  const held: ElementId[] = []
  for (const one of theirs) if (managing.has(one.roleId) && !held.includes(one.unitId)) held.push(one.unitId)
  const reached: ElementId[] = []
  const inReach = new Set<ElementId>()
  const below = new Set<ElementId>()
  const root = (id: ElementId, strictly: boolean) => {
    if (strictly) below.add(id)
    for (const one of [id, ...unitsBelow(on.units, id)]) {
      if (one !== id) below.add(one)
      if (!inReach.has(one) && units.has(one)) { inReach.add(one); reached.push(one) }
    }
  }
  for (const id of held) root(id, false)
  const lines = [...solidLines(linesOver(on, day)).values()]
  const reportElsewhere = new Set(lines.map((line) => positionKey(line.unitId, line.roleId)))
  const byLine = new Map<string, LinePosition>()
  const reaches = (at: LinePosition) => {
    const key = positionKey(at.unitId, at.roleId)
    return own.has(key) || byLine.has(key) || (inReach.has(at.unitId) && !reportElsewhere.has(key))
  }
  // Until nothing more is reached: a role reached by a line may be one whose holders manage, or are reported to, in turn.
  for (let grew = true; grew;) {
    grew = false
    for (const line of lines) {
      const key = positionKey(line.unitId, line.roleId)
      if (byLine.has(key) || !reaches(line.to)) continue
      byLine.set(key, { unitId: line.unitId, roleId: line.roleId })
      grew = true
      if (managing.has(line.roleId)) root(line.unitId, true)
    }
  }
  return {
    held,
    units: reached,
    below: [...below].filter((id) => inReach.has(id)),
    elsewhere: lines.filter((line) => inReach.has(line.unitId) && !byLine.has(positionKey(line.unitId, line.roleId)))
      .map((line) => ({ unitId: line.unitId, roleId: line.roleId })),
    lines: [...byLine].filter(([key]) => !own.has(key)).map(([, at]) => at),
  }
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
 * - `orphaned`: an assignment in a unit that is not there at all — taken out
 *   of the model, or no longer a unit — whatever its days, because the unit
 *   did not end on a day: it was corrected away, and the assignment with it
 *   is a correction nobody made;
 * - `endedType`: a unit still there under a unit type that has ended — what
 *   it is now is a decision nobody has made;
 * - `overloaded`: a person whose shares add up to more than all of their
 *   time, with the assignments that make it up.
 *
 * A unit type that does not run on the day asks for nobody in its slots, as
 * a role that does not run asks for nobody in its own.
 */
export type UnitFinding =
  | { kind: 'vacant'; unitId: ElementId; roleId: RoleId; held: number; min: number }
  | { kind: 'overMax'; unitId: ElementId; roleId: RoleId; held: number; max: number }
  | { kind: 'misplaced'; unitId: ElementId; parentType?: UnitTypeId }
  | { kind: 'spans'; unitId: ElementId; serves: number }
  | { kind: 'overLimit'; unitId: ElementId; owns: number; limit: number }
  | { kind: 'endedUnit'; unitId: ElementId; assignment: Assignment }
  | { kind: 'endedRole'; unitId: ElementId; roleId: RoleId; assignment: Assignment }
  | { kind: 'orphaned'; unitId: ElementId; assignment: Assignment }
  | { kind: 'endedType'; unitId: ElementId; unitTypeId: UnitTypeId; until: string }
  | { kind: 'overloaded'; person: PersonId; load: number; assignments: Assignment[] }

/**
 * Every finding of the organisation on `day`, unit by unit and then person
 * by person. `owns` says how many applications name a unit as theirs
 * (`partyId`) and are there on the day, which the caller counts over the
 * tree; absent, no limit is read. `canonical` is as {@link loadOn} takes it.
 */
export function unitFindings(
  organisation: Organisation, day: string,
  deps: { owns?: (unitId: ElementId, day: string) => number; canonical?: (id: PersonId) => PersonId } = {},
): UnitFinding[] {
  const on = organisationOn(organisation, day)
  const types = new Map(on.unitTypes.map((type) => [type.id, type]))
  const roles = new Map(on.roles.map((role) => [role.id, role]))
  const units = byId(on.units)
  const found: UnitFinding[] = []
  for (const unit of units.values()) {
    const type = types.get(unit.unitTypeId ?? '')
    if (!type || !unitOn(unit, day)) continue
    if (isDay(type.until) && endedBy(type, day)) found.push({ kind: 'endedType', unitId: unit.id, unitTypeId: type.id, until: type.until })
    if (unitTypeOn(type, day)) found.push(...slotFindings(on, unit, type, roles, day))
    const parentType = parentTypeOf(on.units, unit)
    if (!mayHaveParent(type, parentType)) {
      found.push({ kind: 'misplaced', unitId: unit.id, ...(parentType !== undefined ? { parentType } : {}) })
    }
    // The organisation is no domain (`serving.isServable`): a `""` an older write left counts for nothing.
    const serves = unit.scopes?.filter((scope) => scope !== '').length ?? 0
    if (serves > 1 && type.spans !== true) found.push({ kind: 'spans', unitId: unit.id, serves })
    const owns = deps.owns?.(unit.id, day) ?? 0
    if (type.limit !== undefined && owns > type.limit) found.push({ kind: 'overLimit', unitId: unit.id, owns, limit: type.limit })
  }
  found.push(...endedFindings(on.assignments, units, roles, day))
  found.push(...overloads(on.assignments, day, deps.canonical ?? same))
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

/**
 * Every assignment in a unit that is not there — taken away, or no longer a
 * unit — whatever its days; then every one running on the day in a unit or a
 * role that has ended by then, or a role taken out of an operating model that
 * holds others. Nobody holds a role in nothing, and the person is still
 * counted as holding it.
 */
function endedFindings(
  assignments: readonly Assignment[], units: ReadonlyMap<ElementId, UnitLike>, roles: ReadonlyMap<RoleId, Role>, day: string,
): UnitFinding[] {
  const found: UnitFinding[] = []
  for (const assignment of assignments) {
    const unit = units.get(assignment.unitId)
    if (!unit) {
      found.push({ kind: 'orphaned', unitId: assignment.unitId, assignment })
      continue
    }
    if (!runsOn(assignment, day)) continue
    const role = roles.get(assignment.roleId)
    if (unitEnded(unit, day)) found.push({ kind: 'endedUnit', unitId: assignment.unitId, assignment })
    else if (role ? endedBy(role, day) : roles.size > 0) {
      found.push({ kind: 'endedRole', unitId: assignment.unitId, roleId: assignment.roleId, assignment })
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

// --- deleting a unit -------------------------------------------------------------------------

/**
 * The assignments a delete of these elements takes with it (ADR-0036, amended
 * 12 October 2026): every one kept for any of them, ended ones included.
 * Deleting a unit is a correction — it was never there — so its assignments
 * go in the same step rather than ending on a day (`commands/elements.ts`).
 */
export function assignmentsIn(assignments: readonly Assignment[], elementIds: Iterable<ElementId>): Assignment[] {
  const ids = new Set(elementIds)
  return assignments.filter((one) => ids.has(one.unitId))
}

/** One person in one role in one unit: what a delete's confirmation names as ending. */
export type RoleHeld = { person: PersonId; roleId: RoleId; unitId: ElementId }

/**
 * What a delete of these elements ends, as its confirmation says it: each
 * person in each role in each unit once, for an assignment still running on
 * `today` or still to begin, in the order they are kept; and how many are
 * already over, which go too and end nobody's role. With no day, every one
 * is still held.
 */
export function rolesEndedBy(
  assignments: readonly Assignment[], elementIds: Iterable<ElementId>, today?: string,
): { roles: RoleHeld[]; earlier: number } {
  const roles: RoleHeld[] = []
  const seen = new Set<string>()
  let earlier = 0
  for (const one of assignmentsIn(assignments, elementIds)) {
    if (today !== undefined && endedBy(one, today)) { earlier += 1; continue }
    const key = JSON.stringify([personOf(one), one.roleId, one.unitId])
    if (seen.has(key)) continue
    seen.add(key)
    roles.push({ person: personOf(one), roleId: one.roleId, unitId: one.unitId })
  }
  return { roles, earlier }
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
