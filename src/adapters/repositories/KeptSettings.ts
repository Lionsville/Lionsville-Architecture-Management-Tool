// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `SettingsRepository` over a keyed store (ADR-0031 §1): three sets, each
 * under a key of its own, a scope's under its identity so it follows the
 * scope through a move and goes when the scope is removed. A write is a
 * patch, read and written back in one transaction, so two writes from two
 * pages never undo each other.
 */
import { patchSettings } from '../../projects/settings'
import type { Settings, SettingsPatch } from '../../projects/settings'
import type { SettingsOf, SettingsRepository } from '../../ports/SettingsRepository'
import { keyOf } from './KeyedStore'
import type { Source } from './source'

function settingsKey(of: SettingsOf): string {
  return of.of === 'scope' ? keyOf('scope', of.scope) : of.of
}

export class KeptSettings implements SettingsRepository {
  readonly id: string

  constructor(private readonly source: Source) {
    this.id = source.id
  }

  read(of: SettingsOf): Promise<Settings> {
    return this.source.read(async (tx) => (await tx.get<Settings>('settings', settingsKey(of))) ?? {})
  }

  write(of: SettingsOf, patch: SettingsPatch): Promise<Settings> {
    return this.source.write(async (tx) => {
      const next = patchSettings((await tx.get<Settings>('settings', settingsKey(of))) ?? {}, patch)
      tx.put('settings', settingsKey(of), next)
      return next
    })
  }
}
