// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A folder made ready to open in a tab, and somewhere new a working file may
 * become: looked at before anything is written, and written as one.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { FakeDirectory } from '../../adapters/folder/fakeDirectory'
import type { ScopeSnapshot } from '../../projects/scope'
import { browserOpening, destinationIn } from './openings'

const scope = (path: string, name: string): ScopeSnapshot => ({
  path, model: { name, elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [],
})

afterEach(() => {
  delete (globalThis as { indexedDB?: unknown }).indexedDB
  delete (globalThis as { IDBKeyRange?: unknown }).IDBKeyRange
})

describe('a folder in a tab', () => {
  it('keeps its history in this browser\'s database, beside the folder, where there is one', () => {
    Object.assign(globalThis, { indexedDB: new IDBFactory(), IDBKeyRange })
    const opening = browserOpening(new FakeDirectory('Architecture'))
    expect([opening.name, opening.root, opening.historyNoteKey]).toEqual(['Architecture', 'Architecture', 'folder.historyNoteBrowser'])
    expect([opening.git, opening.steps, opening.places, opening.stamps].every(Boolean)).toBe(true)
  })

  it('keeps nothing beside the folder in a browser with no database', () => {
    const opening = browserOpening(new FakeDirectory('Architecture'))
    expect(opening).toEqual({ handle: opening.handle, name: 'Architecture', root: 'Architecture' })
  })
})

describe('somewhere new a working file may become', () => {
  it('is empty where the folder holds nothing, and takes the scopes as one', async () => {
    const handle = new FakeDirectory('New')
    const destination = await destinationIn({ handle, name: 'New', root: 'New' })
    expect([destination.name, destination.occupied]).toEqual(['New', false])
    await destination.place([scope('', 'Acme Logistics'), scope('retail', 'Retail')])
    expect((await destination.read('retail'))?.model.name).toBe('Retail')
    expect((await destination.read(''))?.model.name).toBe('Acme Logistics')
  })

  it('is occupied where the folder already holds a scope', async () => {
    const handle = new FakeDirectory('Elsewhere')
    await (await destinationIn({ handle, name: 'Elsewhere', root: 'Elsewhere' })).place([scope('retail', 'Retail')])
    expect((await destinationIn({ handle, name: 'Elsewhere', root: 'Elsewhere' })).occupied).toBe(true)
  })
})

describe('somewhere new, whose root is something already', () => {
  it('is occupied where the root has a document of its own', async () => {
    const handle = new FakeDirectory('Named')
    await (await destinationIn({ handle, name: 'Named', root: 'Named' })).place([scope('', 'Globex')])
    expect((await destinationIn({ handle, name: 'Named', root: 'Named' })).occupied).toBe(true)
  })
})
