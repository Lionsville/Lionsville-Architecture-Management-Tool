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
import { copyGroupsInto, copyProjectsInto, migrated, migrateInto } from './migration'
import type { ProjectSnapshot } from './project'

const named = (group: string, project: string, name: string): ProjectSnapshot =>
  projectAt({ group, project }, name)

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
    expect((await into.load({ group: 'acme', project: 'one' }))?.model.name)
      .toBe('The one being worked on')
  })

  it('skips the one that will not read and copies the rest', async () => {
    const from = new InMemoryProjectStore([named('acme', 'one', 'One'), named('acme', 'two', 'Two')])
    const broken = {
      list: () => from.list(),
      load: (ref: { group: string; project: string }) =>
        ref.project === 'one' ? Promise.reject(new Error('unreadable')) : from.load(ref),
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
