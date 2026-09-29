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
import { repositoriesOn, repositoriesOver } from './repositoriesOver'
import type { Brought } from './bring'
import { SHELVES } from './KeyedStore'
import { Source } from './source'

const addCrews = {
  type: 'element.create', element: { id: 'crews', kind: 'application', name: 'Crews', lifecycle: 'live', isManaged: true, aspects: {} },
} as const

async function picture(name: string, bytes: Uint8Array): Promise<ImageEntry> {
  return { name, mediaType: 'image/png', size: bytes.length, width: 1, height: 1, contentAddress: await contentAddressOf(bytes) }
}

/** A bringing that brings what it is handed at each start, and remembers the notes it was given. */
function bringing(...starts: (Brought | undefined)[]) {
  const notes: unknown[] = []
  const fresh: boolean[] = []
  return {
    notes, fresh,
    bring: {
      prepare: (note: unknown, isFresh: boolean) => {
        notes.push(note)
        fresh.push(isFresh)
        return Promise.resolve(starts.shift())
      },
    },
  }
}

describe('work brought from somewhere else', () => {
  it('lands in a new store, each scope arriving as an entry that says so, keeping when it was last changed', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const image = await picture('context.png', bytes)
    const brought: Brought = {
      subject: 'Brought over', safeguard: 'Before', note: { first: true },
      scopes: [
        {
          address: 'acme/rail', content: { ...emptyContent('Rail'), model: { ...emptyContent('Rail').model, elements: [addCrews.element] }, images: [image] },
          bytes: [{ contentAddress: image.contentAddress, bytes }], updatedAt: '2026-09-01T10:00:00.000Z',
        },
        { address: '', content: emptyContent('Acme Group'), bytes: [] },
      ],
    }
    const store = new MemoryStore()
    const first = bringing(brought)
    const repositories = repositoriesOver(store, { id: 'brought', by: 'test', ...first })
    const tree = await repositories.scopes.tree()
    expect(first.fresh).toEqual([true])
    expect(tree.root.name).toBe('Acme Group')
    expect((await repositories.history.entries({ scopes: [tree.root.id] })).entries.map((one) => one.subject)).toEqual(['Brought over'])
    const acme = tree.root.children[0]
    expect([acme.address, acme.name]).toEqual(['acme', 'acme'])
    const rail = acme.children[0]
    expect([rail.address, rail.name, rail.updatedAt]).toEqual(['acme/rail', 'Rail', '2026-09-01T10:00:00.000Z'])
    expect(await repositories.images.bytes(rail.id, 'context.png')).toEqual({ mediaType: 'image/png', bytes })
    const [arrived] = (await repositories.history.entries({ scopes: [rail.id], record: { kind: 'element', id: 'crews' } })).entries
    expect([arrived.subject, arrived.at]).toEqual(['Brought over', Date.parse('2026-09-01T10:00:00.000Z')])
    expect((await repositories.history.stateAt(rail.id, arrived.id))?.images).toEqual([image])
    // The scope made to file it under has its first entry open still, as any made scope does.
    expect((await repositories.history.entries({ scopes: [acme.id] })).entries).toEqual([])

    const second = bringing(undefined)
    const again = repositoriesOver(store, { id: 'brought', by: 'test', ...second })
    expect((await again.scopes.tree()).revision).toBe(tree.revision)
    expect([second.notes, second.fresh]).toEqual([[{ first: true }], [false]])
  })

  it('writes nothing over work done here, and lists the address; lands where nothing was done since', async () => {
    const store = new MemoryStore()
    const arrival = (name: string, note: number): Brought => ({
      subject: 'Brought', safeguard: 'Before', note, scopes: [{ address: 'acme', content: emptyContent(name), bytes: [] }],
    })
    const source = (brought: Brought | undefined) => new Source(store, { id: 'brought', by: 'test', ...bringing(brought) })
    const first = source(arrival('Acme', 1))
    const repositories = repositoriesOn(first)
    const acme = (await repositories.scopes.tree()).root.children[0]

    // Nothing done here since: the next copy lands.
    const second = source(arrival('Acme, later', 2))
    expect((await repositoriesOn(second).scopes.state(acme.id))?.model.name).toBe('Acme, later')
    expect((await second.lastBrought())?.diverged).toEqual([])

    // A step here since: the next copy is not written, and the address waits for a person.
    await repositories.scopes.apply([{ scope: acme.id, steps: [step(addCrews)] }])
    const third = source(arrival('Acme, older page', 3))
    const state = await repositoriesOn(third).scopes.state(acme.id)
    expect([state?.model.name, state?.model.elements.map((one) => one.id)]).toEqual(['Acme, later', ['crews']])
    expect(await third.lastBrought()).toEqual({ note: 3, refused: [], diverged: ['acme'] })

    // Moved here: the address it left is not filled with the copy either.
    await repositories.scopes.move(acme.id, 'globex/acme')
    const fourth = source(arrival('Acme, older page again', 4))
    expect((await repositoriesOn(fourth).scopes.tree()).root.children.map((node) => node.address)).toEqual(['globex'])
    expect((await fourth.lastBrought())?.diverged).toEqual(['acme'])

    // Left as it is: the address waits no longer.
    await fourth.bring(() => Promise.resolve({ scopes: [], subject: 'Brought', safeguard: 'Before', note: 5, settle: ['acme'] }))
    expect((await fourth.lastBrought())?.diverged).toEqual([])
  })

  it('lands over a scope that is there when a person says so, after an entry that keeps what it held', async () => {
    const store = new MemoryStore()
    const repositories = repositoriesOver(store, { id: 'brought', by: 'test' })
    const made = await repositories.scopes.create('acme', { name: 'Acme Logistics' })
    if ('refused' in made) throw new Error(made.refused)
    await repositories.history.record({})
    await repositories.scopes.apply([{ scope: made.id, steps: [step(addCrews)] }])
    const later = bringing({
      subject: 'Again', safeguard: 'Before again', note: 2, force: true,
      scopes: [{ address: 'acme', content: emptyContent('Acme again'), bytes: [] }],
    })
    const reopened = repositoriesOver(store, { id: 'brought', by: 'test', ...later })
    const state = await reopened.scopes.state(made.id)
    expect([state?.model.name, state?.model.elements]).toEqual(['Acme again', []])
    const entries = (await reopened.history.entries({ scopes: [made.id] })).entries
    expect(entries.map((one) => one.subject)).toEqual(['Again', 'Before again', undefined])
    expect((await reopened.history.stateAt(made.id, entries[1].id))?.model.elements.map((one) => one.id)).toEqual(['crews'])
    expect((await reopened.history.entries({ scopes: [made.id], record: { kind: 'element', id: 'crews' } })).entries.map((one) => one.subject))
      .toEqual(['Again', 'Before again'])
  })

  it('writes nothing over a scope it cannot read whole, and says which', async () => {
    const store = new MemoryStore()
    const repositories = repositoriesOver(store, { id: 'brought', by: 'test' })
    const made = await repositories.scopes.create('acme', { name: 'Acme Logistics' })
    if ('refused' in made) throw new Error(made.refused)
    await store.transaction(SHELVES, 'write', async (tx) => {
      tx.put('contents', made.id, { ...await tx.get<object>('contents', made.id), format: 2 })
    })
    const source = new Source(store, {
      id: 'brought', by: 'test',
      bring: { prepare: () => Promise.resolve({ subject: 'Again', safeguard: 'Before', note: 1, force: true, scopes: [{ address: 'acme', content: emptyContent('Other'), bytes: [] }] }) },
    })
    const reopened = repositoriesOn(source)
    expect((await reopened.scopes.state(made.id))?.model.name).toBe('Acme Logistics')
    expect(await source.lastBrought()).toEqual({ note: 1, refused: ['acme'], diverged: [] })
  })

  it('is brought once where two pages start on one new store together', async () => {
    const store = new MemoryStore()
    const brought = (): Brought => ({ subject: 'Brought over', safeguard: 'Before', note: 1, scopes: [{ address: 'acme', content: emptyContent('Acme'), bytes: [] }] })
    const one = repositoriesOver(store, { id: 'brought', by: 'test', ...bringing(brought()) })
    const other = repositoriesOver(store, { id: 'brought', by: 'test', ...bringing(brought()) })
    const [tree] = await Promise.all([one.scopes.tree(), other.scopes.tree()])
    expect(tree.root.children.map((node) => node.address)).toEqual(['acme'])
    expect((await one.history.entries({ scopes: [tree.root.children[0].id] })).entries).toHaveLength(1)
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
    const [move, before] = (await repositories.history.entries({ scopes: [stock] })).entries
    expect(move.moved).toEqual({ from: 'acme/rail/rolling-stock', to: 'globex/rail/rolling-stock' })
    expect(before.id).toBe(entry.id)
    expect((await repositories.history.stateAt(stock, entry.id))?.address).toBe('acme/rail/rolling-stock')
    expect(await repositories.images.bytes(stock, 'wagon.png')).toEqual({ mediaType: 'image/png', bytes })
    expect(await repositories.settings.read({ of: 'scope', scope: stock })).toEqual({ review: true })
  })
})
