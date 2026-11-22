// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a comparison is in the address (ADR-0033, amended 22 November 2026): a
 * building block's page on its *Comparisons* tab, looking at one scope's — the
 * page's look, `at=<scope path>`, as the operating model's says `unit=<id>`:
 *
 *     #/-/blocks/blk-gateway?tab=used&look=at%3Dacme%252Frail
 *
 * The organisation's own comparison is `at=` with nothing after it, so a look
 * that names no scope at all is still told from one that names the root.
 */

const KEY = 'at'

/** The look that opens a scope's comparison. */
export function comparisonLook(scope: string): string {
  return new URLSearchParams([[KEY, scope]]).toString()
}

/** The scope whose comparison a look opens, or none: a look that is not one, or no look. */
export function comparisonIn(look: string | undefined): string | undefined {
  if (look === undefined) return undefined
  const said = new URLSearchParams(look)
  return said.has(KEY) ? said.get(KEY) ?? undefined : undefined
}
