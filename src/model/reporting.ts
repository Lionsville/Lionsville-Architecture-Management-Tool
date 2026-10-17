// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Reporting lines, checked (ADR-0039 §5, §6): what the lines contradict on a
 * day, and whether a line about to be written would close a loop.
 *
 * **A loop** is a chain of managers that comes back to where it started. The
 * holders of a role are managed by the holders of the role their solid line
 * lands on, or — with no line — by the holders of a managing role in their
 * unit or above it; so a chain runs through lines and nesting alike, and one
 * that returns has a line in it, because the tree alone never does. A write
 * that would close one on the day it is written, or on the line's first day,
 * is refused where it is made (the screens, the agent); one that time makes —
 * a plan's move, a line that starts later — is a finding, found on the first
 * day it is there.
 *
 * **The findings**: a loop; a line no unit can take (`dangling`); a line
 * several units could take with none above (`ambiguous`); a line that lands
 * on a role nobody holds that day (`vacant`). A holder's own line (ADR-0039,
 * amended 17 October 2026) is read for each as the model's lines are: its
 * holder is managed along it, so a chain through it is a loop like any other.
 *
 * Pure, with no words: `projects/checks.ts` says them, and the agent and the
 * screens ask {@link loopMadeBy} before they write.
 */
import { isDay } from './lifecycle'
import { linesSaid } from './operatingModel'
import type { ReportsToSaid, RoleId, RoleSlot, UnitTypeId } from './operatingModel'
import type { ElementId, UnitReportingLine } from './types'
import {
  everyLineOn, holdersAt, isUnit, lineDecides, organisationOn, personOf, positionKey, roleOn, runsOn, slotsOf, unitOn, unitsAbove,
} from './units'
import type { Assignment, AssignmentId, AssignmentReportingLine, LinePosition, Organisation, ReportingLineOn, UnitLike } from './units'

/** One thing the reporting lines contradict on a day. */
export type ReportingFinding =
  | { kind: 'loop'; chain: LinePosition[]; day: string }
  | { kind: 'dangling'; line: ReportingLineOn }
  | { kind: 'ambiguous'; line: ReportingLineOn }
  | { kind: 'vacant'; line: ReportingLineOn }

/**
 * Every chain of managers that comes back to where it started on `day`, each
 * once, as the roles in units it runs through in order, starting from the
 * first role in the organisation's order that a solid line runs from.
 */
export function reportingLoops(organisation: Organisation, day: string): LinePosition[][] {
  const lines = everyLineOn(organisation, day)
  if (!lines.some((line) => line.kind === 'solid' && line.state === 'lands')) return []
  const graph = managerGraph(organisationOn(organisation, day), day, lines)
  const loops: LinePosition[][] = []
  for (const component of strongComponents(graph.next)) {
    const single = component.length === 1 && !(graph.next.get(component[0]) ?? []).includes(component[0])
    if (single) continue
    const inside = new Set(component)
    const start = graph.order.find((key) => inside.has(key) && graph.lineFrom.has(key)) ?? component[0]
    loops.push(cycleFrom(start, graph.next, inside).map((key) => graph.position.get(key)!))
  }
  return loops
}

/**
 * The roles in units and who manages each: a solid line's target, else the
 * managing roles of the unit and the units above — and the target of every
 * holder's own solid line there besides, since a chain that comes back to a
 * role in a unit comes back to each of its holders. A line to one person
 * (ADR-0039, amended 17 October 2026) lands on a node of that holder's own,
 * managed along their own line where they have one, else as their role there.
 */
