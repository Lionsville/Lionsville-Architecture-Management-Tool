// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every keyed store must do for the repositories over it: the promises
 * `KeyedStore.ts` makes, one clause each. The repository suites cannot see
 * most of them — a refused apply writes nothing before it answers, so a
 * store that half-landed a failed transaction would pass them all.
 *
 * Named `.contract.ts` so the runner does not pick it up on its own.
 */
import { describe, expect, it } from 'vitest'
import { prefix } from './KeyedStore'
import type { KeyedStore, RangeRead, Transaction } from './KeyedStore'

export function describeKeyedStore(name: string, make: () => KeyedStore | Promise<KeyedStore>): void {
  describe(`KeyedStore contract — ${name}`, () => {
    it('reads back what a transaction wrote, and nothing for a key never written', async () => {
      const store = await make()
      await store.transaction(['meta'], 'write', (tx) => {
        tx.put('meta', 'a', { held: 1 })
        return Promise.resolve()
      })
      expect(await store.transaction(['meta'], 'read', async (tx) => [await tx.get('meta', 'a'), await tx.get('meta', 'b')]))
        .toEqual([{ held: 1 }, undefined])
    })

    it('lets a transaction read what it wrote before it lands', async () => {
      const store = await make()
      const read = await store.transaction(['meta'], 'write', async (tx) => {
        tx.put('meta', 'a', 1)
        tx.delete('meta', 'a')
        tx.put('meta', 'b', 2)
        return [await tx.get('meta', 'a'), await tx.get('meta', 'b')]
      })
      expect(read).toEqual([undefined, 2])
    })

    it('lands nothing of a transaction whose work throws', async () => {
      const store = await make()
      await store.transaction(['meta', 'scopes'], 'write', (tx) => {
        tx.put('meta', 'kept', 1)
        return Promise.resolve()
      })
      await expect(store.transaction(['meta', 'scopes'], 'write', async (tx) => {
        tx.put('meta', 'kept', 2)
        tx.put('scopes', 'half', 1)
        await tx.get('meta', 'kept')
        throw new Error('the page went away')
      })).rejects.toThrow('the page went away')
      expect(await store.transaction(['meta', 'scopes'], 'read', async (tx) => [await tx.get('meta', 'kept'), await tx.get('scopes', 'half')]))
        .toEqual([1, undefined])
    })

    it('runs two writing transactions one after the other, never between each other’s awaits', async () => {
      const store = await make()
      const count = async (tx: Transaction) => {
        const held = (await tx.get<number>('meta', 'count')) ?? 0
        await tx.get('meta', 'something else')
        tx.put('meta', 'count', held + 1)
      }
      await Promise.all([1, 2, 3].map(() => store.transaction(['meta'], 'write', count)))
      expect(await store.transaction(['meta'], 'read', (tx) => tx.get('meta', 'count'))).toBe(3)
    })

    it('answers a range in key order, or reversed, as far as a limit', async () => {
      const store = await make()
      await store.transaction(['entries'], 'write', (tx) => {
        for (const key of ['a\u0000002', 'a\u0000001', 'a\u0000003', 'b\u0000001', 'a']) tx.put('entries', key, key)
        return Promise.resolve()
      })
      const keys = (read: RangeRead) =>
        store.transaction(['entries'], 'read', async (tx) => (await tx.range<string>('entries', read)).map(({ key }) => key))
      expect(await keys(prefix('a\u0000'))).toEqual(['a\u0000001', 'a\u0000002', 'a\u0000003'])
      expect(await keys({ ...prefix('a\u0000'), reverse: true, limit: 2 })).toEqual(['a\u0000003', 'a\u0000002'])
      expect(await keys({ from: 'a\u0000', below: 'a\u0000003' })).toEqual(['a\u0000001', 'a\u0000002'])
      expect(await keys({ below: 'a\u0000' })).toEqual(['a'])
    })

    it('takes a range out', async () => {
      const store = await make()
      await store.transaction(['library'], 'write', (tx) => {
        for (const key of ['s\u0000a.png', 's\u0000b.png', 't\u0000a.png']) tx.put('library', key, key)
        return Promise.resolve()
      })
      await store.transaction(['library'], 'write', (tx) => {
        tx.deleteRange('library', prefix('s\u0000'))
        return Promise.resolve()
      })
      expect(await store.transaction(['library'], 'read', async (tx) => (await tx.range('library', {})).map(({ key }) => key)))
        .toEqual(['t\u0000a.png'])
    })

    it('hands out copies: changing a value read or written changes nothing kept', async () => {
      const store = await make()
      const written = { list: [1], bytes: new Uint8Array([1, 2]) }
      await store.transaction(['meta'], 'write', (tx) => {
        tx.put('meta', 'a', written)
        return Promise.resolve()
      })
      written.list.push(2)
      const read = await store.transaction(['meta'], 'read', (tx) => tx.get<typeof written>('meta', 'a'))
      read!.bytes[0] = 9
      expect(await store.transaction(['meta'], 'read', (tx) => tx.get('meta', 'a')))
        .toEqual({ list: [1], bytes: new Uint8Array([1, 2]) })
    })
  })
}
