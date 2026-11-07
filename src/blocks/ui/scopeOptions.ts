// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { Translate } from '../../i18n'
import type { ScopeChoice } from '../../widgets/ScopeChoices'

/** A short closed list of scopes for a select: the topics first, as a block is usually kept in one, each indented by its depth. */
export function scopeOptions(choices: readonly ScopeChoice[], t: Translate) {
  return choices.map((one) => ({
    value: one.path,
    label: `${'  '.repeat(one.depth)}${one.name}${one.topic ? ` (${t('blocks.placeTopic')})` : ''}`,
  }))
}
