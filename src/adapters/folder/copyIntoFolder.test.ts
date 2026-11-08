// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The copy from one place into a folder, over the folder's own repositories and
 * a large organisation: what `copyScopes.test.ts`, whose destination is memory,
 * cannot catch, because a folder is not memory. A folder lists its organisation
 * under its own name before anything is written there, keeps a drawing's picture
 * as a file of its own, and reads its whole tree off its files.
 *
 * Every comparison here reads the folder anew and goes by its own eyes, not by
 * what the copy said it did.
 */
import { describe, expect, it } from 'vitest'
import { MemoryStore } from '../memory/MemoryStore'
import { memoryRepositories } from '../memory/memoryRepositories'
import { SHELVES } from '../repositories/KeyedStore'
import { drawingPictureAddresses } from '../../model/drawing'
import { copyScopes, isWhole, surveyCopy } from '../../projects/copyScopes'
import type { CopyInto } from '../../projects/copyScopes'
import { contentOf, landed, nodesOf, placeTogether, readScope, stepOf } from '../../projects/scopeAccess'
import type { ScopeSnapshot } from '../../projects/scope'
import { stableJson } from '../../projects/text'
import type { Repositories } from '../../ports/Repositories'
import { FakeDirectory } from './fakeDirectory'
import { folderRepositories } from './folderRepositories'
import { memoryGit } from './memoryGit'
import { largeAddresses, seedLargeOrganisation } from './testing/largeOrganisation'

const FOLDER = 'my-folder'
const copy = (from: Repositories, into: CopyInto, signal?: AbortSignal) => copyScopes(from, into, signal ? { signal } : {})

async function places() {
  const store = new MemoryStore()
  const from = memoryRepositories(store)
  await seedLargeOrganisation(from)
  const root = new FakeDirectory(FOLDER)
  const into = folderRepositories({ root, git: memoryGit(root) })
  return { store, from, root, into, reopen: () => folderRepositories({ root, git: memoryGit(root) }) }
}

/** Everything a keyed store holds, as one text. */
async function everything(store: MemoryStore): Promise<string> {
  const held: Record<string, unknown> = {}
  await store.transaction(SHELVES, 'read', async (tx) => {
    for (const shelf of SHELVES) held[shelf] = await tx.range(shelf, {})
  })
  return JSON.stringify(held, (_key, value: unknown) => (value instanceof Uint8Array ? [...value] : value))
}

/** The ids of a list, wherever it sits in the tree, and what each holds. */
async function allOf(repositories: Repositories, list: string): Promise<Map<string, string>> {
  const found = new Map<string, string>()
  for (const node of nodesOf((await repositories.scopes.tree()).root)) {
    const state = await repositories.scopes.state(node.id)
    const rows = (state?.model as unknown as Record<string, { id?: string; key?: string }[] | undefined>)[list] ?? []
    rows.forEach((row, at) => found.set(`${node.address}#${row.id ?? row.key ?? at}`, stableJson(row)))
  }
  return found
}

/** Every list a scope's model holds, by name. */
const LISTS = [
  'elements', 'relations', 'diagrams', 'decisions', 'transitions', 'observations', 'causes', 'solutions', 'experiments', 'unitTypes', 'roles',
  'responsibilities', 'operatingRules', 'assignments', 'checkMarks', 'comments', 'principles', 'principleGroups', 'aspectScales', 'citations', 'evaluations',
]

