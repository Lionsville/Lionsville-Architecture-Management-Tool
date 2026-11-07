// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a sheet's poster writes (ADR-0048). The generated property in
 * `inverse.property.test.ts` holds every one of these to its inverse; this says
 * what each means, and what a sheet's geometry does on the way in and out.
 */
import { describe, expect, it } from 'vitest'
import { clearPlaces, tileLeft, transaction } from '../commands'
import type { Command } from '../commands'
import type { Model } from '../normalised'
import { fromArrays, toArrays } from '../normalised'
import { apply } from '../reducer'
import { diagram, element } from '../testFixtures'
import type { DesignDiagram } from '../types'

const sheet = (over: Partial<DesignDiagram> = {}): DesignDiagram => ({ id: 's', kind: 'sheet', name: 'Sheet', members: [], geometry: { nodes: [] }, ...over })

const start = (over: Partial<DesignDiagram> = {}): Model => fromArrays({
  name: 'Design',
  elements: [
    element('area', { kind: 'function' }),
    element('other', { kind: 'function' }),
    element('tile', { kind: 'function', parentId: 'area' }),
    element('journey', { kind: 'step' }),
  ],
  relations: [],
  diagrams: [diagram('board', { kind: 'layer7', placements: [] }), sheet(over)],
})

function run(model: Model, command: Command): Model {
  const result = apply(model, command)
  if (!result.ok) throw new Error(result.reason)
  const undone = apply(result.model, result.inverse)
  expect(undone.ok && undone.model, `${command.type} undone`).toStrictEqual(model)
  return result.model
}

const drawn = (model: Model, id = 's') => toArrays(model).diagrams.find((one) => one.id === id)!

describe('a block on a sheet', () => {
  it('is a node about an element the scope holds, though a sheet has no members', () => {
    const placed = run(start(), { type: 'node.set', diagramId: 's', nodes: [{ id: 'area', x: 188, y: 120, width: 400, height: 90 }, { id: 'nobody', x: 1, y: 1 }] })
    expect(drawn(placed).geometry?.nodes).toEqual([{ id: 'area', x: 188, y: 120, width: 400, height: 90 }])
    expect(drawn(placed).members).toEqual([])
  })

  it('is still nothing on a board without a member', () => {
    const result = apply(start(), { type: 'node.set', diagramId: 'board', nodes: [{ id: 'area', x: 1, y: 1 }] })
    expect(result.ok && drawn(result.model, 'board').geometry?.nodes).toEqual([])
  })

  it('keeps the stakeholder column in the group boxes, with no group to name it', () => {
    const placed = run(start(), { type: 'box.set', diagramId: 's', boxes: [{ id: 'rail', x: 0, y: 0, width: 176, height: 900 }, { id: 'other', x: 0, y: 0, width: 1, height: 1 }] })
    expect(drawn(placed).geometry?.groups).toEqual([{ id: 'rail', x: 0, y: 0, width: 176, height: 900 }])
    const onBoard = apply(start(), { type: 'box.set', diagramId: 'board', boxes: [{ id: 'rail', x: 0, y: 0, width: 1, height: 1 }] })
    expect(onBoard.ok && drawn(onBoard.model, 'board').geometry?.groups).toBeUndefined()
  })

  it('is read back from a geometry however its rows were ordered, and comes out in one order', () => {
    const model = fromArrays({ ...toArrays(start()), diagrams: [sheet({ geometry: { nodes: [{ id: 'other', x: 2, y: 2 }, { id: 'area', x: 1, y: 1 }] } })] })
    expect(drawn(model).geometry?.nodes.map((node) => node.id)).toEqual(['area', 'other'])
  })

  it('takes no member row: a sheet stays without them', () => {
    const result = apply(start(), { type: 'member.set', diagramId: 's', members: [{ id: 'area' }] })
    expect(result.ok && drawn(result.model).members).toEqual([])
  })

  it('goes with its element, cell too, and one undo brings both back', () => {
    const placed = run(run(start(), { type: 'node.set', diagramId: 's', nodes: [{ id: 'tile', x: 1, y: 1 }] }), { type: 'cell.set', diagramId: 's', cells: [{ id: 'tile', col: 1, row: 2 }] })
    const gone = run(placed, { type: 'element.delete', id: 'tile' })
    expect(drawn(gone).geometry).toEqual({ nodes: [] })
  })
})

