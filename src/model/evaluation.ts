// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's evaluation of a building block (ADR-0043 §4, §5): which of the
 * block's usage contexts apply to the scope, which solutions it weighs, how
 * far each covers each capability, and — once a decision is accepted — which
 * it chose. A record of the scope that adopts the block, one per block,
 * under that scope's rights; the block itself may be kept anywhere.
 *
 * The fit is worked out openly. What the scope needs of a capability is the
 * most any of its contexts needs; over the capabilities it needs,
 *
 *   fit = Σ min(coverage, need) ÷ Σ need
 *
 * and a capability marked `must` that is needed and not covered fully fails
 * the option whatever its fit. Pure: the grid, its hover, the agent and a
 * document's `ref` all read this.
 */
import { isBlockLevel } from './buildingBlock'
import type { Adr } from './adr'
import type { Command } from './commands'
import type { BlockLevel, DesignElement, SolutionBlock } from './types'

export type EvaluationId = string

/** How far a solution covers a capability here, and how, in a note. */
export type Coverage = { level: BlockLevel; how?: string }

export type Evaluation = {
  /** `<block scope>~<block id>`, the block's scope written with dots (`evaluationId`): one per block in a scope. */
  id: EvaluationId
  /** The block evaluated, where it is kept. */
  block: { scope: string; id: string }
  /** The block's usage contexts that apply here, by id. */
  contexts: string[]
  /** The solutions weighed here, by id, in the order they are read. */
  options: string[]
  /** By solution, then by capability. */
  coverage: Record<string, Record<string, Coverage>>
  /** The solution chosen here, once a decision about the block is accepted (§7). */
  chosen?: string
  /** The decision that chose it. */
  decidedBy?: string
}

/** A scope's evaluation of a block, named by the block: the organisation's scope said as `-`, a path's slashes as dots. */
export function evaluationId(block: { scope: string; id: string }): EvaluationId {
  return `${block.scope === '' ? '-' : block.scope.replaceAll('/', '.')}~${block.id}`
}

/** The block an evaluation's id names, read back. */
export function blockOfEvaluationId(id: EvaluationId): { scope: string; id: string } | undefined {
  const at = id.indexOf('~')
  if (at <= 0 || at === id.length - 1) return undefined
  const scope = id.slice(0, at)
  return { scope: scope === '-' ? '' : scope.replaceAll('.', '/'), id: id.slice(at + 1) }
}

/** Why an evaluation does not hold together, or nothing: named by its block, levels on the balls, a choice among its options. */
export function evaluationRefusal(evaluation: Evaluation): 'command.badEvaluation' | undefined {
  const { block, contexts, options, coverage, chosen } = evaluation
  const named = typeof block?.scope === 'string' && typeof block.id === 'string' && block.id.length > 0 && evaluation.id === evaluationId(block)
  const lists = Array.isArray(contexts) && Array.isArray(options) && new Set(options).size === options.length
  const balls = typeof coverage === 'object' && coverage !== null
    && Object.values(coverage).every((row) => typeof row === 'object' && row !== null && Object.values(row).every((cell) => isBlockLevel(cell?.level)))
  const choice = chosen === undefined || (lists && options.includes(chosen))
  return named && lists && balls && choice ? undefined : 'command.badEvaluation'
}

/** What a scope needs of each capability: the most any of its contexts needs. */
export function needsOf(block: Pick<DesignElement, 'contexts'>, contexts: readonly string[]): Record<string, BlockLevel> {
  const needs: Record<string, BlockLevel> = {}
  for (const context of (block.contexts ?? []).filter((one) => contexts.includes(one.id))) {
    for (const [capability, level] of Object.entries(context.needs)) {
      if (level > (needs[capability] ?? 0)) needs[capability] = level
    }
  }
  return needs
}

/** The contexts that drive a capability's need here: those that need it most. */
export function drivenBy(block: Pick<DesignElement, 'contexts'>, contexts: readonly string[], capability: string): string[] {
  const need = needsOf(block, contexts)[capability] ?? 0
  if (need === 0) return []
  return (block.contexts ?? []).filter((one) => contexts.includes(one.id) && one.needs[capability] === need).map((one) => one.name)
}

