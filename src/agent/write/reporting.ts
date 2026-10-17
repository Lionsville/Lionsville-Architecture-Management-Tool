// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Reporting lines, written (ADR-0039 §3, §5, §8): a unit's own line set and
 * taken away, as the unit's inspector sets and takes one away — one command
 * each, under the agent's name, in the scope that keeps the unit — and the
 * refusal both a unit's line and a unit type's slot meet where a solid line
 * would close a loop. A holder's own lines (ADR-0039, amended 17 October
 * 2026) are read here too, for `assignment.add` and `assignment.update`:
 * each target found in the tree and addressed by the scope that keeps it.
 *
 * What a request names is checked against what is there: the unit is a unit
 * this scope keeps, the roles are the organisation's, and the unit reported
 * to is a unit somewhere in the tree, addressed by the path of the scope that
 * keeps it. The loop is asked of the organisation as the tree has it with the
 * open scope's session laid over it, on the day it is written and on the
 * line's first day; a loop time makes later is a finding, never a refusal.
 */
import { isDay } from '../../model/lifecycle'
import { rolesOf, toArrays } from '../../model/normalised'
import { isLineKind } from '../../model/operatingModel'
import type { LineKind } from '../../model/operatingModel'
import { refuseUnitLine, unitLinesWith, unitLinesWithout } from '../../model/reporting'
import type { LineRefusal } from '../../model/reporting'
import type { DesignElement, UnitReportingLine } from '../../model/types'
import { isUnit, personOf } from '../../model/units'
import type { AssignmentReportingLine, Organisation } from '../../model/units'
import { registerOf, resolvePerson } from '../../people/shown'
import { assignmentsNow, organisationNow } from '../assignments'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Args, Handler, WriteView } from './shared'

/** The organisation as a write asks it: the tree's, with the open scope's session laid over it. */
export function organisationOfView(view: WriteView): Organisation {
  const open = { path: view.scopePath, current: toArrays(view.model), today: view.today() }
  return organisationNow(view.tree, open, assignmentsNow(view.tree, open).map((one) => one.assignment))
}

/** A line refused, said with the chain of a loop by name: `Role (Unit) → …`, and the day. */
export function lineRefused(refusal: LineRefusal, organisation: Organisation): AgentAnswer {
  if (refusal.refusal === 'reportingLine.self') return refused('reportingLine.self')
  const role = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const unit = (id: string) => organisation.units.find((one) => one.id === id)?.name ?? id
  const chain = refusal.chain.map((at) => `${role(at.roleId)} in ${unit(at.unitId)} (${at.unitId}/${at.roleId})`).join(' → ')
  return refused('reportingLine.loop', `${chain}, back to the first, on ${refusal.day}`)
}

/** The days given, checked: each a day, and the last not before the first. */
export function daysOf(args: Args): { from?: string; until?: string } | AgentAnswer {
  for (const key of ['from', 'until'] as const) {
    if (args[key] !== undefined && args[key] !== null && !isDay(args[key])) return refused('agent.badArguments', `"${key}" must be yyyy-mm-dd`)
  }
  const from = isDay(args.from) ? args.from : undefined
  const until = isDay(args.until) ? args.until : undefined
  if (from !== undefined && until !== undefined && until < from) return refused('agent.badArguments', '"until" must not be before "from"')
  return { ...(from !== undefined ? { from } : {}), ...(until !== undefined ? { until } : {}) }
}

/** The kind given, solid where none is. */
export function kindOf(value: unknown): LineKind {
  return isLineKind(value) ? value : 'solid'
}

/** The organisation's roles as this scope can see them: its own at the organisation, the tree's anywhere else. */
function rolesKnown(view: WriteView): readonly { id: string }[] | undefined {
  if (view.scopePath === '') return Object.values(rolesOf(view.model))
  return view.tree?.operatingModel?.().roles
}

/** A unit this scope keeps, or the refusal. */
function unitHere(view: WriteView, unitId: string): DesignElement | AgentAnswer {
  const unit = view.model.elements[unitId]
  if (!unit) return refused('agent.unknownId', `element ${unitId}`)
  if (unit.ref !== undefined) return refused('agent.scopeNotOpen', `${unitId} is kept in ${unit.ref || 'the organisation'}; its lines are said there`)
  if (!isUnit(unit)) return refused('agent.badArguments', `"unitId" ${unitId} is not a unit: give the actor a unitTypeId first (element.update)`)
  return unit
}

/** The path of the scope that keeps a unit: this one, or where the tree has it. */
function scopeOfUnit(view: WriteView, unitId: string): string | undefined {
  const here = view.model.elements[unitId]
  if (here && here.ref === undefined && isUnit(here)) return view.scopePath
  return view.tree?.units?.().find((one) => one.unit.id === unitId && one.scope !== view.scopePath)?.scope
}

/** A target as a call gives it: a unit, its role, and — for a line to one holder — the person. */
type GivenTarget = { unitId: string; roleId: string; person?: string }

/**
 * Where a line a call gives lands, addressed: the unit found anywhere in the
 * tree by the scope that keeps it, the role the organisation's, and a person
 * named (ADR-0039, amended 17 October 2026) one who holds that role in that
 * unit on some day — a merged id written as the entry it was merged into.
 */
