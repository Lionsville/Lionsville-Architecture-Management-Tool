// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart on a day (ADR-0036 §7): the units as a tree, the
 * roles each holds and who holds them, the vacancies, the people over all of
 * their time, and the people still assigned to a unit that has ended.
 *
 * **Laid out, never drawn.** Nothing here has a coordinate: the tree is the
 * units' `parentId`, the order is the one every list of units reads
 * (`compareUnits`) — the unit type's rank in the structure, the unit's own
 * `order` among its siblings, then its name — and the page nests one box
 * inside the next. So a chart has no geometry file, and the same organisation
 * on the same day is the same chart for everybody.
 *
 * **On a day.** The organisation is that day's (`organisationOn`): every
 * unit under the parent the plans' moves give it then (§6). A unit is drawn
 * while it is there on the day — live or retiring by its lifecycle — and,
 * once it has ended, only while somebody is still assigned to it, so the
 * people a reorganisation left behind are seen where they were left. A role
 * that has ended asks for nobody, and nor does a unit type that has: its
 * holders are drawn beside the slots. A vacancy is a slot's minimum less the
 * people holding the role that day; it is never a record (§3).
 *
 * Pure, with no words: who a person is, is the register's to say, and the
 * page asks it for each name as it draws.
 */
import { isDay } from './lifecycle'
import type { PersonId } from './person'
import type { Role, RoleId, UnitType, UnitTypeId } from './operatingModel'
import type { DesignDiagram, ElementId } from './types'
import { compareUnits, unitTypeRank } from './unitOrder'
import {
  holdersOn, isUnit, organisationOn, personOf, roleOn, runsOn, shareOf, slotsOf, unitEnded, unitLastDay, unitOn, unitTypeOn, unitsAbove,
  unitsBelow,
} from './units'
import type { Assignment, Organisation, UnitLike } from './units'

/**
 * A new organisation chart or Conway map (ADR-0036 §7): a name, and nothing
 * on it — what either draws is the units, the assignments and the rows, and
 * a member row would be a second place to keep the same fact. No geometry,
 * as no laid-out view has any; the day is the board's, today until one is
 * saved onto it.
 */
export function laidOutView(kind: 'chart' | 'conway', id: string, name: string): DesignDiagram {
  return { id, kind, name, members: [], geometry: { nodes: [] } }
}

/** One person in one role of a unit on the day. */
export type ChartHolder = {
  assignment: Assignment
  /** Who, as the entry that answers for them: an id a merge folded away reads as the one it went into. */
  person: PersonId
  /** The part of their time, 1 being all of it. */
  share: number
  /** Their assignments across the organisation take more than all of their time on the day. */
  overloaded: boolean
}

/** One role a unit holds, against who holds it on the day. */
export type ChartSlot = {
  roleId: RoleId
  min: number
  max?: number
  holders: ChartHolder[]
  /** How many more the slot's minimum asks for: a vacancy is worked out, never kept. */
  vacant: number
  /** Whether one more may hold it: below its maximum, or with no maximum. */
  room: boolean
  /** A role beyond the unit's type, which the unit holds itself (`extraSlots`). */
  extra: boolean
}

/** A holder in a role the unit holds no slot for on the day: a role it does not hold, or one that has ended. */
export type ChartOther = ChartHolder & { endedRole: boolean }

/** One unit of the chart, and the units under it. */
export type ChartUnit = {
  id: ElementId
  name: string
  unitTypeId?: UnitTypeId
  /** The domains it serves, where it says (`scopes`). */
  serves: readonly string[]
  slots: ChartSlot[]
  others: ChartOther[]
  children: ChartUnit[]
  /** The unit has ended by the day and somebody is still assigned to it. */
  ended: boolean
  /** Its first day, where its dates say. */
  begins?: string
  /** Its last day, where its dates say. */
  ends?: string
}

export type OrgChart = {
  roots: ChartUnit[]
  /** How many units are drawn, ended ones with people left in them included. */
  units: number
  /** How many people hold a role in a unit drawn, each once. */
  people: number
}

