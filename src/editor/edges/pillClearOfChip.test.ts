// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { pillClearOfChip } from './FloatingEdge'

describe('pillClearOfChip', () => {
  const a = { x: 0, y: 100 }
  const b = { x: 400, y: 100 }
  const mid = { x: 200, y: 100 }

  it('keeps the middle where no chip stands there', () => {
    expect(pillClearOfChip(mid, 'horizontal', a, b, undefined, 1)).toEqual(mid)
    expect(pillClearOfChip(mid, 'horizontal', a, b, { at: { x: 200, y: 160 }, width: 140, height: 20 }, 1)).toEqual(mid)
  })

  it('moves the pill along its leg to just past the chip that covers the middle', () => {
    const at = pillClearOfChip(mid, 'horizontal', a, b, { at: mid, width: 140, height: 20 }, 1)
    expect(at.y).toBe(100)
    // Past the chip's end (70), a gap (4) and half the pill (9).
    expect(Math.abs(at.x - 200)).toBe(83)
  })

  it('counts the chip in the canvas’s units at the zoom', () => {
    const at = pillClearOfChip(mid, 'horizontal', a, b, { at: mid, width: 140, height: 20 }, 0.5)
    expect(Math.abs(at.x - 200)).toBeCloseTo(41.5)
  })

  it('keeps the middle when the leg has no room past the chip on either side', () => {
    expect(pillClearOfChip({ x: 50, y: 100 }, 'horizontal', { x: 0, y: 100 }, { x: 100, y: 100 }, { at: { x: 50, y: 100 }, width: 140, height: 20 }, 1)).toEqual({ x: 50, y: 100 })
  })

  it('works along a vertical leg too', () => {
    const at = pillClearOfChip({ x: 10, y: 200 }, 'vertical', { x: 10, y: 0 }, { x: 10, y: 400 }, { at: { x: 10, y: 200 }, width: 140, height: 20 }, 1)
    expect(at.x).toBe(10)
    expect(Math.abs(at.y - 200)).toBe(23)
  })
})
