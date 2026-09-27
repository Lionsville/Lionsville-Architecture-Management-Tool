// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A store whose tree is already being read.
 *
 * The index is read the moment the app mounts (`useIndex`), and the app mounts
 * after the boot has read the scope it reopens. Over a network those were two
 * requests in a row where nothing about the second waits on the first: the
 * tree's models do not depend on which scope is open. So the boot starts the
 * one while it asks for the other, and the first `models()` anybody makes is
 * answered by the read already in flight.
 *
 * **Only the first, and only while nothing was written.** A read that started
 * before a save is a read of the tree before it, and handing it to somebody
 * who asks after the save would be an index a write behind. Anything written
 * through this store spends it, and every call after the first is the store's
 * own, as it always was.
 */
import type { ScopeStore } from '../ports/ScopeStore'
import { filledStore } from './filledStore'
import type { ScopeModel } from './scope'

export function modelsAhead(store: ScopeStore): ScopeStore {
  if (!store.models) return store
  let ahead: Promise<ScopeModel[]> | undefined = store.models()
  // Answered to whoever asks first, rejection included; never a rejection
  // nobody handled because nobody asked.
  ahead.catch(() => undefined)
  const spent = (): void => { ahead = undefined }
  return filledStore(store, (built) => ({
    models: () => {
      const held = ahead
      spent()
      return held ?? (built.models as () => Promise<ScopeModel[]>)()
    },
    save: (scope, expects) => { spent(); return built.save(scope, expects) },
    remove: (path, expects) => { spent(); return built.remove(path, expects) },
    ...(built.saveTogether
      ? { saveTogether: (entries, held) => { spent(); return built.saveTogether!(entries, held) } }
      : {}),
  }))
}
