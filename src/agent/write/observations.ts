// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Observations and causes (ADR-0021): every verb is a rule over the two lists,
 * and the change is the difference between the lists before and after, said as
 * one transaction — one undo step, one Activity line, the way the page commits.
 */
import { causesToCommands, observationsToCommands, solutionsToCommands, transaction } from '../../model/commands'
import type { Model } from '../../model/normalised'
import { causeList, fromArrays, observationList, solutionList, toArrays } from '../../model/normalised'
import { isDay } from '../../model/lifecycle'
import type { Cause, CauseLink, CauseState, CauseStrength, Observation, ObservationImpact } from '../../model/observation'
import { forgetCause, formatSolutionNumber } from '../../observations/solution'
import {
  causeEvidence, causeLabel, formatCauseNumber, formatObservationNumber, linkCause, linkRefusal,
  makeCause, makeRootCause, newCause, newObservation, nextCauseNumber, nextObservationNumber, removeCause,
  removeObservation, seenAgain, seenDayProblem, setArchived, unlinkCause, updateCause, updateObservation,
} from '../../observations/observation'
import type {
  Analysis, CausePatch, LinkContext, LinkRefusal, ObservationPatch, RootChangeRefusal,
} from '../../observations/observation'
import { causeLine, findCause, findObservation, observationLine } from '../answer'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Args, Handler, Prepared, WriteView } from './shared'

/** The two lists as they stand, and the ways every verb reads and answers over them. */
type Work = {
  readonly model: Model
  readonly before: Analysis
  readonly observationOf: (idOrLabel: unknown) => Observation | undefined
  readonly causeOf: (idOrLabel: unknown) => Cause | undefined
}

function workOn(view: WriteView): Work {
  const before: Analysis = { observations: observationList(view.model), causes: causeList(view.model) }
  return {
    model: view.model,
    before,
    observationOf: (idOrLabel) => findObservation(before.observations, String(idOrLabel)),
    causeOf: (idOrLabel) => findCause(before.causes, String(idOrLabel)),
  }
}

/** The lists after, said as the commands that make them so; nothing changed is a refusal. */
function finish(work: Work, after: Analysis, answer: unknown): Prepared | AgentAnswer {
  const commands = [...observationsToCommands(work.model, after.observations), ...causesToCommands(work.model, after.causes)]
  if (commands.length === 0) return refused('agent.badArguments', 'nothing changed')
  return { command: transaction(commands, { origin: 'agent' }), answer: json(answer) }
}

function observationAnswer(after: Analysis, id: string) {
  return observationLine(after.observations.find((one) => one.id === id)!, after.causes, after.observations)
}

function causeAnswer(work: Work, after: Analysis, id: string) {
  return causeLine(
    after.causes.find((one) => one.id === id)!, after.causes,
    fromArrays({ ...toArrays(work.model), observations: after.observations, causes: after.causes }),
  )
}

/** The analysis of the scopes below this one, as the tree reads it (ADR-0032 §1). */
function belowOf(view: WriteView): LinkContext {
  return { here: view.scopePath, below: view.tree?.analysisBelow?.(view.scopePath) ?? [] }
}

/**
 * What a cause explains: an observation or a cause here, or a record of the
 * scope `scope` names — found there by id or label, and asked of the rules
 * (`linkRefusal`) before it is linked.
 */
function linkOf(work: Work, view: WriteView, id: unknown, scope: unknown, strength: unknown): CauseLink | AgentAnswer {
  const held = strength === undefined ? 'normal' : strength as CauseStrength
  if (typeof scope === 'string') {
    const there = belowOf(view).below.find((one) => one.scope === scope)
    const target = there && (findCause(there.causes, String(id)) ?? findObservation(there.observations, String(id)))
    return { id: target?.id ?? String(id), scope, strength: held }
  }
  const target = work.observationOf(id) ?? work.causeOf(id)
  if (!target) return refused('agent.unknownId', `observation or cause ${String(id)}`)
  return { id: target.id, strength: held }
}

/** A verb about one observation this scope holds: found by id or label, or refused. */
function onObservation(then: (held: Observation, args: Args, view: WriteView, work: Work) => Prepared | AgentAnswer): Handler {
  return (args, view) => {
    const work = workOn(view)
    const held = work.observationOf(args.id)
    if (!held) return refused('agent.unknownId', `observation ${String(args.id)}`)
    return then(held, args, view, work)
  }
}

