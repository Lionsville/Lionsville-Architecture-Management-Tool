// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's writes on a scope's architecture principles (ADR-0041), the
 * family `model/commands/principleRecords.ts` applies: a principle proposed
 * in the open scope, and one changed there. Groups, merging and removing stay
 * the page's.
 */
import { principleList, principlesOf } from '../../model/normalised'
import type { Principle } from '../../model/principle'
import { json, refused } from '../tools'
import type { Args, Handler } from './shared'
import { text } from './shared'

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
