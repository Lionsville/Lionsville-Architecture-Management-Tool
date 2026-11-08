// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The example kept into a folder, over the folder's own repositories: what
 * `projects/examples/copy.test.ts`, whose destination is memory, cannot catch.
 * A folder lists its organisation under the folder's own name before anything
 * is written there, and a keep that read that name as somebody's filed the
 * example under an organisation called after the folder, with its operating
 * model in a scope where nothing reads one.
 *
 * Every assertion reads the folder anew, and the files on it, not what the keep
 * said it did.
 */
import { describe, expect, it } from 'vitest'
import acmeLogistics from './format/examples/acme-logistics.json' with { type: 'json' }
import { exampleScopes } from './format/exampleFolder'
import type { ExampleFolder } from './format/exampleFolder'
import { memoryRepositories } from '../memory/memoryRepositories'
import { EXAMPLE_CATALOGUE } from '../../projects/examples/catalogue'
import { exampleCopyOver, keepAsks, keepVisit, ORGANISATION_ONLY, placeCopy } from '../../projects/examples/copy'
import { organisationHoldsWork } from '../../projects/organisationWork'
import { nodesOf, readScope, summaryOf } from '../../projects/scopeAccess'
import { emptyContent } from '../../projects/scopeState'
import { placeWhole } from '../../projects/scopeAccess'
import { FakeDirectory } from './fakeDirectory'
import { folderRepositories } from './folderRepositories'
import { memoryGit } from './memoryGit'

const FOLDER = 'work1'
const entry = EXAMPLE_CATALOGUE[0]
const named = { key: entry.key, label: entry.label, description: entry.description, path: entry.path }

/** The example as a visit has it: the shipped organisation, in memory, at the root. */
async function visit() {
  const from = memoryRepositories()
  await placeCopy(from, await exampleCopyOver(from.scopes, { ...entry, scopes: exampleScopes(acmeLogistics as ExampleFolder, entry.path) }))
  return from
}

function folder(seed?: (root: FakeDirectory) => void) {
  const root = new FakeDirectory(FOLDER)
  seed?.(root)
  return { root, into: folderRepositories({ root, git: memoryGit(root) }), reopen: () => folderRepositories({ root, git: memoryGit(root) }) }
}

/** The organisation's lists only it reads, by name and length, off the folder read anew. */
async function organisationOnlyAt(repositories: ReturnType<typeof folder>['into'], address: string): Promise<Record<string, number>> {
  const model = (await readScope(repositories.scopes, address))?.model as Record<string, unknown[] | undefined> | undefined
  return Object.fromEntries(ORGANISATION_ONLY.map((list) => [list, model?.[list]?.length ?? 0]))
}

describe('the example kept into an empty folder', () => {
  it('is listed under the folder\'s name, and that name is nobody\'s: no work, nothing to ask', async () => {
    const { into } = folder()
    const tree = summaryOf(await into.scopes.tree())
    expect(tree.name).toBe(FOLDER)
    expect(tree.unnamed).toBe(true)
    expect(organisationHoldsWork(tree, await readScope(into.scopes, ''))).toBe(false)
    expect(await keepAsks(into.scopes)).toBe(false)
  })

  it('becomes the organisation: its header at the root, its operating model and principles there, and no child named after it', async () => {
    const { root, into, reopen } = folder()
    expect(await keepVisit((await visit()).scopes, into, named)).toEqual({})
    const files = root.paths()
    expect(files).toContain('scope.json')
    expect(files.some((path) => path.startsWith('_operating/'))).toBe(true)
    expect(files.some((path) => path.startsWith('_principles/'))).toBe(true)
    expect(files.some((path) => path.startsWith('acme-logistics/'))).toBe(false)
    const back = reopen()
    const tree = summaryOf(await back.scopes.tree())
    expect(tree.name).toBe('Acme Logistics')
    expect(tree.unnamed).toBeUndefined()
    expect(tree.children.map((child) => child.path).sort()).toEqual(['application-landscape', 'platforms', 'topics'])
    const organisation = await readScope(back.scopes, '')
    expect(organisation?.kind).toBe('organisation')
    const only = await organisationOnlyAt(back, '')
    expect(only.unitTypes).toBeGreaterThan(0)
    expect(only.roles).toBeGreaterThan(0)
    expect(organisation?.model.principles?.length).toBeGreaterThan(0)
  })
})

