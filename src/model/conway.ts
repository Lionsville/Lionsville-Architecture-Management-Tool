// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Conway map on a day (ADR-0036 §7): the units over the applications
 * they own, the interfaces between those applications, and what the two say
 * about each other.
 *
 * **Two kinds of communication, held against each other.** An interface
 * between two applications (a `flow`) is communication the systems need. An
 * `interacts` row between two units is communication the organisation has
 * declared, in one of Team Topologies' three modes. An interface that crosses
 * from one unit's applications to another's, with nothing declared between
 * the units, is a finding; so is an interaction that no interface needs, an
 * application nobody owns, and a unit that owns more than its type's limit.
 *
 * **Nothing entered twice.** Who owns an application is its `partyId`; the
 * units are actors with a type; the interfaces are the rows the landscapes
 * already draw. An interaction declared between two units covers the units
 * under them too: a cluster that works with a platform team covers each of
 * its teams' interfaces to that team's applications.
 *
 * **On a day.** Each unit sits under the parent the plans' moves give it that
 * day (`organisationOn`, §6); a unit not there owns nothing; an interface and
 * an interaction hold for their own days.
 *
 * **It only reads.** It never moves an application or a unit; an answer to a
 * finding is a row written, an owner set or a limit changed, each where it is
 * kept. Pure, with no words: the page names the units and says the findings.
 */
import { relationLiveAt } from './lifecycle'
import type { UnitType, UnitTypeId } from './operatingModel'
import type { ElementId, InteractionMode, Relation } from './types'
import { isUnit, organisationOn, unitOn, unitsAbove } from './units'
import type { UnitLike, UnitMove } from './units'

/** An application as the map reads it: who owns it, if anybody says. */
export type ConwayApplication = { id: ElementId; name: string; partyId?: ElementId }

/** An interface, or an interaction: two ends and the days the row holds. */
export type ConwayRow = Pick<Relation, 'id' | 'sourceId' | 'targetId' | 'validFrom' | 'validUntil'>

/** A declared interaction between two units, with its mode where it names one. */
export type ConwayInteraction = ConwayRow & { mode?: InteractionMode }

export type ConwayInput = {
  /** Every unit of the organisation: the owners, and the units above them that a map may group by. */
  units: readonly UnitLike[]
  /** The plans' moves (§6): on the day, each unit sits under the parent they give it then. */
  moves?: readonly UnitMove[]
  unitTypes: readonly Pick<UnitType, 'id' | 'limit'>[]
  /** The applications the map is of. */
  applications: readonly ConwayApplication[]
  /** The interfaces between them; a row with an end that is not one of them is passed over. */
  flows: readonly ConwayRow[]
  /** Every declared interaction; one with an end that is not a unit is passed over. */
  interactions: readonly ConwayInteraction[]
  /**
   * How many applications name a unit as theirs across the organisation —
   * what a type's limit is held to. Absent: those handed in.
   */
  owns?: (unitId: ElementId) => number
}

export type ConwayOptions = {
  /**
   * Group the applications by the unit of this type above their owner — a
   * cluster, a domain — rather than by the owner itself. An owner with no
   * unit of the type above it is grouped under the top of its tree.
   */
  groupBy?: UnitTypeId
}

/** One column of the map: a unit, or the applications nobody owns. */
export type ConwayGroup = {
  /** The unit, or the party that owns them; absent for the applications nobody owns. */
  unitId?: ElementId
  applications: ConwayApplication[]
}

/**
 * How an interface lies on the map: inside one group, across two with an
 * interaction declared between their units, across two with none, or with an
 * end nobody owns.
 */
export type LineStatus = 'inside' | 'declared' | 'undeclared' | 'unowned'

export type ConwayLine = {
  flow: ConwayRow
  /** The groups it runs from and to: a unit's id, or absent for nobody's. */
  from?: ElementId
  to?: ElementId
  status: LineStatus
  /** The interaction that covers it, where one does. */
  interaction?: ConwayInteraction
}

