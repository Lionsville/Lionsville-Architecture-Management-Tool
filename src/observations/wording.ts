// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two hints the observation form gives while a title is typed (ADR-0032
 * §6), neither of which blocks anything.
 *
 * **Seen before?** A repeat is a sighting, not a new record, so the form lists
 * the observations whose titles share words with the one being typed. The
 * match is words, not meaning, and the same in every language: letters and
 * digits, folded to lower case without their accents, words of four letters or
 * more, each cut to its first five so *carrier* meets *carriers* and
 * *onboarding* meets *onboard*. Short words — the articles, *is*, *de*, *der*
 * — fall out by length, which is the one rule every language shares.
 *
 * **A wording hint.** A title that says *because*, *should* or *fault* is a
 * cause, a fix or blame, not what was seen. The words are a list per language
 * in the module's strings, handed in; matched as whole words or phrases.
 */

/** Shortest word that counts, and how much of it is compared. */
const MIN_WORD = 4
const STEM = 5

/** The words of a title as the match compares them: folded, long enough, cut to a stem, each once. */
export function titleWords(title: string): string[] {
  const folded = title.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
  const words = folded.match(/[\p{L}\p{N}]+/gu) ?? []
  return [...new Set(words.filter((word) => word.length >= MIN_WORD).map((word) => word.slice(0, STEM)))]
}

/**
 * Up to `limit` of `candidates` whose titles share words with `title`, the
 * most shared first and otherwise in the order given. A title of one word
 * needs that word; a longer one needs two, so a single common word does not
 * make everything look alike.
 */
export function similarTitles<T extends { title: string }>(title: string, candidates: readonly T[], limit = 3): T[] {
  const own = titleWords(title)
  if (own.length === 0) return []
  const needed = Math.min(2, own.length)
  return candidates
    .map((one, index) => {
      const theirs = new Set(titleWords(one.title))
      return { one, index, shared: own.filter((word) => theirs.has(word)).length }
    })
    .filter((held) => held.shared >= needed)
    .sort((a, b) => b.shared - a.shared || a.index - b.index)
    .slice(0, limit)
    .map((held) => held.one)
}

/** A word list as the strings hold it, `|` between the words: trimmed, and the empty ones left out. */
export function hintWords(list: string): string[] {
  return list.split('|').map((word) => word.trim()).filter(Boolean)
}

/**
 * The first word or phrase of `words` that `title` uses, as the title spells
 * it, or nothing. Whole words only: *fixture* is not *fix*. The boundary is
 * written without a look-behind, which not every browser the web build serves
 * reads.
 */
export function wordingHint(title: string, words: readonly string[]): string | undefined {
  let found: { at: number; text: string } | undefined
  for (const word of words) {
    const escaped = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    const match = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, 'iu').exec(title)
    if (!match) continue
    const at = match.index + match[1].length
    if (!found || at < found.at) found = { at, text: match[2] }
  }
  return found?.text
}
