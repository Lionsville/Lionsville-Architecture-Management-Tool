// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where each unit type stands in the organisation's structure, and the order
 * units are listed in because of it (ADR-0036, as built for 3.6.1).
 *
 * **Lanes.** The organisation itself is lane 0. A type that may sit at the
 * top (`top`) is in lane 1 at least, and a type's lane is the *longest* path
 * from the organisation through `within`: a type that may sit at the top and
 * also in a lane-1 type is in lane 2, below the deepest place it may be put,
 * so every line to a type comes down from a lane above it. Longest rather
 * than shortest because the structure reads downwards — a team that may also
 * report straight to the organisation is still a team, not a peer of the
 * departments.
 *
 * **A loop is cut, never followed.** `within` may say A in B and B in A, or a
 * type in itself (a department of departments); the writer refuses none of
 * it (`model/commands/operatingModel.ts`). A walk from the organisation, in
 * the lanes' own order, cuts the line where it meets a type it is still
 * inside — so the same model draws the same lanes whatever order its lists
 * were read in, and nothing hangs.
 *
 * **Sitting nowhere.** A type no walk from the organisation reaches — not at
 * the top, and in no type that is anywhere — has no lane: every unit made of
 * it would sit where its type may not (`check.unitMisplaced`), which is a
 * finding of its own (`check.unitTypeNowhere`, `projects/checks.ts`).
 *
 * **Order.** Within a lane, the type's `order` — the organisation's decision,
 * low first, absent after present — then its name, then its id. One total
 * order over every type follows (`unitTypeRank`), and units are listed by it
 * (`compareUnits`): their type's rank, their own `order` among siblings, then
 * name — the chart, the outline, the Conway columns and the pickers alike.
 *
 * Pure, and no words.
 */
import type { UnitType, UnitTypeId } from './operatingModel'
import type { ElementId } from './types'
import { isUnit } from './units'
import type { UnitLike } from './units'

/** One lane of the structure: its number, from 1, and its types in order. */
export type UnitTypeLane = {
  readonly lane: number
  readonly types: readonly UnitType[]
}

/**
 * One place a type may sit: in another type, or — `sitsIn` absent — at the
 * top, under the organisation itself. `loop` marks a line the walk cut to
 * break a loop, which runs up the lanes or back to the type itself.
 */
export type SitsIn = {
  readonly type: UnitTypeId
  readonly sitsIn?: UnitTypeId
  readonly loop?: true
}

export type UnitTypeLanes = {
  /** Lane 1 first, and none empty: a type in lane *n* sits in one in lane *n − 1*. */
  readonly lanes: readonly UnitTypeLane[]
  /** Each type's lane, by id; a type that sits nowhere has none. */
  readonly laneOf: ReadonlyMap<UnitTypeId, number>
  /** The types that sit nowhere, in order. */
  readonly nowhere: readonly UnitType[]
  /**
   * Every place every type may sit, for the lines between lanes: type by type
   * in order, each at the top first and then in the types its `within` names,
   * in that order. A `within` naming a type the model does not hold is not one.
   */
  readonly sitsIn: readonly SitsIn[]
}

/** An `order` worth reading: a number, and a finite one. */
function orderOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Two orders, low first, a said one before an unsaid one. */
function byOrder(a: unknown, b: unknown): number {
  const left = orderOf(a)
  const right = orderOf(b)
  if (left === right) return 0
  if (left === undefined) return 1
  if (right === undefined) return -1
  return left - right
}

/** Types as a lane lists them: `order`, then name, then id. */
function byOrderThenName(a: UnitType, b: UnitType): number {
  return byOrder(a.order, b.order) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
}

/** The organisation, as the key of what may sit directly under it: no id a type is given starts with a NUL. */
const TOP = '\u0000organisation'

/** The lanes of the operating model's unit types. */
export function unitTypeLanes(types: readonly UnitType[]): UnitTypeLanes {
  const held = new Map(types.map((type) => [type.id, type]))
  const sorted = [...held.values()].sort(byOrderThenName)
  // What may sit directly in each type, and at the top, in the lanes' order.
  const under = new Map<string, UnitType[]>()
  const sitsIn: { type: UnitTypeId; sitsIn?: UnitTypeId }[] = []
  for (const type of sorted) {
    const places = [...(type.top === true ? [TOP] : []), ...new Set(type.within.filter((id) => held.has(id)))]
    for (const place of places) {
      under.set(place, [...under.get(place) ?? [], type])
      sitsIn.push(place === TOP ? { type: type.id } : { type: type.id, sitsIn: place })
    }
  }
  const { finished, cut } = walkFromTop(under)
  // The finishing order reversed puts every place before what sits in it, once the cut lines are gone.
  const lane = new Map<string, number>([[TOP, 0]])
  for (const place of [...finished, TOP].reverse()) {
    for (const type of under.get(place) ?? []) {
      if (cut.has(lineKey(place, type.id))) continue
      lane.set(type.id, Math.max(lane.get(type.id) ?? 0, (lane.get(place) ?? 0) + 1))
    }
  }
  lane.delete(TOP)
  const lanes: UnitType[][] = []
  for (const type of sorted) {
    const at = lane.get(type.id)
    if (at !== undefined) (lanes[at - 1] ??= []).push(type)
  }
  return {
    lanes: lanes.map((list, index) => ({ lane: index + 1, types: list })),
    laneOf: lane,
    nowhere: sorted.filter((type) => !lane.has(type.id)),
    sitsIn: sitsIn.map((one) => (cut.has(lineKey(one.sitsIn ?? TOP, one.type)) ? { ...one, loop: true as const } : one)),
  }
}

