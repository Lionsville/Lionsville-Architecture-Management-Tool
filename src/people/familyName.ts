// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A name's family part, as a list sorted by it reads it. A register keeps one
 * name, written as the person writes it, so the family part is what follows
 * the first word; and a list sorted by family name files *Noa van Farrow*
 * under F, as a Dutch or German directory does, so the words in lower case that
 * open it — *van*, *de*, *von der* — are passed over for the order. A name of
 * one word is its own family name.
 */
export function familyName(name: string): { said: string; key: string } {
  const words = name.trim().split(/\s+/)
  if (words.length < 2) return { said: name.trim(), key: name.trim() }
  const family = words.slice(1)
  const from = family.findIndex((word) => word.charAt(0) !== word.charAt(0).toLowerCase())
  return { said: family.join(' '), key: family.slice(from < 0 ? 0 : from).join(' ') }
}