describe('work brought into a folder that holds nothing yet', () => {
  it('brings the organisation itself, which a folder lists under its own name until somebody writes there', async () => {
    const { from, into, reopen } = await places()
    const tally = await copy(from, into)
    expect(tally).toMatchObject({ scopes: 67, kept: 0, failed: 0, unread: 0, already: 0, namesKept: [] })
    expect(isWhole(tally)).toBe(true)
    const root = await readScope(reopen().scopes, '')
    expect(root?.model.name).toBe('Northwind Holdings')
    expect(root?.model.elements).toHaveLength(183)
    expect(root?.model.description).toBe('The whole of it.')
    expect(root?.kind).toBe('organisation')
  })

  it('brings every scope, however deep', async () => {
    const { from, into, reopen } = await places()
    await copy(from, into)
    const addresses = nodesOf((await reopen().scopes.tree()).root).map((node) => node.address)
    expect(addresses.sort()).toEqual(largeAddresses().sort())
    expect(addresses).toContain('domain-1/area-1/team-1/deep-2')
  })

  it.each(LISTS)('brings every record of %s, the same by content', async (list) => {
    const { from, into, reopen } = await places()
    await copy(from, into)
    const here = await allOf(from, list)
    expect(here.size).toBeGreaterThan(0)
    const there = await allOf(reopen(), list)
    for (const [key, row] of here) expect(there.get(key)).toBe(row)
    expect(there.size).toBe(here.size)
  }, 30_000)

  it('brings what a scope says about itself: its kind, its logos and the view it opens on', async () => {
    const { from, into, reopen } = await places()
    await copy(from, into)
    const back = reopen()
    for (const address of ['', 'domain-1', 'domain-1/area-1/team-1/deep-2']) {
      const here = await readScope(from.scopes, address)
      const there = await readScope(back.scopes, address)
      expect(there?.kind).toBe(here?.kind)
      expect(there?.activeDiagramId).toBe(here?.activeDiagramId)
      expect(there?.logoLibrary.length).toBe(here?.logoLibrary.length)
    }
  })

  it('brings every picture\'s bytes', async () => {
    const { from, into, reopen } = await places()
    await copy(from, into)
    const back = reopen()
    const there = new Map(nodesOf((await back.scopes.tree()).root).map((node) => [node.address, node.id]))
    let seen = 0
    for (const node of nodesOf((await from.scopes.tree()).root)) {
      const state = (await from.scopes.state(node.id))!
      for (const image of state.images) {
        const held = await back.images.bytes(there.get(node.address)!, image.name)
        expect(held?.bytes).toEqual((await from.images.bytes(node.id, image.name))?.bytes)
        seen += 1
      }
    }
    expect(seen).toBe(67)
  })

  it('brings the picture each drawing shows, which no library names', async () => {
    const { from, into, reopen } = await places()
    await copy(from, into)
    const back = reopen()
    const there = new Map(nodesOf((await back.scopes.tree()).root).map((node) => [node.address, node.id]))
    let seen = 0
    for (const node of nodesOf((await from.scopes.tree()).root)) {
      const state = (await from.scopes.state(node.id))!
      for (const address of drawingPictureAddresses(state.model.diagrams)) {
        expect((await back.images.bytesAt(there.get(node.address)!, address))?.bytes).toEqual((await from.images.bytesAt(node.id, address))?.bytes)
        seen += 1
      }
    }
    expect(seen).toBe(67)
  })

  it('brings the register and the organisation\'s settings, which are kept outside any scope', async () => {
    const { from, into, reopen } = await places()
    await copy(from, into)
    const back = reopen()
    expect((await back.people.list()).people.map((one) => one.id).sort()).toEqual((await from.people.list()).people.map((one) => one.id).sort())
    expect(await back.settings.read({ of: 'organisation' })).toEqual(await from.settings.read({ of: 'organisation' }))
    expect(await into.settings.read({ of: 'person' })).toEqual(await from.settings.read({ of: 'person' }))
  })

  it('counts what it found there, by kind, and says the history stays where it is', async () => {
    const { from, into } = await places()
    const tally = await copy(from, into)
    expect(tally.counts).toMatchObject({ scopes: 67, people: 24, drawings: 67, pictures: 134, sheets: 2, comments: 134 })
    expect(tally.counts.elements).toBe((await allOf(from, 'elements')).size)
    expect(tally.counts.observations).toBe((await allOf(from, 'observations')).size)
    expect(tally.historyStays).toBe(true)
  })

  it('reads the destination\'s tree once, not once per scope: a folder\'s is its every file', async () => {
    const { from, into } = await places()
    let trees = 0
    const scopes = new Proxy(into.scopes, {
      get: (target, member) => (member === 'tree' ? () => { trees += 1; return target.tree() } : Reflect.get(target, member)),
    })
    await copyScopes(from, { ...into, scopes }, { check: into })
    expect(trees).toBe(1)
  })
})

