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
 * transaction that throws leaves nothing behind; every value is copied on the
 * way in and on the way out, as a structured clone copies it, so a caller that
 * changes what it was handed changes nothing kept; and a transaction names
 * the shelves it may touch.
 *
 * **And it refuses what a database refuses**: a request once the work has
 * answered, and a request after the work waited on anything but the
 * transaction's own answers (`KeyedStore`). A database ends a transaction
 * left idle at the end of a task; this store marks it idle at the same point
 * — once the microtasks queued, and those they queue, have run — and refuses
 * any request made after that, rather than taking it as a database never
 * would. Code that passes here does not fail there for that reason.
 */
import { inRange } from '../repositories/KeyedStore'
import type { KeyRange, Keyed, KeyedStore, RangeRead, Shelf, Transaction } from '../repositories/KeyedStore'

/** A key a transaction took out, until it lands. */
const GONE: unique symbol = Symbol('gone')

type Held = Map<string, unknown>
type Pending = Map<string, unknown>

type Tick = { nextTick?(run: () => void): void }

/**
 * Run `idle` once the task now running has ended: after every microtask
 * queued by then, and every one they queue. Node says so exactly
 * (`process.nextTick` from a microtask runs once the queue is empty); a
 * browser has no such hook, and a timer is the nearest it has, which may come
 * late — so there this store refuses a request as soon as it can tell.
 */
function atEndOfTask(idle: () => void): void {
  const tick = (globalThis as { process?: Tick }).process?.nextTick
  queueMicrotask(() => {
    if (tick) tick(idle)
    else setTimeout(idle, 0)
  })
}

class MemoryTransaction implements Transaction {
  readonly writes = new Map<Shelf, Pending>()
  private active = true
  private answered = false
  /** How many times it has been made active; an idle mark from before the last is stale. */
  private turn = 0

  constructor(
    private readonly store: (shelf: Shelf) => Held,
    private readonly shelves: readonly Shelf[],
    private readonly mode: 'read' | 'write',
  ) {
    this.wake()
  }

  /** Active until the end of this task, as a database's transaction is after each answer. */
  private wake(): void {
    this.active = true
    this.turn += 1
    const turn = this.turn
    atEndOfTask(() => {
      if (this.turn === turn) this.active = false
    })
  }

  end(): void {
    this.answered = true
  }

  private asked(shelf: Shelf, writing: boolean): void {
    if (this.answered || !this.active) {
      throw new DOMException('the transaction is no longer active', 'TransactionInactiveError')
    }
    if (!this.shelves.includes(shelf)) throw new DOMException(`no ${shelf} in this transaction`, 'NotFoundError')
    if (writing && this.mode === 'read') throw new DOMException('a read transaction writes nothing', 'ReadOnlyError')
  }

  /** An answer, and the transaction active again when it arrives. */
  private answer<V>(value: V): Promise<V> {
    return Promise.resolve().then(() => {
      this.wake()
      return value
    })
  }

  private current(shelf: Shelf, key: string): unknown {
    const written = this.writes.get(shelf)
    if (written?.has(key)) return written.get(key)
    return this.store(shelf).has(key) ? this.store(shelf).get(key) : GONE
  }

  private pending(shelf: Shelf): Pending {
    let found = this.writes.get(shelf)
    if (!found) {
      found = new Map()
      this.writes.set(shelf, found)
    }
    return found
  }

  private keysOf(shelf: Shelf): string[] {
    return [...new Set([...this.store(shelf).keys(), ...(this.writes.get(shelf)?.keys() ?? [])])]
      .filter((key) => this.current(shelf, key) !== GONE)
  }

  get<V>(shelf: Shelf, key: string): Promise<V | undefined> {
    this.asked(shelf, false)
    const value = this.current(shelf, key)
    return this.answer(value === GONE ? undefined : structuredClone(value) as V)
  }

  range<V>(shelf: Shelf, read: RangeRead): Promise<Keyed<V>[]> {
    this.asked(shelf, false)
    const range: KeyRange = read
    const keys = this.keysOf(shelf).filter((key) => inRange(key, range))
      .sort((one, other) => (one < other ? -1 : one > other ? 1 : 0))
    if (read.reverse) keys.reverse()
    const wanted = read.limit === undefined ? keys : keys.slice(0, read.limit)
    return this.answer(wanted.map((key) => ({ key, value: structuredClone(this.current(shelf, key)) as V })))
  }

  put(shelf: Shelf, key: string, value: unknown): void {
    this.asked(shelf, true)
    const copy = structuredClone(value)
    this.pending(shelf).set(key, copy)
  }

  delete(shelf: Shelf, key: string): void {
    this.asked(shelf, true)
    this.pending(shelf).set(key, GONE)
  }

  deleteRange(shelf: Shelf, range: KeyRange): void {
    this.asked(shelf, true)
    for (const key of this.keysOf(shelf)) {
      if (inRange(key, range)) this.pending(shelf).set(key, GONE)
    }
  }
}

export class MemoryStore implements KeyedStore {
  private readonly shelves = new Map<Shelf, Held>()
  /** The last transaction asked for: the next one starts when it has ended, however it ended. */
  private queue: Promise<unknown> = Promise.resolve()

  transaction<T>(shelves: readonly Shelf[], mode: 'read' | 'write', work: (tx: Transaction) => Promise<T>): Promise<T> {
    const run = this.queue.then(() => this.run(shelves, mode, work))
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

  private async run<T>(shelves: readonly Shelf[], mode: 'read' | 'write', work: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx = new MemoryTransaction((shelf) => this.held(shelf), shelves, mode)
    try {
      const answer = await work(tx)
      this.land(tx.writes)
      return answer
    } finally {
      tx.end()
    }
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
