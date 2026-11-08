// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { barInView, cellWord, dayAt, dayNumber, dayString, fitView, fractionOf, lastDayOf, mergedMilestones, monthWords, openingView, rulerCells, scaleOf, scrolledView, sideOf, viewAtScale, viewBetween, viewWith, zoomedView, AXIS_MAX_DAYS, AXIS_MIN_DAYS } from './timeScale'

const year = openingView('2026-11-07')

describe('the window', () => {
  it('opens three months back and nine ahead, in whole months', () => {
    expect(year.start).toBe('2026-08-01')
    expect(lastDayOf(year)).toBe('2027-07-31')
    expect(scaleOf(year)).toBe('months')
  })

  it('crosses the year either way', () => {
    expect(openingView('2027-01-15').start).toBe('2026-10-01')
    expect(lastDayOf(openingView('2026-11-30'))).toBe('2027-07-31')
  })

  it('counts days through a change of the clocks', () => {
    expect(dayNumber('2027-03-29') - dayNumber('2027-03-27')).toBe(2)
    expect(dayString(dayNumber('2027-03-28'))).toBe('2027-03-28')
  })

  it('keeps its middle when the scale changes', () => {
    const middle = dayNumber(year.start) + year.days / 2
    for (const scale of ['weeks', 'quarters', 'years'] as const) {
      const next = viewAtScale(year, scale)
      expect(scaleOf(next)).toBe(scale)
      expect(Math.abs(dayNumber(next.start) + next.days / 2 - middle)).toBeLessThanOrEqual(1)
    }
  })

  it('scrolls by the ruler’s pixels', () => {
    const next = scrolledView({ start: '2027-01-01', days: 100 }, 250, 1000)
    expect(next).toEqual({ start: '2027-01-26', days: 100 })
    expect(scrolledView({ start: '2027-01-01', days: 100 }, 10, 0).start).toBe('2027-01-01')
  })

  it('zooms about the day at the anchor, within its limits', () => {
    const view = { start: '2027-01-01', days: 400 }
    const next = zoomedView(view, 2, 0.25)
    expect(next.days).toBe(200)
    expect(dayNumber(next.start) + next.days * 0.25).toBeCloseTo(dayNumber(view.start) + view.days * 0.25, 0)
    expect(zoomedView(view, 1000).days).toBe(AXIS_MIN_DAYS)
    expect(zoomedView(view, 0.0001).days).toBe(AXIS_MAX_DAYS)
  })

  it('moves only when a day is out of it, and keeps the scale', () => {
    expect(viewWith(year, '2027-01-01')).toBe(year)
    const moved = viewWith(year, '2030-01-01')
    expect(moved.days).toBe(year.days)
    expect(sideOf(moved, '2030-01-01')).toBe('inside')
  })

  it('fits everything with a date, and one lone day in a month', () => {
    const fitted = fitView(['2025-01-10', '2028-12-20', '2026-01-01'])!
    expect(sideOf(fitted, '2025-01-10')).toBe('inside')
    expect(sideOf(fitted, '2028-12-20')).toBe('inside')
    expect(fitView([])).toBeUndefined()
    expect(fitView(['2027-01-01'])!.days).toBeGreaterThanOrEqual(AXIS_MIN_DAYS)
  })

  it('takes a first and a last day', () => {
    const view = viewBetween('2027-01-01', '2027-12-31')
    expect(view.days).toBe(365)
    expect(lastDayOf(view)).toBe('2027-12-31')
  })

  it('reads a place on the ruler as a day, and back', () => {
    const view = { start: '2027-01-01', days: 100 }
    expect(fractionOf(view, '2027-01-26')).toBe(0.25)
    expect(dayAt(view, 0.25)).toBe('2027-01-26')
    expect(dayAt(view, -1)).toBe('2027-01-01')
    expect(dayAt(view, 2)).toBe(lastDayOf(view))
  })
})

describe('a bar in the window', () => {
  const view = { start: '2027-01-01', days: 100 }

  it('is whole when it fits, its last day included', () => {
    const bar = barInView(view, '2027-01-11', '2027-01-20')!
    expect(bar.left).toBeCloseTo(0.1)
    expect(bar.width).toBeCloseTo(0.1)
    expect(bar).toMatchObject({ runsBefore: false, runsAfter: false })
  })

  it('says it runs on past either edge', () => {
    expect(barInView(view, '2026-01-01', '2028-01-01')).toEqual({ left: 0, width: 1, runsBefore: true, runsAfter: true })
    expect(barInView(view, undefined, '2027-01-20')!.runsBefore).toBe(true)
    expect(barInView(view, '2027-01-20', undefined)!.runsAfter).toBe(true)
  })

  it('is not there when it is wholly outside', () => {
    expect(barInView(view, '2026-01-01', '2026-12-31')).toBeUndefined()
    expect(barInView(view, '2027-04-11', '2028-01-01')).toBeUndefined()
  })
})

