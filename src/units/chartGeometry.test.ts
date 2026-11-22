// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The chart's lines run at right angles along the gaps of the tree, from what was measured. */
import { describe, expect, it } from 'vitest'
import { connectorsOf, middleOf, pathOf, placeTags, routeAround, routeBetween } from './chartGeometry'

const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom })

describe('the connectors', () => {
  it('runs a bus under the parent, with a drop to each unit beside each other', () => {
    expect(connectorsOf(box(100, 0, 200, 40), [box(0, 60, 80, 100), box(220, 60, 300, 100)], 'across')).toEqual([
      'M150,40 L150,50', 'M40,50 L260,50', 'M40,50 L40,60', 'M260,50 L260,60',
    ])
  })

  it('runs a rail down the left of hanging units, with a stub to each', () => {
    expect(connectorsOf(box(0, 0, 100, 40), [box(20, 50, 100, 70), box(20, 80, 100, 100)], 'hanging')).toEqual([
      'M10,40 L10,90', 'M10,60 L20,60', 'M10,90 L20,90',
    ])
  })

  it('joins only the first row of a grid', () => {
    expect(connectorsOf(box(0, 0, 100, 40), [box(0, 60, 40, 80), box(60, 60, 100, 80), box(0, 90, 40, 110)], 'grid')).toHaveLength(4)
  })

  it('draws nothing for no units', () => {
    expect(connectorsOf(box(0, 0, 1, 1), [], 'across')).toEqual([])
  })
})

describe('a reporting line', () => {
  it('goes up out of the top of the lower box, straight where they line up', () => {
    expect(pathOf(routeBetween(box(0, 100, 100, 120), box(0, 0, 100, 40), false))).toBe('M50,100 L50,40')
  })

  it('bends along the middle of the gap where they do not', () => {
    expect(pathOf(routeBetween(box(0, 100, 100, 120), box(200, 0, 300, 40), false))).toBe('M50,100 L50,70 L250,70 L250,40')
  })

  it('leaves from the side that faces a box beside it', () => {
    expect(pathOf(routeBetween(box(200, 0, 300, 40), box(0, 10, 100, 30), false))).toBe('M200,20 L100,20')
    expect(pathOf(routeBetween(box(0, 0, 100, 40), box(200, 20, 300, 80), false))).toBe('M100,20 L150,20 L150,50 L200,50')
  })

  it('leaves a box at its edge, level with the name it is about', () => {
    const lower = { ...box(0, 100, 100, 140), at: { x: 30, y: 120 } }
    expect(pathOf(routeBetween(lower, box(0, 0, 60, 40), false))).toBe('M30,100 L30,40')
    const beside = { ...box(0, 0, 100, 40), at: { x: 30, y: 20 } }
    expect(pathOf(routeBetween(beside, { ...box(200, 0, 300, 40), at: { x: 250, y: 20 } }, false))).toBe('M100,20 L200,20')
  })

  it('hooks out of the left between two rows of one box', () => {
    expect(pathOf(routeBetween(box(20, 0, 80, 10), box(20, 20, 80, 30), true))).toBe('M20,5 L6,5 L6,25 L20,25')
  })

  it('has a middle for its tag', () => {
    expect(middleOf([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toEqual({ x: 10, y: 0 })
  })
})

describe('a line round the cards', () => {
  const crossesBox = (points: readonly { x: number; y: number }[], box: { left: number; top: number; right: number; bottom: number }) =>
    points.some((point, at) => at > 0 && Math.min(point.x, points[at - 1]!.x) < box.right - 1 && Math.max(point.x, points[at - 1]!.x) > box.left + 1
      && Math.min(point.y, points[at - 1]!.y) < box.bottom - 1 && Math.max(point.y, points[at - 1]!.y) > box.top + 1)

  it('keeps the plain route where no card is in the way', () => {
    const a = box(0, 100, 100, 120)
    const b = box(200, 0, 300, 40)
    expect(routeAround(a, b, false, [a, b, box(400, 0, 500, 40)])).toEqual(routeBetween(a, b, false))
  })

  it('goes round a card that stands between its two ends, along the gutter, and still ends square on the far card', () => {
    const a = box(0, 0, 100, 40)
    const b = box(400, 0, 500, 40)
    const between = box(200, 0, 300, 40)
    expect(crossesBox(routeBetween(a, b, false), between)).toBe(true)
    const route = routeAround(a, b, false, [a, b, between])
    expect(crossesBox(route, between)).toBe(false)
    expect(route[0]).toEqual({ x: 100, y: 20 })
    expect(route[route.length - 1]).toEqual({ x: 400, y: 20 })
    // In from the side it faces, so the arrowhead points at the card.
    expect(route[route.length - 2]!.y).toBe(20)
    expect(route.every((point, at) => at === 0 || point.x === route[at - 1]!.x || point.y === route[at - 1]!.y)).toBe(true)
  })

  it('goes round a card in a column between the two ends', () => {
    const a = box(0, 200, 100, 240)
    const b = box(0, 0, 100, 40)
    const between = box(0, 100, 100, 140)
    const route = routeAround(a, b, false, [a, b, between])
    expect(crossesBox(route, between)).toBe(false)
    expect(route[route.length - 1]).toEqual({ x: 50, y: 40 })
  })
})

describe('the tags on the lines', () => {
  const tagHits = (at: { x: number; y: number }, card: { left: number; top: number; right: number; bottom: number }) =>
    at.x - 40 < card.right && at.x + 40 > card.left && at.y - 10 < card.bottom && at.y + 10 > card.top

  it('sit on their line clear of every card, and of each other', () => {
    const cards = [box(0, 0, 100, 40), box(160, 0, 260, 40), box(0, 120, 100, 160)]
    // A line down the gutter between two cards, past a card's title at its middle.
    const line = [{ x: 130, y: 0 }, { x: 130, y: 300 }]
    const [one, two] = placeTags([{ points: line, width: 80, height: 20, above: 0 }, { points: line, width: 80, height: 20, above: 0 }], cards)
    for (const card of cards) {
      expect(tagHits(one!, card)).toBe(false)
      expect(tagHits(two!, card)).toBe(false)
    }
    expect(Math.abs(one!.y - two!.y)).toBeGreaterThanOrEqual(20)
    expect(one!.x).toBe(130)
  })
})
