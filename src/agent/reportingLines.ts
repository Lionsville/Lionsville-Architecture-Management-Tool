// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The reporting lines, as an agent reads them (ADR-0039 §8):
 * `reportingLines.list`, across the tree.
 *
 * Read as `assignments.list` reads the organisation: the tree the shell
 * holds with the open scope's session laid over it, on the day asked — every
 * plan's moves of that day included, since a line lands under the parents
 * the day gives the units. Each line names its unit and role, and where it
 * lands, by id and by name, with the scope that keeps each unit; then what
 * the lines contradict.
 */
import { isDay, today as clockToday } from '../model/lifecycle'
import { reportingFindings } from '../model/reporting'
import { reportingLinesOn } from '../model/units'
import type { LinePosition, ReportingLineOn } from '../model/units'
import { assignmentsNow, organisationNow } from './assignments'
import type { OpenDocument } from './assignments'
import type { AgentAnswer } from './tools'
import { checkArguments, json, refused, toolSpec } from './tools'
import type { TreeView } from './tree'

export const REPORTING_LINES_LIST = 'reportingLines.list'

/** `reportingLines.list`, over the tree and the open scope. */
export function listReportingLines(rawArgs: unknown, tree: TreeView | undefined, open: OpenDocument | undefined): AgentAnswer {
  const wrong = checkArguments(toolSpec(REPORTING_LINES_LIST).inputSchema, rawArgs)
  if (wrong) return refused('agent.badArguments', wrong)
  const args = (rawArgs ?? {}) as Record<string, unknown>
  const day = isDay(args.on) ? args.on : open?.today ?? clockToday()
  const held = assignmentsNow(tree, open)
  const organisation = organisationNow(tree, open, held.map((one) => one.assignment))
  const kept = new Map((tree?.units?.() ?? []).filter((one) => one.scope !== open?.path).map((one) => [one.unit.id, one.scope]))
  for (const one of open?.current.elements ?? []) if (one.ref === undefined) kept.set(one.id, open!.path)
  const unitName = (id: string) => organisation.units.find((one) => one.id === id)?.name ?? id
  const roleName = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const at: Named = (position) => ({
    scope: kept.get(position.unitId) ?? '', unitId: position.unitId, unit: unitName(position.unitId), roleId: position.roleId, role: roleName(position.roleId),
  })
  const asked = typeof args.unitId === 'string' ? args.unitId : undefined
  const role = typeof args.roleId === 'string' ? args.roleId : undefined
  const into = typeof args.toUnitId === 'string' ? args.toUnitId : undefined
  const wanted = (line: ReportingLineOn) => (asked === undefined || line.unitId === asked) && (role === undefined || line.roleId === role)
    && (into === undefined || line.to?.unitId === into)
  const lines = reportingLinesOn(organisation, day).filter(wanted)
  const findings = reportingFindings(organisation, day).filter((one) => (one.kind === 'loop'
    ? (asked === undefined || one.chain.some((position) => position.unitId === asked)) && (role === undefined || one.chain.some((position) => position.roleId === role)) && into === undefined
    : wanted(one.line)))
  return json({
    day,
    lines: lines.map((line) => lineAnswer(line, at, unitName)),
    findings: findings.map((one) => (one.kind === 'loop'
      ? { check: 'check.reportingLoop', day: one.day, chain: one.chain.map(at) }
      : { check: CHECK[one.kind], from: at(one.line), ...(one.line.to ? { to: at(one.line.to) } : {}) })),
  })
}

const CHECK = { dangling: 'check.reportingDangling', ambiguous: 'check.reportingAmbiguous', vacant: 'check.reportingVacant' } as const

/** A role in a unit as an answer names it: the scope that keeps the unit, and both by id and by name. */
type Named = (position: LinePosition) => { scope: string; unitId: string; unit: string; roleId: string; role: string }

function lineAnswer(line: ReportingLineOn, at: Named, unitName: (id: string) => string) {
  return {
    ...at(line),
    kind: line.kind,
    said: line.source,
    ...(line.within ? { within: true } : {}),
    ...(line.from !== undefined ? { from: line.from } : {}),
    ...(line.until !== undefined ? { until: line.until } : {}),
    state: line.state,
    ...(line.reportsTo !== undefined ? { reportsToRoleId: line.reportsTo } : {}),
    ...(line.to ? { to: at(line.to) } : {}),
    ...(line.candidates ? { candidates: line.candidates.map((id) => ({ unitId: id, unit: unitName(id) })) } : {}),
  }
}
