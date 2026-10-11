// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Assignments on disk (ADR-0036 §4): one list file under `_assignments/` in
 * each scope, read back as it was written, holding a person as an id and
 * never as a name; and a unit's type, the scopes it serves and its extra
 * slots carried on the actor in `model.json`.
 */
import { describe, expect, it } from 'vitest'
import type { Assignment } from '../../../model/units'
import type { DesignElement } from '../../../model/types'
import { bareScope, flattenScopes } from '../../../projects/scope'
import type { ScopeSnapshot } from '../../../projects/scope'
import { isSafeScopePath } from '../../../projects/scopePath'
import { FakeDirectory } from '../fakeDirectory'
import type { DirectoryHandleLike } from '../FileSystemScopeStore'
import { FileSystemScopeStore } from '../FileSystemScopeStore'
import { ASSIGNMENTS_FILE, ASSIGNMENTS_FOLDER } from './assignmentFile'
import { isFormatPath, SCOPE_FOLDERS, scopeFiles, scopeFromFolder } from './folderFormat'
import type { FolderFile } from './folderFormat'
import { openDocumentBytes, workingFileBytes } from './workingFile'

const webshop: DesignElement = {
  id: 'webshop', kind: 'actor', name: 'Webshop', parentId: 'sales', unitTypeId: 'ut-team', scopes: ['customer'],
  extraSlots: [{ role: 'ro-rel', min: 0, max: 1 }], lifecycle: 'live', isManaged: false, aspects: {},
}
const femke: Assignment = { id: 'as-2', unitId: 'webshop', roleId: 'ro-po', person: { person: 'pe-femke' }, from: '2022-01-01' }
const bram: Assignment = {
  id: 'as-1', unitId: 'webshop', roleId: 'ro-dev', person: { person: 'pe-bram' }, share: 0.5, until: '2026-12-31', acting: true,
}

/** A domain with a unit and two people in it. */
function customer(): ScopeSnapshot {
  const scope = bareScope('customer', 'Customer', 'domain')
  // Deliberately not in id order: the order is the scope's.
  return { ...scope, model: { ...scope.model, elements: [webshop], assignments: [femke, bram] } }
}

const textOf = (files: readonly FolderFile[], path: string) => {
  const file = files.find((one) => one.path === path)
  return file && 'text' in file ? file.text : undefined
}

describe('assignments in a scope\'s folder', () => {
  it('are one list file under _assignments/, read back as written, in the scope\'s own order', () => {
    const files = scopeFiles(customer())
    expect(files.map((file) => file.path)).toContain(ASSIGNMENTS_FILE)
    const back = scopeFromFolder(files, 'customer')!
    expect(back.model.assignments).toEqual([femke, bram])
    expect(back.model.elements[0]).toEqual(webshop)
    expect(scopeFiles(back).map((file) => textOf([file], file.path))).toEqual(files.map((file) => textOf([file], file.path)))
  })

  it('hold a person as an id, and no name', () => {
    expect(JSON.parse(textOf(scopeFiles(customer()), ASSIGNMENTS_FILE)!)[0].person).toEqual({ person: 'pe-femke' })
  })

  it('write no file where the scope holds none, and read none back', () => {
    const files = scopeFiles(bareScope('customer', 'Customer'))
    expect(files.some((file) => file.path.startsWith(`${ASSIGNMENTS_FOLDER}/`))).toBe(false)
    expect('assignments' in scopeFromFolder(files, 'customer')!.model).toBe(false)
  })

  it('are the format\'s: the one file and nothing else in the folder', () => {
    expect(isFormatPath(ASSIGNMENTS_FILE)).toBe(true)
    expect(isFormatPath(`${ASSIGNMENTS_FOLDER}/as-1.json`)).toBe(false)
    expect(SCOPE_FOLDERS).toContain(ASSIGNMENTS_FOLDER)
  })

  it('read what they can of a hand-edited file and pass over a row they cannot', () => {
    const files: FolderFile[] = [
      ...scopeFiles(bareScope('customer', 'Customer')),
      { path: ASSIGNMENTS_FILE, text: JSON.stringify([
        { id: 'as-1', unitId: 'webshop', roleId: 'ro-po', person: 'pe-femke', share: 7, acting: 'yes' },
        { id: 'as-2', unitId: 'webshop', roleId: 'ro-po', person: { person: '' } },
        { id: 'as-3', unitId: 'webshop', person: { person: 'pe-bram' } },
        { id: 'as-4', unitId: 'webshop', roleId: 'ro-dev', person: { person: 'pe-bram' }, share: 0.25, from: '2026-01-01' },
        'not a row',
      ]) },
    ]
    const back = scopeFromFolder(files, 'customer')!
    expect(back.model.assignments).toEqual([
      { id: 'as-1', unitId: 'webshop', roleId: 'ro-po', person: { person: 'pe-femke' } },
      { id: 'as-4', unitId: 'webshop', roleId: 'ro-dev', person: { person: 'pe-bram' }, share: 0.25, from: '2026-01-01' },
    ])
    expect(back.unreadable).toBeUndefined()
  })

  it('open a scope whose list is not a list to be read and not written', () => {
    const files: FolderFile[] = [
      ...scopeFiles(customer()).filter((file) => file.path !== ASSIGNMENTS_FILE), { path: ASSIGNMENTS_FILE, text: '{ "half": ' },
    ]
    const back = scopeFromFolder(files, 'customer')!
    expect(back.unread).toContain(ASSIGNMENTS_FILE)
    expect(back.unreadable).toContain(ASSIGNMENTS_FILE)
    expect(back.model.elements).toHaveLength(1)
  })

  it('travel in a working file and come back whole', () => {
    const held = customer()
    const opened = openDocumentBytes(workingFileBytes([held]), held)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.scope.model.assignments).toEqual([femke, bram])
  })
})

async function plant(root: FakeDirectory, path: string, file: FolderFile): Promise<void> {
  const parts = path.split('/')
  let folder: DirectoryHandleLike = root
  for (const segment of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(segment, { create: true })
  ;(folder as FakeDirectory).writeRaw(parts[parts.length - 1], 'text' in file ? file.text : new TextDecoder().decode(file.bytes))
}

describe('the folder assignments are kept in', () => {
  it('is no name a scope can have, so no tree can hold one there', () => {
    expect(isSafeScopePath(ASSIGNMENTS_FOLDER)).toBe(false)
    expect(isSafeScopePath(`customer/${ASSIGNMENTS_FOLDER}`)).toBe(false)
  })

  it('is never walked as a scope, and is read with the scope\'s records for the index', async () => {
    const root = new FakeDirectory('Architecture')
    for (const file of scopeFiles(bareScope('', 'Acme', 'organisation'))) await plant(root, file.path, file)
    for (const file of scopeFiles(customer())) await plant(root, `customer/${file.path}`, file)
    for (const file of scopeFiles(bareScope('', 'Planted'))) await plant(root, `customer/${ASSIGNMENTS_FOLDER}/${file.path}`, file)
    const store = new FileSystemScopeStore(root)
    expect(flattenScopes(await store.list()).map((scope) => scope.path)).toEqual(['', 'customer'])
    const models = await store.models()
    expect(models.find((one) => one.path === 'customer')?.model.assignments).toEqual([femke, bram])
  })
})
