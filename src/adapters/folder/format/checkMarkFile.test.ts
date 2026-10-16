// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The findings marked as intended on disk (ADR-0036, amended 11 October
 * 2026), and format 12: one list file under `_checks/` in each scope that
 * keeps marks, read back byte for byte as it was written; a folder written at
 * 11 read as a 12 with nothing marked, and brought up to 12 without a scope
 * moving; and a 12 refused by a build that reads 11, rather than half-read
 * and saved over `_checks/`.
 */
import { describe, expect, it } from 'vitest'
import type { CheckMark } from '../../../model/checkMarks'
import { bareScope, flattenScopes } from '../../../projects/scope'
import type { ScopeSnapshot } from '../../../projects/scope'
import { isSafeScopePath } from '../../../projects/scopePath'
import { stableJson } from '../../../projects/text'
import { FakeDirectory } from '../fakeDirectory'
import type { DirectoryHandleLike } from '../FileSystemScopeStore'
import { FileSystemScopeStore } from '../FileSystemScopeStore'
import { CHECK_MARKS_FILE, CHECKS_FOLDER } from './checkMarkFile'
import { isFormatPath, SCOPE_FILE, SCOPE_FOLDERS, SCOPE_FORMAT_VERSION, scopeFiles, scopeFromFolder } from './folderFormat'
import type { FolderFile } from './folderFormat'
import { upgradeProjects } from './migration'
import { openDocumentBytes, workingFileBytes } from './workingFile'

const designTogether: CheckMark = {
  check: 'check.interactionUnused', key: 'i-1 web ip', reason: 'They design the API together', on: '2026-10-11',
}
const vacancy: CheckMark = { check: 'check.roleVacant', key: 'web ro-sm', on: '2026-10-12' }

/** A domain with two findings about it marked as intended. */
function customer(): ScopeSnapshot {
  const scope = bareScope('customer', 'Customer', 'domain')
  // Deliberately not by key: the order is the order they were marked in.
  return { ...scope, model: { ...scope.model, checkMarks: [vacancy, designTogether] } }
}

const textOf = (files: readonly FolderFile[], path: string) => {
  const file = files.find((one) => one.path === path)
  return file && 'text' in file ? file.text : undefined
}

