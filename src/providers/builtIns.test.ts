// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The repositories each provider that ships hands the app, as the app gets
 * them: through the provider's own `open`, with everything it wraps them in
 * — the folder's push after an entry, this browser's word after a write and
 * its fall to memory — and held to core's five suites, as any provider
 * composed from outside is (ADR-0031 §4).
 */
import { RecordingDiagnostics } from '../adapters/memory/RecordingDiagnostics'
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
  ['the memory provider', async () => ({ repositories: (await MEMORY_SOURCE.open(undefined, {})).repositories })],
  ['this browser\'s provider', async () => ({
    repositories: (await BROWSER_STORAGE_SOURCE.open(
      { storage: keyValues(), database: fakeIndexedDb() }, { diagnostics: new RecordingDiagnostics() },
    )).repositories,
  })],
  ['the folder provider', async () => ({
    repositories: (await openFolder(
      { handle: new FakeDirectory('Architecture'), name: 'Architecture', root: 'Architecture' },
      { diagnostics: new RecordingDiagnostics() },
    )).repositories,
  })],
]

for (const [name, make] of MAKERS) {
  describeScopeRepository(name, make)
  describeOrganisationIndex(name, make)
  describeHistoryRepository(name, make)
  describeImageRepository(name, make)
  describeSettingsRepository(name, make)
}
