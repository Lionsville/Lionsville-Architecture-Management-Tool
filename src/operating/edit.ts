// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the operating model's page asks for, said as commands (ADR-0036 §2).
 *
 * The writer takes one record at a time and refuses nothing about what one
 * record says of another (`model/commands/operating.ts`). So taking a role out
 * also takes it out of the slots and the rules that name it, and taking a
 * responsibility out takes every role's part in it with it: one step each,
 * which undo puts back whole.
 */
import { fieldEdit, transaction } from '../model/commands'
import type { Command } from '../model/commands'
import { dutiesWith, inOwnOrder, nextRaci, raciOf, responsibilityGroups } from '../model/operatingModel'
import type { OperatingRule, OperatingRuleKind, ReportsTo, Responsibility, Role, RoleSlot, UnitType } from '../model/operatingModel'
import { renumbered, unitTypeLanes } from '../model/unitOrder'
import { distinct } from './bringIn'
import type { OperatingLists } from './bringIn'

/** The operating model's lists, with its rules, as the page reads them. */
export type OperatingModel = OperatingLists & { readonly operatingRules: readonly OperatingRule[] }

/** A command of one kind, narrowed: what a new item is made by, so its id can be read back. */
export type CommandOf<K extends Command['type']> = Extract<Command, { type: K }>

/** The ids the operating model holds, for a new one to be distinct from. */
function idsOf(model: OperatingLists | undefined): Set<string> {
  return new Set(model ? [...model.unitTypes, ...model.roles, ...model.responsibilities].map((item) => item.id) : [])
}

export function newUnitType(name: string, makeId: (prefix: string) => string, model?: OperatingLists): CommandOf<'unitType.add'> {
  return { type: 'unitType.add', unitType: { id: distinct(makeId('ut'), idsOf(model)), name, top: true, within: [], slots: [] } }
}

export function newRole(name: string, makeId: (prefix: string) => string, model?: OperatingLists): CommandOf<'role.add'> {
  return { type: 'role.add', role: { id: distinct(makeId('ro'), idsOf(model)), name, duties: [] } }
}

export function newResponsibility(
  name: string, makeId: (prefix: string) => string, group?: string, model?: OperatingLists,
): CommandOf<'responsibility.add'> {
  return {
    type: 'responsibility.add',
    responsibility: { id: distinct(makeId('rs'), idsOf(model)), name, ...(group?.trim() ? { group: group.trim() } : {}) },
  }
}

/**
 * One field of a text box, typed: every keystroke live, one undo step per
 * field (`fieldEdit`). An emptied optional field is taken away rather than
 * kept empty; a name stays, whatever it says.
 */
export function editUnitType(id: string, field: 'name' | 'purpose', value: string): Command {
  return { type: 'unitType.update', id, patch: { [field]: field === 'name' || value !== '' ? value : undefined }, coalesce: fieldEdit(id, field) }
}

export function editRole(id: string, field: 'name' | 'short' | 'purpose', value: string): Command {
  return { type: 'role.update', id, patch: { [field]: field === 'name' || value !== '' ? value : undefined }, coalesce: fieldEdit(id, field) }
}

export function editResponsibility(id: string, field: 'name' | 'description' | 'group', value: string): Command {
  return {
    type: 'responsibility.update', id, patch: { [field]: field === 'name' || value !== '' ? value : undefined },
    coalesce: fieldEdit(id, field),
  }
}

/** A flag said as present or absent: `true`, or the field taken away. */
export function setFlag(kind: 'unitType', id: string, field: 'top' | 'spans', on: boolean): Command
export function setFlag(kind: 'role', id: string, field: 'manages', on: boolean): Command
export function setFlag(kind: 'unitType' | 'role', id: string, field: 'top' | 'spans' | 'manages', on: boolean): Command {
  const value = on ? true : undefined
  return kind === 'role'
    ? { type: 'role.update', id, patch: { manages: value } }
    : { type: 'unitType.update', id, patch: { [field]: value } }
}

/**
 * A day a unit type or a role starts or ends (ADR-0036 §6): a change with a
 * day, set as a field — an empty day takes it away. A new name is an edit;
 * a thing that stops existing ends on a day and names what follows it.
 */
export function setDay(kind: 'unitType' | 'role', id: string, field: 'from' | 'until', day: string): Command {
  const patch = { [field]: day === '' ? undefined : day }
  return kind === 'role' ? { type: 'role.update', id, patch } : { type: 'unitType.update', id, patch }
}

