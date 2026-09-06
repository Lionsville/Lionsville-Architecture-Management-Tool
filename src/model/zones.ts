import { DEFAULT_TRANSLATE, type StringKey, type Translate } from '../i18n/strings';
import type {
  DiagramLayoutConfig,
  ElementKind,
  Layer7Zone,
  Point,
  Rect,
  ResizableZone,
} from './types';

/**
 * Fixed Layer 7 zone grammar (intent invariant — docs/intent/solution-designs.md):
 * actors top, input channels left, external connections right, management
 * bottom, application landscape centre. The grammar never changes; since
 * iteration 2 the band *sizes* are adjustable per diagram via
 * `layoutConfig.zones` (height for top/bottom bands, width for side bands).
 * Bands stay flush (no gaps) so hit-testing is total; visual insets are
 * applied at render time only.
 */
export const LAYER7_CANVAS: Rect = { x: 0, y: 0, width: 1680, height: 1040 };

/**
 * Canvas size limits. Complex landscapes may enlarge the board (iteration 3);
 * since the flexible-board change (2026-08) a compact landscape may also shrink it below the 1680×1040
 * default, down to half of it — small enough for a handful of boxes, large
 * enough that the five-zone grammar stays readable. Tidy still shrink-backs
 * to the default unless the board was deliberately made smaller (tidy.ts).
 */
export const CANVAS_SIZE_LIMITS = {
  minWidth: LAYER7_CANVAS.width / 2,
  minHeight: LAYER7_CANVAS.height / 2,
  maxWidth: 4800,
  maxHeight: 3200,
};

export function clampCanvasSize(size: { width: number; height: number }): {
  width: number;
  height: number;
} {
  return {
    width: Math.min(Math.max(size.width, CANVAS_SIZE_LIMITS.minWidth), CANVAS_SIZE_LIMITS.maxWidth),
    height: Math.min(
      Math.max(size.height, CANVAS_SIZE_LIMITS.minHeight),
      CANVAS_SIZE_LIMITS.maxHeight,
    ),
  };
}

/** Effective Layer 7 board rect: the default, grown by layoutConfig.canvas. */
export function canvasRect(layoutConfig?: DiagramLayoutConfig): Rect {
  const configured = layoutConfig?.canvas;
  if (!configured) return LAYER7_CANVAS;
  const size = clampCanvasSize(configured);
  return { x: LAYER7_CANVAS.x, y: LAYER7_CANVAS.y, width: size.width, height: size.height };
}

/** Default band sizes, used when the diagram has no layoutConfig override. */
export const DEFAULT_ZONE_SIZES: Record<ResizableZone, number> = {
  actors: 150,
  management: 160,
  inputChannels: 250,
  externalSystems: 250,
};

/**
 * Band size limits for the resize handles. Minima are absolute (a band
 * narrower than this cannot hold its nodes); maxima scale with the board
 * (flexible-board, 2026-08) so a grown canvas can hold deeper bands — more actor rows, wider
 * channel columns. With every band at its maximum the landscape still keeps
 * roughly a third of each axis (30% of the height, 32% of the width), which is
 * what the old fixed limits left it on the default board. The
 * fractions sit just ABOVE the previous fixed limits on the default 1680×1040
 * board (0.35 × 1040 = 364 ≥ 360, 0.34 × 1680 = 571 ≥ 560), so no band stored
 * under the old limits is ever clamped smaller by this change.
 */
/** The four resizable bands, in a fixed order for iteration. */
export const RESIZABLE_ZONES: readonly ResizableZone[] = [
  'actors',
  'inputChannels',
  'externalSystems',
  'management',
];

export const ZONE_SIZE_MIN: Record<ResizableZone, number> = {
  actors: 90,
  management: 90,
  inputChannels: 120,
  externalSystems: 120,
};

const ZONE_MAX_FRACTION: Record<ResizableZone, number> = {
  actors: 0.35,
  management: 0.35,
  inputChannels: 0.34,
  externalSystems: 0.34,
};

export function zoneSizeLimits(
  zone: ResizableZone,
  layoutConfig?: DiagramLayoutConfig,
): { min: number; max: number } {
  const board = canvasRect(layoutConfig);
  const basis = zone === 'actors' || zone === 'management' ? board.height : board.width;
  return { min: ZONE_SIZE_MIN[zone], max: Math.round(basis * ZONE_MAX_FRACTION[zone]) };
}

/**
 * The band captions, as string-table KEYS rather than words — the captions are
 * drawn on the canvas and belong to the UI language, not to the model.
 *
 * `zoneLabel(zone)` with no translator still answers in English, which is what
 * keeps this table's callers (and their tests) unchanged.
 */
export const ZONE_LABEL_KEYS: Record<Layer7Zone, StringKey> = {
  actors: 'zone.actors',
  inputChannels: 'zone.inputChannels',
  externalSystems: 'zone.externalSystems',
  landscape: 'zone.landscape',
  management: 'zone.management',
};

/** The uppercase band caption for a zone, in the given language (default English). */
export function zoneLabel(zone: Layer7Zone, translate: Translate = DEFAULT_TRANSLATE): string {
  return translate(ZONE_LABEL_KEYS[zone]);
}

/** Sentence-case zone names (menus, the inspector's Zone line). */
export const ZONE_MENU_LABEL_KEYS: Record<Layer7Zone, StringKey> = {
  actors: 'zoneMenu.actors',
  inputChannels: 'zoneMenu.inputChannels',
  externalSystems: 'zoneMenu.externalSystems',
  landscape: 'zoneMenu.landscape',
  management: 'zoneMenu.management',
};

