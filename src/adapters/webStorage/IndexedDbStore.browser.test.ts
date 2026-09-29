// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The store, the repositories and a folder's history over a real browser's
 * IndexedDB, in Chromium and WebKit (`vitest.browser.config.ts`, `npm run test:browser`).
 *
 * The same contract and suites node runs over a fake, and what only a browser
 * can show: a digest awaited inside a transaction, a page that goes away
 * half-way through a write, a second tab on either side of an upgrade, a
 * database an earlier build laid out, two tabs recording a folder's history
 * at once, and a quota the browser enforces. A second tab is a frame of this page's origin,
 * which opens the same database as a tab does and goes when it is removed.
 */
import { describe, expect, it, vi } from 'vitest'
import { server } from 'vitest/browser'
import { ShellError } from '../../platform/errors'
import { describeHistoryRepository } from '../../ports/HistoryRepository.contract'
import { describeImageRepository } from '../../ports/ImageRepository.contract'
import { describeOrganisationIndex } from '../../ports/OrganisationIndex.contract'
import type { RepositoriesUnderTest } from '../../ports/Repositories.contract'
import { describeScopeRepository } from '../../ports/ScopeRepository.contract'
import { describeSettingsRepository } from '../../ports/SettingsRepository.contract'
import { describeKeyedStore } from '../repositories/KeyedStore.contract'
import { REPOSITORY_SHELVES, SHELVES } from '../repositories/KeyedStore'
import type { Transaction } from '../repositories/KeyedStore'
import type { KeptContent } from '../repositories/kept'
import { BrowserFolder } from '../folder/browser/browserFolder'
import { browserFolderGit } from '../folder/browser/browserFolderGit'
import { FakeDirectory } from '../folder/fakeDirectory'
import { writeAt } from '../folder/handles'
import { browserRepositories } from './browserRepositories'
import { DATABASE_VERSION, IndexedDbStore } from './IndexedDbStore'
import type { IndexedDb } from './IndexedDbStore'

/** As much of Chromium's storage buckets as the quota clause opens one with. */
type Buckets = { open(name: string, options: { quota: number }): Promise<{ indexedDB: IDBFactory }> }

/** This page's database. */
function thisPage(): IndexedDb {
  return { factory: indexedDB, keyRange: IDBKeyRange }
}

/** A database nobody else has used, so no test sees another's. */
function unique(): string {
  return `lvarch.test.${crypto.randomUUID()}`
}

/** Another tab of this origin: a frame, whose database is this page's database and which goes when it is removed. */
function otherTab(): { indexedDb: IndexedDb; close: () => void } {
  const frame = document.createElement('iframe')
  frame.src = 'about:blank'
  document.body.append(frame)
  const inside = frame.contentWindow as unknown as typeof globalThis
  return { indexedDb: { factory: inside.indexedDB, keyRange: inside.IDBKeyRange }, close: () => frame.remove() }
}

/** A connection opened at a layout of its own, with a `meta` shelf, that lets go only when told. */
function holdOpen(indexedDb: IndexedDb, name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.factory.open(name, version)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('meta')) request.result.createObjectStore('meta')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('would not open'))
  })
}

const write = (value: unknown) => (tx: Transaction) => {
  tx.put('meta', 'a', value)
  return Promise.resolve()
}
const read = (tx: Transaction) => tx.get('meta', 'a')

async function refused(answer: Promise<unknown>): Promise<unknown> {
  return answer.then(() => undefined, (error: unknown) => error)
}

function keyOf(error: unknown): string | undefined {
  return error instanceof ShellError ? error.key : undefined
}

const pause = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms)
})

describeKeyedStore(`IndexedDB in ${server.browser}`, () => new IndexedDbStore(thisPage(), unique()))

function repositories(): RepositoriesUnderTest {
  const name = unique()
  return {
    repositories: browserRepositories(thisPage(), undefined, name).repositories,
    spoil: (scope) => new IndexedDbStore(thisPage(), name).transaction(SHELVES, 'write', async (tx) => {
      const held = await tx.get<KeptContent>('contents', scope)
      tx.put('contents', scope, { ...held, format: 2 })
    }),
  }
}

describeScopeRepository(`browser storage in ${server.browser}`, repositories)
describeOrganisationIndex(`browser storage in ${server.browser}`, repositories)
describeHistoryRepository(`browser storage in ${server.browser}`, repositories)
describeImageRepository(`browser storage in ${server.browser}`, repositories)
describeSettingsRepository(`browser storage in ${server.browser}`, repositories)

