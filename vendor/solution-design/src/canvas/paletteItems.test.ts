import { describe, expect, it } from 'vitest';
import {
  CONTAINER_PALETTE,
  LAYER7_PALETTE,
  PALETTE_ITEMS,
  PALETTE_SECTIONS,
  paletteDescription,
  paletteLabel,
  type PaletteKey,
} from './paletteItems';
import { LANGUAGES, translator } from '../i18n/strings';

describe('palette metadata', () => {
  it('gives every offered kind an entry, plus the domain group', () => {
    const offered: PaletteKey[] = [...LAYER7_PALETTE, ...CONTAINER_PALETTE, 'domainGroup'];
    for (const key of offered) {
      expect(PALETTE_ITEMS[key]).toBeDefined();
      // Flipped in 4B: entries carry string-table keys, so "not empty" becomes
      // "resolves to real copy" — checked in every language the editor speaks.
      for (const language of LANGUAGES) {
        const t = translator(language);
        expect(paletteLabel(key, t)).not.toBe(PALETTE_ITEMS[key].labelKey);
        expect(paletteDescription(key, t)).not.toBe(PALETTE_ITEMS[key].descriptionKey);
      }
    }
  });

  it('defaults to English so callers that pass no translator are unchanged', () => {
    expect(paletteLabel('application')).toBe('Application');
    expect(paletteDescription('component')).toBe('A part inside one application');
  });

  it('places every item in exactly one section', () => {
    const placed = PALETTE_SECTIONS.flatMap((section) => section.keys);
    expect(new Set(placed).size).toBe(placed.length);
    expect(new Set(placed)).toEqual(new Set(Object.keys(PALETTE_ITEMS)));
  });

  it('excludes component from Layer 7 — it needs a parent application', () => {
    expect(LAYER7_PALETTE).not.toContain('component');
    expect(CONTAINER_PALETTE).toContain('component');
  });
});
