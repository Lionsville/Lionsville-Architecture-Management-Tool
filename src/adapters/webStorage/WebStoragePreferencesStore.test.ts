import { describe, expect, it } from 'vitest'
import type { KeyValueStorage } from './KeyValueStorage'
import { PREFERENCES_KEY, WebStoragePreferencesStore } from './WebStoragePreferencesStore'

function fakeStorage(seed: Record<string, string> = {}): KeyValueStorage {
  const held = new Map(Object.entries(seed))
  return {
    getItem: (k) => held.get(k) ?? null,
    setItem: (k, v) => { held.set(k, v) },
    removeItem: (k) => { held.delete(k) },
    keys: () => [...held.keys()],
  }
}

describe('WebStoragePreferencesStore', () => {
  it('returns undefined while nothing is stored', async () => {
    await expect(new WebStoragePreferencesStore(fakeStorage()).read()).resolves.toBeUndefined()
  })

  it('gives back what was written', async () => {
    const store = new WebStoragePreferencesStore(fakeStorage())
    await store.write({ language: 'nl', themeMode: 'dark', minimap: true })
    expect(await store.read()).toEqual({ language: 'nl', themeMode: 'dark', minimap: true })
  })

  it('ignores half-written JSON', async () => {
    const store = new WebStoragePreferencesStore(fakeStorage({ [PREFERENCES_KEY]: '{no' }))
    await expect(store.read()).resolves.toBeUndefined()
  })

  it('ignores a stored value that is not an object', async () => {
    const store = new WebStoragePreferencesStore(fakeStorage({ [PREFERENCES_KEY]: '42' }))
    await expect(store.read()).resolves.toBeUndefined()
  })

  it('carries fields it does not recognise straight through', async () => {
    // The package vets its own part; this layer must not prune, or an older
    // shell loses a newer one's settings.
    const store = new WebStoragePreferencesStore(fakeStorage())
    await store.write({ language: 'en', somethingNew: { deep: true } })
    expect(await store.read()).toEqual({ language: 'en', somethingNew: { deep: true } })
  })

  it('refuses visibly when storage is full', async () => {
    const store = new WebStoragePreferencesStore({
      getItem: () => null,
      setItem: () => { throw new Error('full') },
      removeItem: () => {},
      keys: () => [],
    })
    await expect(store.write({ language: 'nl' })).rejects.toBeInstanceOf(Error)
  })

  it('sits under a different key from the project', () => {
    expect(PREFERENCES_KEY).toBe('lvarch.preferences')
  })
})
