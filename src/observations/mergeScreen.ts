// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the merge screen reads off the tree before anybody presses Merge
 * (ADR-0035 §1, §2): the records it offers, nearest scope first; where a
 * record already merged went; why Merge cannot be pressed; and, after it was,
 * where the merge went, in words.
 *
 * Pure, over the analyses of the scopes the person can read. What a merge
 * writes is `planMerge`'s (`merge.ts`); this file only reads.
 */
import type { StringKey, Translate } from '../i18n/strings'
import { matchesQuery } from '../model/textSearch'
import type { Cause, Observation, ScopeAnalysis } from '../model/observation'
import { absorbedKeys, pictureKey } from './graph'
import { absorbedBy, causeAbsorbedBy, causeLabel, formatObservationNumber, isArchived, isCauseMerged, isMerged, mergedInto } from './observation'
import { formatSolutionNumber } from './solution'
import type { MergeKind, MergeLinkRefusal, MergePlan, MergeRefusal, RecordAt } from './merge'

const segments = (path: string) => (path === '' ? [] : path.split('/'))

/** How many steps through the tree lie between two scopes: up to where they meet, and down again. */
export function scopeDistance(from: string, to: string): number {
  const a = segments(from)
  const b = segments(to)
  let common = 0
  while (common < a.length && common < b.length && a[common] === b[common]) common += 1
  return a.length - common + (b.length - common)
}

/** The scopes nearest `here` first: itself, then one step away, and so on; a tie in path order. */
export function nearestFirst(paths: readonly string[], here: string): string[] {
  return [...paths].sort((a, b) => scopeDistance(here, a) - scopeDistance(here, b) || a.localeCompare(b))
}

/**
 * A record anywhere in the tree as a person reads it — an observation, a
 * cause or a solution: its label and title, and its scope after it where that
 * is not `here`.
 */
export function recordName(scopes: readonly ScopeAnalysis[], here: string, scopeLabel: (path: string) => string, at: RecordAt): string {
  const scope = scopes.find((one) => one.scope === at.scope)
  const observation = scope?.observations.find((one) => one.id === at.id)
  const cause = scope?.causes.find((one) => one.id === at.id)
  const solution = scope?.solutions.find((one) => one.id === at.id)
  const named = observation ? `${formatObservationNumber(observation.number)} ${observation.title}`
    : cause ? `${causeLabel(cause)} ${cause.title}`
      : solution ? `${formatSolutionNumber(solution.number)} ${solution.title}` : at.id
  return at.scope === here ? named : `${named} (${scopeLabel(at.scope)})`
}

/** One record the search offers: where it lives, and how people say it. */
export type MergeHit = { at: RecordAt; label: string; title: string }

/** A record of the kind asked, at a place in the tree. */
export function recordAt(scopes: readonly ScopeAnalysis[], kind: 'observation', at: RecordAt): Observation | undefined
export function recordAt(scopes: readonly ScopeAnalysis[], kind: 'cause', at: RecordAt): Cause | undefined
export function recordAt(scopes: readonly ScopeAnalysis[], kind: MergeKind, at: RecordAt): Observation | Cause | undefined
export function recordAt(scopes: readonly ScopeAnalysis[], kind: MergeKind, at: RecordAt): Observation | Cause | undefined {
  const scope = scopes.find((one) => one.scope === at.scope)
  const list: readonly (Observation | Cause)[] = kind === 'cause' ? scope?.causes ?? [] : scope?.observations ?? []
  return list.find((one) => one.id === at.id)
}

/** `OB-0007`, `CA-0003`, `RC-0003`: what people call a record. */
export function recordLabel(kind: MergeKind, record: Observation | Cause): string {
  return kind === 'cause' ? causeLabel(record as Cause) : formatObservationNumber(record.number)
}

/**
 * The records a merge may take in (ADR-0035 §1): live observations — not
 * merged, not archived — or causes that are not merged, of this scope, or
 * with `across` of every scope given, nearest first and newest first within
 * a scope; matched on the label and the title (and where, for an
 * observation) by every word of `query`. A record a survivor anywhere says it
 * absorbed is history, and is not offered.
 */
