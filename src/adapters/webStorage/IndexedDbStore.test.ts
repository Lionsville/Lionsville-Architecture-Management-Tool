// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { describeKeyedStore } from '../repositories/KeyedStore.contract'
import { IndexedDbStore } from './IndexedDbStore'
import { fakeIndexedDb } from './testing/fakeIndexedDb'

describeKeyedStore('IndexedDB', () => new IndexedDbStore(fakeIndexedDb()))

describe('IndexedDbStore', () => {
  it('fails a transaction whose work awaits something else before it writes, and lands nothing', async () => {
    const store = new IndexedDbStore(fakeIndexedDb())
    await expect(store.transaction(['meta'], 'write', async (tx) => {
      await tx.get('meta', 'a')
      await new Promise((resolve) => setTimeout(resolve, 5))
      tx.put('meta', 'a', 1)
    })).rejects.toThrow()
    expect(await store.transaction(['meta'], 'read', (tx) => tx.get('meta', 'a'))).toBeUndefined()
  })

  it('answers an empty range for a span that holds no key', async () => {
    const store = new IndexedDbStore(fakeIndexedDb())
    expect(await store.transaction(['meta'], 'read', (tx) => tx.range('meta', { from: 'b', below: 'a' }))).toEqual([])
  })

  it('keeps what one opening wrote for the next opening of the same database', async () => {
    const indexedDb = fakeIndexedDb()
    await new IndexedDbStore(indexedDb).transaction(['meta'], 'write', (tx) => {
      tx.put('meta', 'a', 1)
      return Promise.resolve()
    })
    expect(await new IndexedDbStore(indexedDb).transaction(['meta'], 'read', (tx) => tx.get('meta', 'a'))).toBe(1)
  })
})
