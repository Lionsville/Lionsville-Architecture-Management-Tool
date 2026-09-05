import { describe, expect, it } from 'vitest';
import { formatMonthlyPrice, formatScopeDelta } from './format';

/**
 * These used to print Dutch number grouping under an English "/mo" on every
 * screen, because the locale was hard-coded. The rule now: the number's shape
 * and the suffix both follow the language, the currency never does.
 */
describe('formatMonthlyPrice', () => {
  it('defaults to English', () => {
    expect(formatMonthlyPrice(1500)).toBe(formatMonthlyPrice(1500, 'en'));
    expect(formatMonthlyPrice(1500)).toMatch(/\/mo$/);
  });

  it('uses the Dutch suffix and grouping in Dutch', () => {
    const dutch = formatMonthlyPrice(1500, 'nl');
    expect(dutch).toMatch(/\/mnd$/);
    expect(dutch).toContain('1.500');
  });

  it('uses English grouping in English', () => {
    expect(formatMonthlyPrice(1500, 'en')).toContain('1,500');
  });

  it('stays in euros in both languages', () => {
    expect(formatMonthlyPrice(10, 'nl')).toContain('€');
    expect(formatMonthlyPrice(10, 'en')).toContain('€');
  });

  it('rounds to whole euros', () => {
    expect(formatMonthlyPrice(1500.7, 'en')).toContain('1,501');
  });
});

describe('formatScopeDelta', () => {
  it('carries the sign from the amount and appends the percentage', () => {
    expect(formatScopeDelta(150, 12, 'en')).toBe('Δ €150/mo (+12%)');
    expect(formatScopeDelta(-150, -12, 'en')).toMatch(/^Δ -€150\/mo \(-12%\)$/);
  });

  it('omits the percentage when there is none', () => {
    expect(formatScopeDelta(150, undefined, 'en')).toBe('Δ €150/mo');
  });

  it('follows the language', () => {
    // `Intl` puts a NON-BREAKING space after the euro sign in nl-NL, so the
    // assertion matches rather than compares — pinning the exact byte would be
    // pinning the ICU data.
    expect(formatScopeDelta(150, 12, 'nl')).toMatch(/^Δ €\s150\/mnd \(\+12%\)$/);
  });
});
