// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Format 18: the elements an observation is about (ADR-0032, amended 22
 * November 2026), read back as written through the folder and the working
 * file. A 17 reads as an 18 whose observations name none, the pass rewrites
 * the headers and nothing else, and an 18 is refused by a build that reads
 * 17, which would drop the rows on its way back.
 */
import { describe, expect, it } from 'vitest'
import acmeLogistics from './examples/acme-logistics.json' with { type: 'json' }
import type { HostModel } from '../../../model/hostModel'
import type { DesignElement } from '../../../model/types'
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

const element = (id: string, over: Partial<DesignElement>): DesignElement => ({
  id, name: id, kind: 'application', lifecycle: 'live', isManaged: true, aspects: {}, ...over,
})

const said: Partial<HostModel> = {
  elements: [element('billing', {}), element('ledger', {})],
  observations: [
    {
      id: 'ob-1', number: 1, title: 'Invoices go out twice', date: '2026-11-01', where: 'Month end', about: ['billing', 'ledger'],
      impact: 'major', seen: 1, body: 'What was seen.', history: [{ date: '2026-11-01', kind: 'recorded' }],
    },
    { id: 'ob-2', number: 2, title: 'Nothing named', date: '2026-11-02', impact: 'minor', seen: 1, body: 'Prose only.', history: [{ date: '2026-11-02', kind: 'recorded' }] },
  ],
}

function organisation(): ScopeSnapshot {
  const scope = bareScope('', 'Acme', 'organisation')
  return { ...scope, model: { ...scope.model, ...said } }
}

describe('format 18', () => {
  it('is what a scope is written at, or a format past it', () => {
    expect(SCOPE_FORMAT_VERSION).toBeGreaterThanOrEqual(17 + 1)
    const header = scopeFiles(organisation()).find((file) => file.path === SCOPE_FILE)!
    expect(JSON.parse(textOf(header)).version).toBe(SCOPE_FORMAT_VERSION)
  })

  it('writes a row per element, and nothing for an observation about none', () => {
    const files = scopeFiles(organisation())
    const first = textOf(files.find((file) => file.path.startsWith('observations/0001-'))!)
    const second = textOf(files.find((file) => file.path.startsWith('observations/0002-'))!)
    expect(first).toMatch(/about:\n\s+- id: billing\n\s+- id: ledger/)
    expect(second).not.toContain('about')
  })

  it('reads back as written, through the folder and the working file', () => {
    expect(scopeFromFolder(scopeFiles(organisation()), '')!.model.observations).toEqual(said.observations)
    const held = organisation()
    const opened = openDocumentBytes(workingFileBytes([held]), held)
    if (!opened.ok) throw new Error('did not open')
    expect(opened.scope.model.observations).toEqual(said.observations)
  })
})

describe('a folder written at format 17', () => {
  it('is brought up by the pass: the headers turn, every other file stays as it was, and no scope moves', async () => {
    const before = exampleFiles(acmeLogistics as ExampleFolder).map((file) => at(17, file))
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

describe('a folder written at format 18, opened by a build that reads 17', () => {
  it('is refused rather than saved without what only 18 keeps', async () => {
    const files = scopeFiles({ ...organisation(), path: 'customer' }).map((file) => at(SCOPE_FORMAT_VERSION + 1, file))
    expect(scopeFromFolder(files, 'customer')).toBeUndefined()
    const root = new FakeDirectory('Architecture')
    await plant(root, scopeFiles(bareScope('', 'Acme', 'organisation')))
    await plant(root, files, 'customer/')
    const store = new FileSystemScopeStore(root)
    expect((await store.list()).unreadable).toEqual(['customer'])
    await expect(store.save(bareScope('customer', 'Customer', 'domain'))).rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })
  })
})
