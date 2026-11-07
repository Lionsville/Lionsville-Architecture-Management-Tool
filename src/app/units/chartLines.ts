// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart's *Reporting lines* overlay (ADR-0039 §7, amended
 * 17 October 2026): which lines run from which chips to which, for the person
 * picked, on the chart's day, as the page draws them over the boxes.
 *
 * **The lines that apply to that holder**, and nothing else: the lines they
 * report along (`up`) — their own where they have one, else their role's in
 * that unit, kind by kind (`linesOfHolder`) — and the lines that report into
 * them (`into`): every line that lands on their role there, from the holders
 * who report along it — those of the role it runs from with no line of their
 * own of that kind, or the one holder whose own line it is — and a line to
 * one named person only where that person is them. Each says whether it is
 * an override (a unit's own line or a holder's own), so the overlay colours
 * it apart whichever way it runs.
 *
 * A line runs from chips to chips — a short hook beside the box where both
 * ends are in the same unit. A unit folded away is drawn as the fold that
 * hides it: a line to or from one ends at the box of the topmost folded unit
 * above it, without a row, and a line whose two ends fold into one box is not
 * drawn. A line that lands nowhere has nothing to draw; a finding about one
 * that does is drawn on it — `vacant` where nobody holds what it lands on,
 * `loop` where it is part of a loop that day.
 */
import type { LineKind } from '../../model/operatingModel'
import type { ChartUnit, OrgChart } from '../../model/orgChart'
import { reportingLoops } from '../../model/reporting'
import type { ElementId } from '../../model/types'
import { everyLineOn, holdersAt, holdersOn, isExceptionPlacement, linesOfHolder, personLinesOn, personOf, positionKey } from '../../model/units'
import type { Assignment, LineSource, Organisation, ReportingLineOn } from '../../model/units'

/**
 * One end of a line on the chart: a unit's box, the row of a role where it is
 * drawn, and the chips of the holders it is drawn at — every holder of the
 * role there where none are named, and the role's name where the list is
 * empty.
 */
export type ChartLineEnd = { unitId: ElementId; roleId?: string; holders?: readonly string[] }

/** A role in a unit, as the organisation says it, whatever the chart folds. */
export type ChartPosition = { unitId: ElementId; roleId: string }

/** Which way a line runs from the person picked: up, to whom they report; or into them, from whoever reports to them. */
export type LineDirection = 'up' | 'into'

export type ChartLine = {
  key: string
  kind: LineKind
  direction: LineDirection
  /** A unit's own line or a holder's own: an exception to the model, drawn in its own colour whichever way it runs. */
  override: boolean
  /** Where the line is drawn from and to: chips in a role's row, or the box of the fold that hides it. */
  from: ChartLineEnd
  to: ChartLineEnd
  /** The role in a unit that reports, and the one it lands on. */
  at: ChartPosition
  lands: ChartPosition
  tone: 'plain' | 'vacant' | 'loop'
  /** On an exception: whose own line it is, which its tag says. */
  source?: LineSource
  /** Both ends in one box: a line between two roles of the same unit (ADR-0039 §2, amended). */
  within?: true
}

/**
 * The lines to draw for one holder on `day`, over the units the chart draws
 * with `folded` folded: up first, then into them, each in the organisation's
 * order. Nothing for nobody picked.
 */