function lineKey(place: string, type: UnitTypeId): string {
  return `${place}\u0000${type}`
}

/**
 * A depth-first walk from the organisation down what may sit in what: every
 * type it reaches, in the order it finished with them, and the lines it cut
 * where a type led back to one it was still inside.
 */
function walkFromTop(under: ReadonlyMap<string, readonly UnitType[]>): { finished: UnitTypeId[]; cut: Set<string> } {
  const inside = new Set<UnitTypeId>()
  const done = new Set<UnitTypeId>()
  const finished: UnitTypeId[] = []
  const cut = new Set<string>()
  const visit = (place: string) => {
    for (const type of under.get(place) ?? []) {
      if (inside.has(type.id)) cut.add(lineKey(place, type.id))
      if (inside.has(type.id) || done.has(type.id)) continue
      inside.add(type.id)
      visit(type.id)
      inside.delete(type.id)
      done.add(type.id)
      finished.push(type.id)
    }
  }
  visit(TOP)
  return { finished, cut }
}

/** Every type's place in one order — a lookup a comparator reads, low first. */
export type UnitTypeRank = ReadonlyMap<UnitTypeId, number>

/**
 * One total order over the unit types: by lane, then `order`, then name, and
 * the types that sit nowhere last, in the same order among themselves.
 */
export function unitTypeRank(types: readonly UnitType[]): UnitTypeRank {
  const { lanes, nowhere } = unitTypeLanes(types)
  return new Map([...lanes.flatMap((lane) => lane.types), ...nowhere].map((type, index) => [type.id, index]))
}

/** As much of a unit as its place in a list reads. */
export type RankedUnit = Pick<UnitLike, 'id' | 'name' | 'unitTypeId' | 'order'>

/**
 * Units as every list of them reads (3.6.1): their type's rank, then their
 * own `order` among siblings — the one the business tree reads, absent after
 * present — then name, then id, so the same organisation lists the same way
 * whatever order it was read in. A unit with no type, or one the model does
 * not hold, comes after every typed one.
 */
export function compareUnits(rank: UnitTypeRank): (a: RankedUnit, b: RankedUnit) => number {
  const rankOf = (unit: RankedUnit) => rank.get(unit.unitTypeId ?? '') ?? rank.size
  return (a, b) => rankOf(a) - rankOf(b) || byOrder(a.order, b.order) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
}

/** A row the move writes: a unit's new `order`. */
export type OrderRow = { readonly id: ElementId; readonly order: number }

/**
 * A unit moved to place `to` (from 0) among its siblings of the same type —
 * the units under the same parent, of the same type — as the rows to write:
 * the whole of that list renumbered from 1 in its new order, only where a
 * number changes, as the business tree's own move renumbers a row
 * (`business/moveAmongSiblings`). Units of another type keep their places,
 * since the type's rank orders them first.
 *
 * `units` is the organisation as the list shows it — on a day, the parents
 * that day's moves give (`organisationOn`). Siblings may be filed in
 * different scopes, so each row is an `element.update` of `order` in the
 * scope that keeps that unit. Empty where the unit is unknown or the place is
 * the one it has.
 */
export function unitMovedTo(units: readonly UnitLike[], id: ElementId, to: number): OrderRow[] {
  const unit = units.find((one) => one.id === id && isUnit(one))
  if (!unit) return []
  // One type, so no rank to read: `order`, then name.
  const siblings = units
    .filter((one) => isUnit(one) && one.parentId === unit.parentId && one.unitTypeId === unit.unitTypeId)
    .sort(compareUnits(new Map()))
  return renumbered(siblings, siblings.indexOf(unit), to)
}

/**
 * A list with one item moved from `at` to `to`, renumbered from 1: the rows
 * whose number changes. `to` is held to the list's ends.
 */
export function renumbered<T extends { readonly id: string; readonly order?: number }>(
  list: readonly T[], at: number, to: number,
): { id: T['id']; order: number }[] {
  if (at < 0 || at >= list.length) return []
  const place = Math.max(0, Math.min(list.length - 1, Math.trunc(to)))
  if (place === at) return []
  const moved = [...list]
  moved.splice(place, 0, ...moved.splice(at, 1))
  return moved
    .map((item, index) => ({ id: item.id, order: index + 1, was: item.order }))
    .filter((row) => row.was !== row.order)
    .map(({ id, order }) => ({ id, order }))
}
