/**
 * Moving somebody's work out of a browser profile and into their own folder.
 *
 * The tests that matter are the ones about what migration must NOT do: it must
 * not delete the old copy, and it must not write over what is already in the
 * folder. Both are irreversible, both are triggered by an action as casual as
 * choosing a folder, and both would be discovered days later.
 */
import { describe, expect, it } from 'vitest'
import { InMemoryGroupStore } from '../adapters/memory/InMemoryGroupStore'
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import { projectAt, sampleProject } from '../ports/ProjectStore.contract'
import { copyGroupsInto, copyProjectsInto, migrated, migrateInto, upgradeProjects } from './migration'
import type { UpgradeTarget } from './migration'
import type { ProjectSnapshot } from './project'
import type { ScopePath } from './scopePath'

const named = (group: string, project: string, name: string): ProjectSnapshot =>
  projectAt(`${group}/${project}`, name)

describe('copyProjectsInto', () => {
  it('copies everything the folder does not have', async () => {
    const from = new InMemoryProjectStore([named('acme', 'one', 'One'), named('acme', 'two', 'Two')])
    const into = new InMemoryProjectStore()

    expect(await copyProjectsInto(from, into)).toMatchObject({ projects: 2, kept: 0, failed: 0 })
    expect((await into.list()).map((held) => held.name)).toEqual(['One', 'Two'])
  })

  it('leaves the old copy exactly where it was', async () => {
    // One-way, and not only on the first run: a folder on a drive that turns
    // out to be unplugged must cost nothing.
    const from = new InMemoryProjectStore([sampleProject()])
    await copyProjectsInto(from, new InMemoryProjectStore())

    expect(await from.list()).toHaveLength(1)
  })

  it('never writes over a project the folder already holds', async () => {
    // The folder's copy is where the work has been happening. Overwriting it
    // would be silent loss, triggered by choosing a folder.
    const from = new InMemoryProjectStore([named('acme', 'one', 'The old one')])
    const into = new InMemoryProjectStore([named('acme', 'one', 'The one being worked on')])

    expect(await copyProjectsInto(from, into)).toMatchObject({ projects: 0, kept: 1 })
    expect((await into.load('acme/one'))?.model.name)
      .toBe('The one being worked on')
  })

  it('skips the one that will not read and copies the rest', async () => {
    const from = new InMemoryProjectStore([named('acme', 'one', 'One'), named('acme', 'two', 'Two')])
    const broken = {
      list: () => from.list(),
      load: (path: ScopePath) =>
        path === 'acme/one' ? Promise.reject(new Error('unreadable')) : from.load(path),
    }
    const into = new InMemoryProjectStore()

    expect(await copyProjectsInto(broken, into)).toMatchObject({ projects: 1, failed: 1 })
    expect(await into.list()).toHaveLength(1)
  })

  it('does nothing at all when the old storage will not even list', async () => {
    const into = new InMemoryProjectStore()
    const tally = await copyProjectsInto({
      list: () => Promise.reject(new Error('gone')),
      load: () => Promise.resolve(undefined),
    }, into)

    expect(migrated(tally)).toBe(false)
    expect(await into.list()).toEqual([])
  })
})

describe('copyGroupsInto', () => {
  it('brings the descriptions and the decisions along', async () => {
    const from = new InMemoryGroupStore([{ group: 'acme', name: 'Acme', description: 'Freight.' }])
    const into = new InMemoryGroupStore()

    expect(await copyGroupsInto(from, into)).toMatchObject({ groups: 1 })
    expect((await into.list())[0].description).toBe('Freight.')
  })

  it('leaves a record the folder already has', async () => {
    const from = new InMemoryGroupStore([{ group: 'acme', name: 'Old' }])
    const into = new InMemoryGroupStore([{ group: 'acme', name: 'Theirs' }])

    expect(await copyGroupsInto(from, into)).toMatchObject({ groups: 0, kept: 1 })
    expect((await into.list())[0].name).toBe('Theirs')
  })
})

describe('migrateInto', () => {
  it('counts both halves in one tally', async () => {
    const tally = await migrateInto(
      { from: new InMemoryProjectStore([sampleProject()]), into: new InMemoryProjectStore() },
      { from: new InMemoryGroupStore([{ group: 'acme', name: 'Acme' }]), into: new InMemoryGroupStore() },
    )

    expect(tally).toEqual({ projects: 1, groups: 1, kept: 0, failed: 0 })
    expect(migrated(tally)).toBe(true)
  })

  it('says nothing happened when there was nothing to move', async () => {
    const tally = await migrateInto(
      { from: new InMemoryProjectStore(), into: new InMemoryProjectStore() },
      { from: new InMemoryGroupStore(), into: new InMemoryGroupStore() },
    )

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
  const outdated = (store: InMemoryProjectStore, refs: ScopePath[]): UpgradeTarget =>
    Object.assign(Object.create(store) as InMemoryProjectStore, {
      outdated: () => Promise.resolve(refs),
    })

  it('reads each old project and writes it back', async () => {
    const store = new InMemoryProjectStore([named('acme', 'one', 'One'), named('acme', 'two', 'Two')])
    const written: string[] = []
    const target = outdated(store, ['acme/one'])
    target.save = async (project) => { written.push(project.path); await store.save(project) }

    expect(await upgradeProjects(target)).toMatchObject({ upgraded: 1, failed: 0 })
    // The one that was already current is not touched, which is what keeps a
    // migration out of everybody's `git status` and off every timestamp.
    expect(written).toEqual(['acme/one'])
  })

  it('does nothing at all for a store with nothing old in it', async () => {
    const store = new InMemoryProjectStore([named('acme', 'one', 'One')])
    expect(await upgradeProjects(outdated(store, []))).toEqual({
      upgraded: 0, failed: 0, recorded: 'nothing to record',
    })
  })

  it('does nothing for a store that has no older format to have written', async () => {
    // An in-memory store, or any backend newer than the format: absent means
    // "nothing of mine is old" rather than "ask me again".
    expect(await upgradeProjects(new InMemoryProjectStore([sampleProject()])))
      .toMatchObject({ upgraded: 0 })
  })

  it('records what the folder looked like before it rewrites anything', async () => {
    const store = new InMemoryProjectStore([named('acme', 'one', 'One')])
    const order: string[] = []
    const target = outdated(store, ['acme/one'])
    target.save = async (project) => { order.push('save'); await store.save(project) }

    const tally = await upgradeProjects(target, () => {
      order.push('record')
      return Promise.resolve(true)
    })
    expect(tally.recorded).toBe('taken')
    expect(order).toEqual(['record', 'save'])
  })

  it('migrates anyway when there is nothing to record it with', async () => {
    // No git, no repository, or a snapshot that refused. Refusing to migrate
    // for want of one would leave a project nobody can open.
    const store = new InMemoryProjectStore([named('acme', 'one', 'One')])
    const target = outdated(store, ['acme/one'])

    expect(await upgradeProjects(target, () => Promise.reject(new Error('no git'))))
      .toEqual({ upgraded: 1, failed: 0, recorded: 'unavailable' })
  })

  it('counts the one that will not read and upgrades the rest', async () => {
    const store = new InMemoryProjectStore([named('acme', 'two', 'Two')])
    const target = outdated(store, ['acme/gone', 'acme/two'])

    expect(await upgradeProjects(target)).toEqual({ upgraded: 1, failed: 1, recorded: 'unavailable' })
  })
})
