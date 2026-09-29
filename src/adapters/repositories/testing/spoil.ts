// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope kept on a keyed store made one this build cannot read whole, for
 * the suites (`RepositoriesUnderTest.spoil`): its content marked as a later
 * version's — what a store shared with a newer build holds — or torn, the
 * layout this build writes with a model that is not one.
 */
import type { Spoiled } from '../../../ports/Repositories.contract'
import type { ScopeId } from '../../../projects/scopeState'
import { SHELVES } from '../KeyedStore'
import type { KeyedStore } from '../KeyedStore'
import type { KeptContent } from '../kept'

export function spoilKept(store: KeyedStore, scope: ScopeId, how: Spoiled): Promise<void> {
  return store.transaction(SHELVES, 'write', async (tx) => {
    const held = await tx.get<KeptContent>('contents', scope)
    tx.put('contents', scope, how === 'later' ? { ...held, format: 2 } : { ...held, model: 'torn' })
  })
}
