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
import { firstLayout, freePlace, POSTER_COLUMN_ID, POSTER_GAP, POSTER_WIDTH } from './posterLayout'
import type { PosterAreaSize, PosterBlock, PosterLayout } from './posterLayout'
import type { LaidOutSheet, SheetArea } from './sheet'

/** The height of a sheet of A paper at the poster's width. */
const PAPER_HEIGHT = 1315

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
}

function sizeOf(area: SheetArea, spans: PosterSheet['areaSpans']): PosterAreaSize {
  const span = spans?.[area.element.id]
  return {
    id: area.element.id,
    groupings: area.groupings.map((grouping) => grouping.capabilities.length),
    loose: area.capabilities.length,
    ...(span !== undefined ? { span } : {}),
  }
}

/** The first layout of this sheet: its own areas in its order, then the stand-ins together. */
export function posterFirstLayout(laidOut: LaidOutSheet, sheet: PosterSheet): PosterLayout {
  const own = laidOut.areas.filter((area) => area.element.ref === undefined)
  const standIns = laidOut.areas.filter((area) => area.element.ref !== undefined)
  const parties = laidOut.actors.filter((actor) => actor.group === 'parties')
  const steps = laidOut.journey?.lanes[0]?.cells.reduce((sum, cell) => sum + cell.steps.length, 0) ?? 0
  const rows = sheet.poster?.bandRows
  return firstLayout({
    areas: [...own, ...standIns].map((area) => sizeOf(area, sheet.areaSpans)),
    ...(laidOut.journey ? { band: { id: laidOut.journey.element.id, steps, lanes: laidOut.journey.lanes.length, ...(rows ? { rows } : {}) } } : {}),
    ...(parties.length > 0 ? { column: { groups: parties.filter((actor) => actor.depth === 0).length, rows: parties.filter((actor) => actor.depth > 0).length } } : {}),
    ...(sheet.poster?.tile ? { tile: sheet.poster.tile } : {}),
  })
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
    if (held) blocks.push({ id: block.id, x: held.x, y: held.y, width: held.width ?? block.width, height: held.height ?? block.height })
    else later.push(block)
  }
  const bottom = Math.max(0, ...blocks.map((block) => block.y + block.height))
  const height = sheet.paper !== undefined && sheet.paper !== 'wide' && sheet.paper !== 'fit' ? Math.max(PAPER_HEIGHT, bottom) : bottom
  const waiting: PosterBlock[] = []
  let shelf = height + POSTER_GAP
  for (const block of later) {
    const free = freePlace(blocks, block, { width: POSTER_WIDTH, height })
    if (free) {
      blocks.push({ ...block, ...free })
      continue
    }
    waiting.push({ ...block, x: block.id === POSTER_COLUMN_ID ? 0 : block.x, y: shelf })
    shelf += block.height + POSTER_GAP
  }
  return { width: POSTER_WIDTH, height, blocks, waiting, bandRows: first.bandRows, placed: true }
}
