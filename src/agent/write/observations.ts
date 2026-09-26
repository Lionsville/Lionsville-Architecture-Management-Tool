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
import { forgetCause } from '../../observations/solution'
import {
  absorbShared, formatCauseNumber, formatObservationNumber, linkCause, mergeObservations, newCause, newObservation,
  nextCauseNumber, nextObservationNumber, removeCause, removeObservation, seenAgain, setArchived, setShared, unlinkCause,
  updateCause, updateObservation,
} from '../../observations/observation'
import type { Analysis, CausePatch, ObservationPatch } from '../../observations/observation'
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

/** What a cause explains: an observation or a cause here, or an observation shared from below. */
function linkOf(work: Work, view: WriteView, id: unknown, scope: unknown, strength: unknown): CauseLink | AgentAnswer {
  const held = strength === undefined ? 'normal' : strength as CauseStrength
  if (typeof scope === 'string') {
    const shared = (view.tree?.observationsBelow?.(view.scopePath) ?? [])
      .find((one) => one.scope === scope && one.observation.id === id)
    if (!shared) return refused('agent.unknownId', `shared observation ${String(id)} in ${scope}`)
    return { id: shared.observation.id, scope, strength: held }
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
  const date = typeof args.date === 'string' ? args.date : view.today()
  if (!isDay(date)) return refused('agent.badArguments', `date ${date} is not yyyy-mm-dd`)
  const fresh = newObservation({
    id: view.makeId('ob'), number: nextObservationNumber(before.observations), title, date, t: view.translate,
    ...(typeof args.where === 'string' ? { where: args.where } : {}),
    ...(typeof args.by === 'string' ? { by: args.by } : {}),
    ...(typeof args.impact === 'string' ? { impact: args.impact as ObservationImpact } : {}),
    ...(args.shared === true ? { shared: true } : {}),
    ...(typeof args.body === 'string' ? { body: args.body } : {}),
  })
  const after = { ...before, observations: [...before.observations, fresh] }
  return finish(work, after, observationAnswer(after, fresh.id))
}

/** The fields an update names, or the refusal for the first one that cannot be had. */
function observationPatch(args: Args): ObservationPatch | AgentAnswer {
  const patch: ObservationPatch = {}
  if (typeof args.title === 'string') {
    if (!args.title.trim()) return refused('agent.badArguments', '"title" must not be blank')
    patch.title = args.title
  }
  if (typeof args.body === 'string') patch.body = args.body
  if (typeof args.where === 'string') patch.where = args.where
  if (typeof args.by === 'string') patch.by = args.by
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
  let observations = updateObservation(work.before.observations, held.id, patch)
  if (typeof args.shared === 'boolean') observations = setShared(observations, held.id, args.shared, view.today())
  const after = { ...work.before, observations }
  return finish(work, after, observationAnswer(after, held.id))
})

export const observationSeen = onObservation((held, args, view, work) => {
  const after = { ...work.before, observations: seenAgain(work.before.observations, held.id, view.today(), args.note as string | undefined) }
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

export const mergeObservation: Handler = (args, view) => {
  const work = workOn(view)
  const { before } = work
  const into = work.observationOf(args.into)
  if (!into) return refused('agent.unknownId', `observation ${String(args.into)}`)
  if (typeof args.fromScope === 'string') {
    const shared = (view.tree?.observationsBelow?.(view.scopePath) ?? [])
      .find((one) => one.scope === args.fromScope && one.observation.id === args.id)
    if (!shared) return refused('agent.unknownId', `shared observation ${String(args.id)} in ${args.fromScope}`)
    const after = absorbShared(before, shared, into.id, view.today())
    if (after === before) return refused('agent.badArguments', `${String(args.id)} cannot be merged into ${into.id}`)
    return finish(work, after, observationAnswer(after, into.id))
  }
  const from = work.observationOf(args.id)
  if (!from) return refused('agent.unknownId', `observation ${String(args.id)}`)
  const after = mergeObservations(before, from.id, into.id, view.today())
  if (after === before) return refused('agent.badArguments', `${from.id} cannot be merged into ${into.id}`)
  return finish(work, after, observationAnswer(after, into.id))
}

export const removeObservationTool = onObservation((held, _args, _view, work) => (
  finish(work, removeObservation(work.before, held.id), { id: held.id, label: formatObservationNumber(held.number), title: held.title, removed: true })
))

// --- causes -----------------------------------------------------------------------------

export const addCause: Handler = (args, view) => {
  const work = workOn(view)
  const { before } = work
  const title = (args.title as string).trim()
  if (!title) return refused('agent.badArguments', '"title" must not be blank')
  const fresh = newCause({
    id: view.makeId('ca'), number: nextCauseNumber(before.causes), title, t: view.translate,
    ...(typeof args.body === 'string' ? { body: args.body } : {}),
  })
  if (typeof args.state === 'string') fresh.state = args.state as CauseState
  let causes = [...before.causes, fresh]
  for (const row of (args.explains as { id: string; scope?: string; strength?: string }[] | undefined) ?? []) {
    const link = linkOf(work, view, row.id, row.scope, row.strength)
    if ('ok' in link) return link
    causes = linkCause(causes, fresh.id, link)
  }
  const after = { ...before, causes }
  return finish(work, after, causeAnswer(work, after, fresh.id))
}

export const updateCauseTool = onCause((held, args, _view, work) => {
  const patch: CausePatch = {}
  if (typeof args.title === 'string') {
    if (!args.title.trim()) return refused('agent.badArguments', '"title" must not be blank')
    patch.title = args.title
  }
  if (typeof args.body === 'string') patch.body = args.body
  if (typeof args.state === 'string') patch.state = args.state as CauseState
  const after = { ...work.before, causes: updateCause(work.before.causes, held.id, patch) }
  return finish(work, after, causeAnswer(work, after, held.id))
})

export const linkCauseTool = onCause((held, args, view, work) => {
  const link = linkOf(work, view, args.explains, args.scope, args.strength)
  if ('ok' in link) return link
  const causes = linkCause(work.before.causes, held.id, link)
  if (JSON.stringify(causes) === JSON.stringify(work.before.causes)) {
    return refused('agent.badArguments', `${held.id} cannot explain ${link.id}: a cause does not explain itself, and a loop is not an explanation`)
  }
  const after = { ...work.before, causes }
  return finish(work, after, causeAnswer(work, after, held.id))
})

export const unlinkCauseTool = onCause((held, args, _view, work) => {
  const target: { id: string; scope?: string } = typeof args.scope === 'string'
    ? { id: String(args.explains), scope: args.scope }
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
    answer: json({ id: held.id, label: formatCauseNumber(held.number), title: held.title, removed: true }),
  }
})
