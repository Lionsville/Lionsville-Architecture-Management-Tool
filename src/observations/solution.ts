// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The rules for solutions and experiments (ADR-0026): what a team does about
 * a cause, how an idea earns its way to a decision, and whether what was
 * built made the sightings stop.
 *
 * Pure, and over lists, like `observation.ts`: the page and the agent hand a
 * list in and take a list out, and the caller commits the difference.
 *
 * ## One record that matures
 *
 * A solution moves `idea → shaped → testing → proven → adopted`, one step at
 * a time. Each forward step has a **gate**: a list of what the record must
 * say before it may move, read off its fields and off the records around it.
 * The move is refused until the list is empty. The one way past a gate is an
 * experiment **waived** with a reason, because some things cannot be trialled
 * and saying why is the vetting. Back is always one step and never gated,
 * except out of `adopted` while its decision record stands accepted: the
 * record is locked, and the solution would contradict it.
 *
 * ## Decided and built by the records that exist
 *
 * `adopted` needs an accepted decision record of this scope, so the signers
 * and the lock are the Decisions page's. The build is an ordinary plan.
 * *Implemented* is derived from that plan being done and never stored, the
 * way a root cause is derived from the links.
 *
 * ## Whether it held
 *
 * The observations under what a solution addresses should stop being seen
 * once it is implemented. A `seen` event after that day is a finding against
 * the solution, and the team says what it makes of it.
 */
import type { Translate } from '../i18n/strings'
import type { AdrStatus } from '../model/adr'
import type { TransitionStatus, TransitionRole } from '../model/transition'
import type {
  Cause, CauseStrength, EarlierAttempt, Experiment, ExperimentOutcome, Solution, SolutionEvent, SolutionLink,
  SolutionSize, SolutionState,
} from '../model/observation'
import { absorbedBy, isRootCause } from './observation'
import type { Analysis, SharedObservation } from './observation'

export type {
  EarlierAttempt, Experiment, ExperimentOutcome, Solution, SolutionEvent, SolutionEventKind, SolutionLink,
  SolutionSize, SolutionState,
} from '../model/observation'
export { EXPERIMENT_OUTCOMES, SOLUTION_SIZES, SOLUTION_STATES } from '../model/observation'

/** A solution's state, or `implemented`: adopted, and its plan is done. */
export type SolutionPhase = SolutionState | 'implemented'

/** The phases in the order the picture and the register show them. */
export const SOLUTION_PHASES: readonly SolutionPhase[] =
  ['idea', 'shaped', 'testing', 'proven', 'adopted', 'implemented', 'dropped']

/** A scope's solutions and experiments together. */
export type SolutionWork = {
  solutions: Solution[]
  experiments: Experiment[]
}

/** What the rules read from the rest of the scope: only the fields they need. */
export type SolutionContext = {
  causes: readonly Cause[]
  experiments: readonly Experiment[]
  decisions: readonly { id: string; status: AdrStatus }[]
  plans: readonly SolutionPlan[]
}

/** A plan as the rules read it. */
export type SolutionPlan = {
  id: string
  status: TransitionStatus
  to?: string
  elements: readonly { role: TransitionRole }[]
}

// --- numbers and labels ----------------------------------------------------------

function pad(number: number): string {
  return String(Math.max(0, Math.trunc(number))).padStart(4, '0')
}

/** `SO-0003`. */
export function formatSolutionNumber(number: number): string {
  return `SO-${pad(number)}`
}

/** `EX-0002`. */
export function formatExperimentNumber(number: number): string {
  return `EX-${pad(number)}`
}

export function nextSolutionNumber(list: readonly Solution[]): number {
  return list.reduce((highest, one) => Math.max(highest, one.number), 0) + 1
}

export function nextExperimentNumber(list: readonly Experiment[]): number {
  return list.reduce((highest, one) => Math.max(highest, one.number), 0) + 1
}

// --- new records -------------------------------------------------------------------