export function mergeCandidates(o: {
  kind: MergeKind
  scopes: readonly ScopeAnalysis[]
  here: string
  across: boolean
  query: string
}): MergeHit[] {
  const gone = absorbedKeys(o.scopes, o.here)
  const pool = o.across ? o.scopes : o.scopes.filter((one) => one.scope === o.here)
  const order = nearestFirst(pool.map((one) => one.scope), o.here)
  return [...pool].sort((a, b) => order.indexOf(a.scope) - order.indexOf(b.scope)).flatMap((scope) => {
    const standing: (Observation | Cause)[] = o.kind === 'cause'
      ? scope.causes.filter((one) => !isCauseMerged(scope.causes, one.id))
      : scope.observations.filter((one) => !isMerged(scope.observations, one.id) && !isArchived(one))
    return standing
      .filter((one) => !gone.has(pictureKey(o.here, scope.scope, one.id)))
      .map((one) => ({ one, label: recordLabel(o.kind, one) }))
      .filter(({ one, label }) => matchesQuery(o.query, [label, one.title, (one as Observation).where]))
      .sort((a, b) => b.one.number - a.one.number)
      .map(({ one, label }) => ({ at: { scope: scope.scope, id: one.id }, label, title: one.title }))
  })
}

/**
 * Where a record went when it was merged, and on which day: where its own
 * history says (a merge across the tree writes that), or the survivor of its
 * own scope that says it absorbed it. Nothing for a record standing.
 */
export function mergedTo(scope: ScopeAnalysis, kind: MergeKind, id: string): (RecordAt & { date?: string }) | undefined {
  const list: readonly (Observation | Cause)[] = kind === 'cause' ? scope.causes : scope.observations
  const said = mergedInto(list.find((one) => one.id === id)?.history)
  if (said) return { scope: said.scope ?? scope.scope, id: said.id, date: said.date }
  const by = kind === 'cause' ? causeAbsorbedBy(scope.causes, id) : absorbedBy(scope.observations, id)
  if (!by) return undefined
  const event = (by.history ?? []).find((one) => one.kind === 'absorbed' && one.id === id && one.scope === undefined)
  return { scope: scope.scope, id: by.id, ...(event ? { date: event.date } : {}) }
}

/** Why a link cannot move, in words: the link form's refusals, and the three a merge meets. */
export const MERGE_LINK_REFUSAL: Record<MergeLinkRefusal, StringKey> = {
  self: 'observation.mergeLinkSelf',
  loop: 'observation.mergeLinkLoop',
  root: 'observation.mergeLinkRoot',
  upward: 'observation.mergeLinkUpward',
  sideways: 'observation.mergeLinkSideways',
  observationBelow: 'observation.mergeLinkObservationBelow',
  merged: 'observation.mergeLinkMerged',
  unknown: 'observation.mergeLinkUnknown',
  observationElsewhere: 'observation.mergeLinkObservationElsewhere',
  solutionElsewhere: 'observation.mergeLinkSolutionElsewhere',
  notRoot: 'observation.mergeLinkNotRoot',
}

/** Why the merge as a whole cannot be made; the two root steps say it in their own words (ADR-0032 §3). */
export const MERGE_REFUSAL: Record<MergeRefusal, StringKey> = {
  nothing: 'observation.mergeNothing',
  missing: 'observation.mergeMissing',
  merged: 'observation.mergeAlreadyMerged',
  archived: 'observation.mergeArchived',
  survivorAbsorbed: 'observation.mergeSurvivorAbsorbed',
  notADay: 'observation.mergeNotADay',
  unverified: 'observation.mergeUnverified',
  'command.rootExplained': 'command.rootExplained',
  'command.rootAddressed': 'command.rootAddressed',
}

/** The scopes a planned merge writes, the survivor's first; none while it is refused. */
export function writtenScopes(plan: MergePlan): string[] {
  return plan.ok ? plan.writes.map((one) => one.scope) : []
}