/** A verb about one cause this scope holds: found by id or label, or refused. */
function onCause(then: (held: Cause, args: Args, view: WriteView, work: Work) => Prepared | AgentAnswer): Handler {
  return (args, view) => {
    const work = workOn(view)
    const held = work.causeOf(args.id)
    if (!held) return refused('agent.unknownId', `cause ${String(args.id)}`)
    return then(held, args, view, work)
  }
}

// --- observations -----------------------------------------------------------------------

export const recordObservation: Handler = (args, view) => {
  const work = workOn(view)
  const { before } = work
  const title = (args.title as string).trim()
  if (!title) return refused('agent.badArguments', '"title" must not be blank')
  // The three facts that make it an observation (ADR-0032 §10): what, where
  // and who. The day defaults to today, as the page's does, and is never later.
  for (const field of ['where', 'by'] as const) {
    if (typeof args[field] !== 'string' || !args[field].trim()) return refused('agent.badArguments', `"${field}" is required: ${FACT[field]}`)
  }
  const today = view.today()
  const date = typeof args.date === 'string' ? args.date : today
  if (!isDay(date)) return refused('agent.badArguments', `date ${date} is not yyyy-mm-dd`)
  if (date > today) return refused('agent.badArguments', `date ${date} is in the future; today is ${today}`)
  const fresh = newObservation({
    id: view.makeId('ob'), number: nextObservationNumber(before.observations), title, date, t: view.translate,
    where: args.where as string,
    by: args.by as string,
    ...(typeof args.impact === 'string' ? { impact: args.impact as ObservationImpact } : {}),
    ...(typeof args.body === 'string' ? { body: args.body } : {}),
  })
  const after = { ...before, observations: [...before.observations, fresh] }
  return finish(work, after, observationAnswer(after, fresh.id))
}

/** What each of an observation's required facts is, for the refusal that asks for it. */
const FACT = {
  where: 'where it was seen — a system, a desk, a job, a meeting',
  by: 'who saw it, or who wrote it down — a name, initials, a team',
} as const

/**
 * The fields an update names, or the refusal for the first one that cannot
 * be had. Title, where and who may be corrected and never blanked (ADR-0032
 * §10); a record written before without where or who keeps going without
 * them until somebody writes them.
 */
function observationPatch(args: Args): ObservationPatch | AgentAnswer {
  const patch: ObservationPatch = {}
  for (const field of ['title', 'where', 'by'] as const) {
    const value = args[field]
    if (typeof value !== 'string') continue
    if (!value.trim()) return refused('agent.badArguments', `"${field}" must not be blank`)
    patch[field] = value
  }
  if (typeof args.body === 'string') patch.body = args.body
  if (typeof args.impact === 'string') patch.impact = args.impact as ObservationImpact
  if (typeof args.date === 'string') {
    if (!isDay(args.date)) return refused('agent.badArguments', `date ${args.date} is not yyyy-mm-dd`)
    patch.date = args.date
  }
  return patch
}

export const updateObservationTool = onObservation((held, args, view, work) => {
  const patch = observationPatch(args)
  if ('ok' in patch) return patch
  const after = { ...work.before, observations: updateObservation(work.before.observations, held.id, patch) }
  return finish(work, after, observationAnswer(after, held.id))
})

/**
 * Seen again, today or on the day `date` says (ADR-0021, amended 28 September
 * 2026): never in the future, and never before it was first seen.
 */
export const observationSeen = onObservation((held, args, view, work) => {
  const today = view.today()
  const day = typeof args.date === 'string' ? args.date : today
  const problem = seenDayProblem(held, day, today)
  if (problem) {
    return refused('agent.badArguments', problem === 'notADay'
      ? `date ${day} is not yyyy-mm-dd`
      : problem === 'future'
        ? `date ${day} is in the future; today is ${today}`
        : `date ${day} is before ${formatObservationNumber(held.number)} was first seen, on ${held.date}`)
  }
  const after = { ...work.before, observations: seenAgain(work.before.observations, held.id, day, args.note as string | undefined) }
  return finish(work, after, observationAnswer(after, held.id))
})