/** What a new solution's body starts as: the headings the vetting asks about. */
export function solutionTemplate(t: Translate): string {
  const headings = [
    t('solution.tplIdea'), t('solution.tplCosts'), t('solution.tplWhyHere'), t('solution.tplAlternatives'),
    t('solution.tplRisks'),
  ]
  return headings.map((heading) => `## ${heading}\n\n`).join('\n')
}

/** What a new experiment's body starts as. */
export function experimentTemplate(t: Translate): string {
  return `## ${t('solution.tplSetup')}\n\n\n## ${t('solution.tplLearned')}\n\n`
}

export function newSolution(args: {
  id: string
  number: number
  title: string
  /** `yyyy-mm-dd`. */
  date: string
  t: Translate
  addresses?: readonly SolutionLink[]
  body?: string
}): Solution {
  return {
    id: args.id,
    number: args.number,
    title: args.title.trim(),
    state: 'idea',
    addresses: [...(args.addresses ?? [])],
    validatedWith: [],
    attempts: [],
    body: args.body?.trim() ? args.body : solutionTemplate(args.t),
    history: [{ date: args.date, kind: 'proposed' }],
  }
}

/** The strength a new link gets: strong on a root cause, normal on one that has a cause of its own. */
export function defaultStrength(causeId: string, causes: readonly Cause[]): CauseStrength {
  const cause = causes.find((one) => one.id === causeId)
  return cause && isRootCause(cause, causes) ? 'strong' : 'normal'
}

export function newExperiment(args: {
  id: string
  number: number
  title: string
  tests: readonly string[]
  hypothesis: string
  t: Translate
  measure?: string
  where?: string
  by?: string
  from?: string
  to?: string
  body?: string
}): Experiment {
  const optional = (value: string | undefined) => value?.trim() || undefined
  const fields = {
    measure: optional(args.measure), where: optional(args.where), by: optional(args.by),
    from: optional(args.from), to: optional(args.to),
  }
  return {
    id: args.id,
    number: args.number,
    title: args.title.trim(),
    tests: [...new Set(args.tests)],
    hypothesis: args.hypothesis.trim(),
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
    outcome: 'planned',
    body: args.body?.trim() ? args.body : experimentTemplate(args.t),
  }
}

// --- one solution --------------------------------------------------------------------

function replace(list: readonly Solution[], id: string, change: (one: Solution) => Solution): Solution[] {
  return list.map((one) => (one.id === id ? change(one) : one))
}

function withEvent(one: Solution, event: SolutionEvent): Solution {
  return { ...one, history: [...one.history, event] }
}

/** The fields a person edits by hand. State, links and history move through the verbs below. */
export type SolutionPatch = Partial<Pick<
  Solution, 'title' | 'body' | 'benefit' | 'cost' | 'validatedWith' | 'attempts' | 'whyNow'
>> & { noneKnown?: boolean }

/**
 * Change what a person edits. A blank `whyNow` is removed rather than kept
 * empty, `noneKnown: false` removes the flag, the names it was checked with
 * are trimmed and blanks dropped, and an attempt with nothing in it is not
 * an attempt.
 */
export function updateSolution(list: readonly Solution[], id: string, patch: SolutionPatch): Solution[] {
  return replace(list, id, (one) => {
    const { noneKnown, ...fields } = patch
    const next: Solution = { ...one, ...fields }
    if (patch.title !== undefined) next.title = patch.title.trim()
    if (patch.whyNow !== undefined && !patch.whyNow.trim()) delete next.whyNow
    if (noneKnown === true) next.noneKnown = true
    if (noneKnown === false) delete next.noneKnown
    if (patch.validatedWith !== undefined) {
      next.validatedWith = [...new Set(patch.validatedWith.map((name) => name.trim()).filter(Boolean))]
    }
    if (patch.attempts !== undefined) {
      next.attempts = patch.attempts
        .map((attempt): EarlierAttempt => ({
          ...(attempt.when?.trim() ? { when: attempt.when.trim() } : {}),
          what: attempt.what.trim(),
          why: attempt.why.trim(),
        }))
        .filter((attempt) => attempt.what || attempt.why)
    }
    for (const key of ['benefit', 'cost'] as const) {
      if (key in patch && patch[key] === undefined) delete next[key]
    }
    return next
  })
}

