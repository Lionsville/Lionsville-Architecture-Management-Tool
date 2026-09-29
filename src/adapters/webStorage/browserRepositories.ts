// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The five repositories in this browser's storage (ADR-0031 §2): the
 * repositories every keyed store shares (`adapters/repositories/`), over this
 * browser's database (`IndexedDbStore`).
 */
import type { Repositories } from '../../ports/Repositories'
import { repositoriesOver } from '../repositories/repositoriesOver'
import { IndexedDbStore } from './IndexedDbStore'
import type { IndexedDb } from './IndexedDbStore'

export const BROWSER_REPOSITORIES = 'browser storage'

export function browserRepositories(indexedDb: IndexedDb, name?: string): Repositories {
  return repositoriesOver(new IndexedDbStore(indexedDb, name), { id: BROWSER_REPOSITORIES, by: 'this browser' })
}
