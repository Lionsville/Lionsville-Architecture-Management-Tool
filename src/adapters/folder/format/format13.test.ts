// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Format 13 (ADR-0037, ADR-0038, ADR-0039): one turn for comments under
 * `_comments/`, observations that are bright spots or have moved, and
 * reporting lines. Everything it adds is optional, so a folder written at 12
 * reads as a 13 with none of it, and the pass that brings it up rewrites the
 * headers and nothing else — not one scope moves, not even one called
 * `comments`.
 */
import { describe, expect, it } from 'vitest'
import acmeLogistics from './examples/acme-logistics.json' with { type: 'json' }
import { exampleFiles } from './exampleFolder'
import type { ExampleFolder } from './exampleFolder'
import { bareScope, flattenScopes } from '../../../projects/scope'
import { isSafeScopePath } from '../../../projects/scopePath'
import { FakeDirectory } from '../fakeDirectory'
import type { DirectoryHandleLike } from '../FileSystemScopeStore'
import { FileSystemScopeStore } from '../FileSystemScopeStore'
import { SCOPE_FILE, SCOPE_FORMAT_VERSION, scopeFiles, scopeFromFolder } from './folderFormat'
import type { FolderFile } from './folderFormat'
import { upgradeProjects } from './migration'

/** A file as text, whichever way it is held. */
const textOf = (file: FolderFile) => ('text' in file ? file.text : new TextDecoder().decode(file.bytes))

/** A header saying another version; any other file as it is. */
function at(version: number, file: FolderFile): FolderFile {
  const name = file.path.split('/').pop()
  return name === SCOPE_FILE
    ? { path: file.path, text: textOf(file).replace(`"version": ${SCOPE_FORMAT_VERSION}`, `"version": ${version}`) }
    : file
}

/** The shipped example and a domain under it called `comments`, every header saying 12. */
function twelve(): FolderFile[] {
  return [
    ...exampleFiles(acmeLogistics as ExampleFolder),
    ...scopeFiles(bareScope('comments', 'Comments', 'domain')).map((file) => ({ ...file, path: `comments/${file.path}` })),
  ].map((file) => at(12, file))
}

async function plant(root: FakeDirectory, files: readonly FolderFile[]): Promise<void> {
  for (const file of files) {
    const parts = file.path.split('/')
    let folder: DirectoryHandleLike = root
    for (const segment of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(segment, { create: true })
    ;(folder as FakeDirectory).writeRaw(parts[parts.length - 1], textOf(file))
  }
}

async function textAt(root: FakeDirectory, path: string): Promise<string> {
  const parts = path.split('/')
  let folder: DirectoryHandleLike = root
  for (const segment of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(segment)
  return (await (await folder.getFileHandle(parts[parts.length - 1])).getFile()).text()
}

describe('format 13', () => {
  it('is what a scope is written at now, one past 12', () => {
    expect(SCOPE_FORMAT_VERSION).toBe(12 + 1)
    const header = scopeFiles(bareScope('customer', 'Customer', 'domain')).find((file) => file.path === SCOPE_FILE)!
    expect(JSON.parse(textOf(header)).version).toBe(13)
  })

  it('keeps its comments in a folder no scope can be called', () => {
    expect(isSafeScopePath('_comments')).toBe(false)
    expect(isSafeScopePath('customer/_comments')).toBe(false)
    expect(isSafeScopePath('comments')).toBe(true)
  })

  it('reads a scope written at 12 as it reads one written at 13', () => {
    const files = scopeFiles(bareScope('customer', 'Customer', 'domain'))
    const back = scopeFromFolder(files.map((file) => at(12, file)), 'customer')
    expect(back).toBeDefined()
    expect(back).toEqual(scopeFromFolder(files, 'customer'))
  })
})

describe('a folder written at format 12', () => {
  it('opens whole, with nothing unreadable', async () => {
    const root = new FakeDirectory('Architecture')
    await plant(root, twelve())
    const store = new FileSystemScopeStore(root)
    expect((await store.list()).unreadable ?? []).toEqual([])
    for (const path of flattenScopes(await store.list()).map((scope) => scope.path)) {
      expect((await store.load(path))?.unreadable).toBeUndefined()
    }
  })

  it('is brought up to 13 by the pass: the headers turn, every other file stays as it was, and no scope moves', async () => {
    const before = twelve()
    const root = new FakeDirectory('Architecture')
    await plant(root, before)
    const store = new FileSystemScopeStore(root)
    const scopes = flattenScopes(await store.list()).map((scope) => scope.path).sort()
    expect(scopes).toContain('comments')
    expect((await store.outdated()).sort()).toEqual(scopes)
    expect(await upgradeProjects(store)).toMatchObject({ upgraded: scopes.length, created: 0, failed: 0 })
    expect(await store.outdated()).toEqual([])
    expect(flattenScopes(await store.list()).map((scope) => scope.path).sort()).toEqual(scopes)
    expect(root.paths().sort()).toEqual(before.map((file) => file.path).sort())
    for (const file of before) {
      const now = await textAt(root, file.path)
      if (file.path.split('/').pop() === SCOPE_FILE) expect(JSON.parse(now).version).toBe(13)
      else expect(now, file.path).toBe(textOf(file))
    }
  })
})
