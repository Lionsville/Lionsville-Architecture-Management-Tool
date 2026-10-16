// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Reporting lines, written (ADR-0039 §3, §5, §8): a unit's own line set and
 * taken away, as the unit's inspector sets and takes one away — one command
 * each, under the agent's name, in the scope that keeps the unit — and the
 * refusal both a unit's line and a unit type's slot meet where a solid line
 * would close a loop.
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
import { isUnit } from '../../model/units'
import type { Organisation } from '../../model/units'
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
  const given = args.to as { unitId: string; roleId: string } | undefined
  let to: UnitReportingLine['to']
  if (given) {
    const scope = scopeOfUnit(view, given.unitId)
    if (scope === undefined) return refused('agent.unknownId', `unit ${given.unitId}: a unit anywhere in the organisation (assignments.list)`)
    if (!known(given.roleId)) return refused('agent.unknownId', `role ${given.roleId}`)
    to = { scope, unit: given.unitId, role: given.roleId }
  }
  const line: UnitReportingLine = { role: roleId, ...(to ? { to } : {}), kind: to ? kindOf(args.kind) : 'solid', ...days }
  const organisation = organisationOfView(view)
  const refusal = refuseUnitLine(organisation, unitId, line, view.today())
  if (refusal) return lineRefused(refusal, organisation)
  return {
    command: { type: 'element.update', id: unitId, patch: { reportingLines: unitLinesWith(unit.reportingLines, line) }, origin: 'agent' },
    answer: json({ unitId, roleId, ...(to ? { kind: line.kind, to: { scope: to.scope, unitId: to.unit, roleId: to.role } } : { by: 'nesting' }), ...days }),
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
