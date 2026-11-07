// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the blocks of a sheet's poster go when nobody has placed them: arithmetic
 * on fixed sizes, with no DOM and no tree, so a browser and a server get one answer.
 *
 * Sizes are in units, CSS pixels at 100%, and depend on nothing but the sheet: not
 * on the window, and not on what a browser's layout makes of a name, since a tile's
 * height is fixed and its name clamped. That is what lets an agent place a block
 * with no screen and have it land where a person sees it.
 *
 * Shelves rather than a skyline: blocks in sheet order fill a row, then widen to fill
 * it and stand as tall as its tallest, which gives aligned rows. It never writes.
 */

export const POSTER_WIDTH = 1860
export const POSTER_TILE = { width: 110, minWidth: 98, height: 46, gap: 6 } as const
export const POSTER_GAP = 10

const COLUMN_WIDTH = 176
const COLUMN_GAP = 12
const BAND_ROW = 112
const LANE = 40
/** Padding, title bar, meter and border. */
const AREA_FRAME = 16 + 26 + 2 + 2
const GROUPING_HEAD = 18
const GROUPING_FRAME = 5 + 2
const COLUMN_FRAME = 10
const COLUMN_HEAD = 17 + 2 + 3
const COLUMN_ROW = 29 + 3
/** How wide a step has to be for whole words at the size that reads at 90%. */
const ROOMY_STEP = 98

export type PosterAreaSize = {
  id: string
  /** How many tiles each grouping holds. */
  groupings: readonly number[]
  /** The tiles straight in the area, drawn after the groupings. */
  loose: number
  /** The area's own span in tile columns, where the sheet says one. */
  span?: number
}

export type PosterBand = { id: string; steps: number; lanes: number; rows?: 1 | 2 }
export type PosterColumn = { groups: number; rows: number }
export type PosterBlock = { id: string; x: number; y: number; width: number; height: number }

/** The blocks' own names beside the areas', which are element ids. */
export const POSTER_COLUMN_ID = 'rail'

const rowsOf = (tiles: number, cols: number) => Math.ceil(tiles / cols)
const tilesHeight = (tiles: number, cols: number) => rowsOf(tiles, cols) * (POSTER_TILE.height + POSTER_TILE.gap) - POSTER_TILE.gap

/** Nearly square, wider than tall. */
export function tileColumns(tiles: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(tiles * 1.6)))
}

function isGrouped(area: PosterAreaSize): boolean {
  return area.groupings.length > 0
}

/** The height of an area: every tile's row, and nothing a browser has to be asked. */
export function contentHeight(area: PosterAreaSize): number {
  if (!isGrouped(area)) {
    const tiles = Math.max(area.loose, 1)
    return tilesHeight(tiles, area.span ?? tileColumns(tiles)) + AREA_FRAME
  }
  const groupings = area.groupings.map((tiles) => tilesHeight(Math.max(tiles, 1), tileColumns(Math.max(tiles, 1))) + GROUPING_HEAD + GROUPING_FRAME)
  const loose = area.loose > 0 ? [tilesHeight(area.loose, tileColumns(area.loose))] : []
  return Math.max(...groupings, ...loose) + AREA_FRAME
}

/** The narrowest an area is drawn: its tiles in their columns, or its groupings side by side. */
export function minWidth(area: PosterAreaSize): number {
  const step = POSTER_TILE.width + POSTER_TILE.gap
  if (!isGrouped(area)) {
    const tiles = Math.max(area.loose, 1)
    return (area.span ?? tileColumns(tiles)) * step - POSTER_TILE.gap + 16
  }
  const groupings = area.groupings.map((tiles) => tileColumns(Math.max(tiles, 1)) * step + 12)
  const loose = area.loose > 0 ? [tileColumns(area.loose) * step] : []
  return [...groupings, ...loose].reduce((sum, width) => sum + width + POSTER_TILE.gap, 16 - POSTER_TILE.gap)
}

/**
 * How many rows a journey gets when nobody has said. Readable text and whole words
 * beat one journey line: a second row when a step on one row would be too narrow for
 * the size that reads at 90%. A person may still set one row by hand.
 */
export function bandRowsFor(steps: number, width: number): 1 | 2 {
  return steps > 0 && width / steps < ROOMY_STEP ? 2 : 1
}

/** Whether a step on this band is wide enough for the larger size. */
export function bandStepRoomy(steps: number, width: number, rows: 1 | 2): boolean {
  return steps > 0 && (width * rows) / steps >= ROOMY_STEP
}

export function bandHeight(lanes: number, rows: 1 | 2): number {
  return rows * (BAND_ROW + Math.max(0, lanes - 1) * LANE)
}

/** Shelves of blocks: filled in sheet order, widened to fill, as tall as the tallest. */
function shelves(areas: readonly PosterAreaSize[], x: number, y: number, width: number): { blocks: PosterBlock[]; bottom: number } {
  const blocks: PosterBlock[] = []
  let top = y
  let shelf: PosterAreaSize[] = []
  let used = 0
  const close = () => {
    if (shelf.length === 0) return
    const room = width - POSTER_GAP * (shelf.length - 1)
    const least = shelf.map((area) => Math.min(minWidth(area), room))
    const total = least.reduce((sum, one) => sum + one, 0)
    const height = Math.max(...shelf.map(contentHeight))
    let left = x
    shelf.forEach((area, index) => {
      // The last takes what rounding left, so the right edge is the page's.
      const wide = index === shelf.length - 1 ? x + width - left : Math.round(((least[index] ?? 0) / total) * room)
      blocks.push({ id: area.id, x: left, y: top, width: wide, height })
      left += wide + POSTER_GAP
    })
    top += height + POSTER_GAP
    shelf = []
    used = 0
  }
  for (const area of areas) {
    const least = minWidth(area)
    if (shelf.length > 0 && used + POSTER_GAP + least > width) close()
    used += (shelf.length > 0 ? POSTER_GAP : 0) + least
    shelf.push(area)
  }
  close()
  return { blocks, bottom: top - POSTER_GAP }
}

export type PosterLayout = { width: number; height: number; blocks: PosterBlock[]; bandRows: 1 | 2 }

/** The whole page. Same inputs, same answer, in the browser and on a server. */
export function firstLayout(input: { areas: readonly PosterAreaSize[]; band?: PosterBand; column?: PosterColumn }): PosterLayout {
  const { areas, band, column } = input
  const left = column ? COLUMN_WIDTH + COLUMN_GAP : 0
  const width = POSTER_WIDTH - left
  const bandRows = band ? band.rows ?? bandRowsFor(band.steps, width) : 1
  const blocks: PosterBlock[] = []
  let y = 0
  if (band) {
    const height = bandHeight(band.lanes, bandRows)
    blocks.push({ id: band.id, x: left, y: 0, width, height })
    y = height + POSTER_GAP
  }
  const shelved = shelves(areas, left, y, width)
  blocks.push(...shelved.blocks)
  const down = Math.max(shelved.bottom, y)
  const asked = column ? COLUMN_FRAME + column.groups * COLUMN_HEAD + column.rows * COLUMN_ROW : 0
  const height = Math.max(down, asked)
  if (column) blocks.push({ id: POSTER_COLUMN_ID, x: 0, y: 0, width: COLUMN_WIDTH, height })
  return { width: POSTER_WIDTH, height, blocks, bandRows }
}

/** The order a person reads a page in, top then left, never the order things were placed in. */
export function readingOrder<T extends { x: number; y: number }>(blocks: readonly T[]): T[] {
  return [...blocks].sort((a, b) => a.y - b.y || a.x - b.x)
}
