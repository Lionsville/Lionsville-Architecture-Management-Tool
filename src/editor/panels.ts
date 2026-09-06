/**
 * The two side panels' geometry — pure numbers, so the preference layer can
 * sanitise a stored width without importing a React component.
 *
 * The limits are the interesting part. A minimum below ~180 px turns the palette
 * into a column of clipped words, and a maximum above ~420 px starves the canvas
 * on the 1280 px laptop this tool is used on: with both panels at their maxima
 * and a 1280 px window there is still 340 px of board left, which is narrow but
 * not broken. The inspector's floor is higher (260) because it holds two-column
 * rows — "Leaves from" beside "Arrives at" — that stop being readable below it.
 *
 * A stored width is never trusted: it comes from browser storage and may have
 * been written by another version, hand-edited, or truncated mid-write.
 */

export interface PanelGeometry {
  /** Width a panel opens at before anyone drags it. */
  default: number;
  min: number;
  max: number;
  /** Width when collapsed to its rail — not draggable. */
  rail: number;
}

export const PANEL_LIMITS: Record<'palette' | 'inspector', PanelGeometry> = {
  // The rail is 48 — 40 (the inspector's) is too tight for the 34px glyph
  // buttons it carries. The 8px asymmetry is deliberate.
  palette: { default: 232, min: 180, max: 420, rail: 48 },
  inspector: { default: 320, min: 260, max: 520, rail: 40 },
};

export type PanelKind = keyof typeof PANEL_LIMITS;

/** A width inside the panel's limits, rounded to whole pixels. */
export function clampPanelWidth(kind: PanelKind, width: number): number {
  const { min, max } = PANEL_LIMITS[kind];
  if (!Number.isFinite(width)) return PANEL_LIMITS[kind].default;
  return Math.round(Math.min(Math.max(width, min), max));
}

/**
 * A stored width made usable: anything that is not a finite number falls back to
 * the default, everything else is clamped. `null`, `"320"` and `NaN` are all
 * realistic contents of a settings blob and none of them is worth a broken
 * layout.
 */
export function panelWidth(kind: PanelKind, stored: unknown): number {
  return typeof stored === 'number' && Number.isFinite(stored)
    ? clampPanelWidth(kind, stored)
    : PANEL_LIMITS[kind].default;
}
