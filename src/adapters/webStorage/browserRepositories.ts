// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The five repositories in this browser's storage (ADR-0031 §2): the
 * repositories every keyed store shares (`adapters/repositories/`), over this
 * browser's database (`IndexedDbStore`) — with what the key-value storage kept
 * before them brought in (`earlierScopes.ts`), where there is one.
 */
import type { Repositories } from '../../ports/Repositories'
import { repositoriesOn } from '../repositories/repositoriesOver'
import { Source } from '../repositories/source'
import { bringingEarlier, earlierOf } from './earlierScopes'
import type { Earlier } from './earlierScopes'
import { IndexedDbStore } from './IndexedDbStore'
import type { IndexedDb } from './IndexedDbStore'
import type { KeyValueStorage } from './KeyValueStorage'

export const BROWSER_REPOSITORIES = 'browser storage'

/** The repositories, and — where there is a key-value storage — the answers about what it kept before. */
export type BrowserSource = { repositories: Repositories; earlier?: Earlier }

/**
 * `earlier` is the key-value storage the scopes were kept in, where this
 * browser has one: read at every start, and written only for its marker.
 */
export function browserRepositories(indexedDb: IndexedDb, earlier?: KeyValueStorage, name?: string): BrowserSource {
  const source = new Source(new IndexedDbStore(indexedDb, name), {
    id: BROWSER_REPOSITORIES,
    by: 'this browser',
    ...(earlier ? { bring: bringingEarlier(earlier) } : {}),
  })
  return { repositories: repositoriesOn(source), ...(earlier ? { earlier: earlierOf(source, earlier) } : {}) }
}
