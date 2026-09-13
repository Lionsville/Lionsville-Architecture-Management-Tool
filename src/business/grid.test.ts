import { describe, expect, it } from 'vitest'
import { columnsFor, packAreas, paperWidth, sheetColumns, sheetPaperWidth, spanOf, withSpan } from './grid'

describe('how many columns fit', () => {
  it('is one on anything narrower than a column, and never zero', () => {
    expect(columnsFor(0)).toBe(1)
    expect(columnsFor(120)).toBe(1)
    expect(columnsFor(Number.NaN)).toBe(1)
  })

  it('counts the gaps between the columns, not after the last', () => {
    // Three columns of 300 with two gaps of 12 is 924: exactly enough.
    expect(columnsFor(924)).toBe(3)
    expect(columnsFor(923)).toBe(2)
  })

  it('is what the sheet fixes, when it fixes one', () => {
    expect(sheetColumns({ columns: 5 }, 300)).toBe(5)
    expect(sheetColumns({}, 924)).toBe(3)
    // A number that is not a count is not a fixed count.
    expect(sheetColumns({ columns: 0 }, 924)).toBe(3)
    expect(sheetColumns({ columns: 2.5 }, 924)).toBe(3)
  })
})

describe('how many an area takes', () => {
  it('is one unless the sheet says otherwise', () => {
    expect(spanOf({}, 'sales', 3)).toBe(1)
    expect(spanOf({ areaSpans: { sales: 2 } }, 'sales', 3)).toBe(2)
  })

  it('never exceeds the grid, or the widest an area may be', () => {
    expect(spanOf({ areaSpans: { sales: 3 } }, 'sales', 2)).toBe(2)
    expect(spanOf({ areaSpans: { sales: 9 } }, 'sales', 9)).toBe(4)
  })

  it('writes nothing once every area is back to one column', () => {
    const widened = withSpan(undefined, 'sales', 2)
    expect(widened).toEqual({ sales: 2 })
    expect(withSpan(widened, 'sales', 1)).toBeUndefined()
    expect(withSpan({ sales: 2, ops: 3 }, 'sales', 1)).toEqual({ ops: 3 })
  })
})

describe('paper', () => {
  it('is the long side of the ISO sheet at 96 dpi', () => {
    expect(paperWidth('A4')).toBe(1123)
    expect(paperWidth('A0')).toBe(4494)
  })

  it('is what a sheet is laid out on: A2 unless it says, and nothing at all for the window', () => {
    expect(sheetPaperWidth({})).toBe(2245)
    expect(sheetPaperWidth({ paper: 'A0' })).toBe(4494)
    expect(sheetPaperWidth({ paper: 'fit' })).toBeUndefined()
    expect(sheetPaperWidth({ paper: 'B3' as never })).toBe(2245)
  })
})

describe('packing the areas', () => {
  it('stacks wide areas beside a tall narrow one, rather than leaving a row empty under them', () => {
    const { placed, height } = packAreas([
      { id: 'strategy', span: 1, height: 900 },
      { id: 'commerce', span: 2, height: 300 },
      { id: 'data', span: 2, height: 300 },
    ], 3, 10)
    expect(placed).toEqual([
      { id: 'strategy', column: 0, span: 1, top: 0 },
      { id: 'commerce', column: 1, span: 2, top: 0 },
      { id: 'data', column: 1, span: 2, top: 310 },
    ])
    expect(height).toBe(900)
  })

  it('drops a small area into the lowest hole, leftmost when two are level', () => {
    const { placed } = packAreas([
      { id: 'a', span: 1, height: 500 },
      { id: 'b', span: 1, height: 100 },
      { id: 'c', span: 1, height: 100 },
      { id: 'd', span: 1, height: 100 },
    ], 3, 10)
    expect(placed.map((held) => [held.id, held.column, held.top])).toEqual([
      ['a', 0, 0], ['b', 1, 0], ['c', 2, 0], ['d', 1, 110],
    ])
  })

  it('clamps a span to the grid, and is empty for nothing', () => {
    expect(packAreas([{ id: 'a', span: 5, height: 10 }], 2, 10).placed[0]).toMatchObject({ column: 0, span: 2 })
    expect(packAreas([], 3)).toEqual({ placed: [], height: 0 })
  })
})
