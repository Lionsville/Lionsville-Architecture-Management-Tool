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

import { SHEET_COLUMN_BOX } from '../model/normalised'

export const POSTER_WIDTH = 1860
export const POSTER_TILE = { width: 110, minWidth: 98, height: 46, gap: 6 } as const
export const POSTER_GAP = 10

const COLUMN_WIDTH = 176
const COLUMN_GAP = 12
const BAND_ROW = 112
const LANE = 40
/** Padding, title bar, meter and border. */
const AREA_FRAME = 16 + 26 + 2 + 2
const AREA_LINE = 16
const GROUPING_HEAD = 18
const GROUPING_FRAME = 5 + 2
const COLUMN_FRAME = 10
const COLUMN_HEAD = 17 + 2 + 3
const COLUMN_ROW = 29 + 3
/** How wide a step has to be for whole words at the size that reads at 90%. */
const ROOMY_STEP = 98
const PLACE_GRID = 8
const NAME_LINES = 3
const NAME_PADDING = 14
const NAME_LETTER = 6.6

export type PosterAreaSize = {
  id: string
  /** How many tiles each grouping holds. */
  groupings: readonly number[]
  /** The tiles straight in the area, drawn after the groupings. */
  loose: number
  /** The area's own span in tile columns, where the sheet says one. */
  span?: number
  /** A line under the title: it is handed to a domain, or a stand-in saying where it is kept. */
  line?: boolean
}

export type PosterBand = { id: string; steps: number; lanes: number; rows?: 1 | 2 }
export type PosterColumn = { groups: number; rows: number }
export type PosterBlock = { id: string; x: number; y: number; width: number; height: number }

/** The blocks' own names beside the areas', which are element ids. */
export const POSTER_COLUMN_ID = SHEET_COLUMN_BOX

/** A tile per poster: its width a minimum in a flowing grid, its height never changing. */
export type PosterTileSize = 's' | 'm' | 'l'
export const POSTER_TILES: Readonly<Record<PosterTileSize, { width: number; minWidth: number; height: number }>> = {
  s: { width: 92, minWidth: 80, height: 40 },
  m: { width: POSTER_TILE.width, minWidth: POSTER_TILE.minWidth, height: POSTER_TILE.height },
  l: { width: 128, minWidth: 116, height: 54 },
}
const TILES = POSTER_TILES

const rowsOf = (tiles: number, cols: number) => Math.ceil(tiles / cols)
const tilesHeight = (tiles: number, cols: number, size: PosterTileSize) => rowsOf(tiles, cols) * (TILES[size].height + POSTER_TILE.gap) - POSTER_TILE.gap

/** Nearly square, wider than tall. */
export function tileColumns(tiles: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(tiles * 1.6)))
}

function isGrouped(area: PosterAreaSize): boolean {
  return area.groupings.length > 0
}

/** The height of an area: every tile's row, and nothing a browser has to be asked. */
export function contentHeight(area: PosterAreaSize, size: PosterTileSize = 'm'): number {
  if (!isGrouped(area)) {
    const tiles = Math.max(area.loose, 1)
    return tilesHeight(tiles, area.span ?? tileColumns(tiles), size) + AREA_FRAME + (area.line ? AREA_LINE : 0)
  }
  const groupings = area.groupings.map((tiles) => tilesHeight(Math.max(tiles, 1), tileColumns(Math.max(tiles, 1)), size) + GROUPING_HEAD + GROUPING_FRAME)
  const loose = area.loose > 0 ? [tilesHeight(area.loose, tileColumns(area.loose), size)] : []
  return Math.max(...groupings, ...loose) + AREA_FRAME + (area.line ? AREA_LINE : 0)
}

/** The narrowest an area is drawn: its tiles in their columns, or its groupings side by side. */
export function minWidth(area: PosterAreaSize, size: PosterTileSize = 'm'): number {
  const step = TILES[size].width + POSTER_TILE.gap
  if (!isGrouped(area)) {
    const tiles = Math.max(area.loose, 1)
    return (area.span ?? tileColumns(tiles)) * step - POSTER_TILE.gap + 16
  }
  const groupings = area.groupings.map((tiles) => tileColumns(Math.max(tiles, 1)) * step + 12)
  const loose = area.loose > 0 ? [tileColumns(area.loose) * step] : []
  return [...groupings, ...loose].reduce((sum, width) => sum + width + POSTER_TILE.gap, 16 - POSTER_TILE.gap)
}

/**
 * How tall an area must be at this width: what its tiles come to when the block has
 * been pulled wider or narrower, its groupings wrapping as the browser wraps them.
 */
