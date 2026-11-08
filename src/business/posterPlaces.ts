// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a sheet's blocks are: what its geometry says, and the first layout for
 * whatever it does not (ADR-0048). The one answer a screen and an agent read.
 *
 * Over a sheet with no geometry this is the first layout, worked out each time, so
 * the sheet follows the model and opening one writes nothing. Once one block has
 * been placed every block has, and an area that came after lands in the first free
 * place on the page; with none it waits on a shelf under the page, and is said.
 */
import type { DesignDiagram, ElementId } from '../model'
import { contentHeightAt, firstLayout, freePlace, paperLayout, POSTER_COLUMN_ID, POSTER_GAP, POSTER_WIDTH } from './posterLayout'
import type { PosterAreaSize, PosterBlock, PosterLayout } from './posterLayout'
import type { LaidOutSheet, SheetArea, SheetCapability } from './sheet'

/** The height of a sheet of A paper at the poster's width. */
const PAPER_HEIGHT = 1315
const MIN_BLOCK = 40

export type PosterSheet = Partial<Pick<DesignDiagram, 'areaSpans' | 'poster' | 'paper' | 'geometry'>>

export type PosterPlaces = {
  width: number
  height: number
  /** Every block on the page, an area in its free place included. */
  blocks: PosterBlock[]
  /** The blocks with no room on the page, on a shelf under it. */
  waiting: PosterBlock[]
  bandRows: 1 | 2
  /** Whether anybody has placed anything, which is when it stops following the first layout. */
  placed: boolean
  /**
   * The geometry said places no poster has: blocks off the page's top or left
   * edge, or many spread so thin they cover a tenth of what they span. Such
   * places were kept by something other than this poster, and the first layout
   * is drawn instead until somebody places a block.
   */
  ignored?: true
}

/**
 * Below this share of the room they span, this many blocks or more were not
 * placed as a poster: a board's cards kept 1,700 apart cover a few per cent.
 * A person who pulls one or two blocks of a small sheet aside is far above it.
 */
const LEAST_FILL = 0.1
const SPREAD_FROM = 6

/** Whether places read as a poster's: on the page, and close enough together to be one. */
export function readsAsPoster(blocks: readonly PosterBlock[]): boolean {
  if (blocks.some((block) => block.x < 0 || block.y < 0)) return false
  if (blocks.length < SPREAD_FROM) return true
  const left = Math.min(...blocks.map((block) => block.x))
  const top = Math.min(...blocks.map((block) => block.y))
  const right = Math.max(...blocks.map((block) => block.x + block.width))
  const bottom = Math.max(...blocks.map((block) => block.y + block.height))
  const covered = blocks.reduce((sum, block) => sum + block.width * block.height, 0)
  return covered >= LEAST_FILL * (right - left) * (bottom - top)
}

/**
 * What takes a tile: a capability of its block. One under a capability has no
 * place of its own on a poster; its tile counts it, and it opens in the panel and
 * in Names.
 */
export function posterTiles(capabilities: readonly SheetCapability[]): { capability: SheetCapability; inside: number }[] {
  const tiles: { capability: SheetCapability; inside: number }[] = []
  for (const capability of capabilities) {
    const last = tiles[tiles.length - 1]
    if (capability.depth > 1 && last) last.inside += 1
    else tiles.push({ capability, inside: 0 })
  }
  return tiles
}

function sizeOf(area: SheetArea, spans: PosterSheet['areaSpans']): PosterAreaSize {
  const span = spans?.[area.element.id]
  return {
    id: area.element.id,
    groupings: area.groupings.map((grouping) => posterTiles(grouping.capabilities).length),
    loose: area.capabilities.length,
    ...(span !== undefined ? { span } : {}),
    ...(area.domain !== undefined || area.element.ref !== undefined ? { line: true } : {}),
  }
}

