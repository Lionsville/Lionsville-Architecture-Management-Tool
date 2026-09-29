// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A browser folder's applied step ids, kept in this browser and not in the
 * folder (ADR-0031, as built).
 *
 * A folder handle has no identity storage can be keyed by: two handles can
 * only be asked whether they are the same folder (`isSameEntry`). So the ids
 * are kept beside the handles themselves, which IndexedDB can hold — a list of
 * folders, each with its handle and its steps — and a folder's steps are the
 * entry whose handle is the same folder as this one. Kept for two days after a
 * folder's last step; an entry older than that is let go of with the next
 * write, so the list is as long as the folders worked in lately.
 */
import type { AppliedSteps, StepStore } from '../stepMemory'

/** A folder handle as far as this needs one: something that can say whether another is the same folder. */
export type SameFolder = { isSameEntry(other: SameFolder): Promise<boolean> }

/** One folder's entry: its handle, its applied steps, and when they were last written. */
export type KeptSteps = { handle: SameFolder; steps: AppliedSteps; at: number }

/** Where the list is kept: IndexedDB in a browser, anything that keeps a list in a test. */
export type StepShelf = {
  read(): Promise<KeptSteps[]>
  write(kept: readonly KeptSteps[]): Promise<void>
}

/** How long after its last step a folder's entry is kept: twice the day the contract promises. */
const KEPT_MS = 2 * 24 * 60 * 60 * 1000

const DATABASE = 'lvarch.steps'
const STORE = 'folders'
const KEY = 'applied'

function request<T>(held: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    held.onsuccess = () => resolve(held.result)
    held.onerror = () => reject(held.error ?? new Error('IndexedDB refused'))
  })
}

/**
 * The list in this browser's IndexedDB. Where the browser keeps none — a
 * private window, a strict policy — reading answers an empty list and writing
 * keeps nothing, and the ids last as long as the repositories are open.
 */
export function indexedDbShelf(factory: IDBFactory | undefined = globalThis.indexedDB): StepShelf {
  const open = async (): Promise<IDBDatabase | undefined> => {
    if (!factory) return undefined
    try {
      const opening = factory.open(DATABASE, 1)
      opening.onupgradeneeded = () => opening.result.createObjectStore(STORE)
      return await request(opening)
    } catch {
      return undefined
    }
  }
  return {
    async read() {
      const database = await open()
      if (!database) return []
      const held = await request(database.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)).catch(() => undefined)
      return Array.isArray(held) ? held as KeptSteps[] : []
    },
    async write(kept) {
      const database = await open()
      if (!database) return
      await request(database.transaction(STORE, 'readwrite').objectStore(STORE).put([...kept], KEY))
    },
  }
}

/** The entry of the list that is this folder, by asking each handle whether it is the same folder. */
async function entryOf(kept: readonly KeptSteps[], folder: SameFolder): Promise<number> {
  for (const [at, one] of kept.entries()) {
    if (await one.handle.isSameEntry(folder).catch(() => false)) return at
  }
  return -1
}

/** A browser folder's step ids, on a shelf, matched by the folder's handle. */
export function browserStepStore(folder: SameFolder, shelf: StepShelf = indexedDbShelf(), now: () => number = Date.now): StepStore {
  return {
    async read() {
      const kept = await shelf.read()
      const at = await entryOf(kept, folder)
      return at < 0 ? undefined : structuredClone(kept[at].steps)
    },
    async write(steps) {
      const kept = await shelf.read()
      const at = await entryOf(kept, folder)
      const mine: KeptSteps = { handle: folder, steps: structuredClone(steps), at: now() }
      const next = at < 0 ? [...kept, mine] : kept.map((one, index) => (index === at ? mine : one))
      await shelf.write(next.filter((one) => one === mine || now() - one.at < KEPT_MS))
    },
  }
}
