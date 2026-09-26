// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The rows between two elements: a flow (`connect`, `connection.*`), the four
 * types the business layer needs (`relation.*`), what an application uses
 * (`technology.use`), and the interface the container lines imply
 * (`interface.accept`).
 */
import type { Command } from '../../model/commands'
import { transaction } from '../../model/commands'
import { isDay } from '../../model/lifecycle'
import { technologyEndsRefusal } from '../../model/relations'
import { mayBeHosted } from '../../model/hosting'
import { acceptImplied, impliedInterfaces } from '../../model/implied'
import type { EdgeLineStyle, ElementId, Relation, RelationType } from '../../model/types'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Args, Handler, WriteView } from './shared'
import { hexColour, merged, withDetail } from './shared'

export const connect: Handler = (args, view) => {
  const { model } = view
  const sourceId = args.sourceId as string
  const targetId = args.targetId as string
  for (const id of [sourceId, targetId]) if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
  if (sourceId === targetId) return refused('agent.badArguments', 'a connection needs two different elements')
  const bare: Relation = { id: view.ids.connection(), type: 'flow', sourceId, targetId, isBidirectional: false }
  const patch = relationPatch(args, bare)
  if ('ok' in patch) return patch
  const relation = merged(bare, patch)
  return {
    command: { type: 'relation.create', relation, origin: 'agent' },
    answer: json({ id: relation.id, sourceId, targetId }),
  }
}

export const updateConnection: Handler = (args, view) => {
  const id = args.id as string
  const held = view.model.relations[id]
  if (!held) return refused('agent.unknownId', `connection ${id}`)
  const patch = relationPatch(args, held)
  if ('ok' in patch) return patch
  return {
    command: { type: 'relation.update', id, patch, origin: 'agent' },
    answer: json({ id, changed: Object.keys(patch) }),
  }
}

export const updateConnections: Handler = (args, view) => {
  const items = args.items as Args[]
  const commands: Command[] = []
  const changed: { id: string; changed: string[] }[] = []
  for (const [index, item] of items.entries()) {
    const id = item.id as string
    const held = view.model.relations[id]
    if (!held) return refused('agent.unknownId', `connection ${id}`)
    const patch = relationPatch(item, held)
    if ('ok' in patch) return withDetail(patch, `items[${index}]`)
    commands.push({ type: 'relation.update', id, patch })
    changed.push({ id, changed: Object.keys(patch) })
  }
  return { command: transaction(commands, { origin: 'agent' }), answer: json({ updated: changed }) }
}

/**
 * The application interface the container lines imply, written, with every
 * one of them landed on it (ADR-0013). One step, one undo, and the same
 * arithmetic the finding came from — so an agent that accepts a finding
 * gets exactly what a person pressing *Accept* gets.
 */
export const acceptInterface: Handler = (args, view) => {
  const { model } = view
  const id = args.id as string
  if (!model.relations[id]) return refused('agent.unknownId', `connection ${id}`)
  const relations = model.order.relations.map((held) => model.relations[held])
  const implied = impliedInterfaces(relations, (held) => model.elements[held])
    .find((one) => one.relations.some((row) => row.id === id))
  if (!implied) {
    return refused('agent.badArguments', `${id} is not a container-level line without an application interface`)
  }
  const made = view.ids.connection()
  const nameOf = (held: ElementId) => model.elements[held]?.name ?? held
  const command = acceptImplied(implied, made, nameOf)
  return {
    command: { ...command, origin: 'agent' },
    answer: json({
      id: made,
      sourceId: implied.sourceId,
      targetId: implied.targetId,
      refinements: implied.relations.map((row) => row.id),
    }),
  }
}

export const removeConnection: Handler = (args, view) => {
  const id = args.id as string
  if (!view.model.relations[id]) return refused('agent.unknownId', `connection ${id}`)
  return { command: { type: 'relation.delete', id, origin: 'agent' }, answer: json({ id, removed: true }) }
}

export const removeConnections: Handler = (args, view) => {
  const ids = [...new Set(args.ids as string[])]
  for (const id of ids) if (!view.model.relations[id]) return refused('agent.unknownId', `connection ${id}`)
  return {
    command: transaction(ids.map((id) => ({ type: 'relation.delete' as const, id })), { origin: 'agent' }),
    answer: json({ removed: ids }),
  }
}

// --- the business layer's rows (ADR-0012 §5) ---------------------------------------------

