// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The rest of the operating model, written (ADR-0036, amended 24 November
 * 2026): the responsibilities, the rules that name a role, and cells of the
 * RACI — at the organisation, one command each, under the agent's name.
 *
 * A responsibility taken out takes every role's part in it with it, as the
 * page does. A role and a unit type are taken out in `operatingRemoval.ts`.
 */
import type { Command } from '../../model/commands'
import { transaction } from '../../model/commands'
import { operatingRulesOf, responsibilitiesOf, rolesOf } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import { dutiesWith, raciOf } from '../../model/operatingModel'
import type { Duty, OperatingRuleKind, Raci, Responsibility, Role } from '../../model/operatingModel'
import { responsibilityLine } from '../operatingModel'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import { atOrganisation, documentWith, freshId, laid, nameOf, orderPatch, prepared, textPatch } from './operatingModel'
import type { Args, Handler } from './shared'

// --- responsibilities ---------------------------------------------------------

function responsibilityPatch(args: Args): Partial<Responsibility> {
  return { ...textPatch(args, 'description'), ...textPatch(args, 'group'), ...orderPatch(args) }
}

export const addResponsibility: Handler = (args, view) => {
  const wrong = atOrganisation(view)
  if (wrong) return wrong
  const name = nameOf(args.name)
  if (typeof name !== 'string') return name
  const responsibility = laid<Responsibility>({ id: freshId('rs', view.model, view), name }, responsibilityPatch(args))
  const command: Command = { type: 'responsibility.add', responsibility }
  return prepared(command, json(responsibilityLine(responsibility, documentWith(view.model, command))))
}

export const updateResponsibility: Handler = (args, view) => {
  const wrong = atOrganisation(view)
  if (wrong) return wrong
  const held = responsibilitiesOf(view.model)[args.id as string]
  if (!held) return refused('agent.unknownId', `responsibility ${String(args.id)}`)
  const name = 'name' in args && args.name !== null ? nameOf(args.name) : undefined
  if (name !== undefined && typeof name !== 'string') return name
  const patch = { ...responsibilityPatch(args), ...(name !== undefined ? { name } : {}) }
  const after = laid(held, patch)
  return prepared(
    { type: 'responsibility.update', id: held.id, patch },
    json(responsibilityLine(after, documentWith(view.model, { type: 'responsibility.add', responsibility: after }))),
  )
}

export const removeResponsibility: Handler = (args, view) => {
  const wrong = atOrganisation(view)
  if (wrong) return wrong
  const held = responsibilitiesOf(view.model)[args.id as string]
  if (!held) return refused('agent.unknownId', `responsibility ${String(args.id)}`)
  const parts = Object.values(rolesOf(view.model)).filter((role) => raciOf(role, held.id) !== undefined)
  const commands: Command[] = [
    { type: 'responsibility.remove', id: held.id },
    ...parts.map((role): Command => ({ type: 'role.update', id: role.id, patch: { duties: dutiesWith(role.duties, held.id, undefined) } })),
  ]
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({
      id: held.id, name: held.name, removed: true,
      ...(parts.length ? { partsRemoved: parts.map((role) => ({ roleId: role.id, role: role.name, raci: raciOf(role, held.id) })) } : {}),
    }),
  }
}

// --- the rules ----------------------------------------------------------------

export const setOperatingRule: Handler = (args, view) => {
  const wrong = atOrganisation(view)
  if (wrong) return wrong
  const kind = args.kind as OperatingRuleKind
  const roleId = args.roleId as string | null
  const held = operatingRulesOf(view.model)[kind]
  if (roleId === null) {
    return held
      ? prepared({ type: 'operatingRule.remove', id: kind }, json({ kind, cleared: true, was: held.role }))
      : refused('agent.unknownId', `rule ${kind}: no role is set, so there is none to clear`)
  }
  const role = rolesOf(view.model)[roleId]
  if (!role) return refused('agent.unknownId', `role ${roleId}`)
  const command: Command = held
    ? { type: 'operatingRule.update', id: kind, patch: { role: roleId } }
    : { type: 'operatingRule.add', rule: { id: kind, role: roleId } }
  return prepared(command, json({ kind, roleId, role: role.name, ...(held && held.role !== roleId ? { was: held.role } : {}) }))
}

