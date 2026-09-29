// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The folder's repositories held to every suite, over the fake folder with a
 * history kept in memory. The same suites run over a real folder with the
 * machine's own git beside the desktop's handle (`desktop/`).
 */
import { describe, expect, it } from 'vitest'
import { contentAddressOf } from '../../model/imageName'
import { dataUrl } from '../../projects/fileText'
import { describeHistoryRepository } from '../../ports/HistoryRepository.contract'
import { describeImageRepository } from '../../ports/ImageRepository.contract'
import { describeOrganisationIndex } from '../../ports/OrganisationIndex.contract'
import { addCrews, addDepot, ok, over, refusal, renameCrews, step } from '../../ports/Repositories.contract'
import type { RepositoriesUnderTest } from '../../ports/Repositories.contract'
import { describeScopeRepository } from '../../ports/ScopeRepository.contract'
import { sampleScope } from '../../ports/ScopeStore.contract'
import { describeSettingsRepository } from '../../ports/SettingsRepository.contract'
import type { DirectoryHandleLike } from './DirectoryHandle'
import { FakeDirectory } from './fakeDirectory'
import { folderRepositories } from './folderRepositories'
import { composed, identityAt } from './folderScopes'
import { memoryGit } from './memoryGit'
import { FileSystemScopeStore } from './FileSystemScopeStore'
import { removeAt, textAt, writeAt } from './handles'
import type { ScopeId } from '../../projects/scopeState'

function overFakeFolder(): RepositoriesUnderTest {
  const root = new FakeDirectory()
  const repositories = folderRepositories({ root, git: memoryGit(root) })
  return {
    repositories,
    // A model.json that is there and is not a model: the scope reads to be looked at, and takes no step.
    spoil: async (scope: ScopeId) => {
      const state = await repositories.scopes.state(scope)
      if (state) await writeAt(root, state.address ? `${state.address}/model.json` : 'model.json', '{ half a write')
    },
  }
}

describeScopeRepository('folder', overFakeFolder)
describeOrganisationIndex('folder', overFakeFolder)
describeHistoryRepository('folder', overFakeFolder)
describeImageRepository('folder', overFakeFolder)
describeSettingsRepository('folder', overFakeFolder)

/** A picture's bytes: a PNG's header, 64 by 32, and a tail that tells two apart. */
function png(tail: number): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 64, 0, 0, 0, 32, tail])
}

/** Every file of a folder, and what it holds, for knowing that nothing was written. */
async function contents(root: FakeDirectory): Promise<Record<string, string>> {
  const held: Record<string, string> = {}
  for (const path of root.paths()) held[path] = (await textAt(root, path)) ?? ''
  return held
}

/** A folder as the app's store writes it today: no identities, a picture in `images/`, and a description that shows it. */
async function folderOfToday(): Promise<FakeDirectory> {
  const root = new FakeDirectory()
  const store = new FileSystemScopeStore(root)
  await store.save({ ...sampleScope(), path: '', model: { name: 'Acme Logistics', elements: [], relations: [], diagrams: [] }, logoLibrary: [] })
  const scope = sampleScope({ path: 'acme', logoLibrary: [] })
  await store.save({
    ...scope,
    model: {
      ...scope.model,
      elements: scope.model.elements.map((one) => (one.id === 'crews'
        ? { ...one, description: 'The rota: ![Rota](../images/my%20rota.png) and ![Map](../images/map.png).' }
        : one)),
    },
    imageLibrary: [{ file: 'map.png', url: dataUrl('image/png', png(1)) }],
  })
  await writeAt(root, 'acme/images/my rota.png', png(2))
  await writeAt(root, 'acme/images/Kaart-ü.png', png(3))
  return root
}

