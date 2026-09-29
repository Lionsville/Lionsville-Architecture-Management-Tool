// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A transaction's writes, held in the page until its work has answered and
 * then made in one go (`IndexedDbStore`).
 *
 * **Why not write as the work goes.** A browser commits a transaction the
 * moment it is left with nothing to do, whatever the page meant — and a work
 * that awaits anything but the transaction's own answers leaves it so. In
 * WebKit a digest is such a wait: the writes made before it land, the rest of
 * the work is refused, and a transaction that was to land whole or not at all
 * has landed half. Held here, nothing is written until the work has answered;
 * a transaction the browser ended early has nothing of the work in it, and
 * the writes are refused as it is.
 *
 * **Reads see them.** Every read is still asked of the database — so a read
 * after the transaction has ended is refused as the browser refuses it — and
 * its answer is then read through what is held: a key put answers what was
 * put, a key taken out answers nothing, a range gains the keys put in it and
 * loses those taken out. A value is copied as it is held and again as it is
 * read, as the database copies it, so a value that cannot be copied is
 * refused where it is put.
 */
import { inRange } from '../repositories/KeyedStore'
import type { KeyRange, Keyed, RangeRead, Shelf } from '../repositories/KeyedStore'

const GONE: unique symbol = Symbol('gone')

/** Whether two spans share a key. */
function overlaps(one: KeyRange, other: KeyRange): boolean {
  const startsBefore = (a: KeyRange, b: KeyRange) => a.from === undefined || b.below === undefined || a.from < b.below
  return startsBefore(one, other) && startsBefore(other, one)
}

type Held = unknown

/** One write, in the order the work made it. */
export type Write =
  | { shelf: Shelf; put: string; value: Held }
  | { shelf: Shelf; delete: string }
  | { shelf: Shelf; deleteRange: KeyRange }

type Latest = { seq: number; value: Held | typeof GONE }

export class HeldWrites {
  readonly writes: Write[] = []
  private readonly keys = new Map<Shelf, Map<string, Latest>>()
  private readonly ranges = new Map<Shelf, { seq: number; range: KeyRange }[]>()

  put(shelf: Shelf, key: string, value: unknown): void {
    const copy = structuredClone(value)
    this.writes.push({ shelf, put: key, value: copy })
    this.latestOf(shelf).set(key, { seq: this.writes.length, value: copy })
  }

  delete(shelf: Shelf, key: string): void {
    this.writes.push({ shelf, delete: key })
    this.latestOf(shelf).set(key, { seq: this.writes.length, value: GONE })
  }

  deleteRange(shelf: Shelf, range: KeyRange): void {
    this.writes.push({ shelf, deleteRange: range })
    const ranges = this.ranges.get(shelf) ?? []
    ranges.push({ seq: this.writes.length, range })
    this.ranges.set(shelf, ranges)
  }

  /**
   * How many of the database's keys a range read needs, read through what is
   * held, to answer as far as its limit: `untouched` where nothing held falls
   * inside it, so the database answers as it stands; else the limit and one
   * more for each key held gone inside it, since each can take one of the
   * database's keys out; and no limit where a range taken out reaches into
   * it, which may take out any number. A key held put only adds to the
   * answer, so it asks for none more.
   */
  reach(shelf: Shelf, read: RangeRead): 'untouched' | { limit?: number } {
    const inside = [...(this.keys.get(shelf) ?? [])].filter(([key]) => inRange(key, read))
    const cut = (this.ranges.get(shelf) ?? []).some(({ range }) => overlaps(range, read))
    if (inside.length === 0 && !cut) return 'untouched'
    if (cut || read.limit === undefined) return {}
    return { limit: read.limit + inside.filter(([, { value }]) => value === GONE).length }
  }

  /** What a get answers: what is held for the key, or else the database's answer. */
  get(shelf: Shelf, key: string, stored: unknown): unknown {
    const held = this.held(shelf, key)
    if (held === undefined) return stored
    return held.value === GONE ? undefined : structuredClone(held.value)
  }

  /** What a range answers: the database's keys in it, read through what is held, as far as the read's limit. */
  range<V>(shelf: Shelf, read: RangeRead, stored: readonly Keyed<V>[]): Keyed<V>[] {
    const found = new Map<string, V>()
    for (const { key, value } of stored) {
      const held = this.held(shelf, key)
      if (held === undefined) found.set(key, value)
      else if (held.value !== GONE) found.set(key, structuredClone(held.value) as V)
    }
    for (const [key, { value }] of this.keys.get(shelf) ?? []) {
      if (value !== GONE && !found.has(key) && inRange(key, read) && this.held(shelf, key)?.value !== GONE) {
        found.set(key, structuredClone(value) as V)
      }
    }
    const keys = [...found.keys()].sort((one, other) => (one < other ? -1 : one > other ? 1 : 0))
    if (read.reverse) keys.reverse()
    const wanted = read.limit === undefined ? keys : keys.slice(0, read.limit)
    return wanted.map((key) => ({ key, value: found.get(key) as V }))
  }

  /** The last write held that reaches a key, or `undefined` where none does. */
  private held(shelf: Shelf, key: string): Latest | undefined {
    const one = this.keys.get(shelf)?.get(key)
    const taken = (this.ranges.get(shelf) ?? []).filter(({ range }) => inRange(key, range)).at(-1)
    if (taken && (!one || taken.seq > one.seq)) return { seq: taken.seq, value: GONE }
    return one
  }

  private latestOf(shelf: Shelf): Map<string, Latest> {
    let found = this.keys.get(shelf)
    if (!found) {
      found = new Map()
      this.keys.set(shelf, found)
    }
    return found
  }
}
