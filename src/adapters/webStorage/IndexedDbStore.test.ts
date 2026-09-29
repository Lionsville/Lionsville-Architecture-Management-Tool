// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import { ShellError } from '../../platform/errors'
import { describeKeyedStore } from '../repositories/KeyedStore.contract'
import type { Transaction } from '../repositories/KeyedStore'
import { DATABASE_NAME, DATABASE_VERSION, IndexedDbStore } from './IndexedDbStore'
import type { IndexedDb, Standing, StorageManagerLike } from './IndexedDbStore'
import { controlledFakeIndexedDb, fakeIndexedDb } from './testing/fakeIndexedDb'

/** A fresh IndexedDB of `fake-indexeddb`'s, which keeps versions, blocking and closing as a browser does. */
function fullFake(manager?: StorageManagerLike): IndexedDb {
  return { factory: new IDBFactory(), keyRange: IDBKeyRange, ...(manager ? { manager } : {}) }
}

// The contract runs over the hand-written fake here and over real browsers in
// `IndexedDbStore.browser.test.ts`. Not over fake-indexeddb: it keeps a
// transaction active until its next task finds nothing asked of it, so work
// that awaits a digest in between is not refused there as a browser refuses it.
describeKeyedStore('IndexedDB, the hand-written fake', () => new IndexedDbStore(fakeIndexedDb()))

const write = (value: unknown) => (tx: Transaction) => {
  tx.put('meta', 'a', value)
  return Promise.resolve()
}
const read = (tx: Transaction) => tx.get('meta', 'a')

/** What a promise was refused with. */
async function refused(answer: Promise<unknown>): Promise<unknown> {
  return answer.then(() => undefined, (error: unknown) => error)
}

function keyOf(error: unknown): string | undefined {
  return error instanceof ShellError ? error.key : undefined
}

describe('IndexedDbStore', () => {
  it('fails a transaction whose work awaits a digest, and lands nothing of it, the writes before the digest included', async () => {
    const store = new IndexedDbStore(fakeIndexedDb())
    await expect(store.transaction(['meta'], 'write', async (tx) => {
      tx.put('meta', 'b', 'before the digest')
      await tx.get('meta', 'a')
      await crypto.subtle.digest('SHA-256', new Uint8Array([1]))
      tx.put('meta', 'a', 1)
    })).rejects.toThrow()
    expect(await store.transaction(['meta'], 'read', async (tx) => [await tx.get('meta', 'a'), await tx.get('meta', 'b')]))
      .toEqual([undefined, undefined])
  })

  it('refuses a request made once the work has answered, rather than dropping it', async () => {
    const store = new IndexedDbStore(fakeIndexedDb())
    let kept: Transaction | undefined
    await store.transaction(['meta'], 'write', (tx) => {
      kept = tx
      tx.put('meta', 'a', 1)
      return Promise.resolve()
    })
    expect(() => kept!.put('meta', 'a', 2)).toThrow()
    await expect(kept!.get('meta', 'a')).rejects.toThrow()
    expect(await store.transaction(['meta'], 'read', read)).toBe(1)
  })

  it('answers an empty range for a span that holds no key', async () => {
    const store = new IndexedDbStore(fakeIndexedDb())
    expect(await store.transaction(['meta'], 'read', (tx) => tx.range('meta', { from: 'b', below: 'a' }))).toEqual([])
  })

  it('keeps what one opening wrote for the next opening of the same database', async () => {
    const indexedDb = fakeIndexedDb()
    await new IndexedDbStore(indexedDb).transaction(['meta'], 'write', write(1))
    expect(await new IndexedDbStore(indexedDb).transaction(['meta'], 'read', read)).toBe(1)
  })
})