describe('the folder, beyond what the suites say', () => {
  it('reads a folder of today without writing anything to it', async () => {
    const root = await folderOfToday()
    const before = await contents(root)
    const repositories = folderRepositories({ root, git: memoryGit(root) })
    const tree = await repositories.scopes.tree()
    const acme = tree.root.children[0].id
    await repositories.scopes.state(acme)
    await repositories.index.read()
    await repositories.images.list(acme, '')
    await repositories.history.entries({ scopes: [acme] })
    expect(await contents(root)).toEqual(before)
    expect((await repositories.scopes.tree()).root.children[0].id).toBe(acme)
  })

  it('names what a folder of today holds as the domain does, and gives a name to a file whose own does not pass', async () => {
    const root = await folderOfToday()
    const repositories = folderRepositories({ root, git: memoryGit(root) })
    const acme = (await repositories.scopes.tree()).root.children[0].id
    const state = (await repositories.scopes.state(acme))!
    expect(state.images.map((image) => [image.name, image.width, image.height])).toEqual([
      ['Kaart-ü.png', 64, 32], ['map.png', 64, 32], ['my-rota.png', 64, 32],
    ])
    expect(state.model.elements.find((one) => one.id === 'crews')?.description)
      .toBe('The rota: ![Rota](image:my-rota.png) and ![Map](image:map.png).')
    expect((await repositories.images.bytes(acme, 'my-rota.png'))?.bytes).toEqual(png(2))
  })

  it('writes an identity and the library into the header on the first step, renames no file, and keeps a document nobody changed as it was', async () => {
    const root = await folderOfToday()
    const repositories = over({ repositories: folderRepositories({ root, git: memoryGit(root) }) })
    const acme = (await repositories.scopes.tree()).root.children[0].id
    const described = await textAt(root, 'acme/docs/crews.md')
    await repositories.steps(acme, { type: 'element.update', id: 'reisinfo', patch: { name: 'Travel information' } })
    const header = JSON.parse((await textAt(root, 'acme/scope.json'))!) as { id: string; images: { name: string; file?: string }[] }
    expect(header.id).toBe(acme)
    expect(header.images.map((row) => [row.name, row.file])).toEqual([
      ['Kaart-ü.png', 'Kaart-ü.png'], ['map.png', undefined], ['my-rota.png', 'my rota.png'],
    ])
    expect(root.paths().filter((path) => path.startsWith('acme/images/')).sort())
      .toEqual(['acme/images/Kaart-ü.png', 'acme/images/map.png', 'acme/images/my rota.png'])
    expect(await textAt(root, 'acme/docs/crews.md')).toBe(described)
    expect((await repositories.scopes.tree()).root.children[0].id).toBe(acme)
  })

  it('writes a changed document’s pictures as the files they are kept as', async () => {
    const root = await folderOfToday()
    const repositories = over({ repositories: folderRepositories({ root, git: memoryGit(root) }) })
    const acme = (await repositories.scopes.tree()).root.children[0].id
    await repositories.steps(acme, { type: 'element.update', id: 'crews', patch: { description: 'Only ![Rota](image:my-rota.png).' } })
    expect(await textAt(root, 'acme/docs/crews.md')).toContain('Only ![Rota](../images/my%20rota.png).')
  })

  it('keeps a scope’s identity through a move of a folder that had none', async () => {
    const root = await folderOfToday()
    const repositories = over({ repositories: folderRepositories({ root, git: memoryGit(root) }) })
    const acme = (await repositories.scopes.tree()).root.children[0].id
    ok(await repositories.move(acme, 'globex/acme'))
    expect((await repositories.state(acme)).address).toBe('globex/acme')
    expect((JSON.parse((await textAt(root, 'globex/acme/scope.json'))!) as { id: string }).id).toBe(acme)
    expect(root.paths()).toContain('globex/acme/images/my rota.png')
  })

  it('keeps two image folders that differ in case in one folder, whatever the disk, and both names answer', async () => {
    const root = new FakeDirectory()
    const repositories = over({ repositories: folderRepositories({ root, git: memoryGit(root) }) })
    const acme = await repositories.scope('acme', 'Acme Logistics')
    for (const [name, tail] of [['A/x.png', 1], ['a/y.png', 2]] as const) {
      const { contentAddress } = ok(await repositories.images.put(acme, name, png(tail)))
      await repositories.steps(acme, { type: 'image.add', image: { name, mediaType: 'image/png', size: 25, width: 64, height: 32, contentAddress } })
    }
    expect(root.paths().filter((path) => path.startsWith('acme/images/'))).toEqual(['acme/images/A/x.png', 'acme/images/A/y.png'])
    expect((await repositories.images.bytes(acme, 'a/y.png'))?.bytes).toEqual(png(2))
    expect(await repositories.images.list(acme, 'a')).toMatchObject({ images: [{ name: 'a/y.png' }] })
  })

  it('writes nothing to the folder for bytes put and never added', async () => {
    const root = new FakeDirectory()
    const repositories = over({ repositories: folderRepositories({ root, git: memoryGit(root) }) })
    const acme = await repositories.scope('acme', 'Acme Logistics')
    const before = await contents(root)
    ok(await repositories.images.put(acme, 'context.png', png(1)))
    expect(await contents(root)).toEqual(before)
  })

  it('keeps a label named in another scope’s space that scope’s, even once the scope is gone', async () => {
    const root = new FakeDirectory()
    const git = memoryGit(root)
    const repositories = over({ repositories: folderRepositories({ root, git }) })
    const acme = await repositories.scope('acme', 'Acme Logistics')
    const [made] = await repositories.record('one')
    await git.tag(made.id.split('.')[0], 'a-removed-scope/board-review', 'Board review')
    const [entry] = (await repositories.history.entries({ scopes: [acme], limit: 1 })).entries
    expect(entry.labels).toEqual([])
    expect(await repositories.history.label(acme, entry.id, 'Board review')).toBe('done')
  })

  it('reads a label an older build put on the whole folder as a label of every scope’s entry there, and takes its word', async () => {
    const root = new FakeDirectory()
    const git = memoryGit(root)
    const repositories = over({ repositories: folderRepositories({ root, git }) })
    const acme = await repositories.scope('acme', 'Acme Logistics')
    const globex = await repositories.scope('globex', 'Globex')
    const made = await repositories.record('both')
    const sha = made[0].id.split('.')[0]
    await git.tag(sha, 'board-review', 'Board review')
    for (const scope of [acme, globex]) {
      const [entry] = (await repositories.history.entries({ scopes: [scope], limit: 1 })).entries
      expect(entry.labels).toEqual(['Board review'])
      expect(await repositories.history.label(scope, entry.id, 'Board Review!')).toBe('exists')
    }
  })
})

