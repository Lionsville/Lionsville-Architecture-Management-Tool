// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** Preferences in memory; see {@link InMemoryProjectStore} for why it copies. */
import type { PreferencesStore } from '../../ports/PreferencesStore'

export class InMemoryPreferencesStore implements PreferencesStore {
  readonly id = 'memory'
  private held: Record<string, unknown> | undefined

  constructor(initial?: Record<string, unknown>) {
    if (initial) this.held = structuredClone(initial)
  }

  read(): Promise<unknown> {
    return Promise.resolve(this.held ? structuredClone(this.held) : undefined)
  }

  write(preferences: Record<string, unknown>): Promise<void> {
    this.held = structuredClone(preferences)
    return Promise.resolve()
  }
}
