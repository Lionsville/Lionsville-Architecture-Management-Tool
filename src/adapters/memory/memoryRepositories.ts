// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The five repositories in memory: for a session that deliberately leaves
 * nothing behind, and for a test that wants the real thing without a browser.
 *
 * The same repositories this browser's storage keeps (`adapters/repositories/`)
 * over a store that keeps its values in memory (`MemoryStore`): identities kept
 * through moves, an apply to several scopes whole or not at all, a history
 * with the state at every entry, labels, bytes by content address. Nothing
 * here is cut short for being in memory; what is lost is only what memory
 * loses, when the page goes.
 */
import type { Repositories } from '../../ports/Repositories'
import { repositoriesOver } from '../repositories/repositoriesOver'
import { MemoryStore } from './MemoryStore'

export const MEMORY_REPOSITORIES = 'memory'

export function memoryRepositories(store: MemoryStore = new MemoryStore(), by = 'this session'): Repositories {
  return repositoriesOver(store, { id: MEMORY_REPOSITORIES, by })
}
