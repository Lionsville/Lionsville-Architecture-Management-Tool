// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { describeKeyedStore } from '../repositories/KeyedStore.contract'
import { MemoryStore } from './MemoryStore'

describeKeyedStore('memory', () => new MemoryStore())

describe('MemoryStore', () => {
  it('refuses a write in a read transaction, and lands nothing of it', async () => {
    const store = new MemoryStore()
    await expect(store.transaction(['meta'], 'read', (tx) => {
      tx.put('meta', 'a', 1)
      return Promise.resolve()
    })).rejects.toThrow()
    expect(await store.transaction(['meta'], 'read', (tx) => tx.get('meta', 'a'))).toBeUndefined()
  })

  it('refuses a request after the work awaited a digest, and lands nothing of it, as a store stricter than any browser', async () => {
    const store = new MemoryStore()
    await expect(store.transaction(['meta'], 'write', async (tx) => {
      tx.put('meta', 'b', 'before the digest')
      await tx.get('meta', 'a')
      await crypto.subtle.digest('SHA-256', new Uint8Array([1, 2, 3]))
      tx.put('meta', 'a', 1)
    })).rejects.toThrow()
    expect(await store.transaction(['meta'], 'read', async (tx) => [await tx.get('meta', 'a'), await tx.get('meta', 'b')]))
      .toEqual([undefined, undefined])
  })
})
