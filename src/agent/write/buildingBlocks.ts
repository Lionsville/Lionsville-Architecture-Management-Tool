// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's writes on a building block kept in the open scope (ADR-0043 §2,
 * §3): its requirements — the capabilities it must provide and the usage
 * contexts it serves, each with what it needs — and its catalogue of
 * solutions. Each list is given whole and lands as the block's
 * `element.update`, as the block's page writes it; an item keeps the id it is
 * given and is given one where it has none, and a context's needs may name a
 * capability by its id or by its words.
 */
import { blockRefusal, isBlockLevel } from '../../model/buildingBlock'
import type { BlockCapability, BlockLevel, DesignElement, SolutionBlock, UsageContext } from '../../model/types'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Args, Handler, WriteView } from './shared'
import { text } from './shared'

type Row = Record<string, unknown>

const rows = (value: unknown): Row[] | undefined => (Array.isArray(value) ? value as Row[] : undefined)

function capabilitiesAsked(asked: Row[], view: WriteView): BlockCapability[] {
  return asked.map((one) => ({
    id: text(one.id) ?? view.makeId('cap'), text: String(one.text ?? '').trim(),
    ...(one.must === true ? { must: true as const } : {}),
    ...(text(one.function) ? { function: text(one.function)! } : {}),
  }))
}

/** A context's needs by capability id, a capability named by its words found among `capabilities`; what names none is said. */
function contextsAsked(asked: Row[], capabilities: readonly BlockCapability[], view: WriteView): UsageContext[] | string {
  const out: UsageContext[] = []
  for (const one of asked) {
    const needs: Record<string, BlockLevel> = {}
    for (const [named, level] of Object.entries((one.needs ?? {}) as Record<string, unknown>)) {
      const capability = capabilities.find((held) => held.id === named) ?? capabilities.find((held) => held.text.toLowerCase() === named.trim().toLowerCase())
      if (!capability) return `context ${String(one.name ?? one.id)} needs ${named}, which is not one of the block's capabilities`
      if (!isBlockLevel(level)) return `a need is a level from 0 to 4, not ${String(level)}`
      needs[capability.id] = level
    }
    const description = text(one.description)
    out.push({ id: text(one.id) ?? view.makeId('cx'), name: String(one.name ?? '').trim(), ...(description ? { description } : {}), needs })
  }
  return out
}

function solutionsAsked(asked: Row[], view: WriteView): SolutionBlock[] {
  return asked.map((one) => ({
    id: text(one.id) ?? view.makeId('sb'), name: String(one.name ?? '').trim(),
    ...(text(one.supplier) ? { supplier: text(one.supplier)! } : {}),
    sort: one.sort as SolutionBlock['sort'], status: (one.status ?? 'candidate') as SolutionBlock['status'],
    ...(Array.isArray(one.elements) && one.elements.length ? { elements: (one.elements as unknown[]).map(String) } : {}),
  }))
}

/** The block's fields as asked, laid over what it holds, or what is wrong with them. */
function blockPatch(args: Args, held: DesignElement, view: WriteView): Partial<DesignElement> | AgentAnswer {
  const patch: Partial<DesignElement> = {}
  const capabilities = rows(args.capabilities)
  if (capabilities) patch.capabilities = capabilitiesAsked(capabilities, view)
  const contexts = rows(args.contexts)
  if (contexts) {
    const read = contextsAsked(contexts, patch.capabilities ?? held.capabilities ?? [], view)
    if (typeof read === 'string') return refused('agent.badArguments', read)
    patch.contexts = read
  }
  const sbbs = rows(args.sbbs)
  if (sbbs) patch.sbbs = solutionsAsked(sbbs, view)
  if (Object.keys(patch).length === 0) return refused('agent.badArguments', 'nothing to change: give capabilities, contexts or sbbs')
  return patch
}

export const updateBlock: Handler = (args, view) => {
  const id = args.id as string
  const held = view.model.elements[id]
  if (!held || held.kind !== 'buildingBlock') return refused('agent.unknownId', `building block ${id} kept in this scope (blocks.list says where each is kept)`)
  const patch = blockPatch(args, held, view)
  if ('ok' in patch) return patch
  // What the reducer would refuse, said with what is wrong: a dropped capability a context still needs, an empty name.
  if (blockRefusal({ ...held, ...patch })) {
    return refused('command.badBlock', 'every capability has words, every context and solution a name, a solution a sort and a status, and a context needs only the block\'s capabilities')
  }
  return {
    command: { type: 'element.update', id, patch, origin: 'agent' },
    answer: json({
      id, changed: Object.keys(patch),
      ...(patch.capabilities ? { capabilities: patch.capabilities.map((one) => ({ id: one.id, text: one.text })) } : {}),
      ...(patch.contexts ? { contexts: patch.contexts.map((one) => ({ id: one.id, name: one.name })) } : {}),
      ...(patch.sbbs ? { sbbs: patch.sbbs.map((one) => ({ id: one.id, name: one.name })) } : {}),
    }),
  }
}
