// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model, written (ADR-0036): a unit type and a role added and
 * changed, as the page adds and changes them — one command each, under the
 * agent's name, at the organisation.
 *
 * The operating model is kept at the organisation and edited there only, so
 * a write with another scope open is refused rather than landed on it. What a
 * slot, a place or a duty names is checked against what the organisation
 * holds; what the model says about itself — a responsibility nobody is
 * accountable for — is a finding the lists report, never a refusal here.
 */
import type { Command } from '../../model/commands'
import { isDay } from '../../model/lifecycle'
import { operatingRulesOf, responsibilitiesOf, rolesOf, unitTypesOf } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import { toArrays } from '../../model/normalised'
import { linesSaid } from '../../model/operatingModel'
import type { Dated, Duty, Raci, ReportsTo, Role, RoleSlot, UnitType } from '../../model/operatingModel'
import { refuseRoleLines, refuseSlotLine } from '../../model/reporting'
import { roleLine, unitTypeLine } from '../operatingModel'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import { daysOf, kindOf, lineRefused, organisationOfView } from './reporting'
import type { Args, Handler, Prepared, WriteView } from './shared'

/** The organisation's path: the one scope the operating model is written in. */
const ORGANISATION = ''

function atOrganisation(view: WriteView): AgentAnswer | undefined {
  return view.scopePath === ORGANISATION
    ? undefined
    : refused('agent.scopeNotOpen', 'the organisation, where the operating model is kept: app.open with scope "" first')
}

/** A name, trimmed, or the refusal for a blank one. */
function nameOf(value: unknown): string | AgentAnswer {
  const name = typeof value === 'string' ? value.trim() : ''
  return name ? name : refused('agent.badArguments', '"name" must not be blank')
}

/** Optional text: trimmed, and blank or null taken away. */
function textPatch(args: Args, key: string): Record<string, string | undefined> {
  if (!(key in args)) return {}
  const value = typeof args[key] === 'string' ? (args[key] as string).trim() : ''
  return { [key]: value || undefined }
}

/** A flag: true, or taken away. */
function flagPatch(args: Args, key: string): Record<string, true | undefined> {
  return key in args ? { [key]: args[key] === true ? true : undefined } : {}
}

/** An id the organisation does not mint itself twice: what `makeId` gave, made distinct. */
function freshId(prefix: string, model: Model, view: WriteView): string {
  const taken = new Set([...model.order.unitTypes, ...model.order.roles, ...model.order.responsibilities])
  const id = view.makeId(prefix)
  let held = id
  for (let n = 2; taken.has(held); n += 1) held = `${id}-${n}`
  return held
}

/** The slots as given, every role one the organisation holds. */
function slotsOf(given: unknown, model: Model): RoleSlot[] | AgentAnswer {
  const roles = rolesOf(model)
  const slots: RoleSlot[] = []
  for (const [index, one] of ((given as Record<string, unknown>[] | undefined) ?? []).entries()) {
    const role = one.roleId as string
    if (!roles[role]) return refused('agent.unknownId', `slots[${index}]: role ${role}`)
    const min = one.min as number
    const max = one.max as number | undefined | null
    if (typeof max === 'number' && max < min) return refused('agent.badArguments', `slots[${index}]: max ${max} is less than min ${min}`)
    const reportsTo = reportsToOf(one.reportsTo, roles, `slots[${index}].reportsTo`, true)
    if (reportsTo && 'ok' in reportsTo) return reportsTo
    slots.push({ role, min, ...(typeof max === 'number' ? { max } : {}), ...(reportsTo ? { reportsTo } : {}) })
  }
  return slots
}

/**
 * The reporting lines as given (ADR-0039 §2, amended): each a role the
 * organisation holds — or none, by nesting, on a slot only — solid where no
 * kind is said, at most one of each kind, its days in order.
 */
function reportsToOf(given: unknown, roles: Readonly<Record<string, Role>>, at: string, onSlot: boolean): ReportsTo[] | AgentAnswer | undefined {
  if (given === undefined || given === null) return undefined
  const rows = Array.isArray(given) ? given : [given]
  const lines: ReportsTo[] = []
  for (const [index, one] of (rows as Record<string, unknown>[]).entries()) {
    const role = one.roleId as string | undefined
    if (role !== undefined && !roles[role]) return refused('agent.unknownId', `${at}[${index}]: role ${role}`)
    if (role === undefined && !onSlot) return refused('agent.badArguments', `${at}[${index}]: a role's line names the role reported to`)
    const days = daysOf(one)
    if ('ok' in days) return days
    const kind = kindOf(one.kind)
    if (lines.some((line) => line.kind === kind)) return refused('agent.badArguments', `${at}[${index}]: a second ${kind} line; at most one of each kind`)
    lines.push({ ...(role !== undefined ? { role } : {}), kind, ...(one.within === true ? { within: true } : {}), ...days })
  }
  return lines.length ? lines : undefined
}

/**
 * Whether a unit type's slots as changed would close a loop of solid lines
 * over the organisation, on the day written or a line's first day (ADR-0039
 * §5), or point a role at itself in the same unit: the refusal, or nothing.
 */
