// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's writes on the open scope's evaluations of building blocks
 * (ADR-0043 §4, §5, §7), the family `model/commands/evaluations.ts` applies:
 * an evaluation started for the usage contexts that apply here, an option
 * rated against a capability, and the decision the evaluation becomes,
 * proposed as the block's page proposes it (`decisions/blockDecision.ts`).
 */
import { blockDecision, supportsCopied } from '../../decisions/blockDecision'
import { transaction } from '../../model/commands'
import { evaluationId, startedEvaluation } from '../../model/evaluation'
import { decisionList, evaluationsOf } from '../../model/normalised'
import type { DesignElement } from '../../model/types'
import { json, refused } from '../tools'
import type { Args, Handler, WriteView } from './shared'
import { text } from './shared'

/** A building block by id: kept here, or anywhere the tree's records say, with the scope that keeps it. */
function blockNamed(view: WriteView, id: string): { scope: string; block: DesignElement } | undefined {
  const here = view.model.elements[id]
  if (here?.kind === 'buildingBlock') return { scope: view.scopePath, block: here }
  return view.tree?.records?.().blocks().find((one) => one.block.id === id)
}

export const startEvaluation: Handler = (args: Args, view) => {
  const id = args.block as string
  const kept = blockNamed(view, id)
  if (!kept) return refused('agent.unknownId', `building block ${id} (blocks.list)`)
  if (Object.values(evaluationsOf(view.model)).some((one) => one.block.id === id)) {
    return refused('agent.badArguments', `this scope already evaluates ${kept.block.name}: rate its options with evaluation.rate`)
  }
  const held = kept.block.contexts ?? []
  const named = Array.isArray(args.contexts) ? (args.contexts as unknown[]).map(String) : held.map((one) => one.id)
  const contexts = named.map((word) => held.find((one) => one.id === word) ?? held.find((one) => one.name.toLowerCase() === word.trim().toLowerCase()))
  const missing = named.find((_word, at) => contexts[at] === undefined)
  if (missing !== undefined) return refused('agent.unknownId', `usage context ${missing} of ${kept.block.name}`)
  const from = text(args.copyFrom)
  const copied = from === undefined ? undefined : view.tree?.records?.().evaluations().find((one) => one.scope === from && one.evaluation.block.id === id)?.evaluation
  if (from !== undefined && !copied) return refused('agent.unknownId', `an evaluation of ${kept.block.name} in ${from || 'the organisation'}`)
  const evaluation = startedEvaluation({ scope: kept.scope, id }, contexts.map((one) => one!.id), copied)
  return {
    command: { type: 'evaluation.add', evaluation, origin: 'agent' },
    answer: json({ evaluation: evaluation.id, block: id, contexts: evaluation.contexts, options: evaluation.options }),
  }
}

export const proposeChoice: Handler = (args: Args, view) => {
  const id = args.block as string
  const evaluation = Object.values(evaluationsOf(view.model)).find((one) => one.block.id === id)
  const kept = blockNamed(view, id)
  if (!evaluation || !kept || evaluation.id !== evaluationId(evaluation.block)) return refused('agent.unknownId', `this scope's evaluation of building block ${id}`)
  const asked = String(args.option ?? '')
  const option = (kept.block.sbbs ?? []).find((one) => one.id === asked || one.name.toLowerCase() === asked.trim().toLowerCase())
  if (!option || !evaluation.options.includes(option.id)) {
    return refused('agent.badArguments', `${asked} is not an option weighed here: add and rate it with evaluation.rate first`)
  }
  const decision = blockDecision({
    block: kept.block, evaluation, option: option.id, id: view.makeId('adr'), date: view.today(), s: view.translate,
    scope: { path: view.scopePath, name: view.model.name, decisions: decisionList(view.model), keepsBlock: kept.scope === view.scopePath },
  })
  const supports = supportsCopied(view.tree?.records?.().citations() ?? [], { scope: kept.scope, id }, decision.id, view.makeId, view.today())
  return {
    command: transaction([{ type: 'decision.add', decision }, ...supports], { origin: 'agent' }),
    answer: json({ decision: decision.id, number: decision.number, title: decision.title, status: decision.status, chooses: option.id, supports: supports.length }),
  }
}

export const rateEvaluation: Handler = (args: Args, view) => {
  const block = args.block as { scope?: string; id: string }
  const held = Object.values(evaluationsOf(view.model)).find((one) => one.block.id === block.id && (block.scope === undefined || one.block.scope === block.scope))
  if (!held) return refused('agent.unknownId', `this scope's evaluation of building block ${block.id}`)
  const option = args.option as string
  const capability = args.capability as string
  const level = args.level as 0 | 1 | 2 | 3 | 4
  const how = text(args.how)
  const coverage = {
    ...held.coverage,
    [option]: { ...held.coverage[option], [capability]: { level, ...(how ? { how } : {}) } },
  }
  const options = held.options.includes(option) ? held.options : [...held.options, option]
  return {
    command: { type: 'evaluation.update', id: held.id, patch: { coverage, options }, origin: 'agent' },
    answer: json({ evaluation: held.id, option, capability, level }),
  }
}
