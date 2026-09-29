// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { HostModel } from '../../model/hostModel'
import { dataUrl } from '../../projects/fileText'
import type { ScopeSnapshot } from '../../projects/scope'
import { imageEntryOf } from '../folder/imageLibrary'
import { browserRepositories } from './browserRepositories'
import { EARLIER_SUBJECT } from './earlierScopes'
import type { KeyValueStorage } from './KeyValueStorage'
import { LEGACY_PROJECT_PREFIX, SCOPE_PREFIX, WebStorageScopeStore } from './WebStorageScopeStore'
import { fakeIndexedDb } from './testing/fakeIndexedDb'

function fakeStorage(): KeyValueStorage & { held: Map<string, string> } {
  const held = new Map<string, string>()
  return {
    held,
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => { held.set(key, value) },
    removeItem: (key) => { held.delete(key) },
    keys: () => [...held.keys()],
  }
}

/** The start of a PNG: its signature and a header that says 64 by 32. */
const PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 64, 0, 0, 0, 32, 8, 6, 0, 0, 0,
])

function model(name: string, description?: string): HostModel {
  return {
    name, relations: [], diagrams: [],
    elements: [{
      id: 'crews', kind: 'application', name: 'Crews', lifecycle: 'live', isManaged: true, aspects: {},
      ...(description !== undefined ? { description } : {}),
    }],
  }
}

function snapshot(path: string, held: HostModel, extra: Partial<ScopeSnapshot> = {}): ScopeSnapshot {
  return { path, model: held, activeDiagramId: '', logoLibrary: [], ...extra }
}

/** A browser that kept Acme's organisation, a scope with a picture, one under an older prefix, and one text that does not read. */
async function keptBefore(): Promise<KeyValueStorage & { held: Map<string, string> }> {
  const storage = fakeStorage()
  const store = new WebStorageScopeStore(storage)
  await store.save(snapshot('', { ...model('Acme Group'), elements: [] }))
  await store.save(snapshot('acme/rail', model('Rail', 'The crews:\n\n![Crews at work](../images/crews%20plan.png)\n'), {
    kind: 'domain', client: 'Acme',
    imageLibrary: [
      { file: 'crews plan.png', url: dataUrl('image/png', PNG) },
      { file: 'broken.png', url: 'not a data URL' },
    ],
  }))
  storage.setItem(`${LEGACY_PROJECT_PREFIX}globex`, JSON.stringify(snapshot('globex', model('Globex'))))
  storage.setItem(`${SCOPE_PREFIX}torn`, '{"model": {"na')
  return storage
}

describe('the scopes a browser kept before its repositories', () => {
  it('arrive in a new store, in the repositories’ shape, each as an entry that says so', async () => {
    const storage = await keptBefore()
    const repositories = browserRepositories(fakeIndexedDb(), storage)
    const tree = await repositories.scopes.tree()
    expect(tree.root.name).toBe('Acme Group')
    expect(tree.root.children.map((node) => node.address)).toEqual(['acme', 'globex'])
    const rail = tree.root.children[0].children[0]
    expect([rail.address, rail.name, rail.kind, rail.client]).toEqual(['acme/rail', 'Rail', 'domain', 'Acme'])

    const state = await repositories.scopes.state(rail.id)
    expect(state?.model.elements[0].description).toBe('The crews:\n\n![Crews at work](image:crews-plan.png)\n')
    const entry = await imageEntryOf('crews-plan.png', PNG)
    expect(entry.width).toBe(64)
    expect(state?.images).toEqual([entry])
    expect(await repositories.images.bytes(rail.id, 'crews-plan.png')).toEqual({ mediaType: 'image/png', bytes: PNG })

    const [arrived] = (await repositories.history.entries({ scopes: [rail.id] })).entries
    expect(arrived.subject).toBe(EARLIER_SUBJECT)
    expect((await repositories.history.stateAt(rail.id, arrived.id))?.model).toEqual(state?.model)
  })

  it('leaves the key-value storage exactly as it was', async () => {
    const storage = await keptBefore()
    const before = new Map(storage.held)
    const repositories = browserRepositories(fakeIndexedDb(), storage)
    await repositories.scopes.tree()
    expect(storage.held).toEqual(before)
  })

  it('arrive once: a scope written there after the store was made is not brought over again', async () => {
    const storage = await keptBefore()
    const indexedDb = fakeIndexedDb()
    const first = await browserRepositories(indexedDb, storage).scopes.tree()
    await new WebStorageScopeStore(storage).save(snapshot('globex/depot', model('Depot')))
    const again = await browserRepositories(indexedDb, storage).scopes.tree()
    expect(again).toEqual(first)
  })

  it('makes an organisation and nothing else where nothing was kept before', async () => {
    const repositories = browserRepositories(fakeIndexedDb(), fakeStorage())
    const tree = await repositories.scopes.tree()
    expect([tree.root.name, tree.root.children]).toEqual(['', []])
  })
})
