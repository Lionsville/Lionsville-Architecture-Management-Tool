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
