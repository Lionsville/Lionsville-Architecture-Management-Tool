// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `observation.merge` and `cause.merge` as one command at the session
 * (ADR-0035 §6): the merge `agent/merge.ts` plans, where everything it
 * writes is the scope the call is for. One transaction, marked the agent's,
 * so `undo` takes it back like any other step.
 *
 * A merge that writes another scope is not a command here: the handler lands
 * it through a host that writes several scopes as one before it asks this
 * table (`merge.landAcross`), and where there is no such host — or inside a
 * batch, which is one transaction at this session — it is refused
 * `agent.scopeNotOpen`, naming the scopes.
 */
import { causesToCommands, observationsToCommands, solutionsToCommands, transaction } from '../../model/commands'
import { causeList, observationList } from '../../model/normalised'
import type { MergeKind } from '../../observations/merge'
import { absorbFromBelow, observationsBelow } from '../../observations/observation'
import { causeLine, findObservation, observationLine } from '../answer'
import { choiceRefused, mergedAnswer, mergeRefused, planFor, writesOf } from '../merge'
import type { Planned } from '../merge'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Args, Handler, Prepared, WriteView } from './shared'

/** The survivor as the tools of its kind answer it, over the lists the merge leaves its scope. */
function survivorLine(planned: Planned, view: WriteView): unknown {
  const { plan, request } = planned
  if (!plan.ok) return undefined
  const here = plan.writes.find((one) => one.scope === request.survivor.scope)!
  if (request.kind === 'observation') {
    return observationLine(here.observations.find((one) => one.id === request.survivor.id)!, here.causes, here.observations)
  }
  return causeLine(here.causes.find((one) => one.id === request.survivor.id)!, here.causes, view.model)
}

function mergeTool(kind: MergeKind): Handler {
  return (args, view) => {
    const planned = planFor(kind, args, view, view.today())
    if ('ok' in planned) return planned
    const refusal = mergeRefused(planned) ?? choiceRefused(planned)
    if (refusal) return refusal
    const writes = writesOf(planned)
    const elsewhere = writes.filter((scope) => scope !== view.scopePath)
    if (elsewhere.length > 0) {
      return refused('agent.scopeNotOpen', `this merge writes ${elsewhere.map((scope) => scope || 'the organisation').join(', ')} as well as `
        + `${view.scopePath || 'the organisation'}, and this host writes only the scope open. merge.plan says which links `
        + 'reach another scope; links with move false keeps one where it is.')
    }
    if (!planned.plan.ok) return refused('agent.badArguments', 'nothing changed')
    const [write] = planned.plan.writes
    const commands = [
      ...observationsToCommands(view.model, write.observations),
      ...causesToCommands(view.model, write.causes),
      ...solutionsToCommands(view.model, write.solutions),
    ]
    return { command: transaction(commands, { origin: 'agent' }), answer: json(mergedAnswer(planned, survivorLine(planned, view))) }
  }
}

/**
 * The old way, kept for one beta: an observation of a scope below folded into
 * one of this scope's, writing only the survivor — the scope below reads the
 * absorption off the tree, as it did before ADR-0035.
 */
function fromBelow(args: Args, view: WriteView): Prepared | AgentAnswer {
  const observations = observationList(view.model)
  const causes = causeList(view.model)
  const into = findObservation(observations, String(args.into))
  if (!into) return refused('agent.unknownId', `observation ${String(args.into)}`)
  const below = view.tree?.analysisBelow?.(view.scopePath) ?? []
  const from = observationsBelow(below)
    .find((one) => one.scope === args.fromScope && findObservation([one.observation], String(args.id)))
  if (!from) return refused('agent.unknownId', `observation ${String(args.id)} in ${String(args.fromScope)}`)
  const before = { observations, causes }
  const after = absorbFromBelow(before, from, into.id, view.today())
  if (after === before) return refused('agent.badArguments', `${String(args.id)} cannot be merged into ${into.id}`)
  const commands = [...observationsToCommands(view.model, after.observations), ...causesToCommands(view.model, after.causes)]
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json(observationLine(after.observations.find((one) => one.id === into.id)!, after.causes, after.observations)),
  }
}

const mergeObservations = mergeTool('observation')

export const mergeObservation: Handler = (args, view) => (
  typeof args.fromScope === 'string' && args.absorb === undefined ? fromBelow(args, view) : mergeObservations(args, view)
)

export const mergeCause: Handler = mergeTool('cause')
