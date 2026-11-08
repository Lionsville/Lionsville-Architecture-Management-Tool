// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { DesignDiagram, DesignElement } from '../model'
import { overlapsOf, POSTER_COLUMN_ID, POSTER_WIDTH } from './posterLayout'
import { freeCorner, isPlaced, posterFirstLayout, posterPlaces, posterTiles, readsAsPoster } from './posterPlaces'
import { sheetPage } from './sheet'
import { denseSheet, DENSE_SHEET } from './testFixtures'

const el = (id: string, over: Partial<DesignElement>): DesignElement => ({ id, name: id, kind: 'function', lifecycle: 'live', isManaged: true, aspects: {}, ...over })

const elements: DesignElement[] = [
  el('journey', { kind: 'step' }),
  el('phase', { kind: 'step', parentId: 'journey' }),
  el('step', { kind: 'step', parentId: 'phase' }),
  el('party', { kind: 'actor' }),
  el('customer', { kind: 'actor', parentId: 'party' }),
  el('sales', {}),
  el('s1', { parentId: 'sales' }),
  el('s2', { parentId: 'sales' }),
  el('fleet', {}),
  el('f1', { parentId: 'fleet' }),
  el('borrowed', { ref: 'above' }),
  el('b1', { parentId: 'borrowed' }),
  el('later', {}),
  el('l1', { parentId: 'later' }),
]

const sheet = (over: Partial<DesignDiagram> = {}): DesignDiagram => ({ id: 's', kind: 'sheet', name: 'Sheet', members: [], journeyId: 'journey', areas: ['borrowed', 'sales', 'fleet', 'later'], geometry: { nodes: [] }, ...over })
const pageOf = (diagram: DesignDiagram) => sheetPage({ elements, relations: [] }, diagram, [], {})

describe('a sheet nobody placed', () => {
  it('is its first layout, each time, and says it is not placed', () => {
    const diagram = sheet()
    const places = posterPlaces(pageOf(diagram), diagram)
    expect(places.placed).toBe(false)
    expect(isPlaced(diagram)).toBe(false)
    expect(places.blocks).toEqual(posterFirstLayout(pageOf(diagram), diagram).blocks)
    expect(places.waiting).toEqual([])
    expect(overlapsOf(places.blocks)).toEqual([])
  })

  it('keeps the stand-ins together after its own areas', () => {
    const diagram = sheet()
    const areas = posterFirstLayout(pageOf(diagram), diagram).blocks.filter((block) => ['borrowed', 'sales', 'fleet', 'later'].includes(block.id))
    expect(areas.map((block) => block.id)).toEqual(['sales', 'fleet', 'later', 'borrowed'])
  })

  it('reads the poster\'s tile size and a band set by hand', () => {
    const roomy = sheet({ poster: { bandRows: 2 } })
    expect(posterPlaces(pageOf(roomy), roomy).bandRows).toBe(2)
    expect(posterPlaces(pageOf(sheet()), sheet()).bandRows).toBe(1)
    const large = sheet({ poster: { tile: 'l' } })
    expect(posterPlaces(pageOf(large), large).height).toBeGreaterThan(posterPlaces(pageOf(sheet()), sheet()).height)
  })
})

describe('a placed sheet', () => {
  const placed = (over: Partial<DesignDiagram> = {}) => {
    const first = posterFirstLayout(pageOf(sheet()), sheet()).blocks
    const nodes = first.filter((block) => block.id !== 'later' && block.id !== POSTER_COLUMN_ID)
    const rail = first.find((block) => block.id === POSTER_COLUMN_ID)!
    return sheet({ ...over, geometry: { nodes, groups: [rail], ...over.geometry } })
  }

  it('draws what it says, whatever the first layout would, and takes no reading of the paper', () => {
    const base = placed()
    const moved = { ...base, geometry: { ...base.geometry!, nodes: base.geometry!.nodes.map((node) => (node.id === 'sales' ? { ...node, x: 900, y: 700 } : node)) } }
    const places = posterPlaces(pageOf(moved), moved)
    expect(places.placed).toBe(true)
    expect(places.blocks.find((block) => block.id === 'sales')).toMatchObject({ x: 900, y: 700 })
  })

  it('takes a node with no size at the size the first layout gives', () => {
    const base = placed()
    const moved = { ...base, geometry: { ...base.geometry!, nodes: [{ id: 'sales', x: 5, y: 6 }] } }
    const first = posterFirstLayout(pageOf(sheet()), sheet()).blocks.find((block) => block.id === 'sales')!
    expect(posterPlaces(pageOf(moved), moved).blocks.find((block) => block.id === 'sales')).toEqual({ ...first, x: 5, y: 6 })
  })

  it('ignores a place for what the page no longer draws', () => {
    const base = placed()
    const stale = { ...base, geometry: { ...base.geometry!, nodes: [...base.geometry!.nodes, { id: 'nobody', x: 1, y: 1, width: 9, height: 9 }] } }
    expect(posterPlaces(pageOf(stale), stale).blocks.map((block) => block.id)).not.toContain('nobody')
  })

  it('gives an area that came later the first free place on an A paper page', () => {
    const later = placed({ paper: 'A2' })
    const places = posterPlaces(pageOf(later), later)
    const block = places.blocks.find((one) => one.id === 'later')!
    expect(block.y + block.height).toBeLessThanOrEqual(places.height)
    expect(places.waiting).toEqual([])
    expect(overlapsOf(places.blocks)).toEqual([])
  })

  it('leaves it waiting under the page when there is no room, and says so', () => {
    const full = sheet({
      paper: 'A2',
      geometry: { nodes: [{ id: 'sales', x: 0, y: 0, width: POSTER_WIDTH, height: 1315 }] },
    })
    const places = posterPlaces(pageOf(full), full)
    expect(places.waiting.map((block) => block.id)).toEqual(expect.arrayContaining(['fleet', 'later', 'borrowed']))
    expect(places.blocks.map((block) => block.id)).toEqual(['sales'])
    for (const block of places.waiting) expect(block.y).toBeGreaterThanOrEqual(places.height)
    expect(overlapsOf(places.waiting)).toEqual([])
  })
})

