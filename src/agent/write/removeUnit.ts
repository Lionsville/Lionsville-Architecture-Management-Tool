// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `element.remove` on a unit (ADR-0036, amended 12 October 2026; 3.6.2):
 * what the screens' confirmation does, without the confirmation.
 *
 * The unit's assignments go with it, as `element.delete` takes them. Units
 * inside it move up into its parent where their type may sit there; where it
 * may not, the call is **refused with the choices named**, and the agent asks
 * the person — `units: 'into:<id>'` for another unit of its type, `'up'` to
 * move them up anyway, where they show as misplaced, or `'delete'` to take
 * them too. An agent does not pick a new parent for somebody's teams. The
 * applications that name it as their team are cleared, and every row that
 * names it in another scope goes there (`model/unitDeletion.ts`).
 *
 * Where only the open scope is written, it is one command, as every write
 * is. Where other scopes are written too, it is one change across them,
 * landed by the host (`SessionView.landSteps`), all or none.
 */
import type { Command } from '../../model/commands'
import { transaction } from '../../model/commands'
import { assignmentList, toArrays, unitTypesOf } from '../../model/normalised'
import { assignmentsIn } from '../../model/units'
import { deletionWorld, openStep, unitDeletion, unitsChoiceOf } from '../../model/unitDeletion'
import type { DeletionWorld, UnitDeletion } from '../../model/unitDeletion'
import type { ElementId } from '../../model/types'
import type { AgentAnswer } from '../tools'
import { refused } from '../tools'
import type { WriteView } from './shared'

/** A unit's removal worked out: the open scope's command, every other scope's, and what the answer says. */
export type UnitRemoval = {
  open: Command
  others: ReadonlyMap<string, readonly Command[]>
  answer: Record<string, unknown>
}

/** The tree as the agent reads it for a delete: the open scope as its session has it, the rest as the tree was read. */
function worldOf(view: WriteView): DeletionWorld {
  const held = toArrays(view.model)
  const tree = view.tree
  return deletionWorld(
    { scope: view.scopePath, elements: held.elements, relations: held.relations, assignments: assignmentList(view.model) },
    {
      units: tree?.units?.() ?? [],
      rowsOf: (id) => tree?.rowsOf?.(id) ?? [],
      owned: (tree?.register?.() ?? []).filter((entry) => entry.master !== undefined && entry.partyId !== undefined).map((entry) => ({
        scope: entry.master!, id: entry.id, name: entry.name, kind: entry.kind, partyId: entry.partyId!,
      })),
      assignments: tree?.assignments?.() ?? [],
      unitTypes: tree?.operatingModel?.().unitTypes ?? Object.values(unitTypesOf(view.model)),
    },
  )
}

/** The choices a refusal names, for the agent to put to the person. */
function choicesOf(plan: UnitDeletion, world: DeletionWorld): Record<string, unknown> {
  const up = plan.up.parentId === undefined
    ? 'move them up to the top'
    : `move them up into ${world.actors.find((one) => one.id === plan.up.parentId)?.name ?? plan.up.parentId}`
  return {
    inside: plan.inside.map((one) => ({ id: one.id, name: one.name, scope: one.scope })),
    choices: [
      ...plan.into.map((one) => ({ units: `into:${one.id}`, says: `move them into ${one.name}, another unit of its type` })),
      { units: 'up', says: `${up}; their type may not sit there, so they show as misplaced` },
      { units: 'delete', says: 'delete them too, with everything under them and their people\'s assignments' },
    ],
  }
}

/** What the answer says the removal did, beyond the unit itself. */
function said(plan: UnitDeletion, world: DeletionWorld, id: ElementId): Record<string, unknown> {
  const goes = plan.choice === 'delete' ? [id, ...plan.below.map((one) => one.id)] : [id]
  const gone = assignmentsIn(world.assignments, goes).map((one) => ({
    id: one.id, ...(one.unitId !== id ? { unitId: one.unitId } : {}), roleId: one.roleId, person: one.person.person,
    ...(one.from ? { from: one.from } : {}), ...(one.until ? { until: one.until } : {}),
  }))
  const moved = plan.choice === 'delete' ? [] : plan.inside.map((one) => ({
    id: one.id, name: one.name, parentId: (plan.choice === 'up' ? plan.up.parentId : plan.choice.slice('into:'.length)) ?? null,
    ...(plan.choice === 'up' && !plan.up.fits ? { misplaced: true } : {}),
  }))
  const others = [...plan.steps.keys()].filter((scope) => scope !== world.scope)
  return {
    ...(gone.length > 0 ? { assignmentsRemoved: gone } : {}),
    ...(moved.length > 0 ? { unitsMoved: moved } : {}),
    ...(plan.choice === 'delete' && plan.below.length > 0 ? { unitsRemoved: plan.below.map((one) => ({ id: one.id, name: one.name, scope: one.scope })) } : {}),
    ...(plan.applications.length > 0 ? { teamCleared: plan.applications.map((one) => ({ id: one.id, name: one.name, scope: one.scope })) } : {}),
    ...(others.length > 0 ? { alsoChanged: others } : {}),
  }
}

/**
 * A unit's removal, or the refusal that names what the person must choose;
 * nothing where the element is not a unit this scope keeps, and the plain
 * removal applies.
 */
export function unitRemoval(args: Record<string, unknown>, view: WriteView): UnitRemoval | AgentAnswer | undefined {
  const id = args.id as string
  const world = worldOf(view)
  const first = unitDeletion(world, [id], undefined, view.today())
  if (!first) return undefined
  const asked = args.units === undefined ? undefined : unitsChoiceOf(args.units)
  if (args.units !== undefined && asked === undefined) {
    return refused('agent.badArguments', `units must be 'up', 'delete' or 'into:<id>' of another unit of its type: ${JSON.stringify(choicesOf(first, world))}`)
  }
  if (asked?.startsWith('into:') && !first.into.some((one) => `into:${one.id}` === asked)) {
    return refused('agent.badArguments', `${asked.slice('into:'.length)} is not another unit of its type: ${JSON.stringify(choicesOf(first, world))}`)
  }
  if (asked === undefined && first.inside.length > 0 && !first.up.fits) {
    return refused('agent.unitsInside', JSON.stringify(choicesOf(first, world)))
  }
  const plan = unitDeletion(world, [id], asked ?? 'up', view.today()) ?? first
  const own = openStep(plan, world.scope, [{ type: 'element.delete', id }])
  const others = new Map([...plan.steps].filter(([scope]) => scope !== world.scope))
  return {
    open: own.length === 1 ? { ...own[0], origin: 'agent' } : transaction(own, { origin: 'agent' }),
    others,
    answer: { id, name: first.units[0].name, removed: true, ...said(plan, world, id) },
  }
}

/** Whether what came back is a removal worked out, rather than a refusal. */
export function isUnitRemoval(held: UnitRemoval | AgentAnswer): held is UnitRemoval {
  return 'open' in held
}