describe('the folder’s history of commits nobody marked', () => {
  /** Everything in the folder committed as a person would in a terminal: no trailer. */
  async function commitByHand(root: FakeDirectory, git: ReturnType<typeof memoryGit>, message: string): Promise<void> {
    await git.start()
    await git.commit((await git.changes()).map((change) => change.path), message)
  }

  it('counts one for the scope whose header said who it was, and never for one made there after it was removed', async () => {
    const root = await folderOfToday()
    const git = memoryGit(root)
    await commitByHand(root, git, 'By hand, before any identity')
    const repositories = over({ repositories: folderRepositories({ root, git }) })
    const acme = (await repositories.scopes.tree()).root.children[0].id
    const theirs = (await repositories.history.entries({ scopes: [acme] })).entries
    expect(theirs.map((entry) => entry.subject)).toEqual(['By hand, before any identity'])
    expect((await repositories.history.stateAt(acme, theirs[0].id))?.model.elements.map((one) => one.id)).toEqual(['crews', 'reisinfo'])

    ok(await repositories.remove(acme))
    const again = await repositories.scope('acme', 'Acme again')
    expect((await repositories.history.entries({ scopes: [again] })).entries).toEqual([])
    await commitByHand(root, git, 'By hand, after')
    expect((await repositories.history.entries({ scopes: [again] })).entries.map((entry) => entry.subject)).toEqual(['By hand, after'])
    expect(await repositories.history.stateAt(again, theirs[0].id)).toBeUndefined()
  })
})

