// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's writes on a scope's architecture principles (ADR-0041), the
 * family `model/commands/principleRecords.ts` applies: a principle proposed in
 * the open scope and changed there, its groups kept, its aspects, its relations,
 * merging and removing one. Every one is one step, in Activity under the name of
 * the person the agent acts for, and may be a step of a batch.
 *
 * The groups are the scope's own list, set whole, as the page's *Manage groups* sets
 * it. A group named on a principle that the scope has not got is made there, as the
 * page's picker makes one, in the same step.
 */
import type { Command } from '../../model/commands'
import { transaction } from '../../model/commands'
import { citationList, principleList, principlesOf } from '../../model/normalised'
import { aspectByNumber, nextPrincipleNumber, sharpens, withAspect } from '../../model/principle'
import type { Aspect, Principle, PrincipleGroup, PrincipleRelation } from '../../model/principle'
import { principleMerge } from '../../principles/merge'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Args, Handler, Prepared, WriteView } from './shared'
import { text } from './shared'

const groupsOf = (view: WriteView): readonly PrincipleGroup[] => view.model.principleGroups ?? []

const sameName = (one: string, other: string) => one.trim().toLowerCase() === other.trim().toLowerCase()

/** The groups named, by id: the scope's where it has them, made where it has not. */
function filedUnder(names: readonly unknown[], view: WriteView): { ids: string[]; groups?: PrincipleGroup[] } | AgentAnswer {
  const groups = [...groupsOf(view)]
  const ids: string[] = []
  for (const name of names) {
    const said = text(name)
    if (!said) return refused('agent.badArguments', 'a group is named, not blank')
    let group = groups.find((one) => sameName(one.name, said))
    if (!group) {
      group = { id: view.makeId('pg'), name: said }
      groups.push(group)
    }
    ids.push(group.id)
  }
  return { ids: [...new Set(ids)], ...(groups.length !== groupsOf(view).length ? { groups } : {}) }
}

/** One change of a principle, with the groups it made: the principle first, which is what Activity names the step by. */
function step(change: Command, groups: readonly PrincipleGroup[] | undefined): Command {
  return groups
    ? transaction([change, { type: 'project.settings', patch: { principleGroups: [...groups] } }], { origin: 'agent' })
    : { ...change, origin: 'agent' } as Command
}

export const addPrinciple: Handler = (args: Args, view) => {
  const title = text(args.title)
  const statement = text(args.statement)
  if (!title || !statement) return refused('agent.badArguments', 'a principle needs a title and a statement')
  const aspects = ((args.aspects as unknown[] | undefined) ?? []).map(text).filter((one): one is string => one !== undefined)
  if (aspects.length === 0) return refused('agent.badArguments', 'a principle needs at least one aspect: a part a record can follow or depart from')
  const filed = filedUnder((args.groups as unknown[] | undefined) ?? [], view)
  if ('ok' in filed) return filed
  const id = view.makeId('pr')
  const number = nextPrincipleNumber(principleList(view.model))
  const status = (args.status as Principle['status'] | undefined) ?? 'candidate'
  const principle: Principle = {
    id, number, title, statement,
    aspects: aspects.map((one, at) => ({ id: `${id}-a${at + 1}`, number: at + 1, text: one, nature: 'design' })),
    lastAspect: aspects.length, groups: filed.ids, regime: (args.regime as Principle['regime'] | undefined) ?? 'flexible', status,
    ...(status === 'accepted' ? { acceptedOn: view.today() } : {}),
    ...(text(args.question) ? { question: text(args.question)! } : {}),
    ...(text(args.rationale) ? { rationale: text(args.rationale)! } : {}),
    ...(text(args.implications) ? { implications: text(args.implications)! } : {}),
    ...(Array.isArray(args.keywords) ? { keywords: args.keywords as string[] } : {}),
  }
  return { command: step({ type: 'principle.add', principle }, filed.groups), answer: json({ id, number, title, status, groups: args.groups ?? [] }) }
}

/** A principle of the open scope that still stands, or why not. */
function standing(id: string, view: WriteView): Principle | AgentAnswer {
  const held = principlesOf(view.model)[id]
  if (!held) return refused('agent.unknownId', `principle ${id}`)
  if (held.mergedInto) return refused('agent.badArguments', `principle ${id} was merged into ${held.mergedInto}, and is history`)
  return held
}

/** The patch with the note a change to an accepted principle's words carries (§4); the reducer refuses one without. */
function sharpened(held: Principle, patch: Partial<Principle>, note: unknown, view: WriteView): Partial<Principle> {
  const said = text(note)
  if (!said || !sharpens(held, { ...held, ...patch })) return patch
  return { ...patch, sharpened: [...(held.sharpened ?? []), { on: view.today(), note: said }] }
}

