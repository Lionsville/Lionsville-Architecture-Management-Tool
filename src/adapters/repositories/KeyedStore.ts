// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The part of a transactional key-value store the repositories here are
 * written over: memory (`adapters/memory/MemoryStore.ts`) and this browser's
 * database (`adapters/webStorage/IndexedDbStore.ts`) each answer it.
 *
 * As little as the repositories need, for the reason `KeyValueStorage` is
 * four lines rather than all of `Storage`: the arithmetic of five repositories
 * is written once and tested once, and what differs between memory and the
 * browser is only where the values sit.
 *
 * **A transaction is all or nothing.** Everything written inside one lands
 * together when the work answers, or — where the work throws, the page goes
 * away, or the store refuses a write — nothing does. Two transactions that
 * write never interleave: each reads what the one before it left.
 *
 * **The work awaits nothing but the transaction's own requests.** A browser's
 * database ends a transaction that is left waiting on anything else, and a
 * write issued after that is refused. Whatever needs another wait — a
 * digest, a clock that is not `Date.now()` — is done before the transaction
 * opens.
 *
 * **Keys are text, ordered as text.** A range is every key from `from` up to,
 * not including, `below`; `prefix` gives the range of the keys that start with
 * it. Values are copied on the way in and on the way out, as a structured
 * clone copies them, so nothing handed out is anything the store keeps.
 */

/** The shelves the repositories keep, each a key-value map of its own. */
export const SHELVES = [
  /** The source's own counters and marks: one value per key. */
  'meta',
  /** Each scope's identity, address, revision and what the tree says of it, by identity. */
  'scopes',
  /** Each scope's model and what it says about itself, by identity. */
  'contents',
  /** Each scope's image library, one entry per picture, by identity and name. */
  'library',
  /** Pictures' bytes, by scope identity and content address. */
  'bytes',
  /** History entries, by scope identity and sequence. */
  'entries',
  /** The state at each entry, keyed as the entry is. */
  'entryStates',
  /** Step ids applied, by id; and the same ids by the day they were applied, to let go of old ones. */
  'steps',
  'stepDays',
  /** What changed at each revision of the index, by sequence. */
  'indexLog',
  /** Settings, by whose they are. */
  'settings',
] as const

export type Shelf = (typeof SHELVES)[number]

/** A span of keys: from `from`, up to and not including `below`. */
export type KeyRange = { from?: string; below?: string }

/** A range read: its span, which way, and how many at most. */
export type RangeRead = KeyRange & { reverse?: boolean; limit?: number }

/** One key and its value, as a range answers them. */
export type Keyed<T> = { key: string; value: T }

export interface Transaction {
  get<T>(shelf: Shelf, key: string): Promise<T | undefined>
  /** The keys and values in a range, in key order or its reverse. */
  range<T>(shelf: Shelf, read: RangeRead): Promise<Keyed<T>[]>
  put(shelf: Shelf, key: string, value: unknown): void
  delete(shelf: Shelf, key: string): void
  deleteRange(shelf: Shelf, range: KeyRange): void
}

export interface KeyedStore {
  /**
   * Run `work` in one transaction over the shelves named, and answer what it
   * answered once everything it wrote has landed. `read` may write nothing.
   */
  transaction<T>(shelves: readonly Shelf[], mode: 'read' | 'write', work: (tx: Transaction) => Promise<T>): Promise<T>
}

/**
 * What sorts after every character a key here holds. The keys are made of
 * identities, names and digits, and none of them holds U+FFFF.
 */
const HIGHEST = '￿'

/** Between the parts of a key: sorts before every character a part holds. */
export const SEPARATOR = '\u0000'

/** The range of the keys that start with `prefix`. */
export function prefix(start: string): KeyRange {
  return { from: start, below: `${start}${HIGHEST}` }
}

/** A key of several parts, each one's keys kept together and apart from the next. */
export function keyOf(...parts: readonly string[]): string {
  return parts.join(SEPARATOR)
}

/** Whether a key is in a range. */
export function inRange(key: string, { from, below }: KeyRange): boolean {
  return (from === undefined || key >= from) && (below === undefined || key < below)
}
