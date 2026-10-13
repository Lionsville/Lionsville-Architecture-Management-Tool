// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart on a day (ADR-0036 §7): the tree, the slots against
 * who holds them, the vacancies, the people over all of their time, and the
 * people left in a unit that has ended. One fictional organisation, Acme
 * Logistics.
 */
import { describe, expect, it } from 'vitest'
import type { Role, UnitType } from './operatingModel'
import { orgChart, overAllOfTheirTime, unitsHolding, walk } from './orgChart'
import type { ChartUnit } from './orgChart'
import type { DesignElement } from './types'
import type { Assignment, Organisation } from './units'

const domain: UnitType = { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [{ role: 'ro-owner', min: 1, max: 1 }] }
const cluster: UnitType = {
  id: 'ut-cluster', name: 'Cluster', top: true, within: ['ut-domain'], spans: true,
  slots: [{ role: 'ro-lead', min: 1, max: 1 }, { role: 'ro-rel', min: 0, max: 1 }],
}
const team: UnitType = {
  id: 'ut-team', name: 'Team', within: ['ut-cluster'],
  slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 3 }],
}
const roles: Role[] = [
  { id: 'ro-owner', name: 'Domain owner', duties: [], manages: true },
  { id: 'ro-lead', name: 'Cluster lead', duties: [], manages: true },
  { id: 'ro-po', name: 'Product owner', duties: [], manages: true },
  { id: 'ro-dev', name: 'Developer', duties: [] },
  { id: 'ro-coach', name: 'Team coach', duties: [] },
  { id: 'ro-rel', name: 'Release manager', duties: [], until: '2026-12-31' },
]

function unit(id: string, name: string, unitTypeId: string | undefined, parentId?: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {},
    ...(unitTypeId ? { unitTypeId } : {}), ...(parentId ? { parentId } : {}), ...over,
  }
}

let next = 0
function held(unitId: string, roleId: string, person: string, over: Partial<Assignment> = {}): Assignment {
  next += 1
  return { id: `as-${next}`, unitId, roleId, person: { person }, ...over }
}

const units = [
  unit('shipping', 'Shipping', 'ut-domain'),
  unit('pf', 'Parcel & Freight', 'ut-cluster', 'shipping', { lifecycleDates: { retired: '2027-01-01' } }),
  unit('parcel', 'Parcel', 'ut-cluster', 'shipping', { lifecycle: 'planned', lifecycleDates: { live: '2027-01-01' } }),
  unit('tt', 'Track & Trace', 'ut-team', 'pf'),
  unit('rp', 'Route Planning', 'ut-team', 'pf', { extraSlots: [{ role: 'ro-coach', min: 0, max: 1 }] }),
  unit('data', 'Data & Integration', 'ut-cluster', undefined, { scopes: ['customer', 'shipping', 'warehouse'] }),
  unit('stakeholders', 'Stakeholders', undefined),
]
const assignments = [
  held('shipping', 'ro-owner', 'pe-noor'),
  held('pf', 'ro-lead', 'pe-omar'),
  held('pf', 'ro-rel', 'pe-ruben'),
  held('tt', 'ro-po', 'pe-sara'),
  held('tt', 'ro-dev', 'pe-tim'),
  held('tt', 'ro-dev', 'pe-yara', { share: 0.5 }),
  held('tt', 'ro-dev', 'pe-yara-old'),
  held('rp', 'ro-po', 'pe-pia', { share: 0.5 }),
  held('rp', 'ro-dev', 'pe-pia', { share: 0.75 }),
  held('rp', 'ro-dev', 'pe-lars', { from: '2027-02-01' }),
  held('data', 'ro-lead', 'pe-kees'),
]
const organisation: Organisation = { units, assignments, roles, unitTypes: [domain, cluster, team] }
const TODAY = '2026-10-11'

function find(chart: { roots: readonly ChartUnit[] }, id: string): ChartUnit {
  const found = [...walk(chart.roots)].find((one) => one.id === id)
  if (!found) throw new Error(`no ${id} on the chart`)
  return found
}