export const updatePrinciple: Handler = (args: Args, view) => {
  const id = args.id as string
  const held = standing(id, view)
  if ('ok' in held) return held
  const filed = args.groups === undefined ? undefined : filedUnder(args.groups as unknown[], view)
  if (filed && 'ok' in filed) return filed
  const asked: Partial<Principle> = {
    ...(text(args.title) ? { title: text(args.title)! } : {}),
    ...(text(args.statement) ? { statement: text(args.statement)! } : {}),
    ...(args.regime ? { regime: args.regime as Principle['regime'] } : {}),
    ...(args.status ? { status: args.status as Principle['status'] } : {}),
    ...(args.status === 'accepted' && !held.acceptedOn ? { acceptedOn: view.today() } : {}),
    ...(text(args.rationale) ? { rationale: text(args.rationale)! } : {}),
    ...(text(args.implications) ? { implications: text(args.implications)! } : {}),
    ...(text(args.question) ? { question: text(args.question)! } : {}),
    ...(Array.isArray(args.keywords) ? { keywords: args.keywords as string[] } : {}),
    ...(filed ? { groups: filed.ids } : {}),
  }
  if (Object.keys(asked).length === 0) return refused('agent.badArguments', 'nothing to change')
  const patch = sharpened(held, asked, args.note, view)
  return { command: step({ type: 'principle.update', id, patch }, filed?.groups), answer: json({ id, changed: Object.keys(asked) }) }
}

/**
 * The scope's groups, whole and in order: one with an id is that group, renamed
 * as it says; one with no id is the group of that name, or a new one; one left
 * out is removed, and taken off its principles in the same step (§3), none of
 * which goes.
 */
export const setPrincipleGroups: Handler = (args, view) => {
  const held = groupsOf(view)
  const next: PrincipleGroup[] = []
  for (const one of args.groups as { id?: string; name: string; description?: string }[]) {
    const name = text(one.name)
    if (!name) return refused('agent.badArguments', 'every group needs a name')
    if (next.some((other) => sameName(other.name, name))) return refused('agent.badArguments', `group "${name}" is listed twice`)
    const found = one.id !== undefined ? held.find((group) => group.id === one.id) : held.find((group) => sameName(group.name, name))
    if (one.id !== undefined && !found) return refused('agent.unknownId', `group ${one.id}`)
    if (found && next.some((other) => other.id === found.id)) return refused('agent.badArguments', `group ${found.id} is listed twice`)
    const description = one.description !== undefined ? text(one.description) : found?.description
    next.push({ id: found?.id ?? view.makeId('pg'), name, ...(description ? { description } : {}) })
  }
  const kept = new Set(next.map((one) => one.id))
  const off = principleList(view.model).filter((one) => one.groups.some((id) => !kept.has(id)))
  return {
    command: transaction([
      { type: 'project.settings', patch: { principleGroups: next } },
      ...off.map((one): Command => ({ type: 'principle.update', id: one.id, patch: { groups: one.groups.filter((id) => kept.has(id)) } })),
    ], { origin: 'agent' }),
    answer: json({
      groups: next, removed: held.filter((one) => !kept.has(one.id)).map((one) => one.name),
      ...(off.length ? { takenOff: off.map((one) => one.id) } : {}),
    }),
  }
}

// --- its aspects ---------------------------------------------------------------------

const answerOn = (held: Principle, number: number, changed: string): AgentAnswer => json({ principle: held.id, aspect: number, changed })

/** The aspects changed, with the note an accepted principle's change carries. */
function aspectsChanged(held: Principle, patch: Pick<Principle, 'aspects'> & Partial<Principle>, args: Args, view: WriteView, answer: AgentAnswer): Prepared {
  return { command: { type: 'principle.update', id: held.id, patch: sharpened(held, patch, args.note, view), origin: 'agent' }, answer }
}

const NATURE = (args: Args) => (args.nature ? { nature: args.nature as Aspect['nature'] } : {})

export const addAspect: Handler = (args, view) => {
  const held = standing(args.principle as string, view)
  if ('ok' in held) return held
  const said = text(args.text)
  if (!said) return refused('agent.badArguments', 'an aspect says something')
  const next = withAspect(held, {
    id: `${held.id}-a${held.lastAspect + 1}`, text: said, nature: 'design', ...NATURE(args),
    ...(text(args.signal) ? { signal: text(args.signal)! } : {}), ...(text(args.steering) ? { steering: text(args.steering)! } : {}),
  })
  return aspectsChanged(held, { aspects: next.aspects, lastAspect: next.lastAspect }, args, view, answerOn(held, next.lastAspect, 'added'))
}

/** The aspect a tool names, or why there is none. */
function aspectNamed(args: Args, view: WriteView): { held: Principle; number: number } | AgentAnswer {
  const held = standing(args.principle as string, view)
  if ('ok' in held) return held
  const number = args.number as number
  return aspectByNumber(held, number) ? { held, number } : refused('agent.unknownId', `aspect ${number} of principle ${held.id}`)
}

export const updateAspect: Handler = (args, view) => {
  const named = aspectNamed(args, view)
  if ('ok' in named) return named
  const { held, number } = named
  const change: Partial<Aspect> = {
    ...(text(args.text) ? { text: text(args.text)! } : {}), ...NATURE(args),
    ...(text(args.signal) ? { signal: text(args.signal)! } : {}), ...(text(args.steering) ? { steering: text(args.steering)! } : {}),
  }
  if (Object.keys(change).length === 0) return refused('agent.badArguments', 'nothing to change')
  const aspects = held.aspects.map((one) => (one.number === number ? { ...one, ...change } : one))
  return aspectsChanged(held, { aspects }, args, view, answerOn(held, number, 'updated'))
}

