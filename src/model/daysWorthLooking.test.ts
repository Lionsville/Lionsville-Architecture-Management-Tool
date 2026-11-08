// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { daysWorthLooking } from './daysWorthLooking'

const says = {
  plan: (plan: string, milestone: string) => `${plan}: ${milestone}`,
  phase: (phase: string, name: string) => `${name} ${phase}`,
  board: (name: string) => `${name} saved`,
}

describe('the days worth looking at', () => {
  it('offers what a plan has on a day, a lifecycle date and a board\'s day, in order of the calendar', () => {
    const days = daysWorthLooking({
      elements: [{ name: 'Yard', lifecycleDates: { live: '2027-03-01', retired: '2020-01-01' } }],
      transitions: [{ title: 'Bring in', milestones: [{ date: '2027-01-15', name: 'Pilot' }] }],
      diagrams: [{ name: 'Landscape in 2027', asOf: '2027-09-01' }, { name: 'Today' }],
    }, '2026-11-07', says)
    expect(days).toEqual([
      { day: '2020-01-01', label: 'Yard retired' },
      { day: '2027-01-15', label: 'Bring in: Pilot' },
      { day: '2027-03-01', label: 'Yard live' },
      { day: '2027-09-01', label: 'Landscape in 2027 saved' },
    ])
  })

  it('reads several scopes’ days together, a day said the same way twice offered once', () => {
    const here = { elements: [{ name: 'Broker', lifecycleDates: { retired: '2027-06-01' } }] }
    const there = { elements: [{ name: 'Yard', lifecycleDates: { live: '2027-03-01' } }, { name: 'Broker', lifecycleDates: { retired: '2027-06-01' } }] }
    expect(daysWorthLooking([here, there], '2026-11-07', says)).toEqual([
      { day: '2027-03-01', label: 'Yard live' },
      { day: '2027-06-01', label: 'Broker retired' },
    ])
  })

  it('keeps to a few, what is ahead before what has passed, and never today itself', () => {
    const elements = Array.from({ length: 20 }, (_, at) => ({
      name: `E${at}`, lifecycleDates: { live: `20${10 + at}-01-01` },
    }))
    const days = daysWorthLooking({ elements, diagrams: [] }, '2025-01-01', says)
    expect(days).toHaveLength(10)
    expect(days.some((one) => one.day === '2026-01-01')).toBe(true)
    expect(days.some((one) => one.day === '2010-01-01')).toBe(false)
    expect(days.every((one) => one.day !== '2025-01-01')).toBe(true)
  })
})
