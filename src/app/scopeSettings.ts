// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a scope's settings may change, as the page that edits them and the
 * hook that writes them say it to each other.
 */
import type { AspectConfigEntry } from '../model/types'
import type { RecordLink } from '../projects/links'
import type { ScopeKind } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'
import type { SettingsField } from '../projects/scopeTree'
import type { TypeChoice } from '../projects/scopeType'

/** What the settings dialogs may change about a scope, whatever level it is. */
export type ScopeSettingsPatch = {
  name: string
  client?: string
  description?: string
  links?: RecordLink[]
  /** The built-in kind, where the caller speaks that vocabulary alone; `type` says both and wins where given. */
  kind?: ScopeKind
  /**
   * What the scope is, as the one picker holds it (ADR-0036, amended 17
   * October 2026): a unit type of the operating model, a built-in kind, or
   * nothing — and whichever of the two is not said is cleared.
   */
  type?: TypeChoice
  /**
   * Where it is filed, when that is what changed.
   *
   * Absent means "leave the address alone", which is what a rename does and
   * what every field above does. Present and different is a move: the scope
   * and everything under it go to their new addresses together, identities and
   * all (`ScopeRepository.move`).
   */
  parent?: ScopePath
  /** Who an exported picture names where it has none of its own. */
  defaultAuthor?: string
  /** The aspects a new landscape starts with. */
  defaultAspectConfig?: AspectConfigEntry[]
  /**
   * The fields this change is about, where the page says: only those are
   * written, so a change made again after another landed (`writeRefusals`)
   * does not put the other back. Absent writes every field, as the agent does.
   */
  changed?: readonly SettingsField[]
}