export const archiveObservation = onObservation((held, args, view, work) => {
  const { before } = work
  const restore = args.restore === true
  const observations = setArchived(before.observations, held.id, !restore, view.today(), args.note as string | undefined)
  if (observations[before.observations.indexOf(held)] === held) {
    return refused('agent.badArguments', `${held.id} is ${restore ? 'not archived' : 'archived already'}`)
  }
  const after = { ...before, observations }
  return finish(work, after, observationAnswer(after, held.id))
})

export const removeObservationTool = onObservation((held, _args, _view, work) => (
  finish(work, removeObservation(work.before, held.id), { id: held.id, label: formatObservationNumber(held.number), title: held.title, removed: true })
))

// --- causes -----------------------------------------------------------------------------

export const addCause: Handler = (args, view) => {
  const work = workOn(view)
  const { before } = work
  const title = (args.title as string).trim()
  if (!title) return refused('agent.badArguments', '"title" must not be blank')
  // Asked before an id is minted, so a refusal leaves no trace; a cause with
  // no body starts as the template, which holds no evidence.
  const body = typeof args.body === 'string' ? args.body : ''
  const number = nextCauseNumber(before.causes)
  const root = args.root === true
  if (args.state === 'verified' && !causeEvidence(body).complete) return unverified(formatCauseNumber(number, root))
  // What it explains, likewise: a new cause is neither itself nor behind
  // anything yet, so only what it names can refuse it.
  const links: CauseLink[] = []
  for (const row of (args.explains as { id: string; scope?: string; strength?: string }[] | undefined) ?? []) {
    const link = linkOf(work, view, row.id, row.scope, row.strength)
    if ('ok' in link) return link
    const why = linkRefusal(before.causes, '', link, belowOf(view))
    if (why) return linkRefused(why, { number, ...(root ? { root } : {}) }, link, before.causes)
    links.push(link)
  }
  // A root cause as it is made, where a person said so: nothing explains a
  // new cause yet, so nothing refuses it (ADR-0032 §3).
  const fresh = newCause({
    id: view.makeId('ca'), number, title, t: view.translate, root,
    ...(typeof args.body === 'string' ? { body: args.body } : {}),
  })
  if (typeof args.state === 'string') fresh.state = args.state as CauseState
  let causes = [...before.causes, fresh]
  for (const link of links) causes = linkCause(causes, fresh.id, link, belowOf(view))
  const after = { ...before, causes }
  return finish(work, after, causeAnswer(work, after, fresh.id))
}

export const updateCauseTool = onCause((held, args, view, work) => {
  const patch: CausePatch = {}
  if (typeof args.title === 'string') {
    if (!args.title.trim()) return refused('agent.badArguments', '"title" must not be blank')
    patch.title = args.title
  }
  if (typeof args.body === 'string') patch.body = args.body
  if (typeof args.state === 'string') patch.state = args.state as CauseState
  if (patch.state === 'verified' && held.state !== 'verified' && !causeEvidence(patch.body ?? held.body).complete) {
    return unverified(causeLabel(held))
  }
  let causes = work.before.causes
  if (typeof args.root === 'boolean') {
    // Made a root cause, or a cause again (ADR-0032 §3): refused while the
    // chain says otherwise — here, or from a scope above — naming the records.
    const change = args.root
      ? makeRootCause(causes, held.id, view.tree?.explainedFromAbove?.(view.scopePath).get(held.id))
      : makeCause(causes, held.id, solutionList(view.model))
    if (!change.ok) return rootRefused(change, held)
    causes = change.causes
  }
  const after = { ...work.before, causes: updateCause(causes, held.id, patch) }
  return finish(work, after, causeAnswer(work, after, held.id))
})

/** Why a cause cannot become a root cause, or go back, said with the records in the way. */
function rootRefused(change: RootChangeRefusal, cause: Cause): AgentAnswer {
  const label = causeLabel(cause)
  if (change.refusal === 'command.rootExplained') {
    const names = [
      ...change.causes.map((one) => `${causeLabel(one)} ${one.title}`),
      ...change.above.map((one) => `${causeLabel(one.cause)} ${one.cause.title} (in ${one.scope || 'the organisation'})`),
    ]
    return refused('command.rootExplained', `${label} is explained by ${names.join(', ')}. A root cause ends the chain: unlink that first (cause.unlink), or make that one the root cause instead.`)
  }
  const names = change.solutions.map((one) => `${formatSolutionNumber(one.number)} ${one.title}`)
  return refused('command.rootAddressed', `${label} is addressed by ${names.join(', ')}, and a solution addresses root causes only. Move it to another root cause (solution.address, then solution.unaddress), or unaddress it, first.`)
}

