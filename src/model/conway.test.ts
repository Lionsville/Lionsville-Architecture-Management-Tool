// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Conway map on a day (ADR-0036 §7): the units over the applications
 * they own, the interfaces between them, and the four findings — a crossing
 * with nothing declared, an interaction nothing needs, an application nobody
 * owns, a unit over its type's limit. One fictional organisation, Acme
 * Logistics.
 */
import { describe, expect, it } from 'vitest'
import { conwayMap, pairBetween } from './conway'
import type { ConwayApplication, ConwayInput, ConwayInteraction, ConwayRow } from './conway'
import type { DesignElement } from './types'

function unit(id: string, name: string, unitTypeId: string, parentId?: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId, ...(parentId ? { parentId } : {}), ...over }
}

const units = [
  unit('customer', 'Customer', 'ut-domain'),
  unit('sales', 'Digital Sales', 'ut-cluster', 'customer'),
  unit('web', 'Webshop', 'ut-team', 'sales'),
  unit('mob', 'Mobile App', 'ut-team', 'sales'),
  unit('shipping', 'Shipping', 'ut-domain'),
  unit('pf', 'Parcel & Freight', 'ut-cluster', 'shipping', { lifecycleDates: { retired: '2027-01-01' } }),
  unit('tt', 'Track & Trace', 'ut-team', 'pf'),
  unit('data', 'Data & Integration', 'ut-cluster'),
  unit('ip', 'Integration Platform', 'ut-team', 'data'),
]
const applications: ConwayApplication[] = [
  { id: 'a-web', name: 'Webshop', partyId: 'web' },
  { id: 'a-ord', name: 'Order Service', partyId: 'web' },
  { id: 'a-crm', name: 'CRM', partyId: 'web' },
  { id: 'a-pay', name: 'Payments', partyId: 'web' },
  { id: 'a-mob', name: 'Mobile App', partyId: 'mob' },
  { id: 'a-ttp', name: 'Track & Trace Portal', partyId: 'tt' },
  { id: 'a-hub', name: 'Integration Hub', partyId: 'ip' },
  { id: 'a-bil', name: 'Billing' },
]
const row = (id: string, sourceId: string, targetId: string, over: Partial<ConwayRow> = {}): ConwayRow => ({ id, sourceId, targetId, ...over })
const flows = [
  row('f-1', 'a-web', 'a-ord'),
  row('f-2', 'a-mob', 'a-ttp'),
  row('f-3', 'a-ord', 'a-hub'),
  row('f-4', 'a-ord', 'a-bil'),
  row('f-5', 'a-mob', 'a-ord'),
  row('f-6', 'a-ttp', 'a-hub', { validUntil: '2026-06-30' }),
  row('f-7', 'a-hub', 'elsewhere'),
]
const interactions: ConwayInteraction[] = [
  { id: 'i-1', sourceId: 'sales', targetId: 'data', mode: 'service' },
  { id: 'i-2', sourceId: 'pf', targetId: 'data', mode: 'service' },
  { id: 'i-3', sourceId: 'web', targetId: 'mob', mode: 'collaboration', validFrom: '2027-03-01' },
]
const input: ConwayInput = {
  units,
  unitTypes: [
    { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [] },
    { id: 'ut-cluster', name: 'Cluster', top: true, within: ['ut-domain'], slots: [] },
    { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [], limit: 3 },
  ],
  applications, flows, interactions,
}
const TODAY = '2026-10-11'

