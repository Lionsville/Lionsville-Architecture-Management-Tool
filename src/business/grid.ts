// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
 * The spans with one area's changed. A span a person set is kept even at one
 * column: on paper the fit widens what nobody has spoken for (`fitSpans`),
 * so *narrower* down to one has to leave a mark, or the area would grow
 * straight back. A sheet nobody touched still writes nothing.
 */
export function withSpan(
  spans: Record<ElementId, number> | undefined, id: ElementId, span: number,
): Record<ElementId, number> | undefined {
  const next = { ...spans, [id]: Math.max(1, Math.min(span, MAX_SPAN)) }
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
 * ISO 216 landscape, at 96 CSS pixels to the inch — the sheets of paper a
 * page is laid out on for a print. The long side is the width the grid is
 * fitted to; the short side is what the areas are asked to fit under
 * (`fitSpans`). The page still grows past it when the areas cannot be tiled
 * any flatter, because a business architecture is cut off by nothing but its
 * own last band — but it is the exception, not the shape of every sheet.
 */
export const PAPER_SIZES = ['A4', 'A3', 'A2', 'A1', 'A0'] as const
export type PaperSize = (typeof PAPER_SIZES)[number]

const LONG_SIDE_MM: Record<PaperSize, number> = { A4: 297, A3: 420, A2: 594, A1: 841, A0: 1189 }
const SHORT_SIDE_MM: Record<PaperSize, number> = { A4: 210, A3: 297, A2: 420, A1: 594, A0: 841 }

const px = (mm: number) => Math.round((mm / 25.4) * 96)

export function paperWidth(paper: PaperSize): number {
  return px(LONG_SIDE_MM[paper])
}

/** The short side: how tall the page should be, landscape. */
export function paperHeight(paper: PaperSize): number {
  return px(SHORT_SIDE_MM[paper])
}

/** The paper a width is the long side of, if it is one: a picture asked for at 3179 is an A1. */
export function paperOfWidth(width: number): PaperSize | undefined {
  return PAPER_SIZES.find((paper) => paperWidth(paper) === width)
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
 * The paper a sheet lays itself out on — or nothing, for a sheet that fits
 * the window it is in. A value the sheet does not know is read as the default
 * rather than refused: a file hand-edited to say `B3` still opens, as a page.
 */
export function sheetPaper(sheet: Pick<DesignDiagram, 'paper'>): PaperSize | undefined {
  const paper = isSheetPaper(sheet.paper) ? sheet.paper : DEFAULT_PAPER
  return paper === 'fit' ? undefined : paper
}

/** The width a sheet lays itself out at, in CSS pixels — or nothing, for the window's. */
export function sheetPaperWidth(sheet: Pick<DesignDiagram, 'paper'>): number | undefined {
  const paper = sheetPaper(sheet)
  return paper === undefined ? undefined : paperWidth(paper)
}

/**
 * The size of one area drawn, in CSS pixels — the design's own numbers, so
 * the fit below can be worked out before anything is on screen. A capability
 * card and the gap under it; a grouping's box around its rows; the area's
 * header, padding and the row of buttons at the foot. Close, not exact: the
 * page packs by what it measures, and these decide only how wide to make
 * each area first.
 */
const AREA_ESTIMATE = { row: 52, grouping: 60, base: 85 } as const

/** What an area holds, for the estimate: the capabilities in each of its boxes, and the loose ones. */
export type FitItem = {
  id: ElementId
  groupings: readonly number[]
  loose: number
  /** The span the sheet fixes, when it does; absent lets the fit choose. */
  fixed?: number
}

/** How tall an area comes out, roughly, at `span` columns: each box is its rows at that width. */
export function estimateAreaHeight(item: Pick<FitItem, 'groupings' | 'loose'>, span: number): number {
  const rows = (count: number) => Math.ceil(count / Math.max(1, span))
  const boxes = item.groupings.reduce((sum, count) => sum + AREA_ESTIMATE.grouping + rows(count) * AREA_ESTIMATE.row, 0)
  const loose = item.loose > 0 ? rows(item.loose) * AREA_ESTIMATE.row : 0
  return AREA_ESTIMATE.base + boxes + loose
}

/**
 * How many columns each area takes so the page comes out landscape: the
 * areas packed no taller than `target` where the width allows, and as flat
 * as it allows where it does not.
 *
 * A sheet of paper has two sides, and fixing only the width gave a real
 * organisation's fifteen areas of one column each, stacked three deep down
 * an A2 — a portrait page on a landscape sheet. Widening an area is the one
 * lever the layout has: its capabilities go side by side and it gets
 * shorter, and a tall column beside a short one becomes two of a height.
 * So the fit starts every area at one column and, while the packed page is
 * taller than the target, widens the one that brings the page down most,
 * one column at a time, until nothing does. What the areas hold is what
 * they hold, so the page can still come out taller than the paper — evenly
 * full rather than ragged, which is the flattest the width allows. Greedy
 * and estimated rather than measured, because the page measures what it has
 * drawn and this decides what to draw. An area the sheet fixes keeps its
 * span: a person's *wider* and *narrower* are the last word, and the fit
 * works around them.
 *
 * With no target the fit stops only when widening stops helping — as flat
 * as the width allows.
 */
export function fitSpans(
  items: readonly FitItem[], columns: number, target = 0,
): Record<ElementId, number> {
  const spans: Record<ElementId, number> = {}
  const widest = Math.max(1, Math.min(MAX_SPAN, columns))
  for (const item of items) {
    spans[item.id] = item.fixed !== undefined
      ? Math.max(1, Math.min(item.fixed, widest))
      : 1
  }
  // How a candidate scores: the page's height first, and then how ragged the
  // columns are under it — a step that leaves the tallest column alone but
  // levels the others is still a step towards a flatter page, and without
  // it the fit stalls on a plateau two columns high.
  const scoreOf = (candidate: Record<ElementId, number>): [number, number] => {
    const { placed, height } = packAreas(
      items.map((item) => ({
        id: item.id, span: candidate[item.id] ?? 1, height: estimateAreaHeight(item, candidate[item.id] ?? 1),
      })),
      columns,
    )
    const bottoms = new Array<number>(columns).fill(0)
    for (const at of placed) {
      const item = items.find((held) => held.id === at.id)
      const bottom = at.top + (item ? estimateAreaHeight(item, at.span) : 0)
      for (let column = at.column; column < at.column + at.span; column += 1) {
        bottoms[column] = Math.max(bottoms[column] ?? 0, bottom)
      }
    }
    return [height, bottoms.reduce((sum, bottom) => sum + bottom, 0)]
  }
  const better = (a: [number, number], b: [number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])

  let score = scoreOf(spans)
  // Every area may grow to `widest`, so this many steps at most.
  for (let step = 0; step < items.length * widest && score[0] > target; step += 1) {
    let best: { id: ElementId; score: [number, number] } | undefined
    for (const item of items) {
      if (item.fixed !== undefined || spans[item.id] >= widest) continue
      const tried = scoreOf({ ...spans, [item.id]: spans[item.id] + 1 })
      if (better(tried, score) && (best === undefined || better(tried, best.score))) best = { id: item.id, score: tried }
    }
    if (!best) break
    spans[best.id] += 1
    score = best.score
  }
  return spans
}