/** A folder a stop cuts short: while `stopAt` names a file, writing it fails, as a page going away would. */
function stoppable(folder: DirectoryHandleLike): { handle: DirectoryHandleLike; stopAt(path: string | undefined): void } {
  let stopAt: string | undefined
  const wrap = (held: DirectoryHandleLike, inside: string): DirectoryHandleLike => {
    const at = (name: string) => (inside ? `${inside}/${name}` : name)
    return {
      kind: 'directory',
      name: held.name,
      getDirectoryHandle: async (name, options) => wrap(await held.getDirectoryHandle(name, options), at(name)),
      getFileHandle: async (name, options) => {
        const file = await held.getFileHandle(name, options)
        return {
          kind: 'file', name: file.name, getFile: () => file.getFile(),
          createWritable: () => (at(name) === stopAt ? Promise.reject(new Error('AbortError: the page went away')) : file.createWritable()),
        }
      },
      removeEntry: (name, options) => held.removeEntry(name, options),
      values: async function* () {
        for await (const entry of held.values()) {
          if (entry.kind === 'directory') yield wrap(entry, at(entry.name))
          else yield entry
        }
      },
    }
  }
  return { handle: wrap(folder, ''), stopAt: (path) => { stopAt = path } }
}

describe('a run across several scopes that stopped part way', () => {
  it('lands what did not land when it is sent again, and counts what did as landed', async () => {
    const root = new FakeDirectory('', { canMove: false })
    const { handle, stopAt } = stoppable(root)
    const repositories = over({ repositories: folderRepositories({ root: handle, git: memoryGit(root) }) })
    const acme = await repositories.scope('acme', 'Acme Logistics')
    const globex = await repositories.scope('globex', 'Globex')
    const run = [{ scope: acme, steps: [step(addCrews)] }, { scope: globex, steps: [step(addDepot)] }]
    stopAt('globex/model.json')
    await expect(repositories.apply(run)).rejects.toThrow()
    stopAt(undefined)
    expect((await repositories.state(acme)).model.elements.map((one) => one.id)).toEqual(['crews'])
    expect((await repositories.state(globex)).model.elements).toEqual([])
    const again = ok(await repositories.apply(run))
    expect((await repositories.state(acme)).model.elements.map((one) => one.id)).toEqual(['crews'])
    expect((await repositories.state(globex)).model.elements.map((one) => one.id)).toEqual(['depot'])
    expect(again.revisions).toEqual([(await repositories.state(acme)).revision, (await repositories.state(globex)).revision])
  })

  it('never applies a step that landed again over work done since, when it is sent again after another run', async () => {
    const root = new FakeDirectory('', { canMove: false })
    const { handle, stopAt } = stoppable(root)
    const repositories = over({ repositories: folderRepositories({ root: handle, git: memoryGit(root) }) })
    const acme = await repositories.scope('acme', 'Acme Logistics')
    const globex = await repositories.scope('globex', 'Globex')
    const run = [{ scope: acme, steps: [step(addCrews)] }, { scope: globex, steps: [step(addDepot)] }]
    stopAt('globex/model.json')
    await expect(repositories.apply(run)).rejects.toThrow()
    stopAt(undefined)
    await repositories.steps(acme, renameCrews)
    ok(await repositories.apply(run))
    expect((await repositories.state(acme)).model.elements.map((one) => one.name)).toEqual(['Crew planning'])
    expect((await repositories.state(globex)).model.elements.map((one) => one.id)).toEqual(['depot'])
  })

  it('counts a step whose write wrote nothing as applied nowhere: it may be sent to another scope', async () => {
    const root = new FakeDirectory('', { canMove: false })
    const { handle, stopAt } = stoppable(root)
    const repositories = over({ repositories: folderRepositories({ root: handle, git: memoryGit(root) }) })
    const acme = await repositories.scope('acme', 'Acme Logistics')
    const globex = await repositories.scope('globex', 'Globex')
    const once = step(addCrews)
    stopAt('acme/model.json')
    await expect(repositories.apply([{ scope: acme, steps: [once] }])).rejects.toThrow()
    stopAt(undefined)
    ok(await repositories.apply([{ scope: globex, steps: [once] }]))
    expect(refusal(await repositories.apply([{ scope: acme, steps: [once] }]))).toBe('step.elsewhere')
    expect((await repositories.state(acme)).model.elements).toEqual([])
  })
})

