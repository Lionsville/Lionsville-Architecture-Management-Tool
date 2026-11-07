// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a list is showing, as data: what was typed, what is filtered, how it is
 * grouped and sorted, which columns are on and which row is selected.
 *
 * It lives in the address, because a shared link and an agent must reach the
 * same list a person sees, and because Back must undo a filter. So there is a
 * reader and a writer of a query string here, and they keep their hands off
 * anything else the page has put there (`tab`, say). Density is not here: that
 * is a person's preference, not a fact about the list.
 *
 * No React, so the arithmetic can be tested on its own, and a screen can work
 * out what it needs (a count, the rows for an export) with the same rules the
 * list draws by.
 */

export type ListSort = { readonly column: string; readonly descending: boolean }

export type ListView = {
  readonly find: string
  readonly filters: Readonly<Record<string, readonly string[]>>
  readonly group: string | null
  readonly sort: ListSort | null
  /** Null is the page's own choice of columns, which is not written down. */
  readonly columns: readonly string[] | null
  readonly select: string | null
}

export const FRESH_VIEW: ListView = { find: '', filters: {}, group: null, sort: null, columns: null, select: null }

const FILTER_PREFIX = 'f.'
const OWN_KEYS = new Set(['q', 'group', 'sort', 'cols', 'select'])

function isOwn(key: string): boolean {
  return OWN_KEYS.has(key) || key.startsWith(FILTER_PREFIX)
}

export function readListView(params: URLSearchParams): ListView {
  const filters: Record<string, string[]> = {}
  for (const [key, value] of params) {
    if (key.startsWith(FILTER_PREFIX) && value) (filters[key.slice(FILTER_PREFIX.length)] ??= []).push(value)
  }
  const sort = params.get('sort')
  const cols = params.get('cols')
  return {
    find: params.get('q') ?? '',
    filters,
    group: params.get('group') || null,
    sort: sort ? { column: sort.replace(/^-/, ''), descending: sort.startsWith('-') } : null,
    columns: cols === null ? null : cols.split(',').filter(Boolean),
    select: params.get('select') || null,
  }
}

/** A new query with the view written into it; what else `over` holds stays, in its order. */
export function writeListView(view: ListView, over: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const next = new URLSearchParams([...over].filter(([key]) => !isOwn(key)))
  if (view.find) next.set('q', view.find)
  for (const [field, values] of Object.entries(view.filters)) {
    for (const value of values) next.append(FILTER_PREFIX + field, value)
  }
  if (view.group) next.set('group', view.group)
  if (view.sort) next.set('sort', (view.sort.descending ? '-' : '') + view.sort.column)
  if (view.columns) next.set('cols', view.columns.join(','))
  if (view.select) next.set('select', view.select)
  return next
}

/** How a screen's records answer the view. Only what the page offers needs saying. */
export type ListHow<T> = {
  /** Every word Find covers: every shown column, so what can be seen can be found. */
  readonly words: (item: T) => readonly string[]
  readonly filterBy?: Readonly<Record<string, (item: T) => string | readonly string[]>>
  readonly sortBy?: Readonly<Record<string, (item: T) => string | number | null>>
  readonly groupBy?: Readonly<Record<string, (item: T) => { readonly id: string; readonly label: string }>>
  readonly language?: string
}

export type ListedGroup<T> = { readonly id: string; readonly label: string; readonly rows: readonly T[] }

/** Case and accents do not stop a find: "Zurich" finds "Zürich". */
function folded(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function holdsAll(words: readonly string[], parts: readonly string[]): boolean {
  const haystack = folded(words.join(' '))
  return parts.every((part) => haystack.includes(part))
}

function passesFilters<T>(item: T, view: ListView, how: ListHow<T>): boolean {
  return Object.entries(view.filters).every(([field, wanted]) => {
    const read = how.filterBy?.[field]
    if (!read || wanted.length === 0) return true
    const has = read(item)
    return typeof has === 'string' ? wanted.includes(has) : has.some((value) => wanted.includes(value))
  })
}

/** Nothing to compare goes last in either direction: an empty date is not the earliest date. */
function compared(a: string | number | null, b: string | number | null, descending: boolean, language?: string): number {
  if (a === null || a === '') return b === null || b === '' ? 0 : 1
  if (b === null || b === '') return -1
  const order = typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), language, { numeric: true, sensitivity: 'base' })
  return descending ? -order : order
}

/**
 * The rows the view keeps, sorted and grouped. No group asked for is one group
 * with no label, which the list draws without a head. Groups keep the order
 * they are first met in, so a screen decides theirs by how it orders the items.
 */
export function listed<T>(items: readonly T[], view: ListView, how: ListHow<T>): readonly ListedGroup<T>[] {
  const parts = folded(view.find).split(/\s+/).filter(Boolean)
  const kept = items.filter((item) => holdsAll(how.words(item), parts) && passesFilters(item, view, how))
  const readSort = view.sort ? how.sortBy?.[view.sort.column] : undefined
  const sorted = readSort && view.sort
    ? kept
      .map((item, index) => ({ item, index, key: readSort(item) }))
      .sort((a, b) => compared(a.key, b.key, view.sort?.descending ?? false, how.language) || a.index - b.index)
      .map(({ item }) => item)
    : kept
  const readGroup = view.group ? how.groupBy?.[view.group] : undefined
  if (!readGroup) return sorted.length ? [{ id: '', label: '', rows: sorted }] : []
  const groups = new Map<string, { id: string; label: string; rows: T[] }>()
  for (const item of sorted) {
    const { id, label } = readGroup(item)
    const group = groups.get(id) ?? { id, label, rows: [] }
    group.rows.push(item)
    groups.set(id, group)
  }
  return [...groups.values()]
}

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i]
    for (let j = 1; j <= b.length; j += 1) {
      next[j] = Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    row = next
  }
  return row[b.length] ?? 0
}

/**
 * The word in the list closest to a find that matched nothing, for *Did you
 * mean*. One slip in a short word and two in a longer one; anything further off
 * is a different word, and offering it would be a guess.
 */
export function didYouMean(find: string, words: readonly string[]): string | null {
  const typed = folded(find.trim())
  if (typed.length < 3) return null
  const allowed = typed.length < 6 ? 1 : 2
  let best: string | null = null
  let bestDistance = allowed + 1
  for (const text of words) {
    for (const word of text.split(/[\s,.;:()/]+/)) {
      if (Math.abs(word.length - typed.length) > allowed) continue
      const off = distance(typed, folded(word))
      if (off < bestDistance && off > 0) {
        best = word
        bestDistance = off
      }
    }
  }
  return best
}
