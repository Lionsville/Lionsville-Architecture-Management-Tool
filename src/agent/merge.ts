// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's merge (ADR-0035 §6): `observation.merge`, `cause.merge` and the
 * read that says what either would do, `merge.plan` — one reading of the
 * arguments and one plan for all three, so the preview is the merge.
 *
 * **The plan is the observations module's** (`observations/merge.ts`,
 * `planMerge`). This file reads a call into a request, hands it the scopes it
 * reads, and says the answer in the protocol's words; it decides nothing
 * about which link moves.
 *
 * **What it reads without waiting.** The scope the call is for, from its
 * model — which may hold work not written yet — and every other scope as the
 * tree last read it (`TreeView.analysisBelow('')`). The organisation is not
 * below anything, so where it is not the scope open it is known by the causes
 * it holds that explain a record of the merge (`explainedFromAbove`): enough
 * to say what a merge would do with them, never enough to write it — and a
 * merge that writes a scope other than the call's is written by the host over
 * what the host reads, never over this (§5).
 *
 * **Where it lands.** A merge whose writes are all on the call's scope is one
 * command at the session, as every write is, which `undo` takes back. One that
 * writes other scopes needs a host that writes several scopes as one
 * ({@link ChangeAcross}): the plan is made again over what that host reads,
 * and every scope's part is that scope's step, all or none. A host that has
 * no such seam can write only the scope open, and the merge is refused
 * `agent.scopeNotOpen`, as every other write to another scope is.
 */
import type { Model } from '../model/normalised'
import { causeList, experimentList, observationList, solutionList } from '../model/normalised'
import type { CauseState, CauseStrength, Experiment, ObservationImpact, ScopeAnalysis, Solution } from '../model/observation'
import { planMerge, scopesForMerge } from '../observations/merge'
import type {
  CauseValues, LinkChoice, MergeKind, MergeLink, MergePlan, MergeRefusal, MergeRequest, ObservationValues, RecordAt,
} from '../observations/merge'
import type { Analysis } from '../observations/observation'
import { causeLabel, formatObservationNumber } from '../observations/observation'
import { formatSolutionNumber } from '../observations/solution'
import type { AgentAnswer, AgentRefusal } from './tools'
import { MERGE_LINK_SENTENCE, REFUSAL_SENTENCE, json, refused } from './tools'
import type { TreeView } from './tree'

type Args = Record<string, unknown>

/** What a merge reads its scopes through: the call's scope and its model, and the tree where there is one. */
export type MergeView = {
  readonly model: Model
  readonly scopePath: string
  readonly tree?: Pick<TreeView, 'analysisBelow' | 'explainedFromAbove'>
}

// --- the seam a host that writes several scopes fills ------------------------------------

/** A scope's four lists, as a change across reads and writes them. */
export type AcrossWork = Analysis & { solutions: Solution[]; experiments: Experiment[] }

/**
 * Change several scopes as one (ADR-0031 §1, ADR-0035 §5): read every scope
 * at `paths` — the call's own as the host holds it now — hand `change` their
 * lists, and write each scope it answers as that scope's step, expecting the
 * revision read, all or none. `change` may be called again over a scope that
 * moved, so it does nothing but answer. The steps are the agent's, and a host
 * marks them so. Declared here, structurally, so a host composes it from
 * whatever writes its scopes without this module knowing what that is.
 */
export type ChangeAcross = (
  paths: readonly string[],
  change: (held: ReadonlyMap<string, AcrossWork>) => ReadonlyMap<string, AcrossWork> | { refused: string } | undefined,
) => Promise<ChangedAcross>

/**
 * Where it went: written on `changed` (`unsaved` where the call's own scope
 * holds its part and has not written it yet), or not — refused by `change`
 * with its key, by a writer with its own, by a scope the person may read and
 * not change (`scope`), or because nothing may be written, a scope is gone,
 * or nothing changed. `partial` is the other scopes written and the call's
 * own refusing its part after them.
 */
export type ChangedAcross =
  | { ok: true; changed: readonly string[]; unsaved?: true }
  | { ok: false; reason: string; refused?: string; scope?: string; changed?: readonly string[] }

// --- reading the call -------------------------------------------------------------------

/** A merge as the call asks it, its records found and its values read. */
type Asked = {
  kind: MergeKind
  survivor: RecordAt
  absorbed: RecordAt[]
  values?: MergeRequest['values']
  choices: Record<string, LinkChoice>
}

const LABEL: Record<MergeKind, RegExp> = { observation: /^(?:ob-?)?(\d+)$/i, cause: /^(?:(?:ca|rc)-?)?(\d+)$/i }

