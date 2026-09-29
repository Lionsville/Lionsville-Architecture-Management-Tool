// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a browser keeps for a folder, over the database a browser's
 * repositories keep their own work in.
 *
 * What node cannot show: a browser keeps a `FileSystemDirectoryHandle` in its
 * database as itself, and one read back answers `isSameEntry` for the folder
 * it was made for. Node has no such handle, and a structured clone of an
 * object with methods drops them; so the handles here are plain objects the
 * clone keeps, and whether two are one folder is asked by what they say.
 */
import { describe, expect, it } from 'vitest'
import { MemoryStore } from '../../memory/MemoryStore'
import { IndexedDbStore } from '../../webStorage/IndexedDbStore'
import { fakeIndexedDb } from '../../webStorage/testing/fakeIndexedDb'
import { StepMemory } from '../stepMemory'
import { BrowserFolder } from './browserFolder'
import type { SameFolder } from './browserFolder'
import { browserPlaceStore, browserStampCache, browserStepStore } from './browserStepStore'

const same: SameFolder = (kept, mine) => Promise.resolve((kept as { folder: string }).folder === (mine as { folder: string }).folder)

describe('what a browser keeps for a folder', () => {
  it('finds a folder again by a handle of the same folder, as a reopened tab has, and keeps another folder’s apart', async () => {
    const store = new IndexedDbStore(fakeIndexedDb())
    const acme = () => new BrowserFolder(store, { folder: 'acme' }, same)
    await new StepMemory(browserStepStore(acme())).remember([{ stepId: 'one', scope: 's-1' }])
    await new StepMemory(browserStepStore(new BrowserFolder(store, { folder: 'globex' }, same))).remember([{ stepId: 'two', scope: 's-2' }])
    expect(await new StepMemory(browserStepStore(acme())).where('one')).toEqual({ scope: 's-1' })
    expect(await new StepMemory(browserStepStore(acme())).where('two')).toBeUndefined()
    expect(await acme().folderKey()).toBe(await acme().folderKey())
  })

  it('loses no step id of another tab’s: each writes only what it changed', async () => {
    const store = new MemoryStore()
    const one = new StepMemory(browserStepStore(new BrowserFolder(store, { folder: 'acme' }, same)))
    const other = new StepMemory(browserStepStore(new BrowserFolder(store, { folder: 'acme' }, same)))
    await one.where('warm')
    await other.where('warm')
    await one.remember([{ stepId: 'from-one', scope: 's-1' }])
    await other.remember([{ stepId: 'from-other', scope: 's-1' }])
    const fresh = new StepMemory(browserStepStore(new BrowserFolder(store, { folder: 'acme' }, same)))
    expect(await fresh.where('from-one')).toEqual({ scope: 's-1' })
    expect(await fresh.where('from-other')).toEqual({ scope: 's-1' })
  })

  it('keeps where the identities were found, and what the pictures were found to be, beside the step ids', async () => {
    const store = new MemoryStore()
    const folder = new BrowserFolder(store, { folder: 'acme' }, same)
    await browserPlaceStore(folder).write({ 's-1': 'acme' })
    const found = { size: 3, lastModified: 5, contentAddress: 'sha256:ab', width: 1, height: 2 }
    await browserStampCache(folder).write({ 'acme\u0000map.png': found })
    const again = new BrowserFolder(store, { folder: 'acme' }, same)
    expect(await browserPlaceStore(again).read()).toEqual({ 's-1': 'acme' })
    expect(await browserStampCache(again).read()).toEqual({ 'acme\u0000map.png': found })
    expect(await browserStepStore(again).read()).toBeUndefined()
  })

  it('settles two tabs opening a new folder at once on one key, so neither’s steps are kept where the other never looks', async () => {
    const store = new MemoryStore()
    const [one, other] = [new BrowserFolder(store, { folder: 'acme' }, same), new BrowserFolder(store, { folder: 'acme' }, same)]
    const [first, second] = await Promise.all([one.folderKey(), other.folderKey()])
    expect(first).toBe(second)
    await new StepMemory(browserStepStore(one)).remember([{ stepId: 'from-one', scope: 's-1' }])
    expect(await new StepMemory(browserStepStore(other)).where('from-one')).toEqual({ scope: 's-1' })
  })
})
