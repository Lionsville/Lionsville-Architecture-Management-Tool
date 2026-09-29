// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pass over a folder an older version of this tool wrote, through the
 * folder's own store over the suites' fake folder.
 *
 * The tests that matter are the ones about what the pass must NOT do: touch a
 * scope that is already this format, invent a scope where nothing was old, or
 * give up on the run for one scope that will not read.
 */
import { describe, expect, it, vi } from 'vitest'
import { FakeDirectory } from '../fakeDirectory'
import { FileSystemScopeStore } from '../FileSystemScopeStore'
import { sampleScope, scopeAt } from '../ScopeStore.contract'
import { upgradeProjects } from './migration'
import type { UpgradeTarget } from './migration'
import { bareScope, flattenScopes } from '../../../projects/scope'
import type { ScopeSnapshot } from '../../../projects/scope'
import type { ScopePath } from '../../../projects/scopePath'

const named = (group: string, project: string, name: string): ScopeSnapshot =>
  scopeAt(`${group}/${project}`, name)

/** A folder holding these scopes, written by the folder's own store. */
async function folderWith(scopes: readonly ScopeSnapshot[] = []): Promise<FileSystemScopeStore> {
  const store = new FileSystemScopeStore(new FakeDirectory('Architecture'))
  for (const scope of scopes) await store.save(scope)
  return store
}

/** The folder's store, saying these of its scopes an older build wrote. */
const outdated = (store: FileSystemScopeStore, refs: ScopePath[]): UpgradeTarget => ({
  list: () => store.list(),
  load: (path) => store.load(path),
  save: (scope) => store.save(scope),
  outdated: () => Promise.resolve(refs),
})

/**
 * The pass that rewrites what an older version of this tool wrote.
 *
 * Eager, because only a save takes the superseded files off disk — and narrow,
 * because the store is the one that knows which of its projects are old.
 */
describe('upgradeProjects', () => {
  it('reads each old project and writes it back', async () => {
    const store = await folderWith([named('acme', 'one', 'One'), named('acme', 'two', 'Two')])
    const written: string[] = []
    const target = outdated(store, ['acme/one'])
    target.save = async (project) => { written.push(project.path); await store.save(project) }

    expect(await upgradeProjects(target)).toMatchObject({ upgraded: 1, failed: 0 })
    // The one that was already current is not touched, which is what keeps a
    // migration out of everybody's `git status` and off every timestamp. The
    // two after it are the folders format 4 never made records of.
    expect(written).toEqual(['acme/one', '', 'acme'])
  })

  it('does nothing at all for a store with nothing old in it', async () => {
    const store = await folderWith([named('acme', 'one', 'One')])
    expect(await upgradeProjects(outdated(store, []))).toEqual({
      upgraded: 0, created: 0, failed: 0, recorded: 'nothing to record',
    })
  })

  it('does nothing for a folder whose scopes are all this format', async () => {
    // Asked of the folder itself: what this build wrote is not old.
    expect(await upgradeProjects(await folderWith([sampleScope()])))
      .toMatchObject({ upgraded: 0, created: 0, failed: 0, recorded: 'nothing to record' })
  })

  it('does nothing for a store that cannot say what is old', async () => {
    // Absent means "nothing of mine is old" rather than "ask me again".
    const store = await folderWith([sampleScope()])
    const { outdated: _, ...unasked } = outdated(store, [])
    expect(await upgradeProjects(unasked)).toMatchObject({ upgraded: 0 })
  })

  it('records what the folder looked like before it rewrites anything', async () => {
    const store = await folderWith([named('acme', 'one', 'One')])
    const order: string[] = []
    const target = outdated(store, ['acme/one'])
    target.save = async (project) => { order.push('save'); await store.save(project) }

    const tally = await upgradeProjects(target, {
      record: () => { order.push('record'); return Promise.resolve(true) },
    })
    expect(tally.recorded).toBe('taken')
    expect(order.slice(0, 2)).toEqual(['record', 'save'])
  })

  it('migrates anyway when there is nothing to record it with', async () => {
    // No git, no repository, or a snapshot that refused. Refusing to migrate
    // for want of one would leave a project nobody can open.
    const store = await folderWith([named('acme', 'one', 'One')])
    const target = outdated(store, ['acme/one'])

    expect(await upgradeProjects(target, { record: () => Promise.reject(new Error('no git')) }))
      .toMatchObject({ upgraded: 1, failed: 0, recorded: 'unavailable' })
  })

  it('counts the one that will not read and upgrades the rest', async () => {
    const store = await folderWith([named('acme', 'two', 'Two')])
    const target = outdated(store, ['acme/gone', 'acme/two'])

    expect(await upgradeProjects(target)).toMatchObject({ upgraded: 1, failed: 1 })
  })
})

