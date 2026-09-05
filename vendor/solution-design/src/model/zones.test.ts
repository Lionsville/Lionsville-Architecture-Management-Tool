import { describe, expect, it } from 'vitest';
import {
  CANVAS_SIZE_LIMITS,
  canvasRect,
  canvasSizeFromPointer,
  clampCanvasSize,
  clampZoneSize,
  DEFAULT_ZONE_SIZES,
  LAYER7_CANVAS,
  zoneForPoint,
  zoneRect,
  zoneLabel,
  zoneMenuLabel,
  zoneSizeFromPointer,
  zoneSizeLimits,
  zoneSizes,
  ZONE_LABEL_KEYS,
  ZONE_MENU_LABEL_KEYS,
} from './zones';
import { LANGUAGES, translator } from '../i18n/strings';
import type { DiagramLayoutConfig, Layer7Zone } from '../types';

const { width: W, height: H } = LAYER7_CANVAS;
const TOP = DEFAULT_ZONE_SIZES.actors;
const BOTTOM = DEFAULT_ZONE_SIZES.management;
const SIDE = DEFAULT_ZONE_SIZES.inputChannels;

const WIDE_CONFIG: DiagramLayoutConfig = {
  zones: { actors: { size: 220 }, inputChannels: { size: 400 } },
};

describe('zoneRect', () => {
  it('tiles the canvas without gaps or overlap (default and resized)', () => {
    const zones: Layer7Zone[] = [
      'actors',
      'inputChannels',
      'externalSystems',
      'landscape',
      'management',
    ];
    for (const config of [undefined, WIDE_CONFIG]) {
      const total = zones
        .map((zone) => zoneRect(zone, config))
        .reduce((sum, rect) => sum + rect.width * rect.height, 0);
      expect(total).toBe(W * H);
    }
  });

  it('keeps the grammar: actors top, management bottom, channels left, external right', () => {
    expect(zoneRect('actors').y).toBe(0);
    expect(zoneRect('management').y).toBe(H - BOTTOM);
    expect(zoneRect('inputChannels').x).toBe(0);
    expect(zoneRect('externalSystems').x).toBe(W - SIDE);
    expect(zoneRect('landscape').x).toBe(SIDE);
  });

  it('applies configured band sizes', () => {
    expect(zoneRect('actors', WIDE_CONFIG).height).toBe(220);
    expect(zoneRect('inputChannels', WIDE_CONFIG).width).toBe(400);
    expect(zoneRect('landscape', WIDE_CONFIG).x).toBe(400);
    // Unconfigured bands keep their defaults.
    expect(zoneRect('management', WIDE_CONFIG).height).toBe(BOTTOM);
  });
});

describe('zoneSizes / clampZoneSize', () => {
  it('falls back to defaults without a config', () => {
    expect(zoneSizes()).toEqual(DEFAULT_ZONE_SIZES);
    expect(zoneSizes({})).toEqual(DEFAULT_ZONE_SIZES);
  });

  it('clamps configured sizes into the band limits', () => {
    const config: DiagramLayoutConfig = {
      zones: { actors: { size: 5 }, externalSystems: { size: 9999 } },
    };
    expect(zoneSizes(config).actors).toBe(zoneSizeLimits('actors', config).min);
    expect(zoneSizes(config).externalSystems).toBe(zoneSizeLimits('externalSystems', config).max);
  });

  it('clampZoneSize pins the documented limits on the default board', () => {
    // Maxima are fractions of the board (0.35 of height for top/bottom, 0.34
    // of width for the side bands) — on the default 1680×1040 these sit just
    // above the previous fixed limits (364 ≥ 360, 571 ≥ 560), so bands stored
    // under the old limits are never clamped smaller.
    expect(clampZoneSize('actors', 0)).toBe(90);
    expect(clampZoneSize('actors', 1000)).toBe(364);
    expect(clampZoneSize('inputChannels', 0)).toBe(120);
    expect(clampZoneSize('inputChannels', 1000)).toBe(571);
    expect(clampZoneSize('inputChannels', 560)).toBe(560);
    expect(clampZoneSize('management', 200)).toBe(200);
  });

  it('band maxima scale with the board size', () => {
    const grown: DiagramLayoutConfig = { canvas: { width: 2400, height: 1600 } };
    expect(zoneSizeLimits('actors', grown)).toEqual({ min: 90, max: 560 });
    expect(zoneSizeLimits('externalSystems', grown)).toEqual({ min: 120, max: 816 });
    const shrunk: DiagramLayoutConfig = { canvas: { width: 840, height: 520 } };
    expect(zoneSizeLimits('management', shrunk)).toEqual({ min: 90, max: 182 });
    expect(zoneSizeLimits('inputChannels', shrunk)).toEqual({ min: 120, max: 286 });
    // A band configured deeper than a later, smaller board allows yields to it.
    const config: DiagramLayoutConfig = { ...shrunk, zones: { actors: { size: 300 } } };
    expect(zoneSizes(config).actors).toBe(182);
  });
});

