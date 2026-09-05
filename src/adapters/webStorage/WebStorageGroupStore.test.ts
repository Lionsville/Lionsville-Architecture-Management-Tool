import { describe, expect, it } from 'vitest'
import { describeGroupStore, sampleProfile } from '../../ports/GroupStore.contract'
import type { KeyValueStorage } from './KeyValueStorage'
import { GROUP_PREFIX, WebStorageGroupStore } from './WebStorageGroupStore'

/** Fake storage in a `Map` — four lines is all the adapter asks for. */
function fakeStorage(seed: Record<string, string> = {}): KeyValueStorage {
  const held = new Map(Object.entries(seed))
  return {
    getItem: (k) => held.get(k) ?? null,
    setItem: (k, v) => { held.set(k, v) },
    removeItem: (k) => { held.delete(k) },
    keys: () => [...held.keys()],
  }
}

/** Storage that refuses — full, private mode, strict policy. */
function refusingStorage(): KeyValueStorage {
  return {
    getItem: () => null,
    setItem: () => { throw new DOMException('full', 'QuotaExceededError') },
    removeItem: () => { throw new DOMException('no', 'SecurityError') },
    keys: () => { throw new DOMException('no', 'SecurityError') },
  }
}

describeGroupStore('browser storage', () => new WebStorageGroupStore(fakeStorage()))

describe('WebStorageGroupStore', () => {
  it('keys a record by its group path under the group prefix', async () => {
    const storage = fakeStorage()
    await new WebStorageGroupStore(storage).save(sampleProfile({ group: 'acme/rail' }))
    expect(storage.keys()).toEqual([`${GROUP_PREFIX}acme/rail`])
  })

  it('leaves other keys in the same storage alone', async () => {
    const storage = fakeStorage({ 'lvarch.project.acme/landscape': '{}', 'unrelated': 'x' })
    const store = new WebStorageGroupStore(storage)
    await store.save(sampleProfile())
    expect(await store.list()).toHaveLength(1)
    expect(storage.getItem('lvarch.project.acme/landscape')).toBe('{}')
  })

  /**
   * A description nobody can parse is not a reason to hide the group it belongs
   * to, nor the groups beside it.
   */
  it('skips an unreadable record instead of failing the whole listing', async () => {
    const storage = fakeStorage({
      [`${GROUP_PREFIX}broken`]: '{ not json',
      [`${GROUP_PREFIX}wrong-shape`]: JSON.stringify({ name: 'no group' }),
      [`${GROUP_PREFIX}escaping`]: JSON.stringify({ group: '../x', name: 'Escaping' }),
    })
    const store = new WebStorageGroupStore(storage)
    await store.save(sampleProfile())
    expect((await store.list()).map((p) => p.group)).toEqual(['acme-logistics'])
  })

  it('reports a write it could not make, and stays quiet about the rest', async () => {
    const store = new WebStorageGroupStore(refusingStorage())
    await expect(store.save(sampleProfile())).rejects.toThrow()
    expect(await store.list()).toEqual([])
    await expect(store.remove('acme-logistics')).resolves.toBeUndefined()
  })
})
