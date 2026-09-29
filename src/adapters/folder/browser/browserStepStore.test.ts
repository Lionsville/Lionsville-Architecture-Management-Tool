// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { StepMemory } from '../stepMemory'
import { browserStepStore, indexedDbShelf } from './browserStepStore'
import type { KeptSteps, SameFolder, StepShelf } from './browserStepStore'

/** A handle that is the same folder as another handle of the same folder, and of no other — as a browser's are. */
function handleOf(folder: string): SameFolder & { folder: string } {
  return { folder, isSameEntry: (other) => Promise.resolve((other as { folder?: string }).folder === folder) }
}

function shelfInMemory(): StepShelf & { held(): KeptSteps[] } {
  let kept: KeptSteps[] = []
  return {
    read: () => Promise.resolve([...kept]),
    write: (next) => {
      kept = [...next]
      return Promise.resolve()
    },
    held: () => kept,
  }
}

describe('a browser folder’s applied step ids', () => {
  it('are found again by a handle of the same folder, as a reopened tab has, and kept apart from another folder’s', async () => {
    const shelf = shelfInMemory()
    await new StepMemory(browserStepStore(handleOf('acme'), shelf)).remember([{ stepId: 'one', scope: 's-1' }])
    await new StepMemory(browserStepStore(handleOf('globex'), shelf)).remember([{ stepId: 'two', scope: 's-2' }])
    expect(await new StepMemory(browserStepStore(handleOf('acme'), shelf)).where('one')).toEqual({ scope: 's-1' })
    expect(await new StepMemory(browserStepStore(handleOf('acme'), shelf)).where('two')).toBeUndefined()
    expect(shelf.held()).toHaveLength(2)
  })

  it('keep a folder for a day at least after its last step, and let it go after two', async () => {
    const shelf = shelfInMemory()
    let now = 1_000_000
    await browserStepStore(handleOf('acme'), shelf, () => now).write({ one: ['s-1', now] })
    now += 24 * 60 * 60 * 1000
    await browserStepStore(handleOf('globex'), shelf, () => now).write({ two: ['s-2', now] })
    expect(shelf.held().map((one) => (one.handle as unknown as { folder: string }).folder)).toEqual(['acme', 'globex'])
    now += 24 * 60 * 60 * 1000
    await browserStepStore(handleOf('globex'), shelf, () => now).write({ two: ['s-2', now] })
    expect(shelf.held().map((one) => (one.handle as unknown as { folder: string }).folder)).toEqual(['globex'])
  })
})

/** Enough IndexedDB to keep one list: what the shelf asks of it and no more. */
function fakeIndexedDb(): IDBFactory {
  const held = new Map<string, unknown>()
  const answer = <T>(result: T) => {
    const request = { result, error: null, onsuccess: () => {}, onerror: () => {}, onupgradeneeded: () => {} }
    queueMicrotask(() => request.onsuccess())
    return request
  }
  const database = {
    createObjectStore: () => {},
    transaction: () => ({
      objectStore: () => ({
        get: (key: string) => answer(held.get(key)),
        put: (value: unknown, key: string) => answer(held.set(key, value) && undefined),
      }),
    }),
  }
  return { open: () => answer(database) } as unknown as IDBFactory
}

describe('the list in IndexedDB', () => {
  it('keeps what it was given and reads it back', async () => {
    const shelf = indexedDbShelf(fakeIndexedDb())
    expect(await shelf.read()).toEqual([])
    const kept = [{ handle: handleOf('acme'), steps: { one: ['s-1', 1] as [string, number] }, at: 1 }]
    await shelf.write(kept)
    expect(await shelf.read()).toEqual(kept)
  })

  it('keeps nothing, and reads nothing, where the browser keeps no IndexedDB', async () => {
    const shelf = indexedDbShelf(undefined)
    await shelf.write([{ handle: handleOf('acme'), steps: {}, at: 1 }])
    expect(await shelf.read()).toEqual([])
  })
})