function managerGraph(on: Organisation, day: string, lines: readonly ReportingLineOn[]) {
  const managing = new Set(on.roles.filter((role) => role.manages === true && roleOn(role, day)).map((role) => role.id))
  const there = new Map(on.units.filter((unit) => isUnit(unit) && unitOn(unit, day)).map((unit) => [unit.id, unit]))
  const roleIds = rolesHeldIn(on, day, there.values())
  const { lineFrom, ownFrom, ownBy } = solidFrom(on, day, lines)
  const keyOf = (at: LinePosition) => positionKey(at.unitId, at.roleId, at.person)
  const position = new Map<string, LinePosition>()
  const order: string[] = []
  const next = new Map<string, string[]>()
  const add = (at: LinePosition) => {
    const key = keyOf(at)
    if (!position.has(key)) { position.set(key, at); order.push(key) }
    return key
  }
  for (const unit of there.values()) for (const roleId of roleIds.get(unit.id) ?? []) add({ unitId: unit.id, roleId })
  for (const line of lines) if (lineDecides(on.assignments, line, day)) { add({ unitId: line.unitId, roleId: line.roleId }); add(line.to) }
  const defaults = (at: LinePosition): string[] => {
    const target = lineFrom.get(positionKey(at.unitId, at.roleId))
    if (target) return [keyOf(target)]
    const up = [...(managing.has(at.roleId) ? [] : [at.unitId]), ...unitsAbove(on.units, at.unitId)]
    return up.filter((id) => there.has(id)).flatMap((id) => (roleIds.get(id) ?? [])
      .filter((role) => managing.has(role)).map((role) => positionKey(id, role)))
      .filter((one) => position.has(one))
  }
  for (const key of [...order]) {
    const at = position.get(key)!
    const own = at.person === undefined ? ownFrom.get(key) : ownBy.get(key)
    if (at.person !== undefined) next.set(key, own ? own.map(keyOf) : defaults(at))
    else next.set(key, [...new Set([...defaults(at), ...(own ?? []).map(keyOf)])])
  }
  // A loop is said from the first role a solid line runs from, a holder's own included.
  for (const [key, to] of ownFrom) if (!lineFrom.has(key)) lineFrom.set(key, to[0])
  return { position, order, next, lineFrom }
}

/** The roles each unit there has on `day`: its slots' that run, then any role held there outside them, whose holders manage and are managed there too. */
function rolesHeldIn(on: Organisation, day: string, there: Iterable<UnitLike>): Map<ElementId, RoleId[]> {
  const types = new Map(on.unitTypes.map((type) => [type.id, type]))
  const running = new Set(on.roles.filter((role) => roleOn(role, day)).map((role) => role.id))
  const roleIds = new Map<ElementId, RoleId[]>()
  for (const unit of there) {
    roleIds.set(unit.id, slotsOf(unit, types.get(unit.unitTypeId ?? '')).map((slot) => slot.role).filter((role) => running.has(role)))
  }
  for (const one of on.assignments) {
    const held = roleIds.get(one.unitId)
    if (held && running.has(one.roleId) && runsOn(one, day) && !held.includes(one.roleId)) held.push(one.roleId)
  }
  return roleIds
}

/**
 * The solid lines that decide who manages, by the role in the unit they run
 * from: the role's there; the targets of its holders' own; and those again by
 * the one holder whose own they are, for a line that lands on that person.
 */
function solidFrom(on: Organisation, day: string, lines: readonly ReportingLineOn[]) {
  const lineFrom = new Map<string, LinePosition>()
  const ownFrom = new Map<string, LinePosition[]>()
  const ownBy = new Map<string, LinePosition[]>()
  const byId = new Map(on.assignments.map((one) => [one.id, one]))
  for (const line of lines) {
    if (!lineDecides(on.assignments, line, day)) continue
    const key = positionKey(line.unitId, line.roleId)
    if (line.assignmentId === undefined) { lineFrom.set(key, line.to); continue }
    ownFrom.set(key, [...ownFrom.get(key) ?? [], line.to])
    const holder = byId.get(line.assignmentId)
    if (holder) {
      const mine = positionKey(line.unitId, line.roleId, personOf(holder))
      ownBy.set(mine, [...ownBy.get(mine) ?? [], line.to])
    }
  }
  return { lineFrom, ownFrom, ownBy }
}

