/**
 * Moving somebody's work out of a browser profile and into their own folder.
 *
 * The tests that matter are the ones about what migration must NOT do: it must
 * not delete the old copy, and it must not write over what is already in the
 * folder. Both are irreversible, both are triggered by an action as casual as
 * choosing a folder, and both would be discovered days later.
 */
import { describe, expect, it } from 'vitest'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { sampleScope, scopeAt } from '../ports/ScopeStore.contract'
import { copyScopesInto, migrated, migrateInto, upgradeProjects } from './migration'
import type { UpgradeTarget } from './migration'
import { bareScope, flattenScopes } from './scope'
import type { ScopeSnapshot } from './scope'
import type { ScopePath } from './scopePath'

const named = (group: string, project: string, name: string): ScopeSnapshot =>
  scopeAt(`${group}/${project}`, name)

/** A store that says which of its scopes an older build wrote. */
const outdated = (store: InMemoryScopeStore, refs: ScopePath[]): UpgradeTarget =>
  Object.assign(Object.create(store) as InMemoryScopeStore, {
    outdated: () => Promise.resolve(refs),
  })

describe('copyScopesInto', () => {
  it('copies everything the folder does not have', async () => {
    const from = new InMemoryScopeStore([named('acme', 'one', 'One'), named('acme', 'two', 'Two')])
    const into = new InMemoryScopeStore()

    expect(await copyScopesInto(from, into)).toMatchObject({ scopes: 2, kept: 0, failed: 0 })
    expect(flattenScopes(await into.list()).slice(1).map((held) => held.name)).toEqual(['One', 'Two'])
  })

  it('leaves the old copy exactly where it was', async () => {
    // One-way, and not only on the first run: a folder on a drive that turns
    // out to be unplugged must cost nothing.
    const from = new InMemoryScopeStore([sampleScope()])
    await copyScopesInto(from, new InMemoryScopeStore())

    expect(flattenScopes(await from.list())).toHaveLength(2)
  })

  it('never writes over a project the folder already holds', async () => {
    // The folder's copy is where the work has been happening. Overwriting it
    // would be silent loss, triggered by choosing a folder.
    const from = new InMemoryScopeStore([named('acme', 'one', 'The old one')])
    const into = new InMemoryScopeStore([named('acme', 'one', 'The one being worked on')])

    expect(await copyScopesInto(from, into)).toMatchObject({ scopes: 0, kept: 1 })
    expect((await into.load('acme/one'))?.model.name)
      .toBe('The one being worked on')
  })

  it('skips the one that will not read and copies the rest', async () => {
    const from = new InMemoryScopeStore([named('acme', 'one', 'One'), named('acme', 'two', 'Two')])
    const broken = {
      list: () => from.list(),
      load: (path: ScopePath) =>
        path === 'acme/one' ? Promise.reject(new Error('unreadable')) : from.load(path),
    }
    const into = new InMemoryScopeStore()

    expect(await copyScopesInto(broken, into)).toMatchObject({ scopes: 1, failed: 1 })
    expect(flattenScopes(await into.list())).toHaveLength(2)
  })

  it('does nothing at all when the old storage will not even list', async () => {
    const into = new InMemoryScopeStore()
    const tally = await copyScopesInto({
      list: () => Promise.reject(new Error('gone')),
      load: () => Promise.resolve(undefined),
    }, into)

    expect(migrated(tally)).toBe(false)
    expect((await into.list()).children).toEqual([])
  })
})

describe('migrateInto', () => {
  it('copies the tree, parents before children', async () => {
    const written: string[] = []
    const into = new InMemoryScopeStore()
    const save = into.save.bind(into)
    into.save = async (scope) => { written.push(scope.path); await save(scope) }
    const from = new InMemoryScopeStore([
      scopeAt('acme/rail', 'Rail'), bareScope('acme', 'Acme', 'domain'),
    ])

    const tally = await migrateInto(from, into)

    expect(tally).toEqual({ scopes: 2, kept: 0, failed: 0 })
    expect(written).toEqual(['acme', 'acme/rail'])
    expect(migrated(tally)).toBe(true)
  })

  it('says nothing happened when there was nothing to move', async () => {
    const tally = await migrateInto(new InMemoryScopeStore(), new InMemoryScopeStore())
    expect(migrated(tally)).toBe(false)
  })
})

/**
 * The pass that rewrites what an older version of this tool wrote.
 *
 * Eager, because only a save takes the superseded files off disk — and narrow,
 * because the store is the one that knows which of its projects are old.
 */
describe('upgradeProjects', () => {
  it('reads each old project and writes it back', async () => {
    const store = new InMemoryScopeStore([named('acme', 'one', 'One'), named('acme', 'two', 'Two')])
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
    const store = new InMemoryScopeStore([named('acme', 'one', 'One')])
    expect(await upgradeProjects(outdated(store, []))).toEqual({
      upgraded: 0, created: 0, failed: 0, recorded: 'nothing to record',
    })
  })

  it('does nothing for a store that has no older format to have written', async () => {
    // An in-memory store, or any backend newer than the format: absent means
    // "nothing of mine is old" rather than "ask me again".
    expect(await upgradeProjects(new InMemoryScopeStore([sampleScope()])))
      .toMatchObject({ upgraded: 0 })
  })

  it('records what the folder looked like before it rewrites anything', async () => {
    const store = new InMemoryScopeStore([named('acme', 'one', 'One')])
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
    const store = new InMemoryScopeStore([named('acme', 'one', 'One')])
    const target = outdated(store, ['acme/one'])

    expect(await upgradeProjects(target, { record: () => Promise.reject(new Error('no git')) }))
      .toMatchObject({ upgraded: 1, failed: 0, recorded: 'unavailable' })
  })

  it('counts the one that will not read and upgrades the rest', async () => {
    const store = new InMemoryScopeStore([named('acme', 'two', 'Two')])
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
    const store = new InMemoryScopeStore([named('acme', 'one', 'One')])
    const tally = await upgradeProjects(outdated(store, ['acme/one']), { rootName: 'Acme Logistics' })

    expect(tally.created).toBe(2)
    expect((await store.load(''))?.model.name).toBe('Acme Logistics')
    expect((await store.load(''))?.kind).toBe('organisation')
  })

  it('names a parent from its own folder, and only the ones that are missing', async () => {
    const store = new InMemoryScopeStore([
      named('acme', 'one', 'One'), bareScope('', 'Acme Logistics', 'organisation'),
    ])
    const tally = await upgradeProjects(outdated(store, ['acme/one']))

    expect(tally.created).toBe(1)
    expect((await store.load('acme'))?.model.name).toBe('acme')
    expect((await store.load('acme'))?.kind).toBe('domain')
    expect((await store.load(''))?.model.name).toBe('Acme Logistics')
  })

  it('names every level a nested tree was missing', async () => {
    const store = new InMemoryScopeStore([scopeAt('acme/rail/rolling-stock', 'Rolling stock')])
    await upgradeProjects(outdated(store, ['acme/rail/rolling-stock']), { rootName: 'Acme' })

    expect(flattenScopes(await store.list()).map((scope) => scope.path))
      .toEqual(['', 'acme', 'acme/rail', 'acme/rail/rolling-stock'])
  })

  it('invents nothing when there was nothing old to begin with', async () => {
    const store = new InMemoryScopeStore([named('acme', 'one', 'One')])
    expect(await upgradeProjects(outdated(store, []))).toMatchObject({ created: 0 })
    expect(await store.load('')).toBeUndefined()
  })
})
