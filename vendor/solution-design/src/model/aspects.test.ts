import { describe, expect, it } from 'vitest';
import {
  ASPECT_SUPERSET,
  aspectConfigFor,
  aspectKeyForLabel,
  aspectShortCode,
  DEFAULT_ASPECT_CONFIG,
  derivedShortCode,
  normaliseAspectConfig,
} from './aspects';
import { diagram } from './testFixtures';

describe('ASPECT_SUPERSET', () => {
  it('pins the eight superset keys in canonical order', () => {
    expect(ASPECT_SUPERSET.map((a) => a.key)).toEqual([
      'platform',
      'cicd',
      'dr',
      'security',
      'monitoring',
      'backup',
      'compliance',
      'cost',
    ]);
  });

  it('default config is the original five', () => {
    expect(DEFAULT_ASPECT_CONFIG.map((a) => a.key)).toEqual([
      'platform',
      'cicd',
      'dr',
      'security',
      'monitoring',
    ]);
  });
});

describe('aspectConfigFor (rendering fallback)', () => {
  it('falls back to the default five when nobody has configured the diagram', () => {
    expect(aspectConfigFor(diagram('d1'))).toEqual(DEFAULT_ASPECT_CONFIG);
    expect(aspectConfigFor(undefined)).toEqual(DEFAULT_ASPECT_CONFIG);
  });

  it('uses the configured order and entries when present', () => {
    const config = [
      { key: 'cost', label: 'Cost' },
      { key: 'custom-sla', label: 'SLA' },
    ];
    expect(aspectConfigFor(diagram('d1', { aspectConfig: config }))).toEqual(config);
  });

  // Changed deliberately: an empty config used to mean the same as no config,
  // which left "this landscape tracks none of these" impossible to say.
  it('treats an empty config as no columns, not as the default five', () => {
    expect(aspectConfigFor(diagram('d1', { aspectConfig: [] }))).toEqual([]);
  });

  it('shows nothing when the diagram hides aspects, config or not', () => {
    expect(aspectConfigFor(diagram('d1', { showAspects: false }))).toEqual([]);
    const config = [{ key: 'cost', label: 'Cost' }];
    expect(aspectConfigFor(diagram('d1', { showAspects: false, aspectConfig: config }))).toEqual([]);
  });

  it('keeps the configuration through a hide, so unhiding restores it', () => {
    const config = [{ key: 'cost', label: 'Cost' }];
    const hidden = diagram('d1', { showAspects: false, aspectConfig: config });
    expect(aspectConfigFor({ ...hidden, showAspects: true })).toEqual(config);
  });
});

describe('aspectShortCode', () => {
  it('uses curated codes for superset keys', () => {
    expect(aspectShortCode({ key: 'platform', label: 'Platform' })).toBe('PLT');
    expect(aspectShortCode({ key: 'cicd', label: 'CI/CD' })).toBe('CI/CD');
    expect(aspectShortCode({ key: 'backup', label: 'Backup' })).toBe('BKP');
    expect(aspectShortCode({ key: 'cost', label: 'Cost' })).toBe('€');
  });

  it('derives codes for custom keys from the label', () => {
    expect(aspectShortCode({ key: 'custom-sla', label: 'SLA' })).toBe('SLA');
    expect(aspectShortCode({ key: 'custom-observability', label: 'Observability' })).toBe('OBS');
  });
});

describe('aspectShortCode overrides', () => {
  it('prefers an explicit code over the curated one', () => {
    expect(aspectShortCode({ key: 'dr', label: 'Continuity', code: 'CONT' })).toBe('CONT');
  });

  it('ignores a blank code', () => {
    expect(aspectShortCode({ key: 'dr', label: 'Disaster recovery', code: '  ' })).toBe('DR');
  });

  it('derivedShortCode matches what an unset code produces', () => {
    expect(derivedShortCode('Observability')).toBe('OBS');
    expect(aspectShortCode({ key: 'custom-x', label: 'Observability' })).toBe('OBS');
  });
});

describe('aspectKeyForLabel', () => {
  it('prefixes custom so it can never collide with a superset key', () => {
    expect(aspectKeyForLabel('Service levels', [])).toBe('custom-service-levels');
  });

  it('strips diacritics and punctuation', () => {
    expect(aspectKeyForLabel('Beheerbaarheid & sturing', [])).toBe('custom-beheerbaarheid-sturing');
    expect(aspectKeyForLabel('Privacyw\u00e9t', [])).toBe('custom-privacywet');
  });

  it('suffixes rather than reusing a key already taken', () => {
    expect(aspectKeyForLabel('SLA', ['custom-sla'])).toBe('custom-sla-2');
    expect(aspectKeyForLabel('SLA', ['custom-sla', 'custom-sla-2'])).toBe('custom-sla-3');
  });

  it('still yields a key when the label has nothing sluggable in it', () => {
    expect(aspectKeyForLabel('!!!', [])).toBe('custom-aspect');
  });
});

describe('normaliseAspectConfig', () => {
  it('drops unlabelled rows and trims the rest', () => {
    expect(normaliseAspectConfig([
      { key: 'dr', label: '  Continuity  ' },
      { key: 'custom-blank', label: '   ' },
    ])).toEqual([{ key: 'dr', label: 'Continuity' }]);
  });

  it('keeps the first of a duplicated key', () => {
    expect(normaliseAspectConfig([
      { key: 'dr', label: 'First' },
      { key: 'dr', label: 'Second' },
    ])).toEqual([{ key: 'dr', label: 'First' }]);
  });

  it('drops a blank code and clips a long one', () => {
    expect(normaliseAspectConfig([{ key: 'dr', label: 'Continuity', code: '  ' }]))
      .toEqual([{ key: 'dr', label: 'Continuity' }]);
    expect(normaliseAspectConfig([{ key: 'dr', label: 'Continuity', code: 'CONTINUITY' }]))
      .toEqual([{ key: 'dr', label: 'Continuity', code: 'CONTI' }]);
  });
});
