// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { describeScopeStore, SAMPLE_PATH, sampleScope, scopeAt } from '../../ports/ScopeStore.contract'
import { flattenScopes } from '../../projects/scope'
import { RecordingDiagnostics } from '../memory/RecordingDiagnostics'
import { FakeDirectory, refusingReads } from './fakeDirectory'
import { FileSystemScopeStore } from './FileSystemScopeStore'
import type { DirectoryHandleLike, FileHandleLike } from './FileSystemScopeStore'

describeScopeStore('folder on disk', () => new FileSystemScopeStore(new FakeDirectory()), {
  refusing: () => {
    const held = refusingReads(new FakeDirectory())
    return {
      store: new FileSystemScopeStore(held.handle),
      refuse: (path, file) => held.refuse(file === undefined ? undefined : [path, file].filter(Boolean).join('/')),
    }
  },
})

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

  it('skips a scope whose header is corrupt rather than failing the whole listing, and says which', async () => {
    // Half a write, a sync client's leftovers, something edited by hand.
    // Hiding the other scopes behind it would be a worse answer than leaving
    // it out — and leaving it out in silence offers its address as free.
    const { root, store } = setup()
    await store.save(sampleScope())
    const broken = await (await root.getDirectoryHandle('acme-logistics'))
      .getDirectoryHandle('broken', { create: true }) as FakeDirectory
    broken.writeRaw('scope.json', '{ "name": ')

    expect(await listed(store)).toEqual(['acme-logistics/landscape'])
    expect((await store.list()).unreadable).toEqual(['acme-logistics/broken'])
    expect(await store.load('acme-logistics/broken')).toBeUndefined()
  })

  it('writes no new scope over a header this build cannot read', async () => {
    // A newer build's scope: not listed, not opened — and so an address that
    // looks free to a person creating a scope, with a model beside it.
    const { root, store } = setup()
    await store.save(scopeAt('acme/later'))
    const later = await (await root.getDirectoryHandle('acme')).getDirectoryHandle('later') as FakeDirectory
    const header = JSON.stringify({ type: 'lionsville-architecture', version: 99, name: 'Later', diagrams: ['l7'] })
    later.writeRaw('scope.json', header)
    const model = await read(root, 'acme/later/model.json')

    expect((await store.list()).unreadable).toEqual(['acme/later'])
    await expect(store.save(scopeAt('acme/later', 'Fresh'))).rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })
    expect(await read(root, 'acme/later/scope.json')).toBe(header)
    expect(await read(root, 'acme/later/model.json')).toBe(model)
  })

  it('lists the rest of the tree past a folder that will not list, and names that folder', async () => {
    const { root, store } = setup()
    await store.save(scopeAt('acme/rail'))
    await store.save(scopeAt('acme/locked/inside'))
    await store.save(scopeAt('other'))
    const diagnostics = new RecordingDiagnostics()
    const held = new FileSystemScopeStore(
      refusing(root, { list: 'locked', cause: new Error('NotAllowedError: permission withdrawn') }), diagnostics,
    )

    const tree = await held.list()
    expect(flattenScopes(tree).map((scope) => scope.path).sort()).toEqual(['', 'acme/rail', 'other'])
    expect(tree.unreadable).toEqual(['acme/locked'])
    expect(diagnostics.recent().map((entry) => entry.message)).toEqual(['a folder of the tree could not be read'])
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

    expect(touched(before, await stamps(root)))
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

  /**
   * A cause is filed one folder deeper than anything else (ADR-0021). The
   * walk that lists a scope's files has to go in there, or the file is
   * written on every save and read on none — which is how a team's root
   * causes vanished the first time the scope was reopened.
   */
  it('reads the causes back from observations/causes/, one folder deeper than the rest', async () => {
    const { root, store } = setup()
    const scope = sampleScope()
    scope.model.observations = [{
      id: 'ob-1', number: 1, title: 'Batch overruns', date: '2026-09-08', impact: 'major', seen: 2, body: 'Seen twice.',
      history: [{ date: '2026-09-08', kind: 'recorded' }],
    }]
    scope.model.causes = [{
      id: 'ca-1', number: 1, title: 'Window sized for 2019', state: 'verified', body: 'Volumes doubled.',
      explains: [{ id: 'ob-1', strength: 'strong' }],
    }]
    await store.save(scope)

    const paths = root.paths().map((path) => path.replace('acme-logistics/landscape/', ''))
    expect(paths).toContain('observations/0001-batch-overruns.md')
    expect(paths).toContain('observations/causes/0001-window-sized-for-2019.md')

    const back = await store.load(scope.path)
    expect(back?.model.causes).toEqual(scope.model.causes)
    expect(back?.model.observations).toEqual(scope.model.observations)

    // And a cause that is gone from the model is gone from the folder too.
    delete scope.model.causes
    await store.save(scope)
    expect(root.paths().some((path) => path.includes('observations/causes/'))).toBe(false)
  })

  /** The same walk, two more folders (ADR-0026): a solution and an experiment come back. */
  it('reads the solutions and the experiments back from their folders under observations/', async () => {
    const { root, store } = setup()
    const scope = sampleScope()
    scope.model.solutions = [{
      id: 'so-1', number: 1, title: 'Widen the window', state: 'testing', benefit: 'medium', cost: 'small',
      addresses: [{ id: 'ca-1', strength: 'strong' }], validatedWith: ['Operations'],
      attempts: [{ when: '2023', what: 'Faster disks', why: 'Volumes grew faster' }], whyNow: 'Volumes are known now',
      body: 'One idea.', history: [{ date: '2026-09-20', kind: 'proposed' }, { date: '2026-09-21', kind: 'moved', to: 'shaped' }],
    }]
    scope.model.experiments = [{
      id: 'ex-1', number: 1, title: 'One week at night', tests: ['so-1'], hypothesis: 'Done by 06:00',
      outcome: 'running', from: '2026-09-22', body: 'Set up.',
    }]
    await store.save(scope)

    const paths = root.paths().map((path) => path.replace('acme-logistics/landscape/', ''))
    expect(paths).toContain('observations/solutions/0001-widen-the-window.md')
    expect(paths).toContain('observations/experiments/0001-one-week-at-night.md')

    const back = await store.load(scope.path)
    expect(back?.model.solutions).toEqual(scope.model.solutions)
    expect(back?.model.experiments).toEqual(scope.model.experiments)
  })

  /**
   * A `model.json` somebody's merge left markers in, or a sync client wrote
   * half of. Read as empty, the next save wrote an empty model over it and
   * removed every description beside it — the scope's documents, gone
   * because a brace was.
   */
  it('opens a scope whose model.json does not parse to be read, and deletes nothing on the next save', async () => {
    const { root, store } = setup()
    const scope = sampleScope()
    scope.model.elements = scope.model.elements.map((one) => ({ ...one, description: `All about ${one.name}.` }))
    await store.save(scope)
    const folder = await (await root.getDirectoryHandle('acme-logistics'))
      .getDirectoryHandle('landscape') as FakeDirectory
    const broken = '{\n  "elements": [\n<<<<<<< HEAD\n'
    folder.writeRaw('model.json', broken)
    const before = root.paths()

    const opened = await store.load(scope.path)
    expect(opened?.unreadable).toEqual(['model.json'])

    // The snapshot as opened, and one rebuilt without the mark: both refused.
    await expect(store.save(opened!)).rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })
    await expect(store.save({ ...opened!, unreadable: undefined })).rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })

    expect(root.paths()).toEqual(before)
    expect(root.paths()).toContain('acme-logistics/landscape/docs/crews.md')
    expect(await (await (await folder.getFileHandle('model.json')).getFile()).text()).toBe(broken)
    // The index does not count it as a scope that defines nothing.
    expect((await store.models()).map((held) => held.path)).not.toContain(scope.path)
    expect(await store.descriptions(scope.path)).toBeUndefined()
  })

  /**
   * A file that is there and will not read — a sync client holding it,
   * permission withdrawn — was left out of the scope it was opened as, and the
   * next save removed it as a file the scope no longer wanted. Nobody had
   * wanted that: the read never held it. A save removes only what a read took
   * in (ADR-0028, amended).
   */
  describe('a file the read did not take in', () => {
    const described = () => {
      const scope = sampleScope()
      scope.model.elements = scope.model.elements.map((one) => ({ ...one, description: `All about ${one.name}.` }))
      return scope
    }
    const landscape = async (root: FakeDirectory) => await (await root.getDirectoryHandle('acme-logistics'))
      .getDirectoryHandle('landscape') as FakeDirectory

    it('keeps a description it could not read through the next save, and writes the rest', async () => {
      const { root, store } = setup()
      await store.save(described())
      const held = new FileSystemScopeStore(refusing(root, { read: 'crews.md', cause: new Error('NotReadableError: held open') }))

      const opened = await held.load(SAMPLE_PATH)
      expect(opened?.unread).toEqual(['docs/crews.md'])
      expect(opened?.unreadable).toBeUndefined()
      await held.save({ ...opened!, model: { ...opened!.model, name: 'Renamed' } })

      const again = await store.load(SAMPLE_PATH)
      expect(again?.model.name).toBe('Renamed')
      expect(again?.model.elements.find((one) => one.id === 'crews')?.description).toBe('All about Crews.')
    })

    it('keeps a picture it could not read through the next save', async () => {
      const { root, store } = setup()
      await store.save({ ...described(), imageLibrary: [{ file: 'map.png', url: 'data:image/png;base64,iVBORw0KGgo=' }] })
      const held = new FileSystemScopeStore(refusing(root, { read: 'map.png', cause: new Error('NotReadableError: held open') }))

      const opened = await held.load(SAMPLE_PATH)
      expect(opened?.imageLibrary).toBeUndefined()
      expect(opened?.unread).toEqual(['images/map.png'])
      await held.save(opened!)

      expect(root.paths()).toContain('acme-logistics/landscape/images/map.png')
      expect((await store.load(SAMPLE_PATH))?.imageLibrary?.map((one) => one.file)).toEqual(['map.png'])
    })

    it('opens a scope whose model.json will not read to be looked at, and writes nothing over it', async () => {
      const { root, store } = setup()
      await store.save(described())
      const before = root.paths()
      const model = await read(root, 'acme-logistics/landscape/model.json')
      const held = new FileSystemScopeStore(refusing(root, { read: 'model.json', cause: new Error('NotReadableError: held open') }))

      const opened = await held.load(SAMPLE_PATH)
      expect(opened?.unreadable).toEqual(['model.json'])

      // As opened; rebuilt without the mark while the file still will not
      // read; and rebuilt without the mark once it reads again, by a session
      // that carried what its read left out — all refused.
      await expect(held.save(opened!)).rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })
      await expect(held.save({ ...opened!, unreadable: undefined, unread: undefined }))
        .rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })
      await expect(store.save({ ...opened!, unreadable: undefined }))
        .rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })

      expect(root.paths()).toEqual(before)
      expect(await read(root, 'acme-logistics/landscape/model.json')).toBe(model)
      expect((await store.load(SAMPLE_PATH))?.model.elements.map((one) => one.description))
        .toEqual(['All about Crews.', 'All about Reisinformatie.'])
    })

    it('keeps a view whose definition does not parse, and its geometry, through the next save', async () => {
      const { root, store } = setup()
      await store.save(described())
      const folder = await landscape(root)
      const diagrams = await folder.getDirectoryHandle('diagrams') as FakeDirectory
      diagrams.writeRaw('cd.json', '{ "id": "cd", <<<<<<< HEAD')

      const opened = await store.load(SAMPLE_PATH)
      expect(opened?.model.diagrams.map((one) => one.id)).toEqual(['l7'])
      expect(opened?.unread).toEqual(['diagrams/cd.geometry.json', 'diagrams/cd.json'])
      await store.save(opened!)

      expect(root.paths()).toContain('acme-logistics/landscape/diagrams/cd.json')
      expect(root.paths()).toContain('acme-logistics/landscape/diagrams/cd.geometry.json')
    })

    it('refuses a save that would write over a file its read did not take in', async () => {
      const { root, store } = setup()
      await store.save(described())
      const held = new FileSystemScopeStore(refusing(root, { read: 'crews.md', cause: new Error('NotReadableError: held open') }))
      const opened = await held.load(SAMPLE_PATH)

      const written = { ...opened!, model: { ...opened!.model, elements: opened!.model.elements
        .map((one) => (one.id === 'crews' ? { ...one, description: 'Written over.' } : one)) } }
      await expect(store.save(written)).rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })
      expect(await read(root, 'acme-logistics/landscape/docs/crews.md')).toContain('All about Crews.')
    })

    it('neither writes over nor removes a file that will not read now, whoever made the snapshot', async () => {
      const { root, store } = setup()
      await store.save(described())
      const held = new FileSystemScopeStore(refusing(root, { read: 'reisinfo.md', cause: new Error('NotReadableError: held open') }))

      const fewer = described()
      fewer.model.elements = fewer.model.elements.filter((one) => one.id !== 'reisinfo')
      await held.save(fewer)
      expect(root.paths()).toContain('acme-logistics/landscape/docs/reisinfo.md')

      await expect(held.save(described())).rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })
    })
  })

  it('rejects a walk of the tree that fails, rather than answering that the tree defines nothing', async () => {
    const gone = {
      kind: 'directory' as const,
      name: 'gone',
      getDirectoryHandle: () => Promise.reject(new Error('NotAllowedError')),
      getFileHandle: () => Promise.reject(new Error('NotAllowedError')),
      removeEntry: () => Promise.reject(new Error('NotAllowedError')),
      // eslint-disable-next-line require-yield
      values: async function* () { throw new Error('NotAllowedError') },
    }
    await expect(new FileSystemScopeStore(gone).models()).rejects.toThrow('NotAllowedError')
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
    // Empty, and said to be unread: nothing is known to be free in it.
    expect((await store.list()).unreadable).toEqual([''])
    await expect(store.load('a/b')).resolves.toBeUndefined()
  })

  /**
   * A file that is there and will not read — held open by a sync client,
   * permission withdrawn — was answered as a file that is not there, and
   * nothing anywhere said so: the scope opened without that description and
   * nobody could tell why. It still opens; the trail now says it.
   */
  it('says on the trail a file that is there and will not read, and opens the rest of the scope', async () => {
    const { root, store } = setup()
    const scope = sampleScope()
    scope.model.elements = scope.model.elements.map((one) => ({ ...one, description: `All about ${one.name}.` }))
    await store.save(scope)

    const diagnostics = new RecordingDiagnostics()
    const held = new FileSystemScopeStore(
      refusing(root, { read: 'crews.md', cause: new Error('NotReadableError: held open') }), diagnostics,
    )
    const opened = await held.load(scope.path)
    expect(opened?.model.elements.find((one) => one.id === 'reisinfo')?.description).toBe('All about Reisinformatie.')
    expect(opened?.model.elements.find((one) => one.id === 'crews')?.description).toBeUndefined()
    expect(await held.descriptions(scope.path)).not.toHaveProperty('crews')

    const said = diagnostics.recent()
    expect(said.map((entry) => [entry.level, entry.where, entry.message])).toEqual([
      ['warn', 'folder', 'a file of the scope could not be read'],
      ['warn', 'folder', 'a description could not be read'],
    ])
    // What was being read, and never which file: a path off the user's disk is theirs.
    expect(said.every((entry) => !entry.message.includes('crews'))).toBe(true)
  })

  it('says nothing about a folder the format may write and has not', async () => {
    const { root } = setup()
    const diagnostics = new RecordingDiagnostics()
    const store = new FileSystemScopeStore(root, diagnostics)
    await store.save(sampleScope())

    await store.load(sampleScope().path)
    await store.descriptions(sampleScope().path)
    await store.models()
    await store.list()
    expect(diagnostics.recent()).toEqual([])
  })

  /** A file the format no longer writes that stays is a deleted diagram that comes back on the next open. */
  it('says so when a file the format no longer writes will not go, and still saves the rest', async () => {
    const { root, store } = setup()
    await store.save(sampleScope())

    const diagnostics = new RecordingDiagnostics()
    const held = new FileSystemScopeStore(
      refusing(root, { remove: 'cd.json', cause: new Error('NoModificationAllowedError: locked') }), diagnostics,
    )
    const fewer = sampleScope()
    fewer.model.diagrams = [fewer.model.diagrams[0]]
    await held.save(fewer)

    expect(root.paths()).toContain('acme-logistics/landscape/diagrams/cd.json')
    expect(root.paths()).not.toContain('acme-logistics/landscape/diagrams/cd.geometry.json')
    expect(diagnostics.recent().map((entry) => entry.message))
      .toEqual(['a file the format no longer writes could not be removed'])
  })

  it('refuses to walk out of the folder it was given', async () => {
    const { store } = setup()
    const escape = '../escape'

    await expect(store.save({ ...sampleScope(), path: escape })).rejects.toThrow()
    await expect(store.load(escape)).resolves.toBeUndefined()
    await expect(store.remove(escape)).resolves.toBeUndefined()
  })
})

/**
 * The same folder, with one file's reads or its removal refused the way a
 * file a sync client holds, or a folder somebody locked, refuses them.
 */
function refusing(
  folder: DirectoryHandleLike, what: { read?: string; remove?: string; list?: string; cause: Error },
): DirectoryHandleLike {
  const file = (handle: FileHandleLike): FileHandleLike => handle.name !== what.read ? handle : {
    kind: 'file',
    name: handle.name,
    getFile: () => Promise.reject(what.cause),
    createWritable: () => handle.createWritable(),
  }
  const wrap = (held: DirectoryHandleLike): DirectoryHandleLike => ({
    kind: 'directory',
    name: held.name,
    getDirectoryHandle: async (name, options) => wrap(await held.getDirectoryHandle(name, options)),
    getFileHandle: async (name, options) => file(await held.getFileHandle(name, options)),
    removeEntry: (name, options) => name === what.remove ? Promise.reject(what.cause) : held.removeEntry(name, options),
    values: async function* () {
      if (held.name === what.list) throw what.cause
      for await (const entry of held.values()) yield entry.kind === 'directory' ? wrap(entry) : file(entry)
    },
  })
  return wrap(folder)
}

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
