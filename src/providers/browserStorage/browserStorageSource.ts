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
import type { Earlier } from '../../adapters/webStorage/earlierScopes'
import type { IndexedDb } from '../../adapters/webStorage/IndexedDbStore'
import type { KeyValueStorage } from '../../adapters/webStorage/KeyValueStorage'
import { WebStoragePreferencesStore } from '../../adapters/webStorage/WebStoragePreferencesStore'
import { WebStorageScopeStore } from '../../adapters/webStorage/WebStorageScopeStore'
import type { SourceProvider } from '../../platform/sourceProvider'
import type { WorkingSource } from '../../platform/workingSource'
import type { PreferencesStore } from '../../ports/PreferencesStore'
import type { Repositories } from '../../ports/Repositories'
import type { ScopeStore } from '../../ports/ScopeStore'

/**
 * What this browser keeps: its database, where the scopes are, and the
 * key-value storage, where the preferences are and where the scopes were.
 */
export type BrowserOpening = {
  storage: KeyValueStorage
  database: IndexedDb
}

export type BrowserParts = {
  scopes: ScopeStore
  repositories: Repositories
  preferences: PreferencesStore
  source: WorkingSource
  /** What the key-value storage kept before the database, for the questions a person answers about it. */
  earlier?: Earlier
}

/** This browser, which is one place: there is nothing to tell apart. */
export const BROWSER_STORAGE: WorkingSource = { provider: 'browserStorage', name: '', key: '' }

export const BROWSER_STORAGE_SOURCE: SourceProvider<BrowserParts, BrowserOpening> = {
  kind: 'browserStorage',
  labelKey: 'shell.sourceBrowser',
  describeKey: 'shell.sourceTipBrowser',
  whereKey: 'browser.where',
  removeKey: 'picker.deleteBodyBrowser',
  open: ({ storage, database }) => {
    const { repositories, earlier } = browserRepositories(database, storage)
    return {
      scopes: new WebStorageScopeStore(storage),
      repositories,
      preferences: new WebStoragePreferencesStore(storage),
      source: BROWSER_STORAGE,
      ...(earlier ? { earlier } : {}),
    }
  },
}
