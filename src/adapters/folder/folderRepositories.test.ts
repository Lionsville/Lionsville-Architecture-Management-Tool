// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The folder's repositories held to every suite, over the fake folder with a
 * history kept in memory. The same suites run over a real folder with the
 * machine's own git beside the desktop's handle (`desktop/`).
 */
import { describe, expect, it } from 'vitest'
import { dataUrl } from '../../projects/fileText'
import { describeHistoryRepository } from '../../ports/HistoryRepository.contract'
import { describeImageRepository } from '../../ports/ImageRepository.contract'
import { describeOrganisationIndex } from '../../ports/OrganisationIndex.contract'
import { ok, over } from '../../ports/Repositories.contract'
import type { RepositoriesUnderTest } from '../../ports/Repositories.contract'
import { describeScopeRepository } from '../../ports/ScopeRepository.contract'
import { sampleScope } from '../../ports/ScopeStore.contract'
import { describeSettingsRepository } from '../../ports/SettingsRepository.contract'
import { FakeDirectory } from './fakeDirectory'
import { folderRepositories } from './folderRepositories'
import { memoryGit } from './memoryGit'
import { FileSystemScopeStore } from './FileSystemScopeStore'
import { textAt, writeAt } from './handles'
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
