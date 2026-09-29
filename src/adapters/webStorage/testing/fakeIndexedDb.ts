// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * As much IndexedDB as `IndexedDbStore` uses, for its suites: node has none,
 * and neither has jsdom.
 *
 * It keeps the three behaviours the store is written around, because a fake
 * without them would pass a store that breaks in a browser:
 * - **a transaction is active only until the end of the task** it was made in,
 *   or that delivered its last answer — once every microtask queued by then,
 *   and every one they queue, has run — and a request made while it is not is
 *   refused (`TransactionInactiveError`), as a browser refuses one made after
 *   an await on anything else, a digest say;
 * - **it commits once it has nothing left to do**, a task after its last
 *   answer;
 * - **what a transaction writes lands only when it commits**, and nothing of it
 *   when it aborts;
 * - **transactions run one at a time**, in the order they were made.
 *
 * Answers arrive a task later, as a browser's do. Values are copied on the way
 * in and out. Nothing else is modelled: no indexes, no versions past the
 * first upgrade, no blocking between pages.
 */

type Key = string

export class FakeKeyRange {
  private constructor(
    readonly lower: Key | undefined, readonly upper: Key | undefined,
    readonly lowerOpen: boolean, readonly upperOpen: boolean,
  ) {}

  static bound(lower: Key, upper: Key, lowerOpen = false, upperOpen = false): FakeKeyRange {
    if (lower > upper || (lower === upper && (lowerOpen || upperOpen))) throw new DOMException('empty range', 'DataError')
    return new FakeKeyRange(lower, upper, lowerOpen, upperOpen)
  }

  static lowerBound(lower: Key, open = false): FakeKeyRange {
    return new FakeKeyRange(lower, undefined, open, false)
  }

  static upperBound(upper: Key, open = false): FakeKeyRange {
    return new FakeKeyRange(undefined, upper, false, open)
  }

  includes(key: Key): boolean {
    const above = this.lower === undefined || (this.lowerOpen ? key > this.lower : key >= this.lower)
    const below = this.upper === undefined || (this.upperOpen ? key < this.upper : key <= this.upper)
    return above && below
  }
}

type Shelves = Map<string, Map<Key, unknown>>
type Request = {
  result: unknown
  error: unknown
  onsuccess: (() => void) | null
  onerror: (() => void) | null
}

/** A task from now: the next turn of node's loop, without a timer's millisecond. */
const later = (run: () => void): void => {
  setImmediate(run)
}

const GONE = Symbol('gone')

function inOrder(keys: Key[], direction: 'next' | 'prev'): Key[] {
  return direction === 'prev' ? keys.reverse() : keys
}

class FakeTransaction {
  oncomplete: (() => void) | null = null
  onabort: (() => void) | null = null
  error: unknown = null
  private readonly writes = new Map<string, Map<Key, unknown>>()
  private waiting: (() => void)[] = []
  private pending = 0
  private running = false
  private ended = false
  private active = true
  private turn = 0

  constructor(private readonly database: FakeDatabase, private readonly names: readonly string[], private readonly mode: string) {
    this.wake()
  }

  /** Active until the microtasks now queued, and those they queue, have run: node's `nextTick` from a microtask. */
  private wake(): void {
    this.active = true
    this.turn += 1
    const turn = this.turn
    queueMicrotask(() => process.nextTick(() => {
      if (this.turn === turn) this.active = false
    }))
  }

