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
 * once it is implemented. A `seen` event on or after that day is a finding against
 * the solution, and the team says what it makes of it.
 */
import type { Translate } from '../i18n/strings'
import type { AdrStatus } from '../model/adr'
import { isDay } from '../model/lifecycle'
import type { TransitionStatus, TransitionRole } from '../model/transition'
import type {
  Cause, CauseStrength, EarlierAttempt, Experiment, ExperimentOutcome, Observation, Solution, SolutionEvent,
  SolutionLink, SolutionSize, SolutionState,
} from '../model/observation'
import { absorbedBy, formatCauseNumber, formatObservationNumber, isRootCause } from './observation'
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
  /**
   * The day it moved to done, `yyyy-mm-dd`, where the plan recorded one. A
   * plan finished before its end date was built by then, and a sighting that
   * day or after is one the solution was meant to stop.
   */
  doneOn?: string
  elements: readonly { role: TransitionRole }[]
}

/**
 * A plan of the model as the rules read it. Takes anything plan-shaped, so a
 * plan written before plans recorded their done day reads the same.
 */
export function solutionPlanOf(plan: {
  id: string
  status: TransitionStatus
  to?: string
  doneOn?: string
  elements: readonly { role: TransitionRole }[]
}): SolutionPlan {
  return {
    id: plan.id, status: plan.status, elements: plan.elements,
    ...(plan.to ? { to: plan.to } : {}),
    ...(plan.doneOn ? { doneOn: plan.doneOn } : {}),
  }
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

/**
 * Whether a solution may take on another cause: while it is an idea or shaped
 * (ADR-0026, amended 28 September 2026). Once an experiment tests it, what it
 * addresses is what the test is about; once it is proven or decided, a new
 * cause is a new solution. How directly it addresses one it already does may
 * still change.
 */
export function mayAddress(solution: Pick<Solution, 'state'>): boolean {
  return solution.state === 'idea' || solution.state === 'shaped'
}

/**
 * Whether an experiment may be planned for a solution: while it is shaped or
 * testing. An idea has its own gate first; a proven one moves back to testing
 * before it is tested again, so the history says the proof was reopened.
 */
export function mayPlanExperiment(solution: Pick<Solution, 'state'>): boolean {
  return solution.state === 'shaped' || solution.state === 'testing'
}

/**
 * Say that a solution addresses a cause, or change how directly. A new cause
 * is refused, by returning the list unchanged, where {@link mayAddress} says
 * no.
 */
export function addressCause(list: readonly Solution[], id: string, link: SolutionLink): Solution[] {
  return replace(list, id, (one) => {
    const held = one.addresses.find((address) => address.id === link.id)
    if (!held && !mayAddress(one)) return one
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

/**
 * Whether what proves a solution still stands: a confirmed experiment that
 * tests it, or a waiver with a reason. What the gate to proven asks, what the
 * gate to adopted asks again, and what {@link solutionQuestions} asks of a
 * solution past proven once an experiment is reopened or refuted.
 */
export function hasProof(solution: Pick<Solution, 'id' | 'waived'>, experiments: readonly Experiment[]): boolean {
  return experimentsFor(experiments, solution.id).some((one) => one.outcome === 'confirmed') || Boolean(solution.waived?.trim())
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
        // Answered, not merely unasked: "none known" with nothing listed, or
        // an earlier attempt and what is different now. An unanswered "was
        // this tried before?" leaves this open too.
        {
          item: 'whyNow',
          ok: solution.attempts.length === 0 ? solution.noneKnown === true : Boolean(solution.whyNow?.trim()),
        },
      ],
    }
    case 'shaped': return { to: 'testing', items: [{ item: 'experimentPlanned', ok: has('planned', 'running', 'confirmed') }] }
    case 'testing': return {
      to: 'proven',
      items: [{ item: 'experimentConfirmed', ok: hasProof(solution, tests) }],
    }
    case 'proven': {
      // The proof is asked again: an experiment reopened or refuted since the
      // solution was proven has taken it away, and a decision is not taken on
      // a proof that no longer stands.
      const decision = context.decisions.find((one) => one.id === solution.decision)
      return {
        to: 'adopted',
        items: [
          { item: 'experimentConfirmed', ok: hasProof(solution, tests) },
          { item: 'decisionAccepted', ok: decision?.status === 'accepted' },
        ],
      }
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
 * A new experiment, and every shaped solution it tests moved on to testing in
 * the same step: planning the test is starting to test, and the move is still
 * a dated event in the solution's history. One already testing stays where
 * it is. Refused, by returning the work unchanged, when it tests a solution
 * {@link mayPlanExperiment} says no to: an idea has its own gate first, and a
 * proven or decided one moves back to testing before it is tested again.
 */
export function planExperiment(work: SolutionWork, experiment: Experiment, date: string): SolutionWork {
  const tested = work.solutions.filter((one) => experiment.tests.includes(one.id))
  if (tested.some((one) => !mayPlanExperiment(one))) return work
  const experiments = [...work.experiments, experiment]
  let solutions = [...work.solutions]
  for (const id of experiment.tests) {
    if (solutions.find((one) => one.id === id)?.state !== 'shaped') continue
    const moved = moveSolution(solutions, id, 'testing', date, { experiments, decisions: [] })
    if (moved.ok) solutions = moved.solutions
  }
  return { solutions, experiments }
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
    experiments: work.experiments.map((one) => {
      if (!one.tests.includes(id)) return one
      const tests = one.tests.filter((test) => test !== id)
      const next: Experiment = { ...one, tests }
      const kept = pruneStrength(one.strength, tests)
      if (kept) next.strength = kept
      else delete next.strength
      return next
    }),
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
    if (patch.tests !== undefined) {
      next.tests = [...new Set(patch.tests)]
      const kept = pruneStrength(next.strength, next.tests)
      if (kept) next.strength = kept
      else delete next.strength
    }
    for (const key of ['measure', 'where', 'by', 'from', 'to', 'result'] as const) {
      if (patch[key] !== undefined && !patch[key]!.trim()) delete next[key]
    }
    return next
  })
}

/** The strengths still meant: only for what it still tests, and nothing when none is left. */
function pruneStrength(strength: Experiment['strength'], tests: readonly string[]): Experiment['strength'] {
  if (!strength) return undefined
  const kept = Object.fromEntries(Object.entries(strength).filter(([id]) => tests.includes(id)))
  return Object.keys(kept).length ? kept : undefined
}

/** How firmly an experiment bears on one solution it tests; `normal` where nothing was said. */
export function testStrength(experiment: Experiment, solutionId: string): CauseStrength {
  return experiment.strength?.[solutionId] ?? 'normal'
}

/**
 * How firmly an experiment bears on a solution it tests, changed — the line
 * between them on the picture, as a cause's link to what it explains has one.
 * `normal` is not written, so the file says nothing it did not say before.
 */
export function setTestStrength(list: readonly Experiment[], id: string, solutionId: string, strength: CauseStrength): Experiment[] {
  return list.map((one) => {
    if (one.id !== id || !one.tests.includes(solutionId)) return one
    const rest = Object.fromEntries(Object.entries(one.strength ?? {}).filter(([key]) => key !== solutionId))
    const map = strength === 'normal' ? rest : { ...rest, [solutionId]: strength }
    const next: Experiment = { ...one, strength: map }
    if (!Object.keys(map).length) delete next.strength
    return next
  })
}

/** An experiment stops testing a solution. It stays, as the record of what was tried. */
export function untestSolution(list: readonly Experiment[], id: string, solutionId: string): Experiment[] {
  return updateExperiment(list, id, { tests: (list.find((one) => one.id === id)?.tests ?? []).filter((test) => test !== solutionId) })
}

/** Confirmed, refuted or inconclusive: it ran, and the team said how it went. */
export function isConcluded(outcome: ExperimentOutcome): boolean {
  return outcome === 'confirmed' || outcome === 'refuted' || outcome === 'inconclusive'
}

/**
 * Where an experiment may go from here (ADR-0026, amended 28 September 2026).
 * Planned starts running; running goes back to planned or is concluded;
 * a concluded one is reopened, back to running. Never planned straight to an
 * outcome: an experiment that did not run has nothing to say, and a
 * conclusion is a result and a day, not a click.
 */
export function experimentMovesFrom(outcome: ExperimentOutcome): readonly ExperimentOutcome[] {
  switch (outcome) {
    case 'planned': return ['running']
    case 'running': return ['planned', 'confirmed', 'refuted', 'inconclusive']
    default: return ['running']
  }
}

export type ConcludeRefusal =
  /** No such experiment. */
  | 'missing'
  /** Not a move {@link experimentMovesFrom} offers from where it stands. */
  | 'notAllowed'
  /** Concluding without saying what happened. */
  | 'result'
  /** The end day is not `yyyy-mm-dd`. */
  | 'endDay'
  /** The end day is before the day it started. */
  | 'endBeforeStart'

export type ConcludeResult =
  | { ok: true; experiments: Experiment[] }
  | { ok: false; refusal: ConcludeRefusal }

/**
 * Move an experiment on, the way {@link experimentMovesFrom} allows.
 *
 * Starting it (planned → running) sets From to `date`: the day it began,
 * which is the one the plan guessed at until then. Concluding it asks for the
 * result — the one given, or the one already written — and the To day, `date`
 * unless one is given, never before From. Reopening a concluded one takes the
 * To day away, because it is running again; the result stays, as what the
 * last run said, until the next conclusion replaces it.
 */
export function concludeExperiment(
  list: readonly Experiment[], id: string, outcome: ExperimentOutcome, date: string,
  fields: { result?: string; to?: string } = {},
): ConcludeResult {
  const one = list.find((held) => held.id === id)
  if (!one) return { ok: false, refusal: 'missing' }
  if (!experimentMovesFrom(one.outcome).includes(outcome)) return { ok: false, refusal: 'notAllowed' }
  const next: Experiment = { ...one, outcome }
  if (outcome === 'running' && one.outcome === 'planned') next.from = date
  if (outcome === 'running' && isConcluded(one.outcome)) delete next.to
  if (isConcluded(outcome)) {
    const result = (fields.result ?? one.result ?? '').trim()
    if (!result) return { ok: false, refusal: 'result' }
    const end = (fields.to ?? date).trim()
    if (!isDay(end)) return { ok: false, refusal: 'endDay' }
    if (one.from && isDay(one.from) && end < one.from) return { ok: false, refusal: 'endBeforeStart' }
    next.result = result
    next.to = end
  }
  return { ok: true, experiments: list.map((held) => (held.id === id ? next : held)) }
}

/** The states that rest on a proof: past the gate that asked for one. */
const PROOF_HELD: readonly SolutionState[] = ['proven', 'adopted']

/**
 * The solutions that stand proven, or further, on this experiment alone:
 * reopening it would withdraw their proof. What the confirmation before a
 * reopen names, so nobody takes a proof away without being told.
 */
export function reopenWithdraws(work: SolutionWork, experimentId: string): Solution[] {
  const experiment = work.experiments.find((one) => one.id === experimentId)
  if (!experiment || experiment.outcome !== 'confirmed') return []
  const others = work.experiments.filter((one) => one.id !== experimentId)
  return work.solutions.filter((one) => (
    experiment.tests.includes(one.id) && PROOF_HELD.includes(one.state) && !hasProof(one, others)
  ))
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
 * The day it counts as implemented from, when it is: the earlier of the day
 * its plan was done and the plan's end date, where the plan says either — a
 * plan done early was built by then, and one done late still promised its end
 * date — else the day it was adopted. A sighting on this day or after is a
 * sighting the solution was meant to stop.
 */
export function implementedOn(solution: Solution, plans: readonly SolutionPlan[]): string | undefined {
  if (solutionPhase(solution, plans) !== 'implemented') return undefined
  const plan = plans.find((one) => one.id === solution.plan)
  const ends = [plan?.doneOn, plan?.to].filter((day): day is string => typeof day === 'string' && isDay(day)).sort()
  if (ends.length) return ends[0]
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
  /**
   * Proven or later, and nothing proves it any more: no confirmed experiment
   * tests it and it was not waived. Asked, never acted on: its state is a
   * dated move by a person (§2), and an adopted one is held by its locked
   * decision record, so it does not slide back by itself. The gate to
   * adopted asks for the proof again.
   */
  | 'proofWithdrawn'
  /** Proven or later, and addresses no root cause: it treats a symptom. */
  | 'worksAround'
  /** Its plan introduces and retires nothing. */
  | 'addsOnly'
  /** Adopted, and no plan names it. */
  | 'adoptedUnplanned'

export function solutionQuestions(
  solution: Solution, context: Pick<SolutionContext, 'causes' | 'plans' | 'experiments'>,
): SolutionQuestion[] {
  if (!isLive(solution)) return []
  const out: SolutionQuestion[] = []
  const late = FORWARD.indexOf(solution.state) >= FORWARD.indexOf('proven')
  if (late && !hasProof(solution, context.experiments)) out.push('proofWithdrawn')
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
 * The observations under an implemented solution that were seen on or after
 * the day it counts as implemented from, with the latest such day. On, too:
 * the days are days, and a sighting on the day it was built is one it did not
 * stop — the page says which day it was. Empty when it is not implemented,
 * and empty when it held.
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
    const days = (observation?.history ?? []).filter((event) => event.kind === 'seen' && event.date >= since).map((event) => event.date)
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

/** The words for a size, as a sentence says them. */
const SIZE_WORD = { small: 'solution.sizeSmall', medium: 'solution.sizeMedium', large: 'solution.sizeLarge' } as const

/** What {@link decisionBody} reads from the scope around the solution. */
export type DecisionBodyContext = {
  causes: readonly Cause[]
  solutions: readonly Solution[]
  experiments: readonly Experiment[]
  /** This scope's observations, so the confirmation can name what should stop being seen. */
  observations?: readonly Observation[]
}

/**
 * The decision record proposed for a solution, written from the records
 * rather than left as the template's placeholders (ADR-0026, amended 28
 * September 2026). Every section of the record is said:
 *
 * * **context**: the solution, and the causes it addresses;
 * * **drivers**: those causes, the expected benefit and the rough cost;
 * * **considered options**: this solution and every alternative on the same
 *   causes, a dropped one with why it was dropped — or, where there is none,
 *   leaving it as it is;
 * * **outcome**: this solution, because the latest confirmed experiment said
 *   so (its number and its result), or because the experiment was waived;
 * * **consequences**: the benefit as the good one, the cost as the bad one;
 * * **confirmation**: the observations under it, which should stop being seen.
 *
 * Markdown, in the reader's language, with the section headings the Decisions
 * page's own template uses, so the record reads like every other. What it
 * cannot know — a benefit or a cost nobody said — keeps the template's line.
 */
export function decisionBody(solution: Solution, ctx: DecisionBodyContext, t: Translate): string {
  const option = `${formatSolutionNumber(solution.number)} ${solution.title}`
  const causes = solution.addresses
    .map((address) => ctx.causes.find((one) => one.id === address.id))
    .filter((cause): cause is Cause => cause !== undefined)
    .map((cause) => `* ${formatCauseNumber(cause.number)} ${cause.title}`)
  const size = (value: SolutionSize) => t(SIZE_WORD[value]).toLowerCase()

  const drivers = [
    ...causes,
    ...(solution.benefit ? [`* ${t('solution.decisionDriverBenefit', { size: size(solution.benefit) })}`] : []),
    ...(solution.cost ? [`* ${t('solution.decisionDriverCost', { size: size(solution.cost) })}`] : []),
  ]
  const others = alternatives(solution, ctx.solutions).map((other) => {
    const note = other.state === 'dropped' && other.dropNote ? ` (${t('solution.decisionDropped', { note: other.dropNote })})` : ''
    return `${formatSolutionNumber(other.number)} ${other.title}${note}`
  })
  // A decision weighs at least two options, and so does the gate on accepting
  // one (ADR-0008): where no other solution was put forward, the one that is
  // always there — doing nothing — is the other, said as such.
  const options = [option, ...(others.length ? others : [t('solution.decisionLeaveAsIs')])].map((line) => `* ${line}`)

  const confirmed = experimentsFor(ctx.experiments, solution.id)
    .filter((one) => one.outcome === 'confirmed')
    .sort((a, b) => b.number - a.number)[0]
  const waiver = solution.waived?.trim()
  const because = confirmed
    ? t(confirmed.result?.trim() ? 'solution.decisionBecauseConfirmed' : 'solution.decisionBecauseConfirmedBare', {
      experiment: `${formatExperimentNumber(confirmed.number)} ${confirmed.title}`, result: confirmed.result?.trim() ?? '',
    })
    : waiver
      ? t('solution.decisionBecauseWaived', { reason: waiver })
      : '\u2026'
  const chosen = t('solution.decisionChosen', { option, because })

  const good = solution.benefit ? t('solution.decisionGood', { size: size(solution.benefit) }) : t('adr.tplGood')
  const bad = solution.cost ? t('solution.decisionBad', { size: size(solution.cost) }) : t('adr.tplBad')

  const seen = ctx.observations
    ? underneath(solution, { observations: [...ctx.observations], causes: [...ctx.causes] })
      .filter((one) => one.scope === undefined)
      .map((one) => ctx.observations!.find((held) => held.id === one.id))
      .filter((one): one is Observation => one !== undefined)
      .sort((a, b) => a.number - b.number)
      .map((one) => formatObservationNumber(one.number))
    : []
  const confirmation = seen.length
    ? t('solution.decisionConfirmation', { observations: seen.join(', ') })
    : t('solution.decisionConfirmationBare')

  const section = (level: '##' | '###', key: Parameters<Translate>[0], ...lines: string[]) =>
    `${level} ${t(key)}\n\n${lines.join('\n')}\n`
  return [
    section('##', 'adr.tplContext', option, '', t('solution.decisionAddresses'), '', ...(causes.length ? causes : ['* \u2026'])),
    section('##', 'adr.tplDrivers', ...(drivers.length ? drivers : [`* ${t('adr.tplDriver')}`])),
    section('##', 'adr.tplOptions', ...options),
    section('##', 'adr.tplOutcome', chosen),
    section('###', 'adr.tplConsequences', `* ${good}`, `* ${bad}`),
    section('###', 'adr.tplConfirmation', confirmation),
    section('##', 'adr.tplMore', t('solution.decisionMore', { label: formatSolutionNumber(solution.number) })),
  ].join('\n')
}
