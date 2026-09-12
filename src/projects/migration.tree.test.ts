/**
 * A whole working directory written before scopes, opened.
 *
 * The per-folder fold is `migrate4to5.test.ts`'s; this is the pass over the
 * tree, which is a different thing and fails differently. Its fixture holds one
 * of everything that made format 4 more than a header: a nested group, a group
 * with a record and decisions of its own, a project whose decisions are filed
 * per application, a project with a plan, an organisation's name in
 * `folder.json`, and a `.lvarch` somebody left in the folder — which is a file
 * and not a scope, and has to come out the other side untouched.
 *
 * The properties are the ones a pass can quietly get wrong: everything is
 * addressable afterwards, nothing a scope did not write has moved, and running
 * it twice is running it once.
 */
import { describe, expect, it } from 'vitest'
import { FakeDirectory } from '../adapters/fileSystem/fakeDirectory'
import { FileSystemFolderSettings } from '../adapters/fileSystem/FileSystemFolderSettings'
import { FileSystemScopeStore } from '../adapters/fileSystem/FileSystemScopeStore'
import type { DirectoryHandleLike } from '../adapters/fileSystem/FileSystemScopeStore'
import { FOLDER_SETTINGS_PATH, WITHOUT_ORGANISATION } from './folderSettings'
import { upgradeProjects } from './migration'
import { flattenScopes } from './scope'

/** A format-4 header for a project folder. */
const project = (name: string, group: string, diagrams: string[] = ['l7']) => JSON.stringify({
  type: 'lionsville-architecture',
  formatVersion: 4,
  name,
  groupName: group,
  activeDiagramId: diagrams[0],
  diagrams,
})

const model = () => JSON.stringify({
  elements: [{ id: 'wms', kind: 'application', name: 'WMS', lifecycle: 'live', isManaged: true, aspects: {} }],
  relations: [],
})

const view = () => JSON.stringify({ id: 'l7', kind: 'layer7', name: 'Landschap', members: [{ id: 'wms' }] })
const geometry = () => JSON.stringify({ nodes: [{ id: 'wms', x: 10, y: 20 }] })

const decision = (number: number, id: string, title: string) =>
  `---\nid: ${id}\nnumber: ${number}\ntitle: ${title}\nstatus: accepted\ndate: 2026-09-01\n---\n\n## Context\n\nSomething had to give.\n`

const plan = () =>
  '---\nid: tr-1\nnumber: 1\ntitle: Replace the rater\nstatus: agreed\nfrom: 2027-01-15\nto: 2028-01-31\n---\n\n## Goal\n\nOne rater.\n'

/**
 * The tree, as a build before scopes wrote it.
 *
 * `acme` is a group with a record and two decisions; `acme/rail` is a group
 * nested inside it with no record at all, which format 4 allowed because a
 * group was derived from what was filed under it.
 */
const V4_TREE: Record<string, string> = {
  '.lionsville-architecture/folder.json': JSON.stringify({
    version: 1,
    organisation: { name: 'Acme Logistics', client: 'Acme Logistics BV' },
    somethingLater: true,
  }),
  'handover.lvarch': 'PK not really a zip, and none of our business',
  'README.md': 'The landscapes live in here.',

  'acme/group.json': JSON.stringify({
    name: 'Acme',
    client: 'Acme Logistics BV',
    description: 'A parcel and pallet operator.',
    links: [{ label: 'Wiki', url: 'https://example.test/wiki' }],
  }),
  'acme/decisions/0001-one-identity-provider.md': decision(1, 'g-1', 'One identity provider'),
  'acme/decisions/0002-one-place-for-a-price.md': decision(2, 'g-2', 'One place for a price'),

  'acme/warehouse/project.json': project('Warehouse landscape', 'Acme'),
  'acme/warehouse/model.json': model(),
  'acme/warehouse/diagrams/l7.json': view(),
  'acme/warehouse/diagrams/l7.geometry.json': geometry(),
  'acme/warehouse/decisions/wms/0001-its-own-stock.md': decision(1, 'a-1', 'The WMS keeps its own stock'),
  'acme/warehouse/transitions/0001-replace-the-rater.md': plan(),

  'acme/rail/rolling-stock/project.json': project('Rolling stock', 'Acme Rail'),
  'acme/rail/rolling-stock/model.json': model(),
  'acme/rail/rolling-stock/diagrams/l7.json': view(),
  'acme/rail/rolling-stock/diagrams/l7.geometry.json': geometry(),
}

