// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The repositories each provider that ships hands the app, as the app gets
 * them: through the provider's own `open`, with everything it wraps them in
 * — the folder's push after an entry, this browser's word after a write and
 * its fall to memory — and held to core's five suites, as any provider
 * composed from outside is (ADR-0031 §4).
 */
import { vi } from 'vitest'
import type { MemoryStore } from '../adapters/memory/MemoryStore'
import { RecordingDiagnostics } from '../adapters/memory/RecordingDiagnostics'
import { SHELVES } from '../adapters/repositories/KeyedStore'
import type { KeptContent } from '../adapters/repositories/kept'
import { writeAt } from '../adapters/folder/handles'
import { IndexedDbStore } from '../adapters/webStorage/IndexedDbStore'
import type { IndexedDb } from '../adapters/webStorage/IndexedDbStore'
import { FakeDirectory } from '../adapters/folder/fakeDirectory'
import type { KeyValueStorage } from '../adapters/webStorage/KeyValueStorage'
import { fakeIndexedDb } from '../adapters/webStorage/testing/fakeIndexedDb'
import { describeHistoryRepository } from '../ports/HistoryRepository.contract'
import { describeImageRepository } from '../ports/ImageRepository.contract'
import { describeOrganisationIndex } from '../ports/OrganisationIndex.contract'
import type { MakeRepositories } from '../ports/Repositories.contract'
import { describeScopeRepository } from '../ports/ScopeRepository.contract'
import { describeSettingsRepository } from '../ports/SettingsRepository.contract'
import { BROWSER_STORAGE_SOURCE } from './browserStorage/browserStorageSource'
import { openFolder } from './folder/openFolder'
import { MEMORY_SOURCE } from './memory/memorySource'

/**
 * The store the memory provider keeps its repositories in, as it made it:
 * where a suite reaches past the repositories to spoil a scope, as the memory
 * implementation's own suite does.
 */
const made = vi.hoisted(() => ({ store: undefined as MemoryStore | undefined }))
vi.mock('../adapters/memory/memoryRepositories', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../adapters/memory/memoryRepositories')>()
  const { MemoryStore: Store } = await import('../adapters/memory/MemoryStore')
  return {
    ...actual,
    memoryRepositories: (store = new Store()) => {
      made.store = store
      return actual.memoryRepositories(store)
    },
  }
})

/** A scope's content marked as a later version's, which no build here reads whole. */
function laterVersion(store: { transaction: MemoryStore['transaction'] }, scope: string): Promise<void> {
  return store.transaction(SHELVES, 'write', async (tx) => {
    const held = await tx.get<KeptContent>('contents', scope)
    tx.put('contents', scope, { ...held, format: 2 })
  })
}

/** A key-value storage that keeps what it is given, for as long as the test runs. */
function keyValues(): KeyValueStorage {
  const held = new Map<string, string>()
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => { held.set(key, value) },
    removeItem: (key) => { held.delete(key) },
    keys: () => [...held.keys()],
  }
}

const MAKERS: readonly [string, MakeRepositories][] = [
  ['the memory provider', async () => {
    const { repositories } = await MEMORY_SOURCE.open(undefined, {})
    const store = made.store!
    return { repositories, spoil: (scope) => laterVersion(store, scope) }
  }],
  ['this browser\'s provider', async () => {
    const database: IndexedDb = fakeIndexedDb()
    const { repositories } = await BROWSER_STORAGE_SOURCE.open(
      { storage: keyValues(), database }, { diagnostics: new RecordingDiagnostics() },
    )
    return { repositories, spoil: (scope) => laterVersion(new IndexedDbStore(database), scope) }
  }],
  ['the folder provider', async () => {
    const handle = new FakeDirectory('Architecture')
    const { repositories } = await openFolder({ handle, name: 'Architecture', root: 'Architecture' }, { diagnostics: new RecordingDiagnostics() })
    return {
      repositories,
      // A model.json that is there and is not a model: the scope reads to be looked at, and takes no step.
      spoil: async (scope) => {
        const state = await repositories.scopes.state(scope)
        if (state) await writeAt(handle, state.address ? `${state.address}/model.json` : 'model.json', '{ half a write')
      },
    }
  }],
]

for (const [name, make] of MAKERS) {
  describeScopeRepository(name, make)
  describeOrganisationIndex(name, make)
  describeHistoryRepository(name, make)
  describeImageRepository(name, make)
  describeSettingsRepository(name, make)
}
