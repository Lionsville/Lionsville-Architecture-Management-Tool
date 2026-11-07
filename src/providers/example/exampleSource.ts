// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The example as a place you visit: the shipped organisation in memory, where
 * anything can be tried, nothing is kept and a person's own work stays untouched.
 * The same repositories as a tab with no storage, opened on a copy; what leaves is
 * only what *Keep this as my start* writes to the source it was entered from.
 */
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import { InMemoryPreferencesStore } from '../../adapters/memory/InMemoryPreferencesStore'
import type { Translate } from '../../i18n'
import { exampleOf } from '../../projects/examples/catalogue'
import type { ExampleOffer } from '../../projects/examples/catalogue'
import { exampleCopyOver, placeCopy } from '../../projects/examples/copy'
import type { SourceProvider } from '../../platform/sourceProvider'
import type { PreferencesStore } from '../../ports/PreferencesStore'
import type { ProviderParts } from '../../ports/ProviderParts'
import type { Repositories } from '../../ports/Repositories'

type ExampleParts = ProviderParts & { repositories: Repositories; preferences: PreferencesStore }

export const EXAMPLE_SOURCE: SourceProvider<ExampleParts, { readonly offer: ExampleOffer }, { readonly s?: Translate; readonly shell?: { readonly preferences?: PreferencesStore } }> = {
  kind: 'example',
  labelKey: 'example.label',
  describeKey: 'example.where',
  whereKey: 'example.where',
  riskKey: 'example.risk',
  removeKey: 'example.remove',
  open: async ({ offer }, { s, shell }) => {
    const repositories = memoryRepositories(undefined, s?.('memory.historyAuthor'))
    const example = await exampleOf(offer)
    await placeCopy(repositories, await exampleCopyOver(repositories.scopes, example))
    return {
      repositories,
      // The person's language and theme go on applying where they visit.
      preferences: shell?.preferences ?? new InMemoryPreferencesStore(),
      source: { provider: 'example', name: example.label, key: example.key, transient: true },
      historyNoteKey: 'memory.historyNote',
    }
  },
}
