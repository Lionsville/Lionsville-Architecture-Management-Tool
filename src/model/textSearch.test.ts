import { describe, expect, it } from 'vitest';
import { fold, matchesQuery, queryTokens } from './textSearch';

/**
 * The one definition of "found", shared by the icon grid, the palette filter and
 * ⌘F. Its two rules are the ones a user notices: accents and case never matter,
 * and a second word narrows rather than widens.
 */
describe('fold', () => {
  it('lowercases and strips accents', () => {
    expect(fold('Réisinformatie')).toBe('reisinformatie');
    expect(fold('ÄÖÜ')).toBe('aou');
  });

  it('leaves everything else alone', () => {
    expect(fold('Kafka 2.0 · REST')).toBe('kafka 2.0 · rest');
  });
});

describe('queryTokens', () => {
  it('splits on whitespace and drops the gaps', () => {
    expect(queryTokens('  rail   camera ')).toEqual(['rail', 'camera']);
  });

  it('is empty for a blank query', () => {
    expect(queryTokens('')).toEqual([]);
    expect(queryTokens('   ')).toEqual([]);
  });
});

describe('matchesQuery', () => {
  it('matches everything for a blank query', () => {
    expect(matchesQuery('', ['anything'])).toBe(true);
    expect(matchesQuery('  ', [])).toBe(true);
  });

  it('requires EVERY token to occur — a second word narrows', () => {
    expect(matchesQuery('rail camera', ['rail platform camera'])).toBe(true);
    expect(matchesQuery('rail camera', ['rail platform'])).toBe(false);
  });

  it('matches substrings, not only prefixes', () => {
    // Names here are phrases; a prefix rule would make the second word
    // unsearchable.
    expect(matchesQuery('backend', ['Reisinformatie backend'])).toBe(true);
  });

  it('searches across all the terms it is given', () => {
    expect(matchesQuery('adyen betaal', ['Betaalplatform', undefined, 'Adyen'])).toBe(true);
  });

  it('ignores absent terms', () => {
    expect(matchesQuery('x', [undefined, undefined])).toBe(false);
  });

  it('folds both sides', () => {
    expect(matchesQuery('RÉIS', ['reisinformatie'])).toBe(true);
    expect(matchesQuery('reis', ['Réisinformatie'])).toBe(true);
  });
});
