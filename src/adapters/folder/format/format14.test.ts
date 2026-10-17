// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Format 14 (ADR-0039, amended 17 October 2026): a holder's own reporting
 * lines on an assignment, kept in `_assignments/assignments.json` and read
 * back as they were written — through the folder and the working file alike.
 * A folder written at 13 reads as a 14 in which nobody has a line of their
 * own, and the pass that brings it up rewrites the headers and nothing else;
 * a 14 is refused by a build that reads 13, rather than read field by field
 * and saved back without the lines.
 */
import { describe, expect, it } from 'vitest'
import acmeLogistics from './examples/acme-logistics.json' with { type: 'json' }
import type { Assignment } from '../../../model/units'
import { bareScope, flattenScopes } from '../../../projects/scope'
import type { ScopeSnapshot } from '../../../projects/scope'
import { stableJson } from '../../../projects/text'
import { FakeDirectory } from '../fakeDirectory'
import type { DirectoryHandleLike } from '../FileSystemScopeStore'
import { FileSystemScopeStore } from '../FileSystemScopeStore'
import { ASSIGNMENTS_FILE } from './assignmentFile'
import { exampleFiles } from './exampleFolder'
import type { ExampleFolder } from './exampleFolder'
import { SCOPE_FILE, SCOPE_FORMAT_VERSION, scopeFiles, scopeFromFolder } from './folderFormat'
import type { FolderFile } from './folderFormat'
import { upgradeProjects } from './migration'
import { openDocumentBytes, workingFileBytes } from './workingFile'

const textOf = (file: FolderFile) => ('text' in file ? file.text : new TextDecoder().decode(file.bytes))

/** A header saying another version; any other file as it is. */
function at(version: number, file: FolderFile): FolderFile {
  const name = file.path.split('/').pop()
  return name === SCOPE_FILE
    ? { path: file.path, text: textOf(file).replace(`"version": ${SCOPE_FORMAT_VERSION}`, `"version": ${version}`) }
    : file
}

/** A developer who reports to the head of another unit by an agreement of their own, and on the side to an architect, from a day. */
const own: Assignment = {
  id: 'as-1', unitId: 'webshop', roleId: 'ro-dev', person: { person: 'pe-bram' },
  reportsTo: [
    { to: { scope: 'shipping', unit: 'parcel', role: 'ro-head', person: 'pe-femke' }, kind: 'solid' },
    { to: { scope: '', unit: 'office', role: 'ro-arch' }, kind: 'dotted', from: '2027-01-01', until: '2027-12-31' },
  ],
}
const plain: Assignment = { id: 'as-2', unitId: 'webshop', roleId: 'ro-po', person: { person: 'pe-femke' } }

function customer(): ScopeSnapshot {
  const scope = bareScope('customer', 'Customer', 'domain')
  return { ...scope, model: { ...scope.model, assignments: [own, plain] } }
}

async function plant(root: FakeDirectory, files: readonly FolderFile[], under = ''): Promise<void> {
  for (const file of files) {
    const parts = `${under}${file.path}`.split('/')
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

describe('format 14', () => {
  it('is what a scope is written at now, one past 13', () => {
    expect(SCOPE_FORMAT_VERSION).toBe(13 + 1)
    const header = scopeFiles(customer()).find((file) => file.path === SCOPE_FILE)!
    expect(JSON.parse(textOf(header)).version).toBe(14)
  })

  it('keeps a holder\'s own lines on the assignment, read back as written, byte for byte', () => {
    const files = scopeFiles(customer())
    const back = scopeFromFolder(files, 'customer')!
    expect(back.model.assignments).toEqual([own, plain])
    expect(stableJson(scopeFiles(back))).toBe(stableJson(files))
  })

  it('carries them through a working file', () => {
    const held = customer()
    const opened = openDocumentBytes(workingFileBytes([held]), held)
    expect(opened.ok && opened.scope.model.assignments).toEqual([own, plain])
  })

  it('passes over a line without a whole target or a kind, and keeps the row', () => {
    const files = scopeFiles(customer()).map((file) => (file.path !== ASSIGNMENTS_FILE ? file : {
      path: file.path,
      text: JSON.stringify([{ ...own, reportsTo: [{ kind: 'solid', to: { scope: '', unit: 'parcel' } }, { to: { scope: '', unit: 'parcel', role: 'ro-head' } }, own.reportsTo![0]] }]),
    }))
    expect(scopeFromFolder(files, 'customer')!.model.assignments).toEqual([{ ...own, reportsTo: [own.reportsTo![0]] }])
  })

  it('reads a scope written at 13 as it reads one written at 14', () => {
    const files = scopeFiles(bareScope('customer', 'Customer', 'domain'))
    expect(scopeFromFolder(files.map((file) => at(13, file)), 'customer')).toEqual(scopeFromFolder(files, 'customer'))
  })
})

describe('a folder written at format 13', () => {
  it('is brought up to 14 by the pass: the headers turn, every other file stays as it was, and no scope moves', async () => {
    const before = exampleFiles(acmeLogistics as ExampleFolder).map((file) => at(13, file))
    const root = new FakeDirectory('Architecture')
    await plant(root, before)
    const store = new FileSystemScopeStore(root)
    const scopes = flattenScopes(await store.list()).map((scope) => scope.path).sort()
    expect((await store.outdated()).sort()).toEqual(scopes)
    expect(await upgradeProjects(store)).toMatchObject({ upgraded: scopes.length, created: 0, failed: 0 })
    expect(await store.outdated()).toEqual([])
    expect(root.paths().sort()).toEqual(before.map((file) => file.path).sort())
    for (const file of before) {
      const now = await textAt(root, file.path)
      if (file.path.split('/').pop() === SCOPE_FILE) expect(JSON.parse(now).version).toBe(14)
      else expect(now, file.path).toBe(textOf(file))
    }
  })
})

describe('a folder written at format 14, opened by a build that reads 13', () => {
  /** What a 14 is to a build whose newest is 13: a version one past its own, as this build sees a 15. */
  const later = (files: readonly FolderFile[]) => files.map((file) => at(SCOPE_FORMAT_VERSION + 1, file))

  it('is refused rather than read field by field, and nothing is saved over the lines', async () => {
    const files = later(scopeFiles(customer()))
    expect(scopeFromFolder(files, 'customer')).toBeUndefined()
    const root = new FakeDirectory('Architecture')
    await plant(root, scopeFiles(bareScope('', 'Acme', 'organisation')))
    await plant(root, files, 'customer/')
    const kept = await textAt(root, `customer/${ASSIGNMENTS_FILE}`)
    const store = new FileSystemScopeStore(root)
    expect((await store.list()).unreadable).toEqual(['customer'])
    await expect(store.save(bareScope('customer', 'Customer', 'domain'))).rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })
    expect(await textAt(root, `customer/${ASSIGNMENTS_FILE}`)).toBe(kept)
  })
})
