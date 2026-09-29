// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The five repository suites, run against the repositories in memory — and
 * so against the arithmetic this browser's storage shares with them.
 */
import { describeHistoryRepository } from '../../ports/HistoryRepository.contract'
import { describeImageRepository } from '../../ports/ImageRepository.contract'
import { describeOrganisationIndex } from '../../ports/OrganisationIndex.contract'
import type { RepositoriesUnderTest } from '../../ports/Repositories.contract'
import { describeScopeRepository } from '../../ports/ScopeRepository.contract'
import { describeSettingsRepository } from '../../ports/SettingsRepository.contract'
import { spoilKept } from '../repositories/testing/spoil'
import { memoryRepositories } from './memoryRepositories'
import { MemoryStore } from './MemoryStore'

/**
 * Repositories in memory, and a scope made one this build cannot read whole:
 * its content torn, or marked as a later version's, which is what a store
 * shared with a newer build can hold.
 */
function make(): RepositoriesUnderTest {
  const store = new MemoryStore()
  return {
    repositories: memoryRepositories(store),
    spoil: (scope, how) => spoilKept(store, scope, how),
  }
}

describeScopeRepository('memory', make)
describeOrganisationIndex('memory', make)
describeHistoryRepository('memory', make)
describeImageRepository('memory', make)
describeSettingsRepository('memory', make)