describe('the example kept into a folder whose root is blank but named after the folder', () => {
  // What a folder holds before anybody wrote a scope there: the app's own settings
  // folder, a file of somebody's own, and no `scope.json` at the root.
  const seeded = (root: FakeDirectory) => {
    root.writeRaw('README.txt', 'notes, not a scope')
    void root.getDirectoryHandle('.lionsville-architecture', { create: true }).then((own) => (own as FakeDirectory).writeRaw('local.json', '{}'))
  }

  it('reads as an organisation nobody started, and the example becomes it', async () => {
    const { root, into, reopen } = folder(seeded)
    expect(summaryOf(await into.scopes.tree())).toMatchObject({ name: FOLDER, unnamed: true, children: [] })
    expect(await keepAsks(into.scopes)).toBe(false)
    await keepVisit((await visit()).scopes, into, named)
    expect(root.paths()).toEqual(expect.arrayContaining(['README.txt', '.lionsville-architecture/local.json']))
    expect(root.paths()).toContain('scope.json')
    expect((await readScope(reopen().scopes, ''))?.model.name).toBe('Acme Logistics')
  })

  it('still holds work where somebody wrote the folder\'s own name as the organisation\'s: a header written is a name chosen', async () => {
    const { into } = folder()
    await placeWhole(into.scopes, '', { ...emptyContent(FOLDER), kind: 'organisation' })
    expect(summaryOf(await into.scopes.tree()).unnamed).toBeUndefined()
    expect(await keepAsks(into.scopes)).toBe(true)
  })
})

describe('the example kept into a folder whose organisation holds work', () => {
  async function withWork() {
    const made = folder()
    await placeWhole(made.into.scopes, '', {
      ...emptyContent('Globex'), kind: 'organisation',
      model: { ...emptyContent('Globex').model, unitTypes: [], roles: [], elements: [{ id: 'ours', kind: 'application', name: 'Our system' } as never] },
    })
    return made
  }

  it('asks first', async () => {
    const { into } = await withWork()
    expect(await keepAsks(into.scopes)).toBe(true)
  })

  it('is filed under a scope of its own, without what only the organisation reads, and the organisation is as it was', async () => {
    const { root, into, reopen } = await withWork()
    const before = await readScope(into.scopes, '')
    expect(await keepVisit((await visit()).scopes, into, named)).toEqual({ under: 'acme-logistics' })
    const files = root.paths()
    expect(files).toContain('acme-logistics/scope.json')
    expect(files.some((path) => path.startsWith('acme-logistics/_operating/'))).toBe(false)
    // Principles are read by their own scope and every scope below (ADR-0041): they come.
    expect(files.some((path) => path.startsWith('acme-logistics/_principles/'))).toBe(true)
    expect(files.some((path) => path.startsWith('_operating/'))).toBe(false)
    const back = reopen()
    expect(await organisationOnlyAt(back, 'acme-logistics')).toEqual(Object.fromEntries(ORGANISATION_ONLY.map((list) => [list, 0])))
    const after = await readScope(back.scopes, '')
    expect(after?.model).toEqual(before?.model)
    expect(nodesOf((await back.scopes.tree()).root).map((node) => node.address)).toContain('acme-logistics/application-landscape')
  })

  it('never writes into an organisation\'s operating model, an empty one included', async () => {
    const { into, reopen } = await withWork()
    await keepVisit((await visit()).scopes, into, named)
    expect(await organisationOnlyAt(reopen(), '')).toEqual(Object.fromEntries(ORGANISATION_ONLY.map((list) => [list, 0])))
  })
})
