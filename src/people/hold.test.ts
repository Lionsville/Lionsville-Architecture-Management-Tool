// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a person holds on a day (ADR-0036 §4), over one fictional person at
 * Acme Logistics: a role held now, one held before, one still to come, and
 * the same role held twice in one unit.
 */
import { describe, expect, it } from 'vitest'
import { heldOn, rolesOn } from './hold'
import type { HeldAssignment } from './hold'

const DAY = '2026-10-11'
const one = (id: string, role: string, unit: string, days: Partial<HeldAssignment> = {}): HeldAssignment => ({ id, scope: 'shipping', role, unit, ...days })

const held: HeldAssignment[] = [
  one('as-1', 'Product owner', 'Parcel'),
  one('as-2', 'Release manager', 'Parcel', { until: '2026-06-30' }),
  one('as-3', 'Cluster lead', 'Freight', { from: '2027-01-01' }),
  one('as-4', 'Developer', 'Tracking', { from: '2026-10-11', until: '2026-10-11', share: 0.5 }),
  one('as-5', 'Developer', 'Tracking', { from: '2026-01-01', share: 0.5 }),
]

describe('what a person holds on a day', () => {
  it('splits it into what runs that day, what is still to come and what is over, its first and last day included', () => {
    const { now, later, before } = heldOn(held, DAY)
    expect(now.map((each) => each.id)).toEqual(['as-1', 'as-4', 'as-5'])
    expect(later.map((each) => each.id)).toEqual(['as-3'])
    expect(before.map((each) => each.id)).toEqual(['as-2'])
  })

  it('says each role in its unit once, in the order held, and nothing for somebody who holds nothing', () => {
    expect(rolesOn(held, DAY)).toEqual([{ role: 'Product owner', unit: 'Parcel' }, { role: 'Developer', unit: 'Tracking' }])
    expect(rolesOn(held, '2027-01-01')).toEqual([
      { role: 'Product owner', unit: 'Parcel' }, { role: 'Cluster lead', unit: 'Freight' }, { role: 'Developer', unit: 'Tracking' },
    ])
    expect(rolesOn(held, '2020-01-01')).toEqual([{ role: 'Product owner', unit: 'Parcel' }, { role: 'Release manager', unit: 'Parcel' }])
    expect(rolesOn([], DAY)).toEqual([])
  })
})
