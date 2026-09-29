// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import { ShellError } from '../platform/errors'
import type { Repositories } from '../ports/Repositories'
import {
  changeScope, ensureScope, landed, modelsOf, readScope, stepOf, summaryOf,
} from './scopeAccess'

async function withAcme(): Promise<{ repositories: Repositories; acme: string }> {
  const repositories = memoryRepositories()
  const acme = landed(await repositories.scopes.create('acme', { name: 'Acme Logistics', kind: 'domain', client: 'Acme' })).id
  return { repositories, acme }
}

const crews = { type: 'element.create', element: { id: 'crews', kind: 'application', name: 'Crews', lifecycle: 'live', isManaged: false, aspects: {} } } as const

describe('the app’s questions about scopes, asked of the repositories', () => {
  it('draws the tree as summaries, each with its identity, and the root first', async () => {
    const { repositories, acme } = await withAcme()
    await repositories.scopes.create('acme/rail', { name: 'Rail' })
    const summary = summaryOf(await repositories.scopes.tree())
    expect(summary.path).toBe('')
    expect(summary.children.map((one) => [one.path, one.id, one.name, one.kind, one.client])).toEqual([
      ['acme', acme, 'Acme Logistics', 'domain', 'Acme'],
    ])
    expect(summary.children[0].children.map((one) => one.path)).toEqual(['acme/rail'])
    expect(summary.unreadable).toBeUndefined()
  })

  it('reads a scope by its address, with its identity and revision, and nothing where none is', async () => {
    const { repositories, acme } = await withAcme()
    const held = await readScope(repositories.scopes, 'acme')
    expect([held?.path, held?.id, held?.model.name, held?.kind, held?.revision]).toEqual(
      ['acme', acme, 'Acme Logistics', 'domain', (await repositories.scopes.state(acme))?.revision],
    )
    expect(held?.logoLibrary).toEqual([])
    expect(await readScope(repositories.scopes, 'globex')).toBeUndefined()
  })

  it('changes a scope by steps expecting what was read, and answers it as it now is', async () => {
    const { repositories } = await withAcme()
    const changed = await changeScope(repositories.scopes, 'acme', () => [crews])
    expect(changed?.model.elements.map((one) => one.id)).toEqual(['crews'])
    expect(await changeScope(repositories.scopes, 'acme', () => undefined)).toEqual(changed)
    expect(await changeScope(repositories.scopes, 'globex', () => [crews])).toBeUndefined()
  })

  it('works a change out again over a scope somebody changed in between', async () => {
    const { repositories, acme } = await withAcme()
    let asked = 0
    const changed = await changeScope(repositories.scopes, 'acme', (held) => {
      asked += 1
      // Somebody else lands a step between this read and the apply, once.
      if (asked === 1) void repositories.scopes.apply([{ scope: acme, steps: [stepOf({ type: 'project.settings', patch: { name: 'Acme' } })] }])
      return held.model.elements.length === 0 ? [crews] : undefined
    })
    expect(asked).toBe(2)
    expect([changed?.model.name, changed?.model.elements.map((one) => one.id)]).toEqual(['Acme', ['crews']])
  })

  it('says a refusal the reducer made with its key', async () => {
    const { repositories } = await withAcme()
    await changeScope(repositories.scopes, 'acme', () => [crews])
    await expect(changeScope(repositories.scopes, 'acme', () => [crews])).rejects.toEqual(new ShellError('command.taken'))
  })

  it('makes a scope where none is, and answers the one that is where one is', async () => {
    const { repositories, acme } = await withAcme()
    expect(await ensureScope(repositories.scopes, 'acme', { name: 'Again' })).toBe(acme)
    const made = await ensureScope(repositories.scopes, 'globex/crews', { name: 'Crews', kind: 'landscape' })
    const tree = summaryOf(await repositories.scopes.tree())
    expect(tree.children.map((one) => one.path)).toEqual(['acme', 'globex'])
    expect(tree.children[1].children.map((one) => [one.id, one.name, one.kind])).toEqual([[made, 'Crews', 'landscape']])
  })

  it('reads the index as the records the fold takes, by address', async () => {
    const { repositories } = await withAcme()
    await changeScope(repositories.scopes, 'acme', () => [crews])
    const models = modelsOf(await repositories.index.read())
    expect(models.map((one) => [one.path, one.model.elements.map((element) => element.id)]).sort()).toEqual([['', []], ['acme', ['crews']]])
  })
})
