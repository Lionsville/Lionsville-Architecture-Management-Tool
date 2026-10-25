// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's writes on the open scope's evaluations of building blocks
 * (ADR-0043 §4, §5), the family `model/commands/evaluations.ts` applies: an
 * option rated against a capability. Starting an evaluation and proposing the
 * decision stay the page's.
 */
import { evaluationsOf } from '../../model/normalised'
import { json, refused } from '../tools'
import type { Args, Handler } from './shared'
import { text } from './shared'

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
