import { describe, expect, it } from 'vitest';
import { categoryColor, categoryHue, hashCategory } from './categoryColors';

describe('categoryColors', () => {
  it('is deterministic: the same category always maps to the same colour', () => {
    expect(categoryColor('E-commerce', 'light')).toBe(categoryColor('E-commerce', 'light'));
    expect(categoryColor('E-commerce', 'dark')).toBe(categoryColor('E-commerce', 'dark'));
  });

  it('pins known hash values so the palette stays stable across releases', () => {
    // If these change, every existing board re-colours — bump deliberately.
    expect(hashCategory('e-commerce')).toBe(2081687972);
    expect(categoryHue('E-commerce')).toBe(categoryHue('  e-commerce  '));
    expect(categoryColor('E-commerce', 'light')).toBe('hsl(96, 60%, 44%)');
    expect(categoryColor('E-commerce', 'dark')).toBe('hsl(96, 52%, 46%)');
  });

  it('normalises case and whitespace before hashing', () => {
    expect(categoryColor('ERP', 'light')).toBe(categoryColor('  erp ', 'light'));
  });

  it('spreads common categories over distinct hues', () => {
    const categories = ['ERP', 'CRM', 'E-commerce', 'Data', 'Integration', 'Identity'];
    const hues = new Set(categories.map(categoryHue));
    expect(hues.size).toBeGreaterThanOrEqual(4);
  });

  it('keeps lightness in a readable band for both modes', () => {
    for (const category of ['ERP', 'CRM', 'Data platform', 'PIM']) {
      for (const mode of ['light', 'dark'] as const) {
        const match = /hsl\(\d+, (\d+)%, (\d+)%\)/.exec(categoryColor(category, mode));
        expect(match).not.toBeNull();
        const lightness = Number(match?.[2]);
        expect(lightness).toBeGreaterThanOrEqual(40);
        expect(lightness).toBeLessThanOrEqual(55);
      }
    }
  });

  it('falls back to a neutral grey for missing categories', () => {
    expect(categoryColor(undefined, 'light')).toContain('12%');
    expect(categoryColor('  ', 'dark')).toContain('10%');
  });
});
