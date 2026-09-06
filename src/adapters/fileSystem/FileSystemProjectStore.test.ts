/**
 * The folder store, held to the same contract as every other one.
 *
 * The shared suite is the admission test: returns what it stored under its own
 * ref, keeps two groups' identically-named projects apart, keeps a nested group
 * apart from its parent, lists alphabetically, stamps `updatedAt`, refuses a ref
 * that could escape its own folder, and survives a round trip unchanged. Passing
 * it is what makes this a `ProjectStore` rather than a class that happens to
 * have the right method names.
 *
 * The tests after it are the ones only this store can fail: they are about
 * files, and about the fact that a folder has other inhabitants.
 */
import { describe, expect, it } from 'vitest'
import { describeProjectStore, projectAt, sampleProject } from '../../ports/ProjectStore.contract'
import { FakeDirectory } from './fakeDirectory'
import { FileSystemProjectStore } from './FileSystemProjectStore'
import type { DirectoryHandleLike } from './FileSystemProjectStore'

describeProjectStore('folder on disk', () => new FileSystemProjectStore(new FakeDirectory()))

describe('FileSystemProjectStore — the folder is somebody else’s too', () => {
  const setup = () => {
    const root = new FakeDirectory()
    return { root, store: new FileSystemProjectStore(root) }
  }

  it('files a project where its ref says, so the file manager agrees with the picker', async () => {
    const { root, store } = setup()
    await store.save(projectAt({ group: 'acme/rail', project: 'rolling-stock' }))

    expect(root.paths()).toEqual([
      'acme/rail/rolling-stock/diagrams/cd.json',
      'acme/rail/rolling-stock/diagrams/cd.placements.json',
      'acme/rail/rolling-stock/diagrams/l7.json',
      'acme/rail/rolling-stock/diagrams/l7.placements.json',
      'acme/rail/rolling-stock/logos/own.svg',
      'acme/rail/rolling-stock/model.json',
      'acme/rail/rolling-stock/project.json',
    ])
  })

  it('ignores files and folders that are not projects', async () => {
    const { root, store } = setup()
    await store.save(sampleProject())
    root.writeRaw('notes.txt', 'nothing to do with this tool')
    const empty = await root.getDirectoryHandle('scratch', { create: true }) as FakeDirectory
    empty.writeRaw('budget.json', '{"not":"a project"}')

    expect(await store.list()).toHaveLength(1)
  })

  it('skips a project whose header is corrupt rather than failing the whole listing', async () => {
    // Half a write, a sync client's leftovers, something edited by hand. The
    // user cannot act on it, and hiding their other projects behind it would be
    // a worse answer than quietly leaving it out.
    const { root, store } = setup()
    await store.save(sampleProject())
    const broken = await (await root.getDirectoryHandle('acme-logistics'))
      .getDirectoryHandle('broken', { create: true }) as FakeDirectory
    broken.writeRaw('project.json', '{ "name": ')

    expect(await store.list()).toHaveLength(1)
    expect(await store.load({ group: 'acme-logistics', project: 'broken' })).toBeUndefined()
  })

  it('reads a project back from where it now lives, not from what it says inside', async () => {
    // Someone moved the folder in Finder. The project is then at its new address
    // — any other answer means the picker disagrees with the folder.
    const { root, store } = setup()
    await store.save(projectAt({ group: 'acme', project: 'landscape' }, 'Landscape'))

    const from = await (await root.getDirectoryHandle('acme')).getDirectoryHandle('landscape')
    const to = await (await root.getDirectoryHandle('elsewhere', { create: true }))
      .getDirectoryHandle('renamed', { create: true })
    await copy(from, to)

    const back = await store.load({ group: 'elsewhere', project: 'renamed' })
    expect(back?.ref).toEqual({ group: 'elsewhere', project: 'renamed' })
    expect(back?.model.name).toBe('Landscape')
  })

  it('does not write the ref into the folder — where you filed it is not the reader’s business', async () => {
    const { root, store } = setup()
    await store.save(sampleProject())

    for (const path of root.paths()) {
      expect(path.endsWith('.svg') || !(await read(root, path)).includes('"ref"'), path).toBe(true)
    }
  })

  it('leaves the group folder behind when the last project in it goes', async () => {
    // The user may keep other things in there. Deleting a folder this store did
    // not create is not its call.
    const { root, store } = setup()
    await store.save(projectAt({ group: 'acme', project: 'only' }))
    await store.remove({ group: 'acme', project: 'only' })

    await expect(root.getDirectoryHandle('acme')).resolves.toBeDefined()
    expect(await store.list()).toEqual([])
  })

  it('dates a project by its files, not by a field inside them', async () => {
    const { store } = setup()
    await store.save(sampleProject())
    const first = (await store.list())[0].updatedAt

    await store.save(sampleProject({ activeDiagramId: 'cd' }))
    const second = (await store.list())[0].updatedAt

    expect(first).toBeDefined()
    expect(second! > first!).toBe(true)
  })

  it('writes nothing at all when nothing changed', async () => {
    // The property the watcher, the sync client and `git status` all depend on:
    // an autosave of an untouched project is not an event.
    const { root, store } = setup()
    await store.save(sampleProject())
    const before = await stamps(root)

    await store.save(sampleProject())

    expect(await stamps(root)).toEqual(before)
  })

  it('rewrites one file when one node moves', async () => {
    const { root, store } = setup()
    const project = sampleProject()
    await store.save(project)
    const before = await stamps(root)

    const moved = sampleProject()
    moved.model.diagrams[0].placements = [{ elementId: 'crews', x: 999, y: 20 }]
    await store.save(moved)

    expect(await touched(before, await stamps(root)))
      .toEqual(['acme-logistics/landscape/diagrams/l7.placements.json'])
  })

  it('clears up after a deleted diagram, and leaves what is not ours where it is', async () => {
    const { root, store } = setup()
    await store.save(sampleProject())
    const folder = await (await root.getDirectoryHandle('acme-logistics'))
      .getDirectoryHandle('landscape') as FakeDirectory
    folder.writeRaw('README.md', 'Read me first.')

    const fewer = sampleProject()
    fewer.model.diagrams = [fewer.model.diagrams[0]]
    await store.save(fewer)

    const paths = root.paths().map((path) => path.replace('acme-logistics/landscape/', ''))
    expect(paths).not.toContain('diagrams/cd.json')
    expect(paths).not.toContain('diagrams/cd.placements.json')
    expect(paths).toContain('README.md')
  })

  it('answers an unreadable folder with an empty list rather than an exception', async () => {
    // Permission withdrawn, drive unplugged, folder deleted under us.
    const gone = {
      kind: 'directory' as const,
      name: 'gone',
      getDirectoryHandle: () => Promise.reject(new Error('NotAllowedError')),
      getFileHandle: () => Promise.reject(new Error('NotAllowedError')),
      removeEntry: () => Promise.reject(new Error('NotAllowedError')),
      // eslint-disable-next-line require-yield
      values: async function* () { throw new Error('NotAllowedError') },
    }
    const store = new FileSystemProjectStore(gone)

    await expect(store.list()).resolves.toEqual([])
    await expect(store.load({ group: 'a', project: 'b' })).resolves.toBeUndefined()
  })

  it('refuses to walk out of the folder it was given', async () => {
    const { store } = setup()
    const escape = { group: '..', project: 'escape' }

    await expect(store.save({ ...sampleProject(), ref: escape })).rejects.toThrow()
    await expect(store.load(escape)).resolves.toBeUndefined()
    await expect(store.remove(escape)).resolves.toBeUndefined()
  })
})

