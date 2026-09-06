/**
 * Everything a query is matched against, folded once.
 *
 * Both searches used to fold their haystack inside the loop: `matchesQuery`
 * lowercases and strips accents from an element's fields — and, for ⌘K, from
 * its whole description and every decision body — once per element, per
 * keystroke. On a landscape with real documentation on it that is several
 * megabytes of string work between one character and the next, and it grows
 * with the project while the typing does not.
 *
 * So the folding moves here and happens once. What is left in the search
 * proper is a token test against a string that is already folded.
 *
 * **The rule of "found" does not change.** `matchesQuery` is still the
 * definition — fold case and diacritics, every whitespace-separated token must
 * occur somewhere in the joined fields — and it is still the only one. This
 * file computes the same haystack ahead of time and {@link matchesTokens} runs
 * the same test over it; `searchIndex.test.ts` pins the two against each other
 * on the cases that could drift.
 *
 * **Built once per model, and mostly reused across models.** The index itself
 * is cached on the model's identity, so a run of keystrokes in the search field
 * builds nothing. When the model IS replaced — the reducer hands back a new one
 * for every command — the per-row folds come back out of a `WeakMap` keyed on
 * the element and the decision themselves, and a command touches the path it
 * names (ADR-0002), so renaming one element re-folds one element. Nothing here
 * needs a size limit or an eviction rule: what the model has dropped, the
 * collector takes.
 *
 * **Order is part of the index**, for the early exit. Elements are sorted by
 * name once, so a search that wants the first eight matching rows in name order
 * can stop when it has them instead of matching two thousand and sorting the
 * result.
 */
import type { Adr } from '../decisions/adr'
import type { DesignDiagram, DesignElement, ElementId } from '../model/types'
import { fold } from '../model'

export type AdrScope = 'group' | 'landscape' | 'application'

/** One element, with its haystacks already folded. */
export type ElementEntry = {
  element: DesignElement
  /** Name, category, vendor and technology, joined and folded. */
  fields: string
  /** The name on its own, folded — the starts-with tier reads this. */
  name: string
  /** The description folded, or `''` when the element has none. */
  description: string
}

/** One decision record, with its haystacks already folded. */
export type AdrEntry = {
  adr: Adr
  scope: AdrScope
  /** Title, body and signer names, joined and folded. */
  fields: string
  /** The title on its own, folded — a title match shows no snippet. */
  title: string
}

/** Where an element is drawn, for the finder's ranking. */
export type ElementPlaces = {
  /** Element ids per diagram id. */
  carries: ReadonlyMap<string, ReadonlySet<ElementId>>
  /** The first diagram carrying each element, in the model's diagram order. */
  first: ReadonlyMap<ElementId, DesignDiagram>
}

export type SearchIndex = {
  /** In name order; see the note about the early exit at the top. */
  elements: readonly ElementEntry[]
  /** The project's own decisions, landscape and application, in model order. */
  decisions: readonly AdrEntry[]
  names: ReadonlyMap<ElementId, string>
  places: ElementPlaces
}

/** True when every token occurs in an already-folded haystack. */
export function matchesTokens(tokens: readonly string[], folded: string): boolean {
  for (const token of tokens) if (!folded.includes(token)) return false
  return true
}

/** What {@link bestMatches}'s ranker answers for a row that does not match. */
export const NO_MATCH = -1

/**
 * The best `limit` rows out of a list that is ALREADY in the tie-break order,
 * ranked into `tiers` bands.
 *
 * The scan stops as soon as the top band is full, which is the early exit that
 * makes a search over a few thousand documented elements cost about what one
 * over thirty costs: for a query that a handful of names begin with — which is
 * most of what anybody types — the loop never reaches the rest of the
 * landscape. It can only stop on the TOP band, and not on a lower one, because
 * a row further down the list may still rank above one already taken.
 */
export function bestMatches<T>(
  rows: readonly T[], limit: number, tiers: number, rank: (row: T) => number,
): T[] {
  const bands: T[][] = Array.from({ length: tiers }, () => [])
  for (const row of rows) {
    const band = rank(row)
    if (band === NO_MATCH) continue
    bands[band].push(row)
    if (bands[0].length >= limit) break
  }
  return bands.flat().slice(0, limit)
}

/**
 * What an index can be built from. Structural rather than `HostModel`, because
 * the element finder is handed the plain `DesignModel` and has no business
 * asking for more of a project than it reads.
 */
export type IndexableModel = {
  elements: readonly DesignElement[]
  diagrams: readonly DesignDiagram[]
  decisions?: readonly Adr[]
}

/** The index for a model, built on first use and kept for as long as the model is. */
export function searchIndex(model: IndexableModel): SearchIndex {
  const held = indexes.get(model)
  if (held) return held
  const built = build(model)
  indexes.set(model, built)
  return built
}

/**
 * The group's records, indexed. Separate because they arrive separately — they
 * belong to the group profile and not to the project — and because the list
 * usually outlives several models.
 */
export function groupDecisionIndex(decisions: readonly Adr[]): readonly AdrEntry[] {
  const held = groupIndexes.get(decisions)
  if (held) return held
  const built = decisions.map((adr) => adrEntry(adr, 'group'))
  groupIndexes.set(decisions, built)
  return built
}

const indexes = new WeakMap<IndexableModel, SearchIndex>()
const groupIndexes = new WeakMap<readonly Adr[], readonly AdrEntry[]>()
const elementEntries = new WeakMap<DesignElement, ElementEntry>()
const adrEntries = new WeakMap<Adr, AdrEntry>()

/**
 * One collator rather than `localeCompare` per comparison: sorting a few
 * thousand names with the method form is most of what building an index costs,
 * and the two order identically.
 */
const byName = new Intl.Collator(undefined, { sensitivity: 'variant' })

function build(model: IndexableModel): SearchIndex {
  const elements = model.elements.map(elementEntry)
  elements.sort((a, b) => byName.compare(a.element.name, b.element.name))

  const carries = new Map<string, ReadonlySet<ElementId>>()
  const first = new Map<ElementId, DesignDiagram>()
  for (const diagram of model.diagrams) {
    const on = new Set<ElementId>()
    for (const placement of diagram.placements) {
      on.add(placement.elementId)
      if (!first.has(placement.elementId)) first.set(placement.elementId, diagram)
    }
    carries.set(diagram.id, on)
  }

  return {
    elements,
    decisions: (model.decisions ?? []).map((adr) =>
      adrEntry(adr, adr.applicationId ? 'application' : 'landscape')),
    names: new Map(model.elements.map((e) => [e.id, e.name])),
    places: { carries, first },
  }
}

function elementEntry(element: DesignElement): ElementEntry {
  const held = elementEntries.get(element)
  if (held) return held
  const entry: ElementEntry = {
    element,
    fields: fold([element.name, element.category, element.vendor, element.technology]
      .filter(Boolean).join(' ')),
    name: fold(element.name),
    description: element.description ? fold(element.description) : '',
  }
  elementEntries.set(element, entry)
  return entry
}

/**
 * A record's scope is not a property of the record — the same shape appears in
 * a group's list and in a project's — so a cached entry is only reused for the
 * scope it was built under.
 */
function adrEntry(adr: Adr, scope: AdrScope): AdrEntry {
  const held = adrEntries.get(adr)
  if (held && held.scope === scope) return held
  const entry: AdrEntry = {
    adr,
    scope,
    fields: fold([adr.title, adr.body, ...adr.signers.map((s) => s.name)].filter(Boolean).join(' ')),
    title: fold(adr.title),
  }
  adrEntries.set(adr, entry)
  return entry
}
