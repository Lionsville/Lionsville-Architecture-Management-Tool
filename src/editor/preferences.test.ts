import { describe, expect, it } from 'vitest';
import { DEFAULT_TIDY_OPTIONS } from '../layout/tidy';
import {
  BOARD_TIDY_DEFAULTS,
  DEFAULT_EDITOR_PREFERENCES,
  mergePreferences,
  preferencesEqual,
} from './preferences';
import { PANEL_LIMITS } from './panels';

describe('mergePreferences', () => {
  it('returns the defaults for nothing at all', () => {
    expect(mergePreferences(undefined)).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(mergePreferences(null)).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(mergePreferences('{}')).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(mergePreferences(42)).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  it('keeps the stored value of every flag', () => {
    expect(
      mergePreferences({
        snapToGrid: true,
        showGrid: false,
        showLifecycle: false,
        paletteCollapsed: true,
        inspectorCollapsed: true,
      }),
    ).toMatchObject({
      snapToGrid: true,
      showGrid: false,
      showLifecycle: false,
      paletteCollapsed: true,
      inspectorCollapsed: true,
    });
  });

  it('falls back per field, so one bad value does not cost the rest', () => {
    const merged = mergePreferences({ snapToGrid: 'yes', showGrid: false });
    expect(merged.snapToGrid).toBe(DEFAULT_EDITOR_PREFERENCES.snapToGrid);
    expect(merged.showGrid).toBe(false);
  });

  it('validates the tidy enums instead of trusting them', () => {
    const merged = mergePreferences({
      tidyOptions: { direction: 'sideways', density: 'compact', pinGroups: true },
    });
    // Falls back to the BOARD's defaults, not the neutral ones: an invalid
    // direction lands on hybrid because that is what the board's Tidy starts at.
    expect(merged.tidyOptions).toEqual({
      ...BOARD_TIDY_DEFAULTS,
      density: 'compact',
      pinGroups: true,
    });
  });

  it('starts the board Tidy on hybrid and compact', () => {
    // The landscape is domain-partitioned, so hybrid (groups across, members
    // down) is what it reads as; compact because a board is looked at whole and
    // the extra air is paid for in zooming.
    const tidy = mergePreferences(undefined).tidyOptions;
    expect(tidy.direction).toBe('hybrid');
    expect(tidy.density).toBe('compact');
  });

  it('leaves the per-group Tidy on the neutral defaults', () => {
    // Hybrid means "group boxes flow across the landscape". Inside one group
    // there are no group boxes, so the board's default has nothing to say here.
    expect(mergePreferences(undefined).groupTidyOptions).toEqual(DEFAULT_TIDY_OPTIONS);
  });

  it('keeps a stored choice, so the new default only reaches a fresh editor', () => {
    const merged = mergePreferences({ tidyOptions: { direction: 'vertical', density: 'spacious' } });
    expect(merged.tidyOptions.direction).toBe('vertical');
    expect(merged.tidyOptions.density).toBe('spacious');
  });

  it('keeps the two tidy option sets apart', () => {
    const merged = mergePreferences({
      tidyOptions: { direction: 'horizontal' },
      groupTidyOptions: { direction: 'vertical' },
    });
    expect(merged.tidyOptions.direction).toBe('horizontal');
    expect(merged.groupTidyOptions.direction).toBe('vertical');
  });

  it('ignores a tidy block that is not an object', () => {
    expect(mergePreferences({ tidyOptions: 'compact' }).tidyOptions).toEqual(BOARD_TIDY_DEFAULTS);
  });
});

describe('preferencesEqual', () => {
  it('compares by value, not by identity', () => {
    expect(preferencesEqual(mergePreferences({}), DEFAULT_EDITOR_PREFERENCES)).toBe(true);
  });

  it('sees a changed flag', () => {
    expect(
      preferencesEqual(DEFAULT_EDITOR_PREFERENCES, {
        ...DEFAULT_EDITOR_PREFERENCES,
        snapToGrid: true,
      }),
    ).toBe(false);
  });

  it('sees a changed tidy option in either set', () => {
    expect(
      preferencesEqual(DEFAULT_EDITOR_PREFERENCES, {
        ...DEFAULT_EDITOR_PREFERENCES,
        tidyOptions: { ...DEFAULT_TIDY_OPTIONS, density: 'spacious' },
      }),
    ).toBe(false);
    expect(
      preferencesEqual(DEFAULT_EDITOR_PREFERENCES, {
        ...DEFAULT_EDITOR_PREFERENCES,
        groupTidyOptions: { ...DEFAULT_TIDY_OPTIONS, pinGroups: true },
      }),
    ).toBe(false);
  });
});

describe('mergePreferences — 4B fields', () => {
  it('defaults the minimap off and the panels to their own widths', () => {
    const merged = mergePreferences({});
    expect(merged.showMinimap).toBe(false);
    expect(merged.paletteWidth).toBe(PANEL_LIMITS.palette.default);
    expect(merged.inspectorWidth).toBe(PANEL_LIMITS.inspector.default);
  });

  it('keeps a stored width that is inside the limits', () => {
    const merged = mergePreferences({ paletteWidth: 300, inspectorWidth: 420 });
    expect(merged.paletteWidth).toBe(300);
    expect(merged.inspectorWidth).toBe(420);
  });

  it('clamps a stored width instead of trusting it', () => {
    // A blob from another version, or a hand edit: a panel wider than the window
    // is worse than a forgotten preference.
    const merged = mergePreferences({ paletteWidth: 9000, inspectorWidth: 10 });
    expect(merged.paletteWidth).toBe(PANEL_LIMITS.palette.max);
    expect(merged.inspectorWidth).toBe(PANEL_LIMITS.inspector.min);
  });

  it('falls back per field for a width that is not a number', () => {
    const merged = mergePreferences({ paletteWidth: '300', showMinimap: 'yes', showGrid: false });
    expect(merged.paletteWidth).toBe(PANEL_LIMITS.palette.default);
    expect(merged.showMinimap).toBe(false);
    expect(merged.showGrid).toBe(false);
  });
});

describe('preferencesEqual — 4B fields', () => {
  it('notices a width change', () => {
    const a = mergePreferences({});
    expect(preferencesEqual(a, { ...a, paletteWidth: a.paletteWidth + 1 })).toBe(false);
    expect(preferencesEqual(a, { ...a, inspectorWidth: a.inspectorWidth + 1 })).toBe(false);
  });

  it('notices the minimap toggle', () => {
    const a = mergePreferences({});
    expect(preferencesEqual(a, { ...a, showMinimap: !a.showMinimap })).toBe(false);
  });
});
