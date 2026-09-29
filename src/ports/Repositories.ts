// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One source's repositories, as one value (ADR-0031 §4).
 *
 * What the composition root builds for each source and hands to the app, and
 * the only way the app reaches where work is kept. Five seams, one per kind of
 * question, all over the same scopes: a step applied through `scopes` is what
 * the index follows, what the history records, and what adds a picture to a
 * library.
 */
import type { HistoryRepository } from './HistoryRepository'
import type { ImageRepository } from './ImageRepository'
import type { OrganisationIndex } from './OrganisationIndex'
import type { ScopeRepository } from './ScopeRepository'
import type { SettingsRepository } from './SettingsRepository'

export type Repositories = {
  scopes: ScopeRepository
  index: OrganisationIndex
  history: HistoryRepository
  images: ImageRepository
  settings: SettingsRepository
}
