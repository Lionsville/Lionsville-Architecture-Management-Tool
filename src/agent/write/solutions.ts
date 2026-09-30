// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Solutions and experiments (ADR-0026), the way the page does them: every
 * verb a rule over the lists, the change their difference, one transaction.
 * A move the gate refuses is answered with what the gate still needs, so the
 * agent can say what is missing rather than guess.
 */
import type { Command } from '../../model/commands'
import { experimentsToCommands, solutionsToCommands, transaction } from '../../model/commands'
import type { Model } from '../../model/normalised'
import {
  causeList, decisionList, experimentList, fromArrays, observationList, solutionList, toArrays, transitionList,
} from '../../model/normalised'
import { isDay } from '../../model/lifecycle'
import { nextTransitionNumber, transitionLabel } from '../../model/transition'
import type { Transition } from '../../model/transition'
import type { Cause, CauseStrength, ExperimentOutcome, Solution, SolutionSize, SolutionState, EarlierAttempt } from '../../model/observation'
import {
  addressCause, concludeExperiment, decisionBody, defaultStrength, dropSolution, experimentMovesFrom,
  formatExperimentNumber, formatSolutionNumber, linkRecord, mayAddress, mayPlanExperiment, moveSolution, newExperiment,
  newSolution, nextExperimentNumber, nextSolutionNumber, planExperiment, removeExperiment, removeSolution,
  reopenWithdraws, restoreSolution, setTestStrength, unaddressCause, updateExperiment, updateSolution, waiveExperiment,
} from '../../observations/solution'
import type { Experiment, ExperimentPatch, SolutionPatch, SolutionWork } from '../../observations/solution'
import { causeLabel, isRootCause } from '../../observations/observation'
import { formatAdrNumber, newAdr, nextAdrNumber } from '../../decisions/adr'
import { experimentLine, findCause, findExperiment, findSolution, solutionFacts, solutionLine } from '../answer'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Args, Handler, Prepared, WriteView } from './shared'
import { planBody } from './shared'

type Facts = ReturnType<typeof solutionFacts>

/** The two lists as they stand, the causes they address, and how an id or a label finds a row. */
type Work = {
  readonly model: Model
  readonly before: SolutionWork
  readonly causes: readonly Cause[]
  readonly solutionOf: (idOrLabel: unknown) => Solution | undefined
  readonly experimentOf: (idOrLabel: unknown) => Experiment | undefined
}

function workOn(view: WriteView): Work {
  const before: SolutionWork = { solutions: solutionList(view.model), experiments: experimentList(view.model) }
  return {
    model: view.model,
    before,
    causes: causeList(view.model),
    solutionOf: (idOrLabel) => findSolution(before.solutions, String(idOrLabel)),
    experimentOf: (idOrLabel) => findExperiment(before.experiments, String(idOrLabel)),
  }
}

/** The change as one transaction, and the answer read off the lists as they will be. */
function finish(
  work: Work, view: WriteView, after: SolutionWork, answer: (facts: Facts) => unknown, extra: Command[] = [],
): Prepared | AgentAnswer {
  const { model } = work
  const commands = [...extra, ...solutionsToCommands(model, after.solutions), ...experimentsToCommands(model, after.experiments)]
  if (commands.length === 0) return refused('agent.badArguments', 'nothing changed')
  const next = fromArrays({ ...toArrays(model), solutions: after.solutions, experiments: after.experiments })
  return { command: transaction(commands, { origin: 'agent' }), answer: json(answer(solutionFacts({ ...view, model: next }))) }
}

const solutionAnswer = (id: string) => (facts: Facts) => solutionLine(facts.solutions.find((one) => one.id === id)!, facts)
const experimentAnswer = (after: SolutionWork, id: string) => () => experimentLine(after.experiments.find((one) => one.id === id)!, after.solutions)
const withSolutions = (work: Work, solutions: Solution[]): SolutionWork => ({ ...work.before, solutions })

/**
 * A solution addresses a root cause (ADR-0026), and a root cause is one a
 * person said is (ADR-0032 §3): the refusal names the deeper causes where
 * there are some, and otherwise says how a cause becomes a root.
 */
