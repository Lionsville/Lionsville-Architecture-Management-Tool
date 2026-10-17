// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A unit moved to another place in the organisation (ADR-0036, amended 17
 * October 2026; 3.7.1): put under another unit anywhere in the tree, or at
 * the top, keeping its id — so its assignments, its own reporting lines, the
 * scopes it serves and its comments, all keyed by that id and kept where the
 * unit is kept, stay as they are.
 *
 * **A correction, not a plan's move** (ADR-0036 §6, option 5): one
 * `element.update` of `parentId` in the scope that keeps each unit, undated,
 * its `order` among its new siblings cleared so it starts afresh. A move on a
 * day is a plan's (`plan.move`). The units inside a unit moved keep their
 * own parent, so they come with it.
 *
 * **What is refused**: what is not a unit; a parent the organisation does not
 * have, or one that is not a unit; a unit under itself; and a loop — a parent
 * that sits inside a unit moved on the day asked or on any later day a plan's
 * move reaches. **What is allowed and said**: a place the unit's type may not
 * sit in (`top`, `within`) — it is moved, and `check.unitMisplaced` stands,
 * as a unit whose parent was deleted may be left where it does not fit.
 *
 * **What it does to who manages** is said before it lands: the managers of
 * each unit on the day, before and after, each by nesting or by a solid line
 * (`managersOf` on the organisation as it would be), leaving out the holders
 * of its own roles and of the units inside it, whom a move does not change.
 * A role's reporting line lands on the nearest unit above that holds its
 * target, so a move can make it land elsewhere: that is in the answer too.
 *
 * Pure and with no words: the dialog on the chart and the unit's inspector,
 * and the agent's `element.update`, ask the same function.
 */
import type { Command } from './commands'
import { isDay } from './lifecycle'
import type { UnitTypeId } from './operatingModel'
import type { ElementId } from './types'
import { isUnit, managersOf, mayHaveParent, organisationOn, unitsBelow, unitsOn } from './units'
import type { Manager, Organisation, UnitLike, UnitMove } from './units'

/** Why a move is refused, and of what. */
export type UnitMoveRefusal =
  | { ok: false; reason: 'notAUnit'; unitId: ElementId }
  | { ok: false; reason: 'unknownParent'; parentId: ElementId }
  | { ok: false; reason: 'parentNotAUnit'; parentId: ElementId }
  | { ok: false; reason: 'itself'; unitId: ElementId }
  | { ok: false; reason: 'loop'; unitId: ElementId; day: string }
  | { ok: false; reason: 'notKept'; unitId: ElementId }

/** Whether a unit's type may sit where it is moved: `parentType` is the new parent's, absent at the top. */
export type UnitFit = { unitId: ElementId; fits: boolean; parentType?: UnitTypeId }

/** Who manages a unit on the day, before the move and after it. */
export type ManagersMoved = { unitId: ElementId; before: Manager[]; after: Manager[] }

/** A plan's move of a unit moved here: from `on`, it sits where the plan says, whatever its own parent. */
export type PlannedMove = UnitMove & { reached: boolean }

export type UnitMovePlan = {
  ok: true
  /** The units whose parent changes, in the order asked; one already there is left out. */
  moved: ElementId[]
  parentId?: ElementId
  /** One list of commands per scope that keeps a unit moved. */
  steps: Map<string, Command[]>
  fits: UnitFit[]
  managers: ManagersMoved[]
  /** The plans' moves of the units moved: one `reached` by the day overrides the correction from its own day on. */
  planned: PlannedMove[]
}

export type UnitMoveAsk = {
  organisation: Organisation
  /** The scope that keeps a unit, where the tree knows it. */
  scopeOf: (id: ElementId) => string | undefined
  unitIds: readonly ElementId[]
  /** The unit to sit under; absent is the top. */
  parentId?: ElementId
  /** The day it is asked on: today. A loop is looked for on it and on every later day a plan's move reaches. */
  day: string
}

/** The units by id. */
function byId(units: readonly UnitLike[]): Map<ElementId, UnitLike> {
  return new Map(units.filter(isUnit).map((unit) => [unit.id, unit]))
}

/** Whether following a unit's parents through units brings it back to itself. */
function loopsBack(held: ReadonlyMap<ElementId, UnitLike>, unitId: ElementId): boolean {
  const seen = new Set<ElementId>()
  for (let at = held.get(unitId)?.parentId; at !== undefined && held.has(at); at = held.get(at)?.parentId) {
    if (at === unitId) return true
    if (seen.has(at)) return false
    seen.add(at)
  }
  return false
}

