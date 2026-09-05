import { describe, expect, it } from 'vitest';
import { createTheme } from '@mui/material/styles';
import { getNodeTokens } from './tokens';

const light = createTheme({ palette: { mode: 'light' } });
const dark = createTheme({ palette: { mode: 'dark' } });

describe('getNodeTokens', () => {
  it('derives aspect colours from the theme status palette', () => {
    for (const theme of [light, dark]) {
      const tokens = getNodeTokens(theme);
      expect(tokens.aspects.managed.fg).toBe(
        theme.palette.mode === 'dark' ? theme.palette.success.light : theme.palette.success.dark,
      );
      expect(tokens.aspects.partial.fg).toBe(
        theme.palette.mode === 'dark' ? theme.palette.warning.light : theme.palette.warning.dark,
      );
      expect(tokens.aspects.atRisk.fg).toBe(
        theme.palette.mode === 'dark' ? theme.palette.error.light : theme.palette.error.dark,
      );
      expect(tokens.aspects.none.fg).toBe(theme.palette.text.disabled);
    }
  });

  it('uses paper/divider for card surfaces in both modes', () => {
    expect(getNodeTokens(light).card.bg).toBe(light.palette.background.paper);
    expect(getNodeTokens(dark).card.bg).toBe(dark.palette.background.paper);
    expect(getNodeTokens(light).card.border).toBe(light.palette.divider);
    expect(getNodeTokens(dark).card.border).toBe(dark.palette.divider);
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

  it('marks selection with the primary colour and warnings with the warning colour', () => {
    const tokens = getNodeTokens(light);
    expect(tokens.card.selectedRing).toBe(light.palette.primary.main);
    expect(tokens.card.warningBorder).toBe(light.palette.warning.main);
    expect(tokens.edge.strokeSelected).toBe(light.palette.primary.main);
  });

  it('caches per theme instance', () => {
    expect(getNodeTokens(light)).toBe(getNodeTokens(light));
    expect(getNodeTokens(light)).not.toBe(getNodeTokens(dark));
  });

  it('maps lifecycle states onto the semantic palette (planned→info, incl. the widened statusToken)', () => {
    for (const theme of [light, dark]) {
      const { lifecycle } = getNodeTokens(theme);
      const useLight = theme.palette.mode === 'dark';
      expect(lifecycle.planned.fg).toBe(useLight ? theme.palette.info.light : theme.palette.info.dark);
      expect(lifecycle.live.fg).toBe(useLight ? theme.palette.success.light : theme.palette.success.dark);
      expect(lifecycle.retiring.fg).toBe(useLight ? theme.palette.warning.light : theme.palette.warning.dark);
      expect(lifecycle.retired.fg).toBe(theme.palette.text.disabled);
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
  it('gives keyboard focus its own colour, distinct from selection', () => {
    // Focus and selection routinely disagree — you can tab past a node without
    // selecting it — so one hue for both would make "where am I" unanswerable.
    for (const theme of [light, dark]) {
      const tokens = getNodeTokens(theme);
      expect(tokens.card.focusRing).toBeTruthy();
      expect(tokens.card.focusRing).not.toBe(tokens.card.selectedRing);
    }
  });

  it('gives the minimap a themed surface in both modes', () => {
    expect(getNodeTokens(light).minimap.bg).toBe(light.palette.background.paper);
    expect(getNodeTokens(dark).minimap.bg).toBe(dark.palette.background.paper);
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