describe(`IndexedDbStore in ${server.browser}`, () => {
  it('lands a transaction whose work awaits a digest whole or not at all', async () => {
    const store = new IndexedDbStore(thisPage(), unique())
    const outcome = await store.transaction(['meta'], 'write', async (tx) => {
      tx.put('meta', 'b', 'before the digest')
      await tx.get('meta', 'a')
      await crypto.subtle.digest('SHA-256', new Uint8Array([1, 2, 3]))
      tx.put('meta', 'a', 'after the digest')
    }).then(() => 'landed', () => 'refused')
    const held = await store.transaction(['meta'], 'read', async (tx) => [await tx.get('meta', 'a'), await tx.get('meta', 'b')])
    expect(held).toEqual(outcome === 'landed' ? ['after the digest', 'before the digest'] : [undefined, undefined])
  })

  // WebKit's digest outlasts the task, and so ends the transaction; a small one in Chromium settles inside it.
  it.runIf(server.browser === 'webkit')('refuses a transaction whose work awaits a digest, and lands nothing of it', async () => {
    const store = new IndexedDbStore(thisPage(), unique())
    await expect(store.transaction(['meta'], 'write', async (tx) => {
      tx.put('meta', 'b', 'before the digest')
      await tx.get('meta', 'a')
      await crypto.subtle.digest('SHA-256', new Uint8Array([1, 2, 3]))
      tx.put('meta', 'a', 1)
    })).rejects.toThrow()
    expect(await store.transaction(['meta'], 'read', async (tx) => [await tx.get('meta', 'a'), await tx.get('meta', 'b')]))
      .toEqual([undefined, undefined])
  })

  it('lands nothing of a write whose tab closed half-way through it', async () => {
    const name = unique()
    const here = new IndexedDbStore(thisPage(), name)
    await here.transaction(['meta'], 'write', write('before'))
    const tab = otherTab()
    const closing = new IndexedDbStore(tab.indexedDb, name)
    const writing = closing.transaction(['meta', 'scopes'], 'write', async (tx) => {
      tx.put('meta', 'a', 'half')
      tx.put('scopes', 'half', 'half')
      await tx.get('meta', 'a')
      tab.close()
      await tx.get('meta', 'a')
      tx.put('scopes', 'rest', 'rest')
    })
    await Promise.race([writing.catch(() => undefined), pause(3000)])
    expect(await here.transaction(['meta', 'scopes'], 'read', async (tx) => [
      await tx.get('meta', 'a'), await tx.get('scopes', 'half'), await tx.get('scopes', 'rest'),
    ])).toEqual(['before', undefined, undefined])
    await here.transaction(['meta'], 'write', write('after'))
    expect(await here.transaction(['meta'], 'read', read)).toBe('after')
  })

  it('lets a later build upgrade past a tab that has the database open, which then stands reload', async () => {
    const name = unique()
    const tab = otherTab()
    const older = new IndexedDbStore(tab.indexedDb, name)
    await older.transaction(['meta'], 'write', write(1))
    const later = await holdOpen(thisPage(), name, DATABASE_VERSION + 1)
    expect(older.standing()).toBe('reload')
    expect(keyOf(await refused(older.transaction(['meta'], 'read', read)))).toBe('shell.storageReload')
    later.close()
    tab.close()
  })

  it('stands blocked while an older tab holds the database open, and carries on once it lets go', async () => {
    const name = unique()
    const tab = otherTab()
    const held = await holdOpen(tab.indexedDb, name, 1)
    const store = new IndexedDbStore(thisPage(), name)
    const writing = store.transaction(['meta', 'scopes'], 'write', write(1))
    await vi.waitFor(() => expect(store.standing()).toBe('blocked'), { timeout: 5000 })
    held.close()
    await writing
    expect(store.standing()).toBe('open')
    expect(await store.transaction(['meta'], 'read', read)).toBe(1)
    tab.close()
  })

  it('stands reload where another tab already upgraded the database past this build', async () => {
    const name = unique()
    ;(await holdOpen(thisPage(), name, DATABASE_VERSION + 1)).close()
    const store = new IndexedDbStore(thisPage(), name)
    expect(keyOf(await refused(store.transaction(['meta'], 'read', read)))).toBe('shell.storageReload')
    expect(store.standing()).toBe('reload')
  })

  it('lays out a folder’s shelves over a database an earlier build left at version 2, and keeps what it held', async () => {
    const name = unique()
    const earlier = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 2)
      request.onupgradeneeded = () => {
        for (const shelf of REPOSITORY_SHELVES) request.result.createObjectStore(shelf)
        request.transaction!.objectStore('meta').put('before', 'a')
        request.transaction!.objectStore('scopes').put({ address: 'acme' }, 's-1')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('would not open'))
    })
    earlier.close()
    const store = new IndexedDbStore(thisPage(), name)
    expect(await store.transaction(['meta', 'scopes'], 'read', async (tx) => [await tx.get('meta', 'a'), await tx.get('scopes', 's-1')]))
      .toEqual(['before', { address: 'acme' }])
    await store.transaction(['folders', 'folderData'], 'write', (tx) => {
      tx.put('folders', 'k', { handle: {} })
      tx.put('folderData', 'k\u0000step\u0000one', ['s-1', 1])
      return Promise.resolve()
    })
    expect(await store.transaction(['folderData'], 'read', (tx) => tx.get('folderData', 'k\u0000step\u0000one'))).toEqual(['s-1', 1])
    const now = await holdOpen(thisPage(), name, DATABASE_VERSION)
    expect([now.version, [...now.objectStoreNames].sort()]).toEqual([3, [...SHELVES].sort()])
    now.close()
  })

  // A storage bucket with a quota of its own is how a test meets a quota the
  // browser enforces without filling the disk. Chromium has buckets; WebKit
  // does not, and its quota is a share of the disk, far past what a test should
  // write — so there this refusal is the node suites' alone.
  const buckets = (navigator as Navigator & { storageBuckets?: Buckets }).storageBuckets
  it.runIf(server.browser === 'chromium')('refuses a write past the quota as full, and lands nothing of it', async () => {
    expect(buckets, 'Chromium’s storage buckets').toBeDefined()
    const bucket = await buckets!.open(`quota-${crypto.randomUUID()}`, { quota: 1024 * 1024 })
    const store = new IndexedDbStore({ factory: bucket.indexedDB, keyRange: IDBKeyRange }, unique())
    await store.transaction(['meta'], 'write', write('small'))
    const big = new Uint8Array(4 * 1024 * 1024)
    for (let at = 0; at < big.length; at += 65536) crypto.getRandomValues(big.subarray(at, at + 65536))
    const error = await refused(store.transaction(['meta', 'bytes'], 'write', (tx) => {
      tx.put('meta', 'a', 'large')
      tx.put('bytes', 'big', big)
      return Promise.resolve()
    }))
    expect(keyOf(error)).toBe('shell.storageFull')
    expect(await store.transaction(['meta', 'bytes'], 'read', async (tx) => [await tx.get('meta', 'a'), await tx.get('bytes', 'big')]))
      .toEqual(['small', undefined])
    expect(store.standing()).toBe('open')
  })
})

