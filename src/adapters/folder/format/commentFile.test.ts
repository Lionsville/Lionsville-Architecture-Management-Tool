// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The comments on disk (ADR-0037 §2, format 13): one file per record
 * commented on under `_comments/`, read back byte for byte as it was written;
 * a hand-edited file read as far as it reads; a file that is not a list
 * opening the scope to be read and not written; the folder never walked as a
 * scope; and the threads travelling in a working file and through a store.
 */
import { describe, expect, it } from 'vitest'
import type { Comment } from '../../../model/comment'
import { bareScope, flattenScopes } from '../../../projects/scope'
import type { ScopeSnapshot } from '../../../projects/scope'
import { isSafeScopePath } from '../../../projects/scopePath'
import { stableJson } from '../../../projects/text'
import { FakeDirectory } from '../fakeDirectory'
import type { DirectoryHandleLike } from '../FileSystemScopeStore'
import { FileSystemScopeStore } from '../FileSystemScopeStore'
import { COMMENTS_FOLDER, threadOf, threadPath } from './commentFile'
import { isFormatPath, SCOPE_FOLDERS, scopeFiles, scopeFromFolder } from './folderFormat'
import type { FolderFile } from './folderFormat'
import { openDocumentBytes, workingFileBytes } from './workingFile'

const AT = '2026-10-16T09:00:00.000Z'
const question: Comment = { id: 'cm-1', about: { kind: 'element', id: 'web' }, by: { person: 'pe-1' }, at: AT, body: 'Who runs this?' }
const answer: Comment = { ...question, id: 'cm-2', by: { person: 'pe-2' }, body: 'The web team.', replyTo: 'cm-1', via: 'An agent' }
const removed: Comment = {
  ...question, id: 'cm-3', about: { kind: 'observation', id: 'ob-1' }, body: '',
  removed: { at: AT, by: { person: 'pe-1' } }, from: { kind: 'observation', id: 'ob-9', scope: 'elsewhere' },
}

/** A domain with two records commented on. */
function shop(): ScopeSnapshot {
  const scope = bareScope('shop', 'Shop', 'domain')
  return { ...scope, model: { ...scope.model, comments: [question, removed, answer] } }
}

const textOf = (files: readonly FolderFile[], path: string) => {
  const file = files.find((one) => one.path === path)
  return file && 'text' in file ? file.text : undefined
}

