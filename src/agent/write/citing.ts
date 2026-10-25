// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's citing (ADR-0041 §7), the family `model/commands/citing.ts`
 * applies: a record of the open scope citing a principle in force there —
 * following it or departing from it with a reason, or, on an observation,
 * finding that it holds, chafes or was missing.
 */
import type { Citation, CitationStance } from '../../model/citable'
import { json, refused } from '../tools'
import type { Args, Handler } from './shared'
import { text } from './shared'

export const citePrinciple: Handler = (args: Args, view) => {
  const about = args.about as { kind: Citation['about']['kind']; id: string }
  const principle = args.principle as { scope?: string; id: string }
  const stance = args.stance as CitationStance
  const reason = text(args.reason)
  if (stance === 'deviates' && !reason) return refused('agent.badArguments', 'departing from a principle needs a reason')
  const citation: Citation = {
    id: view.makeId('ci'), about, principle: { scope: principle.scope ?? '', id: principle.id }, stance, on: view.today(),
    ...(typeof args.aspect === 'number' ? { aspect: args.aspect } : {}),
    ...(reason ? { reason } : {}),
  }
  return { command: { type: 'citation.add', citation, origin: 'agent' }, answer: json({ id: citation.id, about, principle: citation.principle, stance }) }
}