describe('places kept by something other than a poster', () => {
  const dense = denseSheet()
  const areas = dense.filter((one) => !one.parentId).map((one) => one.id)
  const denseDiagram = (nodes: { id: string; x: number; y: number }[] = []): DesignDiagram => ({ id: 'd', kind: 'sheet', name: 'Dense', members: [], areas, geometry: { nodes } })
  const densePage = (diagram: DesignDiagram) => sheetPage({ elements: dense, relations: [] }, diagram, [], {})

  it('are not drawn: a dense sheet whose blocks sit off the page and far apart opens at its first layout', () => {
    expect(dense).toHaveLength(DENSE_SHEET.elements)
    expect(areas).toHaveLength(DENSE_SHEET.areas)
    // As a board of cards would have kept them: a column off the left edge, 1,700 apart.
    const stale = denseDiagram(areas.map((id, at) => ({ id, x: -280 + (at % 2) * 1700, y: Math.floor(at / 2) * 1700 })))
    const places = posterPlaces(densePage(stale), stale)
    expect(places).toMatchObject({ placed: false, ignored: true, waiting: [] })
    expect(places.blocks).toEqual(posterFirstLayout(densePage(stale), stale).blocks)
    expect(Math.min(...places.blocks.map((block) => block.x))).toBe(0)
    expect(places.height).toBeLessThan(2 * POSTER_WIDTH)
  })

  it('are told apart from a poster placed by hand, which is drawn as it is', () => {
    const first = posterFirstLayout(densePage(denseDiagram()), denseDiagram()).blocks
    expect(readsAsPoster(first)).toBe(true)
    expect(readsAsPoster(first.map((block, at) => (at === 0 ? { ...block, x: -8 } : block)))).toBe(false)
    expect(readsAsPoster(first.map((block, at) => ({ ...block, y: block.y + at * 1700 })))).toBe(false)
    // One block pulled well away from the rest is still a poster.
    expect(readsAsPoster(first.map((block, at) => (at === 1 ? { ...block, x: 2400 } : block)))).toBe(true)
    const kept = denseDiagram(first.map(({ id, x, y }) => ({ id, x, y: y + 40 })))
    expect(posterPlaces(densePage(kept), kept)).toMatchObject({ placed: true })
  })
})

describe('what takes a tile', () => {
  const cap = (id: string, depth: number) => ({ element: el(id, {}), depth, coverage: { supportedBy: [], assignedTo: [], coverage: 'uncovered' as const } })
  it('is a capability of its block, and one under it is counted on it rather than placed', () => {
    const tiles = posterTiles([cap('a', 1), cap('a1', 2), cap('a2', 3), cap('b', 1)])
    expect(tiles.map((tile) => [tile.capability.element.id, tile.inside])).toEqual([['a', 2], ['b', 0]])
  })
})

describe('where an area may be dropped', () => {
  const blocks = [
    { id: POSTER_COLUMN_ID, x: 0, y: 0, width: 180, height: 900 },
    { id: 'journey', x: 190, y: 0, width: 1670, height: 120 },
    { id: 'area-1', x: 190, y: 130, width: 400, height: 300 },
  ]
  it('is right of the column and below the band, never under them', () => {
    expect(freeCorner(blocks, 'area-1', 'journey')).toEqual({ x: 190, y: 130 })
  })
  it('is anywhere on the page for the band and the column themselves, and with neither drawn', () => {
    expect(freeCorner(blocks, 'journey', 'journey')).toEqual({ x: 0, y: 0 })
    expect(freeCorner(blocks, POSTER_COLUMN_ID, 'journey')).toEqual({ x: 0, y: 0 })
    expect(freeCorner([], 'area-1', undefined)).toEqual({ x: 0, y: 0 })
  })
})