/** Its number stays taken (§2), and the reducer refuses taking the last. */
export const removeAspect: Handler = (args, view) => {
  const named = aspectNamed(args, view)
  if ('ok' in named) return named
  const { held, number } = named
  return aspectsChanged(held, { aspects: held.aspects.filter((one) => one.number !== number) }, args, view, answerOn(held, number, 'removed'))
}

// --- how it stands to others -----------------------------------------------------------

const sameRelation = (one: PrincipleRelation, other: PrincipleRelation) => one.kind === other.kind && one.to.scope === other.to.scope && one.to.id === other.to.id

function relationOf(args: Args, view: WriteView): PrincipleRelation {
  const to = args.to as { scope?: string; id: string }
  return { kind: args.kind as PrincipleRelation['kind'], to: { scope: to.scope ?? view.scopePath, id: to.id } }
}

/** A relation is to a principle here or in a scope above (§5). */
function relatable(relation: PrincipleRelation, view: WriteView): AgentAnswer | undefined {
  const { scope, id } = relation.to
  const here = view.scopePath
  if (scope === here) return principlesOf(view.model)[id] ? undefined : refused('agent.unknownId', `principle ${id}`)
  if (scope !== '' && !here.startsWith(`${scope}/`)) return refused('agent.badArguments', 'a principle relates to one here or in a scope above')
  const records = view.tree?.records?.()
  if (!records) return refused('agent.noTree')
  return records.principlesAt(scope).principles.some((one) => one.id === id) ? undefined : refused('agent.unknownId', `principle ${id} in ${scope || 'the organisation'}`)
}

export const relatePrinciple: Handler = (args, view) => {
  const held = standing(args.id as string, view)
  if ('ok' in held) return held
  const relation = relationOf(args, view)
  if (relation.to.id === held.id && relation.to.scope === view.scopePath) return refused('agent.badArguments', 'a principle does not relate to itself')
  const wrong = relatable(relation, view)
  if (wrong) return wrong
  const relations = [...(held.relations ?? []).filter((one) => !sameRelation(one, relation)), relation]
  return { command: { type: 'principle.update', id: held.id, patch: { relations }, origin: 'agent' }, answer: json({ id: held.id, relations }) }
}

export const unrelatePrinciple: Handler = (args, view) => {
  const held = standing(args.id as string, view)
  if ('ok' in held) return held
  const relation = relationOf(args, view)
  const relations = (held.relations ?? []).filter((one) => !sameRelation(one, relation))
  if (relations.length === (held.relations ?? []).length) return refused('agent.unknownId', `no such relation on principle ${held.id}`)
  return { command: { type: 'principle.update', id: held.id, patch: { relations: relations.length ? relations : undefined }, origin: 'agent' }, answer: json({ id: held.id, relations }) }
}

/** Every citation of a principle kept here, in any scope: this one as it stands, the others off the tree. */
function citingScopes(id: string, view: WriteView): string[] {
  const here = view.scopePath
  const own = citationList(view.model).some((one) => one.principle.scope === here && one.principle.id === id) ? [here] : []
  const elsewhere = (view.tree?.records?.().citations() ?? [])
    .filter((one) => one.scope !== here && one.citation.principle.scope === here && one.citation.principle.id === id)
    .map((one) => one.scope)
  return [...new Set([...own, ...elsewhere])]
}

export const mergePrinciple: Handler = (args, view) => {
  const into = args.into as string
  const survivor = standing(into, view)
  if ('ok' in survivor) return survivor
  const from = args.from as string[]
  for (const id of from) {
    if (id === into) return refused('agent.badArguments', 'a principle does not absorb itself')
    const held = standing(id, view)
    if ('ok' in held) return held
  }
  const merged = principleMerge(view.model, view.scopePath, into, from)
  if (!merged) return refused('agent.badArguments', 'nothing to merge')
  const elsewhere = from.flatMap((id) => citingScopes(id, view).filter((scope) => scope !== view.scopePath).map((scope) => ({ scope, principle: id })))
  return {
    command: transaction(merged.commands, { origin: 'agent' }),
    answer: json({ into, absorbed: from, renumbered: merged.renumbered, ...(elsewhere.length ? { citedElsewhere: elsewhere } : {}) }),
  }
}

/** Removed only while nothing anywhere cites it (§8); otherwise it is retired. The reducer takes its comments with it. */
export const removePrinciple: Handler = (args, view) => {
  const id = args.id as string
  if (!principlesOf(view.model)[id]) return refused('agent.unknownId', `principle ${id}`)
  const scopes = citingScopes(id, view)
  if (scopes.length) return refused('agent.principleCited', `cited in ${scopes.map((one) => one || 'the organisation').join(', ')}`)
  return { command: { type: 'principle.remove', id, origin: 'agent' }, answer: json({ id, removed: true }) }
}