/**
 * Why Merge cannot be pressed, in words, or nothing where it can: nothing may
 * be written from here; the plan refuses; a scope it touches may be read and
 * not changed (ADR-0035 §2 — a courtesy, the storage refuses it anyway); or it
 * writes another scope where only this one may be written from here.
 */
export function mergeBlocked(o: {
  plan: MergePlan
  /** The survivor and every record taken in. */
  records: readonly RecordAt[]
  here: string
  readOnly: boolean
  /** Another scope may be written from here. */
  across: boolean
  writable: (path: string) => boolean
  scopeLabel: (path: string) => string
  t: Translate
}): string | undefined {
  const { plan, t } = o
  if (o.readOnly) return t('observation.mergeReadOnly')
  if (!plan.ok) return t(MERGE_REFUSAL[plan.refusal])
  const touched = [...new Set([...o.records.map((one) => one.scope), ...writtenScopes(plan)])]
  const closed = touched.find((path) => !o.writable(path))
  if (closed !== undefined) return t('observation.mergeNotYours', { scope: o.scopeLabel(closed) })
  if (!o.across && writtenScopes(plan).some((path) => path !== o.here)) return t('observation.mergeNotFromHere')
  return undefined
}

/** What Merge says it will make: *Merge 2 observations into OB-0002*. */
export function confirmLabel(kind: MergeKind, absorbed: number, survivor: string, t: Translate): string {
  const key: StringKey = kind === 'cause'
    ? absorbed === 1 ? 'observation.mergeCauseOne' : 'observation.mergeCauseMany'
    : absorbed === 1 ? 'observation.mergeObservationOne' : 'observation.mergeObservationMany'
  return t(key, { count: String(absorbed), label: survivor })
}

/** What a merge across scopes answered (`ChangedAcross`), in the shape the note reads. */
export type AcrossOutcome =
  | { ok: true; changed: readonly string[]; unsaved?: true }
  | { ok: false; reason: 'refused'; refused: string }
  | { ok: false; reason: 'shell.scopeReadOnly'; scope?: string }
  | { ok: false; reason: 'partial'; changed: readonly string[] }
  | { ok: false; reason: string }

/** The scopes as a sentence names them: *Claims, Intake and Acme*. */
function listed(paths: readonly string[], scopeLabel: (path: string) => string, t: Translate): string {
  const names = paths.map(scopeLabel)
  if (names.length <= 1) return names.join('')
  return t('observation.mergeList', { names: names.slice(0, -1).join(', '), last: names.at(-1)! })
}

/** Where a merge across scopes went, said after it (ADR-0035 §5): which scopes it changed, or why nothing was merged. */
export function acrossNote(result: AcrossOutcome, scopeLabel: (path: string) => string, t: Translate): string {
  if (result.ok) {
    const said = t('observation.mergedAcross', { scopes: listed(result.changed, scopeLabel, t) })
    return result.unsaved ? `${said} ${t('observation.mergedUnsaved')}` : said
  }
  if (result.reason === 'partial' && 'changed' in result) {
    return t('observation.mergedPartial', { scopes: listed(result.changed, scopeLabel, t) })
  }
  if (result.reason === 'refused' && 'refused' in result) {
    const key = MERGE_REFUSAL[result.refused as MergeRefusal] as StringKey | undefined
    return t('observation.mergeNotMadeWhy', { why: key ? t(key) : result.refused })
  }
  if (result.reason === 'shell.scopeReadOnly') {
    const scope = 'scope' in result ? result.scope : undefined
    return scope !== undefined ? t('observation.mergeNotMadeYours', { scope: scopeLabel(scope) }) : t('observation.mergeNotMade')
  }
  if (result.reason === 'shell.scopeMoved') return t('observation.mergeNotMadeMoved')
  if (result.reason.startsWith('command.')) return t('observation.mergeNotMadeWhy', { why: t(result.reason as StringKey) })
  return t('observation.mergeNotMade')
}