/** Every file under a folder with the moment it was last written. */
async function stamps(root: FakeDirectory): Promise<Record<string, number>> {
  const found: Record<string, number> = {}
  for (const path of root.paths()) {
    const parts = path.split('/')
    let folder: DirectoryHandleLike = root
    for (const segment of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(segment)
    const handle = await folder.getFileHandle(parts[parts.length - 1])
    found[path] = (await handle.getFile()).lastModified
  }
  return found
}

function touched(before: Record<string, number>, after: Record<string, number>): string[] {
  return Object.keys(after).filter((path) => after[path] !== before[path]).sort()
}

async function read(root: FakeDirectory, path: string): Promise<string> {
  const parts = path.split('/')
  let folder: DirectoryHandleLike = root
  for (const segment of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(segment)
  return (await (await folder.getFileHandle(parts[parts.length - 1])).getFile()).text()
}

/** A folder copied, the way dragging one in a file manager copies it. */
async function copy(from: DirectoryHandleLike, to: DirectoryHandleLike): Promise<void> {
  for await (const entry of from.values()) {
    if (entry.kind === 'directory') {
      await copy(entry, await to.getDirectoryHandle(entry.name, { create: true }))
      continue
    }
    const writable = await (await to.getFileHandle(entry.name, { create: true })).createWritable()
    await writable.write(await (await entry.getFile()).text())
    await writable.close()
  }
}