/** The strongly connected parts of a graph (Tarjan), each in the order met. */
function strongComponents(next: ReadonlyMap<string, readonly string[]>): string[][] {
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const found: string[][] = []
  let counter = 0
  const visit = (node: string) => {
    index.set(node, counter)
    low.set(node, counter)
    counter += 1
    stack.push(node)
    onStack.add(node)
    for (const to of next.get(node) ?? []) {
      if (!index.has(to)) { visit(to); low.set(node, Math.min(low.get(node)!, low.get(to)!)) }
      else if (onStack.has(to)) low.set(node, Math.min(low.get(node)!, index.get(to)!))
    }
    if (low.get(node) !== index.get(node)) return
    const component: string[] = []
    for (let top = stack.pop(); top !== undefined; top = stack.pop()) {
      onStack.delete(top)
      component.push(top)
      if (top === node) break
    }
    found.push(component.reverse())
  }
  for (const node of next.keys()) if (!index.has(node)) visit(node)
  return found
}

/** A path from `start` back to it, inside one strongly connected part. */
function cycleFrom(start: string, next: ReadonlyMap<string, readonly string[]>, inside: ReadonlySet<string>): string[] {
  const back = new Map<string, string>()
  const queue = [start]
  for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
    for (const to of next.get(at) ?? []) {
      if (!inside.has(to)) continue
      if (to === start) {
        const path = [at]
        for (let step = back.get(at); step !== undefined; step = back.get(step)) path.push(step)
        return path.reverse()
      }
      if (!back.has(to) && to !== start) { back.set(to, at); queue.push(to) }
    }
  }
  return [start]
}

/** One key for a chain, whichever role in it is read first. */
export function chainKey(chain: readonly LinePosition[]): string {
  return chain.map((at) => positionKey(at.unitId, at.roleId, at.person)).sort().join('\u0001')
}

/**
 * The days on or after `day` where a loop may first appear: the day itself,
 * and every later day a line starts or a plan moves a unit.
 */
function daysFrom(organisation: Organisation, day: string): string[] {
  const later = new Set<string>()
  const add = (one: string | undefined) => { if (isDay(one) && one > day) later.add(one) }
  for (const role of organisation.roles) for (const line of linesSaid(role.reportsTo)) add(line.from)
  for (const type of organisation.unitTypes) for (const slot of type.slots) for (const line of linesSaid(slot.reportsTo)) add(line.from)
  for (const unit of organisation.units) for (const line of unit.reportingLines ?? []) add(line.from)
  for (const one of organisation.assignments) {
    if (!one.reportsTo?.length) continue
    add(one.from)
    for (const line of one.reportsTo) add(line.from)
  }
  for (const move of organisation.moves ?? []) add(move.on)
  return [day, ...[...later].sort()]
}

/**
 * Every finding of the reporting lines on `day` (ADR-0039 §6): the loops
 * there that day or on a later day a line starts or a unit moves, each once
 * with the first day it is there; then line by line — the roles' in units,
 * then the holders' own — a line that lands nowhere, one several units could
 * take, and one on a role nobody holds.
 */
export function reportingFindings(organisation: Organisation, day: string): ReportingFinding[] {
  const lines = everyLineOn(organisation, day)
  const found: ReportingFinding[] = []
  const seen = new Set<string>()
  for (const at of daysFrom(organisation, day)) {
    for (const chain of reportingLoops(organisation, at)) {
      const key = chainKey(chain)
      if (seen.has(key)) continue
      seen.add(key)
      found.push({ kind: 'loop', chain, day: at })
    }
  }
  const on = organisationOn(organisation, day)
  for (const line of lines) {
    if (line.state === 'dangling') found.push({ kind: 'dangling', line })
    else if (line.state === 'ambiguous') found.push({ kind: 'ambiguous', line })
    else if (line.state === 'lands' && line.to && holdersAt(on.assignments, line.to, day).length === 0) {
      found.push({ kind: 'vacant', line })
    }
  }
  return found
}

// --- a line written ------------------------------------------------------------------------

/** Why a line is refused where it is written (ADR-0039 §5): to itself, or closing a loop. */
export type LineRefusal = { refusal: 'reportingLine.self' } | { refusal: 'reportingLine.loop'; chain: LinePosition[]; day: string }

