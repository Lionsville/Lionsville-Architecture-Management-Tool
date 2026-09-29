// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The five repository suites, run against this browser's storage over an
 * IndexedDB of the suite's own: the hand-written fake, and fake-indexeddb for
 * a second reading of the same API. Real browsers run them in
 * `IndexedDbStore.browser.test.ts`.
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
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
import type { IndexedDb } from './IndexedDbStore'
import { fakeIndexedDb } from './testing/fakeIndexedDb'

/** A scope's content marked as a later version's, written by another opening of the same database. */
function over(indexedDb: IndexedDb): RepositoriesUnderTest {
  return {
    repositories: browserRepositories(indexedDb).repositories,
    spoil: (scope) => new IndexedDbStore(indexedDb).transaction(SHELVES, 'write', async (tx) => {
      const held = await tx.get<KeptContent>('contents', scope)
      tx.put('contents', scope, { ...held, format: 2 })
    }),
  }
}

const make = () => over(fakeIndexedDb())
const makeOverFakeIndexedDb = () => over({ factory: new IDBFactory(), keyRange: IDBKeyRange })

describeScopeRepository('browser storage', make)
describeOrganisationIndex('browser storage', make)
describeHistoryRepository('browser storage', make)
describeImageRepository('browser storage', make)
describeSettingsRepository('browser storage', make)

describeScopeRepository('browser storage, fake-indexeddb', makeOverFakeIndexedDb)
describeOrganisationIndex('browser storage, fake-indexeddb', makeOverFakeIndexedDb)
describeHistoryRepository('browser storage, fake-indexeddb', makeOverFakeIndexedDb)
describeImageRepository('browser storage, fake-indexeddb', makeOverFakeIndexedDb)
describeSettingsRepository('browser storage, fake-indexeddb', makeOverFakeIndexedDb)
