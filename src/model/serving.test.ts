// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which units serve a scope, read from either end of `unit.scopes`
 * (ADR-0036, amended 11 October 2026).
 */
import { describe, expect, it } from 'vitest'
import { domainOwnerOn, domainOwnersOn } from './owners'
import type { OperatingRule, Role, UnitType } from './operatingModel'
import {
  isServable, mayStopServing, scopesServed, scopesWith, scopesWithout, servesOn, servingUnitFiledHighest, servingUnits,
} from './serving'
import type { Assignment, Organisation, UnitLike } from './units'

const unit = (id: string, unitTypeId: string, over: Partial<UnitLike> = {}): UnitLike => ({
  id, name: id, kind: 'actor', unitTypeId, lifecycle: 'live', ...over,
})
const types: UnitType[] = [
  { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [] },
  { id: 'ut-cluster', name: 'Cluster', top: true, within: ['ut-domain'], spans: true, slots: [] },
  { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [] },
]
const lead: Role = { id: 'ro-lead', name: 'Domain lead', duties: [], manages: true }
const rules: OperatingRule[] = [{ id: 'domainOwner', role: 'ro-lead' }]

// Shipping is a domain with a cluster and a team under it; Data sits at the
// organisation and serves Shipping and Warehouse by name; Robotics is the
// warehouse's and says nothing.
const filed: Record<string, string> = {
  shipping: 'shipping', parcels: 'shipping', tracking: 'shipping', routes: 'shipping',
  warehouse: 'warehouse', robotics: 'warehouse', data: '',
}
const filedIn = (id: string) => filed[id]
const organisation: Organisation = {
  units: [
    unit('shipping', 'ut-domain', { scopes: ['shipping'] }),
    unit('parcels', 'ut-cluster', { parentId: 'shipping', scopes: ['shipping'] }),
    unit('tracking', 'ut-team', { parentId: 'parcels' }),
    unit('routes', 'ut-team', { parentId: 'parcels' }),
    unit('warehouse', 'ut-domain'),
    unit('robotics', 'ut-team', { parentId: 'warehouse' }),
    unit('data', 'ut-cluster', { scopes: ['shipping', 'warehouse'] }),
  ],
  assignments: [
    { id: 'as-1', unitId: 'shipping', roleId: 'ro-lead', person: { person: 'pe-noor' } },
    { id: 'as-2', unitId: 'data', roleId: 'ro-lead', person: { person: 'pe-lisa' } } satisfies Assignment,
  ],
  roles: [lead],
  unitTypes: types,
}
const DAY = '2026-10-11'

describe('what a unit serves', () => {
  it('is its scopes, or the scope it is filed in where it says nothing', () => {
    expect(scopesServed(unit('data', 'ut-cluster', { scopes: ['a', 'b'] }), filedIn)).toEqual(['a', 'b'])
    expect(scopesServed(unit('robotics', 'ut-team'), filedIn)).toEqual(['warehouse'])
    expect(scopesServed(unit('nowhere', 'ut-team'), filedIn)).toEqual([])
  })

  it('keeps its own scope when one is added to a unit that said nothing, and adds a scope once', () => {
    expect(scopesWith(unit('robotics', 'ut-team'), 'shipping', filedIn)).toEqual(['warehouse', 'shipping'])
    expect(scopesWith(unit('data', 'ut-cluster', { scopes: ['shipping'] }), 'shipping', filedIn)).toEqual(['shipping'])
  })

  it('stops serving a scope only where it names it and something else is left to serve', () => {
    expect(mayStopServing(unit('data', 'ut-cluster', { scopes: ['shipping'] }), 'shipping', filedIn)).toBe(true)
    expect(mayStopServing(unit('parcels', 'ut-cluster', { scopes: ['shipping'] }), 'shipping', filedIn)).toBe(false)
    expect(mayStopServing(unit('parcels', 'ut-cluster', { scopes: ['shipping', 'warehouse'] }), 'shipping', filedIn)).toBe(true)
    expect(mayStopServing(unit('robotics', 'ut-team'), 'warehouse', filedIn)).toBe(false)
    expect(scopesWithout({ scopes: ['shipping', 'warehouse'] }, 'shipping')).toEqual(['warehouse'])
    expect(scopesWithout({ scopes: ['shipping'] }, 'shipping')).toBeUndefined()
  })

  it('never serves the organisation, which is no domain', () => {
    // Data sits at the organisation: saying nothing there serves nothing.
    expect(scopesServed(unit('data', 'ut-cluster'), filedIn)).toEqual([])
    // A `""` an older write left beside a domain is read as nothing, and dropped by the next write.
    expect(scopesServed(unit('data', 'ut-cluster', { scopes: ['', 'shipping'] }), filedIn)).toEqual(['shipping'])
    expect(scopesWith(unit('data', 'ut-cluster', { scopes: ['', 'shipping'] }), 'warehouse', filedIn)).toEqual(['shipping', 'warehouse'])
    expect(scopesWithout({ scopes: ['', 'shipping'] }, 'shipping')).toBeUndefined()
    // Nor is the organisation added.
    expect(scopesWith(unit('robotics', 'ut-team'), '', filedIn)).toEqual(['warehouse'])
    expect(isServable('')).toBe(false)
    expect(isServable('shipping')).toBe(true)
    const everyone = (scope: string) => scope === ''
    expect(servesOn(organisation, 'data', everyone, DAY, filedIn)).toBe(false)
    expect(servingUnits(organisation, '', DAY, filedIn)).toEqual({ units: [], through: [] })
  })

  it('writes a unit at the organisation that said nothing with the one domain added alone, and lets it stop again', () => {
    expect(scopesWith(unit('data', 'ut-cluster'), 'shipping', filedIn)).toEqual(['shipping'])
    // Nothing left: it is back to serving nothing, which is allowed where it is filed at the organisation.
    expect(mayStopServing(unit('data', 'ut-cluster', { scopes: ['shipping'] }), 'shipping', filedIn)).toBe(true)
    expect(scopesWithout({ scopes: ['shipping'] }, 'shipping')).toBeUndefined()
  })

  it('reaches through the units above it, on the day', () => {
    const shipping = (scope: string) => scope === 'shipping'
    expect(servesOn(organisation, 'tracking', shipping, DAY, filedIn)).toBe(true)
    expect(servesOn(organisation, 'robotics', shipping, DAY, filedIn)).toBe(false)
    // A plan moves Robotics under Parcels from November.
    const moved: Organisation = { ...organisation, moves: [{ unitId: 'robotics', parentId: 'parcels', on: '2026-11-01' }] }
    expect(servesOn(moved, 'robotics', shipping, DAY, filedIn)).toBe(false)
    expect(servesOn(moved, 'robotics', shipping, '2026-11-01', filedIn)).toBe(true)
  })
})

