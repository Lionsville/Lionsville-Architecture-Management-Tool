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
})
