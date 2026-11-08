// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A step said in words, the one way: the Activity list's line, and a refused
 * change's row in *Your work*, which name the same change and must not name it
 * twice over in two ways.
 */
import type { Translate } from '../i18n'
import type { StepSummary } from '../model'

export function stepWords(summary: StepSummary, s: Translate): string {
  return s(summary.key, {
    name: summary.name ?? '—',
    count: summary.count ?? 1,
    asOf: summary.asOf ?? '',
    // What kind of row it was, in today's language rather than the one it was drawn in (ADR-0012 §5).
    type: summary.typeKey ? s(summary.typeKey) : '',
    // Where a move took the scope from, and to.
    from: summary.from ?? '',
    to: summary.to ?? '',
  })
}