function notRoot(cause: Cause, causes: readonly Cause[]): AgentAnswer | undefined {
  if (isRootCause(cause)) return undefined
  const deeper = causes.filter((one) => one.explains.some((link) => link.id === cause.id && link.scope === undefined))
  const label = causeLabel(cause)
  return refused('agent.badArguments', deeper.length
    ? `${label} is not a root cause: ${deeper.map((one) => causeLabel(one)).join(', ')} explains it. A solution addresses a root cause — address a root cause behind it, or keep asking why until you reach one.`
    : `${label} is not a root cause. A solution addresses a root cause, and a cause becomes one when a person says so: ask them, and only then make it one (cause.update with root true).`)
}

/**
 * Where a solution has no step back, how to get one (ADR-0026, amended 28
 * September 2026): an adopted solution whose record stands accepted is
 * reopened by superseding that record, and the sentence names it.
 */
function reopenHint(solution: Solution, model: Model): string {
  if (solution.state !== 'adopted' || !solution.decision) return ''
  const decision = decisionList(model).find((one) => one.id === solution.decision)
  return decision?.status === 'accepted' ? ` To reopen, supersede ${formatAdrNumber(decision.number)} on the Decisions page.` : ''
}

/**
 * How firmly an experiment bears on each solution it tests, from `strength`:
 * keyed by id or label, and only for a solution it does test.
 */
function withStrengths(
  work: Work, args: Args, list: Experiment[], id: string, tests: readonly string[],
): { list: Experiment[] } | { refusal: AgentAnswer } {
  let next = list
  for (const [idOrLabel, strength] of Object.entries((args.strength as Record<string, CauseStrength> | undefined) ?? {})) {
    const tested = work.solutionOf(idOrLabel)
    if (!tested) return { refusal: refused('agent.unknownId', `solution ${idOrLabel}`) }
    if (!tests.includes(tested.id)) return { refusal: refused('agent.badArguments', `the experiment does not test ${formatSolutionNumber(tested.number)}; add it to tests first`) }
    next = setTestStrength(next, id, tested.id, strength)
  }
  return { list: next }
}

/** The solutions an experiment tests, by id, from the ids or labels given. */
function testedIds(work: Work, given: readonly string[]): string[] | AgentAnswer {
  const tests: string[] = []
  for (const idOrLabel of given) {
    const tested = work.solutionOf(idOrLabel)
    if (!tested) return refused('agent.unknownId', `solution ${idOrLabel}`)
    tests.push(tested.id)
  }
  return tests
}

/** A verb about one solution this scope holds: found by id or label, or refused. */
function onSolution(then: (solution: Solution, args: Args, view: WriteView, work: Work) => Prepared | AgentAnswer): Handler {
  return (args, view) => {
    const work = workOn(view)
    const solution = work.solutionOf(args.id)
    if (!solution) return refused('agent.unknownId', `solution ${String(args.id)}`)
    return then(solution, args, view, work)
  }
}

/** A verb about one experiment this scope holds: found by id or label, or refused. */
function onExperiment(then: (experiment: Experiment, args: Args, view: WriteView, work: Work) => Prepared | AgentAnswer): Handler {
  return (args, view) => {
    const work = workOn(view)
    const experiment = work.experimentOf(args.id)
    if (!experiment) return refused('agent.unknownId', `experiment ${String(args.id)}`)
    return then(experiment, args, view, work)
  }
}

// --- solutions --------------------------------------------------------------------------

export const proposeSolution: Handler = (args, view) => {
  const work = workOn(view)
  const { before, causes } = work
  const title = (args.title as string).trim()
  if (!title) return refused('agent.badArguments', '"title" must not be blank')
  const addresses = []
  for (const row of (args.addresses as { id: string; strength?: CauseStrength }[] | undefined) ?? []) {
    const cause = findCause(causes, row.id)
    if (!cause) return refused('agent.unknownId', `cause ${row.id}`)
    const refusal = notRoot(cause, causes)
    if (refusal) return refusal
    addresses.push({ id: cause.id, strength: row.strength ?? defaultStrength(cause.id, causes) })
  }
  const fresh = newSolution({
    id: view.makeId('so'), number: nextSolutionNumber(before.solutions), title, date: view.today(), t: view.translate, addresses,
    ...(typeof args.body === 'string' ? { body: args.body } : {}),
  })
  return finish(work, view, withSolutions(work, [...before.solutions, fresh]), solutionAnswer(fresh.id))
}

