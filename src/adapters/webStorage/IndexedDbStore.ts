// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A keyed store in this browser's IndexedDB: where the repositories keep a
 * browser's work (`browserRepositories.ts`).
 *
 * **Why a database and not the key-value storage the scopes were kept in.**
 * The repositories keep a history — the state at every entry, the step ids
 * applied, labels — and pictures' bytes. The key-value storage holds a few
 * megabytes of text for the whole origin, so a history there is a history cut
 * to fit, and a picture costs a third more written as text. It is also one key
 * at a time: an apply to three scopes would be three writes, and a page closed
 * between the second and the third would leave the source half-changed. A
 * database transaction spans every shelf it names and lands whole or not at
 * all, closed page included; it holds bytes as bytes; and its quota is a share
 * of the disk rather than a fixed handful of megabytes.
 *
 * Each shelf is an object store with its keys given on the way in, so a range
 * of keys is a key range and a scope's entries, library or bytes are one
 * cursor. A transaction's work may await only the requests it makes
 * (`KeyedStore`): the database commits a transaction the moment it has
 * nothing left to do, and a request made after that is refused. So the
 * work's writes are held in the page and made only once it has answered
 * (`heldWrites.ts`): a transaction the database ended early has none of them.
 *
 * **A connection is not forever.** The browser may close it — storage cleared,
 * the disk gone, iOS Safari losing its database server between two visits to
 * a tab — and a later build asks for it to upgrade the layout. So:
 * - a connection closed under the page is forgotten, and the next transaction
 *   opens another;
 * - a transaction that fails because the connection went (`UnknownError`,
 *   `InvalidStateError`, or aborted without a cause by a closing connection)
 *   landed nothing, and is run once more on a new connection;
 * - a later build asking to upgrade (`versionchange`), a database already at a
 *   later layout (`VersionError`), or a second loss in a row leaves this page
 *   unable to write: the store's standing is `reload`, and every transaction
 *   is refused `shell.storageReload` until the page is loaded again;
 * - an upgrade waiting on another tab that holds an older layout open is
 *   standing `blocked` until that tab lets go.
 *
 * **Full is a refusal, never a raw exception.** A write the browser refuses
 * for want of room (`QuotaExceededError`) lands nothing and is refused
 * `shell.storageFull`, for the app to say. Writes ask for `strict` durability,
 * so a transaction answered is on disk, not in a cache a power cut empties.
 */
import { ShellError } from '../../platform/errors'
import { SHELVES } from '../repositories/KeyedStore'
import type { KeyRange, Keyed, KeyedStore, RangeRead, Shelf, Transaction } from '../repositories/KeyedStore'
import { HeldWrites } from './heldWrites'

export const DATABASE_NAME = 'lvarch.repositories'

/**
 * The version the shelves were laid out at; a later layout is a later version
 * and an upgrade, which lays out every shelf the database does not have yet.
 * 2 added the shelves that count what names each picture's bytes; 3 adds a
 * folder's own shelves (`folders`, `folderData`).
 */
export const DATABASE_VERSION = 3

/** As much of the browser's storage manager as the store asks: each part may be missing. */
export type StorageManagerLike = {
  persist?(): Promise<boolean>
  persisted?(): Promise<boolean>
  estimate?(): Promise<{ usage?: number; quota?: number }>
}

/**
 * The database's two globals, named rather than assumed, so a suite can hand
 * in its own — and the storage manager, where the browser has one, for
 * keeping the database through a clear-out and saying how full it is.
 */
export type IndexedDb = { factory: IDBFactory; keyRange: typeof IDBKeyRange; manager?: StorageManagerLike }

/**
 * Whether this page may use the database: `open` (or not asked yet),
 * `blocked` while an older tab holds it, or `reload` once only loading the
 * page again lets it write.
 */
export type Standing = 'open' | 'blocked' | 'reload'

/** How much of what the browser lets this site keep is kept, in bytes: the notice's `used` and `budget`. */
export type Pressure = { used: number; budget: number }

/** What a connection tells whoever opened it, after it opened. */
export type ConnectionEvents = {
  /** An upgrade waits on another tab that holds the database open at an older layout. */
  blocked?(): void
  /** A later build asked for the database; this connection has let go of it. */
  versionChange?(): void
  /** The browser closed this connection under the page. */
  closed?(database: IDBDatabase): void
}

/**
 * Open the database, laying out its shelves the first time. Another page that
 * holds it open at an older layout is asked to let go (`onversionchange`), and
 * this page lets go the same way when a later build asks.
 */
export function openDatabase({ factory }: IndexedDb, name = DATABASE_NAME, events: ConnectionEvents = {}): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      for (const shelf of SHELVES) {
        if (!database.objectStoreNames.contains(shelf)) database.createObjectStore(shelf)
      }
    }
    request.onblocked = () => events.blocked?.()
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        events.versionChange?.()
      }
      database.onclose = () => events.closed?.(database)
      resolve(database)
    }
    request.onerror = () => reject(request.error ?? new Error('the database would not open'))
  })
}