/** A record of a scope by id or label; the id as given where the scope holds none, for the plan to call missing. */
function recordAt(kind: MergeKind, known: ReadonlyMap<string, ScopeAnalysis>, scope: string, idOrLabel: unknown): RecordAt {
  const said = String(idOrLabel)
  const held = known.get(scope)
  const list: readonly { id: string; number: number }[] = kind === 'cause' ? held?.causes ?? [] : held?.observations ?? []
  const number = LABEL[kind].exec(said.trim())
  const found = list.find((one) => one.id === said) ?? (number ? list.find((one) => one.number === Number(number[1])) : undefined)
  return { scope, id: found?.id ?? said }
}

/** The fields of the other kind, which a merge of this one does not take. */
const OTHER_KIND: Record<MergeKind, readonly string[]> = {
  observation: ['state', 'root'],
  cause: ['where', 'by', 'impact', 'date'],
}

/** The values the survivor is given, or why they cannot be: never a blank title, place or observer (ADR-0032 §10). */
function valuesOf(kind: MergeKind, raw: unknown): MergeRequest['values'] | AgentAnswer {
  if (raw === undefined || raw === null) return undefined
  const values = { ...(raw as Args) }
  for (const key of Object.keys(values)) if (values[key] === null) delete values[key]
  const wrong = OTHER_KIND[kind].find((key) => values[key] !== undefined)
  if (wrong) return refused('agent.badArguments', `values.${wrong} is not something a merged ${kind} says`)
  for (const field of ['title', 'where', 'by'] as const) {
    if (typeof values[field] === 'string' && !values[field].trim()) return refused('agent.badArguments', `values.${field} must not be blank`)
  }
  return kind === 'cause'
    ? values as Partial<CauseValues> & { state?: CauseState }
    : values as Partial<ObservationValues> & { impact?: ObservationImpact }
}

/** The choices per row, by key. */
function choicesOf(raw: unknown): Record<string, LinkChoice> {
  const choices: Record<string, LinkChoice> = {}
  for (const row of (raw as { key: string; move?: boolean; strength?: CauseStrength }[] | undefined) ?? []) {
    choices[row.key] = { ...(row.move !== undefined ? { move: row.move } : {}), ...(row.strength !== undefined ? { strength: row.strength } : {}) }
  }
  return choices
}

/** The call read into a merge: the survivor, what it absorbs (`id` the old name for one), the values and the choices. */
function askedOf(kind: MergeKind, args: Args, here: string, known: ReadonlyMap<string, ScopeAnalysis>): Asked | AgentAnswer {
  const intoScope = typeof args.intoScope === 'string' ? args.intoScope : here
  const rows = (args.absorb as { id: string; scope?: string }[] | undefined)
    ?? (args.id !== undefined && args.id !== null ? [{ id: String(args.id) }] : [])
  const values = valuesOf(kind, args.values)
  if (values && 'ok' in values) return values
  return {
    kind,
    survivor: recordAt(kind, known, intoScope, args.into),
    absorbed: rows.map((row) => recordAt(kind, known, row.scope ?? intoScope, row.id)),
    ...(values ? { values } : {}),
    choices: choicesOf(args.links),
  }
}

// --- what it reads ----------------------------------------------------------------------

function analysisOf(scope: string, model: Model): ScopeAnalysis {
  return { scope, observations: observationList(model), causes: causeList(model), solutions: solutionList(model), experiments: experimentList(model) }
}

/**
 * Every scope this can read without waiting: the call's from its model, the
 * rest as the tree read them, and — for a scope above that the tree does not
 * list — the causes it holds that explain a record of `records`' scopes.
 * Those are `partial`: enough to plan with, never to write.
 */
function knownScopes(view: MergeView, scopesOfRecords: readonly string[]): { known: Map<string, ScopeAnalysis>; partial: Set<string> } {
  const known = new Map<string, ScopeAnalysis>()
  for (const one of view.tree?.analysisBelow?.('') ?? []) known.set(one.scope, one)
  known.set(view.scopePath, analysisOf(view.scopePath, view.model))
  const partial = new Set<string>()
  for (const scope of scopesOfRecords) {
    for (const above of view.tree?.explainedFromAbove?.(scope).values() ?? []) {
      for (const { scope: at, cause } of above) {
        if (known.has(at) && !partial.has(at)) continue
        const held = known.get(at) ?? { scope: at, observations: [], causes: [], solutions: [], experiments: [] }
        if (!held.causes.some((one) => one.id === cause.id)) known.set(at, { ...held, causes: [...held.causes, cause] })
        partial.add(at)
      }
    }
  }
  return { known, partial }
}

