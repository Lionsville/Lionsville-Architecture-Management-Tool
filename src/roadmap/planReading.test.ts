// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Transition } from '../model/transition'
import { dayToShow, outsideWindow, slipOf } from './planReading'

const plan = (over: Partial<Transition> = {}): Transition => ({
  id: 'tr', number: 1, title: 'A plan', status: 'draft', elements: [], decisions: [], milestones: [], body: '', ...over,
})

describe('what a plan is read as', () => {
  it('says a milestone outside the window on the side it fell', () => {
    const window = { from: '2026-01-01', to: '2026-12-31' }
    expect(outsideWindow(window, '2025-12-31')).toBe('before')
    expect(outsideWindow(window, '2026-06-01')).toBeUndefined()
    expect(outsideWindow(window, '2027-01-01')).toBe('after')
    expect(outsideWindow({}, '2027-01-01')).toBeUndefined()
  })

  it('reads a slip before it is made: the window, the milestones and what goes live', () => {
    const slip = slipOf(
      plan({
        from: '2026-01-01', to: '2026-03-31',
        milestones: [{ date: '2026-02-01', name: 'Half' }, { date: '', name: 'No day' }],
        elements: [{ elementId: 'new', role: 'introduces' }, { elementId: 'same', role: 'changes' }],
      }),
      { elements: [{ id: 'new', name: 'New', kind: 'application', lifecycleDates: { live: '2026-03-01' } }, { id: 'same', name: 'Same', kind: 'application' }] as never },
      30,
    )
    expect(slip).toMatchObject({ from: '2026-01-31', to: '2026-04-30', milestones: 1, lastMilestone: '2026-03-03' })
    expect(slip.elements).toEqual([{ id: 'new', name: 'New', phase: 'live', day: '2026-03-31' }])
  })

  it('opens a board on the milestone picked, else the next to come, else the last day', () => {
    const milestones = [{ date: '2026-02-01', name: 'A' }, { date: '2026-09-01', name: 'B' }]
    expect(dayToShow(plan({ milestones }), '2026-01-01', '2026-02-01')).toBe('2026-02-01')
    expect(dayToShow(plan({ milestones }), '2026-03-01')).toBe('2026-09-01')
    expect(dayToShow(plan({ milestones, to: '2026-12-31' }), '2027-03-01')).toBe('2026-12-31')
    expect(dayToShow(plan(), '2027-03-01')).toBeUndefined()
  })
})
