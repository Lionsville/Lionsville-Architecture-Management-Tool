// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the shared repositories do beyond the suites: what a new store starts
 * with, and what a scope under a moved one keeps.
 */
import { describe, expect, it } from 'vitest'
import { contentAddressOf } from '../../model/imageName'
import type { ImageEntry } from '../../model/imageName'
import { step } from '../../ports/Repositories.contract'
import { emptyContent } from '../../projects/scopeState'
import type { ScopeId } from '../../projects/scopeState'
import { MemoryStore } from '../memory/MemoryStore'
import { repositoriesOver } from './repositoriesOver'
import type { Seed } from './source'

const addCrews = {
  type: 'element.create', element: { id: 'crews', kind: 'application', name: 'Crews', lifecycle: 'live', isManaged: true, aspects: {} },
} as const

async function picture(name: string, bytes: Uint8Array): Promise<ImageEntry> {
  return { name, mediaType: 'image/png', size: bytes.length, width: 1, height: 1, contentAddress: await contentAddressOf(bytes) }
}

describe('a new store', () => {
  it('starts with the scopes a seed brings, each arriving as an entry that says so', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const image = await picture('context.png', bytes)
    const seed: Seed = {
      subject: 'Brought over',
      scopes: [
        { address: 'acme/rail', content: { ...emptyContent('Rail'), images: [image] }, bytes: [{ contentAddress: image.contentAddress, bytes }], at: 1000 },
        { address: '', content: emptyContent('Acme Group'), bytes: [] },
      ],
    }
    let asked = 0
    const store = new MemoryStore()
    const repositories = repositoriesOver(store, { id: 'seeded', by: 'test', seed: () => Promise.resolve((asked += 1, seed)) })
    const tree = await repositories.scopes.tree()
    expect(tree.root.name).toBe('Acme Group')
    const acme = tree.root.children[0]
    expect([acme.address, acme.name]).toEqual(['acme', 'acme'])
    const rail = acme.children[0]
    expect([rail.address, rail.name]).toEqual(['acme/rail', 'Rail'])
    expect(await repositories.images.bytes(rail.id, 'context.png')).toEqual({ mediaType: 'image/png', bytes })
    const [arrived] = (await repositories.history.entries({ scopes: [rail.id] })).entries
    expect([arrived.subject, arrived.at]).toEqual(['Brought over', 1000])
    expect((await repositories.history.stateAt(rail.id, arrived.id))?.images).toEqual([image])
    // The scope made to file it under has its first entry open still, as any made scope does.
    expect((await repositories.history.entries({ scopes: [acme.id] })).entries).toEqual([])

    const again = repositoriesOver(store, { id: 'seeded', by: 'test', seed: () => Promise.resolve((asked += 1, seed)) })
    expect((await again.scopes.tree()).revision).toBe(tree.revision)
    expect(asked).toBe(1)
  })
})

describe('a scope under a moved scope', () => {
  it('keeps its identity, history, pictures and settings', async () => {
    const repositories = repositoriesOver(new MemoryStore(), { id: 'moving', by: 'test' })
    const made = async (at: string): Promise<ScopeId> => {
      const answer = await repositories.scopes.create(at, { name: at })
      if ('refused' in answer) throw new Error(answer.refused)
      return answer.id
    }
    const rail = await made('acme/rail')
    const stock = await made('acme/rail/rolling-stock')
    const bytes = new Uint8Array([4, 5])
    const put = await repositories.images.put(stock, 'wagon.png', bytes)
    if ('refused' in put) throw new Error(put.refused)
    await repositories.scopes.apply([{ scope: stock, steps: [step(addCrews), step({ type: 'image.add', image: await picture('wagon.png', bytes) })] }])
    const [entry] = await repositories.history.record({ scopes: [stock], subject: 'Before the move' })
    await repositories.settings.write({ of: 'scope', scope: stock }, { review: true })

    const moved = await repositories.scopes.move(rail, 'globex/rail')
    expect('refused' in moved).toBe(false)

    const state = await repositories.scopes.state(stock)
    expect(state?.address).toBe('globex/rail/rolling-stock')
    expect(state?.model.elements.map((one) => one.id)).toEqual(['crews'])
    expect((await repositories.history.entries({ scopes: [stock] })).entries.map((one) => one.id)).toEqual([entry.id])
    expect((await repositories.history.stateAt(stock, entry.id))?.address).toBe('acme/rail/rolling-stock')
    expect(await repositories.images.bytes(stock, 'wagon.png')).toEqual({ mediaType: 'image/png', bytes })
    expect(await repositories.settings.read({ of: 'scope', scope: stock })).toEqual({ review: true })
  })
})