/** What follows a unit type or a role when it ends, by id: none takes the list away. Never itself. */
export function setSuccessors(kind: 'unitType' | 'role', id: string, successors: readonly string[]): Command {
  const list = [...new Set(successors.filter((one) => one !== id))]
  const patch = { successors: list.length ? list : undefined }
  return kind === 'role' ? { type: 'role.update', id, patch } : { type: 'unitType.update', id, patch }
}

/** The types a unit type may sit in, with one put in or taken out. */
export function setWithin(type: UnitType, other: string, on: boolean): Command {
  const within = on ? [...new Set([...type.within, other])] : type.within.filter((id) => id !== other)
  return { type: 'unitType.update', id: type.id, patch: { within } }
}

/**
 * A unit type moved to place `to` (from 0) among the others of its lane — or
 * among those that sit nowhere — as dragging its card along the lane says it
 * (`model/unitOrder.ts`): the lane's `order` renumbered from 1 in its new
 * order, only where a number changes, as one step that one undo takes back.
 * Nothing where the type is unknown or the place is the one it has.
 */
export function moveUnitType(model: Pick<OperatingLists, 'unitTypes'>, id: string, to: number): Command | undefined {
  const { lanes, laneOf, nowhere } = unitTypeLanes(model.unitTypes)
  const lane = laneOf.get(id)
  const siblings = lane === undefined ? nowhere : lanes[lane - 1].types
  const rows = renumbered(siblings, siblings.findIndex((type) => type.id === id), to)
  if (rows.length === 0) return undefined
  return transaction(rows.map(({ id: at, order }): Command => ({ type: 'unitType.update', id: at, patch: { order } })))
}

/**
 * A role moved one place earlier (`-1`) or later (`1`) in the organisation's
 * own order, as one step that renumbers the roles whose number changes.
 * Nothing where it is at an end already.
 */
export function moveRole(model: Pick<OperatingLists, 'roles'>, id: string, step: -1 | 1): Command | undefined {
  const ordered = inOwnOrder(model.roles)
  const at = ordered.findIndex((role) => role.id === id)
  return ordered[at + step] ? reordered('role.update', renumbered(ordered, at, at + step)) : undefined
}

/**
 * A responsibility moved one place earlier or later among those of its own
 * group, as the matrix lists them: past the next one of its group, whatever
 * stands between them in other groups.
 */
export function moveResponsibility(model: Pick<OperatingLists, 'responsibilities'>, id: string, step: -1 | 1): Command | undefined {
  const ordered = inOwnOrder(model.responsibilities)
  const at = ordered.findIndex((responsibility) => responsibility.id === id)
  if (at < 0) return undefined
  const group = groupOf(ordered[at])
  const mates = ordered.filter((responsibility) => groupOf(responsibility) === group)
  const next = mates[mates.indexOf(ordered[at]) + step]
  return next ? reordered('responsibility.update', renumbered(ordered, at, ordered.indexOf(next))) : undefined
}

/**
 * A group moved one place earlier or later among the groups: its
 * responsibilities, in their order, past those of the group beside it. The
 * responsibilities in no group stand last whatever is moved.
 */
export function moveGroup(model: Pick<OperatingLists, 'responsibilities'>, group: string, step: -1 | 1): Command | undefined {
  const groups = responsibilityGroups(inOwnOrder(model.responsibilities)).filter((one) => one.group !== '')
  const at = groups.findIndex((one) => one.group === group.trim())
  if (at < 0 || !groups[at + step]) return undefined
  groups.splice(at + step, 0, ...groups.splice(at, 1))
  const loose = inOwnOrder(model.responsibilities).filter((responsibility) => groupOf(responsibility) === '')
  const rows = [...groups.flatMap((one) => one.responsibilities), ...loose]
    .map((responsibility, index) => ({ id: responsibility.id, order: index + 1, was: responsibility.order }))
    .filter((row) => row.was !== row.order)
  return reordered('responsibility.update', rows)
}

const groupOf = (responsibility: Responsibility) => responsibility.group?.trim() ?? ''

function reordered(type: 'role.update' | 'responsibility.update', rows: readonly { id: string; order: number }[]): Command | undefined {
  if (rows.length === 0) return undefined
  return transaction(rows.map(({ id, order }): Command => (
    type === 'role.update' ? { type, id, patch: { order } } : { type, id, patch: { order } })))
}

/** How many applications a unit of the type should own at most; nothing takes the limit away. */
export function setLimit(type: UnitType, limit: number | undefined): Command {
  return { type: 'unitType.update', id: type.id, patch: { limit: limit === undefined ? undefined : Math.max(0, Math.trunc(limit)) } }
}

