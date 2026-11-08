// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { memoryRepositories } from '../../memory/memoryRepositories'
import { DENSE, DENSE_TEAM, denseScopes, seedDenseOrganisation } from './denseOrganisation'

describe('the dense organisation', () => {
  it('has the shape it says: 67 scopes four deep, long names, 63 units, 64 people, 112 observations mostly in one team', async () => {
    const scopes = denseScopes()
    expect(scopes).toHaveLength(DENSE.scopes)
    expect(Math.max(...scopes.map((one) => one.path.split('/').length))).toBe(4)
    expect(Math.max(...scopes.map((one) => one.name.length))).toBeGreaterThan(80)
    const repositories = memoryRepositories()
    await seedDenseOrganisation(repositories)
    const tree = await repositories.scopes.tree()
    const ids = new Map<string, string>()
    const walk = (node: typeof tree.root) => { ids.set(node.address, node.id); for (const child of node.children) walk(child) }
    walk(tree.root)
    expect(ids.size).toBe(DENSE.scopes)
    const read = async (path: string) => (await repositories.scopes.state(ids.get(path)!))!.model
    const root = await read('')
    expect(root.elements.filter((one) => one.unitTypeId)).toHaveLength(DENSE.units)
    expect((await repositories.people.list()).people.length).toBe(DENSE.people)
    expect(root.principles).toHaveLength(DENSE.principles)
    expect(root.elements.filter((one) => one.id.startsWith('dense-'))).toHaveLength(188)
    let observations = 0
    for (const { path } of scopes) observations += (await read(path)).observations?.length ?? 0
    expect(observations).toBe(DENSE.observations)
    expect((await read(DENSE_TEAM)).observations).toHaveLength(70)
  })
})