function targetOf(view: WriteView, given: GivenTarget, where: string): UnitReportingLine['to'] | AgentAnswer {
  const scope = scopeOfUnit(view, given.unitId)
  if (scope === undefined) return refused('agent.unknownId', `${where}unit ${given.unitId}, a unit anywhere in the organisation (assignments.list)`)
  const roles = rolesKnown(view)
  if (roles && !roles.some((role) => role.id === given.roleId)) return refused('agent.unknownId', `${where}role ${given.roleId}`)
  if (given.person === undefined) return { scope, unit: given.unitId, role: given.roleId }
  const people = view.people?.()
  const person = people ? resolvePerson(given.person, registerOf(people))?.id ?? given.person : given.person
  const holds = organisationOfView(view).assignments.some((one) => one.unitId === given.unitId && one.roleId === given.roleId && personOf(one) === person)
  if (!holds) {
    return refused('agent.badArguments', `${where}${given.person} holds no ${given.roleId} in ${given.unitId}: a line to one person names a holder of that role there (assignments.list)`)
  }
  return { scope, unit: given.unitId, role: given.roleId, person }
}

/**
 * A holder's own lines as a call gives them: each target a unit somewhere in
 * the tree and a role the organisation holds, addressed by the scope that
 * keeps the unit; the days checked; at most one of each kind.
 */
export function personLinesOf(given: unknown, view: WriteView): AssignmentReportingLine[] | AgentAnswer {
  if (!Array.isArray(given)) return []
  const lines: AssignmentReportingLine[] = []
  for (const [at, raw] of given.entries()) {
    const one = raw as { to: GivenTarget; kind?: unknown; from?: unknown; until?: unknown }
    const to = targetOf(view, one.to, `reportsTo[${at}]: `)
    if (!to || 'ok' in to) return to as AgentAnswer
    const days = daysOf(one as Args)
    if ('ok' in days) return days
    const kind = kindOf(one.kind)
    if (lines.some((line) => line.kind === kind)) return refused('agent.badArguments', `reportsTo says two ${kind} lines: at most one of each kind`)
    lines.push({ to, kind, ...days })
  }
  return lines
}

/** A holder's own lines as an answer says them: each target by id, with the scope that keeps its unit. */
export function personLinesAnswer(lines: readonly AssignmentReportingLine[]) {
  return lines.map((line) => ({
    to: targetAnswer(line.to), kind: line.kind,
    ...(line.from !== undefined ? { from: line.from } : {}), ...(line.until !== undefined ? { until: line.until } : {}),
  }))
}

/** A target as an answer says it: by id, with the scope that keeps its unit, and the person where one is named. */
export function targetAnswer(to: NonNullable<UnitReportingLine['to']>) {
  return { scope: to.scope, unitId: to.unit, roleId: to.role, ...(to.person !== undefined ? { person: to.person } : {}) }
}

export const setReportingLine: Handler = (args, view) => {
  const unitId = args.unitId as string
  const unit = unitHere(view, unitId)
  if ('ok' in unit) return unit
  const roles = rolesKnown(view)
  const known = (id: string) => !roles || roles.some((role) => role.id === id)
  const roleId = args.roleId as string
  if (!known(roleId)) return refused('agent.unknownId', `role ${roleId}`)
  const days = daysOf(args)
  if ('ok' in days) return days
  const given = args.to as GivenTarget | undefined
  let to: UnitReportingLine['to']
  if (given) {
    const found = targetOf(view, given, '')
    if (!found || 'ok' in found) return found as AgentAnswer
    to = found
  }
  const line: UnitReportingLine = { role: roleId, ...(to ? { to } : {}), kind: to ? kindOf(args.kind) : 'solid', ...days }
  const organisation = organisationOfView(view)
  const refusal = refuseUnitLine(organisation, unitId, line, view.today())
  if (refusal) return lineRefused(refusal, organisation)
  return {
    command: { type: 'element.update', id: unitId, patch: { reportingLines: unitLinesWith(unit.reportingLines, line) }, origin: 'agent' },
    answer: json({
      unitId, roleId, ...(to ? { kind: line.kind, to: targetAnswer(to) } : { by: 'nesting' }), ...days,
      // A unit's own line is an exception to the model's lines: said, so the answer to the person can say so too.
      override: true,
    }),
  }
}

export const removeReportingLine: Handler = (args, view) => {
  const unitId = args.unitId as string
  const unit = unitHere(view, unitId)
  if ('ok' in unit) return unit
  const roleId = args.roleId as string
  const kind = isLineKind(args.kind) ? args.kind : undefined
  const reportingLines = unitLinesWithout(unit.reportingLines, roleId, kind)
  if (reportingLines.length === (unit.reportingLines ?? []).length) {
    return refused('agent.unknownId', `a line of ${unitId}'s own for role ${roleId}${kind ? ` (${kind})` : ''}: reportingLines.list says which it has`)
  }
  return {
    command: { type: 'element.update', id: unitId, patch: { reportingLines: reportingLines.length ? reportingLines : undefined }, origin: 'agent' },
    answer: json({ unitId, roleId, removed: (unit.reportingLines ?? []).length - reportingLines.length }),
  }
}