describe('the organisation chart', () => {
  it('draws every unit of a loop the plans\' moves make, the first in order at the top, rather than none of them', () => {
    const looped: Organisation = {
      ...organisation,
      units: [unit('a', 'A', 'ut-team'), unit('b', 'B', 'ut-team', 'a'), unit('c', 'C', 'ut-team', 'b'), unit('z', 'Z', 'ut-team')],
      assignments: [], moves: [{ unitId: 'a', parentId: 'b', on: '2027-01-01' }],
    }
    expect(orgChart(looped, '2026-12-31').units).toBe(4)
    const after = orgChart(looped, '2027-01-01')
    expect(after.units).toBe(4)
    expect(after.roots.map((one) => one.id)).toEqual(['a', 'z'])
    expect(find(after, 'c').id).toBe('c')
  })

  it('is the units as a tree by parentId, siblings by their type\'s rank and then by name, and an actor with no type is not on it', () => {
    const chart = orgChart(organisation, TODAY)
    // A domain is in the first lane and a cluster, which may sit in one, in the second: Shipping before Data.
    expect(chart.roots.map((one) => one.id)).toEqual(['shipping', 'data'])
    expect(find(chart, 'shipping').children.map((one) => one.id)).toEqual(['pf'])
    expect(find(chart, 'pf').children.map((one) => one.id)).toEqual(['rp', 'tt'])
    expect([...walk(chart.roots)].some((one) => one.id === 'stakeholders')).toBe(false)
    expect(chart.units).toBe(5)
  })

  it('puts siblings of one type in their own order before their names, and the types in theirs', () => {
    const ordered = units.map((one) => (one.id === 'tt' ? { ...one, order: 1 } : one))
    const chart = orgChart({ ...organisation, units: ordered }, TODAY)
    expect(find(chart, 'pf').children.map((one) => one.id)).toEqual(['tt', 'rp'])
    // A cluster that sits only at the top, put before the domains in the first lane.
    const first = orgChart({ ...organisation, unitTypes: [{ ...domain, order: 2 }, { ...cluster, within: [], order: 1 }, team] }, TODAY)
    expect(first.roots.map((one) => one.id)).toEqual(['data', 'shipping'])
  })

  it('says the domains a unit serves and the days its dates say', () => {
    const chart = orgChart(organisation, TODAY)
    expect(find(chart, 'data').serves).toEqual(['customer', 'shipping', 'warehouse'])
    expect(find(chart, 'pf').ends).toBe('2026-12-31')
    // The organisation is no domain: a `""` an older write left is not said.
    const older = orgChart({ ...organisation, units: organisation.units.map((one) => (one.id === 'data' ? { ...one, scopes: ['', 'shipping'] } : one)) }, TODAY)
    expect(find(older, 'data').serves).toEqual(['shipping'])
  })

  it('draws each slot against who holds it on the day, with the vacancies its minimum leaves', () => {
    const tt = find(orgChart(organisation, TODAY), 'tt')
    const po = tt.slots.find((slot) => slot.roleId === 'ro-po')!
    const dev = tt.slots.find((slot) => slot.roleId === 'ro-dev')!
    expect(po.holders.map((one) => one.person)).toEqual(['pe-sara'])
    expect(po).toMatchObject({ vacant: 0, room: false, extra: false })
    expect(dev.holders.map((one) => one.person)).toEqual(['pe-tim', 'pe-yara', 'pe-yara-old'])
    expect(dev).toMatchObject({ vacant: 0, room: true })
    const rp = find(orgChart(organisation, TODAY), 'rp')
    expect(rp.slots.find((slot) => slot.roleId === 'ro-dev')).toMatchObject({ vacant: 2 })
    expect(rp.slots.find((slot) => slot.roleId === 'ro-coach')).toMatchObject({ vacant: 0, room: true, extra: true, holders: [] })
  })

  it('counts an assignment that has not begun on the day as nobody, and fills the vacancy on the day it does', () => {
    const later = find(orgChart(organisation, '2027-02-01'), 'rp')
    expect(later.slots.find((slot) => slot.roleId === 'ro-dev')).toMatchObject({ vacant: 1 })
  })

  it('marks a person whose assignments take more than all of their time, across the organisation', () => {
    const chart = orgChart(organisation, TODAY)
    const rp = find(chart, 'rp')
    expect(rp.slots.flatMap((slot) => slot.holders).filter((one) => one.overloaded).map((one) => one.person)).toEqual(['pe-pia', 'pe-pia'])
    expect(find(chart, 'tt').slots.flatMap((slot) => slot.holders).some((one) => one.overloaded)).toBe(false)
  })

  it('holds over all of their time to more than all of it: thirds that add up to a hair over one are not over', () => {
    expect(overAllOfTheirTime(1)).toBe(false)
    expect(overAllOfTheirTime(1 / 3 + 1 / 3 + 1 / 3 + 1e-12)).toBe(false)
    expect(overAllOfTheirTime(1.2)).toBe(true)
  })

  it('counts two ids of one person as one, through the register', () => {
    const canonical = (id: string) => (id === 'pe-yara-old' ? 'pe-yara' : id)
    const chart = orgChart(organisation, TODAY, { canonical })
    const devs = find(chart, 'tt').slots.find((slot) => slot.roleId === 'ro-dev')!.holders
    expect(devs.map((one) => one.person)).toEqual(['pe-tim', 'pe-yara', 'pe-yara'])
    expect(devs.filter((one) => one.overloaded)).toHaveLength(2)
    expect(chart.people).toBe(8)
    expect(orgChart(organisation, TODAY).people).toBe(9)
  })

  it('draws a unit not there yet from its first day, and a unit that has ended only while somebody is left in it', () => {
    const before = orgChart(organisation, TODAY)
    expect([...walk(before.roots)].some((one) => one.id === 'parcel')).toBe(false)
    const after = orgChart(organisation, '2027-01-01')
    expect(find(after, 'parcel').begins).toBe('2027-01-01')
    const ended = find(after, 'pf')
    expect(ended.ended).toBe(true)
    expect(ended.slots.flatMap((slot) => slot.holders).map((one) => one.person)).toEqual(['pe-omar'])
    // Its teams are still under it, where the reorganisation left them.
    expect(ended.children.map((one) => one.id)).toEqual(['rp', 'tt'])
    const cleared = orgChart({ ...organisation, assignments: assignments.filter((one) => one.unitId !== 'pf') }, '2027-01-01')
    expect([...walk(cleared.roots)].some((one) => one.id === 'pf')).toBe(false)
    // With the cluster gone, its teams sit under the nearest unit above that is drawn.
    expect(find(cleared, 'shipping').children.map((one) => one.id)).toEqual(['parcel', 'rp', 'tt'])
  })

  it('asks nobody for a role that has ended, and lists who still holds it beside the slots', () => {
    const after = orgChart(organisation, '2027-01-01')
    const pf = find(after, 'pf')
    expect(pf.slots.map((slot) => slot.roleId)).toEqual(['ro-lead'])
    expect(pf.others.map((one) => [one.person, one.endedRole])).toEqual([['pe-ruben', true]])
    expect(find(orgChart(organisation, TODAY), 'pf').others).toEqual([])
  })

  it('is of the units it includes and every unit below them, or of one unit and those below it', () => {
    const filed = new Map([['shipping', 'shipping'], ['pf', 'shipping'], ['tt', 'shipping'], ['rp', 'shipping'], ['data', '']])
    const shipping = orgChart(organisation, TODAY, { include: (one) => filed.get(one.id) === 'shipping' || (one.scopes ?? []).includes('shipping') })
    expect(shipping.roots.map((one) => one.id)).toEqual(['shipping', 'data'])
    const onlyPf = orgChart(organisation, TODAY, { root: 'pf' })
    expect(onlyPf.roots.map((one) => one.id)).toEqual(['pf'])
    expect([...walk(onlyPf.roots)].map((one) => one.id)).toEqual(['pf', 'rp', 'tt'])
    expect(orgChart(organisation, TODAY, { root: 'nobody' }).roots).toEqual([])
  })

  it('finds where a person holds a role, in the chart order', () => {
    const chart = orgChart(organisation, TODAY)
    expect(unitsHolding(chart, 'pe-pia')).toEqual(['rp'])
    expect(unitsHolding(chart, 'pe-omar')).toEqual(['pf'])
    expect(unitsHolding(chart, 'pe-nobody')).toEqual([])
    expect(unitsHolding(orgChart(organisation, '2027-01-01'), 'pe-ruben')).toEqual(['pf'])
  })

  it('puts each unit under the parent a plan\'s move gives it on the day (ADR-0036 §6)', () => {
    const moved: Organisation = { ...organisation, moves: [{ unitId: 'tt', parentId: 'parcel', on: '2027-01-01' }] }
    expect(find(orgChart(moved, TODAY), 'pf').children.map((one) => one.id)).toEqual(['rp', 'tt'])
    const after = orgChart(moved, '2027-01-01')
    expect(find(after, 'parcel').children.map((one) => one.id)).toEqual(['tt'])
    expect(find(after, 'pf').children.map((one) => one.id)).toEqual(['rp'])
  })

  it('asks nobody for a role of a unit type that has ended, and draws its holders beside the slots', () => {
    const ended: Organisation = { ...organisation, unitTypes: [domain, cluster, { ...team, until: '2026-12-31' }] }
    const tt = find(orgChart(ended, '2027-01-01'), 'tt')
    expect(tt.slots).toEqual([])
    expect(tt.others.map((one) => one.person)).toEqual(['pe-sara', 'pe-tim', 'pe-yara', 'pe-yara-old'])
  })

  it('draws a loop in the tree once, and never hangs on it', () => {
    const looped = [unit('a', 'A', 'ut-team', 'b'), unit('b', 'B', 'ut-team', 'a')]
    const chart = orgChart({ ...organisation, units: looped, assignments: [] }, TODAY)
    expect([...walk(chart.roots)].length).toBeLessThanOrEqual(2)
  })
})
