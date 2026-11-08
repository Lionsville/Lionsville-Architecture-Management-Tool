// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One read of a file per open, counted on the channel.
 *
 * Opening a view from a Home reads the scope for the view, the scopes above it
 * for the trail, all of them again for the findings, and the tree for the
 * owners' descriptions, at once. Over a real folder holding the dense
 * organisation, every call that would cross to main is counted, with the
 * channel as it was and with {@link readingOnce} in front of it.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import {
  createFile, fingerprint, listDirectory, makeDirectory, moveEntry, readFile, removeEntry, stampAt, writeFile, writeTogether,
} from '../../../../electron/main/fileStore'
import type { DesktopChange, DesktopFiles } from '../../desktop/channel'
import { readingOnce } from '../../desktop/readingOnce'
import { ancestorScopes } from '../../../projects/scopePath'
import { nodesOf, readScopeKnown, readScopes, readScopesKnown } from '../../../projects/scopeAccess'
import { folderRepositories } from '../folderRepositories'
import { memoryGit } from '../memoryGit'
import { DENSE_TEAM, seedDenseOrganisation } from '../testing/denseOrganisation'
import { IpcDirectoryHandle } from './IpcDirectoryHandle'

const folders: string[] = []
afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true })
})

type Counted = { files: DesktopFiles; reads: Map<string, number>; lists: Map<string, number>; stamps: Map<string, number>; changed: (change: DesktopChange) => void }

function counted(root: string): Counted {
  const reads = new Map<string, number>()
  const lists = new Map<string, number>()
  const stamps = new Map<string, number>()
  const listeners = new Set<(change: DesktopChange) => void>()
  const count = (held: Map<string, number>, path: string) => held.set(path, (held.get(path) ?? 0) + 1)
  return {
    reads,
    lists,
    stamps,
    changed: (change) => { for (const listener of listeners) listener(change) },
    files: {
      chooseDirectory: () => Promise.resolve({ root, name: basename(root) }),
      recentDirectories: () => Promise.resolve([]),
      list: (held, path) => { count(lists, path); return listDirectory(held, path) },
      makeDirectory: (held, path) => makeDirectory(held, path),
      read: (held, path) => { count(reads, path); return readFile(held, path) },
      write: (held, path, bytes) => writeFile(held, path, bytes),
      create: (held, path, bytes) => createFile(held, path, bytes),
      writeTogether: (held, writes, removals) => writeTogether(held, writes, removals),
      remove: (held, path, options) => removeEntry(held, path, options),
      move: (held, from, to) => moveEntry(held, from, to),
      stamp: (held, path) => { count(stamps, path); return stampAt(held, path) },
      fingerprint: (held, path) => fingerprint(held, path),
      revealInFolder: () => Promise.resolve(),
      saveDocument: () => Promise.resolve(true),
      watch: () => Promise.resolve(),
      unwatch: () => Promise.resolve(),
      onChanged: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    },
  }
}

function repositoriesOver(files: DesktopFiles, root: string) {
  const handle = new IpcDirectoryHandle(files, root, basename(root))
  return folderRepositories({ root: handle, git: memoryGit(handle) })
}

/** The dense organisation, written once into a real folder. */
const seeded = (async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lvarch-once-')))
  folders.push(root)
  await seedDenseOrganisation(repositoriesOver(counted(root).files, root))
  return root
})()

/**
 * What a Home → view open asks of the repositories at once (`useShellNavigation`, `useScopeAncestry`,
 * `useTreeFindings`, `useOwnerDescriptions`), counted from the press: the Home has read the tree already.
 */
async function openFromHome(channel: Counted, wrap: (files: DesktopFiles) => DesktopFiles, root: string, path: string): Promise<void> {
  const { scopes } = repositoriesOver(wrap(channel.files), root)
  const ids = new Map(nodesOf((await scopes.tree()).root).map((node) => [node.address, node.id]))
  // Past the Home's own reads, as an open a while after the Home came up is.
  await new Promise((resolve) => setTimeout(resolve, 1100))
  channel.reads.clear()
  channel.lists.clear()
  channel.stamps.clear()
  const idOf = (address: string) => ids.get(address)
  const above = ancestorScopes(path)
  return void await Promise.all([
    readScopeKnown(scopes, path, idOf(path)),
    readScopesKnown(scopes, above, idOf),
    readScopesKnown(scopes, [path, ...above], idOf),
    readScopes(scopes, [path]),
  ])
}

const total = (held: Map<string, number>) => [...held.values()].reduce((sum, n) => sum + n, 0)
const most = (held: Map<string, number>) => Math.max(...held.values())

describe('one read of a file per open', () => {
  it.each([['the organisation', ''], ['a team three levels down', DENSE_TEAM]])('opening a view of %s reads each file once', async (_, path) => {
    const root = await seeded
    const before = counted(root)
    await openFromHome(before, (files) => files, root, path)
    const once = counted(root)
    await openFromHome(once, (files) => readingOnce(files).files, root, path)

    // Logged so a change in either is seen beside the numbers the review measured.
    console.info(`${path || 'root'}: reads ${total(before.reads)} → ${total(once.reads)}, lists ${total(before.lists)} → ${total(once.lists)}, stamps ${total(before.stamps)} → ${total(once.stamps)}, most of one file ${most(before.reads)} → ${most(once.reads)}`)
    expect(most(before.reads)).toBeGreaterThan(1)
    expect(most(once.reads)).toBe(1)
    expect(most(once.lists)).toBe(1)
    expect(most(once.stamps)).toBe(1)
    expect(new Set(once.reads.keys())).toEqual(new Set(before.reads.keys()))
  }, 60_000)
})

describe('readingOnce', () => {
  it('reads again after a write through it, a change the watcher reports, a forget, and once the open is over', async () => {
    const root = await seeded
    const raw = counted(root)
    let clock = 0
    const once = readingOnce(raw.files, 1000, () => clock)
    const read = () => once.files.read(root, 'scope.json')
    await read()
    await read()
    expect(raw.reads.get('scope.json')).toBe(1)
    await once.files.write(root, 'notes.txt', new TextEncoder().encode('x'))
    await read()
    expect(raw.reads.get('scope.json')).toBe(2)
    raw.changed({ root, path: 'scope.json' })
    await read()
    expect(raw.reads.get('scope.json')).toBe(3)
    once.forget(root)
    await read()
    expect(raw.reads.get('scope.json')).toBe(4)
    clock = 999
    await read()
    expect(raw.reads.get('scope.json')).toBe(4)
    clock = 1999
    await read()
    expect(raw.reads.get('scope.json')).toBe(5)
    await once.files.remove(root, 'notes.txt')
  })

  it('does not keep a read that crossed a write', async () => {
    const root = await seeded
    const raw = counted(root)
    const once = readingOnce(raw.files, 1000, () => 0)
    const reading = once.files.read(root, 'model.json')
    await once.files.write(root, 'other.txt', new Uint8Array([1]))
    await reading
    await once.files.read(root, 'model.json')
    expect(raw.reads.get('model.json')).toBe(2)
    await once.files.remove(root, 'other.txt')
  })
})
