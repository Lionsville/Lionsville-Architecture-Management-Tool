import { describe, expect, it } from 'vitest';
import { PANEL_LIMITS, clampPanelWidth, panelWidth } from './panels';

describe('clampPanelWidth', () => {
  it('keeps a width inside the limits', () => {
    expect(clampPanelWidth('palette', 300)).toBe(300);
    expect(clampPanelWidth('inspector', 400)).toBe(400);
  });

  it('clamps to the minimum and the maximum', () => {
    expect(clampPanelWidth('palette', 10)).toBe(PANEL_LIMITS.palette.min);
    expect(clampPanelWidth('palette', 9000)).toBe(PANEL_LIMITS.palette.max);
    expect(clampPanelWidth('inspector', 0)).toBe(PANEL_LIMITS.inspector.min);
    expect(clampPanelWidth('inspector', 9000)).toBe(PANEL_LIMITS.inspector.max);
  });

  it('rounds to whole pixels', () => {
    expect(clampPanelWidth('palette', 233.6)).toBe(234);
  });

  it('falls back to the default for a non-finite width', () => {
    expect(clampPanelWidth('palette', Number.NaN)).toBe(PANEL_LIMITS.palette.default);
    expect(clampPanelWidth('inspector', Number.POSITIVE_INFINITY)).toBe(
      PANEL_LIMITS.inspector.default,
    );
  });
});

describe('panelWidth', () => {
  it('accepts a stored number', () => {
    expect(panelWidth('palette', 260)).toBe(260);
  });

  it('falls back for anything that is not a finite number', () => {
    for (const stored of [undefined, null, '320', {}, Number.NaN, []]) {
      expect(panelWidth('inspector', stored)).toBe(PANEL_LIMITS.inspector.default);
    }
  });

  it('clamps a stored number that is out of range', () => {
    expect(panelWidth('palette', 1000)).toBe(PANEL_LIMITS.palette.max);
  });
});

describe('the limits themselves', () => {
  it('leave a usable canvas at 1280 px with both panels wide open', () => {
    const widest = PANEL_LIMITS.palette.max + PANEL_LIMITS.inspector.max;
    expect(1280 - widest).toBeGreaterThanOrEqual(300);
  });

  it('opens each panel inside its own range', () => {
    for (const kind of ['palette', 'inspector'] as const) {
      const { min, max, default: fallback, rail } = PANEL_LIMITS[kind];
      expect(fallback).toBeGreaterThanOrEqual(min);
      expect(fallback).toBeLessThanOrEqual(max);
      expect(rail).toBeLessThan(min);
    }
  });
});
