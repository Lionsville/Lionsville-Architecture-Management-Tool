// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A keyed store in memory: what the repositories keep in a session that
 * leaves nothing behind (`memoryRepositories.ts`).
 *
 * It keeps the promises a database's transaction makes, because the
 * repositories over it count on them: transactions run one at a time, in the
 * order they were asked for, so no two interleave between their awaits; what
 * one writes is held aside and lands only when its work answers, so a
 * transaction that throws leaves nothing behind; and every value is copied on
 * the way in and on the way out, as a structured clone copies it, so a caller
 * that changes what it was handed changes nothing kept.
 */
import { inRange } from '../repositories/KeyedStore'
import type { KeyRange, Keyed, KeyedStore, RangeRead, Shelf, Transaction } from '../repositories/KeyedStore'

/** A key a transaction took out, until it lands. */
const GONE: unique symbol = Symbol('gone')

type Held = Map<string, unknown>
type Pending = Map<string, unknown>

export class MemoryStore implements KeyedStore {
  private readonly shelves = new Map<Shelf, Held>()
  /** The last transaction asked for: the next one starts when it has ended, however it ended. */
  private queue: Promise<unknown> = Promise.resolve()

  transaction<T>(_shelves: readonly Shelf[], mode: 'read' | 'write', work: (tx: Transaction) => Promise<T>): Promise<T> {
    const run = this.queue.then(() => this.run(mode, work))
    this.queue = run.then(() => undefined, () => undefined)
    return run
  }

  private held(shelf: Shelf): Held {
    let found = this.shelves.get(shelf)
    if (!found) {
      found = new Map()
      this.shelves.set(shelf, found)
    }
    return found
  }

  private async run<T>(mode: 'read' | 'write', work: (tx: Transaction) => Promise<T>): Promise<T> {
    const writes = new Map<Shelf, Pending>()
    const pending = (shelf: Shelf): Pending => {
      if (mode === 'read') throw new Error('a read transaction writes nothing')
      let found = writes.get(shelf)
      if (!found) {
        found = new Map()
        writes.set(shelf, found)
      }
      return found
    }
    const current = (shelf: Shelf, key: string): unknown => {
      const written = writes.get(shelf)
      if (written?.has(key)) return written.get(key)
      return this.held(shelf).has(key) ? this.held(shelf).get(key) : GONE
    }
    const tx: Transaction = {
      get: <V>(shelf: Shelf, key: string) => {
        const value = current(shelf, key)
        return Promise.resolve(value === GONE ? undefined : structuredClone(value) as V)
      },
      range: <V>(shelf: Shelf, read: RangeRead) => Promise.resolve(this.rangeOf<V>(shelf, read, writes.get(shelf), current)),
      put: (shelf, key, value) => {
        pending(shelf).set(key, structuredClone(value))
      },
      delete: (shelf, key) => {
        pending(shelf).set(key, GONE)
      },
      deleteRange: (shelf, range) => {
        for (const key of this.keysOf(shelf, writes.get(shelf))) {
          if (inRange(key, range)) pending(shelf).set(key, GONE)
        }
      },
    }
    const answer = await work(tx)
    this.land(writes)
    return answer
  }

  private keysOf(shelf: Shelf, written: Pending | undefined): Set<string> {
    return new Set([...this.held(shelf).keys(), ...(written?.keys() ?? [])])
  }

  private rangeOf<V>(
    shelf: Shelf, read: RangeRead, written: Pending | undefined, current: (shelf: Shelf, key: string) => unknown,
  ): Keyed<V>[] {
    const range: KeyRange = read
    const keys = [...this.keysOf(shelf, written)]
      .filter((key) => inRange(key, range) && current(shelf, key) !== GONE)
      .sort((one, other) => (one < other ? -1 : one > other ? 1 : 0))
    if (read.reverse) keys.reverse()
    const wanted = read.limit === undefined ? keys : keys.slice(0, read.limit)
    return wanted.map((key) => ({ key, value: structuredClone(current(shelf, key)) as V }))
  }

  private land(writes: Map<Shelf, Pending>): void {
    for (const [shelf, written] of writes) {
      const held = this.held(shelf)
      for (const [key, value] of written) {
        if (value === GONE) held.delete(key)
        else held.set(key, value)
      }
    }
  }
}