describe('zoneSizeFromPointer (resize math)', () => {
  it('maps the pointer to each band size from its inner edge', () => {
    expect(zoneSizeFromPointer('actors', { x: 100, y: 200 })).toBe(200);
    expect(zoneSizeFromPointer('management', { x: 100, y: H - 180 })).toBe(180);
    expect(zoneSizeFromPointer('inputChannels', { x: 300, y: 500 })).toBe(300);
    expect(zoneSizeFromPointer('externalSystems', { x: W - 260, y: 500 })).toBe(260);
  });

  it('clamps pointer overshoot', () => {
    expect(zoneSizeFromPointer('actors', { x: 0, y: -50 })).toBe(zoneSizeLimits('actors').min);
    expect(zoneSizeFromPointer('actors', { x: 0, y: H })).toBe(zoneSizeLimits('actors').max);
    expect(zoneSizeFromPointer('externalSystems', { x: W + 100, y: 0 })).toBe(
      zoneSizeLimits('externalSystems').min,
    );
  });
});

describe('zoneForPoint', () => {
  it('assigns band interiors', () => {
    expect(zoneForPoint({ x: W / 2, y: TOP / 2 })).toBe('actors');
    expect(zoneForPoint({ x: W / 2, y: H - BOTTOM / 2 })).toBe('management');
    expect(zoneForPoint({ x: SIDE / 2, y: H / 2 })).toBe('inputChannels');
    expect(zoneForPoint({ x: W - SIDE / 2, y: H / 2 })).toBe('externalSystems');
    expect(zoneForPoint({ x: W / 2, y: H / 2 })).toBe('landscape');
  });

  it('pins band-edge semantics (half-open bands)', () => {
    // Exactly on the actors/middle boundary → middle row.
    expect(zoneForPoint({ x: W / 2, y: TOP })).toBe('landscape');
    expect(zoneForPoint({ x: W / 2, y: TOP - 0.01 })).toBe('actors');
    // Exactly on the management boundary → management.
    expect(zoneForPoint({ x: W / 2, y: H - BOTTOM })).toBe('management');
    expect(zoneForPoint({ x: W / 2, y: H - BOTTOM - 0.01 })).toBe('landscape');
    // Exactly on the left side boundary → landscape; right boundary → external.
    expect(zoneForPoint({ x: SIDE, y: H / 2 })).toBe('landscape');
    expect(zoneForPoint({ x: SIDE - 0.01, y: H / 2 })).toBe('inputChannels');
    expect(zoneForPoint({ x: W - SIDE, y: H / 2 })).toBe('externalSystems');
    expect(zoneForPoint({ x: W - SIDE - 0.01, y: H / 2 })).toBe('landscape');
  });

  it('respects resized bands', () => {
    // y=200 is landscape by default but actors with the 220-high band.
    expect(zoneForPoint({ x: W / 2, y: 200 })).toBe('landscape');
    expect(zoneForPoint({ x: W / 2, y: 200 }, WIDE_CONFIG)).toBe('actors');
    // x=300 is landscape by default but inputChannels with the 400-wide band.
    expect(zoneForPoint({ x: 300, y: H / 2 })).toBe('landscape');
    expect(zoneForPoint({ x: 300, y: H / 2 }, WIDE_CONFIG)).toBe('inputChannels');
  });

  it('gives top/bottom bands priority in the corners', () => {
    expect(zoneForPoint({ x: 10, y: 10 })).toBe('actors');
    expect(zoneForPoint({ x: W - 10, y: 10 })).toBe('actors');
    expect(zoneForPoint({ x: 10, y: H - 10 })).toBe('management');
    expect(zoneForPoint({ x: W - 10, y: H - 10 })).toBe('management');
  });

  it('clamps points outside the canvas into the nearest band', () => {
    expect(zoneForPoint({ x: W / 2, y: -500 })).toBe('actors');
    expect(zoneForPoint({ x: W / 2, y: H + 500 })).toBe('management');
    expect(zoneForPoint({ x: -500, y: H / 2 })).toBe('inputChannels');
    expect(zoneForPoint({ x: W + 500, y: H / 2 })).toBe('externalSystems');
  });
});

