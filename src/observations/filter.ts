// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the filters leave of the analysis (ADR-0032 §8): one model for the
 * Register, the Analysis picture and the Solutions tab.
 *
 * Every record of the scopes in view is one row here — an observation, a
 * cause, a root cause, a solution, an experiment — under the key the picture
 * draws it by (`graph.ts`'s `pictureKey`), with the links between them running
 * from the record on the left to the one behind it. Five filters:
 *
 * - **Scopes**, a set of paths switched off: their records are out before
 *   anything else is asked.
 * - **Observations**: an observation whose text matches, and the chain behind
 *   it — its causes, the deeper causes and root causes behind those, their
 *   solutions.
 * - **Causes** and **RC**: a cause, or a root cause, whose text matches, and
 *   everything linked to it both ways — what it explains and what lies behind
 *   it.
 * - **Search**: any record whose text matches, solutions and experiments
 *   included, and everything linked to it both ways.
 *
 * A record is kept when it holds for every filter that is on, so filters
 * narrow each other. What matched is said apart from what came with it, so a
 * match can be outlined and the rest drawn plainly.
 *
 * Pure, and over plain lists. The text rule is the one every search in the
 * tool uses (`model/textSearch.ts`): every word of the query, in any order,
 * accents folded.
 */
import { matchesQuery } from '../model/textSearch'
import { absorbedKeys, experimentKey, pictureKey, solutionKey } from './graph'
import { causeLabel, formatObservationNumber, isArchived, isRootCause } from './observation'
import type { ScopeAnalysis } from './observation'
import { formatExperimentNumber, formatSolutionNumber, isLive } from './solution'

/** The filters that are on. Text left blank is a filter that is off. */
export type Filters = {
  /** The scopes whose records are hidden, by path. */
  scopesOff: readonly string[]
  observations: string
  causes: string
  /** Text in root causes: the box labelled RC. */
  roots: string
  /** Text in every record. */
  search: string
}

export const NO_FILTERS: Filters = { scopesOff: [], observations: '', causes: '', roots: '', search: '' }

export type FilterKind = 'observation' | 'cause' | 'root' | 'solution' | 'experiment'

export type FilterRecord = {
  key: string
  scope: string
  kind: FilterKind
  /** What the text filters read: the label, the title and the record's other words. */
  text: readonly (string | undefined)[]
  /**
   * Counted in *12 of 40 shown*: a live observation, a cause, a live
   * solution. A merged or archived observation, a dropped solution and an
   * experiment still match and still carry a chain; they are not what the
   * count is about.
   */
  counted: boolean
}

/** From the record on the left to the record behind it. */
export type FilterLink = { from: string; to: string }

export type FilterResult = {
  /** What is left: in a scope that is on, and holding for every text filter that is on. */
  visible: Set<string>
  /** What a text filter matched itself, rather than kept for a match. */
  matched: Set<string>
  /** Any filter on, the scopes included. */
  filtering: boolean
  /** The counted records left, and the counted records there are. */
  shown: number
  total: number
}

const TEXT = ['observations', 'causes', 'roots', 'search'] as const

/** How many filters are on, for the count on *Filters*: each text filter, and the scopes as one. */
export function activeFilters(filters: Filters, scopes: readonly string[]): number {
  const texts = TEXT.filter((field) => filters[field].trim() !== '').length
  return texts + (scopes.some((scope) => filters.scopesOff.includes(scope)) ? 1 : 0)
}

/** Everything linked to `start` in one direction, `start` included. */
function walk(start: string, next: ReadonlyMap<string, readonly string[]>): Set<string> {
  const seen = new Set([start])
  const stack = [start]
  while (stack.length) {
    for (const key of next.get(stack.pop()!) ?? []) {
      if (!seen.has(key)) {
        seen.add(key)
        stack.push(key)
      }
    }
  }
  return seen
}

/** What each filter matches, and whether it keeps what lies ahead of a match as well as what lies behind it. */
const RULES: Record<(typeof TEXT)[number], { kinds?: readonly FilterKind[]; bothWays: boolean }> = {
  observations: { kinds: ['observation'], bothWays: false },
  causes: { kinds: ['cause'], bothWays: true },
  roots: { kinds: ['root'], bothWays: true },
  search: { bothWays: true },
}

export function applyFilters(
  records: readonly FilterRecord[], links: readonly FilterLink[], filters: Filters,
): FilterResult {
  const off = new Set(filters.scopesOff)
  const pool = records.filter((record) => !off.has(record.scope))
  const inPool = new Set(pool.map((record) => record.key))
  const behind = new Map<string, string[]>()
  const ahead = new Map<string, string[]>()
  for (const { from, to } of links) {
    if (!inPool.has(from) || !inPool.has(to)) continue
    behind.set(from, [...(behind.get(from) ?? []), to])
    ahead.set(to, [...(ahead.get(to) ?? []), from])
  }
  const matched = new Set<string>()
  const kept: Set<string>[] = []
  for (const field of TEXT) {
    const query = filters[field].trim()
    if (!query) continue
    const rule = RULES[field]
    const keep = new Set<string>()
    for (const record of pool) {
      if (rule.kinds && !rule.kinds.includes(record.kind)) continue
      if (!matchesQuery(query, record.text)) continue
      matched.add(record.key)
      for (const key of walk(record.key, behind)) keep.add(key)
      if (rule.bothWays) for (const key of walk(record.key, ahead)) keep.add(key)
    }
    kept.push(keep)
  }
  const visible = new Set(pool.filter((record) => kept.every((set) => set.has(record.key))).map((record) => record.key))
  return {
    visible,
    matched,
    filtering: kept.length > 0 || pool.length < records.length,
    shown: records.filter((record) => record.counted && visible.has(record.key)).length,
    total: records.filter((record) => record.counted).length,
  }
}

/**
 * The records of the scopes in view, keyed as the picture keys them: this
 * scope's under their own keys, a scope below's under `scope#…`.
 */
export function filterRecords(scopes: readonly ScopeAnalysis[], here: string): FilterRecord[] {
  const gone = absorbedKeys(scopes, here)
  return scopes.flatMap(({ scope, observations, causes, solutions, experiments }): FilterRecord[] => [
    ...observations.map((one): FilterRecord => {
      const key = pictureKey(here, scope, one.id)
      return {
        key, scope, kind: 'observation', counted: !gone.has(key) && !isArchived(one),
        text: [formatObservationNumber(one.number), one.title, one.where, one.by, one.body],
      }
    }),
    ...causes.map((one): FilterRecord => ({
      key: pictureKey(here, scope, one.id), scope, kind: isRootCause(one) ? 'root' : 'cause', counted: true,
      text: [causeLabel(one), one.title, one.body],
    })),
    ...solutions.map((one): FilterRecord => ({
      key: pictureKey(here, scope, solutionKey(one.id)), scope, kind: 'solution', counted: isLive(one),
      text: [formatSolutionNumber(one.number), one.title, one.body],
    })),
    ...experiments.map((one): FilterRecord => ({
      key: pictureKey(here, scope, experimentKey(one.id)), scope, kind: 'experiment', counted: false,
      text: [formatExperimentNumber(one.number), one.title, one.hypothesis, one.measure, one.body],
    })),
  ])
}

// --- saved filters ------------------------------------------------------------------

/**
 * Filters kept under a name a person gave them: a person's setting, kept with
 * their other preferences (ADR-0005) and offered in every scope. Scopes are
 * named by path.
 */
export type SavedFilter = { name: string; filters: Filters }

/** Where the saved filters are kept in the preferences blob. */
export const SAVED_FILTERS_KEY = 'observationFilters'

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * The saved filters from the stored preferences, or none. Read rather than
 * trusted: a blob an older build wrote, or a hand, keeps what makes sense
 * and drops the rest.
 */
export function readSavedFilters(stored: unknown): SavedFilter[] {
  if (!stored || typeof stored !== 'object') return []
  const list = (stored as Record<string, unknown>)[SAVED_FILTERS_KEY]
  if (!Array.isArray(list)) return []
  return list.flatMap((entry): SavedFilter[] => {
    if (!entry || typeof entry !== 'object') return []
    const { name, filters } = entry as { name?: unknown; filters?: unknown }
    if (typeof name !== 'string' || !name.trim() || !filters || typeof filters !== 'object') return []
    const held = filters as Record<string, unknown>
    const scopesOff = Array.isArray(held.scopesOff) ? held.scopesOff.filter((one): one is string => typeof one === 'string') : []
    return [{
      name: name.trim(),
      filters: { scopesOff, observations: text(held.observations), causes: text(held.causes), roots: text(held.roots), search: text(held.search) },
    }]
  })
}

/** The list with `filters` saved under `name`: one of that name already there is replaced where it stands. */
export function saveFilter(list: readonly SavedFilter[], name: string, filters: Filters): SavedFilter[] {
  const trimmed = name.trim()
  if (!trimmed) return [...list]
  const saved = { name: trimmed, filters: { ...filters, scopesOff: [...filters.scopesOff] } }
  const at = list.findIndex((one) => one.name === trimmed)
  return at < 0 ? [...list, saved] : list.map((one, index) => (index === at ? saved : one))
}

/** A saved filter put back on, over the scopes in view: a scope no longer there is left out. */
export function recallFilter(saved: SavedFilter, scopes: readonly string[]): Filters {
  return { ...saved.filters, scopesOff: saved.filters.scopesOff.filter((scope) => scopes.includes(scope)) }
}
