// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A finding's weight and its mark, on their own: a home's *Needs attention*
 * draws the marks at its first paint, and the list of findings
 * (`FindingsList`) arrives later with the pages and inspectors that hold it,
 * so the mark is not where the list is.
 */

/** How much a check matters, as the catalogue weighs it: what a mark is drawn for. */
export type FindingWeight = 'fix' | 'review' | 'note'

/** Each weight's mark — its glyph and its colour, measured in both themes — wherever a weight is drawn. */
export const WEIGHT_MARK: Record<FindingWeight, { glyph: string; sx: object }> = {
  fix: { glyph: '●', sx: { color: 'error.main' } },
  review: { glyph: '▲', sx: { color: 'warning.main' } },
  note: { glyph: 'i', sx: { color: 'text.secondary', fontStyle: 'italic', fontFamily: 'Georgia, serif', fontWeight: 700 } },
}
