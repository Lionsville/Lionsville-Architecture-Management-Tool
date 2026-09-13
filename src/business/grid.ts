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
import type { DesignDiagram, ElementId, SheetPaper } from '../model'

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

/** One area to place: how many columns it takes, and how tall it measured. */
export type PackItem = { id: ElementId; span: number; height: number }
/** Where one area landed: its first column, and its top in pixels. */
export type PackedArea = { id: ElementId; column: number; span: number; top: number }

/**
 * The areas packed under one another, not in rows.
 *
 * A CSS grid lays areas out in rows, and a row is as tall as its tallest
 * card: a narrow area with twelve capabilities beside a wide one with four
 * left the whole rest of that row empty. So the page keeps a skyline — how
 * far down each column is filled — and drops each area, in the sheet's own
 * order, at the lowest place its span fits, leftmost when two are level. A
 * tall narrow area on the left and wide ones stacked beside it is exactly
 * what falls out, and a small area lands in whatever hole is open.
 *
 * Heights are measured by the page and handed in; the answer is in pixels,
 * and `height` is the whole packed page's.
 */
export function packAreas(
  items: readonly PackItem[], columns: number, gap: number = AREA_COLUMN.gap,
): { placed: PackedArea[]; height: number } {
  const count = Math.max(1, Math.floor(columns))
  const skyline: number[] = new Array<number>(count).fill(0)
  const placed: PackedArea[] = []
  for (const item of items) {
    const span = Math.max(1, Math.min(item.span, count))
    let column = 0
    let top = Number.POSITIVE_INFINITY
    for (let at = 0; at + span <= count; at += 1) {
      const level = Math.max(...skyline.slice(at, at + span))
      if (level < top) { top = level; column = at }
    }
    placed.push({ id: item.id, column, span, top })
    const bottom = top + Math.max(0, item.height) + gap
    for (let at = column; at < column + span; at += 1) skyline[at] = bottom
  }
  return { placed, height: Math.max(0, Math.max(...skyline) - gap) }
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

/** What a sheet is laid out on when it does not say: a wall's worth, not a window's. */
export const DEFAULT_PAPER: SheetPaper = 'A2'

export function isPaperSize(value: unknown): value is PaperSize {
  return typeof value === 'string' && (PAPER_SIZES as readonly string[]).includes(value)
}

export function isSheetPaper(value: unknown): value is SheetPaper {
  return value === 'fit' || isPaperSize(value)
}

/**
 * The width a sheet lays itself out at, in CSS pixels — or nothing, for a
 * sheet that fits the window it is in. A value the sheet does not know is
 * read as the default rather than refused: a file hand-edited to say `B3`
 * still opens, as a page.
 */
export function sheetPaperWidth(sheet: Pick<DesignDiagram, 'paper'>): number | undefined {
  const paper = isSheetPaper(sheet.paper) ? sheet.paper : DEFAULT_PAPER
  return paper === 'fit' ? undefined : paperWidth(paper)
}
