// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart's *Reporting lines* overlay (ADR-0039 §7): which
 * line runs from which row to which, on the chart's day, as the page draws
 * them over the boxes.
 *
 * A line runs from the row of a role in a unit to the row of the role it
 * lands on — a short hook beside the box where both rows are the same
 * unit's. A unit folded away is drawn as the fold that hides it: a line to
 * or from one ends at the box of the topmost folded unit above it, without a
 * row, and a line whose two ends fold into one box is not drawn. A line that
 * lands nowhere has nothing to draw; a finding about one that does is drawn
 * on it — `vacant` where nobody holds the role it lands on, `loop` where it
 * is part of a loop that day.
 */
import type { LineKind } from '../../model/operatingModel'
import type { ChartUnit, OrgChart } from '../../model/orgChart'
import { reportingLoops } from '../../model/reporting'
import type { ElementId } from '../../model/types'
import { holdersOn, positionKey, reportingLinesOn } from '../../model/units'
import type { Organisation } from '../../model/units'

/** One end of a line on the chart: a unit's box, and the row of a role where it is drawn. */
export type ChartLineEnd = { unitId: ElementId; roleId?: string }

export type ChartLine = {
  key: string
  kind: LineKind
  from: ChartLineEnd
  to: ChartLineEnd
  tone: 'plain' | 'vacant' | 'loop'
  /** Both ends in one box: a line between two roles of the same unit (ADR-0039 §2, amended). */
  within?: true
}

/** The lines to draw on `day`, over the units the chart draws with `folded` folded. */
export function chartLines(organisation: Organisation, chart: OrgChart, day: string, folded: ReadonlySet<ElementId>): ChartLine[] {
  const lines = reportingLinesOn(organisation, day).filter((line) => line.state === 'lands' && line.to)
  if (lines.length === 0) return []
  const shownAs = foldedInto(chart, folded)
  const looped = new Set(reportingLoops(organisation, day).flat().map((at) => positionKey(at.unitId, at.roleId)))
  const drawn: ChartLine[] = []
  for (const line of lines) {
    const to = line.to!
    const from = endOf(shownAs, line.unitId, line.roleId)
    const end = endOf(shownAs, to.unitId, to.roleId)
    if (!from || !end) continue
    // Both ends in one box: drawn between its two rows where both are rows, and not at all where a fold hides them.
    const within = from.unitId === end.unitId
    if (within && (from.roleId === undefined || end.roleId === undefined)) continue
    const loop = looped.has(positionKey(line.unitId, line.roleId)) && line.kind === 'solid'
    const vacant = holdersOn(organisation.assignments, to.unitId, to.roleId, day).length === 0
    drawn.push({
      key: `${line.unitId}/${line.roleId}/${line.kind}`, kind: line.kind, from, to: end, tone: loop ? 'loop' : vacant ? 'vacant' : 'plain',
      ...(within ? { within: true } : {}),
    })
  }
  return drawn
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

function endOf(shownAs: ReadonlyMap<ElementId, ElementId>, unitId: ElementId, roleId: string): ChartLineEnd | undefined {
  const box = shownAs.get(unitId)
  if (box === undefined) return undefined
  return box === unitId ? { unitId, roleId } : { unitId: box }
}