/**
 * The folders format 4 had that were not records.
 *
 * A group with projects under it and no `group.json` was still a group,
 * because a group was derived from what was filed under it; a scope is derived
 * from nothing (ADR-0012 §1), so that folder has to say its own name or what
 * is inside it is filed under nothing at all.
 */
describe('upgradeProjects — the folders that were never records', () => {
  it('gives the root a scope, named from what the caller found', async () => {
    const store = await folderWith([named('acme', 'one', 'One')])
    const tally = await upgradeProjects(outdated(store, ['acme/one']), { rootName: 'Acme Logistics' })

    expect(tally.created).toBe(2)
    expect((await store.load(''))?.model.name).toBe('Acme Logistics')
    expect((await store.load(''))?.kind).toBe('organisation')
  })

  it('names a parent from its own folder, and only the ones that are missing', async () => {
    const store = await folderWith([
      named('acme', 'one', 'One'), bareScope('', 'Acme Logistics', 'organisation'),
    ])
    const tally = await upgradeProjects(outdated(store, ['acme/one']))

    expect(tally.created).toBe(1)
    expect((await store.load('acme'))?.model.name).toBe('acme')
    expect((await store.load('acme'))?.kind).toBe('domain')
    expect((await store.load(''))?.model.name).toBe('Acme Logistics')
  })

  it('names every level a nested tree was missing', async () => {
    const store = await folderWith([scopeAt('acme/rail/rolling-stock', 'Rolling stock')])
    await upgradeProjects(outdated(store, ['acme/rail/rolling-stock']), { rootName: 'Acme' })

    expect(flattenScopes(await store.list()).map((scope) => scope.path))
      .toEqual(['', 'acme', 'acme/rail', 'acme/rail/rolling-stock'])
  })

  it('invents nothing when there was nothing old to begin with', async () => {
    const store = await folderWith([named('acme', 'one', 'One')])
    expect(await upgradeProjects(outdated(store, []))).toMatchObject({ created: 0 })
    expect(await store.load('')).toBeUndefined()
  })

  /**
   * The name is a read of the folder's settings, and a boot over a folder
   * already in this format — almost every boot — waited for it for nothing.
   */
  it('asks for the root\'s name only when there is something to rewrite', async () => {
    const asked = vi.fn(() => Promise.resolve('Acme Logistics'))
    const current = await folderWith([named('acme', 'one', 'One')])
    await upgradeProjects(outdated(current, []), { rootName: asked })
    expect(asked).not.toHaveBeenCalled()

    const old = await folderWith([named('acme', 'one', 'One')])
    await upgradeProjects(outdated(old, ['acme/one']), { rootName: asked })
    expect(asked).toHaveBeenCalledTimes(1)
    expect((await old.load(''))?.model.name).toBe('Acme Logistics')
  })

  it('names the root from the tree when the question about its name fails', async () => {
    const store = await folderWith([named('acme', 'one', 'One')])
    const tally = await upgradeProjects(outdated(store, ['acme/one']), {
      rootName: () => Promise.reject(new Error('the settings would not read')),
    })
    expect(tally).toMatchObject({ created: 2, failed: 0 })
  })
})
