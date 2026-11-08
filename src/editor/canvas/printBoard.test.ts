// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { PRINT_READABLE, PRINT_SHEET, printLayout, seam } from './printBoard'

const box = (x: number, y: number, width = 200, height = 100) => ({ x, y, width, height })

describe('a board laid over printed sheets', () => {
  it('takes one sheet where its names read on it', () => {
    const layout = printLayout(box(0, 0, 1200, 600), [box(0, 0)])!
    expect(layout.parts).toHaveLength(1)
    expect(layout.zoom).toBeGreaterThanOrEqual(PRINT_READABLE)
    expect(layout.small).toBe(false)
  })

  it('never prints a small board larger than it is', () => {
    expect(printLayout(box(0, 0, 300, 200), [])!.zoom).toBe(1)
  })

  it('goes over two sheets side by side rather than below a readable size, cut between cards', () => {
    const cards = [box(0, 0), box(700, 0), box(1150, 0), box(1700, 0), box(2300, 0)]
    const layout = printLayout(box(0, 0, 2500, 600), cards)!
    expect(layout.parts).toHaveLength(2)
    const [left, right] = layout.parts
    expect(left!.x + left!.width).toBe(right!.x)
    expect(cards.every((card) => card.x >= right!.x || card.x + card.width <= right!.x)).toBe(true)
    expect(layout.zoom).toBeGreaterThanOrEqual(PRINT_READABLE)
    expect(left!.width * layout.zoom).toBeLessThanOrEqual(PRINT_SHEET.width)
  })

  it('cuts a tall board one part over the other', () => {
    const layout = printLayout(box(0, 0, 900, 2000), [])!
    expect(layout.parts[0]!.width).toBe(900)
    expect(layout.parts[1]!.y).toBe(layout.parts[0]!.height)
  })

  it('says so where even two sheets draw the names too small', () => {
    expect(printLayout(box(0, 0, 9000, 600), [])!.small).toBe(true)
  })

  it('cuts in the middle where every place near it has a card across it, a wide band not counted', () => {
    expect(seam(0, 1000, [[0, 1000], [300, 700]])).toBe(500)
    expect(seam(0, 1000, [[0, 1000], [100, 450], [460, 900]])).toBe(450)
  })
})