export type FitTerm = { capability: string; need: BlockLevel; coverage: BlockLevel; counted: number }

export type Fit = {
  /** 0 to 1; absent where nothing is needed. */
  fit?: number
  covered: number
  needed: number
  terms: FitTerm[]
  /** The `must` capabilities needed here and not covered fully. */
  failsMust: string[]
}

/** How well one solution fits here (§5): the sum, its terms, and the musts it fails. */
export function fitOf(block: Pick<DesignElement, 'capabilities' | 'contexts'>, evaluation: Pick<Evaluation, 'contexts' | 'coverage'>, sbb: string): Fit {
  const needs = needsOf(block, evaluation.contexts)
  const terms: FitTerm[] = []
  const failsMust: string[] = []
  for (const capability of block.capabilities ?? []) {
    const need = needs[capability.id] ?? 0
    if (need === 0) continue
    const coverage = evaluation.coverage[sbb]?.[capability.id]?.level ?? 0
    terms.push({ capability: capability.id, need, coverage, counted: Math.min(coverage, need) })
    if (capability.must && coverage < 4) failsMust.push(capability.id)
  }
  const needed = terms.reduce((sum, one) => sum + one.need, 0)
  const covered = terms.reduce((sum, one) => sum + one.counted, 0)
  return { ...(needed > 0 ? { fit: covered / needed } : {}), covered, needed, terms, failsMust }
}

/** A fit as a grid says it: a whole percentage. */
export function percent(fit: number): number {
  return Math.round(fit * 100)
}

/** The options weighed, best first: a failed must last, then by fit; a solution the block no longer lists is left out. */
export function ranking(
  block: Pick<DesignElement, 'capabilities' | 'contexts' | 'sbbs'>, evaluation: Pick<Evaluation, 'contexts' | 'coverage' | 'options'>,
): { sbb: SolutionBlock; fit: Fit }[] {
  return evaluation.options
    .map((id) => (block.sbbs ?? []).find((one) => one.id === id))
    .filter((one): one is SolutionBlock => one !== undefined)
    .map((sbb) => ({ sbb, fit: fitOf(block, evaluation, sbb.id) }))
    .sort((a, b) => Number(a.fit.failsMust.length > 0) - Number(b.fit.failsMust.length > 0) || (b.fit.fit ?? 0) - (a.fit.fit ?? 0))
}

/**
 * A new evaluation of a block for a scope, with the contexts that apply and,
 * where another scope's evaluation is copied (§4), its options and ratings —
 * the scope's own from then on, its choice not carried.
 */
export function startedEvaluation(block: { scope: string; id: string }, contexts: readonly string[], copied?: Evaluation): Evaluation {
  return {
    id: evaluationId(block), block: { ...block }, contexts: [...contexts],
    options: copied ? [...copied.options] : [],
    coverage: copied ? structuredClone(copied.coverage) : {},
  }
}

/**
 * What accepting decisions writes in the evaluations they choose in, in the
 * same step (§7): for each decision that is accepted after and was not
 * before, and chooses a solution of an evaluation this scope holds, the
 * evaluation's `chosen` and `decidedBy`. Asked by whoever builds the step —
 * the decisions page and the agent — as the other ends of a supersession are,
 * never by the reducer, which enforces no lifecycle.
 */
export function choicesAccepted(
  evaluations: Readonly<Record<EvaluationId, Evaluation>>, before: readonly Adr[], after: readonly Adr[],
): Command[] {
  const was = new Map(before.map((one) => [one.id, one.status]))
  return after.flatMap((decision): Command[] => {
    const choice = decision.chooses
    if (!choice || decision.status !== 'accepted' || was.get(decision.id) === 'accepted') return []
    const held = evaluations[choice.evaluation]
    if (!held || !held.options.includes(choice.option)) return []
    if (held.chosen === choice.option && held.decidedBy === decision.id) return []
    return [{ type: 'evaluation.update', id: held.id, patch: { chosen: choice.option, decidedBy: decision.id } }]
  })
}
