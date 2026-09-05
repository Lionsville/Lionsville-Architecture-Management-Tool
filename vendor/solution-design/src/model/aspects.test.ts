import { describe, expect, it } from 'vitest';
import {
  ASPECT_SUPERSET,
  aspectConfigFor,
  aspectShortCode,
  DEFAULT_ASPECT_CONFIG,
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
  it('falls back to the default five when the diagram has no config', () => {
    expect(aspectConfigFor(diagram('d1'))).toEqual(DEFAULT_ASPECT_CONFIG);
    expect(aspectConfigFor(diagram('d1', { aspectConfig: [] }))).toEqual(DEFAULT_ASPECT_CONFIG);
    expect(aspectConfigFor(undefined)).toEqual(DEFAULT_ASPECT_CONFIG);
  });

  it('uses the configured order and entries when present', () => {
    const config = [
      { key: 'cost', label: 'Cost' },
      { key: 'custom-sla', label: 'SLA' },
    ];
    expect(aspectConfigFor(diagram('d1', { aspectConfig: config }))).toEqual(config);
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
