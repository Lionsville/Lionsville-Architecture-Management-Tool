// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the operating model's page is told, over Acme Logistics: the units of
 * each type there today, across the tree with the open scope's own units as
 * its session has them, and who holds a role before it is removed.
 */
import { describe, expect, it } from 'vitest'
import type { HostModel } from '../../model/hostModel'
import type { DesignElement } from '../../model/types'
import type { Assignment } from '../../model/units'
import { indexScopes } from '../../projects/scopeIndex'
import { roleHoldersHere, unitCountsHere } from './operatingCounts'

const TODAY = '2026-10-11'
const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const as = (id: string, unitId: string, roleId: string, person: string, over: Partial<Assignment> = {}): Assignment => (
  { id, unitId, roleId, person: { person }, ...over }
)
const ROOT: HostModel = {
  name: 'Acme Logistics', elements: [actor('data', 'Data & Integration', { unitTypeId: 'ut-cluster' })], relations: [], diagrams: [],
  unitTypes: [
    { id: 'ut-cluster', name: 'Cluster', top: true, within: [], slots: [{ role: 'ro-lead', min: 1, max: 1 }] },
    { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [{ role: 'ro-dev', min: 1 }] },
  ],
  roles: [{ id: 'ro-lead', name: 'Cluster lead', duties: [] }, { id: 'ro-dev', name: 'Developer', duties: [] }],
  assignments: [as('as-1', 'data', 'ro-lead', 'pe-eva')],
}
const SHIPPING: HostModel = {
  name: 'Shipping',
  elements: [
    actor('parcel', 'Parcel', { unitTypeId: 'ut-cluster' }),
    actor('tracking', 'Tracking', { unitTypeId: 'ut-team', parentId: 'parcel' }),
    actor('labels', 'Labels', { unitTypeId: 'ut-team', parentId: 'parcel', lifecycle: 'planned', lifecycleDates: { live: '2027-01-01' } }),
  ],
  relations: [], diagrams: [],
  assignments: [
    as('as-2', 'tracking', 'ro-dev', 'pe-lisa'), as('as-3', 'tracking', 'ro-dev', 'pe-joost'),
    as('as-4', 'parcel', 'ro-dev', 'pe-lisa', { from: '2027-01-01' }), as('as-5', 'tracking', 'ro-dev', 'pe-old', { until: '2026-01-31' }),
  ],
}
const index = indexScopes([{ path: '', model: ROOT }, { path: 'shipping', model: SHIPPING }])

describe('what the operating model\'s page is told', () => {
  it('counts the units of each type there today, across the tree', () => {
    expect(unitCountsHere(index, '', ROOT, TODAY)).toEqual(new Map([['ut-cluster', 2], ['ut-team', 1]]))
    expect(unitCountsHere(index, '', ROOT, '2027-01-01').get('ut-team')).toBe(2)
  })

  it('counts a unit the open scope\'s session has made a moment ago', () => {
    const now: HostModel = { ...SHIPPING, elements: [...SHIPPING.elements, actor('returns', 'Returns', { unitTypeId: 'ut-team', parentId: 'parcel' })] }
    expect(unitCountsHere(index, 'shipping', now, TODAY).get('ut-team')).toBe(2)
  })

  it('says who holds a role today or later: each person once, and the units by name', () => {
    expect(roleHoldersHere(index, '', ROOT, 'ro-dev', TODAY)).toEqual({ people: 2, units: ['Tracking', 'Parcel'] })
    expect(roleHoldersHere(index, '', ROOT, 'ro-lead', TODAY)).toEqual({ people: 1, units: ['Data & Integration'] })
    expect(roleHoldersHere(index, '', ROOT, 'ro-none', TODAY)).toEqual({ people: 0, units: [] })
  })
})