function answer<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('the database refused a request'))
  })
}

/** A transaction that landed nothing because its connection went: worth one more try on a new one. */
class ConnectionLost extends Error {
  constructor(readonly cause: unknown) {
    super('the connection to the database was lost')
  }
}

function nameOf(error: unknown): string | undefined {
  const name = (error as { name?: unknown } | null | undefined)?.name
  return typeof name === 'string' ? name : undefined
}

/** The names a browser gives a transaction or an open that failed because the connection went. */
const LOST = new Set(['UnknownError', 'InvalidStateError'])

const full = (): ShellError => new ShellError('shell.storageFull')

/** What the work's own failure is refused as: full where the browser ran out of room, else as it was. */
function workRefusal(error: unknown): unknown {
  return nameOf(error) === 'QuotaExceededError' ? full() : error
}

export class IndexedDbStore implements KeyedStore {
  private connection: Promise<IDBDatabase> | undefined
  private now: Standing = 'open'
  private readonly listeners = new Set<(standing: Standing) => void>()
  /** Connections the browser closed under the page: a transaction of theirs that aborted went with them. */
  private readonly closed = new WeakSet<IDBDatabase>()
  private asked: Promise<boolean | undefined> | undefined

  constructor(private readonly indexedDb: IndexedDb, private readonly name = DATABASE_NAME) {}

  /** Whether this page may use the database now. */
  standing(): Standing {
    return this.now
  }

