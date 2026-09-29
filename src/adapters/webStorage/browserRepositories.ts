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
import type { Earlier, EarlierWords } from './earlierScopes'
import { IndexedDbStore } from './IndexedDbStore'
import type { IndexedDb, Pressure, Standing } from './IndexedDbStore'
import type { KeyValueStorage } from './KeyValueStorage'

export const BROWSER_REPOSITORIES = 'browser storage'

/**
 * What the app may show about this browser's database: whether the page may
 * still write to it, how full it is, and whether the browser agreed to keep it.
 * A refusal a transaction met is the repositories' rejection, a `ShellError`
 * keyed `shell.storageFull` or `shell.storageReload`; this is the standing
 * behind it, for a notice that stays up.
 */
export type BrowserDatabase = {
  /** `open`, `blocked` while an older tab holds the database, or `reload`. */
  standing(): Standing
  /** Told each time the standing moves; answers the way to stop being told. */
  onStanding(listener: (standing: Standing) => void): () => void
  /** How full this site's storage is, in bytes, where the browser says: for the nearly-full notice. */
  pressure(): Promise<Pressure | undefined>
  /** Whether the browser keeps this site's storage through a clear-out; asks the person nothing. */
  persisted(): Promise<boolean | undefined>
  /**
   * Ask the browser, once, to keep this site's storage through a clear-out.
   * Call it after the first save that landed, or from a person's gesture —
   * never at start-up: Firefox puts the question to the person.
   */
  keep(): Promise<boolean | undefined>
}

/** The repositories, what may be shown about the database, and — where there is a key-value storage — the answers about what it kept before. */
export type BrowserSource = { repositories: Repositories; database: BrowserDatabase; earlier?: Earlier }

/**
 * `earlier` is the key-value storage the scopes were kept in, where this
 * browser has one: read at every start, and written only for its marker.
 * `indexedDb.manager`, the browser's storage manager, is how the store asks
 * to be kept through a clear-out and says how full it is; without one, both
 * answer nothing.
 */
export function browserRepositories(
  indexedDb: IndexedDb, earlier?: KeyValueStorage, name?: string,
  /** Who the entries say made them, and what a bringing's entries say, in the person's language. */
  words: { by?: string; earlier?: EarlierWords } = {},
): BrowserSource {
  const store = new IndexedDbStore(indexedDb, name)
  const source = new Source(store, {
    id: BROWSER_REPOSITORIES,
    by: words.by ?? 'this browser',
    ...(earlier ? { bring: bringingEarlier(earlier, words.earlier) } : {}),
  })
  const database: BrowserDatabase = {
    standing: () => store.standing(),
    onStanding: (listener) => store.onStanding(listener),
    pressure: () => store.pressure(),
    persisted: () => store.persisted(),
    keep: () => store.keep(),
  }
  return {
    repositories: repositoriesOn(source), database,
    ...(earlier ? { earlier: earlierOf(source, earlier, words.earlier) } : {}),
  }
}
