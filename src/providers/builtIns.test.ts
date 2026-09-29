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
import { spoilKept } from '../adapters/repositories/testing/spoil'
import { textAt, writeAt } from '../adapters/folder/handles'
import { spoilFolder } from '../adapters/folder/testing/spoil'
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
    return { repositories, spoil: (scope, how) => spoilKept(store, scope, how) }
  }],
  ['this browser\'s provider', async () => {
    const database: IndexedDb = fakeIndexedDb()
    const { repositories } = await BROWSER_STORAGE_SOURCE.open(
      { storage: keyValues(), database }, { diagnostics: new RecordingDiagnostics() },
    )
    return { repositories, spoil: (scope, how) => spoilKept(new IndexedDbStore(database), scope, how) }
  }],
  ['the folder provider', async () => {
    const handle = new FakeDirectory('Architecture')
    const { repositories } = await openFolder({ handle, name: 'Architecture', root: 'Architecture' }, { diagnostics: new RecordingDiagnostics() })
    return {
      repositories,
      spoil: (scope, how) => spoilFolder(repositories, { read: (path) => textAt(handle, path), write: (path, text) => writeAt(handle, path, text) }, scope, how),
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
