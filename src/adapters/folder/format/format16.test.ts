// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Format 16 (ADR-0038, amended 7 November 2026): an observation recorded by a
 * register entry holds no name, read back as written through the folder and the
 * working file. A folder written at 15 reads as a 16 whose records still hold both;
 * the pass that brings it up rewrites the headers and nothing else; and a 16 is
 * refused by a build that reads 15, which would drop who recorded it on its way back.
 */
import { describe, expect, it } from 'vitest'
import acmeLogistics from './examples/acme-logistics.json' with { type: 'json' }
import type { Observation } from '../../../model/observation'
import { bareScope, flattenScopes } from '../../../projects/scope'
import type { ScopeSnapshot } from '../../../projects/scope'
import { FakeDirectory } from '../fakeDirectory'
import type { DirectoryHandleLike } from '../FileSystemScopeStore'
import { FileSystemScopeStore } from '../FileSystemScopeStore'
import { exampleFiles } from './exampleFolder'
import type { ExampleFolder } from './exampleFolder'
import { SCOPE_FILE, SCOPE_FORMAT_VERSION, scopeFiles, scopeFromFolder } from './folderFormat'
import type { FolderFile } from './folderFormat'
import { upgradeProjects } from './migration'
import { openDocumentBytes, workingFileBytes } from './workingFile'

const textOf = (file: FolderFile) => ('text' in file ? file.text : new TextDecoder().decode(file.bytes))

function at(version: number, file: FolderFile): FolderFile {
  const name = file.path.split('/').pop()
  return name === SCOPE_FILE
    ? { path: file.path, text: textOf(file).replace(`"version": ${SCOPE_FORMAT_VERSION}`, `"version": ${version}`) }
    : file
}

async function plant(root: FakeDirectory, files: readonly FolderFile[], under = ''): Promise<void> {
  for (const file of files) {
    const parts = `${under}${file.path}`.split('/')
    const name = parts.pop()!
    let dir: DirectoryHandleLike = root
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true })
    const handle = await dir.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write('text' in file ? file.text : file.bytes)
    await writable.close()
  }
}

async function textAt(root: FakeDirectory, path: string): Promise<string> {
  const parts = path.split('/')
  const name = parts.pop()!
  let dir: DirectoryHandleLike = root
  for (const part of parts) dir = await dir.getDirectoryHandle(part)
  return (await (await dir.getFileHandle(name)).getFile()).text()
}

const observation = (id: string, number: number, extra: Partial<Observation>): Observation => ({
  id, number, title: `Seen ${number}`, date: '2026-11-01', impact: 'minor', seen: 1, body: 'What was seen.',
  history: [{ date: '2026-11-01', kind: 'recorded' }], ...extra,
})
const noName = observation('ob-1', 1, { recordedBy: { account: 'acc-ada', person: 'pe-ada', via: 'An agent' } })
const both = observation('ob-2', 2, { recordedBy: { name: 'Ada Example', account: 'acc-ada', person: 'pe-ada' } })

function customer(): ScopeSnapshot {
  const scope = bareScope('customer', 'Customer', 'domain')
  return { ...scope, model: { ...scope.model, observations: [noName, both] } }
}

describe('format 16', () => {
  it('is what a scope is written at now, one past 15', () => {
    expect(SCOPE_FORMAT_VERSION).toBeGreaterThanOrEqual(15 + 1)
    const header = scopeFiles(customer()).find((file) => file.path === SCOPE_FILE)!
    expect(JSON.parse(textOf(header)).version).toBe(SCOPE_FORMAT_VERSION)
  })

  it('keeps a record with no name, and one that still holds both, read back as written', () => {
    expect(scopeFromFolder(scopeFiles(customer()), 'customer')?.model.observations).toEqual([noName, both])
    const held = customer()
    const opened = openDocumentBytes(workingFileBytes([held]), held)
    expect(opened.ok && opened.scope.model.observations).toEqual([noName, both])
  })
})

describe('a folder written at format 15', () => {
  it('is brought up by the pass: the headers turn, every other file stays as it was, and no scope moves', async () => {
    const before = exampleFiles(acmeLogistics as ExampleFolder).map((file) => at(15, file))
    const root = new FakeDirectory('Architecture')
    await plant(root, before)
    const store = new FileSystemScopeStore(root)
    const scopes = flattenScopes(await store.list()).map((scope) => scope.path).sort()
    expect((await store.outdated()).sort()).toEqual(scopes)
    expect(await upgradeProjects(store)).toMatchObject({ upgraded: scopes.length, created: 0, failed: 0 })
    expect(root.paths().sort()).toEqual(before.map((file) => file.path).sort())
    for (const file of before) {
      const now = await textAt(root, file.path)
      if (file.path.split('/').pop() === SCOPE_FILE) expect(JSON.parse(now).version).toBe(SCOPE_FORMAT_VERSION)
      else expect(now, file.path).toBe(textOf(file))
    }
  })
})

describe('a folder written at format 16, opened by a build that reads 15', () => {
  const later = (files: readonly FolderFile[]) => files.map((file) => at(SCOPE_FORMAT_VERSION + 1, file))

  it('is refused rather than saved without who recorded it', async () => {
    const files = later(scopeFiles(customer()))
    expect(scopeFromFolder(files, 'customer')).toBeUndefined()
    const root = new FakeDirectory('Architecture')
    await plant(root, scopeFiles(bareScope('', 'Acme', 'organisation')))
    await plant(root, files, 'customer/')
    const store = new FileSystemScopeStore(root)
    expect((await store.list()).unreadable).toEqual(['customer'])
    await expect(store.save(bareScope('customer', 'Customer', 'domain'))).rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })
  })
})