describe('IndexedDbStore, when the connection goes', () => {
  it('opens again and runs the work once more when a transaction is refused as it starts', async () => {
    const { indexedDb, controls } = controlledFakeIndexedDb()
    const store = new IndexedDbStore(indexedDb)
    await store.transaction(['meta'], 'write', write(1))
    controls.fail({ at: 'transaction', name: 'InvalidStateError' })
    await store.transaction(['meta'], 'write', write(2))
    expect(await store.transaction(['meta'], 'read', read)).toBe(2)
    expect(store.standing()).toBe('open')
  })

  it('runs the work once more when the transaction aborts as the connection is lost, and lands it once', async () => {
    const { indexedDb, controls } = controlledFakeIndexedDb()
    const store = new IndexedDbStore(indexedDb)
    await store.transaction(['meta'], 'write', write(0))
    controls.fail({ at: 'commit', name: 'UnknownError' })
    let runs = 0
    await store.transaction(['meta'], 'write', async (tx) => {
      runs += 1
      tx.put('meta', 'a', ((await tx.get<number>('meta', 'a')) ?? 0) + 1)
    })
    expect(runs).toBe(2)
    expect(await store.transaction(['meta'], 'read', read)).toBe(1)
  })

  it('forgets a connection the browser closed, and opens another', async () => {
    const { indexedDb, controls } = controlledFakeIndexedDb()
    const store = new IndexedDbStore(indexedDb)
    await store.transaction(['meta'], 'write', write(1))
    controls.closeUnderPage()
    await store.transaction(['meta'], 'write', write(2))
    expect(await store.transaction(['meta'], 'read', read)).toBe(2)
  })

  it('stands reload after a second loss in a row, is refused so, and stays so without asking the database', async () => {
    const { indexedDb, controls } = controlledFakeIndexedDb()
    const store = new IndexedDbStore(indexedDb)
    const told: Standing[] = []
    store.onStanding((standing) => told.push(standing))
    await store.transaction(['meta'], 'write', write(1))
    controls.fail({ at: 'commit', name: 'UnknownError' })
    controls.fail({ at: 'commit', name: 'UnknownError' })
    expect(keyOf(await refused(store.transaction(['meta'], 'write', write(2))))).toBe('shell.storageReload')
    expect(store.standing()).toBe('reload')
    expect(told).toEqual(['reload'])
    const committed = controls.committed()
    expect(keyOf(await refused(store.transaction(['meta'], 'read', read)))).toBe('shell.storageReload')
    expect(controls.committed()).toBe(committed)
  })

  it('does not run the work again when the work itself failed', async () => {
    const store = new IndexedDbStore(fakeIndexedDb())
    let runs = 0
    await expect(store.transaction(['meta'], 'write', () => {
      runs += 1
      return Promise.reject(new Error('the work said no'))
    })).rejects.toThrow('the work said no')
    expect(runs).toBe(1)
  })
})

describe('IndexedDbStore, when the browser has no room', () => {
  it('refuses the write as full, never as the raw exception, and lands nothing of it', async () => {
    const { indexedDb, controls } = controlledFakeIndexedDb()
    const store = new IndexedDbStore(indexedDb)
    await store.transaction(['meta'], 'write', write(1))
    controls.fail({ at: 'commit', name: 'QuotaExceededError' })
    const error = await refused(store.transaction(['meta', 'scopes'], 'write', (tx) => {
      tx.put('meta', 'a', 2)
      tx.put('scopes', 'b', 2)
      return Promise.resolve()
    }))
    expect(keyOf(error)).toBe('shell.storageFull')
    expect(await store.transaction(['meta', 'scopes'], 'read', async (tx) => [await tx.get('meta', 'a'), await tx.get('scopes', 'b')]))
      .toEqual([1, undefined])
    expect(store.standing()).toBe('open')
  })

  it('refuses as full where the work’s own request met the quota', async () => {
    const quota = new DOMException('no room', 'QuotaExceededError')
    const store = new IndexedDbStore(fakeIndexedDb())
    expect(keyOf(await refused(store.transaction(['meta'], 'write', () => Promise.reject(quota))))).toBe('shell.storageFull')
  })
})

