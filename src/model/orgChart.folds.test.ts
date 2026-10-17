// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a fold of the organisation chart needs from the arithmetic (3.6.1):
 * which units a first open folds, what a folded unit hides, what is above a
 * unit to unfold, which units a name finds, and where a finding is counted.
 * One fictional organisation, Acme Logistics, made large enough to fold.
 */
import { describe, expect, it } from 'vitest'
import type { Role, UnitType } from './operatingModel'
import {
  findingsByUnit, foldable, foldedOnFirstOpen, orgChart, rollUp, unitsAboveIn, unitsNamed, walk,
} from './orgChart'
import type { ChartUnit, OrgChart } from './orgChart'
import type { DesignElement } from './types'
import type { Assignment, Organisation } from './units'

const domain: UnitType = { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [{ role: 'ro-owner', min: 1, max: 1 }] }
const cluster: UnitType = { id: 'ut-cluster', name: 'Cluster', top: true, within: ['ut-domain'], slots: [{ role: 'ro-lead', min: 1, max: 1 }] }
const team: UnitType = { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 2 }] }
const roles: Role[] = [
  { id: 'ro-owner', name: 'Domain owner', duties: [], manages: true },
  { id: 'ro-lead', name: 'Cluster lead', duties: [], manages: true },
  { id: 'ro-po', name: 'Product owner', duties: [], manages: true },
  { id: 'ro-dev', name: 'Developer', duties: [] },
]

function unit(id: string, name: string, unitTypeId: string, parentId?: string): DesignElement {
  return { id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId, ...(parentId ? { parentId } : {}) }
}

const as = (id: string, unitId: string, roleId: string, person: string): Assignment => ({ id, unitId, roleId, person: { person } })

const TODAY = '2026-10-11'

/** A small organisation: one domain, one cluster under it, two teams under that. */
const small: Organisation = {
  units: [
    unit('shipping', 'Shipping', 'ut-domain'),
    unit('pf', 'Parcel & Freight', 'ut-cluster', 'shipping'),
    unit('tt', 'Track & Trace', 'ut-team', 'pf'),
    unit('rp', 'Route Planning', 'ut-team', 'pf'),
  ],
  assignments: [
    as('as-1', 'shipping', 'ro-owner', 'pe-noor'),
    as('as-2', 'pf', 'ro-lead', 'pe-omar'),
    as('as-3', 'tt', 'ro-po', 'pe-sara'),
    as('as-4', 'tt', 'ro-dev', 'pe-sara'),
    as('as-5', 'rp', 'ro-dev', 'pe-tim'),
    as('as-6', 'rp', 'ro-dev', 'pe-omar'),
  ],
  roles, unitTypes: [domain, cluster, team],
}

/** Six domains, each with two clusters of three teams: 6 + 12 + 36 units. */
function large(): Organisation {
  const units: DesignElement[] = []
  for (let d = 0; d < 6; d += 1) {
    units.push(unit(`d${d}`, `Domain ${d}`, 'ut-domain'))
    for (let c = 0; c < 2; c += 1) {
      units.push(unit(`d${d}c${c}`, `Cluster ${d}.${c}`, 'ut-cluster', `d${d}`))
      for (let t = 0; t < 3; t += 1) units.push(unit(`d${d}c${c}t${t}`, `Team ${d}.${c}.${t}`, 'ut-team', `d${d}c${c}`))
    }
  }
  return { units, assignments: [], roles, unitTypes: [domain, cluster, team] }
}

const find = (chart: OrgChart, id: string): ChartUnit => [...walk(chart.roots)].find((one) => one.id === id)!

describe('folding the organisation chart', () => {
  // 3.7.3: a first open folds below the second level however few units there are; until then a chart of thirty or fewer opened whole.
  it('folds a first open below the second level, a large chart and a small one alike', () => {
    const chart = orgChart(large(), TODAY)
    expect(chart.units).toBe(54)
    // Every cluster folds, so the domains and their clusters show and no team does.
    expect(foldedOnFirstOpen(chart)).toEqual(['d0c0', 'd0c1', 'd1c0', 'd1c1', 'd2c0', 'd2c1', 'd3c0', 'd3c1', 'd4c0', 'd4c1', 'd5c0', 'd5c1'])
    // Four units, three levels: the cluster folds, its two teams wait.
    expect(foldedOnFirstOpen(orgChart(small, TODAY))).toEqual(['pf'])
  })

  it('folds nothing on a chart of two levels or one', () => {
    const two = { ...small, units: small.units.filter((one) => one.parentId !== 'pf') }
    expect(foldedOnFirstOpen(orgChart(two, TODAY))).toEqual([])
    expect(foldedOnFirstOpen(orgChart({ ...small, units: [small.units[0]!] }, TODAY))).toEqual([])
  })

  it('folds nothing on the second level that has no units under it', () => {
    const organisation = large()
    const bare = { ...organisation, units: organisation.units.filter((one) => one.parentId !== 'd0c0') }
    expect(foldedOnFirstOpen(orgChart(bare, TODAY))).not.toContain('d0c0')
  })

  it('lists every unit with units under it for Fold all, in the chart\'s order', () => {
    expect(foldable(orgChart(small, TODAY))).toEqual(['shipping', 'pf'])
  })

  it('says what a folded unit hides: its units, each person once, the vacancies and the findings about them', () => {
    const chart = orgChart(small, TODAY)
    // Below Shipping: the cluster and its two teams; Omar leads the cluster and develops in a team, counted once.
    expect(rollUp(find(chart, 'shipping'))).toEqual({ units: 3, people: 3, vacant: 2, findings: 0 })
    // Track & Trace is a developer short, Route Planning a product owner.
    expect(rollUp(find(chart, 'pf'), new Map([['tt', 2], ['pf', 5]]))).toEqual({ units: 2, people: 3, vacant: 2, findings: 2 })
    expect(rollUp(find(chart, 'tt'))).toEqual({ units: 0, people: 0, vacant: 0, findings: 0 })
  })

  it('names the units above one, the top first, to unfold', () => {
    const chart = orgChart(small, TODAY)
    expect(unitsAboveIn(chart, 'tt')).toEqual(['shipping', 'pf'])
    expect(unitsAboveIn(chart, 'shipping')).toEqual([])
    expect(unitsAboveIn(chart, 'nowhere')).toEqual([])
  })

  it('finds units by every word of a name, case folded, in the chart\'s order', () => {
    const chart = orgChart(small, TODAY)
    expect(unitsNamed(chart, 'track')).toEqual(['tt'])
    expect(unitsNamed(chart, 'ROUTE plan')).toEqual(['rp'])
    // Route Planning before Track & Trace: two teams of one type, by name.
    expect(unitsNamed(chart, 'r')).toEqual(['pf', 'rp', 'tt'])
    expect(unitsNamed(chart, '   ')).toEqual([])
  })

  it('counts a finding at its unit, or at the first unit where its person holds a role, and passes over the rest', () => {
    const chart = orgChart(small, TODAY)
    const counted = findingsByUnit(chart, [
      { id: 'tt' }, { id: 'tt' }, { id: 'x', person: 'pe-omar' }, { id: 'y', person: 'pe-old' }, { id: 'elsewhere' },
      { id: 'z', person: 'pe-merged' },
    ], (id) => (id === 'pe-merged' ? 'pe-tim' : id))
    expect(counted).toEqual(new Map([['tt', 2], ['pf', 1], ['rp', 1]]))
  })
})