/** Say that a solution addresses a cause, or change how directly. */
export function addressCause(list: readonly Solution[], id: string, link: SolutionLink): Solution[] {
  return replace(list, id, (one) => {
    const held = one.addresses.find((address) => address.id === link.id)
    const addresses = held
      ? one.addresses.map((address) => (address === held ? { id: link.id, strength: link.strength } : address))
      : [...one.addresses, { id: link.id, strength: link.strength }]
    return { ...one, addresses }
  })
}

export function unaddressCause(list: readonly Solution[], id: string, causeId: string): Solution[] {
  return replace(list, id, (one) => ({ ...one, addresses: one.addresses.filter((address) => address.id !== causeId) }))
}

/** A cause is gone: nothing addresses it any more. What removing a cause calls. */
export function forgetCause(list: readonly Solution[], causeId: string): Solution[] {
  return list.map((one) => (
    one.addresses.some((address) => address.id === causeId)
      ? { ...one, addresses: one.addresses.filter((address) => address.id !== causeId) }
      : one
  ))
}

/** Name the decision record that accepts it, or the plan that builds it. */
export function linkRecord(
  list: readonly Solution[], id: string, which: 'decision' | 'plan', recordId: string, date: string,
): Solution[] {
  return replace(list, id, (one) => (
    one[which] === recordId ? one : withEvent({ ...one, [which]: recordId }, { date, kind: 'linked', to: which, id: recordId })
  ))
}

// --- the gates ------------------------------------------------------------------------

/** What a gate asks, one line each. The page and the agent say them in these words. */
export type GateItem =
  | 'addresses' | 'benefit' | 'cost' | 'validatedWith' | 'triedBefore' | 'whyNow'
  | 'experimentPlanned' | 'experimentConfirmed' | 'decisionAccepted'

export type Gate = {
  /** The state the solution would move to. */
  to: SolutionState
  items: { item: GateItem; ok: boolean }[]
}

/** The experiments that test this solution. */
export function experimentsFor(experiments: readonly Experiment[], solutionId: string): Experiment[] {
  return experiments.filter((one) => one.tests.includes(solutionId))
}

const FORWARD: readonly SolutionState[] = ['idea', 'shaped', 'testing', 'proven', 'adopted']

/** The state one step back, or nothing from an idea or out of the flow. */
export function previousState(state: SolutionState): SolutionState | undefined {
  const at = FORWARD.indexOf(state)
  return at > 0 ? FORWARD[at - 1] : undefined
}

/**
 * The next step and what it needs, or nothing: an adopted solution has no
 * next state (implemented is the plan's to say) and a dropped one is out of
 * the flow until it is restored.
 */
export function solutionGate(solution: Solution, context: Pick<SolutionContext, 'experiments' | 'decisions'>): Gate | undefined {
  const tests = experimentsFor(context.experiments, solution.id)
  const has = (...outcomes: ExperimentOutcome[]) => tests.some((one) => outcomes.includes(one.outcome))
  switch (solution.state) {
    case 'idea': return {
      to: 'shaped',
      items: [
        { item: 'addresses', ok: solution.addresses.length > 0 },
        { item: 'benefit', ok: solution.benefit !== undefined },
        { item: 'cost', ok: solution.cost !== undefined },
        { item: 'validatedWith', ok: solution.validatedWith.length > 0 },
        { item: 'triedBefore', ok: solution.noneKnown === true || solution.attempts.length > 0 },
        { item: 'whyNow', ok: solution.attempts.length === 0 || Boolean(solution.whyNow?.trim()) },
      ],
    }
    case 'shaped': return { to: 'testing', items: [{ item: 'experimentPlanned', ok: has('planned', 'running') }] }
    case 'testing': return {
      to: 'proven',
      items: [{ item: 'experimentConfirmed', ok: has('confirmed') || Boolean(solution.waived?.trim()) }],
    }
    case 'proven': {
      const decision = context.decisions.find((one) => one.id === solution.decision)
      return { to: 'adopted', items: [{ item: 'decisionAccepted', ok: decision?.status === 'accepted' }] }
    }
    default: return undefined
  }
}