export type ConwayFinding =
  /** An interface between two groups' applications, with no interaction declared between their units. */
  | { kind: 'undeclared'; flow: ConwayRow; from: ElementId; to: ElementId }
  /** An interaction that no interface between the two units' applications needs. */
  | { kind: 'unused'; interaction: ConwayInteraction }
  /** An application nobody owns on the day. */
  | { kind: 'unowned'; applicationId: ElementId }
  /** A unit owning more applications than its type's limit. */
  | { kind: 'overLimit'; unitId: ElementId; owns: number; limit: number }

export type ConwayMap = {
  groups: ConwayGroup[]
  lines: ConwayLine[]
  /** The interactions that hold on the day, between units that are there. */
  interactions: ConwayInteraction[]
  findings: ConwayFinding[]
}

/** What the map works out once and every line asks. */
type Reading = {
  units: ReadonlyMap<ElementId, UnitLike>
  /** Each application's owner on the day, or absent for nobody. */
  owner: ReadonlyMap<ElementId, ElementId | undefined>
  group: ReadonlyMap<ElementId, ElementId | undefined>
  /** A unit and the units above it, nearest first. */
  chain: (unitId: ElementId) => readonly ElementId[]
  live: ConwayInteraction[]
}

/** The Conway map on `day`. */
export function conwayMap(input: ConwayInput, day: string, options: ConwayOptions = {}): ConwayMap {
  const reading = readingOf(input, day, options)
  const apps = new Set(input.applications.map((app) => app.id))
  const lines = input.flows
    .filter((flow) => apps.has(flow.sourceId) && apps.has(flow.targetId) && flow.sourceId !== flow.targetId && relationLiveAt(flow, day))
    .map((flow) => lineOf(flow, reading))
  const findings: ConwayFinding[] = [
    ...lines.flatMap((line): ConwayFinding[] => (
      line.status === 'undeclared' && line.from !== undefined && line.to !== undefined
        ? [{ kind: 'undeclared', flow: line.flow, from: line.from, to: line.to }]
        : [])),
    ...unused(lines, reading),
    ...input.applications.filter((app) => reading.owner.get(app.id) === undefined)
      .map((app): ConwayFinding => ({ kind: 'unowned', applicationId: app.id })),
    ...overLimit(input, reading, day),
  ]
  return { groups: groupsOf(input.applications, reading), lines, interactions: reading.live, findings }
}

function readingOf(input: ConwayInput, day: string, options: ConwayOptions): Reading {
  const tree = organisationOn({ units: input.units, assignments: [], roles: [], unitTypes: [], ...(input.moves ? { moves: input.moves } : {}) }, day).units
  const units = new Map(tree.filter(isUnit).map((unit) => [unit.id, unit]))
  const chains = new Map<ElementId, readonly ElementId[]>()
  const chain = (unitId: ElementId) => {
    const held = chains.get(unitId)
    if (held) return held
    const made = [unitId, ...unitsAbove(tree, unitId)]
    chains.set(unitId, made)
    return made
  }
  const owner = new Map<ElementId, ElementId | undefined>()
  const group = new Map<ElementId, ElementId | undefined>()
  for (const app of input.applications) {
    const party = app.partyId
    // A unit that is not there on the day owns nothing that day; a party
    // that is not a unit at all — an actor with no type — still owns.
    const owns = party !== undefined && (!units.has(party) || unitOn(units.get(party)!, day)) ? party : undefined
    owner.set(app.id, owns)
    group.set(app.id, owns === undefined ? undefined : groupOf(owns, chain, units, options.groupBy))
  }
  const live = input.interactions.filter((row) => {
    const source = units.get(row.sourceId)
    const target = units.get(row.targetId)
    return source !== undefined && target !== undefined && row.sourceId !== row.targetId
      && unitOn(source, day) && unitOn(target, day) && relationLiveAt(row, day)
  })
  return { units, owner, group, chain, live }
}

/** The group an owner's applications go in: itself, or the unit of the type asked for above it. */
function groupOf(
  owner: ElementId, chain: (id: ElementId) => readonly ElementId[], units: ReadonlyMap<ElementId, UnitLike>, groupBy: UnitTypeId | undefined,
): ElementId {
  if (groupBy === undefined || !units.has(owner)) return owner
  const above = chain(owner)
  return above.find((id) => units.get(id)?.unitTypeId === groupBy) ?? above[above.length - 1] ?? owner
}