describe('the Conway map', () => {
  it('puts each application under the unit that owns it, in the tree order, and the ones nobody owns last', () => {
    const map = conwayMap(input, TODAY)
    // The domains before the cluster filed at the top, as every list of units reads (3.6.1).
    expect(map.groups.map((group) => group.unitId)).toEqual(['mob', 'web', 'tt', 'ip', undefined])
    expect(map.groups[1].applications.map((app) => app.name)).toEqual(['CRM', 'Order Service', 'Payments', 'Webshop'])
    expect(map.groups[4].applications.map((app) => app.id)).toEqual(['a-bil'])
  })

  it('takes its columns in the order every list of units reads: the type\'s rank, the unit\'s own order, then the name', () => {
    const ordered = { ...input, units: units.map((one) => (one.id === 'web' ? { ...one, order: 1 } : one.id === 'data' ? { ...one, order: 1 } : one)) }
    expect(conwayMap(ordered, TODAY).groups.map((group) => group.unitId)).toEqual(['web', 'mob', 'tt', 'ip', undefined])
    // A type's rank comes before a unit's own order: the cluster stays after the domains.
    expect(conwayMap(ordered, TODAY, { groupBy: 'ut-cluster' }).groups.map((group) => group.unitId)).toEqual(['sales', 'pf', 'data', undefined])
  })

  it('groups by the unit of a type above the owner, where asked', () => {
    const map = conwayMap(input, TODAY, { groupBy: 'ut-cluster' })
    expect(map.groups.map((group) => group.unitId)).toEqual(['sales', 'pf', 'data', undefined])
    const domains = conwayMap(input, TODAY, { groupBy: 'ut-domain' })
    // A cluster filed at the top has no domain above it: it is grouped under itself, the top of its tree.
    expect(domains.groups.map((group) => group.unitId)).toEqual(['customer', 'shipping', 'data', undefined])
  })

  it('says how each interface lies: inside a unit, declared, undeclared, or with an end nobody owns', () => {
    const status = Object.fromEntries(conwayMap(input, TODAY).lines.map((line) => [line.flow.id, line.status]))
    expect(status).toEqual({ 'f-1': 'inside', 'f-2': 'undeclared', 'f-3': 'declared', 'f-4': 'unowned', 'f-5': 'undeclared' })
  })

  it('counts an interaction declared between units above the owners, and names the one that covers a line', () => {
    const line = conwayMap(input, TODAY).lines.find((one) => one.flow.id === 'f-3')!
    expect(line.interaction?.id).toBe('i-1')
    expect(line).toMatchObject({ from: 'web', to: 'ip' })
  })

  it('finds an interface across units with nothing declared, an interaction nothing needs, and an application nobody owns', () => {
    const findings = conwayMap(input, TODAY).findings
    expect(findings.filter((one) => one.kind === 'undeclared').map((one) => one.kind === 'undeclared' && one.flow.id)).toEqual(['f-2', 'f-5'])
    expect(findings.filter((one) => one.kind === 'unused').map((one) => one.kind === 'unused' && one.interaction.id)).toEqual(['i-2'])
    expect(findings.filter((one) => one.kind === 'unowned')).toEqual([{ kind: 'unowned', applicationId: 'a-bil' }])
  })

  it('finds a unit over its type limit, counted across the organisation where the caller says', () => {
    expect(conwayMap(input, TODAY).findings.filter((one) => one.kind === 'overLimit'))
      .toEqual([{ kind: 'overLimit', unitId: 'web', owns: 4, limit: 3 }])
    const counted = conwayMap({ ...input, owns: (id) => (id === 'tt' ? 5 : 1) }, TODAY)
    expect(counted.findings.filter((one) => one.kind === 'overLimit')).toEqual([{ kind: 'overLimit', unitId: 'tt', owns: 5, limit: 3 }])
  })

  it('is on a day: an interaction from its first day, a unit ended owning nothing, its interaction gone with it', () => {
    const later = conwayMap(input, '2027-03-01')
    const status = Object.fromEntries(later.lines.map((line) => [line.flow.id, line.status]))
    // Webshop and Mobile App now declare a collaboration; Track & Trace's cluster has ended, but the team is there.
    expect(status['f-5']).toBe('declared')
    expect(later.interactions.map((one) => one.id)).toEqual(['i-1', 'i-3'])
    expect(later.findings.some((one) => one.kind === 'unused' && one.interaction.id === 'i-2')).toBe(false)
  })

  it('groups by the parent a plan\'s move gives a unit on the day (ADR-0036 §6)', () => {
    const moved = { ...input, moves: [{ unitId: 'mob', parentId: 'data', on: '2027-03-01' }] }
    expect(conwayMap(moved, TODAY, { groupBy: 'ut-cluster' }).groups.map((group) => group.unitId)).toEqual(['sales', 'pf', 'data', undefined])
    const later = conwayMap(moved, '2027-03-01', { groupBy: 'ut-cluster' })
    expect(later.groups.find((group) => group.unitId === 'data')?.applications.map((app) => app.id).sort()).toEqual(['a-hub', 'a-mob'])
  })

  it('takes a unit that is not there on the day as owning nothing', () => {
    const gone = conwayMap({ ...input, units: [...units.filter((one) => one.id !== 'tt'), unit('tt', 'Track & Trace', 'ut-team', 'pf', { lifecycleDates: { retired: '2026-09-01' } })] }, TODAY)
    expect(gone.findings).toContainEqual({ kind: 'unowned', applicationId: 'a-ttp' })
    expect(gone.lines.find((one) => one.flow.id === 'f-2')?.status).toBe('unowned')
  })

  it('reads a flow outside its window, or to an application the map is not of, as no interface', () => {
    const ids = conwayMap(input, TODAY).lines.map((line) => line.flow.id)
    expect(ids).not.toContain('f-6')
    expect(ids).not.toContain('f-7')
    expect(conwayMap(input, '2026-06-30').lines.map((line) => line.flow.id)).toContain('f-6')
  })

  /** An application is on the map while it is there by its lifecycle on the day (ADR-0009), as a unit is. */
  it('leaves off an application not yet live or gone on the day, its interfaces with it, and finds nothing about it', () => {
    const dated = applications.map((app): ConwayApplication => {
      if (app.id === 'a-bil') return { ...app, lifecycle: 'planned', lifecycleDates: { live: '2027-01-01' } }
      if (app.id === 'a-pay') return { ...app, lifecycleDates: { retired: '2026-10-01' } }
      return app
    })
    const map = conwayMap({ ...input, applications: dated }, TODAY)
    const drawn = map.groups.flatMap((group) => group.applications.map((app) => app.id))
    expect(drawn).not.toContain('a-bil')
    expect(drawn).not.toContain('a-pay')
    expect(map.lines.map((line) => line.flow.id)).not.toContain('f-4')
    expect(map.findings).not.toContainEqual({ kind: 'unowned', applicationId: 'a-bil' })
    // Webshop's team owns three on the day, which is its limit.
    expect(map.findings.filter((one) => one.kind === 'overLimit')).toEqual([])
    // From its first day live, Billing is on the map, and nobody owns it.
    const later = conwayMap({ ...input, applications: dated }, '2027-01-01')
    expect(later.findings).toContainEqual({ kind: 'unowned', applicationId: 'a-bil' })
    expect(later.lines.find((line) => line.flow.id === 'f-4')?.status).toBe('unowned')
  })

  it('asks the caller for what a unit owns on the map\'s own day', () => {
    const days: string[] = []
    conwayMap({ ...input, owns: (_id, day) => { days.push(day); return 0 } }, '2027-02-01')
    expect(new Set(days)).toEqual(new Set(['2027-02-01']))
  })

  it('holds a cell for each two columns: the interfaces between them, and what is declared there whether or not one runs', () => {
    const cells = (map: ReturnType<typeof conwayMap>) => map.pairs.map((pair) => [
      pair.a ?? null, pair.b ?? null, pair.interfaces, pair.interactions.map((one) => one.id), pair.state,
    ])
    // Sales' interaction with Data covers each of its teams: Mobile App's cell with Integration Platform holds it with
    // no interface there, and it is not unused, since Webshop's interface needs it.
    expect(cells(conwayMap(input, TODAY))).toEqual([
      ['mob', 'web', 1, [], 'undeclared'],
      ['mob', 'tt', 1, [], 'undeclared'],
      ['mob', 'ip', 0, ['i-1'], 'declared'],
      ['web', 'ip', 1, ['i-1'], 'declared'],
      ['web', null, 1, [], 'unowned'],
      ['tt', 'ip', 0, ['i-2'], 'unused'],
    ])
    // By domain, an interaction between units under two columns is declared between those columns.
    expect(cells(conwayMap(input, TODAY, { groupBy: 'ut-domain' }))).toEqual([
      ['customer', 'shipping', 1, [], 'undeclared'],
      ['customer', 'data', 1, ['i-1'], 'declared'],
      ['customer', null, 1, [], 'unowned'],
      ['shipping', 'data', 0, ['i-2'], 'unused'],
    ])
  })

  it('finds the cell between two columns either way round, and none where nothing runs or is declared', () => {
    const between = pairBetween(conwayMap(input, TODAY))
    expect(between('tt', 'ip')?.state).toBe('unused')
    expect(between('ip', 'tt')).toBe(between('tt', 'ip'))
    expect(between(undefined, 'web')?.state).toBe('unowned')
    expect(between('tt', undefined)).toBeUndefined()
  })

  it('reads an interaction with an end that is not a unit as nothing declared', () => {
    const map = conwayMap({ ...input, interactions: [{ id: 'i-x', sourceId: 'mob', targetId: 'somebody' }] }, TODAY)
    expect(map.interactions).toEqual([])
  })
})
