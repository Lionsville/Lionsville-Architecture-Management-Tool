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
 * nothing left to do, and a request made after that is refused.
 */
import { SHELVES } from '../repositories/KeyedStore'
import type { KeyRange, Keyed, KeyedStore, RangeRead, Shelf, Transaction } from '../repositories/KeyedStore'

export const DATABASE_NAME = 'lvarch.repositories'

/**
 * The version the shelves were laid out at; a later layout is a later version
 * and an upgrade, which lays out every shelf the database does not have yet.
 * 2 added the shelves that count what names each picture's bytes.
 */
export const DATABASE_VERSION = 2

/** The database's two globals, named rather than assumed, so a suite can hand in its own. */
export type IndexedDb = { factory: IDBFactory; keyRange: typeof IDBKeyRange }

/**
 * Open the database, laying out its shelves the first time. Another page that
 * holds it open at an older layout is asked to let go (`onversionchange`), and
 * this page lets go the same way when a later build asks.
 */
export function openDatabase({ factory }: IndexedDb, name = DATABASE_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      for (const shelf of SHELVES) {
        if (!database.objectStoreNames.contains(shelf)) database.createObjectStore(shelf)
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
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

export class IndexedDbStore implements KeyedStore {
  private database: Promise<IDBDatabase> | undefined

  constructor(private readonly indexedDb: IndexedDb, private readonly name = DATABASE_NAME) {}

  /** Opened on first use and kept; a failure to open is tried again on the next transaction. */
  private opened(): Promise<IDBDatabase> {
    this.database ??= openDatabase(this.indexedDb, this.name).catch((error: unknown) => {
      this.database = undefined
      throw error
    })
    return this.database
  }

  async transaction<T>(shelves: readonly Shelf[], mode: 'read' | 'write', work: (tx: Transaction) => Promise<T>): Promise<T> {
    const database = await this.opened()
    const held = database.transaction([...shelves], mode === 'write' ? 'readwrite' : 'readonly')
    const ended = new Promise<void>((resolve, reject) => {
      held.oncomplete = () => resolve()
      held.onabort = () => reject(held.error ?? new Error('the transaction was abandoned'))
    })
    let answered: T
    try {
      answered = await work(this.wrap(held))
    } catch (error) {
      try {
        held.abort()
      } catch {
        // Ended already, by the database's own abort: nothing of it landed either way.
      }
      await ended.catch(() => undefined)
      throw error
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

  private wrap(held: IDBTransaction): Transaction {
    const shelf = (name: Shelf) => held.objectStore(name)
    return {
      get: <V>(name: Shelf, key: string) => answer(shelf(name).get(key)) as Promise<V | undefined>,
      range: <V>(name: Shelf, read: RangeRead) => (
        IndexedDbStore.empty(read) ? Promise.resolve([]) : this.cursor<V>(shelf(name), read)
      ),
      put: (name, key, value) => {
        shelf(name).put(value, key)
      },
      delete: (name, key) => {
        shelf(name).delete(key)
      },
      deleteRange: (name, range) => {
        if (IndexedDbStore.empty(range)) return
        const within = this.range(range)
        if (within) shelf(name).delete(within)
        else shelf(name).clear()
      },
    }
  }

  private cursor<V>(store: IDBObjectStore, read: RangeRead): Promise<Keyed<V>[]> {
    const found: Keyed<V>[] = []
    const request = store.openCursor(this.range(read), read.reverse ? 'prev' : 'next')
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor || (read.limit !== undefined && found.length >= read.limit)) {
          resolve(found)
          return
        }
        found.push({ key: String(cursor.key), value: cursor.value as V })
        cursor.continue()
      }
      request.onerror = () => reject(request.error ?? new Error('the database refused a range'))
    })
  }
}
