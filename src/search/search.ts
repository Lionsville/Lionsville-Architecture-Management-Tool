// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One search over everything the organisation holds, read from the scope a
 * person is in outwards: every record of this scope, the records the scopes
 * above hold, and whatever the tree's own read carries of the rest.
 *
 * **Which kinds, it does not say.** Each list of the model declares what its
 * records say to a search (`model/searchable.ts`, ADR-0029), and this file
 * orders, limits and names the hits — so an element, its page, a view, a
 * relation, a decision record, a plan and its milestones, an observation, a
 * cause, a solution and an experiment are all found, and whatever the model
 * holds next is found as soon as its line is written.
 *
 * **A hit says what it is, where it lives and what it opens.** The kind is
 * the heading; the scope is the path of the scope that holds the record, so a
 * hit from another scope opens there (ADR-0012 §7: a record is edited where it
 * lives); the place is the page and the record on it. An element and its page
 * are two hits because they answer two questions: the name matched, or the
 * prose did.
 *
 * Matching is the editor's own rule (`matchesQuery`): fold case and accents,
 * every word must occur. The folding is done once per record rather than once
 * per keystroke — see `recordIndex.ts` — and what is left here is the order,
 * the limits and what a hit is called. Still pure, and still the model rather
 * than the session, so the dialog and the agent are renderings of this.
 */
import { fold, queryTokens } from '../model'
import { SEARCH_KINDS } from '../model/searchable'
import type { SearchableModel, SearchKind, SearchPlace } from '../model/searchable'
import type { Adr } from '../model/adr'
import { matchesTokens } from './searchIndex'
import { recordIndex } from './recordIndex'
import type { RecordEntry, RecordIndex } from './recordIndex'

export type SearchHit = {
  readonly kind: SearchKind
  /** The record's id; unique within its kind and its scope. */
  readonly id: string
  /**
   * The path of the scope that holds it, `""` being the organisation.
   * Absent only where the caller could not say which scope above — the
   * agent is handed the ancestors' records as one list.
   */
  readonly scope?: string
  readonly title: string
  /** `OB-0007`, where the kind numbers its records. */
  readonly label?: string
  /** The status word, untranslated. */
  readonly status?: string
  /** The element's kind, the view's kind, the relation's type. */
  readonly variant?: string
  readonly detail?: string
  /** The names of the elements it is about: a decision's subject, a relation's two ends. */
  readonly about: readonly string[]
  /** The stretch of prose around the match; `''` where the title said enough. */
  readonly snippet: string
  readonly opens: SearchPlace
}

/** One scope's lists, as whoever is searching has them. */
export type SearchSource = {
  /** Its path; see {@link SearchHit.scope}. */
  readonly scope?: string
  readonly model: SearchableModel
  /**
   * Whether a hit of this kind and id is this scope's to show. A scope
   * elsewhere in the tree draws stand-ins of what another defines, and the
   * element is found where it is answered for; absent keeps everything.
   */
  readonly keep?: (kind: SearchKind, id: string) => boolean
}

/** How many of each kind the dialog shows — a list to pick from, not a report. */
export const SEARCH_LIMIT_PER_KIND = 8

export type SearchInput = {
  /** Nearest first: the open scope, then the scopes above, then the rest. Earlier sources rank first within a band. */
  readonly sources: readonly SearchSource[]
  readonly query: string
  readonly limitPerKind?: number
  /** Only these kinds; absent is every kind. */
  readonly kinds?: readonly SearchKind[]
}

/**
 * Element ids are unique across the whole tree (ADR-0012 §2), so an element
 * met again in a later source — a stand-in, a declaration above its master —
 * is the same thing, and is shown once, from the nearest scope.
 */
const TREE_WIDE: ReadonlySet<SearchKind> = new Set(['element', 'documentation'])

export function searchAll({ sources, query, limitPerKind = SEARCH_LIMIT_PER_KIND, kinds }: SearchInput): SearchHit[] {
  const tokens = queryTokens(query)
  if (tokens.length === 0) return []
  const folded = fold(query.trim())
  const indexed = sources.map((source) => ({ source, index: recordIndex(source.model) }))
  const hits: SearchHit[] = []
  for (const kind of SEARCH_KINDS) {
    if (kinds && !kinds.includes(kind)) continue
    hits.push(...bestOfKind(kind, indexed, tokens, folded, limitPerKind).map(({ entry, source, index }) =>
      hitOf(entry, source, index, tokens, query)))
  }
  return hits
}

type Found = { entry: RecordEntry; source: SearchSource; index: RecordIndex }

/**
 * The best `limit` rows of one kind across every source, in two bands: a
 * title that starts with the query, then any other match. Within a band the
 * sources' own order holds, and within a source its declaration's.
 *
 * The scan stops as soon as the top band is full, which is the early exit
 * that makes a search over a few thousand documented elements cost about what
 * one over thirty costs; it can only stop on the top band, because a row
 * further on may still rank above one already taken. An element's page has
 * one band: it is the prose that matched, and a name that starts with the
 * query says nothing about that.
 */