describe(`a folder’s history in ${server.browser}’s database`, () => {
  /** A folder as this browser keeps it, over a database of a tab: the same folder whatever handle names it. */
  const opened = (indexedDb: IndexedDb, name: string, root: FakeDirectory) =>
    browserFolderGit(new BrowserFolder(new IndexedDbStore(indexedDb, name), { folder: 'acme' }, () => Promise.resolve(true)), root)

  it('lands both commits of two tabs recording at once, one after the other, under the one key both settle on', async () => {
    const name = unique()
    const root = new FakeDirectory()
    const tab = otherTab()
    const here = opened(thisPage(), name, root)
    const there = opened(tab.indexedDb, name, root)
    await writeAt(root, 'acme/model.json', '{}')
    await writeAt(root, 'globex/model.json', '{}')
    const both = await Promise.all([here.commit(['acme/model.json'], 'one'), there.commit(['globex/model.json'], 'two')])
    const log = await here.log({ limit: 5 })
    expect(new Set(log.map((commit) => commit.sha))).toEqual(new Set(both))
    expect(log.map((commit) => commit.parents)).toEqual([[log[1].sha], []])
    expect((await there.treeAt(log[0].sha, '')).map((entry) => entry.path)).toEqual(['acme/model.json', 'globex/model.json'])
    tab.close()
  })
})
