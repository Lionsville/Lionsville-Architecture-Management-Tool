// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The preferences store the app is handed, telling the boot every blob the app
 * writes. A change of source mounts the app afresh from what the boot holds —
 * the example visited, left or kept, a way in pressed — and a copy left at what
 * the boot first read put a language chosen since back to the old one, on the
 * screen and in the menu bar, while the store said the new one.
 */
import type { PreferencesStore } from '../ports/PreferencesStore'

export function preferencesHere(onWrite: (preferences: Record<string, unknown>) => void): (store: PreferencesStore) => PreferencesStore {
  // One wrapper per store, so the app is handed the same object on every render and its writer does not change.
  const wrapped = new WeakMap<PreferencesStore, PreferencesStore>()
  return (store) => {
    let kept = wrapped.get(store)
    if (!kept) {
      kept = {
        id: store.id,
        read: () => store.read(),
        // Told before the write is waited for: the person chose it, whether or not this store keeps it.
        write: (preferences) => { onWrite(preferences); return store.write(preferences) },
      }
      wrapped.set(store, kept)
    }
    return kept
  }
}