describe('the ruler', () => {
  it('marks months, says a year where one starts and once at the start', () => {
    const cells = rulerCells(year, 980)
    expect(cells).toHaveLength(12)
    expect(cells.filter((cell) => cell.major).map((cell) => cell.day)).toEqual(['2027-01-01'])
    expect(cells.filter((cell) => cell.withYear).map((cell) => cell.day)).toEqual(['2026-08-01', '2027-01-01'])
    expect(cellWord(cells[0], 'en-GB')).toBe('Aug 2026')
    expect(cellWord(cells[1], 'en-GB')).toBe('Sept')
    expect(cellWord(cells[5], 'en-GB')).toBe('Jan 2027')
  })

  it('cuts the first cell at the edge', () => {
    const cells = rulerCells({ start: '2026-08-16', days: 365 }, 980)
    expect(cells[0].left).toBe(0)
    expect(cells[0].width).toBeCloseTo(16 / 365)
    const total = cells.reduce((sum, cell) => sum + cell.width, 0)
    expect(total).toBeCloseTo(1)
  })

  it('says the year on the first cell with room for it', () => {
    const cells = rulerCells({ start: '2026-08-30', days: 365 }, 980)
    expect(cells[0].withYear).toBe(false)
    expect(cells[1].withYear).toBe(true)
  })

  it('marks quarters and years at those scales', () => {
    const quarters = rulerCells(viewAtScale(year, 'quarters'), 980)
    expect(quarters[0].unit).toBe('quarter')
    expect(cellWord({ unit: 'quarter', day: '2026-04-01', withYear: true }, 'en-GB')).toBe('Q2 2026')
    expect(cellWord({ unit: 'quarter', day: '2026-07-01', withYear: false }, 'en-GB')).toBe('Q3')
    const years = rulerCells(viewAtScale(year, 'years'), 980)
    expect(years.every((cell) => cell.unit === 'year' && cell.withYear)).toBe(true)
    expect(cellWord(years[0], 'en-GB')).toMatch(/^\d{4}$/)
  })

  it('marks weeks from a Monday', () => {
    const weeks = rulerCells({ start: '2027-01-06', days: 84 }, 980)
    expect(weeks[0].unit).toBe('week')
    expect(weeks[0].day).toBe('2027-01-04')
    expect(new Date(`${weeks[1].day}T00:00:00Z`).getUTCDay()).toBe(1)
  })

  it('goes up a unit rather than draw cells too narrow to say anything', () => {
    expect(rulerCells(year, 200)[0].unit).toBe('quarter')
    expect(rulerCells({ start: '2000-01-01', days: 30000 }, 900)[0].unit).toBe('year')
  })

  it('says the window in months', () => {
    expect(monthWords(year, 'en-GB')).toEqual({ from: 'Aug 2026', to: 'Jul 2027' })
  })

  it('abbreviates a month one way: the window, the ruler and a date alike', () => {
    expect(monthWords(year, 'de-DE')).toEqual({ from: 'Aug. 2026', to: 'Juli 2027' })
    expect(cellWord({ unit: 'month', day: '2026-08-01', withYear: true }, 'de-DE')).toBe('Aug. 2026')
    expect(cellWord({ unit: 'month', day: '2027-09-01', withYear: false }, 'de-DE')).toBe('Sept.')
    expect(new Date(Date.UTC(2027, 8, 1)).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })).toBe('1. Sept. 2027')
    expect(monthWords(year, 'nl-NL')).toEqual({ from: 'aug 2026', to: 'jul 2027' })
  })
})

describe('milestones', () => {
  const view = { start: '2027-01-01', days: 100 }
  const at = (day: string) => ({ day })

  it('merge when they would sit on each other, and leave out what is outside', () => {
    const clusters = mergedMilestones(view, 1000, [at('2027-02-01'), at('2027-01-10'), at('2027-01-10'), at('2027-01-11'), at('2028-01-01')])
    expect(clusters.map((cluster) => cluster.items.length)).toEqual([3, 1])
    expect(clusters[0].day).toBe('2027-01-10')
  })

  it('stand apart when there is room', () => {
    expect(mergedMilestones(view, 10000, [at('2027-01-10'), at('2027-01-11')])).toHaveLength(2)
  })
})
