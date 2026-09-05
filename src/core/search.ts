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
 * every word must occur. Pure, and the model rather than the session, so the
 * dialog is a rendering of this and nothing else.
 */
import { fold, matchesQuery, queryTokens } from '@lionsville/solution-design'
import type { ElementKind } from '@lionsville/solution-design'
import type { Adr, AdrStatus } from './adr'
import type { HostModel } from './model/fromInterchange'

export type AdrScope = 'group' | 'landscape' | 'application'

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
  if (queryTokens(query).length === 0) return []
  const folded = fold(query.trim())
  const startsWith = (name: string) => (fold(name).startsWith(folded) ? 0 : 1)

  const elements: SearchHit[] = model.elements
    .filter((e) => matchesQuery(query, [e.name, e.category, e.vendor, e.technology]))
    .sort((a, b) => startsWith(a.name) - startsWith(b.name) || a.name.localeCompare(b.name))
    .slice(0, limitPerKind)
    .map((e) => ({
      kind: 'element',
      elementId: e.id,
      name: e.name,
      elementKind: e.kind,
      detail: [e.category, e.vendor, e.technology].filter(Boolean).join(' · ') || undefined,
    }))

  const documentation: SearchHit[] = model.elements
    .filter((e) => e.description && matchesQuery(query, [e.description]))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limitPerKind)
    .map((e) => ({
      kind: 'documentation',
      elementId: e.id,
      name: e.name,
      snippet: snippet(e.description ?? '', query),
    }))

  const nameOf = new Map(model.elements.map((e) => [e.id, e.name]))
  const adrHit = (adr: Adr, scope: AdrScope): SearchHit => ({
    kind: 'adr',
    adrId: adr.id,
    scope,
    applicationId: adr.applicationId,
    applicationName: adr.applicationId ? nameOf.get(adr.applicationId) : undefined,
    number: adr.number,
    title: adr.title,
    status: adr.status,
    snippet: matchesQuery(query, [adr.title]) ? '' : snippet(adr.body, query),
  })
  const matchesAdr = (adr: Adr) =>
    matchesQuery(query, [adr.title, adr.body, ...adr.signers.map((s) => s.name)])
  const decisions: SearchHit[] = [
    ...groupDecisions.filter(matchesAdr).map((adr) => adrHit(adr, 'group')),
    ...(model.decisions ?? [])
      .filter(matchesAdr)
      .map((adr) => adrHit(adr, adr.applicationId ? 'application' : 'landscape')),
  ].slice(0, limitPerKind)

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