/**
 * Verified is a claim about evidence (ADR-0021, amended 28 September 2026),
 * and the body is where the evidence goes: refused until it says why the team
 * thinks so and how it was verified — what confirmed it, and when — as a
 * person said it.
 */
function unverified(label: string): AgentAnswer {
  return refused('agent.badArguments', `${label} cannot be verified yet: its body must say, under "Why we think so" and under "How to verify", why the team thinks so and what confirmed it, with the day. Ask the person what confirmed it, write that into "body" in the same call, then mark it verified.`)
}

/**
 * Why a cause may not explain this (`linkRefusal`), said so an agent can act
 * on it: a root cause ends the chain (ADR-0032 §3), so what lies behind one
 * is said after a person has made it a cause again.
 */
function linkRefused(why: LinkRefusal, cause: Pick<Cause, 'number' | 'root'>, link: CauseLink, causes: readonly Cause[]): AgentAnswer {
  const target = link.scope === undefined ? causes.find((one) => one.id === link.id) : undefined
  const name = target ? causeLabel(target) : link.scope === undefined ? link.id : `${link.id} in ${link.scope}`
  const said = causeLabel(cause)
  switch (why) {
    case 'root': return refused('agent.badArguments', `${name} is a root cause, and nothing explains a root cause. If a person says something lies behind it, make it a cause first (cause.update with root false) — refused while a solution addresses it.`)
    case 'self': return refused('agent.badArguments', `${said} cannot explain itself`)
    case 'loop': return refused('agent.badArguments', `${said} cannot explain ${name}: ${name} already leads back to it, and a loop is not an explanation`)
    case 'upward': return refused('agent.badArguments', `${said} cannot explain ${name}: a cause explains the causes of the scopes below its own, never one of its own scope or above it`)
    case 'sideways': return refused('agent.badArguments', `${said} cannot explain ${name}: ${link.scope} is not below this scope, and a cause explains the causes of the scopes below its own only`)
    case 'observationBelow': return refused('agent.badArguments', `${said} cannot explain ${name}: it is an observation of ${link.scope}, and that scope explains its own observations. Link the cause there that explains it instead.`)
    case 'merged': return refused('agent.badArguments', `${said} cannot explain ${name}: one of the two was merged into another cause and is history. Link the cause it was merged into instead.`)
    case 'unknown': return refused('agent.unknownId', `${link.id} in ${link.scope ?? 'this scope'}: scopes.list and causes.list with scope say what there is`)
  }
}

export const linkCauseTool = onCause((held, args, view, work) => {
  const link = linkOf(work, view, args.explains, args.explainsScope, args.strength)
  if ('ok' in link) return link
  const context = belowOf(view)
  const why = linkRefusal(work.before.causes, held.id, link, context)
  if (why) return linkRefused(why, held, link, work.before.causes)
  const causes = linkCause(work.before.causes, held.id, link, context)
  const after = { ...work.before, causes }
  return finish(work, after, causeAnswer(work, after, held.id))
})

export const unlinkCauseTool = onCause((held, args, _view, work) => {
  const target: { id: string; scope?: string } = typeof args.explainsScope === 'string'
    ? { id: String(args.explains), scope: args.explainsScope }
    : { id: (work.observationOf(args.explains) ?? work.causeOf(args.explains))?.id ?? String(args.explains) }
  const after = { ...work.before, causes: unlinkCause(work.before.causes, held.id, target.id, target.scope) }
  return finish(work, after, causeAnswer(work, after, held.id))
})

export const removeCauseTool = onCause((held, _args, _view, work) => {
  // Nothing may go on addressing a cause that is gone (ADR-0026): the
  // solutions lose the link in the same step.
  const after = removeCause(work.before, held.id)
  const commands = [
    ...causesToCommands(work.model, after.causes), ...solutionsToCommands(work.model, forgetCause(solutionList(work.model), held.id)),
  ]
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({ id: held.id, label: causeLabel(held), title: held.title, removed: true }),
  }
})