/**
 * The four types the business layer needs (ADR-0012 §5). A flow keeps
 * `connect` and `connection.*`, which are published names and say more —
 * a protocol, a direction, a colour — because only a flow has them.
 */
export const addRelation: Handler = (args, view) => {
  const type = args.type as RelationType
  const sourceId = args.sourceId as string
  const targetId = args.targetId as string
  const wrong = relationEndsRefusal(type, sourceId, targetId, view)
  if (wrong) return wrong
  const bare: Relation = { id: view.ids.connection(), type, sourceId, targetId }
  const patch = relationPatch(args, bare)
  if ('ok' in patch) return patch
  const relation = merged(bare, patch)
  return {
    command: { type: 'relation.create', relation, origin: 'agent' },
    answer: json({ id: relation.id, type, sourceId, targetId }),
  }
}

/** Why a row of this type may not run between these two ends, or nothing. */
function relationEndsRefusal(type: RelationType, sourceId: string, targetId: string, view: WriteView): AgentAnswer | undefined {
  const { model } = view
  // One end may be another scope's, as long as the tree knows it; a row
  // about nothing this scope holds is somebody else's row to write.
  for (const id of [sourceId, targetId]) {
    if (!model.elements[id] && !view.known?.(id)) return refused('agent.unknownId', `element ${id}`)
  }
  if (!model.elements[sourceId] && !model.elements[targetId]) {
    return refused('agent.badArguments', 'a relation needs at least one end this scope holds')
  }
  if (sourceId === targetId) return refused('agent.badArguments', 'a relation needs two different elements')
  // The technology rows' ends (ADR-0013, ADR-0014), judged where this scope
  // can see what an end is; an id the tree knows and this scope does not
  // is trusted, as every other row's far end is. `hostedOn` is refused
  // with the writer's own key, so a tool call hears what a person hears.
  const wrongEnds = technologyEndsRefusal({ type, sourceId, targetId }, (id) => model.elements[id])
  if (wrongEnds === 'hostedOn') {
    return refused('command.technologyEnds', `${sourceId} → ${targetId}`)
  }
  if (wrongEnds !== undefined) {
    const kindOf = (id: string) => model.elements[id]?.kind ?? 'unknown'
    return refused('agent.badArguments', `${type} does not run ${kindOf(sourceId)} → ${kindOf(targetId)}`)
  }
  // Where an application with components runs is its components' to say
  // (ADR-0013, redone). Refused here as well as by the writer, with the
  // writer's own key, so a tool call hears the sentence a person hears.
  if (type === 'hostedOn' && !mayBeHosted(Object.values(model.elements), sourceId)) {
    return refused('command.hostedOnContainers', `${sourceId} has components; write the row from one of them`)
  }
  return undefined
}

export const updateRelation: Handler = (args, view) => {
  const id = args.id as string
  const held = view.model.relations[id]
  if (!held) return refused('agent.unknownId', `relation ${id}`)
  const patch = relationPatch(args, held)
  if ('ok' in patch) return patch
  if (typeof args.type === 'string') patch.type = args.type as RelationType
  return {
    command: { type: 'relation.update', id, patch, origin: 'agent' },
    answer: json({ id, changed: Object.keys(patch) }),
  }
}

export const removeRelation: Handler = (args, view) => {
  const id = args.id as string
  if (!view.model.relations[id]) return refused('agent.unknownId', `relation ${id}`)
  return { command: { type: 'relation.delete', id, origin: 'agent' }, answer: json({ id, removed: true }) }
}

// --- what an application uses (ADR-0020) -------------------------------------------------

/**
 * What an application uses, as one list (ADR-0020): the editor's `setUses`,
 * said to an agent. The rows lead and any stand-in comes first, as the editor
 * writes it, so one undo takes the step back whole.
 */