/** Whether an interaction is declared between two owners: between them, or between units above each. */
function covers(row: ConwayInteraction, a: ElementId, b: ElementId, reading: Reading): boolean {
  const left = reading.chain(a)
  const right = reading.chain(b)
  return (left.includes(row.sourceId) && right.includes(row.targetId))
    || (left.includes(row.targetId) && right.includes(row.sourceId))
}

function lineOf(flow: ConwayRow, reading: Reading): ConwayLine {
  const from = reading.group.get(flow.sourceId)
  const to = reading.group.get(flow.targetId)
  const ends = { flow, ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}) }
  const a = reading.owner.get(flow.sourceId)
  const b = reading.owner.get(flow.targetId)
  if (a === undefined || b === undefined) return { ...ends, status: 'unowned' }
  if (from === to) return { ...ends, status: 'inside' }
  const interaction = reading.live.find((row) => covers(row, a, b, reading))
  return interaction ? { ...ends, status: 'declared', interaction } : { ...ends, status: 'undeclared' }
}

/** The interactions no interface between two owners' applications needs, on the day. */
function unused(lines: readonly ConwayLine[], reading: Reading): ConwayFinding[] {
  const crossing = lines.flatMap((line) => {
    const a = reading.owner.get(line.flow.sourceId)
    const b = reading.owner.get(line.flow.targetId)
    return a !== undefined && b !== undefined && a !== b ? [[a, b] as const] : []
  })
  return reading.live
    .filter((row) => !crossing.some(([a, b]) => covers(row, a, b, reading)))
    .map((interaction): ConwayFinding => ({ kind: 'unused', interaction }))
}

/** The units owning an application here that own more, across the organisation, than their type allows. */
function overLimit(input: ConwayInput, reading: Reading, day: string): ConwayFinding[] {
  const limits = new Map(input.unitTypes.map((type) => [type.id, type.limit]))
  const owners = [...new Set([...reading.owner.values()].filter((id): id is ElementId => id !== undefined))]
  const found: ConwayFinding[] = []
  for (const unitId of owners) {
    const unit = reading.units.get(unitId)
    const limit = limits.get(unit?.unitTypeId ?? '')
    if (!unit || limit === undefined || !unitOn(unit, day)) continue
    const owns = input.owns?.(unitId) ?? input.applications.filter((app) => app.partyId === unitId).length
    if (owns > limit) found.push({ kind: 'overLimit', unitId, owns, limit })
  }
  return found
}

/**
 * The columns: each group's applications by name, the groups in the units'
 * tree order — depth first, siblings by name — a party that is not a unit
 * after the units, and the applications nobody owns last.
 */
function groupsOf(applications: readonly ConwayApplication[], reading: Reading): ConwayGroup[] {
  const byGroup = new Map<ElementId | undefined, ConwayApplication[]>()
  for (const app of applications) {
    const key = reading.group.get(app.id)
    byGroup.set(key, [...byGroup.get(key) ?? [], app])
  }
  const order = treeOrder([...reading.units.values()])
  const rank = (key: ElementId | undefined) => (key === undefined ? Number.MAX_SAFE_INTEGER : order.get(key) ?? order.size)
  return [...byGroup.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || String(a).localeCompare(String(b)))
    .map(([unitId, applications]) => ({
      ...(unitId !== undefined ? { unitId } : {}),
      applications: [...applications].sort((x, y) => x.name.localeCompare(y.name) || x.id.localeCompare(y.id)),
    }))
}

/** Each unit's place in a depth-first walk of the tree, siblings by name. */
function treeOrder(units: readonly UnitLike[]): Map<ElementId, number> {
  const ids = new Set(units.map((unit) => unit.id))
  const children = new Map<ElementId | undefined, UnitLike[]>()
  for (const unit of units) {
    const parent = unit.parentId !== undefined && ids.has(unit.parentId) ? unit.parentId : undefined
    children.set(parent, [...children.get(parent) ?? [], unit])
  }
  const order = new Map<ElementId, number>()
  const visit = (parent: ElementId | undefined) => {
    for (const unit of [...children.get(parent) ?? []].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))) {
      if (order.has(unit.id)) continue
      order.set(unit.id, order.size)
      visit(unit.id)
    }
  }
  visit(undefined)
  return order
}
