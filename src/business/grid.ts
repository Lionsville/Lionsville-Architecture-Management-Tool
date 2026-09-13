/**
 * The sheet's grid: how many columns fit, how many an area takes, and how
 * wide a sheet of paper is.
 *
 * The areas used to be three columns, always. An enterprise architect with
 * eleven areas of very different sizes wants Commerce across two columns with
 * its capabilities side by side and Strategy in one, and a page laid out for
 * an A1 print wants more columns than a laptop shows. So a sheet now has a
 * column count — fitted to the width it is drawn at, or fixed on the sheet —
 * and an area a span (`DesignDiagram.areaSpans`); the browser packs the areas
 * densely in the sheet's own order, which is the priority. All of it is
 * arithmetic, so it is here rather than in the page, and tested in node.
 */
import type { DesignDiagram, ElementId } from '../model'

/** The narrowest an area column is drawn, and the gap between two. */
export const AREA_COLUMN = { min: 300, gap: 12 } as const

/** The widest an area may be told to be, in columns. */
export const MAX_SPAN = 4

/** How many columns of at least `min` fit in `width`, with `gap` between them. Never fewer than one. */
export function columnsFor(width: number, column: { min: number; gap: number } = AREA_COLUMN): number {
  if (!Number.isFinite(width) || width <= 0) return 1
  return Math.max(1, Math.floor((width + column.gap) / (column.min + column.gap)))
}

/**
 * The columns a sheet is laid out in: what it fixes, or what fits in `width`.
 * A fixed count that is not a positive whole number is treated as unset.
 */
export function sheetColumns(sheet: Pick<DesignDiagram, 'columns'>, width: number): number {
  const fixed = sheet.columns
  if (fixed !== undefined && Number.isInteger(fixed) && fixed >= 1) return fixed
  return columnsFor(width)
}

/**
 * How many columns an area takes, clamped to the grid: a span wider than the
 * grid would make the browser add columns nobody asked for.
 */
export function spanOf(
  sheet: Pick<DesignDiagram, 'areaSpans'>, id: ElementId, columns: number,
): number {
  const asked = sheet.areaSpans?.[id]
  const span = asked !== undefined && Number.isInteger(asked) && asked >= 1 ? asked : 1
  return Math.max(1, Math.min(span, MAX_SPAN, columns))
}

/**
 * The spans with one area's changed — and absent when every area is back to
 * one column, so a sheet nobody widened writes nothing about it.
 */
export function withSpan(
  spans: Record<ElementId, number> | undefined, id: ElementId, span: number,
): Record<ElementId, number> | undefined {
  const next = { ...spans }
  if (span <= 1) delete next[id]
  else next[id] = Math.min(span, MAX_SPAN)
  return Object.keys(next).length ? next : undefined
}

/**
 * ISO 216 landscape, at 96 CSS pixels to the inch — the widths a sheet is laid
 * out at for a print. The width is what the grid is fitted to; the height is
 * whatever the page needs, because a business architecture is cut off by
 * nothing but its own last band.
 */
export const PAPER_SIZES = ['A4', 'A3', 'A2', 'A1', 'A0'] as const
export type PaperSize = (typeof PAPER_SIZES)[number]

const LONG_SIDE_MM: Record<PaperSize, number> = { A4: 297, A3: 420, A2: 594, A1: 841, A0: 1189 }

export function paperWidth(paper: PaperSize): number {
  return Math.round((LONG_SIDE_MM[paper] / 25.4) * 96)
}
