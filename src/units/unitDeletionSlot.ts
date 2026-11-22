// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Deleting a unit, as the host hands it to a board's and a sheet's
 * confirmation (ADR-0036, amended 12 October 2026; 3.6.2): what to say, what
 * is chosen first, and the delete itself.
 *
 * `editor` and `business` may not read the tree, so the host works the
 * delete out here (`model/unitDeletion.ts`) over the tree with the open
 * scope's session laid over it, draws what it takes
 * (`UnitDeletionParts`), and lands it: the open scope's part — the page's own
 * commands for the delete with what the plan adds here — as one step through
 * its session, and every other scope's part as that scope's step, all of
 * them or none (`landPeopleMoves`). Where another scope is written the step
 * here carries a barrier, so ⌘Z cannot take back half of it. It is
 * structure, so a managing role's right never reaches it.
 */
import { createElement } from 'react'
import type { ReactNode } from 'react'
import type { StringKey, Translate } from '../../i18n'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { addDays } from '../../model/transition'
import { isUnit } from '../../model/units'
import { deletionWorld, openStep, unitDeletion, unitsChoiceOf } from '../../model/unitDeletion'
import type { DeletionWorld, UnitsChoice } from '../../model/unitDeletion'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { lazyPart } from '../../widgets/lazyPart'
import type { LandPeopleMoves } from './landPeopleMoves'
import type { UnitDeletionPartsProps } from './UnitDeletionParts'

/**
 * What a delete says about a unit is not in the first download
 * (`widgets/lazyPart`). A unit is chosen before it is deleted, and its record
 * brings these lines along (`useWorkspaceOwnership`), as a sheet's inspector
 * asking for its slot does here: the script is there by the time the
 * confirmation draws them.
 */
export const UnitDeletionParts = lazyPart<UnitDeletionPartsProps>(
  () => import('./UnitDeletionParts').then((held) => held.UnitDeletionParts),
)

/** Why the open scope's part of a delete that wrote other scopes cannot be undone here. */
export const DELETE_BARRIER: StringKey = 'unitDelete.barrier'

/** What a confirmation draws for a unit, and what its Delete does: the shape `editor` and `business` each declare. */
export type UnitDeletionSlot = {
  initial: string
  render(choice: string, onChoice: (choice: string) => void, onDone: () => void): ReactNode
  run(choice: string, here: readonly Command[]): void
}

export type UnitDeletionAt = {
  index: ScopeIndex
  scope: ScopePath
  /** The open scope's model as its session holds it now. */
  model: HostModel
  today: string
  /** The open scope's session: what ending the unit on a day is. */
  dispatch(command: Command): unknown
  /** The delete, landed over every scope it writes. */
  land: LandPeopleMoves
  scopeLabel(path: ScopePath): string
  s: Translate
  /** Said where the delete did not land. */
  onRefused?(text: string): void
}

/** The tree as a delete reads it: the open scope's session laid over the index. */
export function worldOf(index: ScopeIndex, scope: ScopePath, model: HostModel): DeletionWorld {
  return deletionWorld(
    { scope, elements: model.elements, relations: model.relations, assignments: model.assignments ?? [] },
    {
      units: index.units(),
      rowsOf: (id) => index.rowsOf(id),
      owned: index.entries().filter((entry) => entry.partyId !== undefined && entry.master !== undefined).map((entry) => ({
        scope: entry.master!, id: entry.id, name: entry.name, kind: entry.kind, ...(entry.partyId !== undefined ? { partyId: entry.partyId } : {}),
      })),
      assignments: index.assignments(),
      unitTypes: scope === '' ? model.unitTypes ?? [] : index.operatingModel().unitTypes,
    },
  )
}

/** A landing refused, as a sentence: the key it came with where it is one, a plain one otherwise. */
function refusedText(reason: string, s: Translate): string {
  return reason.startsWith('shell.') || reason.startsWith('command.') ? s(reason as StringKey) : s('unitDelete.notDone')
}

/** What deleting these elements says and does for the units among them; nothing where none is a unit kept here. */
export function unitDeletionSlot(at: UnitDeletionAt, elementIds: readonly string[]): UnitDeletionSlot | undefined {
  // Asked on every render of an inspector: nothing to work out for what is not a unit kept here.
  if (!at.model.elements.some((element) => element.ref === undefined && isUnit(element) && elementIds.includes(element.id))) return undefined
  const world = worldOf(at.index, at.scope, at.model)
  const first = unitDeletion(world, elementIds, undefined, at.today)
  if (!first) return undefined
  // Fetched now, while the unit is only chosen: one that will not load is asked again when the confirmation draws it.
  UnitDeletionParts.preload().catch(() => undefined)
  const actors = new Map(world.actors.map((actor) => [actor.id, actor.name]))
  const roles = new Map((at.scope === '' ? at.model.roles ?? [] : at.index.operatingModel().roles).map((role) => [role.id, role.name]))
  const types = new Map(world.unitTypes.map((type) => [type.id, type.name]))
  const names = {
    unit: (id: string) => actors.get(id) ?? at.index.lookup(id)?.name ?? id,
    role: (id: string) => roles.get(id) ?? id,
    type: (id: string) => types.get(id) ?? id,
    scope: (path: string) => at.scopeLabel(path),
  }
  const planFor = (choice: string) => unitDeletion(world, elementIds, unitsChoiceOf(choice), at.today) ?? first
  const unit = at.model.elements.find((element) => element.id === first.units[0].id)
  const end = (lastDay: string) => {
    if (!unit) return
    at.dispatch({ type: 'element.update', id: unit.id, patch: { lifecycleDates: { ...unit.lifecycleDates, retired: addDays(lastDay, 1) } } })
  }
  return {
    initial: first.initial,
    render: (choice, onChoice, onDone) => createElement(UnitDeletionParts, {
      plan: planFor(choice), choice: (unitsChoiceOf(choice) ?? first.initial) as UnitsChoice, onChoice, names, today: at.today, s: at.s,
      ...(first.units.length === 1 && unit ? { onEnd: (lastDay: string) => { end(lastDay); onDone() } } : {}),
    }),
    run: (choice, here) => {
      const plan = planFor(choice)
      const steps = new Map(plan.steps)
      steps.set(at.scope, openStep(plan, at.scope, here))
      void at.land(steps, DELETE_BARRIER).then(
        (landed) => { if (!landed.ok && landed.reason !== 'unchanged') at.onRefused?.(refusedText(landed.reason, at.s)) },
        () => at.onRefused?.(at.s('unitDelete.notDone')),
      )
    },
  }
}