function slotLoop(view: WriteView, typeId: string, slots: readonly RoleSlot[] | undefined): AgentAnswer | undefined {
  if (!slots?.some((slot) => linesSaid(slot.reportsTo).some((line) => line.role !== undefined))) return undefined
  const organisation = organisationOfView(view)
  for (const slot of slots) {
    const refusal = refuseSlotLine(organisation, typeId, slots, view.today(), slot.reportsTo, slot.role)
    if (refusal) return lineRefused(refusal, organisation)
  }
  return undefined
}

/** Whether a role's lines as changed would close a loop, or point the role at itself in the same unit. */
function roleLoop(view: WriteView, roleId: string, said: ReportsTo[] | undefined): AgentAnswer | undefined {
  if (!said?.length) return undefined
  const organisation = organisationOfView(view)
  const refusal = refuseRoleLines(organisation, roleId, said, view.today())
  return refusal && lineRefused(refusal, organisation)
}

/** The unit types given as where a type may sit, every one held and none the type itself. */
function withinOf(given: unknown, model: Model, self: string | undefined): string[] | AgentAnswer {
  const types = unitTypesOf(model)
  const within = [...new Set((given as string[] | undefined) ?? [])]
  for (const id of within) {
    if (!types[id]) return refused('agent.unknownId', `within: unit type ${id}`)
    if (id === self) return refused('agent.badArguments', 'a unit type cannot sit in itself')
  }
  return within
}

/** The duties as given, every responsibility one the organisation holds, each once. */
function dutiesOf(given: unknown, model: Model): Duty[] | AgentAnswer {
  const responsibilities = responsibilitiesOf(model)
  const duties: Duty[] = []
  for (const [index, one] of ((given as Record<string, unknown>[] | undefined) ?? []).entries()) {
    const responsibility = one.responsibilityId as string
    if (!responsibilities[responsibility]) return refused('agent.unknownId', `duties[${index}]: responsibility ${responsibility}`)
    if (duties.some((duty) => duty.responsibility === responsibility)) {
      return refused('agent.badArguments', `duties[${index}]: ${responsibility} is given twice; a role has one part in a responsibility`)
    }
    duties.push({ responsibility, raci: one.raci as Raci })
  }
  return duties
}

/**
 * A unit type's or a role's days and successors as given (ADR-0036 §6):
 * days that are days and run forwards over what the record keeps for the
 * half not given, and successors of the same kind, never itself. Null or an
 * empty list takes a field away.
 */
function datedPatch(args: Args, held: Dated | undefined, known: Readonly<Record<string, unknown>>, self: string | undefined): Dated | AgentAnswer {
  const patch: Dated = {}
  for (const key of ['from', 'until'] as const) {
    if (!(key in args)) continue
    if (args[key] === null) { patch[key] = undefined; continue }
    if (!isDay(args[key])) return refused('agent.badArguments', `"${key}" must be yyyy-mm-dd`)
    patch[key] = args[key]
  }
  const from = 'from' in patch ? patch.from : held?.from
  const until = 'until' in patch ? patch.until : held?.until
  if (isDay(from) && isDay(until) && until < from) return refused('agent.badArguments', '"until" must not be before "from"')
  if ('successors' in args) {
    const given = [...new Set((args.successors as string[] | null | undefined) ?? [])]
    for (const id of given) {
      if (id === self) return refused('agent.badArguments', 'nothing follows itself')
      if (!(id in known)) return refused('agent.unknownId', `successors: ${id}`)
    }
    patch.successors = given.length ? given : undefined
  }
  return patch
}

/** The fields of a unit type the request gives, checked. */
function unitTypePatch(args: Args, model: Model, self: string | undefined): Partial<UnitType> | AgentAnswer {
  const dated = datedPatch(args, self === undefined ? undefined : unitTypesOf(model)[self], unitTypesOf(model), self)
  if ('ok' in dated) return dated
  const patch: Partial<UnitType> = { ...textPatch(args, 'purpose'), ...flagPatch(args, 'top'), ...flagPatch(args, 'spans'), ...dated }
  if ('within' in args && args.within !== null) {
    const within = withinOf(args.within, model, self)
    if ('ok' in within) return within
    patch.within = within
  }
  if ('slots' in args && args.slots !== null) {
    const slots = slotsOf(args.slots, model)
    if ('ok' in slots) return slots
    patch.slots = slots
  }
  if ('limit' in args) patch.limit = typeof args.limit === 'number' ? args.limit : undefined
  if ('order' in args) patch.order = typeof args.order === 'number' && Number.isFinite(args.order) ? args.order : undefined
  return patch
}

