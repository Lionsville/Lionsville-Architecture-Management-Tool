/**
 * Words a build composed from this one brought with it.
 *
 * Its own file rather than a block in `strings.test.ts`, because that suite
 * reads the tables this repository ships and this one deliberately adds to
 * them: two suites over one registry in one file would be a test that passes
 * or fails depending on which ran first.
 */
import { describe, expect, it } from 'vitest';
import { EN, registerStrings, t, translator } from './strings';

describe('registerStrings', () => {
  it('answers a key the app itself has never heard of', () => {
    registerStrings('en', { 'elsewhere.connect': 'Connect to elsewhere…' });
    registerStrings('nl', { 'elsewhere.connect': 'Verbinden met elders…' });

    expect(t('en', 'elsewhere.connect' as never)).toBe('Connect to elsewhere…');
    expect(t('nl', 'elsewhere.connect' as never)).toBe('Verbinden met elders…');
    // Through a bound translator too, which is what every screen holds.
    expect(translator('nl')('elsewhere.connect' as never)).toBe('Verbinden met elders…');
  });

  /**
   * The same fallback the app's own words get: a language nobody translated
   * into reads English rather than reading the key.
   */
  it('falls back to English for a language the registration left out', () => {
    registerStrings('en', { 'elsewhere.only': 'Only in English' });
    expect(t('fy', 'elsewhere.only' as never)).toBe('Only in English');
  });

  it('interpolates a registered string like any other', () => {
    registerStrings('en', { 'elsewhere.named': 'Working in {name}' });
    expect(t('en', 'elsewhere.named' as never, { name: 'Acme' })).toBe('Working in Acme');
  });

  it('still answers an unknown key with itself', () => {
    expect(t('en', 'elsewhere.nobody' as never)).toBe('elsewhere.nobody');
  });

  /**
   * The refusal is the point. A registration that could take `common.save`
   * would be a way to change what a person reads in a dialog before pressing
   * the button, from outside the tree that is tested.
   */
  it('throws on a key the app owns while the build is being developed', () => {
    expect(() => registerStrings('en', { 'common.save': 'Send to elsewhere' }, true))
      .toThrow(/common\.save/);
    expect(t('en', 'common.save')).toBe(EN['common.save']);
  });

  it('ignores it in the build that ships, and keeps the rest of the table', () => {
    const refused = registerStrings(
      'en',
      { 'common.save': 'Send to elsewhere', 'elsewhere.kept': 'Kept' },
      false,
    );

    expect(refused).toEqual(['common.save']);
    expect(t('en', 'common.save')).toBe(EN['common.save']);
    expect(t('en', 'elsewhere.kept' as never)).toBe('Kept');
  });

  /** Nothing registered reaches the schema: `EN` is what every module composed. */
  it('leaves the app\'s own table exactly as it was', () => {
    registerStrings('en', { 'elsewhere.untouched': 'Untouched' });
    expect('elsewhere.untouched' in EN).toBe(false);
  });
});