/** What the first layout is worked out from: its own areas in its order, then the stand-ins together. */
function layoutInput(laidOut: LaidOutSheet, sheet: PosterSheet): Parameters<typeof firstLayout>[0] {
  const own = laidOut.areas.filter((area) => area.element.ref === undefined)
  const standIns = laidOut.areas.filter((area) => area.element.ref !== undefined)
  const parties = laidOut.actors.filter((actor) => actor.group === 'parties')
  const steps = laidOut.journey?.lanes[0]?.cells.reduce((sum, cell) => sum + cell.steps.length, 0) ?? 0
  const rows = sheet.poster?.bandRows
  return {
    areas: [...own, ...standIns].map((area) => sizeOf(area, sheet.areaSpans)),
    ...(laidOut.journey ? { band: { id: laidOut.journey.element.id, steps, lanes: laidOut.journey.lanes.length, ...(rows ? { rows } : {}) } } : {}),
    ...(parties.length > 0 ? { column: { groups: parties.filter((actor) => actor.depth === 0).length, rows: parties.filter((actor) => actor.depth > 0).length } } : {}),
    ...(sheet.poster?.tile ? { tile: sheet.poster.tile } : {}),
  }
}

export function posterFirstLayout(laidOut: LaidOutSheet, sheet: PosterSheet): PosterLayout {
  return firstLayout(layoutInput(laidOut, sheet))
}

/** The first layout at paper's shape, for *Lay out for this paper*: places to write, since it follows no window. */
export function posterPaperLayout(laidOut: LaidOutSheet, sheet: PosterSheet): PosterLayout {
  return paperLayout(layoutInput(laidOut, sheet))
}

/** The least an area may be pulled to at this width: what its tiles come to. */
export function posterBlockFloor(laidOut: LaidOutSheet, sheet: PosterSheet, id: string, width: number): number {
  const area = laidOut.areas.find((one) => one.element.id === id)
  return area ? contentHeightAt(sizeOf(area, sheet.areaSpans), width, sheet.poster?.tile ?? 'm') : MIN_BLOCK
}

/** Whether a sheet says where anything is. */
export function isPlaced(sheet: PosterSheet): boolean {
  return (sheet.geometry?.nodes.length ?? 0) > 0 || (sheet.geometry?.groups?.length ?? 0) > 0
}

export function posterPlaces(laidOut: LaidOutSheet, sheet: PosterSheet): PosterPlaces {
  const first = posterFirstLayout(laidOut, sheet)
  if (!isPlaced(sheet)) return { width: first.width, height: first.height, blocks: first.blocks, waiting: [], bandRows: first.bandRows, placed: false }
  const said = new Map<ElementId, { x: number; y: number; width?: number; height?: number }>()
  for (const node of sheet.geometry?.nodes ?? []) said.set(node.id, node)
  for (const box of sheet.geometry?.groups ?? []) said.set(box.id, box)
  const blocks: PosterBlock[] = []
  const later: PosterBlock[] = []
  for (const block of first.blocks) {
    const held = said.get(block.id)
    if (held) {
      const width = held.width ?? block.width
      // A block that grew because a function was added overlaps quietly; it is never cut off.
      const area = laidOut.areas.find((one) => one.element.id === block.id)
      const least = area ? contentHeightAt(sizeOf(area, sheet.areaSpans), width, sheet.poster?.tile ?? 'm') : 0
      blocks.push({ id: block.id, x: held.x, y: held.y, width, height: Math.max(held.height ?? block.height, least) })
    }
    else later.push(block)
  }
  if (!readsAsPoster(blocks)) return { width: first.width, height: first.height, blocks: first.blocks, waiting: [], bandRows: first.bandRows, placed: false, ignored: true }
  const bottom = Math.max(0, ...blocks.map((block) => block.y + block.height))
  const right = Math.max(POSTER_WIDTH, ...blocks.map((block) => block.x + block.width))
  const height = sheet.paper !== undefined && sheet.paper !== 'wide' && sheet.paper !== 'fit' ? Math.max(PAPER_HEIGHT, bottom) : bottom
  const waiting: PosterBlock[] = []
  let shelf = height + POSTER_GAP
  for (const block of later) {
    const free = freePlace(blocks, block, { width: right, height })
    if (free) {
      blocks.push({ ...block, ...free })
      continue
    }
    waiting.push({ ...block, x: block.id === POSTER_COLUMN_ID ? 0 : block.x, y: shelf })
    shelf += block.height + POSTER_GAP
  }
  return { width: right, height, blocks, waiting, bandRows: first.bandRows, placed: true }
}