/** The organisation with each unit moved under `parentId`, its order among its siblings cleared. */
export function withUnitsMoved(organisation: Organisation, unitIds: ReadonlySet<ElementId>, parentId: ElementId | undefined): Organisation {
  return {
    ...organisation,
    units: organisation.units.map((unit) => {
      if (!unitIds.has(unit.id)) return unit
      const { parentId: _was, order: _order, ...rest } = unit
      return parentId === undefined ? rest : { ...rest, parentId }
    }),
  }
}

/** The first unit moved that sits below itself on `day` or a later day a plan's move reaches, and the day. */
function firstLoop(laid: Organisation, unitIds: readonly ElementId[], day: string): { unitId: ElementId; day: string } | undefined {
  const days = [day, ...new Set((laid.moves ?? []).filter((move) => isDay(move.on) && move.on > day).map((move) => move.on))].sort()
  for (const on of days) {
    const held = byId(organisationOn(laid, on).units)
    const unitId = unitIds.find((id) => loopsBack(held, id))
    if (unitId !== undefined) return { unitId, day: on }
  }
  return undefined
}

/** The managers of a unit, but for the holders of its own roles and of the units below it: a move changes neither. */
function managersFromAbove(organisation: Organisation, unitId: ElementId, day: string): Manager[] {
  const inside = new Set([unitId, ...unitsBelow(organisationOn(organisation, day).units, unitId)])
  return managersOf(organisation, unitId, day).filter((one) => !inside.has(one.unitId))
}

/** Whether a unit of this type may sit under that parent: a type the model does not hold is not asked. */
export function unitFits(organisation: Organisation, unit: Pick<UnitLike, 'unitTypeId'>, parentId: ElementId | undefined): UnitFit['fits'] {
  const type = organisation.unitTypes.find((one) => one.id === unit.unitTypeId)
  if (!type) return true
  const parent = parentId === undefined ? undefined : byId(organisation.units).get(parentId)
  return mayHaveParent(type, parent?.unitTypeId)
}

/**
 * What moving these units under `parentId` — or to the top — takes, or why
 * it is refused (module comment). Every unit asked is checked; one already
 * under that parent is left out of the commands, so a move that changes
 * nothing answers `moved: []`.
 */
export function unitMove(ask: UnitMoveAsk): UnitMovePlan | UnitMoveRefusal {
  const { organisation, parentId, day } = ask
  const units = byId(organisation.units)
  for (const unitId of ask.unitIds) {
    if (!units.has(unitId)) return { ok: false, reason: 'notAUnit', unitId }
    if (unitId === parentId) return { ok: false, reason: 'itself', unitId }
  }
  if (parentId !== undefined) {
    const parent = organisation.units.find((one) => one.id === parentId)
    if (!parent) return { ok: false, reason: 'unknownParent', parentId }
    if (!isUnit(parent)) return { ok: false, reason: 'parentNotAUnit', parentId }
  }
  const asked = [...new Set(ask.unitIds)]
  const laid = withUnitsMoved(organisation, new Set(asked), parentId)
  const loop = firstLoop(laid, asked, day)
  if (loop) return { ok: false, reason: 'loop', ...loop }
  const moved = asked.filter((id) => units.get(id)?.parentId !== parentId)
  const steps = new Map<string, Command[]>()
  for (const unitId of moved) {
    const scope = ask.scopeOf(unitId)
    if (scope === undefined) return { ok: false, reason: 'notKept', unitId }
    const command: Command = { type: 'element.update', id: unitId, patch: { parentId, order: undefined } }
    steps.set(scope, [...steps.get(scope) ?? [], command])
  }
  const parentType = parentId === undefined ? undefined : units.get(parentId)?.unitTypeId
  return {
    ok: true,
    moved,
    ...(parentId !== undefined ? { parentId } : {}),
    steps,
    fits: asked.map((unitId) => ({
      unitId, fits: unitFits(organisation, units.get(unitId)!, parentId), ...(parentType !== undefined ? { parentType } : {}),
    })),
    managers: asked.map((unitId) => ({
      unitId, before: managersFromAbove(organisation, unitId, day), after: managersFromAbove(laid, unitId, day),
    })),
    planned: (organisation.moves ?? []).filter((move) => asked.includes(move.unitId) && isDay(move.on))
      .map((move) => ({ ...move, reached: move.on <= day })),
  }
}

/**
 * The units beside one under the parent it has on `day`, which a move may
 * take along: every other unit there that day under the same parent — or at
 * the top with it — in the order the organisation lists them.
 */
export function unitsBeside(organisation: Organisation, unitId: ElementId, day: string): UnitLike[] {
  const unit = organisationOn(organisation, day).units.find((one) => one.id === unitId)
  if (!unit) return []
  return unitsOn(organisation, day).filter((one) => one.id !== unitId && one.parentId === unit.parentId)
}