/** The organisation with one unit's own lines replaced. */
export function withUnitLines(organisation: Organisation, unitId: ElementId, lines: readonly UnitReportingLine[]): Organisation {
  return {
    ...organisation,
    units: organisation.units.map((unit) => {
      if (unit.id !== unitId) return unit
      const { reportingLines: _was, ...rest } = unit
      return lines.length ? { ...rest, reportingLines: [...lines] } : rest
    }),
  }
}

/** The organisation with one unit type's slots replaced. */
export function withTypeSlots(organisation: Organisation, typeId: UnitTypeId, slots: readonly RoleSlot[]): Organisation {
  return { ...organisation, unitTypes: organisation.unitTypes.map((type) => (type.id === typeId ? { ...type, slots: [...slots] } : type)) }
}

/**
 * Whether writing `after` over `before` closes a loop of solid lines that
 * was not there (ADR-0039 §5): on `day`, the day it is written, and on
 * `from`, the first day of the line written, where that is later. The first
 * loop found, with its day; nothing where none is new.
 */
export function loopMadeBy(before: Organisation, after: Organisation, day: string, from?: string): LineRefusal | undefined {
  for (const at of [day, ...(isDay(from) && from > day ? [from] : [])]) {
    const had = new Set(reportingLoops(before, at).map(chainKey))
    const loop = reportingLoops(after, at).find((chain) => !had.has(chainKey(chain)))
    if (loop) return { refusal: 'reportingLine.loop', chain: loop, day: at }
  }
  return undefined
}

/**
 * Whether a unit's own line may be written (ADR-0039 §5): never from a role
 * to the same role in the same unit, and never one that closes a loop.
 */
export function refuseUnitLine(organisation: Organisation, unitId: ElementId, line: UnitReportingLine, day: string): LineRefusal | undefined {
  if (line.to && line.to.unit === unitId && line.to.role === line.role) return { refusal: 'reportingLine.self' }
  if (!line.to || line.kind !== 'solid') return undefined
  const unit = organisation.units.find((one) => one.id === unitId)
  const after = withUnitLines(organisation, unitId, unitLinesWith(unit?.reportingLines, line))
  return loopMadeBy(organisation, after, day, line.from)
}

/** The organisation with one role's own lines replaced. */
export function withRoleLines(organisation: Organisation, roleId: RoleId, said: ReportsToSaid | undefined): Organisation {
  return {
    ...organisation,
    roles: organisation.roles.map((role) => {
      if (role.id !== roleId) return role
      const { reportsTo: _was, ...rest } = role
      return said && linesSaid(said).length ? { ...rest, reportsTo: said } : rest
    }),
  }
}

/** Whether `after` over `before` closes a loop on the day written or on the first day of any solid line in `said`. */
function refuseSaid(before: Organisation, after: Organisation, day: string, said: ReportsToSaid | undefined): LineRefusal | undefined {
  const solid = linesSaid(said).filter((line) => line.kind === 'solid' && line.role !== undefined)
  if (solid.length === 0) return undefined
  for (const line of solid) {
    const refusal = loopMadeBy(before, after, day, line.from)
    if (refusal) return refusal
  }
  return undefined
}

/**
 * Whether a slot's lines may be written: a solid one never closes a loop, and
 * a line to the slot's own role in the same unit is refused. A dotted one is
 * not asked.
 */
export function refuseSlotLine(
  organisation: Organisation, typeId: UnitTypeId, slots: readonly RoleSlot[], day: string, said: ReportsToSaid | undefined, roleId?: RoleId,
): LineRefusal | undefined {
  if (roleId !== undefined && linesSaid(said).some((line) => line.within && line.role === roleId)) return { refusal: 'reportingLine.self' }
  return refuseSaid(organisation, withTypeSlots(organisation, typeId, slots), day, said)
}

