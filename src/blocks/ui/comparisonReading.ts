// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One scope's comparison as it is read (ADR-0043 §5, §6): the options weighed in
 * the order of their rank, each with its fit; and each capability with what this
 * scope needs of it, how far each option covers it and by how much it falls
 * short. Pure, over the model's arithmetic (`model/evaluation.ts`): what the grid
 * draws and what a copy of it carries out are this one reading, so the two can
 * never say different things.
 */
import { needsOf, ranking } from '../../model/evaluation'
import type { Evaluation, Fit } from '../../model/evaluation'
import type { BlockCapability, BlockLevel, DesignElement, SolutionBlock } from '../../model/types'

export type OptionReading = {
  readonly sbb: SolutionBlock
  /** 1 for the best: a failed must ranks after every option that fails none. */
  readonly rank: number
  readonly fit: Fit
  readonly chosen: boolean
}

export type CellReading = {
  readonly level: BlockLevel
  readonly how?: string
  /**
   * How many quarters it falls short here; 0 where it covers it. A must that is
   * needed is short of full, whatever the need (`fitOf`'s `failsMust`).
   */
  readonly short: number
  /** It fails a must here. */
  readonly failsMust: boolean
}

export type CapabilityReading = {
  readonly capability: BlockCapability
  /** What this scope needs of it: the most any of its contexts needs. */
  readonly need: BlockLevel
  /** Needed here at all. */
  readonly needed: boolean
  /** By option id. */
  readonly cells: Readonly<Record<string, CellReading>>
  /** Every option weighed covers what is needed: no gap on this row. */
  readonly covered: boolean
}

export type ComparisonReading = {
  readonly options: readonly OptionReading[]
  readonly capabilities: readonly CapabilityReading[]
}

export function readComparison(
  block: Pick<DesignElement, 'capabilities' | 'contexts' | 'sbbs'>, evaluation: Pick<Evaluation, 'contexts' | 'coverage' | 'options' | 'chosen'>,
): ComparisonReading {
  const needs = needsOf(block, evaluation.contexts)
  const options = ranking(block, evaluation).map(({ sbb, fit }, at) => ({ sbb, rank: at + 1, fit, chosen: evaluation.chosen === sbb.id }))
  const capabilities = (block.capabilities ?? []).map((capability) => {
    const need = needs[capability.id] ?? 0
    const must = capability.must === true && need > 0
    const cells: Record<string, CellReading> = {}
    for (const { sbb } of options) {
      const held = evaluation.coverage[sbb.id]?.[capability.id]
      const level = held?.level ?? 0
      cells[sbb.id] = { level, ...(held?.how ? { how: held.how } : {}), short: Math.max(0, (must ? 4 : need) - level), failsMust: must && level < 4 }
    }
    return { capability, need, needed: need > 0, cells, covered: options.every(({ sbb }) => cells[sbb.id]!.short === 0) }
  })
  return { options, capabilities }
}