async function plant(root: FakeDirectory, path: string, text: string): Promise<void> {
  const parts = path.split('/')
  let folder: DirectoryHandleLike = root
  for (const segment of parts.slice(0, -1)) {
    folder = await folder.getDirectoryHandle(segment, { create: true })
  }
  ;(folder as FakeDirectory).writeRaw(parts[parts.length - 1], text)
}

async function folderOf(files: Record<string, string> = V4_TREE) {
  const root = new FakeDirectory('Architecture')
  for (const [path, text] of Object.entries(files)) await plant(root, path, text)
  return root
}

/** Every file in the folder, by path, as it now stands. */
async function contents(root: FakeDirectory): Promise<Record<string, string>> {
  const held: Record<string, string> = {}
  for (const path of root.paths()) {
    const parts = path.split('/')
    let folder: DirectoryHandleLike = root
    for (const segment of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(segment)
    const handle = await folder.getFileHandle(parts[parts.length - 1])
    held[path] = await (await handle.getFile()).text()
  }
  return held
}

/** The whole pass, the way the boot runs it. */
async function migrate(root: FakeDirectory) {
  const store = new FileSystemScopeStore(root)
  const settings = new FileSystemFolderSettings(root)
  const name = (await settings.readFolder()).legacyOrganisationName
  const tally = await upgradeProjects(store, { rootName: name ?? root.name })
  if (name) await settings.writeFolder(WITHOUT_ORGANISATION)
  return { store, settings, tally }
}

describe('a format-4 working directory', () => {
  it('names every folder the tree needs, and calls the root what folder.json did', async () => {
    const root = await folderOf()
    const { store, tally } = await migrate(root)

    expect(flattenScopes(await store.list()).map((scope) => scope.path)).toEqual([
      '', 'acme', 'acme/rail', 'acme/rail/rolling-stock', 'acme/warehouse',
    ])
    expect((await store.load(''))?.model.name).toBe('Acme Logistics')
    expect((await store.load(''))?.kind).toBe('organisation')
    // Three projects and a group record rewritten; the root and `acme/rail`
    // were folders format 4 never made records of.
    expect(tally).toMatchObject({ upgraded: 3, created: 2, failed: 0 })
  })

  it('keeps what each record said about itself', async () => {
    const { store } = await migrate(await folderOf())

    const group = (await store.load('acme'))!
    expect(group.model.name).toBe('Acme')
    expect(group.kind).toBe('domain')
    expect(group.client).toBe('Acme Logistics BV')
    expect(group.model.description).toBe('A parcel and pallet operator.')
    expect(group.links).toEqual([{ label: 'Wiki', url: 'https://example.test/wiki' }])
    expect(group.model.decisions?.map((adr) => adr.title))
      .toEqual(['One identity provider', 'One place for a price'])

    const warehouse = (await store.load('acme/warehouse'))!
    expect(warehouse.model.name).toBe('Warehouse landscape')
    expect(warehouse.kind).toBe('landscape')
    expect(warehouse.model.decisions?.[0]).toMatchObject({ applicationId: 'wms' })
    expect(warehouse.model.transitions?.[0].title).toBe('Replace the rater')
    expect(warehouse.model.diagrams[0].geometry.nodes).toEqual([{ id: 'wms', x: 10, y: 20 }])
  })

  it('names a group that never had a record from its own folder', async () => {
    const { store } = await migrate(await folderOf())
    expect((await store.load('acme/rail'))?.model.name).toBe('rail')
    expect((await store.load('acme/rail'))?.kind).toBe('domain')
  })

  it('takes the two headers away, and leaves what is not the format’s alone', async () => {
    const root = await folderOf()
    await migrate(root)
    const held = await contents(root)

    expect(Object.keys(held).filter((path) => path.endsWith('project.json'))).toEqual([])
    expect(Object.keys(held).filter((path) => path.endsWith('group.json'))).toEqual([])
    // A file, not a scope, and none of this pass's business either way.
    expect(held['handover.lvarch']).toBe(V4_TREE['handover.lvarch'])
    expect(held['README.md']).toBe(V4_TREE['README.md'])
  })

  it('takes the organisation out of folder.json once the root has its name', async () => {
    const root = await folderOf()
    const { settings } = await migrate(root)

    const held = JSON.parse((await contents(root))[FOLDER_SETTINGS_PATH]) as Record<string, unknown>
    expect('organisation' in held).toBe(false)
    // A colleague's newer key is not this pass's to prune.
    expect(held.somethingLater).toBe(true)
    expect(await settings.readFolder()).toEqual({})
  })

  it('falls back to the folder’s own name when folder.json never said one', async () => {
    const { '.lionsville-architecture/folder.json': _dropped, ...rest } = V4_TREE
    const { store } = await migrate(await folderOf(rest))
    expect((await store.load(''))?.model.name).toBe('Architecture')
  })

  /**
   * The property the pass lives or dies by. A second run has nothing to do, so
   * it must write nothing: a folder that churned on every open would be a
   * folder whose `git status` is never clean and whose watcher never rests.
   */
  it('changes nothing at all the second time it runs', async () => {
    const root = await folderOf()
    await migrate(root)
    const after = await contents(root)

    const { tally } = await migrate(root)

    expect(tally).toMatchObject({ upgraded: 0, created: 0, failed: 0 })
    expect(await contents(root)).toEqual(after)
  })

  it('round-trips: what it wrote is what this build writes', async () => {
    const root = await folderOf()
    const { store } = await migrate(root)
    const before = await contents(root)

    for (const scope of flattenScopes(await store.list())) {
      await store.save((await store.load(scope.path))!)
    }

    expect(await contents(root)).toEqual(before)
  })
})

/** A 1.x folder goes 3 → 4 → 5 through the two folds, in one pass. */
describe('a format-3 working directory', () => {
  const v3: Record<string, string> = {
    'acme/warehouse/project.json': JSON.stringify({
      type: 'lionsville-architecture',
      formatVersion: 3,
      name: 'Warehouse landscape',
      groupName: 'Acme',
      activeDiagramId: 'l7',
      diagrams: ['l7'],
    }),
    'acme/warehouse/model.json': JSON.stringify({
      elements: [{ id: 'portal', kind: 'inputChannel', name: 'Portal' }],
      connections: [],
    }),
    'acme/warehouse/diagrams/l7.json': JSON.stringify({ id: 'l7', kind: 'layer7', name: 'Landschap' }),
    'acme/warehouse/diagrams/l7.placements.json': JSON.stringify({
      placements: [{ elementId: 'portal', zone: 'inputChannels', x: 1, y: 2 }],
    }),
  }

  it('ends at format 5, drawing what it always drew', async () => {
    const root = await folderOf(v3)
    const { store } = await migrate(root)

    const held = (await store.load('acme/warehouse'))!
    expect(held.model.elements[0]).toMatchObject({ kind: 'application' })
    expect(held.model.diagrams[0].members).toEqual([{ id: 'portal', zone: 'inputChannels' }])
    expect(held.model.diagrams[0].geometry.nodes).toEqual([{ id: 'portal', x: 1, y: 2 }])

    const files = Object.keys(await contents(root))
    expect(files).toContain('acme/warehouse/scope.json')
    expect(files).toContain('acme/warehouse/diagrams/l7.geometry.json')
    expect(files).not.toContain('acme/warehouse/diagrams/l7.placements.json')
    expect(files).not.toContain('acme/warehouse/project.json')
  })
})