/** The lines of a gate still open. Empty when the solution may move on. */
export function openItems(gate: Gate | undefined): GateItem[] {
  return gate ? gate.items.filter((one) => !one.ok).map((one) => one.item) : []
}

export type MoveRefusal =
  /** No such solution. */
  | 'missing'
  /** Not the step before or after, or out of the flow. */
  | 'notAdjacent'
  /** The gate has open items; the answer names them. */
  | 'gate'
  /** Adopted, and its decision record stands accepted. */
  | 'decided'

export type MoveResult =
  | { ok: true; solutions: Solution[] }
  | { ok: false; refusal: MoveRefusal; open: GateItem[] }

/**
 * One step forward when the gate is clear, or one step back. Every move is a
 * dated event. Two steps at once is refused: a solution that is ready for
 * two gates still passes them one after the other, and the history says so.
 */
export function moveSolution(
  list: readonly Solution[], id: string, to: SolutionState, date: string,
  context: Pick<SolutionContext, 'experiments' | 'decisions'>,
): MoveResult {
  const solution = list.find((one) => one.id === id)
  if (!solution) return { ok: false, refusal: 'missing', open: [] }
  const at = FORWARD.indexOf(solution.state)
  const target = FORWARD.indexOf(to)
  if (at < 0 || target < 0 || Math.abs(target - at) !== 1) return { ok: false, refusal: 'notAdjacent', open: [] }
  if (target > at) {
    const open = openItems(solutionGate(solution, context))
    if (open.length) return { ok: false, refusal: 'gate', open }
  } else if (solution.state === 'adopted') {
    const decision = context.decisions.find((one) => one.id === solution.decision)
    if (decision?.status === 'accepted') return { ok: false, refusal: 'decided', open: [] }
  }
  return { ok: true, solutions: replace(list, id, (one) => withEvent({ ...one, state: to }, { date, kind: 'moved', to })) }
}

/**
 * No experiment is needed, and this is why. A reason is required: a waiver
 * without one is a gate clicked past. Blank is refused by returning the list
 * unchanged; a blank waiver on a waived solution takes the waiver back.
 */
export function waiveExperiment(list: readonly Solution[], id: string, reason: string, date: string): Solution[] {
  const note = reason.trim()
  return replace(list, id, (one) => {
    if (!note) {
      if (!one.waived) return one
      const next = { ...one }
      delete next.waived
      return next
    }
    return withEvent({ ...one, waived: note }, { date, kind: 'waived', note })
  })
}

/**
 * Stopped, with the reason, and kept: a dropped solution is the record of an
 * alternative that was considered. Refused without a note, and refused for
 * an adopted one, whose decision record is superseded on the Decisions page
 * first.
 */
export function dropSolution(list: readonly Solution[], id: string, note: string, date: string): Solution[] {
  const reason = note.trim()
  return replace(list, id, (one) => {
    if (!reason || one.state === 'dropped' || one.state === 'adopted') return one
    return withEvent({ ...one, state: 'dropped', droppedFrom: one.state, dropNote: reason }, { date, kind: 'dropped', note: reason })
  })
}

/** Back where it was dropped from. The note stays in the history. */
export function restoreSolution(list: readonly Solution[], id: string, date: string): Solution[] {
  return replace(list, id, (one) => {
    if (one.state !== 'dropped') return one
    const next: Solution = { ...one, state: one.droppedFrom ?? 'idea' }
    delete next.droppedFrom
    delete next.dropNote
    return withEvent(next, { date, kind: 'restored' })
  })
}

/** Gone, and out of every experiment that tested it. */
export function removeSolution(work: SolutionWork, id: string): SolutionWork {
  return {
    solutions: work.solutions.filter((one) => one.id !== id),
    experiments: work.experiments.map((one) => (
      one.tests.includes(id) ? { ...one, tests: one.tests.filter((test) => test !== id) } : one
    )),
  }
}

// --- experiments --------------------------------------------------------------------------

export type ExperimentPatch = Partial<Pick<
  Experiment, 'title' | 'body' | 'hypothesis' | 'measure' | 'where' | 'by' | 'from' | 'to' | 'result' | 'tests'