/** The fields an update names, or the refusal for a blank title. */
function solutionPatch(args: Args): SolutionPatch | AgentAnswer {
  const patch: SolutionPatch = {}
  if (typeof args.title === 'string') {
    if (!args.title.trim()) return refused('agent.badArguments', '"title" must not be blank')
    patch.title = args.title
  }
  if (typeof args.body === 'string') patch.body = args.body
  if (typeof args.benefit === 'string') patch.benefit = args.benefit as SolutionSize
  if (typeof args.cost === 'string') patch.cost = args.cost as SolutionSize
  if (Array.isArray(args.validatedWith)) patch.validatedWith = args.validatedWith as string[]
  if (Array.isArray(args.attempts)) patch.attempts = args.attempts as EarlierAttempt[]
  if (typeof args.noneKnown === 'boolean') patch.noneKnown = args.noneKnown
  if (typeof args.whyNow === 'string') patch.whyNow = args.whyNow
  return patch
}

export const updateSolutionTool = onSolution((solution, args, view, work) => {
  const patch = solutionPatch(args)
  if ('ok' in patch) return patch
  return finish(work, view, withSolutions(work, updateSolution(work.before.solutions, solution.id, patch)), solutionAnswer(solution.id))
})

export const addressSolution = onSolution((solution, args, view, work) => {
  const { causes } = work
  const cause = findCause(causes, String(args.cause))
  if (!cause) return refused('agent.unknownId', `cause ${String(args.cause)}`)
  // A link that is already there may change its strength, root or not.
  const held = solution.addresses.some((address) => address.id === cause.id)
  if (!held && !mayAddress(solution)) {
    return refused('agent.badArguments', `${formatSolutionNumber(solution.number)} is ${solution.state}: a solution takes on a cause while it is an idea or shaped; propose another solution for this one.${reopenHint(solution, work.model)}`)
  }
  const refusal = held ? undefined : notRoot(cause, causes)
  if (refusal) return refusal
  const strength = (args.strength as CauseStrength | undefined) ?? defaultStrength(cause.id, causes)
  return finish(work, view, withSolutions(work, addressCause(work.before.solutions, solution.id, { id: cause.id, strength })), solutionAnswer(solution.id))
})

export const unaddressSolution = onSolution((solution, args, view, work) => {
  const cause = findCause(work.causes, String(args.cause))
  const id = cause?.id ?? String(args.cause)
  if (!solution.addresses.some((address) => address.id === id)) return refused('agent.badArguments', `${solution.id} does not address ${id}`)
  return finish(work, view, withSolutions(work, unaddressCause(work.before.solutions, solution.id, id)), solutionAnswer(solution.id))
})

export const moveSolutionTool = onSolution((solution, args, view, work) => {
  const facts = solutionFacts(view)
  const result = moveSolution(work.before.solutions, solution.id, args.to as SolutionState, view.today(), facts.context)
  if (!result.ok) {
    const why = result.refusal === 'gate'
      ? `the gate to ${String(args.to)} still needs: ${result.open.join(', ')}`
      : result.refusal === 'decided'
        ? `${solution.id} is adopted and its decision record is accepted, which is locked; it has no step back.${reopenHint(solution, work.model)}`
        : `${solution.id} is ${solution.state}; it moves one step at a time, and not while dropped`
    return refused('agent.badArguments', why)
  }
  return finish(work, view, withSolutions(work, result.solutions), solutionAnswer(solution.id))
})

export const waiveSolution = onSolution((solution, args, view, work) => {
  const reason = String(args.reason)
  if (!reason.trim() && !solution.waived) return refused('agent.badArguments', '"reason" must not be blank: a waiver is a reason a person gave')
  return finish(work, view, withSolutions(work, waiveExperiment(work.before.solutions, solution.id, reason, view.today())), solutionAnswer(solution.id))
})

export const dropSolutionTool = onSolution((solution, args, view, work) => {
  if (solution.state === 'adopted') return refused('agent.badArguments', `${solution.id} is adopted: supersede its decision record, move it back, then drop it`)
  if (solution.state === 'dropped') return refused('agent.badArguments', `${solution.id} is dropped already`)
  if (!String(args.note).trim()) return refused('agent.badArguments', '"note" must not be blank')
  return finish(work, view, withSolutions(work, dropSolution(work.before.solutions, solution.id, String(args.note), view.today())), solutionAnswer(solution.id))
})