  /** Told each time the standing moves; answers the way to stop being told. */
  onStanding(listener: (standing: Standing) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Whether the browser agreed to keep this site's storage until a person
   * clears it, rather than evicting it under pressure: asked once, after the
   * database first opens. `undefined` where the browser cannot say.
   */
  persisted(): Promise<boolean | undefined> {
    return this.asked ?? Promise.resolve(undefined)
  }

  /** How full this site's storage is, as the browser estimates it; `undefined` where it will not say. */
  async pressure(): Promise<Pressure | undefined> {
    const estimate = await this.indexedDb.manager?.estimate?.().catch(() => undefined)
    const { usage, quota } = estimate ?? {}
    return typeof usage === 'number' && typeof quota === 'number' && quota > 0 ? { used: usage, budget: quota } : undefined
  }

  async transaction<T>(shelves: readonly Shelf[], mode: 'read' | 'write', work: (tx: Transaction) => Promise<T>): Promise<T> {
    for (let tries = 1; ; tries += 1) {
      try {
        return await this.attempt(shelves, mode, work)
      } catch (error) {
        if (!(error instanceof ConnectionLost)) throw error
        if (tries >= 2) throw this.mustReload()
      }
    }
  }

  private become(standing: Standing): void {
    if (this.now === standing) return
    this.now = standing
    for (const listener of this.listeners) listener(standing)
  }

  private mustReload(): ShellError {
    this.connection = undefined
    this.become('reload')
    return new ShellError('shell.storageReload')
  }

  /** Opened on first use and kept until the browser closes it; a failure to open is tried again on the next transaction. */
  private opened(): Promise<IDBDatabase> {
    if (this.now === 'reload') return Promise.reject(new ShellError('shell.storageReload'))
    if (this.connection) return this.connection
    const forget = () => {
      if (this.connection === opening) this.connection = undefined
    }
    const opening: Promise<IDBDatabase> = openDatabase(this.indexedDb, this.name, {
      blocked: () => this.become('blocked'),
      versionChange: () => {
        forget()
        this.become('reload')
      },
      closed: (database) => {
        this.closed.add(database)
        forget()
      },
    }).then((database) => {
      if (this.now === 'blocked') this.become('open')
      this.asked ??= this.keepThrough()
      return database
    }, (error: unknown) => {
      forget()
      throw this.openRefusal(error)
    })
    this.connection = opening
    return opening
  }

  private openRefusal(error: unknown): unknown {
    const name = nameOf(error)
    if (name === 'VersionError') return this.mustReload()
    if (name !== undefined && LOST.has(name)) return new ConnectionLost(error)
    return workRefusal(error)
  }

  /**
   * Ask the browser to keep this site's storage through a clear-out. A
   * browser that says no, or cannot be asked, keeps it as best it can — so
   * the answer is kept for the app to show, and a failure to ask is no answer.
   */
  private async keepThrough(): Promise<boolean | undefined> {
    const manager = this.indexedDb.manager
    try {
      if (await manager?.persisted?.()) return true
      return await manager?.persist?.()
    } catch {
      return undefined
    }
  }

  /** What a transaction that ended without completing is refused as. */
  private abortRefusal(held: IDBTransaction, database: IDBDatabase, abandoned: boolean): unknown {
    const name = nameOf(held.error)
    if (name === 'QuotaExceededError') return full()
    if ((name !== undefined && LOST.has(name)) || this.closed.has(database)) return new ConnectionLost(held.error)
    // Aborted with no cause of its own and not by us: a connection closing under it.
    if (!abandoned && (held.error === null || name === 'AbortError')) return new ConnectionLost(held.error)
    return held.error ?? new Error('the transaction was abandoned')
  }

  private begin(database: IDBDatabase, shelves: readonly Shelf[], mode: 'read' | 'write'): IDBTransaction {
    try {
      return mode === 'write'
        ? database.transaction([...shelves], 'readwrite', { durability: 'strict' })
        : database.transaction([...shelves], 'readonly')
    } catch (error) {
      // A connection closing, or closed, refuses a new transaction this way.
      if (nameOf(error) === 'InvalidStateError') {
        if (this.connection) this.connection = undefined
        throw new ConnectionLost(error)
      }
      throw error
    }
  }

  private async attempt<T>(shelves: readonly Shelf[], mode: 'read' | 'write', work: (tx: Transaction) => Promise<T>): Promise<T> {
    const database = await this.opened()
    const held = this.begin(database, shelves, mode)
    let abandoned = false
    const ended = new Promise<void>((resolve, reject) => {
      held.oncomplete = () => resolve()
      held.onabort = () => reject(this.abortRefusal(held, database, abandoned))
    })
    const writes = new HeldWrites()
    const { tx, done } = this.wrap(held, mode, writes)
    let answered: T
    try {
      answered = await work(tx)
      done()
      this.write(held, writes)
    } catch (error) {
      try {
        abandoned = true
        held.abort()
      } catch {
        // Ended already, by the database's own abort: nothing of it landed either way.
      }
      const why = await ended.then(() => undefined, (cause: unknown) => cause)
      throw why instanceof ConnectionLost || why instanceof ShellError ? why : workRefusal(error)
    }
    await ended
    return answered
  }

  private range(range: KeyRange): IDBKeyRange | undefined {
    const { keyRange } = this.indexedDb
    const { from, below } = range
    if (from !== undefined && below !== undefined) return keyRange.bound(from, below, false, true)
    if (from !== undefined) return keyRange.lowerBound(from)
    if (below !== undefined) return keyRange.upperBound(below, true)
    return undefined
  }

  /** Whether a range holds no key at all, which a key range cannot be made for. */
  private static empty({ from, below }: KeyRange): boolean {
    return from !== undefined && below !== undefined && from >= below
  }

  /**
   * The work's view of a transaction: reads asked of the database and read
   * through the writes held, writes held until the work has answered, and
   * nothing at all once it has.
   */
  private wrap(held: IDBTransaction, mode: 'read' | 'write', writes: HeldWrites): { tx: Transaction; done: () => void } {
    let answered = false
    const shelf = (name: Shelf, writing = false) => {
      if (answered) throw new DOMException('the work has answered', 'TransactionInactiveError')
      const store = held.objectStore(name)
      if (writing && mode === 'read') throw new DOMException('a read transaction writes nothing', 'ReadOnlyError')
      return store
    }
    const tx: Transaction = {
      get: async <V>(name: Shelf, key: string) => writes.get(name, key, await answer(shelf(name).get(key))) as V | undefined,
      range: async <V>(name: Shelf, read: RangeRead) => {
        const store = shelf(name)
        if (IndexedDbStore.empty(read)) return []
        const reach = writes.reach(name, read)
        if (reach === 'untouched') return this.cursor<V>(store, read)
        return writes.range(name, read, await this.cursor<V>(store, { ...read, limit: reach.limit }))
      },
      put: (name, key, value) => {
        shelf(name, true)
        writes.put(name, key, value)
      },
      delete: (name, key) => {
        shelf(name, true)
        writes.delete(name, key)
      },
      deleteRange: (name, range) => {
        shelf(name, true)
        if (!IndexedDbStore.empty(range)) writes.deleteRange(name, range)
      },
    }
    return { tx, done: () => { answered = true } }
  }

  /** The writes the work made, in its order, as the transaction's last requests. */
  private write(held: IDBTransaction, writes: HeldWrites): void {
    for (const one of writes.writes) {
      const store = held.objectStore(one.shelf)
      if ('put' in one) store.put(one.value, one.put)
      else if ('delete' in one) store.delete(one.delete)
      else {
        const within = this.range(one.deleteRange)
        if (within) store.delete(within)
        else store.clear()
      }
    }
  }

  private cursor<V>(store: IDBObjectStore, read: RangeRead): Promise<Keyed<V>[]> {
    const found: Keyed<V>[] = []
    const request = store.openCursor(this.range(read), read.reverse ? 'prev' : 'next')
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result
        if (read.limit === 0 || !cursor) {
          resolve(found)
          return
        }
        found.push({ key: String(cursor.key), value: cursor.value as V })
        // Stopped at the limit rather than a key past it: a key read is a key copied out of the database.
        if (read.limit !== undefined && found.length >= read.limit) resolve(found)
        else cursor.continue()
      }
      request.onerror = () => reject(request.error ?? new Error('the database refused a range'))
    })
  }
}
