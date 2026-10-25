// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The decision a scope's evaluation of a building block becomes (ADR-0043
 * §7), drafted once for the block's page and the agent's
 * `evaluation.propose`: in the record's own sections, the context, what is
 * needed here as its drivers, each option with its fit, the option chosen as
 * the outcome, and the evaluation referred to as it stood. Its consequences
 * and its signers are the person's to write. What the block cites of the
 * principles is copied onto it as *supports*.
 *
 * Pure.
 */
import type { Translate } from '../i18n/strings'
import type { Command } from '../model/commands'
import type { Citation } from '../model/citable'
import { needsOf, percent, ranking } from '../model/evaluation'
import type { Evaluation, Fit } from '../model/evaluation'
import type { DesignElement } from '../model/types'
import { draftedBody, newAdr, nextAdrNumber } from './adr'
import type { Adr } from './adr'

export type BlockDecisionAsked = {
  block: DesignElement
  evaluation: Evaluation
  option: string
  /** The scope that is choosing: where the decision is kept, what it is called, the revision its evaluation stood at. */
  scope: { path: string; name: string; revision?: string; decisions: readonly Adr[]; keepsBlock: boolean }
  id: string
  date: string
  s: Translate
}

/** The decision, proposed, choosing `option` of the evaluation. */
export function blockDecision(asked: BlockDecisionAsked): Adr {
  const { block, evaluation, option, scope, s } = asked
  const fitWords = (fit: Fit) => (fit.failsMust.length ? s('blockDecision.failsMust') : fit.fit !== undefined ? `${percent(fit.fit)} %` : '—')
  const ranked = ranking(block, evaluation)
  const chosen = ranked.find((one) => one.sbb.id === option)
  const name = chosen?.sbb.name ?? option
  const needs = needsOf(block, evaluation.contexts)
  const drivers = (block.capabilities ?? []).filter((one) => (needs[one.id] ?? 0) > 0)
    .map((one) => s('blockDecision.driver', { capability: one.text, level: needs[one.id]! }))
  const reference = ['```ref', `evaluation: ${block.id}`, `scope: ${scope.path}`, ...(scope.revision ? [`at: ${scope.revision}`] : []), '```'].join('\n')
  const body = draftedBody(s, {
    context: s('blockDecision.context', { block: block.name, scope: scope.name }),
    drivers,
    options: ranked.map(({ sbb, fit }) => `${sbb.name} — ${fitWords(fit)}`),
    outcome: s('blockDecision.outcome', { name, fit: chosen ? fitWords(chosen.fit) : '—' }),
    more: reference,
  })
  const decision = newAdr({
    id: asked.id, number: nextAdrNumber([...scope.decisions]), date: asked.date, t: s,
    title: s('blockDecision.title', { name, block: block.name, scope: scope.name }),
    ...(scope.keepsBlock ? { subjectId: block.id } : {}),
  })
  return { ...decision, body, chooses: { evaluation: evaluation.id, option } }
}

/** The citations of principles the block makes, kept where the block is, copied onto the decision as *supports*. */
export function supportsCopied(
  citations: readonly { scope: string; citation: Citation }[], kept: { scope: string; id: string }, decision: string,
  makeId: (prefix: string) => string, today: string,
): Command[] {
  return citations
    .filter(({ scope, citation }) => scope === kept.scope && citation.about.kind === 'element' && citation.about.id === kept.id)
    .map(({ citation }) => ({
      type: 'citation.add',
      citation: {
        id: makeId('ci'), about: { kind: 'decision', id: decision }, principle: citation.principle,
        ...(citation.aspect !== undefined ? { aspect: citation.aspect } : {}), stance: 'supports', on: today,
      },
    }))
}