export const restoreSolutionTool = onSolution((solution, _args, view, work) => {
  if (solution.state !== 'dropped') return refused('agent.badArguments', `${solution.id} is not dropped`)
  return finish(work, view, withSolutions(work, restoreSolution(work.before.solutions, solution.id, view.today())), solutionAnswer(solution.id))
})

export const decideSolution = onSolution((solution, args, view, work) => {
  if (solution.decision) return refused('agent.badArguments', `${solution.id} already rests on ${solution.decision}`)
  const day = view.today()
  const adr = newAdr({ id: view.makeId('adr'), number: nextAdrNumber(decisionList(work.model)), title: solution.title, date: day, t: view.translate })
  adr.body = typeof args.body === 'string' && args.body.trim()
    ? args.body
    : decisionBody(solution, {
      causes: work.causes, solutions: work.before.solutions, experiments: work.before.experiments,
      observations: observationList(work.model),
    }, view.translate)
  const after = withSolutions(work, linkRecord(work.before.solutions, solution.id, 'decision', adr.id, day))
  return finish(work, view, after, (facts) => ({
    ...solutionLine(facts.solutions.find((one) => one.id === solution.id)!, facts),
    proposed: { id: adr.id, label: formatAdrNumber(adr.number), status: adr.status },
  }), [{ type: 'decision.add', decision: adr }])
})

export const planSolution = onSolution((solution, _args, view, work) => {
  if (solution.state !== 'adopted') return refused('agent.badArguments', `${solution.id} is ${solution.state}: a plan builds an adopted solution`)
  if (solution.plan) return refused('agent.badArguments', `${solution.id} is built by ${solution.plan} already`)
  const plan: Transition = {
    id: view.makeId('tr'), number: nextTransitionNumber(transitionList(work.model)), title: solution.title, status: 'draft',
    elements: [], decisions: solution.decision ? [solution.decision] : [], milestones: [], body: planBody(),
  }
  const after = withSolutions(work, linkRecord(work.before.solutions, solution.id, 'plan', plan.id, view.today()))
  return finish(work, view, after, (facts) => ({
    ...solutionLine(facts.solutions.find((one) => one.id === solution.id)!, facts),
    started: { id: plan.id, label: transitionLabel(plan), status: plan.status },
  }), [{ type: 'transition.add', transition: plan }])
})

export const removeSolutionTool = onSolution((solution, _args, view, work) => (
  finish(work, view, removeSolution(work.before, solution.id), () => ({
    id: solution.id, label: formatSolutionNumber(solution.number), title: solution.title, removed: true,
  }))
))

// --- experiments ------------------------------------------------------------------------

export const planExperimentTool: Handler = (args, view) => {
  const work = workOn(view)
  const { before } = work
  const day = view.today()
  const title = String(args.title).trim()
  const hypothesis = String(args.hypothesis).trim()
  if (!title) return refused('agent.badArguments', '"title" must not be blank')
  if (!hypothesis) return refused('agent.badArguments', '"hypothesis" must not be blank')
  const tests = testedIds(work, args.tests as string[])
  if ('ok' in tests) return tests
  if (tests.length === 0) return refused('agent.badArguments', '"tests" must name a solution')
  for (const id of tests) {
    const tested = before.solutions.find((one) => one.id === id)
    if (!tested || mayPlanExperiment(tested)) continue
    const label = formatSolutionNumber(tested.number)
    const instead = tested.state === 'idea' ? ' Answer its gate and move it to shaped first.'
      : tested.state === 'proven' ? ' Move it back to testing first, which says its proof is being tested again.'
        : tested.state === 'dropped' ? ' Restore it first.'
          : reopenHint(tested, work.model)
    return refused('agent.badArguments', `${label} is ${tested.state}: an experiment is planned for a shaped or testing solution.${instead}`)
  }
  for (const key of ['from', 'to'] as const) {
    if (typeof args[key] === 'string' && !isDay(args[key] as string)) return refused('agent.badArguments', `${key} ${String(args[key])} is not yyyy-mm-dd`)
  }
  const text = (key: string) => (typeof args[key] === 'string' ? { [key]: args[key] as string } : {})
  const fresh = newExperiment({
    id: view.makeId('ex'), number: nextExperimentNumber(before.experiments), title, tests, hypothesis, t: view.translate,
    from: typeof args.from === 'string' ? args.from : day,
    ...text('measure'), ...text('where'), ...text('by'), ...text('to'), ...text('body'),
  })
  const strengthened = withStrengths(work, args, [fresh], fresh.id, fresh.tests)
  if ('refusal' in strengthened) return strengthened.refusal
  const after = { ...before, ...planExperiment(before, strengthened.list[0], day) }
  return finish(work, view, after, experimentAnswer(after, fresh.id))
}

