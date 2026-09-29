// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContentAddress, ImageEntry } from '../../model/imageName'
import type { ScopeCommand, ScopeId } from '../../projects/scopeState'
import type { Repositories } from '../../ports/Repositories'
import { MemoryStore } from '../memory/MemoryStore'
import { UNNAMED_KEPT_MS } from './imageNames'
import type { Named } from './imageNames'
import { META_KEY, bytesKey } from './kept'
import type { Meta } from './kept'
import { repositoriesOver } from './repositoriesOver'

const HOUR = 60 * 60 * 1000
const START = Date.UTC(2026, 8, 1, 9)

type Made = { store: MemoryStore; repositories: Repositories; acme: ScopeId }

async function made(): Promise<Made> {
  const store = new MemoryStore()
  const repositories = repositoriesOver(store, { id: 'memory', by: 'this session' })
  const created = await repositories.scopes.create('acme', { name: 'Acme' })
  if ('refused' in created) throw new Error(created.refused)
  return { store, repositories, acme: created.id }
}

async function steps(repositories: Repositories, scope: ScopeId, ...commands: ScopeCommand[]): Promise<void> {
  const answer = await repositories.scopes.apply([{
    scope, steps: commands.map((command) => ({ stepId: crypto.randomUUID(), command, at: Date.now() })),
  }])
  if ('refused' in answer) throw new Error(`refused: ${String(answer.refused)}`)
}

async function put(repositories: Repositories, scope: ScopeId, name: string, ...values: number[]): Promise<ImageEntry> {
  const answer = await repositories.images.put(scope, name, new Uint8Array(values))
  if ('refused' in answer) throw new Error(answer.refused)
  return { name, mediaType: 'image/png', size: values.length, width: 1, height: 1, contentAddress: answer.contentAddress }
}

/** Whether bytes are still kept under a scope and an address. */
function kept(store: MemoryStore, scope: ScopeId, address: ContentAddress): Promise<boolean> {
  return store.transaction(['bytes'], 'read', async (tx) => (await tx.get('bytes', bytesKey(scope, address))) !== undefined)
}

function at(offset: number): void {
  vi.setSystemTime(START + offset)
}

