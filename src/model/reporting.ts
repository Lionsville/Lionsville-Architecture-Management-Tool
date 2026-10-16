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
 * on a role nobody holds that day (`vacant`).
 *
 * Pure, with no words: `projects/checks.ts` says them, and the agent and the
 * screens ask {@link loopMadeBy} before they write.
 */
import { isDay } from './lifecycle'
import type { ReportsTo, RoleId, RoleSlot, UnitTypeId } from './operatingModel'
import type { ElementId, UnitReportingLine } from './types'
import {
  holdersOn, isUnit, organisationOn, positionKey, reportingLinesOn, roleOn, slotsOf, unitOn, unitsAbove,
} from './units'
import type { LinePosition, Organisation, ReportingLineOn } from './units'

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
  const lines = reportingLinesOn(organisation, day)
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

/** The roles in units and who manages each: a solid line's target, else the managing roles of the unit and the units above. */
function managerGraph(on: Organisation, day: string, lines: readonly ReportingLineOn[]) {
  const types = new Map(on.unitTypes.map((type) => [type.id, type]))
  const managing = new Set(on.roles.filter((role) => role.manages === true && roleOn(role, day)).map((role) => role.id))
  const running = new Set(on.roles.filter((role) => roleOn(role, day)).map((role) => role.id))
  const there = new Map(on.units.filter((unit) => isUnit(unit) && unitOn(unit, day)).map((unit) => [unit.id, unit]))
  const roleIds = new Map<ElementId, RoleId[]>()
  for (const unit of there.values()) {
    roleIds.set(unit.id, slotsOf(unit, types.get(unit.unitTypeId ?? '')).map((slot) => slot.role).filter((role) => running.has(role)))
  }
  const lineFrom = new Map<string, LinePosition>()
  for (const line of lines) if (line.kind === 'solid' && line.state === 'lands' && line.to) lineFrom.set(positionKey(line.unitId, line.roleId), line.to)
  const position = new Map<string, LinePosition>()
  const order: string[] = []
  const next = new Map<string, string[]>()
  const add = (at: LinePosition) => {
    const key = positionKey(at.unitId, at.roleId)
    if (!position.has(key)) { position.set(key, at); order.push(key) }
    return key
  }
  for (const unit of there.values()) for (const roleId of roleIds.get(unit.id) ?? []) add({ unitId: unit.id, roleId })
  for (const line of lines) if (line.kind === 'solid' && line.state === 'lands' && line.to) { add(line); add(line.to) }
  for (const key of [...order]) {
    const at = position.get(key)!
    const target = lineFrom.get(key)
    if (target) { next.set(key, [positionKey(target.unitId, target.roleId)]); continue }
    const up = [...(managing.has(at.roleId) ? [] : [at.unitId]), ...unitsAbove(on.units, at.unitId)]
    next.set(key, up.filter((id) => there.has(id)).flatMap((id) => (roleIds.get(id) ?? [])
      .filter((role) => managing.has(role)).map((role) => positionKey(id, role)))
      .filter((one) => position.has(one)))
  }
  return { position, order, next, lineFrom }
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
  return chain.map((at) => positionKey(at.unitId, at.roleId)).sort().join('\u0001')
}

/**
 * The days on or after `day` where a loop may first appear: the day itself,
 * and every later day a line starts or a plan moves a unit.
 */
function daysFrom(organisation: Organisation, day: string): string[] {
  const later = new Set<string>()
  const add = (one: string | undefined) => { if (isDay(one) && one > day) later.add(one) }
  for (const type of organisation.unitTypes) for (const slot of type.slots) add(slot.reportsTo?.from)
  for (const unit of organisation.units) for (const line of unit.reportingLines ?? []) add(line.from)
  for (const move of organisation.moves ?? []) add(move.on)
  return [day, ...[...later].sort()]
}

/**
 * Every finding of the reporting lines on `day` (ADR-0039 §6): the loops
 * there that day or on a later day a line starts or a unit moves, each once
 * with the first day it is there; then line by line, a line that lands
 * nowhere, one several units could take, and one on a role nobody holds.
 */
export function reportingFindings(organisation: Organisation, day: string): ReportingFinding[] {
  const lines = reportingLinesOn(organisation, day)
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
    else if (line.state === 'lands' && line.to && holdersOn(on.assignments, line.to.unitId, line.to.roleId, day).length === 0) {
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

/** Whether a slot's line may be written: a solid one never closes a loop. A dotted one is not asked. */
export function refuseSlotLine(
  organisation: Organisation, typeId: UnitTypeId, slots: readonly RoleSlot[], day: string, reportsTo: ReportsTo | undefined,
): LineRefusal | undefined {
  if (!reportsTo || reportsTo.kind !== 'solid') return undefined
  return loopMadeBy(organisation, withTypeSlots(organisation, typeId, slots), day, reportsTo.from)
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
