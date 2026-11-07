// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { DesignDiagram, DesignElement } from '../model'
import { overlapsOf, POSTER_COLUMN_ID, POSTER_WIDTH } from './posterLayout'
import { isPlaced, posterFirstLayout, posterPlaces } from './posterPlaces'
import { sheetPage } from './sheet'

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