describe('IndexedDbStore, beside another tab', () => {
  /** A connection of another tab's, at a layout of its own, that lets go only when told. */
  function otherTab(indexedDb: IndexedDb, version: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDb.factory.open(DATABASE_NAME, version)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('meta')) request.result.createObjectStore('meta')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('would not open'))
    })
  }

  it('stands reload once a later build asks for the database, and refuses every transaction after', async () => {
    const indexedDb = fullFake()
    const store = new IndexedDbStore(indexedDb)
    await store.transaction(['meta'], 'write', write(1))
    const later = await otherTab(indexedDb, DATABASE_VERSION + 1)
    expect(store.standing()).toBe('reload')
    expect(keyOf(await refused(store.transaction(['meta'], 'read', read)))).toBe('shell.storageReload')
    later.close()
  })

  it('stands blocked while an older tab holds the database open, and open once it lets go', async () => {
    const indexedDb = fullFake()
    const older = await otherTab(indexedDb, 1)
    const store = new IndexedDbStore(indexedDb)
    const told: Standing[] = []
    store.onStanding((standing) => told.push(standing))
    const writing = store.transaction(['meta'], 'write', write(1))
    await vi.waitFor(() => expect(store.standing()).toBe('blocked'))
    older.close()
    await writing
    expect(told).toEqual(['blocked', 'open'])
    expect(await store.transaction(['meta'], 'read', read)).toBe(1)
  })

  it('stands reload where the database is at a later layout already', async () => {
    const indexedDb = fullFake()
    ;(await otherTab(indexedDb, DATABASE_VERSION + 1)).close()
    const store = new IndexedDbStore(indexedDb)
    expect(keyOf(await refused(store.transaction(['meta'], 'read', read)))).toBe('shell.storageReload')
    expect(store.standing()).toBe('reload')
  })
})

describe('IndexedDbStore, kept and measured', () => {
  function manager(kept: boolean, granted: boolean) {
    const asked = { persist: 0 }
    const held: StorageManagerLike = {
      persisted: () => Promise.resolve(kept),
      persist: () => {
        asked.persist += 1
        return Promise.resolve(granted)
      },
      estimate: () => Promise.resolve({ usage: 400, quota: 1000 }),
    }
    return { held, asked }
  }

  it('asks the browser once, after the first open, to keep this site’s storage', async () => {
    const { held, asked } = manager(false, true)
    const store = new IndexedDbStore(fullFake(held))
    expect(await store.persisted()).toBeUndefined()
    await store.transaction(['meta'], 'write', write(1))
    await store.transaction(['meta'], 'write', write(2))
    expect(await store.persisted()).toBe(true)
    expect(asked.persist).toBe(1)
  })

  it('does not ask where the storage is kept already, and says a refusal as it was', async () => {
    const kept = manager(true, false)
    const keptStore = new IndexedDbStore(fullFake(kept.held))
    await keptStore.transaction(['meta'], 'read', read)
    expect(await keptStore.persisted()).toBe(true)
    expect(kept.asked.persist).toBe(0)
    const refusedToKeep = manager(false, false)
    const store = new IndexedDbStore(fullFake(refusedToKeep.held))
    await store.transaction(['meta'], 'read', read)
    expect(await store.persisted()).toBe(false)
  })

  it('answers how full the storage is from the browser’s estimate, and nothing where it has none', async () => {
    expect(await new IndexedDbStore(fullFake(manager(true, true).held)).pressure()).toEqual({ used: 400, budget: 1000 })
    expect(await new IndexedDbStore(fullFake()).pressure()).toBeUndefined()
    const failing: StorageManagerLike = { estimate: () => Promise.reject(new Error('no')) }
    expect(await new IndexedDbStore(fullFake(failing)).pressure()).toBeUndefined()
  })
})