// --- the RACI -----------------------------------------------------------------

/** The most cells one call sets: one step to a person, and an answer somebody can read. */
export const MOST_CELLS = 500

/** One cell as a call gives it. A cell says only what its call says: what else a duty holds is the duty's. */
type Cell = { roleId: string; responsibilityId: string; raci: Raci | null }

/** Everything wrong with the cells, said at once so one call puts it right; nothing where nothing is. */
function wrongCells(cells: readonly Cell[], model: Model): AgentAnswer | undefined {
  if (cells.length === 0) return refused('agent.badArguments', '"cells" needs at least one cell')
  if (cells.length > MOST_CELLS) return refused('agent.badArguments', `${cells.length} cells, the most is ${MOST_CELLS}`)
  const roles = rolesOf(model)
  const responsibilities = responsibilitiesOf(model)
  const unknown = new Set<string>()
  const twice: string[] = []
  const seen = new Set<string>()
  for (const [index, { roleId, responsibilityId }] of cells.entries()) {
    if (typeof roleId !== 'string' || typeof responsibilityId !== 'string') {
      return refused('agent.badArguments', `cells[${index}]: roleId and responsibilityId name the cell; only raci may be null`)
    }
    if (!roles[roleId]) unknown.add(`role ${roleId}`)
    if (!responsibilities[responsibilityId]) unknown.add(`responsibility ${responsibilityId}`)
    const key = `${roleId}\u0000${responsibilityId}`
    if (seen.has(key)) twice.push(`cells[${index}]: ${roleId} in ${responsibilityId} is given twice`)
    seen.add(key)
  }
  if (unknown.size > 0) return refused('agent.unknownId', [...unknown, ...twice].join('; '))
  return twice.length > 0 ? refused('agent.badArguments', twice.join('; ')) : undefined
}

/** A role's duties with one cell laid over them: a letter already there leaves the duty as it is. */
function withCell(duties: readonly Duty[], cell: Cell): readonly Duty[] {
  const held = duties.find((duty) => duty.responsibility === cell.responsibilityId)
  if ((held?.raci ?? null) === cell.raci) return duties
  return dutiesWith(duties, cell.responsibilityId, cell.raci ?? undefined)
}

export const setRaciCells: Handler = (args, view) => {
  const wrong = atOrganisation(view)
  if (wrong) return wrong
  const cells = args.cells as Cell[]
  const bad = wrongCells(cells, view.model)
  if (bad) return bad
  const roles = rolesOf(view.model)
  const responsibilities = responsibilitiesOf(view.model)
  const duties = new Map<string, readonly Duty[]>()
  const changed: Record<string, unknown>[] = []
  for (const cell of cells) {
    const before = duties.get(cell.roleId) ?? roles[cell.roleId].duties
    const after = withCell(before, cell)
    duties.set(cell.roleId, after)
    if (after === before) continue
    changed.push({
      roleId: cell.roleId, responsibilityId: cell.responsibilityId, raci: cell.raci, was: raciOf(roles[cell.roleId], cell.responsibilityId) ?? null,
    })
  }
  // Only the roles it changes; where it changes none, the step still lands, saying what stands already.
  const moved = [...duties].filter(([id, list]) => list !== roles[id].duties)
  const written = moved.length > 0 ? moved : [...duties].slice(0, 1)
  const command = transaction(
    written.map(([id, list]): Command => ({ type: 'role.update', id, patch: { duties: [...list] } })), { origin: 'agent' },
  )
  const after: Role[] = Object.values(roles).map((role) => ({ ...role, duties: [...duties.get(role.id) ?? role.duties] }))
  const document = { ...documentWith(view.model, command), roles: after }
  const findings = [...new Set(cells.map((cell) => cell.responsibilityId))].flatMap((id) => {
    const { finding } = responsibilityLine(responsibilities[id], document) as { finding?: string }
    return finding === undefined ? [] : [{ responsibilityId: id, finding }]
  })
  return { command, answer: json({ set: changed.length, unchanged: cells.length - changed.length, changed, ...(findings.length ? { findings } : {}) }) }
}
