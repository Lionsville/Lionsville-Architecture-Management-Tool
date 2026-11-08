// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a help picture is cut, as arithmetic over boxes: the parts its words
 * name, taken out to whole lines, never through one. The same over a browser's
 * layout, in three languages and two text sizes, is `HelpFigure.browser.test`.
 */
import { describe, expect, it } from 'vitest'
import { crosses, cutAtLines, fitScale, partsBox, spanAtLines } from './pictureCut'

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })

describe('a line and a cut', () => {
  it('is crossed when part of the line is in and part out', () => {
    expect(crosses(box(0, 10, 100, 16), box(0, 0, 200, 20))).toBe(true)
    expect(crosses(box(0, 10, 100, 16), box(0, 0, 200, 40))).toBe(false)
    expect(crosses(box(0, 50, 100, 16), box(0, 0, 200, 40))).toBe(false)
  })
})

describe('the parts a picture is cut to', () => {
  it('are taken together, with room for a ring', () => {
    expect(partsBox([box(10, 10, 20, 20), box(50, 40, 10, 10)])).toEqual(box(10, 10, 50, 40))
    expect(partsBox([box(10, 10, 20, 20)], 4)).toEqual(box(6, 6, 28, 28))
    expect(partsBox([box(0, 0, 0, 0)])).toBeUndefined()
  })
})

describe('one axis of a cut', () => {
  const lines = [{ from: 10, to: 26 }, { from: 34, to: 50 }, { from: 58, to: 74 }]
  it('stands clear of the lines either side of the parts, in the gap between', () => {
    expect(spanAtLines(30, 52, lines, 100)).toEqual({ from: 30, to: 54 })
  })
  it('takes in a line its edge would run through, with room past it, or to the edge with nothing past it', () => {
    expect(spanAtLines(40, 52, lines, 100)).toEqual({ from: 30, to: 54 })
    expect(spanAtLines(36, 62, lines, 100)).toEqual({ from: 30, to: 100 })
  })
  it("goes to the picture's edge where no line lies beyond", () => {
    expect(spanAtLines(4, 30, lines, 100)).toEqual({ from: 0, to: 30 })
    expect(spanAtLines(60, 70, lines, 100)).toEqual({ from: 54, to: 100 })
  })
  it('keeps within the widest it may be, at an edge that runs through nothing', () => {
    expect(spanAtLines(60, 70, lines, 100, 30)).toEqual({ from: 54, to: 80 })
  })
})

describe('a cut', () => {
  it('runs through no line, and is read against the lines of the band it holds', () => {
    // A row of two words over a paragraph; the parts are the first word and the paragraph's first line.
    const lines = [box(10, 5, 60, 16), box(200, 5, 80, 16), box(10, 40, 150, 16), box(10, 60, 150, 16)]
    const cut = cutAtLines(box(10, 5, 60, 51), lines, { width: 300, height: 100 })
    for (const line of lines) expect(crosses(line, cut)).toBe(false)
    expect(cut).toEqual(box(0, 0, 166, 58))
  })
})

describe('the whole picture, enlarged', () => {
  it('fills the room one way and fits the other, keeping its shape', () => {
    expect(fitScale({ width: 700, height: 300 }, { width: 1400, height: 900 })).toBe(2)
    expect(fitScale({ width: 700, height: 300 }, { width: 1400, height: 450 })).toBe(1.5)
    expect(fitScale({ width: 0, height: 300 }, { width: 1400, height: 450 })).toBe(1)
  })
})