export type ChartOptions = {
  /**
   * Which units the chart is of: each this answers true for, and every unit
   * below one of them. Absent: every unit.
   */
  include?: (unit: UnitLike) => boolean
  /** Only this unit and the units below it. */
  root?: ElementId
  /** The entry that answers for an id: a merged id to the one it went into. */
  canonical?: (id: PersonId) => PersonId
}

/** What building one unit's box reads, worked out once for the whole chart. */
type Reading = {
  day: string
  organisation: Organisation
  types: ReadonlyMap<UnitTypeId, UnitType>
  roles: ReadonlyMap<RoleId, Role>
  loads: ReadonlyMap<PersonId, number>
  canonical: (id: PersonId) => PersonId
  children: ReadonlyMap<ElementId, UnitLike[]>
}

/** Shares are fractions a person types: a hair over 1 from adding thirds is not over. */
const OVER = 1 + 1e-9

/** Whether a person's shares on a day add up to more than all of their time. */
export function overAllOfTheirTime(load: number): boolean {
  return load > OVER
}

/** The organisation chart on `day`. */
export function orgChart(whenever: Organisation, day: string, options: ChartOptions = {}): OrgChart {
  const organisation = organisationOn(whenever, day)
  const canonical = options.canonical ?? ((id: PersonId) => id)
  const shown = shownUnits(organisation, day, options)
  const { roots, children } = treeOf(organisation.units, shown, compareUnits(unitTypeRank(organisation.unitTypes)))
  const reading: Reading = {
    day,
    organisation,
    types: new Map(organisation.unitTypes.map((type) => [type.id, type])),
    roles: new Map(organisation.roles.map((role) => [role.id, role])),
    loads: loadsOn(organisation.assignments, day, canonical),
    canonical,
    children,
  }
  const seen = new Set<ElementId>()
  const built = roots.map((unit) => chartUnit(unit, reading, seen))
  const people = new Set<PersonId>()
  for (const unit of walk(built)) {
    for (const slot of unit.slots) for (const holder of slot.holders) people.add(holder.person)
    for (const other of unit.others) people.add(other.person)
  }
  return { roots: built, units: seen.size, people: people.size }
}

/** Every unit of a chart, depth first, in the chart's order. */
export function* walk(units: readonly ChartUnit[]): Generator<ChartUnit> {
  for (const unit of units) {
    yield unit
    yield* walk(unit.children)
  }
}

/**
 * The units of a chart in which a person holds a role on its day, in the
 * chart's order — what *Find me* goes to. `person` is the entry that answers
 * for them, as the chart's holders are.
 */
export function unitsHolding(chart: OrgChart, person: PersonId): ElementId[] {
  const found: ElementId[] = []
  for (const unit of walk(chart.roots)) {
    const holds = unit.slots.some((slot) => slot.holders.some((holder) => holder.person === person))
      || unit.others.some((other) => other.person === person)
    if (holds) found.push(unit.id)
  }
  return found
}

/**
 * The units drawn: those the chart is of, and every unit below them, that are
 * there on the day or that have ended with somebody still assigned to them.
 */
function shownUnits(organisation: Organisation, day: string, options: ChartOptions): Set<ElementId> {
  const units = organisation.units.filter(isUnit)
  const seeds = options.root !== undefined
    ? units.filter((unit) => unit.id === options.root)
    : units.filter((unit) => options.include?.(unit) ?? true)
  const chosen = new Set<ElementId>()
  for (const seed of seeds) {
    chosen.add(seed.id)
    for (const below of unitsBelow(units, seed.id)) chosen.add(below)
  }
  const peopled = new Set(organisation.assignments.filter((one) => runsOn(one, day)).map((one) => one.unitId))
  return new Set(units
    .filter((unit) => chosen.has(unit.id) && (unitOn(unit, day) || (unitEnded(unit, day) && peopled.has(unit.id))))
    .map((unit) => unit.id))
}

/**
 * The drawn units as a tree: each under the nearest unit above it that is
 * drawn too, and at the top where none is. Siblings in the order every list
 * of units reads, which ends in the name and then the id, so the same
 * organisation is the same chart whatever order it was read in.
 */
