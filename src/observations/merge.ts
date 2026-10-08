// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A merge across the tree, planned (ADR-0035): several observations, or
 * several causes, judged to be one thing, folded into one survivor — from
 * this scope or any other, above, below or beside.
 *
 * Pure, and over lists, as every rule of this module is: the caller hands in
 * the analysis of every scope the merge touches, the survivor, the records
 * it absorbs, the values the survivor keeps and what is chosen for each
 * link, and takes back what each scope's lists become — or a refusal. What
 * it writes, and in how many steps, is the caller's (ADR-0035 §5).
 *
 * ## What it writes
 *
 * Every record where it lives (ADR-0012 §7): the survivor in its scope, with
 * the values chosen, the sightings summed and an `absorbed` event per record
 * it took in; each absorbed record in its own, with a `merged` event naming
 * where it went; and each link that moves, on the record it lives on. A
 * scope's path is written on an event or a link only where it is not the
 * scope the record lives in, as every link and event says it.
 *
 * ## What moves
 *
 * Every link that names a record being absorbed is a row of `links`, and
 * moves where the tree lets the survivor hold it (§3): asked as a new link
 * is (`linkRefusal`'s words), never around it. A row that cannot move, or
 * that is unticked, stays on the absorbed record as history. Where a record
 * ends up with the same link twice — both records had it — it keeps one, the
 * stronger unless a strength is chosen.
 */
import type { StringKey, Translate } from '../i18n/strings'
import { isDay } from '../model/lifecycle'
import type {
  Cause, CauseLink, CauseState, CauseStrength, Observation, ObservationImpact, ScopeAnalysis, Solution,
} from '../model/observation'
import {
  causeEvidence, isArchived, isCauseMerged, isMerged, isRootCause, isScopeAboveOrHere, isScopeBelow,
} from './observation'
import type { LinkRefusal } from './observation'

export type MergeKind = 'observation' | 'cause'

/**
 * Why ⌘Z stops at a step that changed other scopes too (ADR-0012 §10,
 * ADR-0035 §5): the open scope's part is on this page's stack, and the other
 * scopes' parts are steps in their own histories, which nothing here can take
 * back.
 */
export const ACROSS_BARRIER: StringKey = 'observation.acrossBarrier'

/** A record somewhere in the tree: the path of the scope it lives in (`''` the organisation), and its id. */
export type RecordAt = { scope: string; id: string }

/** What a surviving observation says, chosen from the set or typed in (ADR-0035 §1). */
export type ObservationValues = {
  title: string
  where?: string
  by?: string
  impact: ObservationImpact
  /** The day it was first seen, `yyyy-mm-dd`. */
  date: string
  body: string
}

/** What a surviving cause says. */
export type CauseValues = {
  title: string
  state: CauseState
  root: boolean
  body: string
}

/** What is chosen for one row of `links`: whether it moves (it does unless said), and its strength. */
export type LinkChoice = { move?: boolean; strength?: CauseStrength }

type MergeBase = {
  survivor: RecordAt
  /** The records folded into the survivor; any scope, the survivor's own included. */
  absorbed: readonly RecordAt[]
  /**
   * The analysis of every scope the merge reads: the survivor's, each
   * absorbed record's, every scope above them, and for causes the scopes
   * what they explain lives in (`scopesForMerge`). A link into a scope not
   * given cannot be asked about, and does not move.
   */
  scopes: readonly ScopeAnalysis[]
  /** Per row of `links`, by its key. A row not named moves where it may, at the strength offered. */
  choices?: Readonly<Record<string, LinkChoice>>
  /** The day of the merge, `yyyy-mm-dd`. */
  date: string
}

/** What a merge is asked to do. `values` left out stay as the survivor has them (ADR-0035 §6). */
export type MergeRequest =
  | (MergeBase & { kind: 'observation'; values?: Partial<ObservationValues> })
  | (MergeBase & { kind: 'cause'; values?: Partial<CauseValues> })

/**
 * Why a link cannot move to the survivor: the link form's words
 * (`LinkRefusal`), and three more a merge meets —
 *
 * - `observationElsewhere` — a cause explains observations of its own scope
 *   only, and the survivor lives above it or beside it (one below is
 *   `observationBelow`);
 * - `solutionElsewhere` — a solution addresses causes of its own scope, and
 *   the survivor lives in another;
 * - `notRoot` — a solution addresses a root cause, and the survivor will not
 *   be one.
 */
export type MergeLinkRefusal = LinkRefusal | 'observationElsewhere' | 'solutionElsewhere' | 'notRoot'

/** One link that names a record being absorbed, and what the merge does with it. */
export type MergeLink = {
  /** Stable for the same link in the same request: what `choices` is keyed by. */
  key: string
  /** A cause explaining something, or a solution addressing a cause. */
  kind: 'explains' | 'addresses'
  /** The record the link lives on: a cause, or a solution. */
  holder: RecordAt
  /** The record it names. */
  target: RecordAt
  /** What the target is; `unknown` where its scope was not given or holds no such record. */
  targetKind: 'observation' | 'cause' | 'unknown'
  strength: CauseStrength
  /** Where it would stand after the merge: the survivor in place of every absorbed record. */
  into: { holder: RecordAt; target: RecordAt }
  /** Why it cannot move; absent where it may. */
  refusal?: MergeLinkRefusal
  /** The record it would land on already has that link, or another row brings it too. */
  both: boolean
  /** The strength offered: the stronger of all the links that would become this one. */
  offered: CauseStrength
  /** It moves: it may, and it was not unticked. */
  moves: boolean
}

/**
 * Why a merge is refused as a whole, with the record where there is one:
 * `nothing` absorbed, a record `missing` from the scopes given, one already
 * `merged` or `archived`, the survivor among the absorbed
 * (`survivorAbsorbed`), a first day that is `notADay`, a cause made verified
 * whose body does not say why (`unverified`), or the two root steps' keys
 * (ADR-0032 §3): a root cause something still explains, or a cause again
 * that a solution still addresses.
 */
export type MergeRefusal =
  | 'nothing' | 'missing' | 'merged' | 'archived' | 'survivorAbsorbed' | 'notADay' | 'unverified'
  | 'command.rootExplained' | 'command.rootAddressed'

/** What each scope's lists become. Only the scopes that change, the survivor's first, the rest in path order. */
export type MergeWrite = ScopeAnalysis

export type MergePlan =
  | { ok: true; links: MergeLink[]; writes: MergeWrite[]; survivor: Observation | Cause }
  | { ok: false; refusal: MergeRefusal; record?: RecordAt; links: MergeLink[] }

// --- paths ------------------------------------------------------------------------------

/** Every scope above `path`, the organisation first. */
function ancestors(path: string): string[] {
  if (path === '') return []
  const parts = path.split('/')
  return ['', ...parts.slice(0, -1).map((_, at) => parts.slice(0, at + 1).join('/'))]
}

const same = (one: RecordAt, other: RecordAt) => one.scope === other.scope && one.id === other.id
const keyOf = (at: RecordAt) => `${at.scope}#${at.id}`

/**
 * The scopes a merge has to read: those of the survivor and of every record
 * it absorbs, every scope above them — a link from above may name them — and,
 * for causes, every scope below that an absorbed cause explains a record of,
 * as far as `read` already says. Read once, then once more with what came
 * back, the list is whole.
 */
export function scopesForMerge(
  kind: MergeKind, records: readonly RecordAt[], read: readonly ScopeAnalysis[] = [],
): string[] {
  const paths = new Set<string>()
  for (const at of records) for (const path of [...ancestors(at.scope), at.scope]) paths.add(path)
  if (kind === 'cause') {
    for (const at of records) {
      const cause = read.find((one) => one.scope === at.scope)?.causes.find((one) => one.id === at.id)
      for (const link of cause?.explains ?? []) if (link.scope !== undefined) paths.add(link.scope)
    }
  }
  return [...paths].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
}

// --- values -----------------------------------------------------------------------------

/**
 * What a surviving observation says before anybody chooses: its own values,
 * and the earliest day of the set as the day first seen — they are one thing,
 * and it was first seen then (ADR-0035 §1).
 */
export function observationDefaults(survivor: Observation, absorbed: readonly Observation[]): ObservationValues {
  const days = [survivor, ...absorbed].map((one) => one.date).filter(isDay).sort()
  return {
    title: survivor.title,
    ...(survivor.where !== undefined ? { where: survivor.where } : {}),
    ...(survivor.by !== undefined ? { by: survivor.by } : {}),
    impact: survivor.impact,
    date: days[0] ?? survivor.date,
    body: survivor.body,
  }
}

/** What a surviving cause says before anybody chooses: its own values. */
export function causeDefaults(survivor: Cause): CauseValues {
  return { title: survivor.title, state: survivor.state, root: isRootCause(survivor), body: survivor.body }
}

/** One absorbed record's description, as *Add the others' descriptions* appends it. */
export type MergedDescription = {
  /** How people say it: `OB-0007`, `CA-0003`. */
  label: string
  /** What its scope is called, where it is not the survivor's. */
  scope?: string
  body: string
}

/**
 * The survivor's description with each absorbed record's appended under a
 * heading of its own — *Merged from OB-0007*, *in* its scope where that is
 * not the survivor's (ADR-0035 §1). One with nothing written is left out.
 */
export function withMergedDescriptions(body: string, others: readonly MergedDescription[], t: Translate): string {
  let out = body.trimEnd()
  for (const one of others) {
    if (!one.body.trim()) continue
    const heading = one.scope !== undefined
      ? t('observation.mergedFromHeadingScope', { label: one.label, scope: one.scope })
      : t('observation.mergedFromHeading', { label: one.label })
    out = `${out}${out ? '\n\n' : ''}## ${heading}\n\n${one.body.trim()}`
  }
  return `${out}\n`
}

// --- the plan ---------------------------------------------------------------------------

type Held = ReadonlyMap<string, ScopeAnalysis>

/** The record at a place, of the kind asked. */
function recordOf<K extends MergeKind>(held: Held, kind: K, at: RecordAt): (K extends 'cause' ? Cause : Observation) | undefined {
  const scope = held.get(at.scope)
  const list: readonly { id: string }[] = kind === 'cause' ? scope?.causes ?? [] : scope?.observations ?? []
  return list.find((one) => one.id === at.id) as (K extends 'cause' ? Cause : Observation) | undefined
}

/** Folded into another before: by its own scope's survivor, by its own word, or by a survivor of another scope. */
function mergedBefore(held: Held, kind: MergeKind, at: RecordAt): boolean {
  const scope = held.get(at.scope)!
  if (kind === 'cause' ? isCauseMerged(scope.causes, at.id) : isMerged(scope.observations, at.id)) return true
  return [...held.values()].some((other) => other.scope !== at.scope && [...other.observations, ...other.causes].some((one) => (
    (one.history ?? []).some((event) => event.kind === 'absorbed' && event.id === at.id && event.scope === at.scope)
  )))
}

/** Why the records cannot be merged at all, before anything about their links is asked. */
function recordRefusal(request: MergeRequest, held: Held, absorbed: readonly RecordAt[]): { refusal: MergeRefusal; record?: RecordAt } | undefined {
  if (absorbed.length === 0) return { refusal: 'nothing' }
  if (absorbed.some((at) => same(at, request.survivor))) return { refusal: 'survivorAbsorbed', record: request.survivor }
  for (const at of [request.survivor, ...absorbed]) {
    const record = held.has(at.scope) ? recordOf(held, request.kind, at) : undefined
    if (!record) return { refusal: 'missing', record: at }
    if (mergedBefore(held, request.kind, at)) return { refusal: 'merged', record: at }
    if (request.kind === 'observation' && isArchived(record as Observation)) return { refusal: 'archived', record: at }
  }
  return undefined
}

/** The ordering a merge keeps the stronger link by. */
const RANK: Record<CauseStrength, number> = { strong: 3, normal: 2, weak: 1 }

function strongest(strengths: readonly CauseStrength[]): CauseStrength | undefined {
  return strengths.reduce<CauseStrength | undefined>((best, one) => (best === undefined || RANK[one] > RANK[best] ? one : best), undefined)
}

/** A link as the cause in `holderScope` writes it: the scope only where it is another. */
function linkTo(holderScope: string, target: RecordAt, strength: CauseStrength): CauseLink {
  return { id: target.id, ...(target.scope !== holderScope ? { scope: target.scope } : {}), strength }
}

/** What a link names, as a place in the tree. */
const targetOf = (holderScope: string, link: { id: string; scope?: string }): RecordAt => ({ scope: link.scope ?? holderScope, id: link.id })

type Row = Omit<MergeLink, 'refusal' | 'both' | 'offered' | 'moves'>

/** Every link that names a record being absorbed, or lives on one, once each. */
function rowsOf(request: MergeRequest, held: Held, absorbed: ReadonlySet<string>): Row[] {
  const { survivor } = request
  const rename = (at: RecordAt) => (absorbed.has(keyOf(at)) ? survivor : at)
  const rows: Row[] = []
  for (const scope of held.values()) {
    for (const cause of scope.causes) {
      const holder = { scope: scope.scope, id: cause.id }
      const holderAbsorbed = absorbed.has(keyOf(holder))
      // A merged cause is history, and what it names stays as it was.
      if (!holderAbsorbed && isCauseMerged(scope.causes, cause.id)) continue
      for (const link of cause.explains) {
        const target = targetOf(scope.scope, link)
        if (!holderAbsorbed && !absorbed.has(keyOf(target))) continue
        rows.push({
          key: `explains:${keyOf(holder)}>${keyOf(target)}`, kind: 'explains', holder, target,
          targetKind: kindAt(held, target), strength: link.strength, into: { holder: rename(holder), target: rename(target) },
        })
      }
    }
    if (request.kind !== 'cause') continue
    for (const solution of scope.solutions) {
      const holder = { scope: scope.scope, id: solution.id }
      for (const address of solution.addresses) {
        const target = { scope: scope.scope, id: address.id }
        if (!absorbed.has(keyOf(target))) continue
        rows.push({
          key: `addresses:${keyOf(holder)}>${keyOf(target)}`, kind: 'addresses', holder, target, targetKind: 'cause',
          strength: address.strength, into: { holder, target: survivor },
        })
      }
    }
  }
  return rows
}

function kindAt(held: Held, at: RecordAt): MergeLink['targetKind'] {
  const scope = held.get(at.scope)
  if (scope?.observations.some((one) => one.id === at.id)) return 'observation'
  if (scope?.causes.some((one) => one.id === at.id)) return 'cause'
  return 'unknown'
}

/** What a row is asked against: the tree as given, who the survivor is, and whether it will be a root. */
type Ask = {
  held: Held
  survivor: RecordAt
  absorbed: ReadonlySet<string>
  rootAfter: boolean
  rows: readonly Row[]
}

/** Why one row cannot move, in the words the link form uses; nothing where it may. */
function rowRefusal(row: Row, ask: Ask): MergeLinkRefusal | undefined {
  const { holder, target } = row.into
  if (row.kind === 'addresses') {
    if (holder.scope !== target.scope) return 'solutionElsewhere'
    return ask.rootAfter ? undefined : 'notRoot'
  }
  if (same(holder, target)) return 'self'
  if (row.targetKind === 'unknown') return 'unknown'
  if (row.targetKind === 'observation') {
    if (target.scope === holder.scope) return undefined
    return isScopeBelow(target.scope, holder.scope) ? 'observationBelow' : 'observationElsewhere'
  }
  const isSurvivor = same(target, ask.survivor)
  const cause = isSurvivor ? undefined : ask.held.get(target.scope)?.causes.find((one) => one.id === target.id)
  if (cause && isCauseMerged(ask.held.get(target.scope)!.causes, cause.id)) return 'merged'
  if (isSurvivor ? ask.rootAfter : isRootCause(cause!)) return 'root'
  if (target.scope === holder.scope) return loops(ask, holder, target) ? 'loop' : undefined
  if (isScopeBelow(target.scope, holder.scope)) return undefined
  return isScopeAboveOrHere(target.scope, holder.scope) ? 'upward' : 'sideways'
}

/**
 * Whether `target` would lead back to `holder` in their scope once the merge
 * is made: every link of the scope's causes with each absorbed cause read as
 * the survivor, and every row that would land a link there. Asked of every
 * row as if all moved, so a pair that would close a loop between them is
 * refused both ways rather than one of them by accident of order.
 */
function loops(ask: Ask, holder: RecordAt, target: RecordAt): boolean {
  const scope = holder.scope
  const name = (at: RecordAt) => (ask.absorbed.has(keyOf(at)) ? ask.survivor : at)
  const edges = new Map<string, Set<string>>()
  const add = (from: RecordAt, to: RecordAt) => {
    if (from.scope !== scope || to.scope !== scope || same(from, to)) return
    const set = edges.get(from.id) ?? new Set<string>()
    set.add(to.id)
    edges.set(from.id, set)
  }
  for (const cause of ask.held.get(scope)?.causes ?? []) {
    for (const link of cause.explains) add(name({ scope, id: cause.id }), name(targetOf(scope, link)))
  }
  for (const row of ask.rows) if (row.kind === 'explains') add(row.into.holder, row.into.target)
  const seen = new Set<string>()
  const stack = [target.id]
  while (stack.length) {
    const id = stack.pop()!
    if (id === holder.id) return true
    if (seen.has(id)) continue
    seen.add(id)
    for (const next of edges.get(id) ?? []) stack.push(next)
  }
  return false
}

/** Where the rows land, by the record and the link they become. */
const landing = (row: Pick<Row, 'kind' | 'into'>) => `${row.kind}:${keyOf(row.into.holder)}>${keyOf(row.into.target)}`

/** The strength of the link the landing record already holds, where it holds one that names no absorbed record. */
function heldStrength(held: Held, row: Row, absorbed: ReadonlySet<string>): CauseStrength | undefined {
  const { holder, target } = row.into
  const scope = held.get(holder.scope)
  if (row.kind === 'addresses') {
    return scope?.solutions.find((one) => one.id === holder.id)?.addresses.find((one) => one.id === target.id)?.strength
  }
  const cause = scope?.causes.find((one) => one.id === holder.id)
  return cause?.explains.find((link) => {
    const named = targetOf(holder.scope, link)
    return same(named, target) && !absorbed.has(keyOf(named))
  })?.strength
}

/** Each row asked, offered a strength, and decided by the choices. */
function decide(rows: readonly Row[], ask: Ask, choices: Readonly<Record<string, LinkChoice>>): MergeLink[] {
  const groups = new Map<string, Row[]>()
  for (const row of rows) groups.set(landing(row), [...(groups.get(landing(row)) ?? []), row])
  return rows.map((row) => {
    const group = groups.get(landing(row))!
    const already = heldStrength(ask.held, row, ask.absorbed)
    const refusal = rowRefusal(row, ask)
    return {
      ...row,
      ...(refusal ? { refusal } : {}),
      both: group.length + (already ? 1 : 0) > 1,
      offered: strongest([...group.map((one) => one.strength), ...(already ? [already] : [])])!,
      moves: refusal === undefined && choices[row.key]?.move !== false,
    }
  })
}

/**
 * The survivor made a root cause with something still explaining it, or made
 * a cause again with a solution still addressing it: the two root steps'
 * refusals (ADR-0032 §3), asked where the merge changes which it is.
 */
function rootRefusal(
  request: MergeRequest, held: Held, absorbed: ReadonlySet<string>, rootAfter: boolean, wasRoot: boolean,
): MergeRefusal | undefined {
  if (request.kind !== 'cause' || rootAfter === wasRoot) return undefined
  const { survivor } = request
  if (rootAfter) {
    const explained = [...held.values()].some((scope) => scope.causes.some((cause) => (
      !absorbed.has(keyOf({ scope: scope.scope, id: cause.id })) && !isCauseMerged(scope.causes, cause.id)
      && cause.explains.some((link) => same(targetOf(scope.scope, link), survivor))
    )))
    return explained ? 'command.rootExplained' : undefined
  }
  const addressed = (held.get(survivor.scope)?.solutions ?? []).some((one) => one.addresses.some((address) => address.id === survivor.id))
  return addressed ? 'command.rootAddressed' : undefined
}

/**
 * Plan a merge: the links it touches, and what every scope it writes becomes
 * — or why it is refused, with the links all the same, so a screen can say
 * what would have moved.
 */
export function planMerge(request: MergeRequest): MergePlan {
  const held: Held = new Map(request.scopes.map((one) => [one.scope, one]))
  const absorbedAt = request.absorbed.filter((at, index) => request.absorbed.findIndex((other) => same(other, at)) === index)
  const record = recordRefusal(request, held, absorbedAt)
  if (record) return { ok: false, ...record, links: [] }
  const absorbed = new Set(absorbedAt.map(keyOf))
  const survivor = recordOf(held, request.kind, request.survivor)!
  const wasRoot = request.kind === 'cause' && isRootCause(survivor as Cause)
  const rootAfter = request.kind === 'cause' ? request.values?.root ?? wasRoot : false
  const rows = rowsOf(request, held, absorbed)
  const links = decide(rows, { held, survivor: request.survivor, absorbed, rootAfter, rows }, request.choices ?? {})
  const valueRefusal = valuesRefusal(request, survivor)
  const refusal = valueRefusal ?? rootRefusal(request, held, absorbed, rootAfter, wasRoot)
  if (refusal) return { ok: false, refusal, ...(valueRefusal ? {} : { record: request.survivor }), links }
  const work = new Work(held)
  const written = request.kind === 'observation'
    ? foldObservations(work, request, absorbedAt)
    : foldCauses(work, request, absorbedAt)
  moveLinks(work, links, request.choices ?? {}, held, absorbed)
  return { ok: true, links, writes: work.changed(request.survivor.scope), survivor: written }
}

/** A value that cannot be the survivor's. */
function valuesRefusal(request: MergeRequest, survivor: Observation | Cause): MergeRefusal | undefined {
  if (request.kind === 'observation') {
    const date = request.values?.date
    return date !== undefined && !isDay(date) ? 'notADay' : undefined
  }
  const cause = survivor as Cause
  const body = request.values?.body ?? cause.body
  const verifying = request.values?.state === 'verified' && cause.state !== 'verified'
  return verifying && !causeEvidence(body).complete ? 'unverified' : undefined
}

// --- writing ----------------------------------------------------------------------------

/** The lists of the scopes a merge writes, copied as they are first written, and what changed. */
class Work {
  private readonly held: Held
  private readonly lists = new Map<string, { observations: Observation[]; causes: Cause[]; solutions: Solution[] }>()

  constructor(held: Held) {
    this.held = held
  }

  private of(scope: string) {
    let lists = this.lists.get(scope)
    if (!lists) {
      const from = this.held.get(scope)!
      lists = { observations: [...from.observations], causes: [...from.causes], solutions: [...from.solutions] }
      this.lists.set(scope, lists)
    }
    return lists
  }

  observation(at: RecordAt, change: (one: Observation) => Observation): void {
    const lists = this.of(at.scope)
    lists.observations = lists.observations.map((one) => (one.id === at.id ? change(one) : one))
  }

  cause(at: RecordAt, change: (one: Cause) => Cause): void {
    const lists = this.of(at.scope)
    lists.causes = lists.causes.map((one) => (one.id === at.id ? change(one) : one))
  }

  solution(at: RecordAt, change: (one: Solution) => Solution): void {
    const lists = this.of(at.scope)
    lists.solutions = lists.solutions.map((one) => (one.id === at.id ? change(one) : one))
  }

  observations(scope: string): readonly Observation[] {
    return this.lists.get(scope)?.observations ?? this.held.get(scope)!.observations
  }

  /** Every scope whose lists changed, `first` first and the rest in path order. */
  changed(first: string): MergeWrite[] {
    const out: MergeWrite[] = []
    for (const [scope, lists] of this.lists) {
      const from = this.held.get(scope)!
      const moved = (a: readonly unknown[], b: readonly unknown[]) => a.some((one, at) => one !== b[at])
      if (!moved(lists.observations, from.observations) && !moved(lists.causes, from.causes) && !moved(lists.solutions, from.solutions)) continue
      out.push({ ...from, ...lists })
    }
    return out.sort((a, b) => (a.scope === first ? -1 : b.scope === first ? 1 : a.scope.localeCompare(b.scope)))
  }
}

/** The surviving observation with the values chosen, every sighting, and an event per record absorbed; each absorbed one told where it went. */
function foldObservations(work: Work, request: Extract<MergeRequest, { kind: 'observation' }>, absorbedAt: readonly RecordAt[]): Observation {
  const { survivor, date } = request
  const values = request.values ?? {}
  const taken = absorbedAt.map((at) => ({ at, one: work.observations(at.scope).find((held) => held.id === at.id)! }))
  let written: Observation | undefined
  work.observation(survivor, (one) => {
    const next: Observation = {
      ...one,
      ...(values.title !== undefined ? { title: values.title.trim() } : {}),
      ...(values.impact !== undefined ? { impact: values.impact } : {}),
      ...(values.date !== undefined ? { date: values.date } : {}),
      ...(values.body !== undefined ? { body: values.body } : {}),
      seen: one.seen + taken.reduce((sum, { one: held }) => sum + held.seen, 0),
      history: [...one.history, ...taken.map(({ at, one: held }) => ({
        date, kind: 'absorbed' as const, id: at.id, ...(at.scope !== survivor.scope ? { scope: at.scope } : {}), seen: held.seen,
      }))],
    }
    for (const field of ['where', 'by'] as const) {
      const said = values[field]
      if (said === undefined) continue
      if (said.trim()) next[field] = said.trim()
      else delete next[field]
    }
    written = next
    return next
  })
  for (const { at } of taken) {
    work.observation(at, (one) => ({
      ...one, history: [...one.history, { date, kind: 'merged', id: survivor.id, ...(survivor.scope !== at.scope ? { scope: survivor.scope } : {}) }],
    }))
  }
  return written!
}

/** The surviving cause with the values chosen and an event per cause absorbed; each absorbed one told where it went. */
function foldCauses(work: Work, request: Extract<MergeRequest, { kind: 'cause' }>, absorbedAt: readonly RecordAt[]): Cause {
  const { survivor, date } = request
  const values = request.values ?? {}
  let written: Cause | undefined
  work.cause(survivor, (one) => {
    const next: Cause = {
      ...one,
      ...(values.title !== undefined ? { title: values.title.trim() } : {}),
      ...(values.state !== undefined ? { state: values.state } : {}),
      ...(values.body !== undefined ? { body: values.body } : {}),
      history: [...one.history ?? [], ...absorbedAt.map((at) => ({
        date, kind: 'absorbed' as const, id: at.id, ...(at.scope !== survivor.scope ? { scope: at.scope } : {}),
      }))],
    }
    if (values.root === true) next.root = true
    if (values.root === false) delete next.root
    written = next
    return next
  })
  for (const at of absorbedAt) {
    work.cause(at, (one) => ({
      ...one, history: [...one.history ?? [], { date, kind: 'merged', id: survivor.id, ...(survivor.scope !== at.scope ? { scope: survivor.scope } : {}) }],
    }))
  }
  return written!
}

/** A link that lands on a record: what it names, and at what strength. */
type Arriving = { target: RecordAt; strength: CauseStrength }

/**
 * One record's links as the merge leaves them, in the order they stood: a
 * link that moves off is gone, one that lands in its place stands there, one
 * the record already held at a landing takes the landing's strength, and
 * what arrives from elsewhere is added after — each landing once.
 */
function relinked<L extends { id: string; strength: CauseStrength }>(
  links: readonly L[], named: (link: L) => RecordAt, make: (target: RecordAt, strength: CauseStrength) => L,
  leaving: readonly MergeLink[], arriving: ReadonlyMap<string, Arriving>,
): L[] {
  const out: L[] = []
  const placed = new Set<string>()
  const put = (one: Arriving) => {
    if (placed.has(keyOf(one.target))) return
    placed.add(keyOf(one.target))
    out.push(make(one.target, one.strength))
  }
  for (const link of links) {
    const target = named(link)
    const row = leaving.find((one) => same(one.target, target))
    const lands = arriving.get(keyOf(row ? row.into.target : target))
    if (lands) put(lands)
    else if (!row) out.push(link)
  }
  for (const one of arriving.values()) put(one)
  return out
}

/**
 * Every row that moves, off the record it was on and onto the one it lands
 * on — once per landing, at the strength chosen there, or the stronger of
 * what moved and what was held.
 */
function moveLinks(
  work: Work, links: readonly MergeLink[], choices: Readonly<Record<string, LinkChoice>>, held: Held, absorbed: ReadonlySet<string>,
): void {
  const moving = links.filter((one) => one.moves)
  const landings = new Map<string, MergeLink[]>()
  for (const row of moving) landings.set(landing(row), [...(landings.get(landing(row)) ?? []), row])
  /** Per record, by kind and place: the rows leaving it and the links arriving on it. */
  const records = new Map<string, { kind: MergeLink['kind']; at: RecordAt; leaving: MergeLink[]; arriving: Map<string, Arriving> }>()
  const record = (kind: MergeLink['kind'], at: RecordAt) => {
    const key = `${kind}:${keyOf(at)}`
    const found = records.get(key) ?? { kind, at, leaving: [], arriving: new Map<string, Arriving>() }
    records.set(key, found)
    return found
  }
  for (const row of moving) record(row.kind, row.holder).leaving.push(row)
  for (const group of landings.values()) {
    const [first] = group
    const already = heldStrength(held, first, absorbed)
    const chosen = strongest(group.flatMap((one) => choices[one.key]?.strength ?? []))
    const strength = chosen ?? strongest([...group.map((one) => one.strength), ...(already ? [already] : [])])!
    record(first.kind, first.into.holder).arriving.set(keyOf(first.into.target), { target: first.into.target, strength })
  }
  for (const { kind, at, leaving, arriving } of records.values()) {
    if (kind === 'addresses') {
      work.solution(at, (one) => ({
        ...one,
        addresses: relinked(one.addresses, (link) => ({ scope: at.scope, id: link.id }), (target, strength) => ({ id: target.id, strength }), leaving, arriving),
      }))
    } else {
      work.cause(at, (one) => ({
        ...one,
        explains: relinked(one.explains, (link) => targetOf(at.scope, link), (target, strength) => linkTo(at.scope, target, strength), leaving, arriving),
      }))
    }
  }
}
