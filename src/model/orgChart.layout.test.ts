// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the organisation chart's layout needs from the arithmetic (3.6.1):
 * the vacancies its summary counts, which roles are optional and empty — not
 * drawn unless asked for — and which units take a whole row because they are
 * drawn with units under them. One fictional organisation, Acme Logistics.
 */
import { describe, expect, it } from 'vitest'
import type { Role, UnitType } from './operatingModel'
import { drawsUnitsBelow, emptyOptional, orgChart, vacanciesIn, walk } from './orgChart'
import type { ChartUnit, OrgChart } from './orgChart'
import type { DesignElement } from './types'
import type { Assignment, Organisation } from './units'

const TODAY = '2026-10-11'

const domain: UnitType = { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [{ role: 'ro-owner', min: 1, max: 1 }] }
const cluster: UnitType = {
  id: 'ut-cluster', name: 'Cluster', top: true, within: ['ut-domain'], slots: [{ role: 'ro-lead', min: 1, max: 1 }, { role: 'ro-coach', min: 0, max: 1 }],
}
const team: UnitType = { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 2 }] }
const roles: Role[] = [
  { id: 'ro-owner', name: 'Domain owner', duties: [], manages: true },
  { id: 'ro-lead', name: 'Cluster lead', duties: [], manages: true },
  { id: 'ro-coach', name: 'Agile coach', duties: [] },
  { id: 'ro-po', name: 'Product owner', duties: [], manages: true },
  { id: 'ro-dev', name: 'Developer', duties: [] },
]

function unit(id: string, name: string, unitTypeId: string, parentId?: string): DesignElement {
  return { id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId, ...(parentId ? { parentId } : {}) }
}

const as = (id: string, unitId: string, roleId: string, person: string): Assignment => ({ id, unitId, roleId, person: { person } })

/** Shipping, with two clusters: one coached and full, one with nobody leading it; three teams, each short of developers. */
const shipping: Organisation = {
  units: [
    unit('shipping', 'Shipping', 'ut-domain'),
    unit('pf', 'Parcel & Freight', 'ut-cluster', 'shipping'),
    unit('ops', 'Operations', 'ut-cluster', 'shipping'),
    unit('tt', 'Track & Trace', 'ut-team', 'pf'),
    unit('rp', 'Route Planning', 'ut-team', 'pf'),
    unit('lm', 'Line Maintenance', 'ut-team', 'ops'),
  ],
  assignments: [
    as('as-1', 'shipping', 'ro-owner', 'pe-noor'),
    as('as-2', 'pf', 'ro-lead', 'pe-omar'),
    as('as-3', 'pf', 'ro-coach', 'pe-zara'),
    as('as-4', 'tt', 'ro-po', 'pe-sara'),
    as('as-5', 'tt', 'ro-dev', 'pe-sara'),
    as('as-6', 'rp', 'ro-po', 'pe-tim'),
    as('as-7', 'rp', 'ro-dev', 'pe-kees'),
    as('as-8', 'rp', 'ro-dev', 'pe-ilse'),
  ],
  roles, unitTypes: [domain, cluster, team],
}

const find = (chart: OrgChart, id: string): ChartUnit => [...walk(chart.roots)].find((one) => one.id === id)!
const slot = (chart: OrgChart, unitId: string, roleId: string) => find(chart, unitId).slots.find((one) => one.roleId === roleId)!

describe('laying the organisation chart out', () => {
  it('counts every vacancy of every unit drawn, once, for the chart\'s summary', () => {
    const chart = orgChart(shipping, TODAY)
    // Operations has no lead; Track & Trace is one developer short; Line Maintenance has nobody at all.
    expect(vacanciesIn(chart)).toBe(1 + 1 + 3)
    expect(vacanciesIn(orgChart(shipping, TODAY, { root: 'rp' }))).toBe(0)
    expect(vacanciesIn({ roots: [], units: 0, people: 0 })).toBe(0)
  })

  it('calls a role optional and empty where its minimum asks for nobody and nobody holds it — never a vacancy, never one held', () => {
    const chart = orgChart(shipping, TODAY)
    // Operations' coach: optional, nobody.
    expect(emptyOptional(slot(chart, 'ops', 'ro-coach'))).toBe(true)
    // Parcel & Freight's coach: optional, held.
    expect(emptyOptional(slot(chart, 'pf', 'ro-coach'))).toBe(false)
    // Operations' lead: required and empty, a vacancy, which is always drawn.
    expect(emptyOptional(slot(chart, 'ops', 'ro-lead'))).toBe(false)
    // Track & Trace's developers: one short, with one in it.
    expect(emptyOptional(slot(chart, 'tt', 'ro-dev'))).toBe(false)
  })

  it('gives a whole row to a unit drawn with units under it, and a cell to one drawn without — no units, or folded', () => {
    const chart = orgChart(shipping, TODAY)
    const open = new Set<string>()
    expect(drawsUnitsBelow(find(chart, 'shipping'), open)).toBe(true)
    expect(drawsUnitsBelow(find(chart, 'pf'), open)).toBe(true)
    expect(drawsUnitsBelow(find(chart, 'tt'), open)).toBe(false)
    expect(drawsUnitsBelow(find(chart, 'pf'), new Set(['pf']))).toBe(false)
    // A team folded is a team: folding something with nothing under it changes nothing.
    expect(drawsUnitsBelow(find(chart, 'tt'), new Set(['tt']))).toBe(false)
  })
})
