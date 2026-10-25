// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's writes on the 3.8.0 records (ADR-0041, ADR-0043): a principle
 * proposed or changed in the open scope, a record citing one, and a rating in
 * the open scope's evaluation of a building block — each one command, refused
 * by the reducer as the page's would be.
 */
import type { Citation, CitationStance } from '../../model/citable'
import { evaluationsOf, principleList, principlesOf } from '../../model/normalised'
import type { Principle } from '../../model/principle'
import { json, refused } from '../tools'
import type { Args, Handler } from './shared'

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined)

export const addPrinciple: Handler = (args: Args, view) => {
  const title = text(args.title)
  const statement = text(args.statement)
  if (!title || !statement) return refused('agent.badArguments', 'a principle needs a title and a statement')
  const aspects = ((args.aspects as unknown[] | undefined) ?? []).map(text).filter((one): one is string => one !== undefined)
  if (aspects.length === 0) return refused('agent.badArguments', 'a principle needs at least one aspect: a part a record can follow or depart from')
  const id = view.makeId('pr')
  const number = Math.max(0, ...principleList(view.model).map((one) => one.number)) + 1
  const status = (args.status as Principle['status'] | undefined) ?? 'candidate'
  const principle: Principle = {
    id, number, title, statement,
    aspects: aspects.map((one, at) => ({ id: `${id}-a${at + 1}`, number: at + 1, text: one, nature: 'design' })),
    lastAspect: aspects.length, groups: [], regime: (args.regime as Principle['regime'] | undefined) ?? 'flexible', status,
    ...(status === 'accepted' ? { acceptedOn: view.today() } : {}),
    ...(text(args.question) ? { question: text(args.question)! } : {}),
    ...(text(args.rationale) ? { rationale: text(args.rationale)! } : {}),
  }
  return { command: { type: 'principle.add', principle, origin: 'agent' }, answer: json({ id, number, title, status }) }
}

export const updatePrinciple: Handler = (args: Args, view) => {
  const id = args.id as string
  const held = principlesOf(view.model)[id]
  if (!held) return refused('agent.unknownId', `principle ${id}`)
  const patch: Partial<Principle> = {
    ...(text(args.title) ? { title: text(args.title)! } : {}),
    ...(text(args.statement) ? { statement: text(args.statement)! } : {}),
    ...(args.regime ? { regime: args.regime as Principle['regime'] } : {}),
    ...(args.status ? { status: args.status as Principle['status'] } : {}),
    ...(args.status === 'accepted' && !held.acceptedOn ? { acceptedOn: view.today() } : {}),
    ...(text(args.rationale) ? { rationale: text(args.rationale)! } : {}),
  }
  if (Object.keys(patch).length === 0) return refused('agent.badArguments', 'nothing to change')
  return { command: { type: 'principle.update', id, patch, origin: 'agent' }, answer: json({ id, changed: Object.keys(patch) }) }
}

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