describe('nothing taken from where it was', () => {
  it('leaves every shelf of the source as it was, byte for byte', async () => {
    const { store, from, into } = await places()
    const before = await everything(store)
    await copy(from, into)
    expect(await everything(store)).toBe(before)
  })

  it('leaves it so over a copy that fails, too', async () => {
    const { store, from, into } = await places()
    const before = await everything(store)
    await copyScopes(from, { ...into, scopes: { ...into.scopes, tree: () => into.scopes.tree(), state: (id) => into.scopes.state(id), create: () => Promise.reject(new Error('no')), apply: () => Promise.reject(new Error('no')), remove: (...args) => into.scopes.remove(...args) } })
    expect(await everything(store)).toBe(before)
  })
})

describe('run again, stopped, and over what is there', () => {
  it('finds a whole copy the same, and writes nothing', async () => {
    const { from, into, root } = await places()
    await copy(from, into)
    const revision = (await readScope(into.scopes, 'domain-1'))?.revision
    const tally = await copy(from, folderRepositories({ root, git: memoryGit(root) }))
    expect(tally).toMatchObject({ scopes: 0, already: 67, kept: 0, failed: 0 })
    expect(isWhole(tally)).toBe(true)
    expect(tally.counts.scopes).toBe(67)
    expect((await readScope(into.scopes, 'domain-1'))?.revision).toBe(revision)
  })

  it('brings what a build that left the organisation behind did not, and leaves the rest alone', async () => {
    const { from, into, root } = await places()
    // As that build left it: every scope but the organisation, its folder bare.
    const refusesRoot: CopyInto = {
      ...into,
      scopes: {
        tree: () => into.scopes.tree(), state: (id) => into.scopes.state(id), remove: (...args) => into.scopes.remove(...args), create: (...args) => into.scopes.create(...args),
        apply: async (work) => {
          const bare = (await into.scopes.tree()).root.id
          return work.some((one) => one.scope === bare) ? { refused: 'shell.scopeReadOnly', scope: bare } : into.scopes.apply(work)
        },
      },
    }
    expect(await copy(from, refusesRoot)).toMatchObject({ scopes: 66, failed: 1, missed: [''] })
    const tally = await copy(from, folderRepositories({ root, git: memoryGit(root) }))
    expect(tally).toMatchObject({ scopes: 1, already: 66, kept: 0, failed: 0 })
    expect(isWhole(tally)).toBe(true)
    expect((await readScope(into.scopes, ''))?.model.elements).toHaveLength(183)
  })

  it('stops between two scopes when asked, each of them whole, and a second run goes on from there', async () => {
    const { from, into, root } = await places()
    const stopping = new AbortController()
    let told = 0
    const tally = await copyScopes(from, into, { signal: stopping.signal, onProgress: () => { told += 1; if (told === 11) stopping.abort() } })
    expect(tally.stopped?.left).toBe(56)
    expect(tally.scopes).toBe(11)
    expect(isWhole(tally)).toBe(false)
    const again = await copy(from, folderRepositories({ root, git: memoryGit(root) }))
    expect(again).toMatchObject({ scopes: 67 - tally.scopes, already: tally.scopes })
    expect(isWhole(again)).toBe(true)
  })

  it('fills a scope a stopped copy made and never filled', async () => {
    const { from, into } = await places()
    const made = landed(await into.scopes.create('domain-1', { name: 'Scope 1', kind: 'landscape' }))
    expect(made.id).toBeDefined()
    expect(isWhole(await copy(from, into))).toBe(true)
    expect((await readScope(into.scopes, 'domain-1'))?.model.elements.length).toBeGreaterThan(0)
  })

  it('adds the picture of a drawing an earlier copy never brought, and counts the scope as brought', async () => {
    const { from, into, root } = await places()
    // As 3.8.2 left it: every scope, and no drawing's picture.
    await copyScopes(from, { ...into, images: { ...into.images, put: (scope, name, bytes) => (name === 'drawing.svg' ? Promise.resolve({ contentAddress: 'none' }) : into.images.put(scope, name, bytes)), bytes: (...args) => into.images.bytes(...args), bytesAt: (...args) => into.images.bytesAt(...args) } })
    const again = folderRepositories({ root, git: memoryGit(root) })
    const node = nodesOf((await again.scopes.tree()).root).find((one) => one.address === 'domain-1')!
    const [address] = drawingPictureAddresses((await again.scopes.state(node.id))!.model.diagrams)
    expect(await again.images.bytesAt(node.id, address)).toBeUndefined()
    const before = (await again.scopes.state(node.id))!.revision
    const tally = await copy(from, again)
    expect(tally).toMatchObject({ scopes: 67, kept: 0, already: 0 })
    expect(isWhole(tally)).toBe(true)
    const fresh = folderRepositories({ root, git: memoryGit(root) })
    expect(await fresh.images.bytesAt(node.id, address)).toBeDefined()
    expect((await fresh.scopes.state(node.id))!.revision).toBe(before)
  })

  it.each([[true], [false]])('reports writes that fail on a real folder, and a second run brings everything (can rename: %s)', async (canMove) => {
    const store = new MemoryStore()
    const from = memoryRepositories(store)
    await seedLargeOrganisation(from)
    const root = new FakeDirectory(FOLDER, { canMove })
    const failing = { left: 3 }
    const proto = FakeDirectory.prototype as unknown as { getFileHandle: (...held: unknown[]) => Promise<{ createWritable: () => Promise<{ close: () => Promise<void> }> }> }
    const was = proto.getFileHandle
    proto.getFileHandle = async function fails(this: unknown, ...held: unknown[]) {
      const handle = await was.apply(this, held)
      const making = handle.createWritable.bind(handle)
      handle.createWritable = async () => {
        const writable = await making()
        const closing = writable.close.bind(writable)
        writable.close = () => (failing.left-- > 0 ? Promise.reject(new Error('the disk said no')) : closing())
        return writable
      }
      return handle
    }
    const first = await copyScopes(from, folderRepositories({ root, git: memoryGit(root) })).finally(() => { proto.getFileHandle = was })
    expect(isWhole(first)).toBe(false)
    expect(first.failures.length).toBeGreaterThan(0)
    expect(first.scopes + first.failed).toBe(67)
    const again = await copy(from, folderRepositories({ root, git: memoryGit(root) }))
    expect(again).toMatchObject({ kept: 0, failed: 0 })
    expect(isWhole(again)).toBe(true)
    expect(again.scopes + again.already).toBe(67)
    expect((await readScope(folderRepositories({ root, git: memoryGit(root) }).scopes, ''))?.model.elements).toHaveLength(183)
  })

  it('writes over no work in the folder, says where it is before and after, and brings the rest', async () => {
    const { from, into } = await places()
    const theirs: ScopeSnapshot = { path: 'domain-2', activeDiagramId: '', logoLibrary: [], model: { name: 'Ours, here', description: 'Worked on in the folder.', elements: [], relations: [], diagrams: [] } }
    await placeTogether(into, [{ address: 'domain-2', content: contentOf(theirs, []) }])
    expect((await surveyCopy(from, into))).toMatchObject({ total: 67, differs: ['domain-2'] })
    const tally = await copy(from, into)
    expect(tally).toMatchObject({ scopes: 66, kept: 1, differs: ['domain-2'] })
    expect(isWhole(tally)).toBe(false)
    expect((await readScope(into.scopes, 'domain-2'))?.model).toMatchObject({ name: 'Ours, here', description: 'Worked on in the folder.' })
  })

  it('writes over newer work on a second run: never', async () => {
    const { from, into, root } = await places()
    await copy(from, into)
    const again = folderRepositories({ root, git: memoryGit(root) })
    const node = nodesOf((await again.scopes.tree()).root).find((one) => one.address === 'domain-3')!
    landed(await again.scopes.apply([{ scope: node.id, steps: [stepOf({ type: 'project.settings', patch: { description: 'Newer, in the folder.' } })] }]))
    const tally = await copy(from, again)
    expect(tally).toMatchObject({ scopes: 0, already: 66, kept: 1, differs: ['domain-3'] })
    expect((await readScope(again.scopes, 'domain-3'))?.model.description).toBe('Newer, in the folder.')
  })

  it('keeps a name somebody chose for an empty organisation, says so, and brings the rest under it', async () => {
    const { from, into } = await places()
    const root = (await into.scopes.tree()).root
    landed(await into.scopes.apply([{ scope: root.id, steps: [stepOf({ type: 'project.settings', patch: { name: 'Named by hand' } })] }]))
    const tally = await copy(from, into)
    expect(tally.namesKept).toEqual([''])
    expect(isWhole(tally)).toBe(true)
    const there = await readScope(into.scopes, '')
    expect(there?.model.name).toBe('Named by hand')
    expect(there?.model.elements).toHaveLength(183)
  })
})

