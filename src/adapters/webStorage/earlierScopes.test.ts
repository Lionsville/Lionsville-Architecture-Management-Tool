// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { HostModel } from '../../model/hostModel'
import { dataUrl } from '../../projects/fileText'
import type { ScopeSnapshot } from '../../projects/scope'
import { imageEntryOf } from '../folder/imageLibrary'
import { browserRepositories } from './browserRepositories'
import { AGAIN_SUBJECT, BEFORE_AGAIN_SUBJECT, EARLIER_MARKER, EARLIER_SUBJECT } from './earlierScopes'
import type { KeyValueStorage } from './KeyValueStorage'
import { LEGACY_PROJECT_PREFIX, SCOPE_PREFIX, WebStorageScopeStore } from './WebStorageScopeStore'
import { fakeIndexedDb } from './testing/fakeIndexedDb'

type Held = KeyValueStorage & { held: Map<string, string> }

function fakeStorage(): Held {
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

const save = (storage: KeyValueStorage, scope: ScopeSnapshot) => new WebStorageScopeStore(storage).save(scope)

/**
 * A browser that kept Acme's organisation, a scope with pictures — one fine,
 * one with no extension, one whose bytes do not read — one under an older
 * prefix, and one text that does not read.
 */
async function keptBefore(): Promise<Held> {
  const storage = fakeStorage()
  await save(storage, snapshot('', { ...model('Acme Group'), elements: [] }))
  await save(storage, snapshot('acme/rail', model('Rail', 'The crews:\n\n![Crews at work](../images/crews%20plan.png)\n\n![Depot](../images/depot)\n'), {
    kind: 'domain', client: 'Acme',
    imageLibrary: [
      { file: 'crews plan.png', url: dataUrl('image/png', PNG) },
      { file: 'depot', url: dataUrl('image/png', PNG) },
      { file: 'broken.png', url: 'not a data URL' },
    ],
  }))
  storage.setItem(`${LEGACY_PROJECT_PREFIX}globex`, JSON.stringify(snapshot('globex', model('Globex'))))
  storage.setItem(`${SCOPE_PREFIX}torn`, '{"model": {"na')
  return storage
}

async function subjects(repositories: ReturnType<typeof browserRepositories>['repositories'], id: string) {
  return (await repositories.history.entries({ scopes: [id] })).entries.map((entry) => entry.subject)
}

async function scopeAt(repositories: ReturnType<typeof browserRepositories>['repositories'], address: string) {
  const walk = (node: Awaited<ReturnType<typeof repositories.scopes.tree>>['root']): typeof node[] => [node, ...node.children.flatMap(walk)]
  return walk((await repositories.scopes.tree()).root).find((node) => node.address === address)
}

describe('the scopes a browser kept before its repositories', () => {
  it('arrive in a new store, in the repositories’ shape, each as an entry that says so', async () => {
    const storage = await keptBefore()
    const { repositories } = browserRepositories(fakeIndexedDb(), storage)
    const tree = await repositories.scopes.tree()
    expect(tree.root.name).toBe('Acme Group')
    expect(tree.root.children.map((node) => node.address)).toEqual(['acme', 'globex'])
    const rail = (await scopeAt(repositories, 'acme/rail'))!
    const kept = JSON.parse(storage.getItem(`${SCOPE_PREFIX}acme/rail`)!) as ScopeSnapshot
    expect([rail.name, rail.kind, rail.client, rail.updatedAt]).toEqual(['Rail', 'domain', 'Acme', kept.updatedAt])

    const state = await repositories.scopes.state(rail.id)
    expect(state?.model.elements[0].description)
      .toBe('The crews:\n\n![Crews at work](image:crews-plan.png)\n\n![Depot](image:depot.png)\n')
    expect(state?.images).toEqual([await imageEntryOf('crews-plan.png', PNG), await imageEntryOf('depot.png', PNG)])
    expect(state?.images[0].width).toBe(64)
    expect(await repositories.images.bytes(rail.id, 'depot.png')).toEqual({ mediaType: 'image/png', bytes: PNG })

    expect(await subjects(repositories, rail.id)).toEqual([EARLIER_SUBJECT])
    const [arrived] = (await repositories.history.entries({ scopes: [rail.id] })).entries
    expect((await repositories.history.stateAt(rail.id, arrived.id))?.model).toEqual(state?.model)
  })

  it('leave what would not read where it was, bring the rest, and say what was left', async () => {
    const storage = await keptBefore()
    await save(storage, snapshot('acme/road', model('Road'), { imageLibrary: 'not a library' as never }))
    await save(storage, snapshot('acme/sea', model('Sea'), { imageLibrary: [null, { file: 3 }] as never }))
    const { repositories, earlier } = browserRepositories(fakeIndexedDb(), storage)
    expect((await scopeAt(repositories, 'acme/road'))?.name).toBe('Road')
    expect((await scopeAt(repositories, 'acme/sea'))?.name).toBe('Sea')
    expect(await scopeAt(repositories, 'torn')).toBeUndefined()
    expect((await earlier!.standing()).left).toEqual([
      { path: 'acme/rail', why: 'pictures', pictures: ['broken.png'] },
      { path: 'acme/road', why: 'pictures', pictures: [''] },
      { path: 'acme/sea', why: 'pictures', pictures: ['', ''] },
      { path: 'torn', why: 'unread' },
    ])
  })

  it('write no key of the key-value storage but the marker that says a copy was made', async () => {
    const storage = await keptBefore()
    const before = new Map(storage.held)
    await browserRepositories(fakeIndexedDb(), storage).repositories.scopes.tree()
    const after = new Map(storage.held)
    expect(after.get(EARLIER_MARKER)).toBeDefined()
    after.delete(EARLIER_MARKER)
    expect(after).toEqual(before)
  })

  it('arrive again where an older page changed or added one since and nothing was done here', async () => {
    const storage = await keptBefore()
    const indexedDb = fakeIndexedDb()
    const globex = (await scopeAt(browserRepositories(indexedDb, storage).repositories, 'globex'))!

    await save(storage, snapshot('globex', model('Globex, older page')))
    await save(storage, snapshot('globex/depot', model('Depot')))
    const { repositories: again, earlier } = browserRepositories(indexedDb, storage)
    expect((await again.scopes.state(globex.id))?.model.name).toBe('Globex, older page')
    expect(await subjects(again, globex.id)).toEqual([AGAIN_SUBJECT, EARLIER_SUBJECT])
    expect(await subjects(again, (await scopeAt(again, 'globex/depot'))!.id)).toEqual([AGAIN_SUBJECT])
    expect(await subjects(again, (await scopeAt(again, 'acme/rail'))!.id)).toEqual([EARLIER_SUBJECT])
    expect((await earlier!.standing()).diverged).toEqual([])

    const tree = await again.scopes.tree()
    expect(await browserRepositories(indexedDb, storage).repositories.scopes.tree()).toEqual(tree)
  })

  describe('where work was done here since', () => {
    /** A store with the copy in it, a step applied here to Globex, and the store opened again after `meanwhile`. */
    async function divergedAfter(meanwhile: (storage: Held) => Promise<void>) {
      const storage = await keptBefore()
      const indexedDb = fakeIndexedDb()
      const { repositories } = browserRepositories(indexedDb, storage)
      const globex = (await scopeAt(repositories, 'globex'))!
      const rename = { type: 'element.update', id: 'crews', patch: { name: 'Crew planning' } } as const
      await repositories.scopes.apply([{ scope: globex.id, steps: [{ stepId: crypto.randomUUID(), at: Date.now(), command: rename }] }])
      const before = await repositories.scopes.state(globex.id)
      await meanwhile(storage)
      return { storage, indexedDb, globex, before, ...browserRepositories(indexedDb, storage) }
    }

    it('writes nothing where the older copy changed, and lists the address', async () => {
      const { repositories, earlier, globex, before } = await divergedAfter((storage) => save(storage, snapshot('globex', model('Globex, older page'))))
      expect(await repositories.scopes.state(globex.id)).toEqual(before)
      expect(await subjects(repositories, globex.id)).toEqual([EARLIER_SUBJECT])
      expect((await earlier!.standing()).diverged).toEqual(['globex'])
    })

    it('writes nothing where an older page only saved it again, and lists the address', async () => {
      const { repositories, earlier, globex, before } = await divergedAfter(async (storage) => {
        const kept = await new WebStorageScopeStore(storage).load('globex')
        await save(storage, kept!)
      })
      expect(await repositories.scopes.state(globex.id)).toEqual(before)
      expect((await earlier!.standing()).diverged).toEqual(['globex'])
    })

    it('writes nothing where the scope was moved here, and brings nothing to the address it left', async () => {
      const storage = await keptBefore()
      const indexedDb = fakeIndexedDb()
      const { repositories } = browserRepositories(indexedDb, storage)
      const globex = (await scopeAt(repositories, 'globex'))!
      await repositories.scopes.move(globex.id, 'acme/globex')
      await save(storage, snapshot('globex', model('Globex, older page')))
      const reopened = browserRepositories(indexedDb, storage)
      expect(await scopeAt(reopened.repositories, 'globex')).toBeUndefined()
      expect((await reopened.repositories.scopes.state(globex.id))?.model.name).toBe('Globex')
      expect((await reopened.earlier!.standing()).diverged).toEqual(['globex'])
    })

    it('brings the older copy over when a person says so, after an entry that keeps what was here', async () => {
      const { repositories, earlier, globex } = await divergedAfter((storage) => save(storage, snapshot('globex', model('Globex, older page'))))
      expect((await earlier!.bringOver(['globex'])).diverged).toEqual([])
      expect((await repositories.scopes.state(globex.id))?.model.name).toBe('Globex, older page')
      expect(await subjects(repositories, globex.id)).toEqual([AGAIN_SUBJECT, BEFORE_AGAIN_SUBJECT, EARLIER_SUBJECT])
      const [, safeguard] = (await repositories.history.entries({ scopes: [globex.id] })).entries
      expect((await repositories.history.stateAt(globex.id, safeguard.id))?.model.elements[0].name).toBe('Crew planning')
    })

    it('leaves what is here when a person says so, and brings a later change only where nothing was done since', async () => {
      const { storage, indexedDb, repositories, earlier, globex, before } = await divergedAfter((held) => save(held, snapshot('globex', model('Globex, older page'))))
      expect((await earlier!.leave(['globex'])).diverged).toEqual([])
      expect(await repositories.scopes.state(globex.id)).toEqual(before)

      await save(storage, snapshot('globex', model('Globex, older page again')))
      const reopened = browserRepositories(indexedDb, storage)
      expect((await reopened.repositories.scopes.state(globex.id))?.model.name).toBe('Globex, older page again')
      expect((await reopened.earlier!.standing()).diverged).toEqual([])
    })
  })

  it('are not brought into a database made anew after a copy: a person is asked, and answers', async () => {
    const storage = await keptBefore()
    await browserRepositories(fakeIndexedDb(), storage).repositories.scopes.tree()

    const lost = browserRepositories(fakeIndexedDb(), storage)
    expect((await lost.repositories.scopes.tree()).root.children).toEqual([])
    expect((await lost.earlier!.standing()).asking).toBe(true)

    await lost.earlier!.bringOver()
    expect((await lost.earlier!.standing()).asking).toBe(false)
    const rail = (await scopeAt(lost.repositories, 'acme/rail'))!
    expect(await subjects(lost.repositories, rail.id)).toEqual([AGAIN_SUBJECT])

    const leftAlone = browserRepositories(fakeIndexedDb(), storage)
    await leftAlone.repositories.scopes.tree()
    await leftAlone.earlier!.leave()
    expect((await leftAlone.earlier!.standing()).asking).toBe(false)
    expect((await leftAlone.repositories.scopes.tree()).root.children).toEqual([])
  })

  it('make an organisation and nothing else where nothing was kept before, and ask nothing later', async () => {
    const storage = fakeStorage()
    const { repositories, earlier } = browserRepositories(fakeIndexedDb(), storage)
    const tree = await repositories.scopes.tree()
    expect([tree.root.name, tree.root.children]).toEqual(['', []])
    expect(await browserRepositories(fakeIndexedDb(), storage).earlier!.standing()).toEqual({ asking: false, left: [], refused: [], diverged: [] })
    expect((await earlier!.standing()).asking).toBe(false)
  })
})
