// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An observation moved to another scope, planned (ADR-0038 §1–§4): the same
 * record, under the same id, with the target's next number, and a tombstone
 * where it was.
 *
 * Pure, and over lists, as the merge is (`merge.ts`): the caller hands in the
 * analysis of every scope the move reads (`scopesForMove`), and takes back
 * what each scope's lists become — or a refusal. What it writes, and how the
 * scopes are written as one, is the caller's: the merge's machinery, all or
 * none (§4).
 *
 * ## What it writes
 *
 * - **In the target**, the record with the target's next number and a
 *   `movedIn` event naming the scope it came from and the number it had
 *   there. Where the target holds the record's tombstone — it is moving back
 *   — the tombstone comes back to life under the number it had there, and
 *   the links cut when it left, which still name it, explain it again.
 * - **In the source**, the record as it was, with a `moved` event naming the
 *   target and the new number: a tombstone, read as a merged record is.
 * - **In every scope holding a record it absorbed**, that record's `merged`
 *   event names the target from then on, so reading it leads straight there.
 *
 * The record's own `absorbed` events say a scope only where it is not the one
 * the record lives in, as every event does, so they are said again from the
 * target's side.
 *
 * ## What cannot come along (§2)
 *
 * A cause explains observations of its own scope only, so every link that
 * explains the record is **cut**: it stays on its cause, naming the
 * tombstone, as history. The plan lists each, with the solutions on a root
 * cause it leads to, before anything is written (§3).
 *
 * ## What travels
 *
 * Its thread (ADR-0037 §6, `comments/travel.ts`), in the same writes —
 * where both scopes' comments were handed in.
 */
import type { Cause, CauseStrength, Observation, ObservationEvent, ScopeAnalysis } from '../model/observation'
import type { Comment } from '../model/comment'
import type { RecordKey } from '../model/recordKey'
import { carryCitations } from '../model/citable'
import type { Citation } from '../model/citable'
import { carryThread, threadSize } from '../comments/travel'
import {
  isArchived, isCauseMerged, isMerged, isMoved, isRootCause, nextObservationNumber,
} from './observation'
import type { RecordAt } from './merge'

/** What a move is asked to do. */
export type MoveRequest = {
  /** The observation, where it lives now. */
  from: RecordAt
  /** The path of the scope it goes to, `''` the organisation. */
  to: string
  /**
   * The analysis of every scope the move reads (`scopesForMove`): the source,
   * the target — empty lists for a scope that holds no analysis yet, so it is
   * known to be there — every scope above either, and every scope holding a
   * record it absorbed.
   */
  scopes: readonly ScopeAnalysis[]
  /** The day of the move, `yyyy-mm-dd`. */
  date: string
}

/**
 * Why a move is refused (ADR-0038 §1): to the scope it is in (`sameScope`),
 * of a record `merged` or `moved` already, of one `archived` (restore it
 * first), to a scope that is not there (`unknownScope`), of a record the
 * source does not hold (`missing`), or into a scope already holding another
 * record under its id (`taken`), which no move ever makes.
 */
export type ObservationMoveRefusal = 'sameScope' | 'missing' | 'merged' | 'moved' | 'archived' | 'unknownScope' | 'taken'

/** A link that explains the record, which the move cuts (or, moving it back, brings back). */
export type MoveLink = {
  /** The cause it lives on. */
  holder: RecordAt
  strength: CauseStrength
  /** The solutions that address a root cause the link leads to, in any scope read. */
  solutions: RecordAt[]
}

export type MovePlan =
  | {
    ok: true
    /** The number it has in the target. */
    number: number
    /** It arrives over its own tombstone: it is moving back. */
    revived: boolean
    /** The links cut: they stay on their causes as history. */
    cut: MoveLink[]
    /** Moving back: the links cut when it left, which explain it again. */
    restored: MoveLink[]
    /** How many comments go with it. */
    comments: number
    /** The record as the target holds it. */
    observation: Observation
    /** What each scope's lists become: the source first, the target next, the rest in path order. */
    writes: ScopeAnalysis[]
  }
  | { ok: false; refusal: ObservationMoveRefusal; cut: MoveLink[] }

// --- paths ------------------------------------------------------------------------------

/** Every scope above `path`, the organisation first. */
function ancestors(path: string): string[] {
  if (path === '') return []
  const parts = path.split('/')
  return ['', ...parts.slice(0, -1).map((_, at) => parts.slice(0, at + 1).join('/'))]
}

const byPath = (a: string, b: string) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b))

/**
 * The scopes a move reads: the source and the target, every scope above
 * either — a cause above may still name it (ADR-0021, reported since
 * ADR-0032 §9) — and, as far as `read` says what the record absorbed, the
 * scopes those records live in. Read once, then once more with what came
 * back, the list is whole.
 */
export function scopesForMove(from: RecordAt, to: string, read: readonly ScopeAnalysis[] = []): string[] {
  const paths = new Set<string>([...ancestors(from.scope), from.scope, ...ancestors(to), to])
  const record = read.find((one) => one.scope === from.scope)?.observations.find((one) => one.id === from.id)
  for (const event of record?.history ?? []) {
    if (event.kind === 'absorbed' && event.scope !== undefined) paths.add(event.scope)
  }
  return [...paths].sort(byPath)
}

