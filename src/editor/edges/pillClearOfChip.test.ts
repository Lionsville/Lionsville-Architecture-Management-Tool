// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { chipClearOfPills, pillClearOfChip } from './FloatingEdge'

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

describe('chipClearOfPills', () => {
  const chip = { at: { x: 50, y: 100 }, width: 140, height: 20 }

  it('leaves a chip no pill covers where it is', () => {
    expect(chipClearOfPills(chip, [{ at: { x: 300, y: 100 }, axis: 'horizontal' }], 1)).toEqual(chip.at)
  })

  it('steps a chip off a pill that kept the middle of a short leg, across the leg, just clear of it', () => {
    // The leg of 100 has no room past a 140-wide chip: the pill stays on its middle, over the chip.
    const pill = pillClearOfChip(chip.at, 'horizontal', { x: 0, y: 100 }, { x: 100, y: 100 }, chip, 1)
    const at = chipClearOfPills(chip, [{ at: pill, axis: 'horizontal' }], 1)
    // Half the pill (4), half the chip (10) and a gap (4): 18 above the leg.
    expect(at).toEqual({ x: 50, y: 82 })
  })

  it('steps off a vertical leg’s pill by whichever way is shortest, in the canvas’s units', () => {
    const at = chipClearOfPills({ at: { x: 10, y: 200 }, width: 40, height: 20 }, [{ at: { x: 10, y: 200 }, axis: 'vertical' }], 0.5)
    // At half scale: up past the pill's half length (4.5), the chip's half height (5) and a gap (2) is 11.5,
    // shorter than aside past its half width (2 + 10 + 2).
    expect(at).toEqual({ x: 10, y: 188.5 })
  })
})

