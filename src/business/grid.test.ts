import { describe, expect, it } from 'vitest'
import { columnsFor, paperWidth, sheetColumns, spanOf, withSpan } from './grid'

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
})