describe('a tile placed by hand', () => {
  it('is an exception: placed, moved, and flowing again with nothing left behind', () => {
    const placed = run(start(), { type: 'cell.set', diagramId: 's', cells: [{ id: 'tile', col: 0, row: 1 }] })
    expect(drawn(placed).geometry?.cells).toEqual([{ id: 'tile', col: 0, row: 1 }])
    const moved = run(placed, { type: 'cell.set', diagramId: 's', cells: [{ id: 'tile', col: 2, row: 1, span: 2 }] })
    expect(drawn(moved).geometry?.cells).toEqual([{ id: 'tile', col: 2, row: 1, span: 2 }])
    const flowing = run(moved, { type: 'cell.remove', diagramId: 's', elementIds: ['tile'] })
    expect(drawn(flowing).geometry).toEqual({ nodes: [] })
  })

  it('is nothing on a board, and nothing about an element nobody holds', () => {
    const onBoard = apply(start(), { type: 'cell.set', diagramId: 'board', cells: [{ id: 'tile', col: 0, row: 0 }] })
    expect(onBoard.ok && drawn(onBoard.model, 'board').geometry?.cells).toBeUndefined()
    const about = apply(start(), { type: 'cell.set', diagramId: 's', cells: [{ id: 'nobody', col: 0, row: 0 }] })
    expect(about.ok && drawn(about.model).geometry?.cells).toBeUndefined()
  })

  it('leaves its cell behind on every sheet when it moves to another block, in one step with the move', () => {
    const placed = run(start(), { type: 'cell.set', diagramId: 's', cells: [{ id: 'tile', col: 1, row: 0 }] })
    const moved = run(placed, transaction([{ type: 'element.update', id: 'tile', patch: { parentId: 'other' } }, ...tileLeft(placed, 'tile')]))
    expect(drawn(moved).geometry?.cells).toBeUndefined()
    expect(toArrays(moved).elements.find((one) => one.id === 'tile')?.parentId).toBe('other')
  })
})

describe('first layout', () => {
  it('takes the blocks, the column and the cells, leaves the free items, and is one step', () => {
    const placed = start({
      poster: { tile: 's', items: [{ id: 'n1', kind: 'note', text: 'Kept' }] },
      geometry: {
        nodes: [{ id: 'area', x: 1, y: 1 }],
        groups: [{ id: 'rail', x: 0, y: 0, width: 176, height: 900 }],
        cells: [{ id: 'tile', col: 0, row: 0 }],
        items: [{ id: 'n1', x: 5, y: 6, width: 90, height: 60 }],
      },
    })
    const cleared = run(placed, transaction(clearPlaces(placed, 's')))
    expect(drawn(cleared).geometry).toEqual({ nodes: [], items: [{ id: 'n1', x: 5, y: 6, width: 90, height: 60 }] })
    expect(drawn(cleared).poster).toEqual({ tile: 's', items: [{ id: 'n1', kind: 'note', text: 'Kept' }] })
  })
})

describe('a free item', () => {
  const note = { id: 'n1', kind: 'note' as const, text: 'Said here' }
  const place = { id: 'n1', x: 10, y: 20, width: 90, height: 60 }

  it('has a definition and a place, and leaves no poster behind when it goes', () => {
    const added = run(start(), { type: 'poster.item.add', diagramId: 's', item: note, place })
    expect(drawn(added).poster).toEqual({ items: [note] })
    expect(drawn(added).geometry?.items).toEqual([place])
    const gone = run(added, { type: 'poster.item.remove', diagramId: 's', id: 'n1' })
    expect(drawn(gone)).toEqual(drawn(start()))
  })

  it('keeps what the poster says beside it', () => {
    const added = run(start({ poster: { tile: 'l' } }), { type: 'poster.item.add', diagramId: 's', item: note, place })
    expect(drawn(added).poster).toEqual({ tile: 'l', items: [note] })
  })

  it('is edited and moved by its own commands, and refuses an id taken and a key that is none of its', () => {
    const added = run(start(), { type: 'poster.item.add', diagramId: 's', item: note, place })
    const said = run(added, { type: 'poster.item.update', diagramId: 's', id: 'n1', patch: { text: 'Said again' } })
    expect(drawn(said).poster?.items).toEqual([{ ...note, text: 'Said again' }])
    const moved = run(said, { type: 'poster.item.place', diagramId: 's', place: { ...place, x: 400 } })
    expect(drawn(moved).geometry?.items).toEqual([{ ...place, x: 400 }])
    expect(apply(added, { type: 'poster.item.add', diagramId: 's', item: note, place })).toEqual({ ok: false, reason: 'command.taken' })
    expect(apply(added, { type: 'poster.item.update', diagramId: 's', id: 'n1', patch: { colour: 'red' } as never })).toEqual({ ok: false, reason: 'command.notAField' })
    expect(apply(added, { type: 'poster.item.update', diagramId: 's', id: 'gone', patch: { text: 'x' } })).toEqual({ ok: false, reason: 'command.gone' })
  })
})

describe('what a poster says of its own', () => {
  it('is a patch of the view, as a sheet\'s other fields are', () => {
    const said = run(start(), { type: 'diagram.update', id: 's', patch: { labels: ['tile'], poster: { tile: 's', bandRows: 1, foot: 'Draft' }, paper: 'wide' } })
    expect(drawn(said)).toMatchObject({ labels: ['tile'], poster: { tile: 's', bandRows: 1, foot: 'Draft' }, paper: 'wide' })
  })

  it('an icon is a field of the element', () => {
    const iconed = run(start(), { type: 'element.update', id: 'journey', patch: { icon: 'sha256:abc' } })
    expect(toArrays(iconed).elements.find((one) => one.id === 'journey')?.icon).toBe('sha256:abc')
  })
})
