// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { spreadLabels } from './labelSpread'

const box = (id: string, x: number, y: number) => ({ id, x, y, width: 100, height: 30 })

describe('spreadLabels', () => {
  it('moves nothing that had room', () => {
    expect(spreadLabels([box('a', 0, 0), box('b', 200, 0), box('c', 0, 100)]).size).toBe(0)
  })

  it('moves the later of two that land on each other, by as little as it can', () => {
    const moved = spreadLabels([box('a', 0, 0), box('b', 50, 10)])
    expect(moved.has('a')).toBe(false)
    expect(moved.get('b')).toBe(22)
  })

  it('moves a label off a box it would cover', () => {
    const moved = spreadLabels([box('a', 0, 10)], [box('card', 0, 0)]);
    expect(moved.get('a')).toBe(22);
  });

  it('leaves no two on each other in a pile', () => {
    const boxes = Array.from({ length: 8 }, (_, index) => box(`l${index}`, 0, index))
    const moved = spreadLabels(boxes)
    const ys = boxes.map((one) => one.y + (moved.get(one.id) ?? 0)).sort((a, b) => a - b)
    for (let index = 1; index < ys.length; index += 1) expect(ys[index]! - ys[index - 1]!).toBeGreaterThanOrEqual(30)
  })

  it('leaves a label where it is rather than move it further than it may go', () => {
    const pile = Array.from({ length: 6 }, (_, n) => ({ id: `l${n}`, x: 0, y: 0, width: 100, height: 20 }))
    const moved = spreadLabels(pile, [], 50)
    for (const by of moved.values()) expect(Math.abs(by)).toBeLessThanOrEqual(50)
    expect(moved.size).toBeLessThan(5)
  })
})