export function zoneMenuLabel(zone: Layer7Zone, translate: Translate = DEFAULT_TRANSLATE): string {
  return translate(ZONE_MENU_LABEL_KEYS[zone]);
}

/** The default home zone the palette places each element kind into. */
export const HOME_ZONE: Record<ElementKind, Layer7Zone> = {
  actor: 'actors',
  application: 'landscape',
  externalSystem: 'externalSystems',
  inputChannel: 'inputChannels',
  managementTool: 'management',
  component: 'landscape',
};

export function clampZoneSize(
  zone: ResizableZone,
  size: number,
  layoutConfig?: DiagramLayoutConfig,
): number {
  const { min, max } = zoneSizeLimits(zone, layoutConfig);
  return Math.min(Math.max(size, min), max);
}

/**
 * Effective band sizes for a diagram (config override or default, clamped).
 * Defaults are clamped too: since the maxima follow the board size, a band
 * left at its default must still yield to a deliberately shrunken canvas.
 */
export function zoneSizes(layoutConfig?: DiagramLayoutConfig): Record<ResizableZone, number> {
  const resolve = (zone: ResizableZone) =>
    clampZoneSize(zone, layoutConfig?.zones?.[zone]?.size ?? DEFAULT_ZONE_SIZES[zone], layoutConfig);
  return {
    actors: resolve('actors'),
    management: resolve('management'),
    inputChannels: resolve('inputChannels'),
    externalSystems: resolve('externalSystems'),
  };
}

export function zoneRect(zone: Layer7Zone, layoutConfig?: DiagramLayoutConfig): Rect {
  const { x, y, width, height } = canvasRect(layoutConfig);
  const sizes = zoneSizes(layoutConfig);
  const middleY = y + sizes.actors;
  const middleHeight = height - sizes.actors - sizes.management;
  switch (zone) {
    case 'actors':
      return { x, y, width, height: sizes.actors };
    case 'management':
      return { x, y: y + height - sizes.management, width, height: sizes.management };
    case 'inputChannels':
      return { x, y: middleY, width: sizes.inputChannels, height: middleHeight };
    case 'externalSystems':
      return {
        x: x + width - sizes.externalSystems,
        y: middleY,
        width: sizes.externalSystems,
        height: middleHeight,
      };
    case 'landscape':
      return {
        x: x + sizes.inputChannels,
        y: middleY,
        width: width - sizes.inputChannels - sizes.externalSystems,
        height: middleHeight,
      };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Zone hit-test for a point (typically a node's centre), used for drop-zone
 * assignment while dragging. Points outside the canvas clamp inward first, so
 * a drag past the board edge still lands in the nearest band. Respects the
 * diagram's resized band sizes.
 *
 * Boundary semantics (half-open bands, pinned by unit tests):
 * - y < actors size               → actors;  y === boundary → middle row
 * - y >= height - management size → management
 * - x < inputChannels size        → inputChannels; x === boundary → landscape
 * - x >= width - externalSystems  → externalSystems
 * Top/bottom bands win over left/right bands in the corners.
 */
export function zoneForPoint(point: Point, layoutConfig?: DiagramLayoutConfig): Layer7Zone {
  const { x: cx, y: cy, width, height } = canvasRect(layoutConfig);
  const sizes = zoneSizes(layoutConfig);
  const x = clamp(point.x, cx, cx + width);
  const y = clamp(point.y, cy, cy + height);
  if (y < cy + sizes.actors) return 'actors';
  if (y >= cy + height - sizes.management) return 'management';
  if (x < cx + sizes.inputChannels) return 'inputChannels';
  if (x >= cx + width - sizes.externalSystems) return 'externalSystems';
  return 'landscape';
}

/**
 * Resize math for the band drag handles: maps a pointer position (flow
 * coordinates) on a band's inner edge to that band's new size, clamped.
 * Respects the diagram's grown canvas (management/right bands anchor to the
 * far edge).
 */
export function zoneSizeFromPointer(
  zone: ResizableZone,
  point: Point,
  layoutConfig?: DiagramLayoutConfig,
): number {
  const { x, y, width, height } = canvasRect(layoutConfig);
  switch (zone) {
    case 'actors':
      return clampZoneSize(zone, point.y - y, layoutConfig);
    case 'management':
      return clampZoneSize(zone, y + height - point.y, layoutConfig);
    case 'inputChannels':
      return clampZoneSize(zone, point.x - x, layoutConfig);
    case 'externalSystems':
      return clampZoneSize(zone, x + width - point.x, layoutConfig);
  }
}

/**
 * Resize math for the canvas border handles: maps a pointer position to the new
 * board size, clamped to the limits.
 *
 * `edge` names the handle that was grabbed, and the axis it does NOT own keeps
 * its current size. Taking both axes from the pointer only looked harmless while
 * the minimum WAS the default board: the off-axis value clamped straight back.
 * Since the flexible board (2026-08) it no longer does, and dragging the right
 * edge at pointer y ≈ 600 would shrink a default board's height to 600 with it.
 */
export function canvasSizeFromPointer(
  point: Point,
  layoutConfig?: DiagramLayoutConfig,
  edge: 'right' | 'bottom' | 'corner' = 'corner',
): { width: number; height: number } {
  const current = canvasRect(layoutConfig);
  return clampCanvasSize({
    width: edge === 'bottom' ? current.width : point.x - current.x,
    height: edge === 'right' ? current.height : point.y - current.y,
  });
}