// --- reading ----------------------------------------------------------------------------

type Held = ReadonlyMap<string, ScopeAnalysis>

const same = (one: RecordAt, other: RecordAt) => one.scope === other.scope && one.id === other.id

/** Folded into another before: by its own scope's survivor, by its own word, or by a survivor elsewhere. */
function mergedBefore(held: Held, at: RecordAt): boolean {
  const scope = held.get(at.scope)!
  if (isMerged(scope.observations, at.id)) return true
  return [...held.values()].some((other) => other.scope !== at.scope && other.observations.some((one) => (
    one.history.some((event) => event.kind === 'absorbed' && event.id === at.id && event.scope === at.scope)
  )))
}

/** Why the move cannot be made, or nothing. */
function refusalOf(request: MoveRequest, held: Held): ObservationMoveRefusal | undefined {
  const { from, to } = request
  const record = held.get(from.scope)?.observations.find((one) => one.id === from.id)
  if (!record) return 'missing'
  if (to === from.scope) return 'sameScope'
  if (!held.has(to)) return 'unknownScope'
  if (isMoved(record)) return 'moved'
  if (mergedBefore(held, from)) return 'merged'
  if (isArchived(record)) return 'archived'
  const there = held.get(to)!.observations.find((one) => one.id === from.id)
  if (there && !isMoved(there)) return 'taken'
  return undefined
}

/** Every cause, by place, that a link of a cause read names: who explains each record. */
function explainersOf(held: Held): Map<string, RecordAt[]> {
  const by = new Map<string, RecordAt[]>()
  for (const scope of held.values()) {
    for (const cause of scope.causes) {
      if (isCauseMerged(scope.causes, cause.id)) continue
      for (const link of cause.explains) {
        const key = `${link.scope ?? scope.scope}#${link.id}`
        by.set(key, [...(by.get(key) ?? []), { scope: scope.scope, id: cause.id }])
      }
    }
  }
  return by
}

/** The solutions on every root cause a cause leads to — itself, or any cause behind it — in the scopes read. */
function solutionsBehind(held: Held, explainers: ReadonlyMap<string, readonly RecordAt[]>, start: RecordAt): RecordAt[] {
  const seen = new Set<string>()
  const roots: RecordAt[] = []
  const stack = [start]
  while (stack.length) {
    const at = stack.pop()!
    const key = `${at.scope}#${at.id}`
    if (seen.has(key)) continue
    seen.add(key)
    const cause = held.get(at.scope)?.causes.find((one) => one.id === at.id)
    if (cause && isRootCause(cause)) roots.push(at)
    stack.push(...(explainers.get(key) ?? []))
  }
  const found: RecordAt[] = []
  for (const root of roots) {
    for (const solution of held.get(root.scope)?.solutions ?? []) {
      const at = { scope: root.scope, id: solution.id }
      if (solution.addresses.some((one) => one.id === root.id) && !found.some((one) => same(one, at))) found.push(at)
    }
  }
  return found
}

/** Every link of a live cause read that explains the record at `at`, with the solutions it leads to. */
function linksTo(held: Held, at: RecordAt): MoveLink[] {
  const explainers = explainersOf(held)
  const rows: MoveLink[] = []
  for (const scope of held.values()) {
    for (const cause of scope.causes) {
      if (isCauseMerged(scope.causes, cause.id)) continue
      const link = cause.explains.find((one) => (one.scope ?? scope.scope) === at.scope && one.id === at.id)
      if (!link) continue
      const holder = { scope: scope.scope, id: cause.id }
      rows.push({ holder, strength: link.strength, solutions: solutionsBehind(held, explainers, holder) })
    }
  }
  return rows.sort((a, b) => byPath(a.holder.scope, b.holder.scope) || numberOf(held, a.holder) - numberOf(held, b.holder))
}

const numberOf = (held: Held, at: RecordAt) => held.get(at.scope)?.causes.find((one) => one.id === at.id)?.number ?? 0

// --- writing ----------------------------------------------------------------------------

/** An event's scope said from `lives`, where a record now lives: none where it names that scope. */
function said(event: ObservationEvent, was: string, lives: string): ObservationEvent {
  if (event.kind !== 'absorbed' && event.kind !== 'merged') return event
  const scope = event.scope ?? was
  const { scope: _old, ...rest } = event
  return scope === lives ? rest : { ...rest, scope }
}

/** The lists a move writes, copied as they are first written. */
class Lists {
  private readonly held: Held
  readonly changed = new Map<string, { observations: Observation[]; comments?: Comment[]; citations?: Citation[] }>()

  constructor(held: Held) {
    this.held = held
  }

  private of(scope: string) {
    let lists = this.changed.get(scope)
    if (!lists) {
      const from = this.held.get(scope)!
      lists = {
        observations: [...from.observations],
        ...(from.comments ? { comments: [...from.comments] } : {}),
        ...(from.citations ? { citations: [...from.citations] } : {}),
      }
      this.changed.set(scope, lists)
    }
    return lists
  }

