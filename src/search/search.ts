/**
 * One search over everything a project knows: its elements, what is written
 * about them, and the decisions taken around them — the group's included.
 *
 * Three kinds of hit, because they open three different things. An element hit
 * takes you to the box on the canvas; a documentation hit opens that element's
 * page, because what matched was the prose and not the name; a decision hit
 * opens the record. The same element can appear twice — once because its name
 * matched, once because its page did — and that is right: they answer
 * different questions.
 *
 * Matching is the editor's own rule (`matchesQuery`): fold case and accents,
 * every word must occur. The folding is done once per model rather than once
 * per element per keystroke — see `searchIndex.ts` — and what is left here is
 * the ordering, the limits and what a hit is called. Still pure, and still the
 * model rather than the session, so the dialog is a rendering of this and
 * nothing else.
 */
import { fold, queryTokens } from '../model'
import type { ElementKind } from '../model'
import type { Adr, AdrStatus } from '../decisions/adr'
import type { HostModel } from '../model/fromInterchange'
import { bestMatches, groupDecisionIndex, matchesTokens, NO_MATCH, searchIndex } from './searchIndex'
import type { AdrEntry, AdrScope } from './searchIndex'

export type { AdrScope }

export type SearchHit =
  | {
    kind: 'element'
    elementId: string
    name: string
    elementKind: ElementKind
    /** Category, vendor and technology, whichever are set. */
    detail?: string
  }
  | {
    kind: 'documentation'
    elementId: string
    name: string
    /** The stretch of the page around the first match. */
    snippet: string
  }
  | {
    kind: 'adr'
    adrId: string
    scope: AdrScope
    /** Which application's record, when the scope is one. */
    applicationId?: string
    applicationName?: string
    number: number
    title: string
    status: AdrStatus
    snippet: string
  }

/** How many of each kind the dialog shows — a list to pick from, not a report. */
export const SEARCH_LIMIT_PER_KIND = 8

export type SearchInput = {
  model: HostModel
  groupDecisions: readonly Adr[]
  query: string
  limitPerKind?: number
}

export function searchAll({ model, groupDecisions, query, limitPerKind = SEARCH_LIMIT_PER_KIND }: SearchInput): SearchHit[] {
  const tokens = queryTokens(query)
  if (tokens.length === 0) return []
  const index = searchIndex(model)
  const folded = fold(query.trim())

  // Name order is the index's own order, so both of these are already sorted by
  // the time the tiers are flattened.
  const elements: SearchHit[] = bestMatches(index.elements, limitPerKind, 2, (entry) => {
    if (!matchesTokens(tokens, entry.fields)) return NO_MATCH
    return entry.name.startsWith(folded) ? 0 : 1
  }).map(({ element }) => ({
    kind: 'element',
    elementId: element.id,
    name: element.name,
    elementKind: element.kind,
    detail: [element.category, element.vendor, element.technology].filter(Boolean).join(' · ') || undefined,
  }))

  const documentation: SearchHit[] = bestMatches(index.elements, limitPerKind, 1, (entry) =>
    (entry.description !== '' && matchesTokens(tokens, entry.description) ? 0 : NO_MATCH),
  ).map(({ element }) => ({
    kind: 'documentation',
    elementId: element.id,
    name: element.name,
    snippet: snippet(element.description ?? '', query),
  }))

  // The group's records first, then the project's, and the limit applies to the
  // two together: a group with nine matching decisions must not push the
  // landscape's own out of the list, and it does not, because eight is all
  // anybody reads before narrowing the query.
  const hit = (entry: AdrEntry): SearchHit => ({
    kind: 'adr',
    adrId: entry.adr.id,
    scope: entry.scope,
    applicationId: entry.adr.applicationId,
    applicationName: entry.adr.applicationId ? index.names.get(entry.adr.applicationId) : undefined,
    number: entry.adr.number,
    title: entry.adr.title,
    status: entry.adr.status,
    snippet: matchesTokens(tokens, entry.title) ? '' : snippet(entry.adr.body, query),
  })
  const decisions: SearchHit[] = []
  for (const list of [groupDecisionIndex(groupDecisions), index.decisions]) {
    for (const entry of list) {
      if (decisions.length >= limitPerKind) break
      if (matchesTokens(tokens, entry.fields)) decisions.push(hit(entry))
    }
  }

  return [...elements, ...documentation, ...decisions]
}

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
