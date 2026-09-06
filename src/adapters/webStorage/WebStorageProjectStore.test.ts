import { describe, expect, it } from 'vitest'
import {
  SAMPLE_REF, describeProjectStore, projectAt, sampleProject,
} from '../../ports/ProjectStore.contract'
import type { KeyValueStorage } from './KeyValueStorage'
import {
  PROJECT_PREFIX, STORAGE_BUDGET_CHARS, WebStorageProjectStore,
} from './WebStorageProjectStore'

/**
 * Fake storage in a `Map`. No jsdom needed: the adapter asks for four lines and
 * these are them, so this suite runs in node and therefore in milliseconds.
 */
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

const keyFor = (group: string, project: string) => `${PROJECT_PREFIX}${group}/${project}`

describeProjectStore('browser storage', () => new WebStorageProjectStore(fakeStorage()))

describe('WebStorageProjectStore', () => {
  it('files a project under its ref as a path', async () => {
    const storage = fakeStorage()
    await new WebStorageProjectStore(storage).save(sampleProject())
    expect(storage.keys()).toEqual([keyFor('acme-logistics', 'landscape')])
  })

  it('uses the group path as written, so a nested group nests the key', async () => {
    const storage = fakeStorage()
    const store = new WebStorageProjectStore(storage)
    await store.save(projectAt({ group: 'acme/rail', project: 'landscape' }))
    expect(storage.keys()).toEqual([keyFor('acme/rail', 'landscape')])
  })

  it('skips half-written JSON instead of failing the whole listing', async () => {
    // One damaged record must not hide every other project the user has.
    const storage = fakeStorage({ [keyFor('acme', 'broken')]: '{"model":' })
    const store = new WebStorageProjectStore(storage)
    await store.save(sampleProject())
    expect(await store.list()).toHaveLength(1)
    await expect(store.load({ group: 'acme', project: 'broken' })).resolves.toBeUndefined()
  })

  it('skips a record that is not a project', async () => {
    const store = new WebStorageProjectStore(fakeStorage({ [keyFor('a', 'b')]: '"some text"' }))
    await expect(store.list()).resolves.toEqual([])
  })

  it('skips a record whose ref cannot be addressed again', async () => {
    const orphan = JSON.stringify({ ...sampleProject(), ref: { group: '', project: '' } })
    const store = new WebStorageProjectStore(fakeStorage({ [keyFor('a', 'b')]: orphan }))
    await expect(store.list()).resolves.toEqual([])
  })

  it('ignores keys that are not its own', async () => {
    const storage = fakeStorage({ 'lvarch.preferences': '{"language":"nl"}' })
    const store = new WebStorageProjectStore(storage)
    await store.save(sampleProject())
    expect(await store.list()).toHaveLength(1)
  })

  it('yields an empty library for a record written before marks existed', async () => {
    const old = sampleProject()
    const without = { ref: SAMPLE_REF, model: old.model, activeDiagramId: 'l7' }
    const store = new WebStorageProjectStore(fakeStorage({
      [keyFor('acme-logistics', 'landscape')]: JSON.stringify(without),
    }))
    expect((await store.load(SAMPLE_REF))?.logoLibrary).toEqual([])
  })

  it('lists alphabetically, not in the order the keys happen to enumerate', async () => {
    const store = new WebStorageProjectStore(fakeStorage())
    await store.save(projectAt({ group: 'acme', project: 'zebra' }, 'Zebra'))
    await store.save(projectAt({ group: 'acme', project: 'aardvark' }, 'Aardvark'))
    expect((await store.list()).map((s) => s.name)).toEqual(['Aardvark', 'Zebra'])
  })

  it('refuses visibly when storage will not write', async () => {
    // This is why save() returns a promise that can reject: the shell has to be
    // able to say, once, "everything works until you close this tab".
    const store = new WebStorageProjectStore(refusingStorage())
    await expect(store.save(sampleProject())).rejects.toBeInstanceOf(Error)
  })

  it('lists nothing rather than throwing when storage will not enumerate', async () => {
    await expect(new WebStorageProjectStore(refusingStorage()).list()).resolves.toEqual([])
  })

  it('does not turn a failed remove() into a fault', async () => {
    await expect(new WebStorageProjectStore(refusingStorage()).remove(SAMPLE_REF))
      .resolves.toBeUndefined()
  })

  it('does not share its prefix with the preferences key', () => {
    expect('lvarch.preferences'.startsWith(PROJECT_PREFIX)).toBe(false)
  })
})

/**
 * How full it is.
 *
 * A browser's quota is small, fixed and reached in silence — a save that simply
 * does not happen — so the store has to be able to say how close it is before
 * anybody finds out the hard way. The number is an estimate and is meant to be
 * a floor: it counts what this store holds, not what the rest of the origin does.
 */
describe('WebStorageProjectStore — how full it is', () => {
  it('counts what it holds, and nothing else on the origin', async () => {
    const storage = fakeStorage({ 'something.else': 'x'.repeat(1_000) })
    const store = new WebStorageProjectStore(storage)
    await store.save(sampleProject())

    const pressure = store.pressure()
    expect(pressure?.budget).toBe(STORAGE_BUDGET_CHARS)
    expect(pressure?.used).toBe(
      (storage.getItem(keyFor('acme-logistics', 'landscape')) ?? '').length,
    )
  })

  it('counts what was already there before this store was made', () => {
    const held = JSON.stringify(sampleProject())
    const store = new WebStorageProjectStore(
      fakeStorage({ [keyFor('acme-logistics', 'landscape')]: held }),
    )
    expect(store.pressure()?.used).toBe(held.length)
  })

  it('follows a project that grows, and one that goes', async () => {
    const store = new WebStorageProjectStore(fakeStorage())
    await store.save(sampleProject())
    const small = store.pressure()?.used ?? 0

    const wordy = sampleProject()
    wordy.model.description = 'x'.repeat(5_000)
    await store.save(wordy)
    expect(store.pressure()?.used ?? 0).toBeGreaterThan(small + 4_000)

    await store.remove(SAMPLE_REF)
    expect(store.pressure()?.used).toBe(0)
  })

  it('adds two projects together', async () => {
    const store = new WebStorageProjectStore(fakeStorage())
    await store.save(sampleProject())
    const one = store.pressure()?.used ?? 0
    await store.save(projectAt({ group: 'acme-logistics', project: 'second' }))
    expect(store.pressure()?.used ?? 0).toBeGreaterThan(one)
  })

  it('says nothing is known rather than throwing when storage will not enumerate', () => {
    expect(new WebStorageProjectStore(refusingStorage()).pressure()).toEqual({
      used: 0,
      budget: STORAGE_BUDGET_CHARS,
    })
  })
})