// ── Iteration 3: growable canvas ─────────────────────────────────────────────

const GROWN_CONFIG: DiagramLayoutConfig = { canvas: { width: 2400, height: 1600 } };

describe('canvasRect / clampCanvasSize', () => {
  it('defaults to the fixed board and grows with layoutConfig.canvas', () => {
    expect(canvasRect()).toEqual(LAYER7_CANVAS);
    expect(canvasRect({})).toEqual(LAYER7_CANVAS);
    expect(canvasRect(GROWN_CONFIG)).toEqual({ x: 0, y: 0, width: 2400, height: 1600 });
  });

  it('floors at half the default board and caps at the limits (flexible board)', () => {
    expect(CANVAS_SIZE_LIMITS.minWidth).toBe(LAYER7_CANVAS.width / 2);
    expect(CANVAS_SIZE_LIMITS.minHeight).toBe(LAYER7_CANVAS.height / 2);
    expect(clampCanvasSize({ width: 100, height: 100 })).toEqual({
      width: CANVAS_SIZE_LIMITS.minWidth,
      height: CANVAS_SIZE_LIMITS.minHeight,
    });
    expect(clampCanvasSize({ width: 99999, height: 99999 })).toEqual({
      width: CANVAS_SIZE_LIMITS.maxWidth,
      height: CANVAS_SIZE_LIMITS.maxHeight,
    });
    expect(canvasRect({ canvas: { width: 10, height: 10 } })).toEqual({
      x: 0,
      y: 0,
      width: CANVAS_SIZE_LIMITS.minWidth,
      height: CANVAS_SIZE_LIMITS.minHeight,
    });
  });
});

describe('shrunken canvas (flexible board, 2026-08) propagates through the zone math', () => {
  const SHRUNK: DiagramLayoutConfig = { canvas: { width: 840, height: 520 } };

  it('tiles the smaller board without gaps and keeps the grammar anchored', () => {
    const zones: Layer7Zone[] = [
      'actors',
      'inputChannels',
      'externalSystems',
      'landscape',
      'management',
    ];
    const total = zones
      .map((zone) => zoneRect(zone, SHRUNK))
      .reduce((sum, rect) => sum + rect.width * rect.height, 0);
    expect(total).toBe(840 * 520);
    expect(zoneRect('management', SHRUNK).y).toBe(520 - DEFAULT_ZONE_SIZES.management);
    expect(zoneRect('externalSystems', SHRUNK).x).toBe(840 - DEFAULT_ZONE_SIZES.externalSystems);
  });

  it('keeps a usable landscape at the minimum board with default bands', () => {
    const landscape = zoneRect('landscape', SHRUNK);
    expect(landscape.width).toBeGreaterThan(0);
    expect(landscape.height).toBeGreaterThan(0);
  });
});