>>

/** Change an experiment. Optional text left blank is removed; a blank hypothesis is refused. */
export function updateExperiment(list: readonly Experiment[], id: string, patch: ExperimentPatch): Experiment[] {
  return list.map((one) => {
    if (one.id !== id) return one
    if (patch.hypothesis !== undefined && !patch.hypothesis.trim()) return one
    const next: Experiment = { ...one, ...patch }
    if (patch.title !== undefined) next.title = patch.title.trim()
    if (patch.hypothesis !== undefined) next.hypothesis = patch.hypothesis.trim()
    if (patch.tests !== undefined) next.tests = [...new Set(patch.tests)]
    for (const key of ['measure', 'where', 'by', 'from', 'to', 'result'] as const) {
      if (patch[key] !== undefined && !patch[key]!.trim()) delete next[key]
    }
    return next
  })
}

/** Say how it went. The result, when given, replaces what was written before. */
export function concludeExperiment(
  list: readonly Experiment[], id: string, outcome: ExperimentOutcome, result?: string,
): Experiment[] {
  return list.map((one) => {
    if (one.id !== id) return one
    const next: Experiment = { ...one, outcome }
    if (result !== undefined) {
      if (result.trim()) next.result = result.trim()
      else delete next.result
    }
    return next
  })
}

export function removeExperiment(list: readonly Experiment[], id: string): Experiment[] {
  return list.filter((one) => one.id !== id)
}

// --- what is derived --------------------------------------------------------------------------

/** Adopted and its plan is done: implemented. Otherwise the state as it stands. */
export function solutionPhase(solution: Solution, plans: readonly Pick<SolutionPlan, 'id' | 'status'>[]): SolutionPhase {
  if (solution.state !== 'adopted' || !solution.plan) return solution.state
  const plan = plans.find((one) => one.id === solution.plan)
  return plan?.status === 'done' ? 'implemented' : solution.state
}

export function isLive(solution: Pick<Solution, 'state'>): boolean {
  return solution.state !== 'dropped'
}

/**
 * The day it counts as implemented from, when it is: the plan's end date
 * where the plan has one, else the day it was adopted. A sighting after this
 * day is a sighting the solution was meant to stop.
 */
export function implementedOn(solution: Solution, plans: readonly SolutionPlan[]): string | undefined {
  if (solutionPhase(solution, plans) !== 'implemented') return undefined
  const plan = plans.find((one) => one.id === solution.plan)
  if (plan?.to) return plan.to
  const adopted = [...solution.history].reverse().find((event) => event.kind === 'moved' && event.to === 'adopted')
  return adopted?.date
}

/**
 * Every other solution, dropped ones included, that addresses one of the same
 * causes. What else was considered, read off the records rather than written
 * in a field that goes stale.
 */
export function alternatives(solution: Solution, list: readonly Solution[]): Solution[] {
  const causes = new Set(solution.addresses.map((address) => address.id))
  return list.filter((one) => one.id !== solution.id && one.addresses.some((address) => causes.has(address.id)))
}

/** An observation the rules reached, and the scope it lives in when that is a scope below. */
export type Reached = { id: string; scope?: string }

/**
 * The observations under what a solution addresses: every one reachable from
 * those causes along `explains`, however deep. One this scope merged or one
 * from below it absorbed reads as the observation that took it in.
 */
export function underneath(solution: Pick<Solution, 'addresses'>, analysis: Analysis): Reached[] {
  const found = new Map<string, Reached>()
  const seen = new Set<string>()
  const stack = solution.addresses.map((address) => address.id)
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    const cause = analysis.causes.find((one) => one.id === id)
    for (const link of cause?.explains ?? []) {
      if (link.scope === undefined && analysis.causes.some((one) => one.id === link.id)) {
        stack.push(link.id)
        continue
      }
      const survivor = absorbedBy(analysis.observations, link.id, link.scope)
      const reached: Reached = survivor ? { id: survivor.id } : link.scope === undefined ? { id: link.id } : { id: link.id, scope: link.scope }
      found.set(`${reached.scope ?? ''}#${reached.id}`, reached)
    }
  }
  return [...found.values()]
}

