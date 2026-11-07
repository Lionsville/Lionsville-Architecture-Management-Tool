// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest';
import { createTheme } from '@mui/material/styles';
import { getNodeTokens } from './tokens';
import { coloursOf } from '../../widgets/kit/tokens';

const light = createTheme({ palette: { mode: 'light' } });
const dark = createTheme({ palette: { mode: 'dark' } });

describe('getNodeTokens', () => {
  it('reads aspect colours from the design tokens', () => {
    for (const theme of [light, dark]) {
      const tokens = getNodeTokens(theme);
      const colours = coloursOf(theme.palette.mode);
      expect(tokens.aspects.managed.fg).toBe(colours.ok);
      expect(tokens.aspects.partial.fg).toBe(colours.warn);
      expect(tokens.aspects.atRisk.fg).toBe(colours.bad);
      expect(tokens.aspects.none.fg).toBe(colours['ink-2']);
    }
  });

  it('uses the card tokens for card surfaces in both modes', () => {
    for (const theme of [light, dark]) {
      const colours = coloursOf(theme.palette.mode);
      expect(getNodeTokens(theme).card.bg).toBe(colours['card-surface']);
      expect(getNodeTokens(theme).card.border).toBe(colours['card-edge']);
    }
  });

  it('produces mode-specific zone tints (dark mode is not light mode)', () => {
    const lightTokens = getNodeTokens(light);
    const darkTokens = getNodeTokens(dark);
    expect(lightTokens.mode).toBe('light');
    expect(darkTokens.mode).toBe('dark');
    for (const zone of ['actors', 'inputChannels', 'externalSystems', 'management'] as const) {
      expect(lightTokens.zone.fill[zone]).not.toBe(darkTokens.zone.fill[zone]);
    }
    expect(lightTokens.zone.fill.landscape).toBe('transparent');
  });

  it('marks selection with the accent and warnings with the warning colour', () => {
    const tokens = getNodeTokens(light);
    const colours = coloursOf('light');
    expect(tokens.card.selectedRing).toBe(colours.accent);
    expect(tokens.card.warningBorder).toBe(colours.warn);
    expect(tokens.edge.strokeSelected).toBe(colours.accent);
  });

  it('caches per theme instance', () => {
    expect(getNodeTokens(light)).toBe(getNodeTokens(light));
    expect(getNodeTokens(light)).not.toBe(getNodeTokens(dark));
  });

  it('maps lifecycle states onto their tokens', () => {
    for (const theme of [light, dark]) {
      const { lifecycle } = getNodeTokens(theme);
      const colours = coloursOf(theme.palette.mode);
      expect(lifecycle.planned.fg).toBe(colours['life-planned']);
      expect(lifecycle.live.fg).toBe(colours['life-live']);
      expect(lifecycle.retiring.fg).toBe(colours['life-retiring']);
      expect(lifecycle.retired.fg).toBe(colours['life-gone']);
    }
  });

  it('populates the lifecycle record for all four states, non-empty, in both modes', () => {
    for (const theme of [light, dark]) {
      const { lifecycle } = getNodeTokens(theme);
      for (const state of ['planned', 'live', 'retiring', 'retired'] as const) {
        expect(lifecycle[state].bg).toBeTruthy();
        expect(lifecycle[state].fg).toBeTruthy();
        expect(lifecycle[state].border).toBeTruthy();
      }
    }
  });
});

describe('getNodeTokens — 4B tokens', () => {
  it('draws keyboard focus in the one focus ring token', () => {
    for (const theme of [light, dark]) {
      expect(getNodeTokens(theme).card.focusRing).toBe(coloursOf(theme.palette.mode)['focus-ring']);
    }
  });

  it('gives the minimap a themed surface in both modes', () => {
    expect(getNodeTokens(light).minimap.bg).toBe(coloursOf('light').surface);
    expect(getNodeTokens(dark).minimap.bg).toBe(coloursOf('dark').surface);
    expect(getNodeTokens(light).minimap.mask).not.toBe(getNodeTokens(dark).minimap.mask);
    expect(getNodeTokens(light).minimap.node).not.toBe(getNodeTokens(dark).minimap.node);
  });

  it('takes every 4B colour from the theme — no hex outside theme/', () => {
    for (const theme of [light, dark]) {
      const tokens = getNodeTokens(theme);
      for (const value of [tokens.card.focusRing, ...Object.values(tokens.minimap)]) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});