describe('what did not come along is said', () => {
  it('reports a write that fails, by scope and with why, and goes on with the rest', async () => {
    const { from, into } = await places()
    const refusing: CopyInto = {
      ...into,
      scopes: {
        tree: () => into.scopes.tree(), state: (id) => into.scopes.state(id), apply: (work) => into.scopes.apply(work), remove: (...args) => into.scopes.remove(...args),
        create: (at, scope) => (at === 'domain-4/area-2' ? Promise.reject(new Error('the disk said no')) : into.scopes.create(at, scope)),
      },
    }
    const tally = await copy(from, refusing)
    expect(tally.missed).toEqual(['domain-4/area-2'])
    expect(tally.failures).toMatchObject([{ what: 'scope', address: 'domain-4/area-2', reason: 'the disk said no' }])
    expect(tally.failed).toBe(1)
    expect(isWhole(tally)).toBe(false)
    expect(tally.counts.scopes).toBe(66)
  })

  it('counts nothing that does not read back as it was sent', async () => {
    const { from, into } = await places()
    const losing: CopyInto = {
      ...into,
      scopes: {
        tree: () => into.scopes.tree(), apply: (work) => into.scopes.apply(work), remove: (...args) => into.scopes.remove(...args), create: (...args) => into.scopes.create(...args),
        state: async (id) => {
          const state = await into.scopes.state(id)
          return state && state.address === 'domain-1' ? { ...state, model: { ...state.model, elements: [] } } : state
        },
      },
    }
    const tally = await copy(from, losing)
    expect(tally.unlike).toEqual([{ address: 'domain-1', lists: ['elements'] }])
    expect(tally.counts.scopes).toBe(66)
    expect(isWhole(tally)).toBe(false)
  })

  it('reports a picture that did not land', async () => {
    const { from, into } = await places()
    const losing: CopyInto = { ...into, images: { put: (...args) => into.images.put(...args), bytesAt: (...args) => into.images.bytesAt(...args), bytes: () => Promise.resolve(undefined) } }
    const tally = await copy(from, losing)
    expect(tally.unlike[0].lists).toContain('images')
    expect(isWhole(tally)).toBe(false)
  })

  it('reports a register that would not come along, and does not call the scopes lost', async () => {
    const { from, into } = await places()
    const tally = await copy(from, { ...into, people: { list: () => into.people.list(), bringIn: () => Promise.reject(new Error('the register said no')) } })
    expect(tally.failures).toMatchObject([{ what: 'people', reason: 'the register said no' }])
    expect(tally.scopes).toBe(67)
    expect(isWhole(tally)).toBe(false)
  })

  it('leaves a scope read only in part where it is, and says so, rather than bring the part that read', async () => {
    const { from, into } = await places()
    const partly = {
      ...from,
      scopes: new Proxy(from.scopes, {
        get: (target, member) => (member === 'state'
          ? async (id: string) => {
            const state = await target.state(id)
            return state?.address === 'domain-2' ? { ...state, unreadable: ['model.json'] } : state
          }
          : Reflect.get(target, member)),
      }),
    }
    const tally = await copy(partly, into)
    expect(tally).toMatchObject({ unread: 1, missed: ['domain-2'] })
    expect(isWhole(tally)).toBe(false)
  })
})