/** A merge planned: the request, what came of it, and the scopes it read. */
export type Planned = {
  readonly request: MergeRequest
  readonly plan: MergePlan
  /** Every scope the merge reads, as a host that writes several is asked to read them. */
  readonly paths: readonly string[]
  /** The scopes known only in part here: a merge that writes one is written by a host that reads it whole. */
  readonly partial: ReadonlySet<string>
}

/** Plan the merge the call asks, over what this can read now; `date` is the day its events carry. */
export function planFor(kind: MergeKind, args: Args, view: MergeView, date: string): Planned | AgentAnswer {
  const intoScope = typeof args.intoScope === 'string' ? args.intoScope : view.scopePath
  const scopesNamed = [intoScope, ...((args.absorb as { scope?: string }[] | undefined) ?? []).map((row) => row.scope ?? intoScope)]
  const { known, partial } = knownScopes(view, [...new Set(scopesNamed)])
  const asked = askedOf(kind, args, view.scopePath, known)
  if ('ok' in asked) return asked
  const records = [asked.survivor, ...asked.absorbed]
  const paths = scopesForMerge(kind, records, [...known.values()])
  const request = {
    kind, survivor: asked.survivor, absorbed: asked.absorbed, choices: asked.choices, date,
    scopes: paths.flatMap((path) => known.get(path) ?? []),
    ...(asked.values ? { values: asked.values } : {}),
  } as MergeRequest
  return { request, plan: planMerge(request), paths, partial }
}

// --- saying it --------------------------------------------------------------------------