describe('pictures’ bytes nothing names', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    at(0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('go at the first record a day after they were put, when nothing ever added them', async () => {
    const { store, repositories, acme } = await made()
    const image = await put(repositories, acme, 'lost.png', 1, 2, 3)
    at(23 * HOUR)
    await repositories.history.record({})
    expect(await kept(store, acme, image.contentAddress)).toBe(true)
    at(UNNAMED_KEPT_MS)
    await repositories.history.record({})
    expect(await kept(store, acme, image.contentAddress)).toBe(false)
    expect(await store.transaction(['bytesNamed', 'bytesUnnamed'], 'read', async (tx) => [
      await tx.range('bytesNamed', {}), await tx.range('bytesUnnamed', {}),
    ])).toEqual([[], []])
  })

  it('stay a day from when they were last put, not first', async () => {
    const { store, repositories, acme } = await made()
    const image = await put(repositories, acme, 'again.png', 4, 5)
    at(20 * HOUR)
    await put(repositories, acme, 'again.png', 4, 5)
    at(UNNAMED_KEPT_MS + HOUR)
    await repositories.history.record({})
    expect(await kept(store, acme, image.contentAddress)).toBe(true)
  })

  it('stay while the library names them, however old', async () => {
    const { store, repositories, acme } = await made()
    const image = await put(repositories, acme, 'kept.png', 6)
    await steps(repositories, acme, { type: 'image.add', image })
    at(30 * UNNAMED_KEPT_MS)
    await repositories.history.record({})
    expect(await kept(store, acme, image.contentAddress)).toBe(true)
    expect((await repositories.images.bytes(acme, 'kept.png'))?.bytes).toEqual(new Uint8Array([6]))
  })

  it('stay while an old entry names them, after the library let them go', async () => {
    const { store, repositories, acme } = await made()
    const image = await put(repositories, acme, 'old.png', 7, 8)
    await steps(repositories, acme, { type: 'image.add', image })
    const [entry] = await repositories.history.record({ scopes: [acme] })
    await steps(repositories, acme, { type: 'image.remove', name: 'old.png' })
    await repositories.history.record({})
    at(30 * UNNAMED_KEPT_MS)
    await repositories.history.record({})
    expect(await kept(store, acme, image.contentAddress)).toBe(true)
    expect((await repositories.history.stateAt(acme, entry.id))?.images).toEqual([image])
  })

  it('go when they were added and taken out again before any entry named them', async () => {
    const { store, repositories, acme } = await made()
    await repositories.history.record({})
    const image = await put(repositories, acme, 'brief.png', 9)
    await steps(repositories, acme, { type: 'image.add', image }, { type: 'image.remove', name: 'brief.png' })
    at(UNNAMED_KEPT_MS)
    await repositories.history.record({})
    expect(await kept(store, acme, image.contentAddress)).toBe(false)
  })

  it('once gone, are not named again: adding them back is refused, and the library stays as it was', async () => {
    const { store, repositories, acme } = await made()
    await repositories.history.record({})
    const image = await put(repositories, acme, 'undone.png', 4, 4)
    await steps(repositories, acme, { type: 'image.add', image }, { type: 'image.remove', name: 'undone.png' })
    at(UNNAMED_KEPT_MS)
    await repositories.history.record({})
    expect(await kept(store, acme, image.contentAddress)).toBe(false)
    const stepId = crypto.randomUUID()
    const answer = await repositories.scopes.apply([{ scope: acme, steps: [{ stepId, command: { type: 'image.add', image }, at: Date.now() }] }])
    expect(answer).toEqual({ refused: 'shell.imageBytesGone', scope: acme, stepId })
    expect((await repositories.scopes.state(acme))?.images).toEqual([])
    await put(repositories, acme, 'undone.png', 4, 4)
    await steps(repositories, acme, { type: 'image.add', image })
    expect((await repositories.images.bytes(acme, 'undone.png'))?.bytes).toEqual(new Uint8Array([4, 4]))
  })

  it('are never named by an entry for bytes that were never put', async () => {
    const { repositories, acme } = await made()
    const image: ImageEntry = { name: 'never.png', mediaType: 'image/png', size: 1, width: 1, height: 1, contentAddress: `sha256:${'0'.repeat(64)}` }
    const answer = await repositories.scopes.apply([{ scope: acme, steps: [{ stepId: 'x', command: { type: 'image.add', image }, at: Date.now() }] }])
    expect('refused' in answer && answer.refused).toBe('shell.imageBytesGone')
  })

  it('stay while a second name in the library points at the same bytes', async () => {
    const { store, repositories, acme } = await made()
    await repositories.history.record({})
    const one = await put(repositories, acme, 'one.png', 3, 3)
    const two = { ...one, name: 'two.png' }
    await steps(repositories, acme, { type: 'image.add', image: one }, { type: 'image.add', image: two }, { type: 'image.remove', name: 'one.png' })
    at(UNNAMED_KEPT_MS)
    await repositories.history.record({})
    expect(await kept(store, acme, one.contentAddress)).toBe(true)
  })

  it('are never swept from a store whose pictures were put before they were counted', async () => {
    const { store, repositories, acme } = await made()
    await store.transaction(['meta'], 'write', async (tx) => {
      const { namesCounted: _counted, ...meta } = (await tx.get<Meta>('meta', META_KEY))!
      tx.put('meta', META_KEY, meta)
    })
    const image = await put(repositories, acme, 'earlier.png', 1)
    at(30 * UNNAMED_KEPT_MS)
    await repositories.history.record({})
    expect(await kept(store, acme, image.contentAddress)).toBe(true)
  })

  it('go with their scope, counts and all', async () => {
    const { store, repositories, acme } = await made()
    const image = await put(repositories, acme, 'gone.png', 2)
    await steps(repositories, acme, { type: 'image.add', image })
    await repositories.scopes.remove(acme)
    expect(await store.transaction(['bytes', 'bytesNamed', 'bytesUnnamed'], 'read', async (tx) => [
      await tx.range('bytes', {}), await tx.range<Named>('bytesNamed', {}), await tx.range('bytesUnnamed', {}),
    ])).toEqual([[], [], []])
  })
})
