/**
 * The group record on disk, held to the shared contract, plus the two things
 * only a folder can get wrong: telling a group folder from a project folder,
 * and clearing up a decision whose file name changed with its title.
 */
import { describe, expect, it } from 'vitest'
import { describeGroupStore, sampleProfile } from '../../ports/GroupStore.contract'
import { sampleProject } from '../../ports/ProjectStore.contract'
import { FakeDirectory } from './fakeDirectory'
import { FileSystemGroupStore } from './FileSystemGroupStore'
import { FileSystemProjectStore } from './FileSystemProjectStore'

describeGroupStore('folder on disk', () => new FileSystemGroupStore(new FakeDirectory()))

describe('FileSystemGroupStore — a group folder is not a project folder', () => {
  const setup = () => {
    const root = new FakeDirectory()
    return {
      root,
      groups: new FileSystemGroupStore(root),
      projects: new FileSystemProjectStore(root),
    }
  }

  it('files the record beside the projects, as group.json', async () => {
    const { root, groups } = setup()
    await groups.save(sampleProfile({ group: 'acme/rail' }))

    expect(root.paths()).toContain('acme/rail/group.json')
  })

  it('does not read a project as a group of its own', async () => {
    // The rule both stores walk by: a folder holding a project.json is a
    // project, and what is inside it is the project's business.
    const { groups, projects } = setup()
    await projects.save(sampleProject())
    await groups.save(sampleProfile())

    expect((await groups.list()).map((profile) => profile.group)).toEqual(['acme-logistics'])
  })

  it('keeps the group’s own decisions as markdown beside the record', async () => {
    const { root, groups } = setup()
    await groups.save(sampleProfile({
      decisions: [{
        id: 'g1', number: 1, title: 'One tenant per group', status: 'accepted',
        date: '2026-09-06', body: 'Because.', signers: [],
      }],
    }))

    expect(root.paths()).toContain('acme-logistics/decisions/0001-one-tenant-per-group.md')
  })

  it('clears up a decision whose file name changed with its title', async () => {
    const { root, groups } = setup()
    const adr = {
      id: 'g1', number: 1, title: 'First name', status: 'accepted' as const,
      date: '2026-09-06', body: 'Because.', signers: [],
    }
    await groups.save(sampleProfile({ decisions: [adr] }))
    await groups.save(sampleProfile({ decisions: [{ ...adr, title: 'Second name' }] }))

    expect(root.paths().filter((path) => path.includes('decisions/')))
      .toEqual(['acme-logistics/decisions/0001-second-name.md'])
  })

  it('leaves the projects where they are when the record goes', async () => {
    const { groups, projects } = setup()
    await projects.save(sampleProject())
    await groups.save(sampleProfile())
    await groups.remove('acme-logistics')

    expect(await groups.list()).toEqual([])
    expect(await projects.list()).toHaveLength(1)
  })
})
