// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The arrows of a row of choices: tabs and a segmented switch move the same way,
 * wrapping at the ends, with Home and End for the ends themselves. `undefined`
 * for a key that is not theirs, so the key goes on to whoever else wants it.
 */
export function rovedIndex(key: string, index: number, count: number): number | undefined {
  if (count === 0) return undefined
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return undefined
}
