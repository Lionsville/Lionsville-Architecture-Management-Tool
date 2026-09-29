// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The settings one source keeps (ADR-0031 §1): the organisation's, each
 * scope's, and the person's own on this install.
 *
 * Three sets, kept apart. The organisation's hold for everybody who works in
 * it; a scope's for everybody who works in that scope, and follow its identity
 * through a move; the person's are this person's, about this source, on this
 * install — what they do about the work here, which another person does not
 * share and another install does not carry.
 *
 * What is in a set is its readers' business (`projects/settings.ts`): reading
 * never fails for want of one — a set nobody wrote is empty — and a write is a
 * patch, so a key a newer build wrote survives an older build changing one of
 * its own.
 *
 * `SettingsRepository.contract.ts`, beside this seam, is the behaviour every
 * implementation must show.
 */
import type { ScopeId } from '../projects/scopeState'
import type { Settings, SettingsPatch } from '../projects/settings'

/** Whose settings. */
export type SettingsOf =
  | { of: 'organisation' }
  | { of: 'scope'; scope: ScopeId }
  | { of: 'person' }

export interface SettingsRepository {
  readonly id: string

  /** A set of settings, empty where nobody wrote one. */
  read(of: SettingsOf): Promise<Settings>

  /** Change some of a set, and answer the set as it now is. */
  write(of: SettingsOf, patch: SettingsPatch): Promise<Settings>
}
