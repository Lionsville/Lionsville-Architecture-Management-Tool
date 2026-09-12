import { describe, expect, it } from 'vitest'
import {
  SAMPLE_PATH, describeScopeStore, scopeAt, sampleScope,
} from '../../ports/ScopeStore.contract'
import { flattenScopes } from '../../projects/scope'
import type { KeyValueStorage } from './KeyValueStorage'
import {
  LEGACY_PROJECT_PREFIX, SCOPE_PREFIX, STORAGE_BUDGET_CHARS, WebStorageScopeStore,
} from './WebStorageScopeStore'

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

const keyFor = (group: string, project: string) => `${SCOPE_PREFIX}${group}/${project}`

/** Every path in the listing but the root, so a tree reads as a flat set. */
const listed = async (store: WebStorageScopeStore) =>
  flattenScopes(await store.list()).filter((s) => s.path !== '').map((s) => s.path)

describeScopeStore('browser storage', () => new WebStorageScopeStore(fakeStorage()))

describe('WebStorageScopeStore', () => {
  it('files a scope under its path', async () => {
    const storage = fakeStorage()
    await new WebStorageScopeStore(storage).save(sampleScope())
    expect(storage.keys()).toEqual([keyFor('acme-logistics', 'landscape')])
  })

  it('uses the path as written, so a nested scope nests the key', async () => {
    const storage = fakeStorage()
    const store = new WebStorageScopeStore(storage)
    await store.save(scopeAt('acme/rail/landscape'))
    expect(storage.keys()).toEqual([keyFor('acme/rail', 'landscape')])
  })

  /** The root is the tab's whole working tree, so its key is the bare prefix. */
  it('files the root under the prefix alone', async () => {
    const storage = fakeStorage()
    await new WebStorageScopeStore(storage).save({ ...sampleScope(), path: '' })
    expect(storage.keys()).toEqual([SCOPE_PREFIX])
  })

  it('skips half-written JSON instead of failing the whole listing', async () => {
    // One damaged record must not hide every other project the user has.
    const storage = fakeStorage({ [keyFor('acme', 'broken')]: '{"model":' })
    const store = new WebStorageScopeStore(storage)
    await store.save(sampleScope())
    expect(await listed(store)).toEqual([SAMPLE_PATH])
    await expect(store.load('acme/broken')).resolves.toBeUndefined()
  })

  it('skips a record that is not a scope', async () => {
    const store = new WebStorageScopeStore(fakeStorage({ [keyFor('a', 'b')]: '"some text"' }))
    expect(await listed(store)).toEqual([])
  })

  it('skips a record whose path cannot be addressed again', async () => {
    const orphan = JSON.stringify({ ...sampleScope(), path: '../escape' })
    const store = new WebStorageScopeStore(fakeStorage({ [keyFor('a', 'b')]: orphan }))
    expect(await listed(store)).toEqual([])
  })

  it('ignores keys that are not its own', async () => {
    const storage = fakeStorage({ 'lvarch.preferences': '{"language":"nl"}' })
    const store = new WebStorageScopeStore(storage)
    await store.save(sampleScope())
    expect(await listed(store)).toEqual([SAMPLE_PATH])
  })

  it('yields an empty library for a record written before marks existed', async () => {
    const old = sampleScope()
    const without = { path: SAMPLE_PATH, model: old.model, activeDiagramId: 'l7' }
    const store = new WebStorageScopeStore(fakeStorage({
      [keyFor('acme-logistics', 'landscape')]: JSON.stringify(without),
    }))
    expect((await store.load(SAMPLE_PATH))?.logoLibrary).toEqual([])
  })

  it('lists alphabetically, not in the order the keys happen to enumerate', async () => {
    const store = new WebStorageScopeStore(fakeStorage())
    await store.save(scopeAt('acme/zebra', 'Zebra'))
    await store.save(scopeAt('acme/aardvark', 'Aardvark'))
    expect(flattenScopes(await store.list()).map((s) => s.name))
      .toEqual(['', 'Aardvark', 'Zebra'])
  })

  it('refuses visibly when storage will not write', async () => {
    // This is why save() returns a promise that can reject: the shell has to be
    // able to say, once, "everything works until you close this tab".
    const store = new WebStorageScopeStore(refusingStorage())
    await expect(store.save(sampleScope())).rejects.toBeInstanceOf(Error)
  })

  it('lists nothing rather than throwing when storage will not enumerate', async () => {
    expect(await listed(new WebStorageScopeStore(refusingStorage()))).toEqual([])
  })

  it('does not turn a failed remove() into a fault', async () => {
    await expect(new WebStorageScopeStore(refusingStorage()).remove(SAMPLE_PATH))
      .resolves.toBeUndefined()
  })

  it('does not share its prefix with the preferences key', () => {
    expect('lvarch.preferences'.startsWith(SCOPE_PREFIX)).toBe(false)
  })

  /** A child left behind by a removed parent is addressed by nothing. */
  it('removes what is filed under the scope it removes', async () => {
    const store = new WebStorageScopeStore(fakeStorage())
    await store.save(scopeAt('acme'))
    await store.save(scopeAt('acme/rail'))
    await store.remove('acme')
    expect(await listed(store)).toEqual([])
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
/**
 * A record written before ADR-0012 said the model this way.
 *
 * There is no version on a key here, so the store answers both questions off
 * the model itself: whether it is old, and — on every read — what it says now.
 */
describe('WebStorageScopeStore — a record from before format 4', () => {
  const beforeAdr0012 = JSON.stringify({
    path: 'acme/old',
    activeDiagramId: 'l7',
    logoLibrary: [],
    model: {
      name: 'Landscape',
      connections: [{ id: 'c-1', sourceId: 'portal', targetId: 'wms', isBidirectional: false }],
      elements: [
        { id: 'portal', kind: 'inputChannel', name: 'Portal' },
        { id: 'wms', kind: 'application', name: 'WMS' },
      ],
      diagrams: [{
        id: 'l7',
        kind: 'layer7',
        name: 'Landschap',
        placements: [{ elementId: 'portal', zone: 'inputChannels', x: 1, y: 2 }],
      }],
    },
  })

  it('names it as one to upgrade, and stops once it has been written back', async () => {
    const storage = fakeStorage({ [keyFor('acme', 'old')]: beforeAdr0012 })
    const store = new WebStorageScopeStore(storage)

    expect(await store.outdated()).toEqual(['acme/old'])
    await store.save((await store.load('acme/old'))!)
    expect(await store.outdated()).toEqual([])
  })

  it('reads it as the model says it now, whether or not it has been written back', async () => {
    const store = new WebStorageScopeStore(fakeStorage({ [keyFor('acme', 'old')]: beforeAdr0012 }))
    const held = await store.load('acme/old')

    expect(held?.model.relations).toEqual([
      { id: 'c-1', type: 'flow', sourceId: 'portal', targetId: 'wms', isBidirectional: false },
    ])
    expect(held?.model.elements[0]).toMatchObject({ kind: 'application' })
    expect(held?.model.diagrams[0].members).toEqual([{ id: 'portal', zone: 'inputChannels' }])
    expect(held?.model.diagrams[0].geometry.nodes).toEqual([{ id: 'portal', x: 1, y: 2 }])
  })
})

describe('WebStorageScopeStore — how full it is', () => {
  it('counts what it holds, and nothing else on the origin', async () => {
    const storage = fakeStorage({ 'something.else': 'x'.repeat(1_000) })
    const store = new WebStorageScopeStore(storage)
    await store.save(sampleScope())

    const pressure = store.pressure()
    expect(pressure?.budget).toBe(STORAGE_BUDGET_CHARS)
    expect(pressure?.used).toBe(
      (storage.getItem(keyFor('acme-logistics', 'landscape')) ?? '').length,
    )
  })

  it('counts what was already there before this store was made', () => {
    const held = JSON.stringify(sampleScope())
    const store = new WebStorageScopeStore(
      fakeStorage({ [keyFor('acme-logistics', 'landscape')]: held }),
    )
    expect(store.pressure()?.used).toBe(held.length)
  })

  it('follows a scope that grows, and one that goes', async () => {
    const store = new WebStorageScopeStore(fakeStorage())
    await store.save(sampleScope())
    const small = store.pressure()?.used ?? 0

    const wordy = sampleScope()
    wordy.model.description = 'x'.repeat(5_000)
    await store.save(wordy)
    expect(store.pressure()?.used ?? 0).toBeGreaterThan(small + 4_000)

    await store.remove(SAMPLE_PATH)
    expect(store.pressure()?.used).toBe(0)
  })

  it('adds two scopes together', async () => {
    const store = new WebStorageScopeStore(fakeStorage())
    await store.save(sampleScope())
    const one = store.pressure()?.used ?? 0
    await store.save(scopeAt('acme-logistics/second'))
    expect(store.pressure()?.used ?? 0).toBeGreaterThan(one)
  })

  it('says nothing is known rather than throwing when storage will not enumerate', () => {
    expect(new WebStorageScopeStore(refusingStorage()).pressure()).toEqual({
      used: 0,
      budget: STORAGE_BUDGET_CHARS,
    })
  })
})

/**
 * A tab that has records from before scopes.
 *
 * There is no header in a key, only a name: the move is the prefix, and it
 * happens on the same `outdated` / `load` / `save` the folder goes through.
 */
describe('WebStorageScopeStore — keys from before scopes', () => {
  const legacyKey = `${LEGACY_PROJECT_PREFIX}acme/landscape`
  const stored = () => JSON.stringify({ ...sampleScope(), path: 'acme/landscape' })

  it('names an old key as one to move, and stops once it has been written back', async () => {
    const storage = fakeStorage({ [legacyKey]: stored() })
    const store = new WebStorageScopeStore(storage)

    expect(await store.outdated()).toEqual(['acme/landscape'])
    await store.save((await store.load('acme/landscape'))!)
    expect(await store.outdated()).toEqual([])
  })

  it('reads it before the move, and files it under the new prefix after', async () => {
    const storage = fakeStorage({ [legacyKey]: stored() })
    const store = new WebStorageScopeStore(storage)

    expect((await store.load('acme/landscape'))?.model.name).toBe('Application landscape')
    await store.save((await store.load('acme/landscape'))!)

    expect(storage.keys()).toEqual([`${SCOPE_PREFIX}acme/landscape`])
    expect((await store.load('acme/landscape'))?.model.name).toBe('Application landscape')
  })

  it('lists it, so a tab that has not been through the pass still shows the work', async () => {
    const store = new WebStorageScopeStore(fakeStorage({ [legacyKey]: stored() }))
    expect(await listed(store)).toEqual(['acme/landscape'])
  })

  it('takes the old key away when the scope is removed', async () => {
    const storage = fakeStorage({ [legacyKey]: stored() })
    await new WebStorageScopeStore(storage).remove('acme/landscape')
    expect(storage.keys()).toEqual([])
  })
})