  objectStore(name: string) {
    if (!this.names.includes(name)) throw new DOMException(`no ${name} in this transaction`, 'NotFoundError')
    const read = (key: Key): unknown => {
      const written = this.writes.get(name)
      if (written?.has(key)) return written.get(key)
      return this.database.shelves.get(name)!.has(key) ? this.database.shelves.get(name)!.get(key) : GONE
    }
    const keys = (): Key[] => [...new Set([...this.database.shelves.get(name)!.keys(), ...(this.writes.get(name)?.keys() ?? [])])]
      .filter((key) => read(key) !== GONE).sort()
    const writable = () => {
      if (this.mode !== 'readwrite') throw new DOMException('read only', 'ReadOnlyError')
    }
    const write = (key: Key, value: unknown) => {
      const written = this.writes.get(name) ?? new Map<Key, unknown>()
      written.set(key, value)
      this.writes.set(name, written)
    }
    const within = (range: FakeKeyRange | Key) => (key: Key) => (typeof range === 'string' ? key === range : range.includes(key))
    return {
      get: (key: Key) => this.request(() => {
        const value = read(key)
        return value === GONE ? undefined : structuredClone(value)
      }),
      put: (value: unknown, key: Key) => {
        writable()
        const copy = structuredClone(value)
        return this.request(() => write(key, copy))
      },
      delete: (range: FakeKeyRange | Key) => writable() ?? this.request(() => {
        for (const key of keys().filter(within(range))) write(key, GONE)
      }),
      clear: () => writable() ?? this.request(() => {
        for (const key of keys()) write(key, GONE)
      }),
      openCursor: (range: FakeKeyRange | undefined, direction: 'next' | 'prev' = 'next') => {
        // Read when the request runs, after the requests made before it, as a browser reads it.
        let found: Key[] | undefined
        let at = 0
        const step = (): unknown => {
          found ??= inOrder(keys().filter((key) => !range || range.includes(key)), direction)
          if (at >= found.length) return null
          const key = found[at]
          return { key, value: structuredClone(read(key)), continue: () => { at += 1; this.again(request, step) } }
        }
        const request = this.request(step)
        return request
      },
    }
  }

  abort(): void {
    if (this.ended) throw new DOMException('the transaction has ended', 'InvalidStateError')
    this.ended = true
    this.waiting = []
    later(() => {
      this.onabort?.()
      this.database.next()
    })
  }

  start(): void {
    this.running = true
    const waiting = this.waiting
    this.waiting = []
    for (const run of waiting) run()
    this.settleLater()
  }

  private request(work: () => unknown): Request {
    const request: Request = { result: undefined, error: null, onsuccess: null, onerror: null }
    this.again(request, work)
    return request
  }

  /** Answer `request` from `work` a task from now, once this transaction is the one running. */
  private again(request: Request, work: () => unknown): void {
    if (this.ended || !this.active) throw new DOMException('the transaction is not active', 'TransactionInactiveError')
    this.pending += 1
    const run = () => later(() => {
      if (this.ended) return
      request.result = work()
      this.pending -= 1
      this.wake()
      request.onsuccess?.()
      this.settleLater()
    })
    if (this.running) run()
    else this.waiting.push(run)
  }

  /** Commit a task from now if nothing was asked of this transaction by then. */
  private settleLater(): void {
    later(() => {
      if (this.ended || this.pending > 0 || this.waiting.length > 0) return
      this.ended = true
      for (const [name, written] of this.writes) {
        const shelf = this.database.shelves.get(name)!
        for (const [key, value] of written) {
          if (value === GONE) shelf.delete(key)
          else shelf.set(key, value)
        }
      }
      this.oncomplete?.()
      this.database.next()
    })
  }
}

class FakeDatabase {
  onversionchange: (() => void) | null = null
  private readonly queue: FakeTransaction[] = []

  constructor(readonly shelves: Shelves) {}

  get objectStoreNames() {
    return { contains: (name: string) => this.shelves.has(name) }
  }

  createObjectStore(name: string): void {
    this.shelves.set(name, new Map())
  }

  transaction(names: string | readonly string[], mode = 'readonly'): FakeTransaction {
    const held = new FakeTransaction(this, typeof names === 'string' ? [names] : names, mode)
    this.queue.push(held)
    if (this.queue.length === 1) held.start()
    return held
  }

  close(): void {}

  /** The running transaction has ended: start the next. */
  next(): void {
    this.queue.shift()
    this.queue[0]?.start()
  }
}

/** A fresh IndexedDB with no database in it, and the key range that goes with it. */
export function fakeIndexedDb(): { factory: IDBFactory; keyRange: typeof IDBKeyRange } {
  const databases = new Map<string, FakeDatabase>()
  const factory = {
    open: (name: string) => {
      const request: Request & { onupgradeneeded: (() => void) | null } = {
        result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null,
      }
      later(() => {
        let database = databases.get(name)
        if (!database) {
          database = new FakeDatabase(new Map())
          databases.set(name, database)
          request.result = database
          request.onupgradeneeded?.()
        }
        request.result = database
        request.onsuccess?.()
      })
      return request
    },
  }
  return { factory: factory as unknown as IDBFactory, keyRange: FakeKeyRange as unknown as typeof IDBKeyRange }
}
