// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Nowhere at all, which is the honest answer when this browser keeps nothing.
 * It never fails, so a session works in full and simply leaves nothing behind.
 */
import { InMemoryPreferencesStore } from '../../adapters/memory/InMemoryPreferencesStore'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import type { SourceProvider } from '../../platform/sourceProvider'
import type { WorkingSource } from '../../platform/workingSource'
import type { PreferencesStore } from '../../ports/PreferencesStore'
import type { ProviderParts } from '../../ports/ProviderParts'
import type { Repositories } from '../../ports/Repositories'

export type MemoryParts = ProviderParts & {
  repositories: Repositories
  preferences: PreferencesStore
}

/** Nothing kept here outlives this tab, and the bar says it in the warning colour. */
export const IN_MEMORY: WorkingSource = { provider: 'memory', name: '', key: '', transient: true }

export const MEMORY_SOURCE: SourceProvider<MemoryParts, unknown> = {
  kind: 'memory',
  labelKey: 'shell.sourceMemory',
  describeKey: 'shell.sourceTipMemory',
  whereKey: 'memory.where',
  // What removing takes is what the chip's neighbours always said of it.
  removeKey: 'picker.deleteBodyBrowser',
  open: () => ({
    repositories: memoryRepositories(),
    preferences: new InMemoryPreferencesStore(),
    source: IN_MEMORY,
    historyNoteKey: 'memory.historyNote',
  }),
}
