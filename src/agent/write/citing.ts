// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's citing (ADR-0041 §7), the family `model/commands/citing.ts`
 * applies: a record of the open scope citing a principle in force there —
 * following it or departing from it with a reason, or, on an observation,
 * finding that it holds, chafes or was missing — and a citation taken back.
 *
 * What the principle says about a citation is asked here, before the step, as the
 * page asks it: no one scope's step can read a principle kept in another scope. A
 * decision or an observation may cite as it is written (`principles` on their
 * tools), in the one step that writes it.
 */
import type { Citation, CitationStance } from '../../model/citable'
import type { Command } from '../../model/commands'
import { transaction } from '../../model/commands'
import { citationsOf, principlesOf } from '../../model/normalised'
import type { Principle } from '../../model/principle'
import { citationRefusal } from '../../principles/principle'
import type { CitingKind } from '../../principles/principle'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Args, Handler, Prepared, WriteView } from './shared'
import { text } from './shared'

type Asked = { scope?: string; id: string; aspect?: number; stance: CitationStance; reason?: string | undefined }

const SAID: Record<NonNullable<ReturnType<typeof citationRefusal>>, string> = {
  principleFixed: 'a fixed principle is kept to, and no record departs from it',
  principleRetired: 'a retired or merged principle takes no new citation',
  reasonMissing: 'departing from a principle needs a reason',
  stanceNotHere: 'decision, solution, plan (transition) and element take supports, a decision deviates too; an observation takes holds, chafes or missing',
}

/** The principle a citation names, as this scope can read it; `undefined` where nothing can be asked about it. */
function principleAsked(view: WriteView, scope: string, id: string): Principle | AgentAnswer | undefined {
  if (scope === view.scopePath) return principlesOf(view.model)[id] ?? refused('agent.unknownId', `principle ${id}`)
  const records = view.tree?.records?.()
  if (!records) return undefined
  const held = records.principlesAt(scope).principles.find((one) => one.id === id)
  if (!held) return refused('agent.unknownId', `principle ${id} in ${scope || 'the organisation'}`)
  if (!records.inForce(view.scopePath).some((one) => one.scope === scope && one.principle.id === id)) {
    return refused('agent.badArguments', `principle ${id} does not hold here: principles.list with scope says which do`)
  }
  return held
}

/** A citation as it may be written, or why it may not. */
function citationOf(view: WriteView, about: { kind: CitingKind; id: string }, asked: Asked): Citation | AgentAnswer {
  const scope = asked.scope ?? view.scopePath
  const principle = principleAsked(view, scope, asked.id)
  if (principle && 'ok' in principle) return principle
  const reason = text(asked.reason)
  if (principle) {
    const refusal = citationRefusal(principle, about.kind, asked.stance, reason)
    if (refusal) return refused('agent.badArguments', SAID[refusal])
    if (asked.aspect !== undefined && !principle.aspects.some((one) => one.number === asked.aspect)) {
      return refused('agent.badArguments', `principle ${asked.id} has no aspect ${asked.aspect}`)
    }
  } else if (asked.stance === 'deviates' && !reason) {
    return refused('agent.badArguments', SAID.reasonMissing)
  }
  return {
    id: view.makeId('ci'), about, principle: { scope, id: asked.id }, stance: asked.stance, on: view.today(),
    ...(asked.aspect !== undefined ? { aspect: asked.aspect } : {}),
    ...(reason ? { reason } : {}),
  }
}

export const citePrinciple: Handler = (args: Args, view) => {
  const about = args.about as { kind: CitingKind; id: string }
  const principle = args.principle as { scope?: string; id: string }
  const made = citationOf(view, about, {
    ...principle, stance: args.stance as CitationStance, reason: args.reason as string | undefined,
    ...(typeof args.aspect === 'number' ? { aspect: args.aspect } : {}),
  })
  if ('ok' in made) return made
  return { command: { type: 'citation.add', citation: made, origin: 'agent' }, answer: json({ id: made.id, about, principle: made.principle, stance: made.stance }) }
}

export const unciteCitation: Handler = (args, view) => {
  const id = args.id as string
  const held = citationsOf(view.model)[id]
  if (!held) return refused('agent.unknownId', `citation ${id}`)
  return { command: { type: 'citation.remove', id, origin: 'agent' }, answer: json({ id, about: held.about, principle: held.principle }) }
}

/**
 * A decision's or an observation's tool that takes `principles` too: what it builds,
 * and the citations in the one step. Without a stance a decision supports and an
 * observation holds; the record is the one the tool names or the one it just made.
 */
export function citing(kind: 'decision' | 'observation', handler: Handler): Handler {
  return (args, view) => {
    const built = handler(args, view)
    const asked = args.principles as (Omit<Asked, 'stance'> & { stance?: CitationStance })[] | undefined
    if (!asked?.length || 'ok' in built) return built
    const id = (args.id as string | undefined) ?? idOf(built)
    const adds: Command[] = []
    for (const [at, one] of asked.entries()) {
      const made = citationOf(view, { kind, id }, { ...one, stance: one.stance ?? (kind === 'decision' ? 'supports' : 'holds') })
      if ('ok' in made) return made.ok ? made : { ...made, detail: `principles[${at}]: ${made.detail ?? ''}` }
      adds.push({ type: 'citation.add', citation: made })
    }
    return { ...built, command: transaction([built.command, ...adds], { origin: 'agent' }), answer: alsoCited(built, adds) }
  }
}

function idOf(built: Prepared): string {
  const first = built.answer.ok ? built.answer.content[0] : undefined
  return first?.type === 'text' ? (JSON.parse(first.text) as { id: string }).id : ''
}

function alsoCited(built: Prepared, adds: readonly Command[]): AgentAnswer {
  const first = built.answer.ok ? built.answer.content[0] : undefined
  const said = first?.type === 'text' ? JSON.parse(first.text) as Record<string, unknown> : {}
  return json({ ...said, cited: adds.flatMap((one) => (one.type === 'citation.add' ? [one.citation.id] : [])) })
}
