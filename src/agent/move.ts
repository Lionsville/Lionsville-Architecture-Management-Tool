// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's move of an observation to another scope (ADR-0038 §3, §4, §7):
 * `observation.move`, and the read that says what it would do, `move.plan` —
 * one reading of the arguments and one plan for both, so the preview is the
 * move. `solution.move`, which moves a solution's state, is unrelated.
 *
 * **The plan is the observations module's** (`observations/move.ts`,
 * `planMove`). This file reads a call into a request, hands it the scopes it
 * reads, and says the answer in the protocol's words.
 *
 * **What it reads without waiting**: the call's scope from its model, and
 * every other scope as the tree last read it — a scope that holds no analysis
 * yet as empty lists, where the tree lists it — which is enough to plan with,
 * never to write.
 *
 * **Where it lands.** A move writes two scopes, always, so it is never one
 * command at the session: it needs a host that writes several scopes as one
 * (`ChangeAcross`, the merge's seam), which reads every scope fresh and plans
 * again over what it read, each scope's part that scope's step, all or none.
 * A host with no such seam can write only the scope open, and the move is
 * refused `agent.scopeNotOpen`.
 */
import type { Model } from '../model/normalised'
import { causeList, commentList, experimentList, observationList, solutionList } from '../model/normalised'
import type { ScopeAnalysis } from '../model/observation'
import { planMove, scopesForMove } from '../observations/move'
import type { MoveLink, MovePlan, MoveRequest, ObservationMoveRefusal } from '../observations/move'
import type { RecordAt } from '../observations/merge'
import { causeLabel, formatObservationNumber } from '../observations/observation'
import { formatSolutionNumber } from '../observations/solution'
import type { AcrossWork, ChangeAcross, ChangedAcross } from './merge'
import type { AgentAnswer, AgentRefusal } from './tools'
import { REFUSAL_SENTENCE, json, refused } from './tools'
import type { TreeView } from './tree'

type Args = Record<string, unknown>

/** What a move reads its scopes through: the call's scope and its model, and the tree where there is one. */
export type MoveView = {
  readonly model: Model
  readonly scopePath: string
  readonly tree?: Pick<TreeView, 'analysisBelow'> & Partial<Pick<TreeView, 'scopes'>>
}

/** A move planned: the request, what came of it, and the scopes it read. */
export type PlannedMove = {
  readonly request: MoveRequest
  readonly plan: MovePlan
  /** Every scope the move reads, as a host that writes several is asked to read them. */
  readonly paths: readonly string[]
}

const LABEL = /^(?:ob-?)?(\d+)$/i

function analysisOf(scope: string, model: Model): ScopeAnalysis {
  return {
    scope, observations: observationList(model), causes: causeList(model), solutions: solutionList(model),
    experiments: experimentList(model), comments: commentList(model),
  }
}

/**
 * Every scope this can read without waiting: the call's from its model, the
 * rest as the tree read them, and — where the tree lists every scope — the
 * ones with no analysis yet as empty lists, so a move into one is planned.
 * Without that listing, the target is taken to be there: the host that
 * writes reads it, and says so where it is not.
 */
function knownScopes(view: MoveView, to: string): Map<string, ScopeAnalysis> {
  const known = new Map<string, ScopeAnalysis>()
  for (const one of view.tree?.analysisBelow?.('') ?? []) known.set(one.scope, one)
  known.set(view.scopePath, analysisOf(view.scopePath, view.model))
  const listed = view.tree?.scopes?.().map((one) => one.path)
  for (const path of listed ?? [to]) {
    if (!known.has(path)) known.set(path, { scope: path, observations: [], causes: [], solutions: [], experiments: [] })
  }
  return known
}

/** The record the call names, by id or label; the id as given where the scope holds none, for the plan to call missing. */
function recordOf(known: ReadonlyMap<string, ScopeAnalysis>, scope: string, said: unknown): RecordAt {
  const text = String(said)
  const list = known.get(scope)?.observations ?? []
  const number = LABEL.exec(text.trim())
  const found = list.find((one) => one.id === text) ?? (number ? list.find((one) => one.number === Number(number[1])) : undefined)
  return { scope, id: found?.id ?? text }
}

/** Plan the move the call asks, over what this can read now; `date` is the day its events carry. */
export function planForMove(args: Args, view: MoveView, date: string): PlannedMove {
  const to = String(args.to)
  const known = knownScopes(view, to)
  const from = recordOf(known, view.scopePath, args.id)
  const paths = scopesForMove(from, to, [...known.values()])
  const request: MoveRequest = { from, to, date, scopes: paths.flatMap((path) => known.get(path) ?? []) }
  return { request, plan: planMove(request), paths }
}

// --- saying it --------------------------------------------------------------------------

/** The agent's key for a move refused (ADR-0038 §1). */
const MOVE_REFUSAL: Record<ObservationMoveRefusal, AgentRefusal> = {
  sameScope: 'move.sameScope',
  missing: 'agent.unknownId',
  merged: 'move.merged',
  moved: 'move.moved',
  archived: 'move.archived',
  unknownScope: 'move.unknownScope',
  taken: 'command.taken',
}

const where = (scope: string) => (scope === '' ? 'the organisation' : scope)

/** A record as an answer names it: its scope, its id, and how people say it where it is known. */
function named(at: RecordAt, scopes: readonly ScopeAnalysis[]) {
  const held = scopes.find((one) => one.scope === at.scope)
  const observation = held?.observations.find((one) => one.id === at.id)
  const cause = held?.causes.find((one) => one.id === at.id)
  const solution = held?.solutions.find((one) => one.id === at.id)
  const label = observation ? formatObservationNumber(observation.number)
    : cause ? causeLabel(cause)
      : solution ? formatSolutionNumber(solution.number) : undefined
  const title = (observation ?? cause ?? solution)?.title
  return { scope: at.scope, id: at.id, ...(label ? { label } : {}), ...(title !== undefined ? { title } : {}) }
}

/** Why a move was refused, as the agent is answered; nothing where it may be made. */
export function moveRefused(planned: PlannedMove): AgentAnswer | undefined {
  const { plan, request } = planned
  if (plan.ok) return undefined
  if (plan.refusal === 'missing') {
    return refused('agent.unknownId', `observation ${request.from.id} in ${where(request.from.scope)}: observations.list says what it holds`)
  }
  if (plan.refusal === 'unknownScope') return refused('move.unknownScope', `${where(request.to)}: scopes.list says which scopes there are`)
  const record = named(request.from, request.scopes)
  return refused(MOVE_REFUSAL[plan.refusal], `${record.label ?? record.id} in ${where(record.scope)}`)
}

/** One link the move cuts, or brings back, as an answer says it. */
function linkOf(row: MoveLink, scopes: readonly ScopeAnalysis[]) {
  return {
    cause: named(row.holder, scopes),
    strength: row.strength,
    ...(row.solutions.length > 0 ? { solutions: row.solutions.map((at) => named(at, scopes)) } : {}),
  }
}

/** `move.plan`: what the move would do, or the refusal it would meet, with the links it would cut either way. */
export function movePlanAnswer(args: Args, view: MoveView): AgentAnswer {
  const planned = planForMove(args, view, '')
  const { plan, request } = planned
  const refusal = moveRefused(planned)
  return json({
    observation: named(request.from, request.scopes),
    to: request.to,
    ...(refusal && !refusal.ok ? { refused: refusal.refusal, why: REFUSAL_SENTENCE[refusal.refusal], ...(refusal.detail ? { detail: refusal.detail } : {}) } : {}),
    ...(plan.ok ? {
      label: formatObservationNumber(plan.number),
      ...(plan.revived ? { revived: true } : {}),
      writes: plan.writes.map((one) => one.scope),
      ...(plan.comments > 0 ? { comments: plan.comments } : {}),
      ...(plan.restored.length > 0 ? { restored: plan.restored.map((row) => linkOf(row, request.scopes)) } : {}),
    } : {}),
    cut: plan.cut.map((row) => linkOf(row, request.scopes)),
  })
}

/** What a move that landed answers: where it is now, under which number, and what was cut. */
function movedAnswer(planned: PlannedMove, changed: readonly string[], unsaved: boolean | undefined): unknown {
  const { plan, request } = planned
  if (!plan.ok) return { changed }
  const from = named(request.from, request.scopes)
  return {
    id: request.from.id,
    label: formatObservationNumber(plan.number),
    scope: request.to,
    title: plan.observation.title,
    from: { scope: from.scope, ...(from.label ? { label: from.label } : {}) },
    ...(plan.revived ? { revived: true } : {}),
    changed,
    ...(plan.cut.length > 0 ? { cut: plan.cut.map((row) => linkOf(row, request.scopes)) } : {}),
    ...(plan.restored.length > 0 ? { restored: plan.restored.map((row) => linkOf(row, request.scopes)) } : {}),
    ...(plan.comments > 0 ? { comments: plan.comments } : {}),
    ...(unsaved ? { unsaved: true, note: 'the open scope\'s part is a step not written yet; it is written with the next save' } : {}),
  }
}

/** Where a move across scopes went, as the agent is answered. */
function landedAnswer(landed: ChangedAcross, last: PlannedMove | undefined): AgentAnswer {
  if (landed.ok) return json(last ? movedAnswer(last, landed.changed, landed.unsaved) : { changed: landed.changed })
  if (landed.reason === 'refused' && landed.refused) return refused(landed.refused as AgentRefusal, 'over the scopes as they stand now')
  if (landed.reason === 'shell.scopeReadOnly') return refused('agent.readOnly', `${where(landed.scope ?? '')} may be read and not changed here`)
  if (landed.reason === 'shell.scopeMoved') return refused('agent.stale', 'a scope the move writes kept moving while it was written; read it again')
  if (landed.reason === 'gone') return refused('move.unknownScope', 'a scope the move reads is gone')
  if (landed.reason === 'readOnly') return refused('agent.readOnly')
  if (landed.reason === 'partial') return refused('agent.saveFailed', `the other scopes were written (${(landed.changed ?? []).map(where).join(', ')}) and this scope refused its part`)
  if (landed.reason.startsWith('command.')) return refused(landed.reason as AgentRefusal)
  return refused('agent.badArguments', 'nothing changed')
}

/** A move's lists as a change across writes them. */
function workOf(write: ScopeAnalysis): AcrossWork {
  return {
    observations: [...write.observations], causes: [...write.causes], solutions: [...write.solutions], experiments: [...write.experiments],
    ...(write.comments ? { comments: [...write.comments] } : {}),
  }
}

/**
 * `observation.move`: planned over what this reads, refused as the plan
 * says, and otherwise landed through a host that writes several scopes as
 * one — planned again over every scope as that host reads it, and each
 * scope's lists handed back. Where there is no such host, `agent.scopeNotOpen`.
 */
export function moveObservation(args: Args, view: MoveView, date: string, changeAcross: ChangeAcross | undefined): Promise<AgentAnswer> | AgentAnswer {
  const planned = planForMove(args, view, date)
  const refusal = moveRefused(planned)
  if (refusal) return refusal
  if (!changeAcross) {
    return refused('agent.scopeNotOpen', `a move writes ${where(planned.request.to)} as well as ${where(view.scopePath)}, and this host `
      + 'writes only the scope open. move.plan says what it would do.')
  }
  let last: PlannedMove | undefined
  return changeAcross(planned.paths, (held) => {
    const scopes = planned.paths.flatMap((path) => {
      const work = held.get(path)
      return work ? [{ scope: path, ...work }] : []
    })
    const request = { ...planned.request, scopes }
    last = { ...planned, request, plan: planMove(request) }
    const again = moveRefused(last)
    if (again && !again.ok) return { refused: again.refusal }
    return last.plan.ok ? new Map(last.plan.writes.map((write) => [write.scope, workOf(write)])) : undefined
  }).then((landed) => landedAnswer(landed, last))
}