/** The organisation with one assignment's own lines replaced: none where the list is empty. */
export function withAssignmentLines(organisation: Organisation, assignmentId: AssignmentId, lines: readonly AssignmentReportingLine[]): Organisation {
  return {
    ...organisation,
    assignments: organisation.assignments.map((one) => {
      if (one.id !== assignmentId) return one
      const { reportsTo: _was, ...rest } = one
      return lines.length ? { ...rest, reportsTo: [...lines] } : rest
    }),
  }
}

/**
 * Whether a holder's own lines may be written (ADR-0039, amended 17 October
 * 2026): never to the holder's own role in their own unit, and a solid one
 * never closes a loop that was not there — on the day it is written or on
 * the line's first day, asked over the organisation with the assignment as
 * it will be. A line to another person who holds the same role there is no
 * line to oneself. A dotted one is not asked about loops.
 */
export function refusePersonLines(
  organisation: Organisation, assignment: Pick<Assignment, 'id' | 'unitId' | 'roleId' | 'person'>, lines: readonly AssignmentReportingLine[], day: string,
): LineRefusal | undefined {
  // To their own role in their own unit: to themselves, unless the line names somebody else who holds it there.
  const self = (line: AssignmentReportingLine) => line.to.unit === assignment.unitId && line.to.role === assignment.roleId
    && (line.to.person === undefined || line.to.person === personOf(assignment))
  if (lines.some(self)) return { refusal: 'reportingLine.self' }
  const solid = lines.filter((line) => line.kind === 'solid')
  if (solid.length === 0) return undefined
  const placed = organisation.assignments.some((one) => one.id === assignment.id)
  const before = placed ? organisation : { ...organisation, assignments: [...organisation.assignments, assignment as Assignment] }
  const after = withAssignmentLines(before, assignment.id, lines)
  for (const line of solid) {
    const refusal = loopMadeBy(before, after, day, line.from)
    if (refusal) return refusal
  }
  return undefined
}

/** A holder's own lines with one set: it replaces their line of the same kind, and goes last where there was none. */
export function personLinesWith(lines: readonly AssignmentReportingLine[] | undefined, line: AssignmentReportingLine): AssignmentReportingLine[] {
  const held = lines ?? []
  const at = held.findIndex((one) => one.kind === line.kind)
  return at < 0 ? [...held, line] : held.map((one, index) => (index === at ? line : one))
}

/** A holder's own lines without those of one kind — or without any, where none is named — so the model's apply again. */
export function personLinesWithout(lines: readonly AssignmentReportingLine[] | undefined, kind?: 'solid' | 'dotted'): AssignmentReportingLine[] {
  return kind === undefined ? [] : (lines ?? []).filter((one) => one.kind !== kind)
}

/** Whether a role's own lines may be written (ADR-0039 §2, amended): never to itself in the same unit, and a solid one never closes a loop. */
export function refuseRoleLines(organisation: Organisation, roleId: RoleId, said: ReportsToSaid | undefined, day: string): LineRefusal | undefined {
  if (linesSaid(said).some((line) => line.within && line.role === roleId)) return { refusal: 'reportingLine.self' }
  return refuseSaid(organisation, withRoleLines(organisation, roleId, said), day, said)
}

/**
 * A unit's own lines with one set (ADR-0039 §3): it replaces the unit's
 * line of the same role and kind — a line by nesting counting as solid —
 * and goes last where there was none.
 */
export function unitLinesWith(lines: readonly UnitReportingLine[] | undefined, line: UnitReportingLine): UnitReportingLine[] {
  const kindOf = (one: UnitReportingLine) => (one.to ? one.kind : 'solid')
  const held = lines ?? []
  const at = held.findIndex((one) => one.role === line.role && kindOf(one) === kindOf(line))
  return at < 0 ? [...held, line] : held.map((one, index) => (index === at ? line : one))
}

/** A unit's own lines without its line of one role — of one kind, where one is named — so its type's applies again. */
export function unitLinesWithout(
  lines: readonly UnitReportingLine[] | undefined, role: RoleId, kind?: 'solid' | 'dotted',
): UnitReportingLine[] {
  return (lines ?? []).filter((one) => one.role !== role || (kind !== undefined && (one.to ? one.kind : 'solid') !== kind))
}