describe('a scope’s identity, when a folder is copied by hand', () => {
  it('stays with the folder it was last found at, and the copy is another scope', async () => {
    const root = new FakeDirectory()
    const repositories = over({ repositories: folderRepositories({ root, git: memoryGit(root) }) })
    const globex = await repositories.scope('globex', 'Globex')
    await repositories.steps(globex, addCrews)
    for (const path of root.paths().filter((one) => one.startsWith('globex/'))) {
      await writeAt(root, `acme/${path.slice('globex/'.length)}`, (await textAt(root, path))!)
    }
    const tree = await repositories.scopes.tree()
    const byAddress = new Map(tree.root.children.map((node) => [node.address, node.id]))
    expect(byAddress.get('globex')).toBe(globex)
    expect(byAddress.get('acme')).not.toBe(globex)
    expect((await repositories.state(globex)).address).toBe('globex')
  })
})

describe('an address as the domain is answered it', () => {
  it('is composed, and one identity, however the disk spells the folder back', () => {
    expect(composed('café/rail')).toBe('café/rail')
    expect(identityAt('café/rail')).toBe(identityAt('café/rail'))
  })
})

describe('what a scope’s pictures folder says, over what its rows say', () => {
  /** A PNG's header saying its size, and a tail of `length` bytes. */
  function picture(width: number, height: number, length = 1, fill = 7): Uint8Array {
    const bytes = new Uint8Array(24 + length).fill(fill)
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, width, 0, 0, 0, height])
    return bytes
  }

  async function withPicture() {
    const root = new FakeDirectory()
    const repositories = over({ repositories: folderRepositories({ root, git: memoryGit(root) }) })
    const acme = await repositories.scope('acme', 'Acme Logistics')
    const bytes = picture(64, 32)
    const { contentAddress } = ok(await repositories.images.put(acme, 'map.png', bytes))
    await repositories.steps(acme, { type: 'image.add', image: { name: 'map.png', mediaType: 'image/png', size: bytes.length, width: 64, height: 32, contentAddress } })
    return { root, repositories, acme }
  }

  it('lets a picture whose file was removed by hand leave the library, and its name be taken again', async () => {
    const { root, repositories, acme } = await withPicture()
    await removeAt(root, 'acme/images/map.png')
    expect((await repositories.state(acme)).images).toEqual([])
    expect(await repositories.images.find(acme, 'map.png')).toBeUndefined()
    const again = picture(10, 10)
    const { contentAddress } = ok(await repositories.images.put(acme, 'map.png', again))
    await repositories.steps(acme, { type: 'image.add', image: { name: 'map.png', mediaType: 'image/png', size: again.length, width: 10, height: 10, contentAddress } })
    expect((await repositories.images.bytes(acme, 'map.png'))?.bytes).toEqual(again)
  })

  it('keeps a picture added before its bytes were put, and writes them with the next step once they are', async () => {
    const root = new FakeDirectory()
    const repositories = over({ repositories: folderRepositories({ root, git: memoryGit(root) }) })
    const acme = await repositories.scope('acme', 'Acme Logistics')
    const bytes = picture(8, 8)
    const entry = { name: 'later.png', mediaType: 'image/png', size: bytes.length, width: 8, height: 8, contentAddress: await contentAddressOf(bytes) }
    await repositories.steps(acme, { type: 'image.add', image: entry })
    expect((await repositories.state(acme)).images).toEqual([entry])
    expect(root.paths()).not.toContain('acme/images/later.png')
    ok(await repositories.images.put(acme, 'later.png', bytes))
    expect((await repositories.images.bytes(acme, 'later.png'))?.bytes).toEqual(bytes)
    await repositories.steps(acme, addCrews)
    expect(root.paths()).toContain('acme/images/later.png')
    expect((await repositories.state(acme)).images).toEqual([entry])
  })

  it('describes a picture replaced by hand under its name afresh: its size, its dimensions and its bytes', async () => {
    const { root, repositories, acme } = await withPicture()
    const before = await repositories.state(acme)
    const replaced = picture(200, 100, 5)
    await writeAt(root, 'acme/images/map.png', replaced)
    const after = await repositories.state(acme)
    expect(after.images).toEqual([{
      name: 'map.png', mediaType: 'image/png', size: replaced.length, width: 200, height: 100, contentAddress: await contentAddressOf(replaced),
    }])
    expect(after.revision).not.toBe(before.revision)
  })
})