describe('who serves a scope', () => {
  it('lists the units that name it or say nothing at the top, in the one order, and the rest as through them', () => {
    const served = servingUnits(organisation, 'shipping', DAY, filedIn)
    expect(served.units.map((one) => one.id)).toEqual(['shipping', 'data', 'parcels'])
    expect(served.through.map((one) => one.id)).toEqual(['routes', 'tracking'])
    expect(servingUnits(organisation, 'warehouse', DAY, filedIn).units.map((one) => one.id)).toEqual(['warehouse', 'data'])
  })

  it('leaves out a unit that is not there on the day', () => {
    const ended: Organisation = { ...organisation, units: organisation.units.map((one) => (one.id === 'data' ? { ...one, lifecycle: 'retired' as const } : one)) }
    expect(servingUnits(ended, 'shipping', DAY, filedIn).units.map((one) => one.id)).toEqual(['shipping', 'parcels'])
  })

  it('takes the serving unit filed in the scope, highest first, as the one the domain owner is worked out from', () => {
    expect(servingUnitFiledHighest(organisation, 'shipping', DAY, filedIn)?.id).toBe('shipping')
    // Nothing filed in it: the highest serving unit wherever it is filed.
    expect(servingUnitFiledHighest(organisation, 'customer', DAY, filedIn)).toBeUndefined()
    const only: Organisation = { ...organisation, units: organisation.units.filter((one) => one.id === 'data') }
    expect(servingUnitFiledHighest(only, 'shipping', DAY, filedIn)?.id).toBe('data')
  })

  it('says the domain owner off that unit alone, by the rule', () => {
    expect(domainOwnerOn(organisation, rules, 'shipping', DAY, filedIn)).toMatchObject({ unitId: 'shipping', owners: [{ person: 'pe-noor' }] })
    expect(domainOwnerOn(organisation, rules, 'shipping', DAY, filedIn).owners).toHaveLength(1)
    expect(domainOwnerOn(organisation, [], 'shipping', DAY, filedIn)).toEqual({ unitId: 'shipping', owners: [] })
    expect(domainOwnerOn(organisation, rules, 'customer', DAY, filedIn)).toEqual({ owners: [] })
  })

  it('names no domain owner of the organisation, even off a unit kept there that says nothing', () => {
    const top: Organisation = { ...organisation, units: [unit('data', 'ut-cluster')] }
    expect(domainOwnerOn(top, rules, '', DAY, filedIn)).toEqual({ owners: [] })
    expect(domainOwnersOn(top, rules, '', DAY, filedIn)).toEqual([])
  })
})