export function contentHeightAt(area: PosterAreaSize, width: number, size: PosterTileSize = 'm'): number {
  const inner = width - 2 - 16
  const line = area.line ? AREA_LINE : 0
  if (!isGrouped(area)) {
    const tiles = Math.max(area.loose, 1)
    return tilesHeight(tiles, flowColumns(inner, size), size) + AREA_FRAME + line
  }
  const pitch = TILES[size].minWidth + POSTER_TILE.gap
  const parts = [
    ...area.groupings.map((count) => ({ tiles: Math.max(count, 1), framed: true })),
    ...(area.loose > 0 ? [{ tiles: area.loose, framed: false }] : []),
  ].map((part) => ({ ...part, cols: tileColumns(part.tiles), basis: tileColumns(part.tiles) * pitch + POSTER_TILE.gap }))
  let total = 0
  let row: typeof parts = []
  let used = 0
  const close = () => {
    if (row.length === 0) return
    const weight = row.reduce((sum, part) => sum + part.cols, 0)
    const spare = Math.max(0, inner - used)
    total += (total > 0 ? POSTER_TILE.gap : 0) + Math.max(...row.map((part) => {
      const wide = Math.min(inner, part.basis + (spare * part.cols) / weight)
      if (!part.framed) return tilesHeight(part.tiles, flowColumns(wide, size), size)
      return tilesHeight(part.tiles, flowColumns(wide - GROUPING_FRAME - 5, size), size) + GROUPING_HEAD + GROUPING_FRAME
    }))
    row = []
    used = 0
  }
  for (const part of parts) {
    if (row.length > 0 && used + POSTER_TILE.gap + part.basis > inner) close()
    used += (row.length > 0 ? POSTER_TILE.gap : 0) + part.basis
    row.push(part)
  }
  close()
  return total + AREA_FRAME + line
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
function shelves(areas: readonly PosterAreaSize[], x: number, y: number, width: number, size: PosterTileSize): { blocks: PosterBlock[]; bottom: number } {
  const blocks: PosterBlock[] = []
  let top = y
  let shelf: PosterAreaSize[] = []
  let used = 0
  const close = () => {
    if (shelf.length === 0) return
    const room = width - POSTER_GAP * (shelf.length - 1)
    const least = shelf.map((area) => Math.min(minWidth(area, size), room))
    const total = least.reduce((sum, one) => sum + one, 0)
    const height = Math.max(...shelf.map((area) => contentHeight(area, size)))
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
    const least = minWidth(area, size)
    if (shelf.length > 0 && used + POSTER_GAP + least > width) close()
    used += (shelf.length > 0 ? POSTER_GAP : 0) + least
    shelf.push(area)
  }
  close()
  return { blocks, bottom: top - POSTER_GAP }
}

export type PosterLayout = { width: number; height: number; blocks: PosterBlock[]; bandRows: 1 | 2 }

/** The whole page. Same inputs, same answer, in the browser and on a server. */
export function firstLayout(input: { areas: readonly PosterAreaSize[]; band?: PosterBand; column?: PosterColumn; tile?: PosterTileSize; pageWidth?: number }): PosterLayout {
  const { areas, band, column, tile = 'm', pageWidth = POSTER_WIDTH } = input
  const left = column ? COLUMN_WIDTH + COLUMN_GAP : 0
  const width = pageWidth - left
  const bandRows = band ? band.rows ?? bandRowsFor(band.steps, width) : 1
  const blocks: PosterBlock[] = []
  let y = 0
  if (band) {
    const height = bandHeight(band.lanes, bandRows)
    blocks.push({ id: band.id, x: left, y: 0, width, height })
    y = height + POSTER_GAP
  }
  const shelved = shelves(areas, left, y, width, tile)
  blocks.push(...shelved.blocks)
  const down = Math.max(shelved.bottom, y)
  const asked = column ? COLUMN_FRAME + column.groups * COLUMN_HEAD + column.rows * COLUMN_ROW : 0
  const height = Math.max(down, asked)
  if (column) blocks.push({ id: POSTER_COLUMN_ID, x: 0, y: 0, width: COLUMN_WIDTH, height })
  return { width: pageWidth, height, blocks, bandRows }
}

/** ISO paper's long side over its short side. */
const PAPER_RATIO = 1.41
const PAPER_STEP = 120

/**
 * The first layout for a poster meant only for print: a page as wide as it must be
 * to come out at paper's shape or flatter, and its rows then pulled taller until it
 * is that shape. Never narrower than the wide page, so the sizes a person reads stay
 * what they are; a page with few tiles gains height, one with many gains width.
 */
export function paperLayout(input: Parameters<typeof firstLayout>[0]): PosterLayout {
  let layout = firstLayout(input)
  while (layout.height * PAPER_RATIO > layout.width) {
    layout = firstLayout({ ...input, pageWidth: layout.width + PAPER_STEP })
  }
  const wanted = Math.round(layout.width / PAPER_RATIO)
  const bandId = input.band?.id
  const rows = [...new Set(layout.blocks.filter((block) => block.id !== POSTER_COLUMN_ID && block.id !== bandId).map((block) => block.y))].sort((a, b) => a - b)
  const spare = wanted - layout.height
  if (rows.length === 0 || spare <= 0) return layout
  const more = Math.floor(spare / rows.length)
  const blocks = layout.blocks.map((block) => {
    if (block.id === POSTER_COLUMN_ID) return { ...block, height: wanted }
    if (block.id === bandId) return block
    const at = rows.indexOf(block.y)
    return { ...block, y: block.y + at * more, height: block.height + more }
  })
  return { ...layout, height: wanted, blocks }
}

/** The order a person reads a page in, top then left, never the order things were placed in. */
export function readingOrder<T extends { x: number; y: number }>(blocks: readonly T[]): T[] {
  return [...blocks].sort((a, b) => a.y - b.y || a.x - b.x)
}

const crossing = (a: PosterBlock, b: PosterBlock) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/** Which blocks lie over one another. Said, and never fixed: a place is a person's, and growth is theirs to answer. */
export function overlapsOf(blocks: readonly PosterBlock[]): { a: string; b: string }[] {
  const found: { a: string; b: string }[] = []
  blocks.forEach((one, at) => {
    for (const other of blocks.slice(at + 1)) if (crossing(one, other)) found.push({ a: one.id, b: other.id })
  })
  return found
}

/**
 * The first free place on the page for a block of this size, top then left, on
 * the eight-unit grid and a gap clear of what is there; nothing when the page has
 * no such room. What an area added to a placed sheet gets until somebody places it.
 */
export function freePlace(blocks: readonly PosterBlock[], size: { width: number; height: number }, page: { width: number; height: number }): { x: number; y: number } | undefined {
  const snap = (value: number) => Math.ceil(value / PLACE_GRID) * PLACE_GRID
  const xs = [...new Set([0, ...blocks.map((block) => snap(block.x + block.width + POSTER_GAP))])].sort((a, b) => a - b)
  const ys = [...new Set([0, ...blocks.map((block) => snap(block.y + block.height + POSTER_GAP))])].sort((a, b) => a - b)
  for (const y of ys) {
    for (const x of xs) {
      if (x + size.width > page.width || y + size.height > page.height) continue
      const here = { id: '', x: x - POSTER_GAP, y: y - POSTER_GAP, width: size.width + POSTER_GAP * 2, height: size.height + POSTER_GAP * 2 }
      if (!blocks.some((block) => crossing(here, block))) return { x, y }
    }
  }
  return undefined
}

/** Where a block's tiles go: those placed by hand, then the rest flowing through what is left, in their order. */
export function tileCells(
  ids: readonly string[], cols: number, placed: Readonly<Record<string, { col: number; row: number; span?: number }>>,
): { id: string; col: number; row: number; span: number }[] {
  const taken = new Set<string>()
  const cell = (col: number, row: number) => `${col}:${row}`
  const cells: { id: string; col: number; row: number; span: number }[] = []
  for (const id of ids) {
    const hand = placed[id]
    if (!hand) continue
    // A cell kept from a wider block comes back to its edge rather than off it.
    const span = Math.min(Math.max(hand.span ?? 1, 1), cols)
    const col = Math.min(hand.col, cols - span)
    for (let at = col; at < col + span; at += 1) taken.add(cell(at, hand.row))
    cells.push({ id, col, row: hand.row, span })
  }
  let col = 0
  let row = 0
  for (const id of ids) {
    if (placed[id]) continue
    while (taken.has(cell(col, row))) {
      col += 1
      if (col >= cols) { col = 0; row += 1 }
    }
    taken.add(cell(col, row))
    cells.push({ id, col, row, span: 1 })
  }
  return cells
}

/** How many tile columns a flow of this width holds: what `repeat(auto-fill, minmax(…))` makes of it. */
export function flowColumns(width: number, size: PosterTileSize = 'm'): number {
  return Math.max(1, Math.floor((width + POSTER_TILE.gap) / (TILES[size].minWidth + POSTER_TILE.gap)))
}

/**
 * Whether a tile's clamp cuts this name, as near as arithmetic knows: the words
 * of a name are measured by a browser, and this is the same count from the width
 * of an average letter. For a report to an agent with no screen; a print counts
 * the real ones.
 */
export function nameLikelyCut(name: string, tileWidth: number, lines = NAME_LINES): boolean {
  const perLine = Math.max(1, Math.floor((tileWidth - NAME_PADDING) / NAME_LETTER))
  return Math.ceil(name.trim().length / perLine) > lines
}
