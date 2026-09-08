/**
 * The arithmetic, against the workbook this was designed down from.
 *
 * The fixture is that spreadsheet's own cash flows, and three of the numbers
 * below are its own answers — internal rate of return, payback and return on
 * investment all agree to the digit, which is what says this computes the same
 * things it does. The fourth does not agree, on purpose: its net present value
 * is discounted a period too far, and the test that pins our answer names its
 * answer beside it so nobody quietly "fixes" ours to match.
 */
import { describe, expect, it } from 'vitest'
import {
  businessCaseFence, computeBusinessCase, internalRateOfReturn, netPresentValue, readAmount, readBusinessCase,
} from './businessCase'

/**
 * The workbook's Financial KPIs sheet: 415,000 spent at the start, then five
 * years of savings and revenue.
 */
const WORKBOOK = `
currency: EUR
discount rate: 10%

| Line          | Year 0    | Year 1 | Year 2  | Year 3  | Year 4  | Year 5  |
| ------------- | --------- | ------ | ------- | ------- | ------- | ------- |
| Investment    | -415 000  |        |         |         |         |         |
| Cost savings  |           | 25 000 | 125 000 | 125 000 | 125 000 | 125 000 |
| Revenue gains |           |        |  50 000 | 150 000 | 150 000 | 150 000 |
`

const read = (source: string) => computeBusinessCase(readBusinessCase(source))

describe('readAmount', () => {
  it('reads a plain number', () => {
    expect(readAmount('415000')).toBe(415000)
    expect(readAmount('-415000')).toBe(-415000)
    expect(readAmount('')).toBe(0)
  })

  it('reads a number a person spaced out or signed', () => {
    expect(readAmount('415 000')).toBe(415000)
    expect(readAmount('€ 415 000')).toBe(415000)
    expect(readAmount('  -415 000  ')).toBe(-415000)
    // Accountants write a negative in parentheses.
    expect(readAmount('(415 000)')).toBe(-415000)
  })

  it('settles a lone separator by counting the digits after it', () => {
    // Three digits after and something before: thousands, in either language.
    expect(readAmount('1.200')).toBe(1200)
    expect(readAmount('1,200')).toBe(1200)
    // Anything else is a decimal point.
    expect(readAmount('1.5')).toBe(1.5)
    expect(readAmount('1,5')).toBe(1.5)
    expect(readAmount('0.10')).toBe(0.1)
  })

  it('takes the last separator as the decimal when both are there', () => {
    expect(readAmount('1.234,56')).toBeCloseTo(1234.56, 6)
    expect(readAmount('1,234.56')).toBeCloseTo(1234.56, 6)
    expect(readAmount('1 234 567,89')).toBeCloseTo(1234567.89, 6)
  })

  it('has nothing to say about a cell with no number in it', () => {
    expect(readAmount('n/a')).toBeUndefined()
    expect(readAmount('—')).toBeUndefined()
  })
})