describe('grown canvas propagates through the zone math', () => {
  it('anchors management/right bands to the grown far edges and tiles fully', () => {
    expect(zoneRect('management', GROWN_CONFIG).y).toBe(1600 - BOTTOM);
    expect(zoneRect('externalSystems', GROWN_CONFIG).x).toBe(2400 - SIDE);
    const zones: Layer7Zone[] = [
      'actors',
      'inputChannels',
      'externalSystems',
      'landscape',
      'management',
    ];
    const total = zones
      .map((zone) => zoneRect(zone, GROWN_CONFIG))
      .reduce((sum, rect) => sum + rect.width * rect.height, 0);
    expect(total).toBe(2400 * 1600);
  });

  it('zoneForPoint uses the grown bounds', () => {
    // Beyond the default board but inside the grown landscape.
    expect(zoneForPoint({ x: 2000, y: 800 }, GROWN_CONFIG)).toBe('landscape');
    expect(zoneForPoint({ x: 2400 - SIDE / 2, y: 800 }, GROWN_CONFIG)).toBe('externalSystems');
    expect(zoneForPoint({ x: 1200, y: 1600 - BOTTOM / 2 }, GROWN_CONFIG)).toBe('management');
  });

  it('zoneSizeFromPointer anchors to the grown far edges', () => {
    expect(zoneSizeFromPointer('management', { x: 0, y: 1600 - 180 }, GROWN_CONFIG)).toBe(180);
    expect(zoneSizeFromPointer('externalSystems', { x: 2400 - 260, y: 0 }, GROWN_CONFIG)).toBe(260);
  });

  it('canvasSizeFromPointer maps the pointer to a clamped board size', () => {
    expect(canvasSizeFromPointer({ x: 2000, y: 1500 })).toEqual({ width: 2000, height: 1500 });
    expect(canvasSizeFromPointer({ x: 100, y: 100 })).toEqual({
      width: CANVAS_SIZE_LIMITS.minWidth,
      height: CANVAS_SIZE_LIMITS.minHeight,
    });
    expect(canvasSizeFromPointer({ x: 99999, y: 99999 })).toEqual({
      width: CANVAS_SIZE_LIMITS.maxWidth,
      height: CANVAS_SIZE_LIMITS.maxHeight,
    });
  });

  it('an edge handle leaves the axis it does not own alone', () => {
    // The right handle spans nearly the board's full height, so grabbing it
    // halfway down is ordinary. Taking the height from the pointer too would
    // drop a default board to 600 — invisible only while the floor WAS 1040.
    expect(canvasSizeFromPointer({ x: 2000, y: 600 }, undefined, 'right')).toEqual({
      width: 2000,
      height: LAYER7_CANVAS.height,
    });
    expect(canvasSizeFromPointer({ x: 600, y: 2000 }, undefined, 'bottom')).toEqual({
      width: LAYER7_CANVAS.width,
      height: 2000,
    });
    // The corner owns both axes.
    expect(canvasSizeFromPointer({ x: 2000, y: 2000 }, undefined, 'corner')).toEqual({
      width: 2000,
      height: 2000,
    });
  });

  it('an edge handle holds a board that was already resized on the other axis', () => {
    expect(canvasSizeFromPointer({ x: 2000, y: 600 }, GROWN_CONFIG, 'right')).toEqual({
      width: 2000,
      height: 1600,
    });
  });
});

describe('zone labels', () => {
  it('answers in English when no translator is given', () => {
    // The default keeps every existing caller — and this suite — unchanged.
    expect(zoneLabel('landscape')).toBe('APPLICATION LANDSCAPE');
    expect(zoneMenuLabel('landscape')).toBe('Application landscape');
  });

  it('follows the language it is handed', () => {
    expect(zoneLabel('landscape', translator('nl'))).toBe('APPLICATIELANDSCHAP');
    expect(zoneLabel('management', translator('nl'))).toBe('BEHEERLAAG');
    expect(zoneMenuLabel('inputChannels', translator('nl'))).toBe('Invoerkanalen');
  });

  it('gives every zone a caption in both languages', () => {
    const zones: Layer7Zone[] = [
      'actors',
      'inputChannels',
      'externalSystems',
      'landscape',
      'management',
    ];
    for (const language of LANGUAGES) {
      for (const zone of zones) {
        expect(zoneLabel(zone, translator(language))).not.toBe(ZONE_LABEL_KEYS[zone]);
        expect(zoneMenuLabel(zone, translator(language))).not.toBe(ZONE_MENU_LABEL_KEYS[zone]);
      }
    }
  });

  it('draws the band caption in caps and the menu entry in sentence case', () => {
    for (const language of LANGUAGES) {
      const t = translator(language);
      expect(zoneLabel('actors', t)).toBe(zoneLabel('actors', t).toUpperCase());
      expect(zoneMenuLabel('actors', t)).not.toBe(zoneMenuLabel('actors', t).toUpperCase());
    }
  });
});
