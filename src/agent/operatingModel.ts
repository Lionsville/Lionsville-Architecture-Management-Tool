// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model, read (ADR-0036): the unit types, the roles and the
 * responsibilities, as the agent's three lists say them.
 *
 * The operating model is kept at the organisation, so these answer from the
 * organisation's document whatever scope is open — the session's model where
 * the organisation is the scope open, its document as it is kept otherwise
 * (`handle.ts`). Each line names what it points at by id and by name, so an
 * agent can write a slot or a duty without a second call. The unit types are
 * listed as the structure stands (`model/unitOrder.ts`): by lane, then by
 * their order in it, then by name, those that sit nowhere last.
 */
import type { HostModel } from '../model/hostModel'
import { accountableFor, raciOf, typesHolding } from '../model/operatingModel'
import type { BasedOn, Dated, Responsibility, Role, UnitType, UnitTypeId } from '../model/operatingModel'
import { unitTypeLanes } from '../model/unitOrder'
import type { AgentAnswer, ToolName } from './tools'
import { checkArguments, json, refused, toolSpec } from './tools'

/** The three reads of the operating model. */
export const OPERATING_READS = ['unitTypes.list', 'roles.list', 'responsibilities.list'] as const satisfies readonly ToolName[]

export type OperatingRead = (typeof OPERATING_READS)[number]

export function isOperatingRead(tool: string): tool is OperatingRead {
  return (OPERATING_READS as readonly string[]).includes(tool)
}

/** The operating model's lists out of a document, each present. */
export type OperatingDocument = Pick<HostModel, 'unitTypes' | 'roles' | 'responsibilities' | 'operatingRules'>

const named = (list: readonly { id: string; name: string }[], id: string) => ({ id, name: list.find((one) => one.id === id)?.name ?? id })

/** A unit type's or a role's days and successors (ADR-0036 §6), each only where said. */
function datedLine(dated: Dated, list: readonly { id: string; name: string }[]) {
  return {
    ...(dated.from ? { from: dated.from } : {}),
    ...(dated.until ? { until: dated.until } : {}),
    ...(dated.successors?.length ? { successors: dated.successors.map((id) => named(list, id)) } : {}),
  }
}

const entryLine = (basedOn: BasedOn) => ({ library: basedOn.library, entry: basedOn.entry, version: basedOn.version })

/**
 * The library entry an item was made from, with the name it was given then
 * where that was not the library's term; and, for a unit type or a role, the
 * entries a bring-in matched it to (`alsoBasedOn`), beside it.
 */
function basedOnLine(item: { basedOn?: BasedOn; alsoBasedOn?: readonly BasedOn[] }) {
  const { basedOn, alsoBasedOn } = item
  return {
    ...(basedOn ? { basedOn: { ...entryLine(basedOn), ...(basedOn.name ? { name: basedOn.name } : {}) } } : {}),
    ...(alsoBasedOn?.length ? { alsoBasedOn: alsoBasedOn.map(entryLine) } : {}),
  }
}

/**
 * One unit type as the agent reads it: its lane where it has one (1 for a
 * type at the top), and its order in the lane where one is said.
 */
export function unitTypeLine(
  type: UnitType, model: OperatingDocument, laneOf: ReadonlyMap<UnitTypeId, number> = unitTypeLanes(model.unitTypes ?? []).laneOf,
) {
  const roles = model.roles ?? []
  const lane = laneOf.get(type.id)
  return {
    id: type.id,
    name: type.name,
    ...(type.purpose ? { purpose: type.purpose } : {}),
    ...(lane !== undefined ? { lane } : { sitsNowhere: true }),
    ...(type.order !== undefined ? { order: type.order } : {}),
    ...(type.top ? { top: true } : {}),
    within: type.within.map((id) => named(model.unitTypes ?? [], id)),
    ...(type.spans ? { spans: true } : {}),
    slots: type.slots.map((slot) => ({
      roleId: slot.role, role: named(roles, slot.role).name, min: slot.min, ...(slot.max !== undefined ? { max: slot.max } : {}),
    })),
    ...(type.limit !== undefined ? { limit: type.limit } : {}),
    ...datedLine(type, model.unitTypes ?? []),
    ...basedOnLine(type),
  }
}