function treeOf(
  all: readonly UnitLike[], shown: ReadonlySet<ElementId>, inOrder: (a: UnitLike, b: UnitLike) => number,
): { roots: UnitLike[]; children: Map<ElementId, UnitLike[]> } {
  const units = all.filter((unit) => isUnit(unit) && shown.has(unit.id))
  const children = new Map<ElementId, UnitLike[]>()
  const roots: UnitLike[] = []
  for (const unit of units) {
    const parent = unitsAbove(all, unit.id).find((id) => shown.has(id))
    if (parent === undefined) roots.push(unit)
    else children.set(parent, [...children.get(parent) ?? [], unit])
  }
  // A loop the plans' moves make leaves its units under each other and none at
  // the top: the first of them in order is drawn at the top instead, and the
  // rest under it, so no unit drops out of the chart.
  const reached = new Set<ElementId>()
  const reach = (unit: UnitLike) => {
    if (reached.has(unit.id)) return
    reached.add(unit.id)
    for (const child of children.get(unit.id) ?? []) reach(child)
  }
  roots.forEach(reach)
  for (const unit of [...units].sort(inOrder)) {
    if (reached.has(unit.id)) continue
    for (const [parent, list] of children) children.set(parent, list.filter((one) => one.id !== unit.id))
    roots.push(unit)
    reach(unit)
  }
  for (const list of children.values()) list.sort(inOrder)
  return { roots: roots.sort(inOrder), children }
}

/** How much of each person's time their assignments take on the day, across the whole organisation. */
function loadsOn(assignments: readonly Assignment[], day: string, canonical: (id: PersonId) => PersonId): Map<PersonId, number> {
  const loads = new Map<PersonId, number>()
  for (const assignment of assignments) {
    if (!runsOn(assignment, day)) continue
    const who = canonical(personOf(assignment))
    loads.set(who, (loads.get(who) ?? 0) + shareOf(assignment))
  }
  return loads
}

/** One unit's box, and the boxes under it. A unit met twice — a loop in the tree — is drawn once. */
function chartUnit(unit: UnitLike, reading: Reading, seen: Set<ElementId>): ChartUnit {
  seen.add(unit.id)
  const type = reading.types.get(unit.unitTypeId ?? '')
  const typeRoles = new Set((type?.slots ?? []).map((slot) => slot.role))
  // A unit type that has ended asks for nobody, as a role that has ended does.
  const slots = (type && !unitTypeOn(type, reading.day) ? [] : slotsOf(unit, type))
    .filter((slot) => {
      const role = reading.roles.get(slot.role)
      return role !== undefined && roleOn(role, reading.day)
    })
    .map((slot): ChartSlot => {
      const holders = holdersOn(reading.organisation.assignments, unit.id, slot.role, reading.day).map((one) => holderOf(one, reading))
      return {
        roleId: slot.role,
        min: slot.min,
        ...(slot.max !== undefined ? { max: slot.max } : {}),
        holders,
        vacant: Math.max(0, slot.min - holders.length),
        room: slot.max === undefined || holders.length < slot.max,
        extra: !typeRoles.has(slot.role),
      }
    })
  const inSlots = new Set(slots.map((slot) => slot.roleId))
  const others = reading.organisation.assignments
    .filter((one) => one.unitId === unit.id && !inSlots.has(one.roleId) && runsOn(one, reading.day))
    .map((one): ChartOther => {
      const role = reading.roles.get(one.roleId)
      return { ...holderOf(one, reading), endedRole: role !== undefined && isDay(role.until) && reading.day > role.until }
    })
  const children = (reading.children.get(unit.id) ?? [])
    .filter((child) => !seen.has(child.id))
    .map((child) => chartUnit(child, reading, seen))
  const begins = unit.lifecycleDates?.live
  const ends = unitLastDay(unit)
  return {
    id: unit.id,
    name: unit.name,
    ...(unit.unitTypeId !== undefined ? { unitTypeId: unit.unitTypeId } : {}),
    serves: unit.scopes ?? [],
    slots,
    others,
    children,
    ended: unitEnded(unit, reading.day),
    ...(isDay(begins) ? { begins } : {}),
    ...(ends !== undefined ? { ends } : {}),
  }
}

function holderOf(assignment: Assignment, reading: Reading): ChartHolder {
  const person = reading.canonical(personOf(assignment))
  return { assignment, person, share: shareOf(assignment), overloaded: overAllOfTheirTime(reading.loads.get(person) ?? 0) }
}
