// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * This browser's own storage: the fallback, and it says so on the bar.
 *
 * The scopes are kept in this browser's database (ADR-0031, *browser storage
 * is IndexedDB*), and what the key-value storage kept before it is brought in
 * at every start (`adapters/webStorage/earlierScopes.ts`) — copied, never
 * moved. The key-value storage stays where the preferences are kept.
 */
import { browserRepositories } from '../../adapters/webStorage/browserRepositories'
import type { IndexedDb } from '../../adapters/webStorage/IndexedDbStore'
import type { KeyValueStorage } from '../../adapters/webStorage/KeyValueStorage'
import { WebStoragePreferencesStore } from '../../adapters/webStorage/WebStoragePreferencesStore'
import type { SourceProvider } from '../../platform/sourceProvider'
import type { WorkingSource } from '../../platform/workingSource'
import type { Diagnostics } from '../../ports/Diagnostics'
import type { PreferencesStore } from '../../ports/PreferencesStore'
import type { ProviderParts } from '../../ports/ProviderParts'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import { afterWrites, browserOwn } from './browserOwn'
import { fallingBack } from './fallingBack'
import type { BrowserOwn } from './browserOwn'
import type { Repositories } from '../../ports/Repositories'

/**
 * What this browser keeps: its database, where the scopes are, and the
 * key-value storage, where the preferences are and where the scopes were.
 */
export type BrowserOpening = {
  storage: KeyValueStorage
  database: IndexedDb
}

export type BrowserParts = ProviderParts<BrowserOwn> & {
  repositories: Repositories
  preferences: PreferencesStore
}

/** This browser, which is one place: there is nothing to tell apart. */
export const BROWSER_STORAGE: WorkingSource = { provider: 'browserStorage', name: '', key: '' }

export const BROWSER_STORAGE_SOURCE: SourceProvider<BrowserParts, BrowserOpening, { readonly diagnostics: Diagnostics }> = {
  kind: 'browserStorage',
  labelKey: 'shell.sourceBrowser',
  describeKey: 'shell.sourceTipBrowser',
  whereKey: 'browser.where',
  removeKey: 'picker.deleteBodyBrowser',
  open: ({ storage, database }, { diagnostics }) => {
    const { repositories, database: kept, earlier } = browserRepositories(database, storage)
    const { own, heard, fell } = browserOwn(kept, earlier)
    const writing = { ...repositories, scopes: afterWrites(repositories.scopes, kept, heard, diagnostics) }
    return {
      repositories: fallingBack(writing, memoryRepositories, (cause) => {
        diagnostics.report({ level: 'warn', where: 'browserStorage', message: 'the database would not open; nothing is kept', cause })
        fell()
      }),
      preferences: new WebStoragePreferencesStore(storage),
      source: BROWSER_STORAGE,
      own,
      historyNoteKey: 'browser.historyNote',
    }
  },
}