export const useTechnology: Handler = (args, view) => {
  const { model } = view
  const elementId = args.elementId as string
  const source = model.elements[elementId]
  if (!source) return refused('agent.unknownId', `element ${elementId}`)
  if (source.kind !== 'application' && source.kind !== 'component') {
    return refused('command.technologyEnds', `${elementId} is a ${source.kind}`)
  }
  const targets = usedTargets(elementId, args.targetIds as string[], view)
  if ('ok' in targets) return targets
  const { wanted, arrives } = targets
  const held = model.order.relations
    .map((id) => model.relations[id])
    .filter((row) => row.type === 'uses' && row.sourceId === elementId)
  const removed = held.filter((row) => !wanted.includes(row.targetId))
  const written = wanted
    .filter((targetId) => !held.some((row) => row.targetId === targetId))
    .map((targetId): Relation => ({ id: view.ids.connection(), type: 'uses', sourceId: elementId, targetId }))
  const answer = json({
    elementId,
    uses: wanted,
    written: written.map((row) => ({ id: row.id, targetId: row.targetId })),
    removed: removed.map((row) => ({ id: row.id, targetId: row.targetId })),
    standIns: arrives.map((command) => (command.type === 'element.create' ? command.element.id : '')).filter(Boolean),
  })
  // Saying what is already said is not a step.
  if (removed.length === 0 && written.length === 0) return answer
  return {
    command: transaction([
      ...arrives,
      ...removed.map((row): Command => ({ type: 'relation.delete', id: row.id })),
      ...written.map((relation): Command => ({ type: 'relation.create', relation })),
    ], { origin: 'agent' }),
    answer,
  }
}

const isTechnology = (kind: string) => kind === 'platform' || kind === 'platformService'

/** The targets asked for, once each, and the stand-in each one this scope does not hold arrives as. */
function usedTargets(
  elementId: string, targetIds: readonly string[], view: WriteView,
): { wanted: string[]; arrives: Command[] } | AgentAnswer {
  const wanted: string[] = []
  const arrives: Command[] = []
  for (const targetId of targetIds) {
    if (wanted.includes(targetId) || targetId === elementId) continue
    const held = view.model.elements[targetId]
    if (held) {
      if (!isTechnology(held.kind)) {
        return refused('command.technologyEnds', `${elementId} → ${targetId} is a ${held.kind}`)
      }
    } else {
      const standIn = view.standInFor?.(targetId)
      if (!standIn || !isTechnology(standIn.kind)) {
        return refused('agent.unknownId', `platform or platformService ${targetId}`)
      }
      arrives.push({ type: 'element.create', element: standIn })
    }
    wanted.push(targetId)
  }
  return { wanted, arrives }
}

// --- a line's fields --------------------------------------------------------------------

/**
 * What connect, connection.update and connections.update change on a line:
 * the words, the direction, the window and the look. Null clears a field;
 * the window has to be days and run forwards, checked against what the line
 * keeps for the half that was not given.
 */
function relationPatch(args: Args, held: Relation): Partial<Relation> | AgentAnswer {
  const look = lineLook(args)
  if ('ok' in look) return look
  const patch: Partial<Relation> = { ...look }
  for (const key of ['label', 'protocol', 'technology'] as const) {
    if (args[key] === null || args[key] === '') patch[key] = undefined
    else if (typeof args[key] === 'string') patch[key] = args[key] as string
  }
  // Which interface this one is part of (ADR-0013). Whether the ends satisfy
  // the rule is the reducer's to say, and is left to it: it is the writer, and
  // a second copy of the rule here is a second place for it to be wrong.
  if (args.refines !== undefined) {
    if (args.refines === null || args.refines === '') patch.refines = undefined
    else if (typeof args.refines === 'string') patch.refines = args.refines
    else return refused('agent.badArguments', '"refines" is the id of an interface, or null')
  }
  if (typeof args.isBidirectional === 'boolean') patch.isBidirectional = args.isBidirectional
  for (const key of ['validFrom', 'validUntil'] as const) {
    const value = args[key]
    if (value === undefined) continue
    if (value === null || value === '') patch[key] = undefined
    else if (isDay(value)) patch[key] = value
    else return refused('agent.badArguments', `${key} must be yyyy-mm-dd`)
  }
  const from = 'validFrom' in patch ? patch.validFrom : held.validFrom
  const until = 'validUntil' in patch ? patch.validUntil : held.validUntil
  if (from && until && until < from) return refused('agent.badArguments', 'validUntil must not be before validFrom')
  return patch
}

/**
 * The look of a line as a patch: a colour or a style that was asked for, and
 * `undefined` — a deletion, to the reducer — for solid and for an empty colour.
 */
function lineLook(args: Args): { color?: string; lineStyle?: EdgeLineStyle } | AgentAnswer {
  const out: { color?: string; lineStyle?: EdgeLineStyle } = {}
  if (args.color !== undefined && args.color !== null) {
    const color = hexColour(args.color)
    if (color === false) return refused('agent.badArguments', '"color" must be a hex colour like #c0392b')
    out.color = color === '' ? undefined : color
  }
  if (typeof args.lineStyle === 'string') out.lineStyle = args.lineStyle === 'solid' ? undefined : args.lineStyle as EdgeLineStyle
  return out
}