/** The slots, with one changed: a minimum of at least nothing, a maximum of at least the minimum or none. */
export function setSlot(type: UnitType, index: number, change: Partial<Pick<RoleSlot, 'min' | 'max'>>): Command {
  const slots = type.slots.map((slot, at) => {
    if (at !== index) return slot
    const min = Math.max(0, Math.trunc(change.min ?? slot.min))
    const max = 'max' in change ? change.max : slot.max
    const { max: _was, ...rest } = slot
    return { ...rest, min, ...(max !== undefined ? { max: Math.max(min, Math.trunc(max)) } : {}) }
  })
  return { type: 'unitType.update', id: type.id, patch: { slots } }
}

/**
 * A slot's reporting line set, changed or taken away (ADR-0039 §2): the
 * slots as they will be, for the host to ask about a loop before the step is
 * dispatched, and the step.
 */
export function setReportsTo(type: UnitType, index: number, reportsTo: ReportsTo | undefined): { slots: RoleSlot[]; command: Command } {
  const slots = type.slots.map((slot, at) => {
    if (at !== index) return slot
    const { reportsTo: _was, ...rest } = slot
    return reportsTo ? { ...rest, reportsTo } : rest
  })
  return { slots, command: { type: 'unitType.update', id: type.id, patch: { slots } } }
}

export function addSlot(type: UnitType, role: string): Command {
  return { type: 'unitType.update', id: type.id, patch: { slots: [...type.slots, { role, min: 0, max: 1 }] } }
}

export function removeSlot(type: UnitType, index: number): Command {
  return { type: 'unitType.update', id: type.id, patch: { slots: type.slots.filter((_, at) => at !== index) } }
}

/** A cell of the matrix pressed: the role's part in the responsibility goes to the next letter. */
export function cycleRaci(role: Role, responsibility: string): Command {
  return { type: 'role.update', id: role.id, patch: { duties: dutiesWith(role.duties, responsibility, nextRaci(raciOf(role, responsibility))) } }
}

/** A rule set to a role, or taken away. */
export function setRule(rules: readonly OperatingRule[], kind: OperatingRuleKind, role: string | undefined): Command | undefined {
  const held = rules.find((rule) => rule.id === kind)
  if (role === undefined) return held ? { type: 'operatingRule.remove', id: kind } : undefined
  if (!held) return { type: 'operatingRule.add', rule: { id: kind, role } }
  return held.role === role ? undefined : { type: 'operatingRule.update', id: kind, patch: { role } }
}

/** A unit type taken out, and out of every type that may sit in it. */
export function removeUnitType(model: OperatingModel, id: string): Command {
  const commands: Command[] = model.unitTypes
    .filter((type) => type.id !== id && type.within.includes(id))
    .map((type) => setWithin(type, id, false))
  return transaction([{ type: 'unitType.remove', id }, ...commands])
}

/** A role taken out, and out of the slots and the rules that name it. */
export function removeRole(model: OperatingModel, id: string): Command {
  const commands: Command[] = [{ type: 'role.remove', id }]
  for (const type of model.unitTypes) {
    if (type.slots.some((slot) => slot.role === id)) {
      commands.push({ type: 'unitType.update', id: type.id, patch: { slots: type.slots.filter((slot) => slot.role !== id) } })
    }
  }
  for (const rule of model.operatingRules) {
    if (rule.role === id) commands.push({ type: 'operatingRule.remove', id: rule.id })
  }
  return transaction(commands)
}

/** A responsibility taken out, and every role's part in it with it. */
export function removeResponsibility(model: OperatingModel, id: string): Command {
  const commands: Command[] = [{ type: 'responsibility.remove', id }]
  for (const role of model.roles) {
    if (raciOf(role, id)) commands.push({ type: 'role.update', id: role.id, patch: { duties: dutiesWith(role.duties, id, undefined) } })
  }
  return transaction(commands)
}

/** An item of the operating model by id, with which list it is in. */
export type OperatingItem =
  | { readonly kind: 'unitType'; readonly item: UnitType }
  | { readonly kind: 'role'; readonly item: Role }
  | { readonly kind: 'responsibility'; readonly item: Responsibility }

export function itemOf(model: OperatingLists, id: string | undefined): OperatingItem | undefined {
  if (id === undefined) return undefined
  const type = model.unitTypes.find((held) => held.id === id)
  if (type) return { kind: 'unitType', item: type }
  const role = model.roles.find((held) => held.id === id)
  if (role) return { kind: 'role', item: role }
  const responsibility = model.responsibilities.find((held) => held.id === id)
  return responsibility ? { kind: 'responsibility', item: responsibility } : undefined
}
