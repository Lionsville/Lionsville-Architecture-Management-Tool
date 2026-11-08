// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What opening a view from a home waits on, over a folder of the dense
 * organisation (67 scopes, a 188-function sheet, 112 observations) whose every
 * call takes a millisecond, as a call from the page to the desktop's main
 * process does. The owner's limit for an open is 200 ms, and about 100 ms the
 * target.
 *
 * Before this was held, the press read the tree again to find the scope's
 * identity — a folder lists every scope and dates every file in it to answer
 * that, one call after another — and then read the scope the home had read
 * already: 330 to 890 ms on the desktop with nothing on screen moving. A view
 * of the home's own scope now opens from the document the home holds, and
 * another scope is read by the identity the listing holds.
 */
import { describe, expect, it } from 'vitest'
import { measureAsync } from '../model/testing/measure'
import { FakeDirectory } from '../adapters/folder/fakeDirectory'
import type { DirectoryHandleLike } from '../adapters/folder/FileSystemScopeStore'
import { folderRepositories } from '../adapters/folder/folderRepositories'
import { memoryGit } from '../adapters/folder/memoryGit'
import { DENSE_TEAM, seedDenseOrganisation } from '../adapters/folder/testing/denseOrganisation'
import { nodeAt, readScope, readScopeKnown, readScopesKnown, summaryOf } from '../projects/scopeAccess'
import { flattenScopes } from '../projects/scope'
import { ancestorScopes } from '../projects/scopePath'
import type { TreeView } from '../agent/tree'
import type { Place } from '../agent/place'
import { landingFor } from './placeLanding'

/**
 * What the page may wait on between a press on a home and the view: 28 ms
 * measured by the identity the listing holds, 630 ms before (52 ms with the
 * tree listed again, now that the listing is quick).
 */
const OPEN_FROM_HOME_MS = 100
/**
 * The tree listed for a home: a header and the files' dates per scope, 67 of
 * them. 23 ms measured once every scope is asked at once; 650 ms while they
 * were asked one after another.
 */
const LISTING_MS = 100
const CALL_MS = Number(process.env.CALL_MS ?? 1)

const later = () => (CALL_MS === 0 ? Promise.resolve() : new Promise<void>((resolve) => { setTimeout(resolve, CALL_MS) }))

/** A handle or a file, whose calls are slowed in turn; bytes and text are handed over as they are. */
const isHandle = (value: unknown): value is object => typeof value === 'object' && value !== null && !(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)

/** Every call into the folder a millisecond late, as across the desktop's channel; what it hands back slowed the same way. */
function slowed<T extends object>(held: T): T {
  return new Proxy(held, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver) as unknown
      if (typeof value !== 'function') return value
      return (...args: unknown[]) => {
        const answer = (value as (...a: unknown[]) => unknown).apply(target, args)
        if (answer instanceof Promise) {
          return answer.then((done: unknown) => later().then(() => (isHandle(done) ? slowed(done) : done)), (cause: unknown) => later().then(() => { throw cause }))
        }
        if (answer && typeof answer === 'object' && Symbol.asyncIterator in answer) {
          // A listing is one call, as the desktop's is, and its entries are then handed over here.
          const inner = answer as AsyncIterableIterator<unknown>
          let listed: Promise<void> | undefined
          const iterator: AsyncIterableIterator<unknown> = {
            next: () => (listed ??= later()).then(() => inner.next()).then((step) => (step.done || !isHandle(step.value) ? step : { ...step, value: slowed(step.value) })),
            [Symbol.asyncIterator]: () => iterator,
          }
          return iterator
        }
        return answer
      }
    },
  })
}

describe('opening a view from a home', () => {
  it('waits on nothing but the scope it opens, within the owner\'s limit', async () => {
    const root = new FakeDirectory('dense')
    await seedDenseOrganisation(folderRepositories({ root, git: memoryGit(root) }))
    const slow = slowed(root as DirectoryHandleLike)
    const { scopes } = folderRepositories({ root: slow, git: memoryGit(root) })
    // What the home holds once it is up: the listing, read once.
    const tree = await scopes.tree()
    const team = nodeAt(tree, DENSE_TEAM)!
    const before = await measureAsync('home → view, the tree read again first', async () => { await readScope(scopes, DENSE_TEAM) }, { runs: 3, warmup: 1 })
    const after = await measureAsync('home → view, by the identity the listing holds', async () => {
      if (!await readScopeKnown(scopes, DENSE_TEAM, team.id)) throw new Error('the scope did not read')
    }, { runs: 5, warmup: 1 })
    expect(before).toBeLessThan(OPEN_FROM_HOME_MS * 2)
    expect(after).toBeLessThan(OPEN_FROM_HOME_MS)
  })

  it('lists the tree for a home in one look at each scope\'s files, not one after another', async () => {
    const root = new FakeDirectory('dense')
    await seedDenseOrganisation(folderRepositories({ root, git: memoryGit(root) }))
    const { scopes } = folderRepositories({ root: slowed(root as DirectoryHandleLike), git: memoryGit(root) })
    const listed = await measureAsync('a home\'s listing of the dense tree', async () => { await scopes.tree() }, { runs: 3, warmup: 1 })
    expect(listed).toBeLessThan(LISTING_MS)
  })

  /**
   * The whole of what the shell waits on between a place asked for from a home
   * and the open: where the place lands (`landingFor`, which reads the scope
   * only where a record or a view is named), then the scope read. The team's
   * Observations names neither and reads the scope once; the landscape names
   * its board and reads it twice, by the identities the listing holds, never
   * listing the tree again. Before, the landing listed the tree and read the
   * scope and every scope above it, and the open read the scope again.
   */
  it('lands and opens the team\'s Observations and a landscape within the owner\'s limit', async () => {
    const root = new FakeDirectory('dense')
    await seedDenseOrganisation(folderRepositories({ root, git: memoryGit(root) }))
    const { scopes } = folderRepositories({ root: slowed(root as DirectoryHandleLike), git: memoryGit(root) })
    const listing = summaryOf(await scopes.tree())
    const ids = new Map(flattenScopes(listing).map((one) => [one.path, one.id]))
    const tree = {
      scopes: () => flattenScopes(listing).map((one) => ({ path: one.path, name: one.name, views: one.diagrams })),
      read: async (path: string) => {
        const [held, ...above] = await readScopesKnown(scopes, [path, ...ancestorScopes(path)], (address) => ids.get(address))
        return held && { model: held.model, ancestorDecisions: above.flatMap((one) => one?.model.decisions ?? []) }
      },
    } as unknown as TreeView
    const open = async (place: Place) => {
      const landed = await landingFor(place, tree, () => undefined)
      if (!await readScopeKnown(scopes, landed.scope, ids.get(landed.scope))) throw new Error('the scope did not read')
      return landed
    }
    const LANDSCAPE = 'domain-3/area-2/team-3'
    expect(await open({ scope: LANDSCAPE, page: 'board', id: 'landscape' })).toMatchObject({ page: 'board', id: 'landscape' })
    const observations = await measureAsync('home → the team\'s Observations', () => open({ scope: DENSE_TEAM, page: 'observations' }), { runs: 5, warmup: 1 })
    const landscape = await measureAsync('home → a team\'s landscape', () => open({ scope: LANDSCAPE, page: 'board', id: 'landscape' }), { runs: 5, warmup: 1 })
    expect(observations).toBeLessThan(OPEN_FROM_HOME_MS)
    expect(landscape).toBeLessThan(OPEN_FROM_HOME_MS)
  })
})
