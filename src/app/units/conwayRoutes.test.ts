// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { lanesOf, routeOf } from './conwayRoutes'

const column = (at: number) => ({ left: at * 200, right: at * 200 + 160, top: 40, bottom: 300 })
const COLUMNS = [column(0), column(1), column(2), column(3)]
const card = (at: number, y: number) => ({ left: at * 200 + 8, right: at * 200 + 152, top: y, bottom: y + 24 })

describe('where a Conway map draws its lines', () => {
  it('gives a lane only to a line that passes a column, and shares one between lines that do not overlap', () => {
    const { lane, count } = lanesOf([
      { key: 'near', from: 0, to: 1 }, { key: 'far', from: 0, to: 2 }, { key: 'overlaps', from: 1, to: 3 }, { key: 'clear', from: 3, to: 5 },
    ])
    expect(lane.has('near')).toBe(false)
    expect(lane.get('far')).not.toBe(lane.get('overlaps'))
    expect(count).toBe(2)
    expect(lane.get('clear')).toBe(lane.get('far'))
  })

  it('takes a neighbour through the gutter between them, and never crosses a card', () => {
    expect(routeOf({ key: 'x', from: 0, to: 1 }, card(0, 60), card(1, 100), COLUMNS, { lane: undefined, laneTop: 0, track: 1 }))
      .toBe('M152,72 H173 V112 H208')
  })

  it('takes a line further away over its lane, back the way it came when it runs from right to left', () => {
    expect(routeOf({ key: 'x', from: 0, to: 2 }, card(0, 60), card(2, 60), COLUMNS, { lane: 1, laneTop: 4, track: 0 }))
      .toBe('M152,72 H168 V11 H392 V72 H408')
    expect(routeOf({ key: 'x', from: 2, to: 0 }, card(2, 60), card(0, 60), COLUMNS, { lane: 0, laneTop: 4, track: 0 }))
      .toBe('M408,72 H392 V4 H168 V72 H152')
  })
})