describe('marks in a scope’s folder', () => {
  it('are one list file under _checks/, read back byte for byte, in the order they were made', () => {
    const files = scopeFiles(customer())
    expect(files.map((file) => file.path)).toContain(CHECK_MARKS_FILE)
    expect(JSON.parse(textOf(files, SCOPE_FILE)!).version).toBe(SCOPE_FORMAT_VERSION)
    const back = scopeFromFolder(files, 'customer')!
    expect(back.model.checkMarks).toEqual([vacancy, designTogether])
    expect(stableJson(scopeFiles(back))).toBe(stableJson(files))
    expect(JSON.parse(textOf(files, CHECK_MARKS_FILE)!)).toEqual([
      { check: 'check.roleVacant', key: 'web ro-sm', on: '2026-10-12' },
      { check: 'check.interactionUnused', key: 'i-1 web ip', on: '2026-10-11', reason: 'They design the API together' },
    ])
  })

  it('write no file where the scope holds none, and read none back', () => {
    const files = scopeFiles(bareScope('customer', 'Customer'))
    expect(files.some((file) => file.path.startsWith(`${CHECKS_FOLDER}/`))).toBe(false)
    expect('checkMarks' in scopeFromFolder(files, 'customer')!.model).toBe(false)
  })

  it('are the format’s: the one file and nothing else in the folder', () => {
    expect(isFormatPath(CHECK_MARKS_FILE)).toBe(true)
    expect(isFormatPath(`${CHECKS_FOLDER}/other.json`)).toBe(false)
    expect(SCOPE_FOLDERS).toContain(CHECKS_FOLDER)
  })

  it('read what they can of a hand-edited file, and pass over a fix, a kind nobody knows, a row with no key or day, and a second of one', () => {
    const files: FolderFile[] = [
      ...scopeFiles(bareScope('customer', 'Customer')),
      { path: CHECK_MARKS_FILE, text: JSON.stringify([
        { check: 'check.roleVacant', key: 'web ro-sm', on: '2026-10-12', reason: '  ' },
        { check: 'check.unitMisplaced', key: 'web ut-cluster', on: '2026-10-12' },
        { check: 'check.somethingNew', key: 'x', on: '2026-10-12' },
        { check: 'check.notDrawn', on: '2026-10-12' },
        { check: 'check.notDrawn', key: 'erp', on: 'yesterday' },
        { check: 'check.roleVacant', key: 'web ro-sm', on: '2026-10-13', reason: 'Said again' },
        { check: 'check.notDrawn', key: 'erp', on: '2026-10-11', reason: 'A record, on no board yet', by: 'somebody' },
        'not a row',
      ]) },
    ]
    const back = scopeFromFolder(files, 'customer')!
    expect(back.model.checkMarks).toEqual([
      { check: 'check.roleVacant', key: 'web ro-sm', on: '2026-10-12' },
      { check: 'check.notDrawn', key: 'erp', reason: 'A record, on no board yet', on: '2026-10-11' },
    ])
    expect(back.unreadable).toBeUndefined()
  })

  it('open a scope whose list is not a list to be read and not written', () => {
    const files: FolderFile[] = [
      ...scopeFiles(customer()).filter((file) => file.path !== CHECK_MARKS_FILE), { path: CHECK_MARKS_FILE, text: '{ "half": ' },
    ]
    const back = scopeFromFolder(files, 'customer')!
    expect(back.unread).toContain(CHECK_MARKS_FILE)
    expect(back.unreadable).toContain(CHECK_MARKS_FILE)
  })

  it('travel in a working file and come back whole', () => {
    const held = customer()
    const opened = openDocumentBytes(workingFileBytes([held]), held)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.scope.model.checkMarks).toEqual([vacancy, designTogether])
  })
})

