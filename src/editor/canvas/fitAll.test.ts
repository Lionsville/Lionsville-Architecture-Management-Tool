// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { printViewport, PRINT_ROOM } from './fitAll'

const card = (id: string, x: number, y: number): Node => ({ id, position: { x, y }, width: 200, height: 100, data: {} })

describe('the board framed for the browser’s Print', () => {
  it('puts a wide board whole into the sheet’s room, from its top left', () => {
    const viewport = printViewport([card('a', 100, 50), card('b', 2900, 50)])!
    // 3000 wide in the board's units into the room's width, inside its margin.
    expect(100 * viewport.zoom + viewport.x).toBeGreaterThanOrEqual(0)
    expect((2900 + 200) * viewport.zoom + viewport.x).toBeLessThanOrEqual(PRINT_ROOM.width)
  })

  it('frames the sheet drawn round the cards as well, so a band’s heading above them prints', () => {
    const viewport = printViewport([card('a', 0, 0)], PRINT_ROOM, { x: 0, y: -400, width: 1400, height: 900 })!
    expect(-400 * viewport.zoom + viewport.y).toBeGreaterThanOrEqual(0)
    expect(1400 * viewport.zoom + viewport.x).toBeLessThanOrEqual(PRINT_ROOM.width)
  })

  it('never prints a small board larger than it is, and frames nothing where there is nothing', () => {
    expect(printViewport([card('a', 0, 0)])!.zoom).toBe(1)
    expect(printViewport([])).toBeUndefined()
  })
})
