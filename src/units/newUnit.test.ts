// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A unit made on the chart (ADR-0036, as built 3.6.2): the types that may sit
 * where it is asked for, in the one order; where it is filed by default; and
 * the record it is.
 */
import { describe, expect, it } from 'vitest'
import type { UnitType } from '../../model/operatingModel'
import { asksServes, filedInChoice, filedInDefault, newUnitElement, typesThatMaySit } from './newUnit'

const DAY = '2026-10-12'
const type = (id: string, over: Partial<UnitType> = {}): UnitType => ({ id, name: id, within: [], slots: [], ...over })
const domain = type('Domain', { top: true })
const cluster = type('Cluster', { within: ['Domain'], spans: true })
const team = type('Team', { within: ['Cluster'], top: true })
const squad = type('Squad', { within: ['Cluster'], order: 1 })
const gone = type('Guild', { within: ['Cluster'], until: '2026-01-01' })
const TYPES = [team, squad, cluster, gone, domain]

describe('the types a new unit may have', () => {
  it('are the ones whose within holds the parent type, in lane and order', () => {
    // Squad has an order and Team none: the said one first in their lane.
    expect(typesThatMaySit(TYPES, 'Cluster', DAY).map((one) => one.id)).toEqual(['Squad', 'Team'])
    expect(typesThatMaySit(TYPES, 'Domain', DAY).map((one) => one.id)).toEqual(['Cluster'])
    expect(typesThatMaySit(TYPES, 'Team', DAY)).toEqual([])
  })

  it('at the top, the types with top, by lane — and none that has ended on the day', () => {
    expect(typesThatMaySit(TYPES, undefined, DAY).map((one) => one.id)).toEqual(['Domain', 'Team'])
    expect(typesThatMaySit(TYPES, 'Cluster', '2025-06-01').map((one) => one.id)).toEqual(['Squad', 'Guild', 'Team'])
  })
})

describe('where a new unit is filed', () => {
  it('under a parent, with the parent — or in the chart’s scope where the parent’s is not known', () => {
    expect(filedInDefault({ parentScope: 'shipping', underParent: true, serves: ['warehouse'], spans: false, chartScope: '' })).toBe('shipping')
    expect(filedInDefault({ parentScope: undefined, underParent: true, serves: [], spans: false, chartScope: 'customer' })).toBe('customer')
  })

  it('at the top, in the one domain it serves unless its type spans; otherwise the chart’s scope', () => {
    expect(filedInDefault({ underParent: false, serves: ['shipping'], spans: false, chartScope: '' })).toBe('shipping')
    expect(filedInDefault({ underParent: false, serves: ['shipping'], spans: true, chartScope: '' })).toBe('')
    expect(filedInDefault({ underParent: false, serves: ['shipping', 'warehouse'], spans: false, chartScope: '' })).toBe('')
    expect(filedInDefault({ underParent: false, serves: [], spans: false, chartScope: 'shipping' })).toBe('shipping')
  })

  it('only where the person may write: the default, the chart’s scope, the first — or nowhere', () => {
    expect(filedInChoice('shipping', '', ['', 'shipping'])).toBe('shipping')
    expect(filedInChoice('shipping', '', ['', 'customer'])).toBe('')
    expect(filedInChoice('shipping', '', ['customer'])).toBe('customer')
    expect(filedInChoice('shipping', '', [])).toBeUndefined()
  })

  it('asks which domains it serves at the top, or for a type that spans', () => {
    expect(asksServes(team, false)).toBe(true)
    expect(asksServes(team, true)).toBe(false)
    expect(asksServes(cluster, true)).toBe(true)
    expect(asksServes(undefined, true)).toBe(false)
  })
})

describe('the record a new unit is', () => {
  it('is an actor with its type, its parent and the domains picked, its name trimmed', () => {
    expect(newUnitElement({ id: 'carriers', name: ' Carriers ', unitTypeId: 'Cluster', parentId: 'shipping', scopes: ['shipping', 'warehouse'] })).toEqual({
      id: 'carriers', kind: 'actor', name: 'Carriers', lifecycle: 'live', isManaged: false, aspects: {},
      unitTypeId: 'Cluster', parentId: 'shipping', scopes: ['shipping', 'warehouse'],
    })
  })

  it('says nothing of a parent or of domains where there are none', () => {
    const made = newUnitElement({ id: 'shipping', name: 'Shipping', unitTypeId: 'Domain', scopes: [] })
    expect(made).not.toHaveProperty('parentId')
    expect(made).not.toHaveProperty('scopes')
  })
})
