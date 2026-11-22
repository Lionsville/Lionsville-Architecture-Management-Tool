// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Capabilities pasted as a list, one per line (ADR-0043, amended 22 November
 * 2026): what a person has in a document or a spreadsheet already, added as one
 * step rather than a dialog each. A `!` at the start or the end of a line marks
 * a must; a bullet or a number a list was written with is not part of the words.
 * A line said twice, or one the block already has, is added once.
 */

export type ListedCapability = { readonly text: string; readonly must: boolean }

/** A list's own marks before the words: `-`, `*`, `•`, `1.`, `2)`. */
const BULLET = /^(?:[-*•‣◦]|\d+[.)])(?:\s+|$)/

export function capabilitiesFrom(text: string, already: readonly string[] = []): ListedCapability[] {
  const seen = new Set(already.map((one) => one.trim().toLowerCase()))
  const out: ListedCapability[] = []
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim().replace(BULLET, '').trim()
    let must = false
    if (line.startsWith('!')) { must = true; line = line.slice(1).trim() }
    if (line.endsWith('!')) { must = true; line = line.slice(0, -1).trim() }
    const key = line.toLowerCase()
    if (line === '' || seen.has(key)) continue
    seen.add(key)
    out.push({ text: line, must })
  }
  return out
}
