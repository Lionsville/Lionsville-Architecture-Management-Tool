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
 *
 * Every line says whether it is an exception to the model (ADR-0039, amended
 * 17 October 2026): a unit's own and a holder's own are overrides, said with
 * the assignment and the person a holder's holds for; the roles held outside
 * a unit's slots are listed apart, as exception placements.
 */
import { isDay, today as clockToday } from '../model/lifecycle'
import { reportingFindings } from '../model/reporting'
import { everyLineOn, isExceptionPlacement, linesOfHolder, personOf, runsOn } from '../model/units'
import type { Assignment, LinePosition, ReportingLineOn } from '../model/units'
import { registerOf, resolvePerson } from '../people/shown'
import { assignmentsNow, organisationNow, personName } from './assignments'
import type { OpenDocument } from './assignments'
import type { PeopleView } from './people'
import type { AgentAnswer } from './tools'
import { checkArguments, json, refused, toolSpec } from './tools'
import type { TreeView } from './tree'

export const REPORTING_LINES_LIST = 'reportingLines.list'

/** `reportingLines.list`, over the tree and the open scope. */
export async function listReportingLines(
  rawArgs: unknown, tree: TreeView | undefined, open: OpenDocument | undefined, people?: PeopleView,
): Promise<AgentAnswer> {
  const wrong = checkArguments(toolSpec(REPORTING_LINES_LIST).inputSchema, rawArgs)
  if (wrong) return refused('agent.badArguments', wrong)
  const args = (rawArgs ?? {}) as Record<string, unknown>
  const day = isDay(args.on) ? args.on : open?.today ?? clockToday()
  const held = assignmentsNow(tree, open)
  const organisation = organisationNow(tree, open, held.map((one) => one.assignment))
  const register = people ? await people.read() : undefined
  const canonical = (id: string) => (register ? resolvePerson(id, registerOf(register.people))?.id ?? id : id)
  const byId = new Map(organisation.assignments.map((one) => [one.id, one]))
  const holder = (one: Assignment) => {
    const name = personName(personOf(one), register?.people, register?.policy)
    return { assignmentId: one.id, personId: personOf(one), ...(name !== undefined ? { person: name } : {}) }
  }
  const kept = new Map((tree?.units?.() ?? []).filter((one) => one.scope !== open?.path).map((one) => [one.unit.id, one.scope]))
  for (const one of open?.current.elements ?? []) if (one.ref === undefined) kept.set(one.id, open!.path)
  const unitName = (id: string) => organisation.units.find((one) => one.id === id)?.name ?? id
  const roleName = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const at: Named = (position) => {
    const name = position.person === undefined ? undefined : personName(position.person, register?.people, register?.policy)
    return {
      scope: kept.get(position.unitId) ?? '', unitId: position.unitId, unit: unitName(position.unitId), roleId: position.roleId, role: roleName(position.roleId),
      // A line to one holder names them: by register id, and by what the register says to an agent.
      ...(position.person !== undefined ? { person: { person: position.person, ...(name !== undefined ? { name } : {}) } } : {}),
    }
  }
  const asked = typeof args.unitId === 'string' ? args.unitId : undefined
  const role = typeof args.roleId === 'string' ? args.roleId : undefined
  const into = typeof args.toUnitId === 'string' ? args.toUnitId : undefined
  const whose = typeof args.personId === 'string' ? canonical(args.personId) : undefined
  // A person's lines are those that hold for them: their own, and their roles' in their units where they have none of that kind.
  const theirs = whose === undefined ? undefined : new Set(organisation.assignments
    .filter((one) => canonical(personOf(one)) === whose && runsOn(one, day))
    .flatMap((one) => linesOfHolder(organisation, one, day)))
  const wanted = (line: ReportingLineOn) => (asked === undefined || line.unitId === asked) && (role === undefined || line.roleId === role)
    && (into === undefined || line.to?.unitId === into)
  const all = everyLineOn(organisation, day)
  const lines = all.filter((line) => wanted(line) && (theirs === undefined || [...theirs].some((one) => sameLine(one, line))))
  const exceptions = organisation.assignments
    .filter((one) => runsOn(one, day) && isExceptionPlacement(organisation, one) && wanted({ unitId: one.unitId, roleId: one.roleId } as ReportingLineOn)
      && into === undefined && (whose === undefined || canonical(personOf(one)) === whose))
  const findings = reportingFindings(organisation, day).filter((one) => (one.kind === 'loop'
    ? (asked === undefined || one.chain.some((position) => position.unitId === asked)) && (role === undefined || one.chain.some((position) => position.roleId === role)) && into === undefined
    : wanted(one.line) && (whose === undefined || one.line.assignmentId === undefined || canonical(personOf(byId.get(one.line.assignmentId)!)) === whose)))
  return json({
    day,
    lines: lines.map((line) => {
      const one = line.assignmentId === undefined ? undefined : byId.get(line.assignmentId)
      return { ...lineAnswer(line, at, unitName), ...(one ? holder(one) : {}) }
    }),
    ...(exceptions.length ? { exceptions: exceptions.map((one) => ({ ...at({ unitId: one.unitId, roleId: one.roleId }), ...holder(one), exception: true })) } : {}),
    findings: findings.map((one) => (one.kind === 'loop'
      ? { check: 'check.reportingLoop', day: one.day, chain: one.chain.map(at) }
      : { check: CHECK[one.kind], from: at(one.line), ...(one.line.to ? { to: at(one.line.to) } : {}) })),
  })
}

/** Whether two lines on a day are the same line: from the same place, of the same kind, said in the same place and for the same holder. */
function sameLine(a: ReportingLineOn, b: ReportingLineOn): boolean {
  return a.unitId === b.unitId && a.roleId === b.roleId && a.kind === b.kind && a.source === b.source && a.assignmentId === b.assignmentId
}

const CHECK = { dangling: 'check.reportingDangling', ambiguous: 'check.reportingAmbiguous', vacant: 'check.reportingVacant' } as const

/** A role in a unit as an answer names it: the scope that keeps the unit, and both by id and by name. */
type Named = (position: LinePosition) => { scope: string; unitId: string; unit: string; roleId: string; role: string; person?: { person: string; name?: string } }

function lineAnswer(line: ReportingLineOn, at: Named, unitName: (id: string) => string) {
  return {
    ...at(line),
    kind: line.kind,
    said: line.source,
    override: line.override,
    ...(line.within ? { within: true } : {}),
    ...(line.from !== undefined ? { from: line.from } : {}),
    ...(line.until !== undefined ? { until: line.until } : {}),
    state: line.state,
    ...(line.reportsTo !== undefined ? { reportsToRoleId: line.reportsTo } : {}),
    ...(line.to ? { to: at(line.to) } : {}),
    ...(line.candidates ? { candidates: line.candidates.map((id) => ({ unitId: id, unit: unitName(id) })) } : {}),
  }
}