/** The agent's key for a merge refused as a whole. */
const MERGE_REFUSAL: Record<MergeRefusal, AgentRefusal> = {
  nothing: 'merge.nothing',
  missing: 'agent.unknownId',
  merged: 'merge.merged',
  archived: 'merge.archived',
  survivorAbsorbed: 'merge.survivorAbsorbed',
  notADay: 'merge.notADay',
  unverified: 'merge.unverified',
  'command.rootExplained': 'command.rootExplained',
  'command.rootAddressed': 'command.rootAddressed',
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

/** Why a merge was refused as a whole, as the agent is answered. */
export function mergeRefused(planned: Planned): AgentAnswer | undefined {
  const { plan, request } = planned
  if (plan.ok) return undefined
  const key = MERGE_REFUSAL[plan.refusal]
  const record = plan.record ? named(plan.record, request.scopes) : undefined
  const about = record ? `${record.label ?? record.id} in ${where(record.scope)}` : undefined
  if (plan.refusal === 'missing') return refused(key, `${request.kind} ${about ?? ''}: scopes.list says which scopes there are, and ${request.kind}s.list with scope what each holds`)
  return refused(key, about)
}

/**
 * A row of `links` the call names that the plan has no row for, or asks to
 * move where the tree forbids it: refused, saying why in the link form's
 * words, rather than quietly left where it is.
 */
export function choiceRefused(planned: Planned): AgentAnswer | undefined {
  const rows = new Map(planned.plan.links.map((row) => [row.key, row]))
  for (const [key, choice] of Object.entries(planned.request.choices ?? {})) {
    const row = rows.get(key)
    if (!row) return refused('agent.badArguments', `links: no link of this merge has the key ${key}; merge.plan says which there are`)
    if (choice.move === true && row.refusal) return refused('merge.linkForbidden', `${key}: ${MERGE_LINK_SENTENCE[row.refusal]}`)
  }
  return undefined
}

/** One row of the plan, as `merge.plan` answers it. */
function rowOf(row: MergeLink, scopes: readonly ScopeAnalysis[]) {
  return {
    key: row.key,
    kind: row.kind,
    holder: named(row.holder, scopes),
    target: named(row.target, scopes),
    into: { holder: named(row.into.holder, scopes), target: named(row.into.target, scopes) },
    strength: row.strength,
    offered: row.offered,
    ...(row.both ? { both: true } : {}),
    moves: row.moves,
    ...(row.refusal ? { refusal: row.refusal, why: MERGE_LINK_SENTENCE[row.refusal] } : {}),
  }
}

/** The scopes a planned merge writes. */
export function writesOf(planned: Planned): string[] {
  return planned.plan.ok ? planned.plan.writes.map((one) => one.scope) : []
}

/** `merge.plan`: what the merge would do, or the refusal it would meet, with the links either way. */
export function planAnswer(args: Args, view: MergeView): AgentAnswer {
  const planned = planFor(args.kind as MergeKind, args, view, '')
  if ('ok' in planned) return planned
  const { plan, request } = planned
  const refusal = mergeRefused(planned) ?? choiceRefused(planned)
  const writes = writesOf(planned)
  return json({
    kind: request.kind,
    survivor: named(request.survivor, request.scopes),
    absorb: request.absorbed.map((at) => named(at, request.scopes)),
    ...(refusal && !refusal.ok ? { refused: refusal.refusal, why: REFUSAL_SENTENCE[refusal.refusal], ...(refusal.detail ? { detail: refusal.detail } : {}) } : {}),
    ...(plan.ok ? { writes, elsewhere: writes.some((scope) => scope !== view.scopePath) } : {}),
    links: plan.links.map((row) => rowOf(row, request.scopes)),
  })
}

/** What a merge that landed answers: the survivor, what it took in, and the rows that stayed. */
export function mergedAnswer(planned: Planned, survivor: unknown, changed?: readonly string[]): unknown {
  const { plan, request } = planned
  const stayed = plan.links.filter((row) => !row.moves).map((row) => ({ key: row.key, ...(row.refusal ? { refusal: row.refusal } : { unticked: true }) }))
  return {
    ...(survivor as object),
    absorbed: request.absorbed.map((at) => named(at, request.scopes)),
    ...(changed ? { changed } : {}),
    ...(stayed.length > 0 ? { stayed } : {}),
  }
}

// --- across scopes ----------------------------------------------------------------------

/** What a host that writes several scopes was asked, the plan made over what it read, and where it went. */
function acrossAnswer(landed: ChangedAcross, last: Planned | undefined): AgentAnswer {
  if (landed.ok) {
    const survivor = last && last.plan.ok ? named(last.request.survivor, last.plan.writes) : undefined
    return json({
      ...(last ? mergedAnswer(last, survivor, landed.changed) as object : { changed: landed.changed }),
      ...(landed.unsaved ? { unsaved: true, note: 'the open scope\'s part is a step not written yet; it is written with the next save' } : {}),
    })
  }
  if (landed.reason === 'refused' && landed.refused) return refused(landed.refused as AgentRefusal, 'over the scopes as they stand now')
  if (landed.reason === 'shell.scopeReadOnly') return refused('agent.readOnly', `${where(landed.scope ?? '')} may be read and not changed here`)
  if (landed.reason === 'shell.scopeMoved') return refused('agent.stale', 'a scope the merge writes kept moving while it was written; read it again')
  if (landed.reason === 'gone') return refused('agent.unknownScope', 'a scope the merge reads is gone')
  if (landed.reason === 'readOnly') return refused('agent.readOnly')
  if (landed.reason === 'partial') return refused('agent.saveFailed', `the other scopes were written (${(landed.changed ?? []).map(where).join(', ')}) and this scope refused its part`)
  if (landed.reason.startsWith('command.')) return refused(landed.reason as AgentRefusal)
  return refused('agent.badArguments', 'nothing changed')
}

/** A merge's lists as a change across writes them. */
function workOf(write: ScopeAnalysis): AcrossWork {
  return { observations: [...write.observations], causes: [...write.causes], solutions: [...write.solutions], experiments: [...write.experiments] }
}

/**
 * Land a merge that writes other scopes through a host that writes several
 * as one: planned again over every scope as the host reads it, and each
 * scope's lists handed back. Nothing where the merge writes only the call's
 * scope, or is refused here — the write tier answers both, as one command or
 * with the refusal — where there is no such host, and for a tool that does
 * not merge (`kind` absent).
 */
export function landAcross(
  kind: MergeKind | undefined, args: Args, view: MergeView, date: string, changeAcross: ChangeAcross | undefined,
): Promise<AgentAnswer> | undefined {
  if (!kind || !changeAcross) return undefined
  const planned = planFor(kind, args, view, date)
  if ('ok' in planned || mergeRefused(planned) || choiceRefused(planned)) return undefined
  if (writesOf(planned).every((scope) => scope === view.scopePath)) return undefined
  let last: Planned | undefined
  return changeAcross(planned.paths, (held) => {
    const scopes = planned.paths.flatMap((path) => {
      const work = held.get(path)
      return work ? [{ scope: path, ...work }] : []
    })
    const request = { ...planned.request, scopes } as MergeRequest
    last = { ...planned, request, plan: planMerge(request), partial: new Set() }
    const refusal = mergeRefused(last) ?? choiceRefused(last)
    if (refusal && !refusal.ok) return { refused: refusal.refusal }
    return last.plan.ok ? new Map(last.plan.writes.map((write) => [write.scope, workOf(write)])) : undefined
  }).then((landed) => acrossAnswer(landed, last))
}