  observations(scope: string, change: (list: Observation[]) => Observation[]): void {
    const lists = this.of(scope)
    lists.observations = change(lists.observations)
  }

  comments(scope: string): readonly Comment[] | undefined {
    return this.changed.get(scope)?.comments ?? this.held.get(scope)?.comments
  }

  setComments(scope: string, comments: Comment[]): void {
    this.of(scope).comments = comments
  }

  citations(scope: string): readonly Citation[] | undefined {
    return this.changed.get(scope)?.citations ?? this.held.get(scope)?.citations
  }

  /** The observation's citations of principles go with it to the scope it now lives in (ADR-0041 §7). */
  carryCitations(about: RecordKey, from: string, to: string): void {
    const leaving = this.citations(from)
    const arriving = this.citations(to)
    if (!leaving || !arriving) return
    const carried = carryCitations(leaving, arriving, about, about, false)
    if (carried.moved === 0) return
    this.of(from).citations = carried.from
    this.of(to).citations = carried.to
  }

  /** Every scope written, `first` and `second` before the rest. */
  writes(first: string, second: string): ScopeAnalysis[] {
    const rank = (scope: string) => (scope === first ? 0 : scope === second ? 1 : 2)
    return [...this.changed.entries()]
      .map(([scope, lists]) => ({ ...this.held.get(scope)!, ...lists }))
      .sort((a, b) => rank(a.scope) - rank(b.scope) || byPath(a.scope, b.scope))
  }
}

/**
 * Each record the moving one absorbed, told where its survivor lives now: the
 * last `merged` event that names it from where it was is said again from the
 * target. A record of a scope not read keeps its event, and is found through
 * the tombstone.
 */
function readdress(lists: Lists, held: Held, record: Observation, from: RecordAt, to: string): void {
  for (const event of record.history) {
    if (event.kind !== 'absorbed' || event.id === undefined) continue
    const scope = event.scope ?? from.scope
    if (!held.has(scope)) continue
    lists.observations(scope, (list) => list.map((one) => {
      if (one.id !== event.id) return one
      const named = (step: ObservationEvent) => step.kind === 'merged' && step.id === from.id && (step.scope ?? scope) === from.scope
      const at = one.history.reduce((last, step, index) => (named(step) ? index : last), -1)
      if (at < 0) return one
      const step = one.history[at]
      const { scope: _old, ...rest } = step
      const next = scope === to ? rest : { ...rest, scope: to }
      return { ...one, history: one.history.map((held, index) => (index === at ? next : held)) }
    }))
  }
}

/**
 * Plan a move: the number it will have, the links cut, the comments that go
 * with it and what every scope it writes becomes — or why it is refused, with
 * the links all the same, so a screen can say what would have been cut.
 */
export function planMove(request: MoveRequest): MovePlan {
  const held: Held = new Map(request.scopes.map((one) => [one.scope, one]))
  const { from, to, date } = request
  const cut = held.has(from.scope) ? linksTo(held, from) : []
  const refusal = refusalOf(request, held)
  if (refusal) return { ok: false, refusal, cut }
  const record = held.get(from.scope)!.observations.find((one) => one.id === from.id)!
  const target = held.get(to)!
  const tombstone = target.observations.find((one) => one.id === from.id)
  const number = tombstone ? tombstone.number : nextObservationNumber(target.observations)
  const arrived: Observation = {
    ...record,
    number,
    history: [
      ...record.history.map((event) => said(event, from.scope, to)),
      { date, kind: 'movedIn', id: from.id, scope: from.scope, number: record.number },
    ],
  }
  const lists = new Lists(held)
  lists.observations(from.scope, (list) => list.map((one) => (one.id === from.id
    ? { ...one, history: [...one.history, { date, kind: 'moved' as const, id: from.id, scope: to, number }] }
    : one)))
  lists.observations(to, (list) => (tombstone
    ? list.map((one) => (one.id === from.id ? arrived : one))
    : [...list, arrived]))
  readdress(lists, held, record, from, to)
  const about = { kind: 'observation' as const, id: from.id }
  const comments = threadSize(held.get(from.scope)!.comments ?? [], about)
  const leaving = lists.comments(from.scope)
  const arriving = lists.comments(to)
  if (comments > 0 && leaving && arriving) {
    const carried = carryThread({ scope: from.scope, comments: leaving }, { scope: to, comments: arriving }, about, about)
    lists.setComments(from.scope, carried.from)
    lists.setComments(to, carried.to)
  }
  lists.carryCitations(about, from.scope, to)
  return {
    ok: true,
    number,
    revived: tombstone !== undefined,
    cut,
    restored: tombstone ? linksTo(held, { scope: to, id: from.id }) : [],
    comments,
    observation: arrived,
    writes: lists.writes(from.scope, to),
  }
}

/** A cause, for a screen or an answer that names one; nothing where it is not read. */
export function causeAt(scopes: readonly ScopeAnalysis[], at: RecordAt): Cause | undefined {
  return scopes.find((one) => one.scope === at.scope)?.causes.find((one) => one.id === at.id)
}
