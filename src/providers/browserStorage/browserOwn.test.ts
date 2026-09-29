// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What happens after a write lands in this browser's database, and what
 * happens where the database will not open at all.
 */
import { describe, expect, it, vi } from 'vitest'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import { RecordingDiagnostics } from '../../adapters/memory/RecordingDiagnostics'
import type { BrowserDatabase } from '../../adapters/webStorage/browserRepositories'
import { ShellError } from '../../platform/errors'
import type { Repositories } from '../../ports/Repositories'
import { landed, stepOf } from '../../projects/scopeAccess'
import { afterWrites } from './browserOwn'
import { fallingBack } from './fallingBack'

function database(pressure = { used: 50, budget: 100 }) {
  return {
    standing: () => 'open',
    onStanding: () => () => {},
    pressure: vi.fn(() => Promise.resolve(pressure)),
    persisted: () => Promise.resolve(undefined),
    keep: vi.fn(() => Promise.resolve(true)),
  } satisfies BrowserDatabase
}

/** The same repositories, with the tree answered as the case says. */
function treeAnswering(repositories: Repositories, tree: () => Promise<never>): Repositories {
  const scopes = new Proxy(repositories.scopes, {
    get: (target, member) => (member === 'tree' ? tree : Reflect.get(target, member)),
  })
  return { ...repositories, scopes }
}

const settled = () => new Promise<void>((resolve) => { setTimeout(resolve, 0) })

describe('after a write lands', () => {
  it('asks the browser to keep this site once, on the first write that landed and never before', async () => {
    const held = database()
    const repositories = memoryRepositories()
    const scopes = afterWrites(repositories.scopes, held, () => {}, new RecordingDiagnostics())
    const acme = landed(await scopes.create('acme', { name: 'Acme' })).id
    await settled()
    expect(held.keep).not.toHaveBeenCalled()
    await scopes.apply([{ scope: acme, steps: [stepOf({ type: 'project.settings', patch: { name: 'Acme Logistics' } })] }])
    await scopes.apply([{ scope: acme, steps: [stepOf({ type: 'project.settings', patch: { name: 'Acme' } })] }])
    await settled()
    expect(held.keep).toHaveBeenCalledTimes(1)
  })

  it('says how full the storage is after every write that landed, and not after a refusal', async () => {
    const held = database({ used: 90, budget: 100 })
    const heard = vi.fn()
    const repositories = memoryRepositories()
    const scopes = afterWrites(repositories.scopes, held, heard, new RecordingDiagnostics())
    const acme = landed(await scopes.create('acme', { name: 'Acme' })).id
    await scopes.apply([{ scope: acme, steps: [stepOf({ type: 'project.settings', patch: { name: 'Acme Logistics' } })] }])
    await scopes.apply([{ scope: acme, expects: 'not what it is', steps: [stepOf({ type: 'project.settings', patch: { name: 'x' } })] }])
    await settled()
    expect(heard).toHaveBeenCalledTimes(1)
    expect(heard).toHaveBeenCalledWith({ used: 90, budget: 100 })
  })
})

describe('where the database will not open', () => {
  it('answers from the database where it opens', async () => {
    const primary = memoryRepositories()
    await primary.scopes.create('acme', { name: 'Acme' })
    const fell = vi.fn()
    const repositories = fallingBack(primary, memoryRepositories, fell)
    expect((await repositories.scopes.tree()).root.children.map((one) => one.address)).toEqual(['acme'])
    expect(fell).not.toHaveBeenCalled()
  })

  it('answers from memory from then on where opening it fails, and says so once', async () => {
    const primary = memoryRepositories()
    const refusing = treeAnswering(primary, () => Promise.reject(new Error('InvalidStateError: no database here')))
    const fell = vi.fn()
    const repositories = fallingBack(refusing, memoryRepositories, fell)
    await repositories.scopes.create('acme', { name: 'Acme' })
    expect((await repositories.scopes.tree()).root.children.map((one) => one.address)).toEqual(['acme'])
    expect(await repositories.history.entries({ scopes: [] })).toBeDefined()
    expect(fell).toHaveBeenCalledTimes(1)
  })

  it('does not fall anywhere on a refusal the open database gives', async () => {
    const primary = memoryRepositories()
    const full = treeAnswering(primary, () => Promise.reject(new ShellError('shell.storageFull')))
    const fell = vi.fn()
    const repositories = fallingBack(full, memoryRepositories, fell)
    await expect(repositories.scopes.tree()).rejects.toEqual(new ShellError('shell.storageFull'))
    expect(fell).not.toHaveBeenCalled()
  })
})