/** The fields an update names, or the refusal for the first one that cannot be had. */
function experimentPatch(args: Args, work: Work): ExperimentPatch | AgentAnswer {
  const patch: ExperimentPatch = {}
  for (const key of ['title', 'hypothesis', 'measure', 'where', 'by', 'from', 'to', 'result', 'body'] as const) {
    if (typeof args[key] === 'string') patch[key] = args[key] as string
  }
  if (patch.title !== undefined && !patch.title.trim()) return refused('agent.badArguments', '"title" must not be blank')
  if (patch.hypothesis !== undefined && !patch.hypothesis.trim()) return refused('agent.badArguments', '"hypothesis" must not be blank')
  for (const key of ['from', 'to'] as const) {
    if (patch[key] && !isDay(patch[key]!)) return refused('agent.badArguments', `${key} ${patch[key]} is not yyyy-mm-dd`)
  }
  if (Array.isArray(args.tests)) {
    const tests = testedIds(work, args.tests as string[])
    if ('ok' in tests) return tests
    patch.tests = tests
  }
  return patch
}

export const updateExperimentTool = onExperiment((experiment, args, view, work) => {
  const patch = experimentPatch(args, work)
  if ('ok' in patch) return patch
  const updated = updateExperiment(work.before.experiments, experiment.id, patch)
  const strengthened = withStrengths(work, args, updated, experiment.id, updated.find((one) => one.id === experiment.id)!.tests)
  if ('refusal' in strengthened) return strengthened.refusal
  const after = { ...work.before, experiments: strengthened.list }
  return finish(work, view, after, experimentAnswer(after, experiment.id))
})

/**
 * An experiment moves as the page moves it (ADR-0026, amended 28 September
 * 2026): planned starts running, running is concluded — with the result and
 * the day it ended, today unless `to` says — or goes back to planned, and a
 * concluded one is reopened. The answer says which solutions a reopen took
 * the proof from, so the agent can tell the person.
 */
export const concludeExperimentTool = onExperiment((experiment, args, view, work) => {
  const outcome = args.outcome as ExperimentOutcome
  const label = formatExperimentNumber(experiment.number)
  const withdrawn = outcome === 'running' ? reopenWithdraws(work.before, experiment.id) : []
  const result = concludeExperiment(work.before.experiments, experiment.id, outcome, view.today(), {
    ...(typeof args.result === 'string' ? { result: args.result } : {}),
    ...(typeof args.to === 'string' ? { to: args.to } : {}),
  })
  if (!result.ok) {
    const why = result.refusal === 'notAllowed'
      ? `${label} is ${experiment.outcome}: from there it moves to ${experimentMovesFrom(experiment.outcome).join(' or ')}${experiment.outcome === 'planned' ? ' — start it (running) before it is concluded' : ''}`
      : result.refusal === 'result'
        ? `"result" must say what happened, in numbers where there are numbers: a conclusion without one is a click`
        : result.refusal === 'endDay'
          ? `to ${String(args.to)} is not yyyy-mm-dd`
          : result.refusal === 'endBeforeStart'
            ? `to ${String(args.to ?? view.today())} is before ${label} started, on ${experiment.from ?? ''}`
            : `experiment ${String(args.id)}`
    return refused(result.refusal === 'missing' ? 'agent.unknownId' : 'agent.badArguments', why)
  }
  const after = { ...work.before, experiments: result.experiments }
  return finish(work, view, after, () => ({
    ...experimentLine(after.experiments.find((one) => one.id === experiment.id)!, after.solutions),
    ...(withdrawn.length ? { proofWithdrawn: withdrawn.map((one) => formatSolutionNumber(one.number)) } : {}),
  }))
})

export const removeExperimentTool = onExperiment((experiment, _args, view, work) => (
  finish(work, view, { ...work.before, experiments: removeExperiment(work.before.experiments, experiment.id) }, () => ({
    id: experiment.id, label: formatExperimentNumber(experiment.number), title: experiment.title, removed: true,
  }))
))