describe('readBusinessCase', () => {
  it('reads the keys, the periods and the lines', () => {
    const held = readBusinessCase(WORKBOOK)
    expect(held.currency).toBe('EUR')
    expect(held.discountRate).toBe(0.1)
    expect(held.periods).toEqual(['Year 0', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'])
    expect(held.lines.map((line) => line.name))
      .toEqual(['Investment', 'Cost savings', 'Revenue gains'])
    expect(held.lines[0].amounts).toEqual([-415000, 0, 0, 0, 0, 0])
    expect(held.lines[1].amounts).toEqual([0, 25000, 125000, 125000, 125000, 125000])
  })

  it('reads a rate written as a fraction as readily as a percentage', () => {
    expect(readBusinessCase('discount rate: 0.08').discountRate).toBeCloseTo(0.08, 6)
    expect(readBusinessCase('discount rate: 8 %').discountRate).toBeCloseTo(0.08, 6)
  })

  it('takes the second table as the scorecard', () => {
    const held = readBusinessCase(`${WORKBOOK}
| Criterion               | Weight | Score |
| ----------------------- | ------ | ----- |
| Alignment with strategy | 3      | 4     |
| Risk reduction          | 2      | 2     |
`)
    expect(held.criteria).toEqual([
      { name: 'Alignment with strategy', weight: 3, score: 4 },
      { name: 'Risk reduction', weight: 2, score: 2 },
    ])
    // And the money table is still the money table.
    expect(held.lines).toHaveLength(3)
  })

  it('keeps a key it does not know rather than dropping it', () => {
    // A block written against a later build must not lose what it carries when
    // an older one renders it.
    expect(readBusinessCase('horizon: 5 years\ncurrency: EUR').extra).toEqual({ horizon: '5 years' })
  })

  it('reads what it can out of a half-written block', () => {
    const held = readBusinessCase('| Line | Year 0 |\n| --- | --- |\n| Spend | -100 |')
    expect(held.discountRate).toBeUndefined()
    expect(held.lines[0].amounts).toEqual([-100])
  })

  it('is empty rather than broken when there is nothing to read', () => {
    const held = readBusinessCase('')
    expect(held.lines).toEqual([])
    expect(held.periods).toEqual([])
  })
})

describe('computeBusinessCase', () => {
  it('nets and accumulates the lines', () => {
    const result = read(WORKBOOK)
    expect(result.net).toEqual([-415000, 25000, 175000, 275000, 275000, 275000])
    expect(result.cumulative).toEqual([-415000, -390000, -215000, 60000, 335000, 610000])
    expect(result.totalIn).toBe(1025000)
    expect(result.totalOut).toBe(415000)
  })

  it('discounts from period 0, which the spreadsheet did not', () => {
    // Excel's NPV discounts its FIRST argument by one period, so
    // `=NPV(rate, investment:last)` moves every figure a year out — including
    // money spent today. The sheet reports 288,680.91 for these very flows.
    expect(read(WORKBOOK).npv).toBeCloseTo(317549.01, 2)
    const shifted = netPresentValue([-415000, 25000, 175000, 275000, 275000, 275000], 0.1) / 1.1
    expect(shifted).toBeCloseTo(288680.91, 2)
  })

  it('agrees with the spreadsheet on the three it had right', () => {
    const result = read(WORKBOOK)
    expect(result.irr).toBeCloseTo(0.3031809549, 8)
    expect(result.payback).toBeCloseTo(2.7818181818, 8)
    expect(result.roi).toBeCloseTo(1.4698795181, 8)
    expect(result.ratio).toBeCloseTo(2.4698795181, 8)
  })

  it('says nothing about a present value it was given no rate for', () => {
    const result = read(WORKBOOK.replace('discount rate: 10%', ''))
    expect(result.npv).toBeUndefined()
    expect(result.irr).toBeDefined()
  })

  it('has no rate of return for a series that never turns', () => {
    expect(internalRateOfReturn([-100, -100, -100])).toBeUndefined()
    expect(internalRateOfReturn([100, 100])).toBeUndefined()
    expect(internalRateOfReturn([])).toBeUndefined()
  })

  it('finds a rate of return that makes the present value zero', () => {
    const net = [-1000, 400, 400, 400]
    const irr = internalRateOfReturn(net)!
    expect(netPresentValue(net, irr)).toBeCloseTo(0, 6)
  })

  it('has no payback when the money never comes back', () => {
    expect(read('| Line | Y0 | Y1 |\n| --- | --- | --- |\n| Spend | -100 | -100 |').payback)
      .toBeUndefined()
  })

  it('pays back at once when nothing was spent up front', () => {
    expect(read('| Line | Y0 | Y1 |\n| --- | --- | --- |\n| Gain | 100 | 100 |').payback).toBe(0)
  })

  it('says nothing about return when nothing was spent', () => {
    const result = read('| Line | Y0 |\n| --- | --- |\n| Gain | 100 |')
    expect(result.roi).toBeUndefined()
    expect(result.ratio).toBeUndefined()
  })

  it('scores against a maximum it derives, not one that was typed', () => {
    // The workbook's own maximum was five per criterion under a label that said
    // one to ten. Deriving it is what stops the two disagreeing.
    const result = read(`${WORKBOOK}
| Criterion | Weight | Score |
| --- | --- | --- |
| Alignment | 3 | 4 |
| Risk      | 2 | 2 |
`)
    expect(result.score).toEqual({ total: 3 * 4 + 2 * 2, max: (3 + 2) * 5, scale: 5 })
  })

  it('ignores a criterion with no weight rather than counting it as nothing', () => {
    const result = read(`${WORKBOOK}
| Criterion | Weight | Score |
| --- | --- | --- |
| Counts | 2 | 4 |
| Not yet weighted |  | 5 |
`)
    expect(result.score).toEqual({ total: 8, max: 10, scale: 5 })
  })
})

describe('businessCaseFence', () => {
  it('finds the first fence, whether or not the closing line is there yet', () => {
    expect(businessCaseFence('# Plan\n\n```business-case\ncurrency: EUR\n```\n\ntext')).toBe('currency: EUR')
    expect(businessCaseFence('```business-case  \ncurrency: EUR\n| a | b |')).toBe('currency: EUR\n| a | b |')
    expect(businessCaseFence('```business-case\n```')).toBe('')
  })

  it('answers nothing for a body without one, and ignores other fences', () => {
    expect(businessCaseFence('## Goal\n\n```mermaid\ngraph TD\n```')).toBeUndefined()
    expect(businessCaseFence('')).toBeUndefined()
  })
})
