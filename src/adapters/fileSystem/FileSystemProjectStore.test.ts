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

describeProjectStore('folder on disk', () => new FileSystemProjectStore(new FakeDirectory()))

describe('FileSystemProjectStore — the folder is somebody else’s too', () => {
  const setup = () => {
    const root = new FakeDirectory()
    return { root, store: new FileSystemProjectStore(root) }
  }

  it('files a project where its ref says, so the file manager agrees with the picker', async () => {
    const { root, store } = setup()
    await store.save(projectAt({ group: 'acme/rail', project: 'rolling-stock' }))

    const acme = await root.getDirectoryHandle('acme')
    const rail = await acme.getDirectoryHandle('rail')
    await expect(rail.getFileHandle('rolling-stock.lvarch')).resolves.toBeDefined()
  })

  it('ignores files that are not ours', async () => {
    const { root, store } = setup()
    await store.save(sampleProject())
    root.writeRaw('notes.txt', 'nothing to do with this tool')
    root.writeRaw('budget.json', '{"not":"a project"}')

    expect(await store.list()).toHaveLength(1)
  })

  it('skips a project file that is corrupt rather than failing the whole listing', async () => {
    // Half a write, a sync client's leftovers, something edited by hand. The
    // user cannot act on it, and hiding their other projects behind it would be
    // a worse answer than quietly leaving it out.
    const { root, store } = setup()
    await store.save(sampleProject())
    root.writeRaw('broken.lvarch', '{ "model": ')

    const listed = await store.list()
    expect(listed).toHaveLength(1)
    expect(await store.load({ group: '', project: 'broken' })).toBeUndefined()
  })

  it('reads a project back from where it now lives, not from what it says inside', async () => {
    // Someone moved the file in Finder. The project is then at its new address —
    // any other answer means the picker disagrees with the folder.
    const { root, store } = setup()
    await store.save(projectAt({ group: 'acme', project: 'landscape' }, 'Landscape'))

    const acme = await root.getDirectoryHandle('acme')
    const file = await acme.getFileHandle('landscape.lvarch')
    const contents = await (await file.getFile()).text()
    const moved = await root.getDirectoryHandle('elsewhere', { create: true }) as FakeDirectory
    moved.writeRaw('renamed.lvarch', contents)

    const back = await store.load({ group: 'elsewhere', project: 'renamed' })
    expect(back?.ref).toEqual({ group: 'elsewhere', project: 'renamed' })
    expect(back?.model.name).toBe('Landscape')
  })

  it('does not write the ref into the file — where you filed it is not the reader’s business', async () => {
    const { root, store } = setup()
    await store.save(sampleProject())

    const handle = await (await root.getDirectoryHandle('acme-logistics'))
      .getFileHandle('landscape.lvarch')
    const written = JSON.parse(await (await handle.getFile()).text())

    expect('ref' in written).toBe(false)
    expect(written.model).toBeDefined()
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

  it('dates a project by the file, not by a field inside it', async () => {
    const { store } = setup()
    await store.save(sampleProject())
    const first = (await store.list())[0].updatedAt

    await store.save(sampleProject())
    const second = (await store.list())[0].updatedAt

    expect(first).toBeDefined()
    expect(second! > first!).toBe(true)
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