/** One role as the agent reads it. */
export function roleLine(role: Role, model: OperatingDocument) {
  const responsibilities = model.responsibilities ?? []
  return {
    id: role.id,
    name: role.name,
    ...(role.short ? { short: role.short } : {}),
    ...(role.purpose ? { purpose: role.purpose } : {}),
    ...(role.manages ? { manages: true } : {}),
    duties: role.duties.map((duty) => ({
      responsibilityId: duty.responsibility, responsibility: named(responsibilities, duty.responsibility).name, raci: duty.raci,
    })),
    heldIn: typesHolding(model.unitTypes ?? [], role.id).map((type) => ({ id: type.id, name: type.name })),
    ...datedLine(role, model.roles ?? []),
    ...basedOnLine(role),
  }
}

/** One responsibility as the agent reads it, with every role's part and the finding where there is one. */
export function responsibilityLine(responsibility: Responsibility, model: OperatingDocument) {
  const roles = model.roles ?? []
  const accountable = accountableFor(roles, responsibility.id)
  const finding = accountable.length === 1 ? {} : { finding: accountable.length === 0 ? 'nobody is accountable' : `${accountable.length} roles are accountable` }
  return {
    id: responsibility.id,
    name: responsibility.name,
    ...(responsibility.description ? { description: responsibility.description } : {}),
    ...(responsibility.group ? { group: responsibility.group } : {}),
    raci: roles.flatMap((role) => {
      const raci = raciOf(role, responsibility.id)
      return raci ? [{ roleId: role.id, role: role.name, raci }] : []
    }),
    accountable: accountable.map((role) => ({ id: role.id, name: role.name })),
    ...finding,
    ...basedOnLine(responsibility),
  }
}

/** One of the three reads, over the organisation's document. */
export function answerOperating(tool: OperatingRead, rawArgs: unknown, model: OperatingDocument): AgentAnswer {
  const wrong = checkArguments(toolSpec(tool).inputSchema, rawArgs)
  if (wrong) return refused('agent.badArguments', wrong)
  const args = (rawArgs ?? {}) as Record<string, unknown>
  const unitTypes = model.unitTypes ?? []
  const roles = model.roles ?? []
  const responsibilities = model.responsibilities ?? []
  switch (tool) {
    case 'unitTypes.list': {
      const { lanes, laneOf, nowhere } = unitTypeLanes(unitTypes)
      const listed = [...lanes.flatMap((lane) => lane.types), ...nowhere]
      return json({ scope: '', unitTypes: listed.map((type) => unitTypeLine(type, model, laneOf)) })
    }
    case 'roles.list': {
      const type = typeof args.unitTypeId === 'string' ? unitTypes.find((one) => one.id === args.unitTypeId) : undefined
      if (args.unitTypeId !== undefined && args.unitTypeId !== null && !type) return refused('agent.unknownId', `unit type ${String(args.unitTypeId)}`)
      const duty = typeof args.responsibilityId === 'string' ? args.responsibilityId : undefined
      if (duty !== undefined && !responsibilities.some((one) => one.id === duty)) return refused('agent.unknownId', `responsibility ${duty}`)
      return json({
        scope: '',
        roles: roles
          .filter((role) => !type || type.slots.some((slot) => slot.role === role.id))
          .filter((role) => duty === undefined || raciOf(role, duty) !== undefined)
          .map((role) => roleLine(role, model)),
        rules: (model.operatingRules ?? []).map((rule) => ({ kind: rule.id, roleId: rule.role, role: named(roles, rule.role).name })),
      })
    }
    case 'responsibilities.list':
      return json({
        scope: '',
        responsibilities: responsibilities
          .filter((one) => typeof args.group !== 'string' || (one.group ?? '') === args.group)
          .map((one) => responsibilityLine(one, model)),
      })
  }
}