export function holderLines(
  organisation: Organisation, chart: OrgChart, day: string, folded: ReadonlySet<ElementId>, picked: Assignment | undefined,
): ChartLine[] {
  if (!picked) return []
  const every = everyLineOn(organisation, day)
  if (every.length === 0) return []
  const shownAs = foldedInto(chart, folded)
  const looped = new Set(reportingLoops(organisation, day).flat().map((at) => positionKey(at.unitId, at.roleId)))
  const drawn: ChartLine[] = []
  const draw = (line: ReportingLineOn, direction: LineDirection, from: readonly string[], to: readonly string[] | undefined) => {
    const target = line.to!
    const start = endOf(shownAs, line.unitId, line.roleId, from)
    const end = endOf(shownAs, target.unitId, target.roleId, to)
    if (!start || !end) return
    // Both ends in one box: drawn between its two rows where both are rows, and not at all where a fold hides them.
    const within = start.unitId === end.unitId
    if (within && (start.roleId === undefined || end.roleId === undefined)) return
    const loop = looped.has(positionKey(line.unitId, line.roleId)) && line.kind === 'solid'
    const vacant = holdersAt(organisation.assignments, target, day).length === 0
    drawn.push({
      key: `${direction}/${line.unitId}/${line.roleId}/${line.kind}/${line.assignmentId ?? ''}`, kind: line.kind, direction, override: line.override,
      from: start, to: end, at: { unitId: line.unitId, roleId: line.roleId }, lands: { unitId: target.unitId, roleId: target.roleId },
      tone: loop ? 'loop' : vacant ? 'vacant' : 'plain', ...(line.override ? { source: line.source } : {}), ...(within ? { within: true } : {}),
    })
  }
  for (const line of linesOfHolder(organisation, picked, day)) {
    if (line.state !== 'lands' || !line.to) continue
    draw(line, 'up', [picked.id], line.to.person === undefined ? undefined : holdersAt(organisation.assignments, line.to, day).map((one) => one.id))
  }
  const own = new Map<string, Set<LineKind>>()
  for (const line of personLinesOn(organisation, day)) {
    const kinds = own.get(line.assignmentId!) ?? new Set<LineKind>()
    kinds.add(line.kind)
    own.set(line.assignmentId!, kinds)
  }
  const byId = new Map(organisation.assignments.map((one) => [one.id, one]))
  for (const line of every) {
    const to = line.to
    if (line.state !== 'lands' || !to || to.unitId !== picked.unitId || to.roleId !== picked.roleId) continue
    if (to.person !== undefined && to.person !== personOf(picked)) continue
    if (line.assignmentId !== undefined) {
      if (line.assignmentId !== picked.id && byId.has(line.assignmentId)) draw(line, 'into', [line.assignmentId], [picked.id])
      continue
    }
    // The role's line, from those of its holders who have no line of their own of that kind; from its name where nobody holds it.
    const holders = holdersOn(organisation.assignments, line.unitId, line.roleId, day)
    const along = holders.filter((one) => !own.get(one.id)?.has(line.kind) && one.id !== picked.id).map((one) => one.id)
    if (holders.length > 0 && along.length === 0) continue
    draw(line, 'into', along, [picked.id])
  }
  return drawn
}

/**
 * The lines the Lines menu draws for the whole chart: every dotted line, or
 * every exception to the model, each running up from whoever reports along it
 * to whoever holds what it lands on. A role's line runs from its holders with
 * no line of their own of that kind, and from its name where nobody holds it.
 */
export function chartWideLines(organisation: Organisation, chart: OrgChart, day: string, folded: ReadonlySet<ElementId>, which: 'dotted' | 'exceptions'): ChartLine[] {
  const every = everyLineOn(organisation, day)
  if (every.length === 0) return []
  const shownAs = foldedInto(chart, folded)
  const looped = new Set(reportingLoops(organisation, day).flat().map((at) => positionKey(at.unitId, at.roleId)))
  const own = new Set(personLinesOn(organisation, day).map((line) => `${line.assignmentId}/${line.kind}`))
  const drawn: ChartLine[] = []
  for (const line of every) {
    const target = line.to
    if (line.state !== 'lands' || !target) continue
    if (which === 'dotted' ? line.kind !== 'dotted' : !line.override) continue
    const from = line.assignmentId !== undefined
      ? [line.assignmentId]
      : holdersOn(organisation.assignments, line.unitId, line.roleId, day).filter((one) => !own.has(`${one.id}/${line.kind}`)).map((one) => one.id)
    const named = target.person === undefined ? undefined : holdersAt(organisation.assignments, target, day).map((one) => one.id)
    const start = endOf(shownAs, line.unitId, line.roleId, from)
    const end = endOf(shownAs, target.unitId, target.roleId, named)
    if (!start || !end) continue
    const within = start.unitId === end.unitId
    if (within && (start.roleId === undefined || end.roleId === undefined)) continue
    const loop = looped.has(positionKey(line.unitId, line.roleId)) && line.kind === 'solid'
    const vacant = holdersAt(organisation.assignments, target, day).length === 0
    drawn.push({
      key: `up/${line.unitId}/${line.roleId}/${line.kind}/${line.assignmentId ?? ''}`, kind: line.kind, direction: 'up', override: line.override,
      from: start, to: end, at: { unitId: line.unitId, roleId: line.roleId }, lands: { unitId: target.unitId, roleId: target.roleId },
      tone: loop ? 'loop' : vacant ? 'vacant' : 'plain', ...(line.override ? { source: line.source } : {}), ...(within ? { within: true } : {}),
    })
  }
  return drawn
}