/** What a solution's record asks the team, without stopping it. */
export type SolutionQuestion =
  /** Proven or later, and addresses no root cause: it treats a symptom. */
  | 'worksAround'
  /** Its plan introduces and retires nothing. */
  | 'addsOnly'
  /** Adopted, and no plan names it. */
  | 'adoptedUnplanned'

export function solutionQuestions(solution: Solution, context: Pick<SolutionContext, 'causes' | 'plans'>): SolutionQuestion[] {
  if (!isLive(solution)) return []
  const out: SolutionQuestion[] = []
  const late = FORWARD.indexOf(solution.state) >= FORWARD.indexOf('proven')
  const addressesRoot = solution.addresses.some((address) => {
    const cause = context.causes.find((one) => one.id === address.id)
    return cause !== undefined && isRootCause(cause, context.causes)
  })
  if (late && solution.addresses.length > 0 && !addressesRoot) out.push('worksAround')
  const plan = context.plans.find((one) => one.id === solution.plan)
  if (plan) {
    const adds = plan.elements.some((row) => row.role === 'introduces')
    const retires = plan.elements.some((row) => row.role === 'retires')
    if (adds && !retires) out.push('addsOnly')
  } else if (solution.state === 'adopted') out.push('adoptedUnplanned')
  return out
}

/** A sighting after a solution was implemented: the finding that asks whether it worked. */
export type SeenAgain = Reached & { date: string }

/**
 * The observations under an implemented solution that were seen after the day
 * it counts as implemented from, with the latest such day. Empty when it is
 * not implemented, and empty when it held.
 */
export function seenSinceImplemented(
  solution: Solution, analysis: Analysis, shared: readonly SharedObservation[], plans: readonly SolutionPlan[],
): SeenAgain[] {
  const since = implementedOn(solution, plans)
  if (!since) return []
  const out: SeenAgain[] = []
  for (const reached of underneath(solution, analysis)) {
    const observation = reached.scope === undefined
      ? analysis.observations.find((one) => one.id === reached.id)
      : shared.find((one) => one.scope === reached.scope && one.observation.id === reached.id)?.observation
    const days = (observation?.history ?? []).filter((event) => event.kind === 'seen' && event.date > since).map((event) => event.date)
    if (days.length) out.push({ ...reached, date: days.sort().at(-1)! })
  }
  return out
}

/** The root causes no live solution addresses: what nobody is working on. */
export function rootsWithoutSolution(causes: readonly Cause[], solutions: readonly Solution[]): Cause[] {
  const covered = new Set(solutions.filter(isLive).flatMap((one) => one.addresses.map((address) => address.id)))
  return causes.filter((cause) => isRootCause(cause, causes) && !covered.has(cause.id))
}

/** Rough sizes in order, for sorting and for the width of a mark. */
export function sizeRank(size: SolutionSize | undefined): number {
  return size === undefined ? 0 : size === 'small' ? 1 : size === 'medium' ? 2 : 3
}

/**
 * The context a decision record starts from when it is proposed for a
 * solution: what it addresses, and what else was considered for the same
 * causes. Markdown, in the reader's language; the caller puts it under the
 * record's first heading.
 */
export function decisionContext(solution: Solution, causes: readonly Cause[], list: readonly Solution[], t: Translate): string {
  const lines = [`${formatSolutionNumber(solution.number)} ${solution.title}`, '', t('solution.decisionAddresses'), '']
  for (const address of solution.addresses) {
    const cause = causes.find((one) => one.id === address.id)
    if (cause) lines.push(`* CA-${pad(cause.number)} ${cause.title}`)
  }
  const others = alternatives(solution, list)
  if (others.length) {
    lines.push('', t('solution.decisionAlternatives'), '')
    for (const other of others) {
      const note = other.state === 'dropped' && other.dropNote ? ` (${t('solution.decisionDropped', { note: other.dropNote })})` : ''
      lines.push(`* ${formatSolutionNumber(other.number)} ${other.title}${note}`)
    }
  }
  return `${lines.join('\n')}\n`
}