async function plant(root: FakeDirectory, path: string, file: FolderFile): Promise<void> {
  const parts = path.split('/')
  let folder: DirectoryHandleLike = root
  for (const segment of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(segment, { create: true })
  ;(folder as FakeDirectory).writeRaw(parts[parts.length - 1], 'text' in file ? file.text : new TextDecoder().decode(file.bytes))
}

async function textAt(root: FakeDirectory, path: string): Promise<string> {
  const parts = path.split('/')
  let folder: DirectoryHandleLike = root
  for (const segment of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(segment)
  return (await (await folder.getFileHandle(parts[parts.length - 1])).getFile()).text()
}

describe('the folder marks are kept in', () => {
  it('is no name a scope can have, so no tree can hold one there', () => {
    expect(isSafeScopePath(CHECKS_FOLDER)).toBe(false)
    expect(isSafeScopePath(`customer/${CHECKS_FOLDER}`)).toBe(false)
  })

  it('is never walked as a scope, and is read with the scope’s records for the index', async () => {
    const root = new FakeDirectory('Architecture')
    for (const file of scopeFiles(bareScope('', 'Acme', 'organisation'))) await plant(root, file.path, file)
    for (const file of scopeFiles(customer())) await plant(root, `customer/${file.path}`, file)
    for (const file of scopeFiles(bareScope('', 'Planted'))) await plant(root, `customer/${CHECKS_FOLDER}/${file.path}`, file)
    const store = new FileSystemScopeStore(root)
    expect(flattenScopes(await store.list()).map((scope) => scope.path)).toEqual(['', 'customer'])
    const models = await store.models()
    expect(models.find((one) => one.path === 'customer')?.model.checkMarks).toEqual([vacancy, designTogether])
  })
})

// --- format 11 to 12 --------------------------------------------------------

/** One scope's files with its header saying another version. */
function atVersion(scope: ScopeSnapshot, version: number): FolderFile[] {
  return scopeFiles(scope).map((file) => (
    file.path === SCOPE_FILE && 'text' in file
      ? { ...file, text: file.text.replace(`"version": ${SCOPE_FORMAT_VERSION}`, `"version": ${version}`) }
      : file
  ))
}

/**
 * A tree at format 11 whose organisation has a scope filed under it called
 * `checks`: an ordinary name then, and one that stays what it is.
 */
async function elevenTree(): Promise<FakeDirectory> {
  const root = new FakeDirectory('Architecture')
  for (const scope of [bareScope('', 'Acme', 'organisation'), bareScope('checks', 'Checks', 'domain')]) {
    for (const file of atVersion(scope, 11)) await plant(root, scope.path ? `${scope.path}/${file.path}` : file.path, file)
  }
  return root
}

describe('a folder written at format 11', () => {
  it('reads as a 12 with nothing marked', async () => {
    const store = new FileSystemScopeStore(await elevenTree())
    const held = await store.load('')
    expect(held?.model.name).toBe('Acme')
    expect(held?.model.checkMarks).toBeUndefined()
    expect(held?.unreadable).toBeUndefined()
  })

  it('is brought up to the current format by the pass, and not one scope moves — not even one called checks', async () => {
    const root = await elevenTree()
    const store = new FileSystemScopeStore(root)
    expect((await store.outdated()).sort()).toEqual(['', 'checks'])
    expect(await upgradeProjects(store)).toMatchObject({ upgraded: 2, created: 0, failed: 0 })
    expect(flattenScopes(await store.list()).map((scope) => scope.path)).toEqual(['', 'checks'])
    for (const path of ['scope.json', 'checks/scope.json']) expect(JSON.parse(await textAt(root, path)).version).toBe(SCOPE_FORMAT_VERSION)
    expect(await store.outdated()).toEqual([])
    // A mark made after keeps beside the scope called checks, each in its own folder.
    await store.save({ ...bareScope('', 'Acme', 'organisation'), model: { ...bareScope('', 'Acme', 'organisation').model, checkMarks: [vacancy] } })
    expect(root.paths()).toEqual(expect.arrayContaining([CHECK_MARKS_FILE, 'checks/scope.json']))
    expect((await store.load(''))?.model.checkMarks).toEqual([vacancy])
  })
})

describe('a folder written at format 12, opened by a build that reads 11', () => {
  /** What a 12 is to a build whose newest is 11: a version one past its own, as this build sees a 13. */
  const later = (scope: ScopeSnapshot) => atVersion(scope, SCOPE_FORMAT_VERSION + 1)

  it('says a version past 11 wherever it keeps marks, which that build does not read', () => {
    expect(JSON.parse(textOf(scopeFiles(customer()), SCOPE_FILE)!).version).toBe(SCOPE_FORMAT_VERSION)
    expect(SCOPE_FORMAT_VERSION).toBeGreaterThan(11)
  })

  it('is refused rather than half-read, and nothing is saved over _checks/', async () => {
    expect(scopeFromFolder(later(customer()), 'customer')).toBeUndefined()
    const root = new FakeDirectory('Architecture')
    for (const file of scopeFiles(bareScope('', 'Acme', 'organisation'))) await plant(root, file.path, file)
    for (const file of later(customer())) await plant(root, `customer/${file.path}`, file)
    const marks = await textAt(root, `customer/${CHECK_MARKS_FILE}`)
    const store = new FileSystemScopeStore(root)
    expect((await store.list()).unreadable).toEqual(['customer'])
    expect(await store.load('customer')).toBeUndefined()
    await expect(store.save(bareScope('customer', 'Customer', 'domain'))).rejects.toMatchObject({ key: 'shell.unreadableNotSaved' })
    expect(await textAt(root, `customer/${CHECK_MARKS_FILE}`)).toBe(marks)
  })
})