describe('comments in a scope’s folder', () => {
  it('are one file per record under _comments/, each thread oldest first, read back byte for byte', () => {
    const files = scopeFiles(shop())
    const threads = files.map((file) => file.path).filter((path) => path.startsWith(`${COMMENTS_FOLDER}/`))
    expect(threads).toEqual(['_comments/element-web.json', '_comments/observation-ob-1.json'])
    expect(JSON.parse(textOf(files, '_comments/element-web.json')!)).toEqual([
      { id: 'cm-1', by: { person: 'pe-1' }, at: AT, body: 'Who runs this?' },
      { id: 'cm-2', by: { person: 'pe-2' }, at: AT, body: 'The web team.', replyTo: 'cm-1', via: 'An agent' },
    ])
    const back = scopeFromFolder(files, 'shop')!
    // Read thread by thread: the order of the files, each in its own order.
    expect(back.model.comments).toEqual([question, answer, removed])
    expect(stableJson(scopeFiles(back))).toBe(stableJson(files))
  })

  it('write no file where the scope holds none, and read none back', () => {
    const files = scopeFiles(bareScope('shop', 'Shop'))
    expect(files.some((file) => file.path.startsWith(`${COMMENTS_FOLDER}/`))).toBe(false)
    expect('comments' in scopeFromFolder(files, 'shop')!.model).toBe(false)
  })

  it('are the format’s: a thread’s file and nothing else in the folder', () => {
    expect(isFormatPath('_comments/element-web.json')).toBe(true)
    expect(isFormatPath('_comments/notes.txt')).toBe(false)
    expect(isFormatPath('_comments/nothing-x.json')).toBe(false)
    expect(isFormatPath('_comments/deeper/element-web.json')).toBe(false)
    expect(SCOPE_FOLDERS).toContain(COMMENTS_FOLDER)
  })

  it('name a record a file name could not hold escaped, and read it back as it was', () => {
    const odd = { kind: 'decision' as const, id: 'adr 1/2' }
    expect(threadPath(odd)).toBe('_comments/decision-adr%201%2F2.json')
    expect(threadOf(threadPath(odd))).toEqual(odd)
    expect(threadOf('_comments/element-%E0.json')).toBeUndefined()
  })

  it('read what they can of a hand-edited file, and pass over a row that cannot be a comment and a second of one', () => {
    const files: FolderFile[] = [
      ...scopeFiles(bareScope('shop', 'Shop')),
      { path: '_comments/element-web.json', text: JSON.stringify([
        { id: 'cm-1', by: { person: 'pe-1' }, at: AT, body: 'Kept', extra: true },
        { id: 'cm-1', by: { person: 'pe-1' }, at: AT, body: 'Said twice' },
        { id: 'cm-4', by: 'Somebody typed', at: AT, body: 'No author from the register' },
        { by: { person: 'pe-1' }, at: AT, body: 'No id' },
        { id: 'cm-5', by: { person: 'pe-1' }, body: 'No time' },
        { id: 'cm-6', by: { person: 'pe-1' }, at: AT, about: { kind: 'element', id: 'pay' }, body: 'The file says the record' },
        'not a row',
      ]) },
    ]
    const back = scopeFromFolder(files, 'shop')!
    expect(back.model.comments).toEqual([
      { id: 'cm-1', about: { kind: 'element', id: 'web' }, by: { person: 'pe-1' }, at: AT, body: 'Kept' },
      { id: 'cm-6', about: { kind: 'element', id: 'web' }, by: { person: 'pe-1' }, at: AT, body: 'The file says the record' },
    ])
    expect(back.unreadable).toBeUndefined()
  })

  it('open a scope whose thread is not a list to be read and not written', () => {
    const files: FolderFile[] = [
      ...scopeFiles(shop()).filter((file) => file.path !== '_comments/element-web.json'),
      { path: '_comments/element-web.json', text: '{ "half": ' },
    ]
    const back = scopeFromFolder(files, 'shop')!
    expect(back.unread).toContain('_comments/element-web.json')
    expect(back.unreadable).toContain('_comments/element-web.json')
    expect(back.model.comments).toEqual([removed])
  })

  it('travel in a working file and come back whole', () => {
    const held = shop()
    const opened = openDocumentBytes(workingFileBytes([held]), held)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.scope.model.comments).toEqual([question, answer, removed])
  })
})

async function plant(root: FakeDirectory, path: string, file: FolderFile): Promise<void> {
  const parts = path.split('/')
  let folder: DirectoryHandleLike = root
  for (const segment of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(segment, { create: true })
  ;(folder as FakeDirectory).writeRaw(parts[parts.length - 1], 'text' in file ? file.text : new TextDecoder().decode(file.bytes))
}

describe('the folder comments are kept in', () => {
  it('is no name a scope can have, so no tree can hold one there', () => {
    expect(isSafeScopePath(COMMENTS_FOLDER)).toBe(false)
    expect(isSafeScopePath(`shop/${COMMENTS_FOLDER}`)).toBe(false)
  })

  it('is never walked as a scope, is read with the scope, and loses a thread that empties', async () => {
    const root = new FakeDirectory('Architecture')
    for (const file of scopeFiles(bareScope('', 'Acme', 'organisation'))) await plant(root, file.path, file)
    for (const file of scopeFiles(shop())) await plant(root, `shop/${file.path}`, file)
    for (const file of scopeFiles(bareScope('', 'Planted'))) await plant(root, `shop/${COMMENTS_FOLDER}/${file.path}`, file)
    const store = new FileSystemScopeStore(root)
    expect(flattenScopes(await store.list()).map((scope) => scope.path)).toEqual(['', 'shop'])
    const held = await store.load('shop')
    expect(held?.model.comments).toEqual([question, answer, removed])
    await store.save({ ...held!, model: { ...held!.model, comments: [removed] } })
    expect(root.paths()).not.toContain('shop/_comments/element-web.json')
    expect(root.paths()).toContain('shop/_comments/observation-ob-1.json')
    expect((await store.load('shop'))?.model.comments).toEqual([removed])
  })
})
