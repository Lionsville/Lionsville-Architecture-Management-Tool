// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The five repository suites, run against this browser's storage over an IndexedDB of the suite's own. */
import { describeHistoryRepository } from '../../ports/HistoryRepository.contract'
import { describeImageRepository } from '../../ports/ImageRepository.contract'
import { describeOrganisationIndex } from '../../ports/OrganisationIndex.contract'
import type { RepositoriesUnderTest } from '../../ports/Repositories.contract'
import { describeScopeRepository } from '../../ports/ScopeRepository.contract'
import { describeSettingsRepository } from '../../ports/SettingsRepository.contract'
import { SHELVES } from '../repositories/KeyedStore'
import type { KeptContent } from '../repositories/kept'
import { browserRepositories } from './browserRepositories'
import { IndexedDbStore } from './IndexedDbStore'
import { fakeIndexedDb } from './testing/fakeIndexedDb'

/** A scope's content marked as a later version's, written by another opening of the same database. */
function make(): RepositoriesUnderTest {
  const indexedDb = fakeIndexedDb()
  return {
    repositories: browserRepositories(indexedDb),
    spoil: (scope) => new IndexedDbStore(indexedDb).transaction(SHELVES, 'write', async (tx) => {
      const held = await tx.get<KeptContent>('contents', scope)
      tx.put('contents', scope, { ...held, format: 2 })
    }),
  }
}

describeScopeRepository('browser storage', make)
describeOrganisationIndex('browser storage', make)
describeHistoryRepository('browser storage', make)
describeImageRepository('browser storage', make)
describeSettingsRepository('browser storage', make)
