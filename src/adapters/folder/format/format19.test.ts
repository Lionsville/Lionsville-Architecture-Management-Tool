// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Format 19: what a role and its duties say at length (ADR-0052), read back as
 * written through the folder and the working file. An 18 reads as a 19 that
 * says none of it, the pass rewrites the headers and nothing else, a role
 * without the new fields is written as it was, and a 19 is refused by a build
 * that reads 18, which would drop them on its way back.
 */
import { describe, expect, it } from 'vitest'
import acmeLogistics from './examples/acme-logistics.json' with { type: 'json' }
import type { HostModel } from '../../../model/hostModel'
import type { Role } from '../../../model/operatingModel'
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
import { ROLES_FILE } from './operatingFile'
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

const said: Partial<HostModel> & { roles: Role[] } = {
  roles: [
    {
      id: 'ro-lead', name: 'Dock lead', purpose: 'Leads the dock.', description: '## Activities\n\n- Plans the shift\n',
      duties: [
        { responsibility: 'rs-plan', raci: 'A', alsoResponsible: true, certainty: 'confirmed', source: 'Role book, page 4' },
        { responsibility: 'rs-load', raci: 'C', certainty: 'assumed' },
      ],
    },
    { id: 'ro-crew', name: 'Crew', duties: [{ responsibility: 'rs-load', raci: 'R' }] },
  ],
}

function organisation(): ScopeSnapshot {
  const scope = bareScope('', 'Acme', 'organisation')
  return { ...scope, model: { ...scope.model, ...said } }
}

const rolesText = (files: readonly FolderFile[]) => textOf(files.find((file) => file.path === ROLES_FILE)!)

describe('format 19', () => {
  it('is what a scope is written at now, one past 18', () => {
    expect(SCOPE_FORMAT_VERSION).toBe(18 + 1)
    const header = scopeFiles(organisation()).find((file) => file.path === SCOPE_FILE)!
    expect(JSON.parse(textOf(header)).version).toBe(19)
  })

  it('reads back as written, through the folder and the working file, and is written the same again', () => {
    const files = scopeFiles(organisation())
    const back = scopeFromFolder(files, '')!
    expect(back.model.roles).toEqual(said.roles)
    expect(rolesText(scopeFiles(back))).toBe(rolesText(files))
    const held = organisation()
    const opened = openDocumentBytes(workingFileBytes([held]), held)
    if (!opened.ok) throw new Error('did not open')
    expect(opened.scope.model.roles).toEqual(said.roles)
  })

  it('reads back every combination of what a duty may say', () => {
    const duties = (['R', 'A', 'C', 'I'] as const).flatMap((raci) => [undefined, true as const].flatMap((also) => (
      [undefined, 'confirmed' as const, 'assumed' as const].flatMap((certainty) => [undefined, 'Read here'].map((source, at) => ({
        responsibility: `rs-${raci}-${also}-${certainty}-${at}`, raci,
        ...(also && raci === 'A' ? { alsoResponsible: also } : {}), ...(certainty ? { certainty } : {}), ...(source ? { source } : {}),
      })))
    )))
    const roles: Role[] = [{ id: 'ro-1', name: 'All', duties }]
    const scope = organisation()
    expect(scopeFromFolder(scopeFiles({ ...scope, model: { ...scope.model, roles } }), '')!.model.roles).toStrictEqual(roles)
  })

  it('passes over what a hand-edited file says that is not one', () => {
    const files = scopeFiles(organisation()).map((file) => (file.path === ROLES_FILE
      ? { path: ROLES_FILE, text: JSON.stringify([{ id: 'ro-1', name: 'Lead', description: ' ', duties: [
        { responsibility: 'rs-1', raci: 'R', alsoResponsible: true, certainty: 'sure', source: '' },
        { responsibility: 'rs-2', raci: 'A', alsoResponsible: 'yes', source: 4 },
      ] }]) }
      : file))
    expect(scopeFromFolder(files, '')!.model.roles).toStrictEqual([
      { id: 'ro-1', name: 'Lead', duties: [{ responsibility: 'rs-1', raci: 'R' }, { responsibility: 'rs-2', raci: 'A' }] },
    ])
  })

  it('reads an 18 and writes its roles byte for byte as they were', () => {
    const text = `${JSON.stringify([
      { duties: [{ raci: 'A', responsibility: 'rs-plan' }], id: 'ro-lead', name: 'Dock lead', purpose: 'Leads the dock.' },
    ], null, 2)}\n`
    const old = scopeFiles(organisation()).map((file) => (file.path === ROLES_FILE ? { path: ROLES_FILE, text } : at(18, file)))
    expect(rolesText(scopeFiles(scopeFromFolder(old, '')!))).toBe(text)
  })
})

describe('a folder written at format 18', () => {
  it('is brought up by the pass: the headers turn, every other file stays as it was, and no scope moves', async () => {
    const before = exampleFiles(acmeLogistics as ExampleFolder).map((file) => at(18, file))
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

describe('a folder written at format 19, opened by a build that reads 18', () => {
  it('is refused rather than saved without what only 19 keeps', async () => {
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
