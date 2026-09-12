/**
 * The folder store, held to the same contract as every other one.
 *
 * The shared suite is the admission test: the root exists and can be saved, a
 * child is listed under its parent, a nested scope is kept apart from it, a
 * reserved name is refused, `updatedAt` is stamped, a path that could escape
 * the folder is refused, and a scope survives a round trip unchanged. Passing
 * it is what makes this a `ScopeStore` rather than a class that happens to have
 * the right method names.
 *
 * The tests after it are the ones only this store can fail: they are about
 * files, and about the fact that a folder has other inhabitants.
 */
import { describe, expect, it } from 'vitest'
import { describeScopeStore, sampleScope, scopeAt } from '../../ports/ScopeStore.contract'
import { flattenScopes } from '../../projects/scope'
import { FakeDirectory } from './fakeDirectory'
import { FileSystemScopeStore } from './FileSystemScopeStore'
import type { DirectoryHandleLike } from './FileSystemScopeStore'

describeScopeStore('folder on disk', () => new FileSystemScopeStore(new FakeDirectory()))

describe('FileSystemScopeStore — the folder is somebody else’s too', () => {
  const setup = () => {
    const root = new FakeDirectory()
    return { root, store: new FileSystemScopeStore(root) }
  }

  /** Every path in the listing but the root, so a tree reads as a flat set. */
  const listed = async (store: FileSystemScopeStore) =>
    flattenScopes(await store.list()).filter((s) => s.path !== '').map((s) => s.path)

  it('files a scope where its path says, so the file manager agrees with the screen', async () => {
    const { root, store } = setup()
    await store.save(scopeAt('acme/rail/rolling-stock'))

    expect(root.paths()).toEqual([
      'acme/rail/rolling-stock/diagrams/cd.geometry.json',
      'acme/rail/rolling-stock/diagrams/cd.json',
      'acme/rail/rolling-stock/diagrams/l7.geometry.json',
      'acme/rail/rolling-stock/diagrams/l7.json',
      'acme/rail/rolling-stock/logos/own.svg',
      'acme/rail/rolling-stock/model.json',
      'acme/rail/rolling-stock/scope.json',
    ])
  })

  /**
   * The root is a scope, and its files sit in the working directory itself.
   * Anything else and the organisation would have nowhere to be.
   */
  it('files the root scope in the working directory itself', async () => {
    const { root, store } = setup()
    await store.save({ ...sampleScope(), path: '' })

    expect(root.paths()).toContain('scope.json')
    expect((await store.load(''))?.model.name).toBe('Application landscape')
  })

  /**
   * A scope's own files are its `scope.json`, its `model.json` and the six
   * folders the format writes into. A child's files are the child's, so a
   * parent's save neither reads nor removes them.
   */
  it('leaves a nested scope alone when its parent is saved', async () => {
    const { root, store } = setup()
    await store.save(scopeAt('acme', 'Acme'))
    await store.save(scopeAt('acme/rail', 'Rail'))

    await store.save(scopeAt('acme', 'Acme renamed'))

    expect((await store.load('acme/rail'))?.model.name).toBe('Rail')
    expect(root.paths()).toContain('acme/rail/scope.json')
  })

  it('ignores files and folders that are not scopes', async () => {
    const { root, store } = setup()
    await store.save(sampleScope())
    root.writeRaw('notes.txt', 'nothing to do with this tool')
    const empty = await root.getDirectoryHandle('scratch', { create: true }) as FakeDirectory
    empty.writeRaw('budget.json', '{"not":"a scope"}')

    expect(await listed(store)).toEqual(['acme-logistics/landscape'])
  })

  /** `.git` is the history and `.lionsville-architecture` is the settings. */
  it('never treats a dot-folder as a scope', async () => {
    const { root, store } = setup()
    const settings = await root.getDirectoryHandle('.lionsville-architecture', { create: true }) as FakeDirectory
    settings.writeRaw('scope.json', JSON.stringify({ type: 'lionsville-architecture', version: 5, name: 'Nope', diagrams: [] }))

    expect(await listed(store)).toEqual([])
  })

  it('skips a scope whose header is corrupt rather than failing the whole listing', async () => {
    // Half a write, a sync client's leftovers, something edited by hand. The
    // user cannot act on it, and hiding their other scopes behind it would be
    // a worse answer than quietly leaving it out.
    const { root, store } = setup()
    await store.save(sampleScope())
    const broken = await (await root.getDirectoryHandle('acme-logistics'))
      .getDirectoryHandle('broken', { create: true }) as FakeDirectory
    broken.writeRaw('scope.json', '{ "name": ')

    expect(await listed(store)).toEqual(['acme-logistics/landscape'])
    expect(await store.load('acme-logistics/broken')).toBeUndefined()
  })

  it('reads a scope back from where it now lives, not from what it says inside', async () => {
    // Someone moved the folder in Finder. The scope is then at its new address
    // — any other answer means the screen disagrees with the folder.
    const { root, store } = setup()
    await store.save(scopeAt('acme/landscape', 'Landscape'))

    const from = await (await root.getDirectoryHandle('acme')).getDirectoryHandle('landscape')
    const to = await (await root.getDirectoryHandle('elsewhere', { create: true }))
      .getDirectoryHandle('renamed', { create: true })
    await copy(from, to)

    const back = await store.load('elsewhere/renamed')
    expect(back?.path).toEqual('elsewhere/renamed')
    expect(back?.model.name).toBe('Landscape')
  })

  it('does not write the path into the folder — where you filed it is not the reader’s business', async () => {
    const { root, store } = setup()
    await store.save(sampleScope())

    for (const path of root.paths()) {
      expect(path.endsWith('.svg') || !(await read(root, path)).includes('"ref"'), path).toBe(true)
    }
  })

  it('leaves the parent folder behind when the last scope in it goes', async () => {
    // The user may keep other things in there. Deleting a folder this store did
    // not create is not its call.
    const { root, store } = setup()
    await store.save(scopeAt('acme/only'))
    await store.remove('acme/only')

    await expect(root.getDirectoryHandle('acme')).resolves.toBeDefined()
    expect(await listed(store)).toEqual([])
  })

  it('dates a scope by its files, not by a field inside them', async () => {
    const { store } = setup()
    await store.save(sampleScope())
    const first = flattenScopes(await store.list())[1].updatedAt

    await store.save(sampleScope({ activeDiagramId: 'cd' }))
    const second = flattenScopes(await store.list())[1].updatedAt

    expect(first).toBeDefined()
    expect(second! > first!).toBe(true)
  })

  it('writes nothing at all when nothing changed', async () => {
    // The property the watcher, the sync client and `git status` all depend on:
    // an autosave of an untouched scope is not an event.
    const { root, store } = setup()
    await store.save(sampleScope())
    const before = await stamps(root)

    await store.save(sampleScope())

    expect(await stamps(root)).toEqual(before)
  })

  it('rewrites one file when one node moves', async () => {
    const { root, store } = setup()
    const scope = sampleScope()
    await store.save(scope)
    const before = await stamps(root)

    const moved = sampleScope()
    moved.model.diagrams[0].geometry.nodes = [{ id: 'crews', x: 999, y: 20 }]
    await store.save(moved)

    expect(await touched(before, await stamps(root)))
      .toEqual(['acme-logistics/landscape/diagrams/l7.geometry.json'])
  })

  it('clears up after a deleted diagram, and leaves what is not ours where it is', async () => {
    const { root, store } = setup()
    await store.save(sampleScope())
    const folder = await (await root.getDirectoryHandle('acme-logistics'))
      .getDirectoryHandle('landscape') as FakeDirectory
    folder.writeRaw('README.md', 'Read me first.')

    const fewer = sampleScope()
    fewer.model.diagrams = [fewer.model.diagrams[0]]
    await store.save(fewer)

    const paths = root.paths().map((path) => path.replace('acme-logistics/landscape/', ''))
    expect(paths).not.toContain('diagrams/cd.json')
    expect(paths).not.toContain('diagrams/cd.geometry.json')
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
    const store = new FileSystemScopeStore(gone)

    expect(await listed(store)).toEqual([])
    await expect(store.load('a/b')).resolves.toBeUndefined()
  })

  it('refuses to walk out of the folder it was given', async () => {
    const { store } = setup()
    const escape = '../escape'

    await expect(store.save({ ...sampleScope(), path: escape })).rejects.toThrow()
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