/** A departure from the model, as the Exceptions list says it. */
export type ChartException =
  | { kind: 'line'; key: string; unitId: ElementId; roleId: string; lands: ChartPosition; lineKind: LineKind; source: LineSource; assignmentId?: string }
  | { kind: 'placement'; key: string; unitId: ElementId; assignment: Assignment; overloaded: boolean }

/** Every departure from the model on the day among the units drawn: the lines first, then the people in a role outside their unit's. */
export function chartExceptions(organisation: Organisation, chart: OrgChart, day: string): ChartException[] {
  const drawn = [...walkUnits(chart.roots)]
  const here = new Set(drawn.map((unit) => unit.id))
  const lines: ChartException[] = everyLineOn(organisation, day)
    .filter((line) => line.override && line.state === 'lands' && line.to !== undefined && here.has(line.unitId))
    .map((line) => ({
      kind: 'line', key: `line/${line.unitId}/${line.roleId}/${line.kind}/${line.assignmentId ?? ''}`, unitId: line.unitId, roleId: line.roleId,
      lands: { unitId: line.to!.unitId, roleId: line.to!.roleId }, lineKind: line.kind, source: line.source,
      ...(line.assignmentId !== undefined ? { assignmentId: line.assignmentId } : {}),
    }))
  const placements: ChartException[] = drawn.flatMap((unit) => unit.others
    .filter((other) => other.exception && isExceptionPlacement(organisation, other.assignment))
    .map((other) => ({ kind: 'placement' as const, key: `placement/${other.assignment.id}`, unitId: unit.id, assignment: other.assignment, overloaded: other.overloaded })))
  return [...lines, ...placements]
}

function* walkUnits(units: readonly ChartUnit[]): Generator<ChartUnit> {
  for (const unit of units) {
    yield unit
    yield* walkUnits(unit.children)
  }
}

/** Who reports to a holder on the day: their ids, along any line that lands on them. What their panel says under *Reports to them*. */
export function reportsInto(organisation: Organisation, picked: Assignment, day: string): Assignment[] {
  const own = new Set(personLinesOn(organisation, day).map((line) => `${line.assignmentId}/${line.kind}`))
  const byId = new Map(organisation.assignments.map((one) => [one.id, one]))
  const found = new Map<string, Assignment>()
  for (const line of everyLineOn(organisation, day)) {
    const to = line.to
    if (line.state !== 'lands' || !to || to.unitId !== picked.unitId || to.roleId !== picked.roleId) continue
    if (to.person !== undefined && to.person !== personOf(picked)) continue
    const from = line.assignmentId !== undefined
      ? [byId.get(line.assignmentId)].filter((one): one is Assignment => one !== undefined)
      : holdersOn(organisation.assignments, line.unitId, line.roleId, day).filter((one) => !own.has(`${one.id}/${line.kind}`))
    for (const one of from) if (one.id !== picked.id) found.set(one.id, one)
  }
  return [...found.values()]
}

/** Each unit drawn, by the box it is shown in: its own, or the topmost folded unit above it. */
function foldedInto(chart: OrgChart, folded: ReadonlySet<ElementId>): Map<ElementId, ElementId> {
  const shown = new Map<ElementId, ElementId>()
  const visit = (units: readonly ChartUnit[], hiddenIn: ElementId | undefined) => {
    for (const unit of units) {
      shown.set(unit.id, hiddenIn ?? unit.id)
      visit(unit.children, hiddenIn ?? (folded.has(unit.id) ? unit.id : undefined))
    }
  }
  visit(chart.roots, undefined)
  return shown
}

function endOf(shownAs: ReadonlyMap<ElementId, ElementId>, unitId: ElementId, roleId: string, holders: readonly string[] | undefined): ChartLineEnd | undefined {
  const box = shownAs.get(unitId)
  if (box === undefined) return undefined
  return box === unitId ? { unitId, roleId, ...(holders !== undefined ? { holders } : {}) } : { unitId: box }
}
