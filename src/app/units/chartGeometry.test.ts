// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The chart's lines run at right angles along the gaps of the tree, from what was measured. */
import { describe, expect, it } from 'vitest'
import { connectorsOf, middleOf, pathOf, routeBetween } from './chartGeometry'

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
