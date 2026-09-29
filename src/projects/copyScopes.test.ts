// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import type { Repositories } from '../ports/Repositories'
import { copyScopes, holdsWork } from './copyScopes'
import { contentOf, placeTogether, readScope } from './scopeAccess'
import type { ScopeSnapshot } from './scope'

const scope = (path: string, name: string): ScopeSnapshot => ({
  path,
  model: { name, elements: [], relations: [], diagrams: [] },
  activeDiagramId: '',
  logoLibrary: [],
})

async function holding(...scopes: ScopeSnapshot[]): Promise<Repositories> {
  const repositories = memoryRepositories()
  if (scopes.length) await placeTogether(repositories, scopes.map((one) => ({ address: one.path, content: contentOf(one, []) })))
  return repositories
}

describe('work brought from one place into another', () => {
  it('says whether a place holds any work, the empty organisation being none', async () => {
    expect(await holdsWork(memoryRepositories())).toBe(false)
    expect(await holdsWork(await holding(scope('acme', 'Acme Logistics')))).toBe(true)
  })

  it('holds nothing anybody can act on where the place will not answer', async () => {
    const refusing = { scopes: { tree: () => Promise.reject(new Error('refused')), state: () => Promise.resolve(undefined) } }
    expect(await holdsWork(refusing)).toBe(false)
  })

  it('copies every scope, parents first, with its pictures', async () => {
    const from = memoryRepositories()
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])
    await placeTogether(from, [
      { address: 'acme/rail', content: contentOf(scope('acme/rail', 'Rail'), []) },
      { address: 'acme', content: contentOf(scope('acme', 'Acme Logistics'), []), pictures: [{ name: 'logo.png', bytes: png }] },
    ])
    const into = memoryRepositories()
    const tally = await copyScopes(from, into)
    expect(tally).toMatchObject({ scopes: 2, kept: 0, failed: 0, unread: 0 })
    expect((await readScope(into.scopes, 'acme/rail'))?.model.name).toBe('Rail')
    const acme = await readScope(into.scopes, 'acme')
    expect(acme?.model.name).toBe('Acme Logistics')
    expect(acme?.images?.map((image) => image.name)).toEqual(['logo.png'])
  })

  it('keeps what the destination holds, and copies the rest', async () => {
    const from = await holding(scope('acme', 'Acme Logistics'), scope('globex', 'Globex'))
    const into = await holding(scope('acme', 'Acme, as the folder has it'))
    const tally = await copyScopes(from, into)
    expect(tally).toMatchObject({ scopes: 1, kept: 1 })
    expect((await readScope(into.scopes, 'acme'))?.model.name).toBe('Acme, as the folder has it')
    expect((await readScope(into.scopes, 'globex'))?.model.name).toBe('Globex')
  })

  it('takes nothing from where it was', async () => {
    const from = await holding(scope('acme', 'Acme Logistics'))
    await copyScopes(from, memoryRepositories())
    expect((await readScope(from.scopes, 'acme'))?.model.name).toBe('Acme Logistics')
  })

  it('counts a scope that would not land, and goes on with the rest', async () => {
    const from = await holding(scope('acme', 'Acme Logistics'), scope('globex', 'Globex'))
    const into = memoryRepositories()
    const refusing = {
      ...into,
      scopes: {
        tree: () => into.scopes.tree(), state: (id: string) => into.scopes.state(id),
        create: (...args: Parameters<typeof into.scopes.create>) => args[0] === 'acme'
          ? Promise.reject(new Error('refused')) : into.scopes.create(...args),
        apply: (work: Parameters<typeof into.scopes.apply>[0]) => into.scopes.apply(work),
        remove: (...args: Parameters<typeof into.scopes.remove>) => into.scopes.remove(...args),
      },
    }
    expect(await copyScopes(from, refusing)).toMatchObject({ scopes: 1, failed: 1 })
    expect((await readScope(into.scopes, 'globex'))?.model.name).toBe('Globex')
  })
})