function bestOfKind(
  kind: SearchKind, indexed: readonly { source: SearchSource; index: RecordIndex }[],
  tokens: readonly string[], folded: string, limit: number,
): Found[] {
  const top: Found[] = []
  const rest: Found[] = []
  const seen = TREE_WIDE.has(kind) ? new Set<string>() : undefined
  scan: for (const { source, index } of indexed) {
    for (const entry of index.byKind.get(kind) ?? []) {
      if (!matchesTokens(tokens, entry.haystack)) continue
      const id = entry.record.id
      if (source.keep && !source.keep(kind, id)) continue
      if (seen) {
        if (seen.has(id)) continue
        seen.add(id)
      }
      const found = { entry, source, index }
      if (entry.proseOnly || entry.title.startsWith(folded)) top.push(found)
      else rest.push(found)
      if (top.length >= limit) break scan
    }
  }
  return [...top, ...rest].slice(0, limit)
}

function hitOf(entry: RecordEntry, source: SearchSource, index: RecordIndex, tokens: readonly string[], query: string): SearchHit {
  const { record } = entry
  const quote = record.prose !== undefined && record.prose !== '' && (entry.proseOnly || !matchesTokens(tokens, entry.title))
  return {
    kind: entry.kind,
    id: record.id,
    ...(source.scope !== undefined ? { scope: source.scope } : {}),
    title: record.title,
    ...(record.label !== undefined ? { label: record.label } : {}),
    ...(record.status !== undefined ? { status: record.status } : {}),
    ...(record.variant !== undefined ? { variant: record.variant } : {}),
    ...(record.detail !== undefined ? { detail: record.detail } : {}),
    about: (record.about ?? []).map((id) => index.names.get(id) ?? id),
    snippet: quote ? snippet(record.prose as string, query) : '',
    opens: record.opens,
  }
}

/**
 * The sources for one scope as a caller with no tree has them: its own lists,
 * and the records of the scopes above it as one list. What the agent and a
 * test hand over; the workspace, which has the tree, builds its own.
 */
export function scopeSources(at: {
  model: SearchableModel
  scope?: string
  ancestorDecisions?: readonly Adr[]
}): SearchSource[] {
  const here: SearchSource = { model: at.model, ...(at.scope !== undefined ? { scope: at.scope } : {}) }
  const above = at.ancestorDecisions ?? []
  return above.length > 0 ? [here, { model: aboveModel(above) }] : [here]
}

/**
 * The sources for a scope in its tree, nearest first (ADR-0012 §2, §7): this
 * scope's every list; each scope above with its records and whatever the
 * tree's read carried of it; then every other scope the read carried.
 *
 * The tree's read is the thin one the index is built from — records, rows,
 * plans and observations, one file per list — so a scope elsewhere is found
 * by those, and its decisions, causes, solutions and experiments are found
 * in it once it is open. An element another scope draws is found where it is
 * answered for (`masterOf`), once, and not at every scope that draws it.
 */
export function treeSources(at: {
  scope: string
  model: SearchableModel
  /** The scopes above, nearest first, with their records. */
  above: readonly { path: string; decisions: readonly Adr[] }[]
  /** Every scope as the tree's last read had it; the open one is read from `model` instead. */
  tree?: readonly { path: string; model: SearchableModel }[]
  /** The scope that answers for an element id, where the tree knows one. */
  masterOf?: (id: string) => string | undefined
}): SearchSource[] {
  const read = new Map((at.tree ?? []).map((one) => [one.path, one.model]))
  const answeredHere = (path: string) => (kind: SearchKind, id: string) =>
    !TREE_WIDE.has(kind) || at.masterOf?.(id) === path
  const sources: SearchSource[] = [{ scope: at.scope, model: at.model }]
  const done = new Set([at.scope])
  for (const { path, decisions } of at.above) {
    done.add(path)
    sources.push({ scope: path, model: withDecisions(read.get(path) ?? {}, decisions), keep: answeredHere(path) })
  }
  for (const [path, model] of read) {
    if (done.has(path)) continue
    sources.push({ scope: path, model, keep: answeredHere(path) })
  }
  return sources
}

/** A scope's thin read with its records beside it, made once per pair so its index is kept. */
function withDecisions(model: SearchableModel, decisions: readonly Adr[]): SearchableModel {
  const held = merged.get(model)
  if (held && held.decisions === decisions) return held.model
  const made: SearchableModel = { ...model, decisions }
  merged.set(model, { decisions, model: made })
  return made
}
const merged = new WeakMap<SearchableModel, { decisions: readonly Adr[]; model: SearchableModel }>()

/** One list object per list of records, so the index built over it is kept as long as the list is. */
function aboveModel(decisions: readonly Adr[]): SearchableModel {
  const held = aboveModels.get(decisions)
  if (held) return held
  const made: SearchableModel = { decisions }
  aboveModels.set(decisions, made)
  return made
}
const aboveModels = new WeakMap<readonly Adr[], SearchableModel>()

/**
 * The stretch of `text` around the first word of the query that occurs in it,
 * with markdown reduced to words, so a reader can tell WHY this row matched.
 * When no single token is found — the match came from another field — the
 * opening of the text is shown instead.
 */
export function snippet(text: string, query: string, radius = 70): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/[*_`>|]/g, '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  const haystack = fold(plain)
  let at = -1
  for (const token of queryTokens(query)) {
    at = haystack.indexOf(token)
    if (at >= 0) break
  }
  if (at < 0) return plain.length > radius * 2 ? `${plain.slice(0, radius * 2).trimEnd()}…` : plain
  // Folding strips accents without changing length, so an index into the folded
  // text is an index into the original.
  const start = Math.max(0, at - radius)
  const end = Math.min(plain.length, at + radius)
  return `${start > 0 ? '…' : ''}${plain.slice(start, end).trim()}${end < plain.length ? '…' : ''}`
}
