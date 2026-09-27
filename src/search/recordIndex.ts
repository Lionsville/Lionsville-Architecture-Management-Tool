// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every record of a scope, folded once, by the kind of hit it makes.
 *
 * What is folded is what each kind declares about its records
 * (`model/searchable.ts`, ADR-0029): this file knows no kind by name, so a
 * list the model gains is searched the moment its line is written there.
 *
 * **Built once per model, and mostly reused across models** — the rule
 * `searchIndex.ts` set for the element finder, applied to every list. The
 * index is cached on the model's identity, so a run of keystrokes builds
 * nothing; when the reducer hands back a new model, each record's entries
 * come back out of a `WeakMap` keyed on the declaration and the record
 * object, and a command touches the path it names (ADR-0002) — so editing
 * one observation re-folds one observation, and what is left is the
 * per-kind arrays and the one sort by name. Nothing here needs a bound: what
 * the model has dropped, the collector takes.
 */
import { SEARCH_KINDS, SEARCHABLE } from '../model/searchable'
import type { Searchable, SearchableModel, SearchKind, SearchRecord, SearchTable } from '../model/searchable'
import { fold } from '../model/textSearch'

/** One record's hit of one kind, with its haystacks already folded. */
export type RecordEntry = {
  readonly kind: SearchKind
  readonly record: SearchRecord
  /** The title, folded: the starts-with tier reads this. */
  readonly title: string
  /** Everything that is matched, joined and folded. */
  readonly haystack: string
  /** True when the title is shown and not matched: an element's page. */
  readonly proseOnly: boolean
}

export type RecordIndex = {
  /** Per kind, in the order its declaration asks for. Every kind is present, possibly empty. */
  readonly byKind: ReadonlyMap<SearchKind, readonly RecordEntry[]>
  /** An element's name by id, for a row that names what it is about. */
  readonly names: ReadonlyMap<string, string>
}

/** The index for a scope's lists, built on first use and kept for as long as the lists object is. */
export function recordIndex(model: SearchableModel, table: SearchTable = SEARCHABLE): RecordIndex {
  const byTable = indexes.get(table) ?? new WeakMap<SearchableModel, RecordIndex>()
  indexes.set(table, byTable)
  const held = byTable.get(model)
  if (held) return held
  const built = build(model, table)
  byTable.set(model, built)
  return built
}

const indexes = new WeakMap<SearchTable, WeakMap<SearchableModel, RecordIndex>>()
const entries = new WeakMap<Searchable<never>, WeakMap<object, readonly RecordEntry[]>>()

/** One collator for the sort: `localeCompare` per comparison is most of what a build costs. */
const byTitle = new Intl.Collator(undefined, { sensitivity: 'variant' })

function build(model: SearchableModel, table: SearchTable): RecordIndex {
  const byKind = new Map<SearchKind, RecordEntry[]>(SEARCH_KINDS.map((kind) => [kind, []]))
  for (const list of Object.keys(table) as (keyof SearchTable)[]) {
    const records = (model[list] ?? []) as readonly object[]
    for (const declaration of table[list] as readonly Searchable<object>[]) {
      const into = byKind.get(declaration.kind) as RecordEntry[]
      for (const record of records) into.push(...entriesOf(declaration, record))
      if (declaration.order === 'name') into.sort((a, b) => byTitle.compare(a.record.title, b.record.title))
    }
  }
  const names = new Map<string, string>()
  for (const element of model.elements ?? []) names.set(element.id, element.name)
  return { byKind, names }
}

function entriesOf(declaration: Searchable<object>, record: object): readonly RecordEntry[] {
  const key = declaration as Searchable<never>
  const cache = entries.get(key) ?? new WeakMap<object, readonly RecordEntry[]>()
  entries.set(key, cache)
  const held = cache.get(record)
  if (held) return held
  const said = declaration.describe(record)
  const records: readonly SearchRecord[] = said === undefined ? [] : Array.isArray(said) ? said : [said as SearchRecord]
  const proseOnly = declaration.proseOnly === true
  const made = records.map((one): RecordEntry => ({
    kind: declaration.kind,
    record: one,
    title: fold(one.title),
    haystack: fold((proseOnly ? [one.prose] : [one.label, one.title, ...one.fields, one.prose]).filter(Boolean).join(' ')),
    proseOnly,
  }))
  cache.set(record, made)
  return made
}
