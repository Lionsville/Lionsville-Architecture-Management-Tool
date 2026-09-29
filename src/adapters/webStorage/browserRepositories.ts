// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The five repositories in this browser's storage (ADR-0031 §2): the
 * repositories every keyed store shares (`adapters/repositories/`), over this
 * browser's database (`IndexedDbStore`) — started, the first time, with the
 * scopes this browser kept before them (`earlierScopes.ts`).
 */
import type { Repositories } from '../../ports/Repositories'
import { repositoriesOver } from '../repositories/repositoriesOver'
import { earlierScopes } from './earlierScopes'
import { IndexedDbStore } from './IndexedDbStore'
import type { IndexedDb } from './IndexedDbStore'
import type { KeyValueStorage } from './KeyValueStorage'

export const BROWSER_REPOSITORIES = 'browser storage'

/**
 * `earlier` is the key-value storage the scopes were kept in, where this
 * browser has one: read once, when the database is new, and never written.
 */
export function browserRepositories(indexedDb: IndexedDb, earlier?: KeyValueStorage, name?: string): Repositories {
  return repositoriesOver(new IndexedDbStore(indexedDb, name), {
    id: BROWSER_REPOSITORIES,
    by: 'this browser',
    ...(earlier ? { seed: () => earlierScopes(earlier) } : {}),
  })
}
