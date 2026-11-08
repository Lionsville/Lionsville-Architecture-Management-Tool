// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * ONE definition of "found" for every free-text filter in the editor.
 *
 * The icon grid had it first (`searchLogos`); the palette filter and the ⌘F
 * element finder want exactly the same rule, and three copies of "lowercase,
 * strip accents, every token must occur" is three places for them to drift.
 *
 * The rule, deliberately: fold case AND diacritics (so "Réisinfo" finds
 * "reisinformatie", and a Dutch board is searchable from an English keyboard),
 * and require EVERY whitespace-separated token to occur somewhere in the
 * haystack — so a second word narrows the result rather than widening it. A
 * blank query matches everything, which is what makes "no query" and "empty
 * field" the same state for every caller.
 *
 * Substring rather than prefix matching: element names here are phrases
 * ("Reisinformatie backend"), and a prefix rule would make the second word
 * unsearchable.
 */

/** Fold case and strip accents. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** The query's whitespace-separated tokens, folded; empty for a blank query. */
export function queryTokens(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

/** True when every token of `query` occurs in one of `terms`. */
export function matchesQuery(query: string, terms: readonly (string | undefined)[]): boolean {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return true;
  const haystack = fold(terms.filter(Boolean).join(' '));
  return tokens.every((token) => haystack.includes(token));
}

/** The endings a Dutch or German word takes, longest first, that a stem leaves off. */
const ENDINGS: Readonly<Record<'nl' | 'de', readonly string[]>> = {
  nl: ['ingen', 'ing', 'en', 'e', 't', 's'],
  de: ['ungen', 'ere', 'ung', 'ern', 'en', 'er', 'es', 'e', 'n', 's'],
}

/**
 * A word's stem, kept simple: folded, one ending off, and in Dutch a long
 * vowel or a doubled consonant said once — so *bewaar* and *Bewaren* both
 * stem to *bewar*, and *öffne* and *Öffnen* to *offn*. Not a linguist's stem:
 * enough that a command is found by the form of its word a person types.
 */
export function stemOf(word: string, language: 'nl' | 'de'): string {
  let stem = fold(word)
  const ending = ENDINGS[language].find((one) => stem.length - one.length >= 3 && stem.endsWith(one))
  if (ending) stem = stem.slice(0, -ending.length)
  return language === 'nl' ? stem.replace(/([aeou])\1/g, '$1').replace(/([^aeiou])\1$/, '$1') : stem
}

/**
 * Every token of `query` found by its stem among the words of `terms`: the
 * same rule as {@link matchesQuery}, a word at a time, for a language whose
 * words change their ending — Dutch and German. English has no need of it.
 */
export function matchesStems(query: string, terms: readonly (string | undefined)[], language: 'nl' | 'de'): boolean {
  const tokens = queryTokens(query)
  if (tokens.length === 0) return true
  const words = terms.filter(Boolean).flatMap((term) => queryTokens(term!)).map((word) => stemOf(word, language))
  return tokens.every((token) => {
    const stem = stemOf(token, language)
    return words.some((word) => word.includes(stem))
  })
}
