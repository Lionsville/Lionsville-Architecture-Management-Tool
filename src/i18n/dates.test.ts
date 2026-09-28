// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Dates as the screen says them (`dates.ts`). The words a month is called by
 * are the platform's ICU data, which moves between Node versions — "Sept" or
 * "Sep", a dot or none — so these hold what the helpers decide: which day,
 * whether the year is said, and what is passed through untouched.
 */
import { describe, expect, it } from 'vitest'
import { LANGUAGES } from './strings'
import { formatDay, formatMoment, parseDay } from './dates'

describe('parseDay', () => {
  it('reads a YYYY-MM-DD day as that local day, whitespace and all', () => {
    const day = parseDay(' 2026-09-28 ')
    expect(day).toBeInstanceOf(Date)
    expect([day?.getFullYear(), day?.getMonth(), day?.getDate()]).toEqual([2026, 8, 28])
    // Local midnight, not UTC's: the same day west of Greenwich too.
    expect([day?.getHours(), day?.getMinutes()]).toEqual([0, 0])
  })

  it('is nothing for another shape', () => {
    for (const text of ['', '28-09-2026', '2026-9-28', '2026-09-28T10:00', 'yesterday']) {
      expect(parseDay(text), text).toBeUndefined()
    }
  })

  it('is nothing for a day the calendar does not have, rather than the day it rolls over to', () => {
    for (const text of ['2026-09-31', '2026-02-29', '2026-13-01', '2026-00-10', '2026-01-00']) {
      expect(parseDay(text), text).toBeUndefined()
    }
    expect(parseDay('2028-02-29')?.getDate()).toBe(29)
  })
})

describe('formatDay', () => {
  it('says the day, its month and its year in every language', () => {
    for (const language of LANGUAGES) {
      const said = formatDay('2026-09-28', language)
      expect(said, language).toContain('28')
      expect(said, language).toContain('2026')
      expect(said, language).not.toContain('2026-09-28')
    }
  })

  it('says the three languages differently where their months differ', () => {
    // March: "Mar", "mrt", "März" — whatever ICU's short forms, not all one.
    const said = LANGUAGES.map((language) => formatDay('2026-03-05', language))
    expect(new Set(said).size).toBeGreaterThan(1)
  })

  it('shows what is not a day as it came', () => {
    expect(formatDay('', 'en')).toBe('')
    expect(formatDay('next spring', 'nl')).toBe('next spring')
    expect(formatDay('2026-09-31', 'de')).toBe('2026-09-31')
  })
})

describe('formatMoment', () => {
  const now = new Date(2026, 8, 28, 12, 0)

  it('leaves the year out for a moment of this year, and says the time', () => {
    const said = formatMoment(new Date(2026, 8, 28, 6, 39), 'en', now)
    expect(said).toContain('28')
    expect(said).toContain('39')
    expect(said).not.toContain('2026')
  })

  it('says the year for a moment of another', () => {
    for (const language of LANGUAGES) {
      const said = formatMoment(new Date(2025, 11, 31, 23, 5), language, now)
      expect(said, language).toContain('31')
      expect(said, language).toContain('2025')
    }
  })

  it('takes a number and a string as well as a Date, and says them alike', () => {
    const at = new Date(2026, 3, 2, 9, 15)
    const said = formatMoment(at, 'nl', now)
    expect(formatMoment(at.getTime(), 'nl', now)).toBe(said)
    expect(formatMoment(at.toISOString(), 'nl', now)).toBe(said)
  })

  it('shows what is not a moment as it came', () => {
    expect(formatMoment('not a time', 'de', now)).toBe('not a time')
    expect(formatMoment(Number.NaN, 'en', now)).toBe('NaN')
    expect(formatMoment(new Date(Number.NaN), 'en', now)).toBe('Invalid Date')
  })

  it('reads the clock when not told the time', () => {
    const said = formatMoment(new Date(), 'en')
    expect(said).not.toContain(String(new Date().getFullYear()))
  })
})
