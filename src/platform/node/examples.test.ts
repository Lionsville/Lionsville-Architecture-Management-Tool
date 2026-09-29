// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The examples that ship, from node: read, handed out as a working file, and
 * copied into repositories a server would hand in — the memory ones here —
 * where the organisation's page would copy them.
 */
import { describe, expect, it } from 'vitest'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import { readScope } from '../../projects/scopeAccess'
import { exampleWorkingFile, seedExample, SHIPPED, shippedExample } from './examples'
import { readWorkingFile } from './workingFile'

describe('the shipped examples, from node', () => {
  it('names every example that ships, and reads each as its scopes', async () => {
    expect(SHIPPED.map((entry) => entry.key)).toEqual(['acme-logistics'])
    const example = await shippedExample('acme-logistics')
    expect(example?.scopes.map((scope) => scope.path)).toEqual(['acme-logistics', 'acme-logistics/application-landscape', 'acme-logistics/platforms'])
    expect(await shippedExample('nowhere')).toBeUndefined()
  })

  it('hands one out as a working file another organisation reads in whole', async () => {
    const file = await exampleWorkingFile('acme-logistics')
    if (!file) throw new Error('no working file')
    expect(file.name).toBe('acme-logistics.lvarch')
    const into = memoryRepositories()
    const read = await readWorkingFile(into, file.bytes)
    if ('refused' in read) throw new Error(read.refused)
    expect(read.landed).toEqual(['', 'application-landscape', 'platforms'])
    expect(read.arrival.accounted).toBe(true)
    expect(await exampleWorkingFile('nowhere')).toBeUndefined()
  })

  it('seeds a blank organisation with it, and files a second copy under a scope of its own', async () => {
    const repositories = memoryRepositories()
    expect(await seedExample(repositories, 'acme-logistics')).toEqual(['', 'application-landscape', 'platforms'])
    expect((await readScope(repositories.scopes, ''))?.model.name).toBe('Acme Logistics')
    expect(await seedExample(repositories, 'acme-logistics'))
      .toEqual(['acme-logistics', 'acme-logistics/application-landscape', 'acme-logistics/platforms'])
    expect(await seedExample(repositories, 'nowhere')).toBeUndefined()
  })
})