/** The fields of a role the request gives, checked. */
function rolePatch(args: Args, model: Model, self?: string): Partial<Role> | AgentAnswer {
  const dated = datedPatch(args, self === undefined ? undefined : rolesOf(model)[self], rolesOf(model), self)
  if ('ok' in dated) return dated
  const patch: Partial<Role> = { ...textPatch(args, 'short'), ...textPatch(args, 'purpose'), ...flagPatch(args, 'manages'), ...dated }
  if ('duties' in args && args.duties !== null) {
    const duties = dutiesOf(args.duties, model)
    if ('ok' in duties) return duties
    patch.duties = duties
  }
  if ('reportsTo' in args) {
    const reportsTo = reportsToOf(args.reportsTo, rolesOf(model), 'reportsTo', false)
    if (reportsTo && 'ok' in reportsTo) return reportsTo
    patch.reportsTo = reportsTo
  }
  return patch
}

/** A record with its patch laid over, absent fields taken out, as the writer will hold it. */
function laid<T extends object>(held: T, patch: Partial<T>): T {
  const next = { ...held, ...patch } as Record<string, unknown>
  for (const key of Object.keys(patch)) if (next[key] === undefined) delete next[key]
  return next as T
}

/** The model's operating lists after a change, for the answer to name what it points at. */
function documentWith(model: Model, command: Command) {
  const arrays = toArrays(model)
  const swap = <T extends { id: string }>(list: T[] | undefined, row: T): T[] => {
    const held = list ?? []
    return held.some((one) => one.id === row.id) ? held.map((one) => (one.id === row.id ? row : one)) : [...held, row]
  }
  if (command.type === 'unitType.add') return { ...arrays, unitTypes: swap(arrays.unitTypes, command.unitType) }
  if (command.type === 'role.add') return { ...arrays, roles: swap(arrays.roles, command.role) }
  return { ...arrays, operatingRules: Object.values(operatingRulesOf(model)) }
}

function prepared(command: Command, answer: AgentAnswer): Prepared {
  return { command: { ...command, origin: 'agent' }, answer }
}

export const addUnitType: Handler = (args, view) => {
  const wrong = atOrganisation(view)
  if (wrong) return wrong
  const name = nameOf(args.name)
  if (typeof name !== 'string') return name
  const patch = unitTypePatch(args, view.model, undefined)
  if ('ok' in patch) return patch
  const unitType = laid<UnitType>({ id: freshId('ut', view.model, view), name, within: [], slots: [] }, {
    // Somewhere to sit: at the top where no type to sit in is named.
    ...(!('top' in args) && !(patch.within?.length) ? { top: true } : {}),
    ...patch,
  })
  const command: Command = { type: 'unitType.add', unitType }
  return prepared(command, json(unitTypeLine(unitType, documentWith(view.model, command))))
}

export const updateUnitType: Handler = (args, view) => {
  const wrong = atOrganisation(view)
  if (wrong) return wrong
  const held = unitTypesOf(view.model)[args.id as string]
  if (!held) return refused('agent.unknownId', `unit type ${String(args.id)}`)
  const name = 'name' in args && args.name !== null ? nameOf(args.name) : undefined
  if (name !== undefined && typeof name !== 'string') return name
  const patch = unitTypePatch(args, view.model, held.id)
  if ('ok' in patch) return patch
  const loop = slotLoop(view, held.id, patch.slots)
  if (loop) return loop
  const full = { ...patch, ...(name !== undefined ? { name } : {}) }
  const command: Command = { type: 'unitType.update', id: held.id, patch: full }
  const after = laid(held, full)
  return prepared(command, json(unitTypeLine(after, documentWith(view.model, { type: 'unitType.add', unitType: after }))))
}

export const addRole: Handler = (args, view) => {
  const wrong = atOrganisation(view)
  if (wrong) return wrong
  const name = nameOf(args.name)
  if (typeof name !== 'string') return name
  const patch = rolePatch(args, view.model)
  if ('ok' in patch) return patch
  const role = laid<Role>({ id: freshId('ro', view.model, view), name, duties: [] }, patch)
  // A new role's own line can point only at itself in the same unit, since nothing holds it yet; still asked, so the answer is one.
  const loop = roleLoop(view, role.id, linesSaid(role.reportsTo))
  if (loop) return loop
  const command: Command = { type: 'role.add', role }
  return prepared(command, json(roleLine(role, documentWith(view.model, command))))
}

export const updateRole: Handler = (args, view) => {
  const wrong = atOrganisation(view)
  if (wrong) return wrong
  const held = rolesOf(view.model)[args.id as string]
  if (!held) return refused('agent.unknownId', `role ${String(args.id)}`)
  const name = 'name' in args && args.name !== null ? nameOf(args.name) : undefined
  if (name !== undefined && typeof name !== 'string') return name
  const patch = rolePatch(args, view.model, held.id)
  if ('ok' in patch) return patch
  const loop = 'reportsTo' in patch ? roleLoop(view, held.id, patch.reportsTo as ReportsTo[] | undefined) : undefined
  if (loop) return loop
  const full = { ...patch, ...(name !== undefined ? { name } : {}) }
  const command: Command = { type: 'role.update', id: held.id, patch: full }
  const after = laid(held, full)
  return prepared(command, json(roleLine(after, documentWith(view.model, { type: 'role.add', role: after }))))
}
