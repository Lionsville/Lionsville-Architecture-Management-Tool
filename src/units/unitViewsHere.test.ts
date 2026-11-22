// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the organisation chart and the Conway map in a scope are of (ADR-0036
 * §7), and where a link to a unit lands. One fictional organisation, Acme
 * Logistics: a cluster at the root serving two domains, a shipping domain.
 */
import { describe, expect, it } from 'vitest'
import type { HostModel } from '../../model/hostModel'
import type { DesignElement } from '../../model/types'
import { indexScopes } from '../../projects/scopeIndex'
import { conwayMap } from '../../model/conway'
import { conwayInputAround, conwayInputHere, unitLanding, unitViewsHere } from './unitViewsHere'

const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const ROOT: HostModel = {
  name: 'Acme Logistics', relations: [], diagrams: [],
  elements: [actor('data', 'Data & Integration', { unitTypeId: 'ut-cluster', scopes: ['shipping', 'warehouse'] }), actor('board', 'Board', { unitTypeId: 'ut-cluster' })],
}
const SHIPPING: HostModel = {
  name: 'Shipping', relations: [],
  elements: [actor('shipping', 'Shipping', { unitTypeId: 'ut-domain' }), actor('crew', 'Crew'), actor('tt-copy', 'Track & Trace', { ref: 'shipping/parcel', unitTypeId: 'ut-team' })],
  diagrams: [{ id: 'oc-1', kind: 'chart', name: 'Organisation', members: [] }],
}
const index = indexScopes([{ path: '', model: ROOT }, { path: 'shipping', model: SHIPPING }])

describe('what a view in a scope is of', () => {
  it('is the units filed there or below, and those serving it from above', () => {
    const here = unitViewsHere(index, 'shipping', SHIPPING)
    const units = here.at.organisation.units
    expect(units.filter(here.includes).map((unit) => unit.id).sort()).toEqual(['data', 'shipping'])
    const atRoot = unitViewsHere(index, '', ROOT)
    expect(atRoot.at.organisation.units.filter(atRoot.includes).map((unit) => unit.id).sort()).toEqual(['board', 'data', 'shipping'])
  })

  it('knows where each is kept, which the open scope holds, and what each is called', () => {
    const here = unitViewsHere(index, 'shipping', SHIPPING)
    expect(here.scopeOf('data')).toBe('')
    expect(here.scopeOf('shipping')).toBe('shipping')
    expect(here.heldHere('shipping')).toBe(true)
    expect(here.heldHere('data')).toBe(false)
    expect(here.name('data')).toBe('Data & Integration')
    expect(here.name('nobody')).toBe('nobody')
  })
})

describe('the plans that bring a unit and end it', () => {
  const plan = (id: string, number: number, elements: { elementId: string; role: 'introduces' | 'retires' }[], status: 'agreed' | 'abandoned' = 'agreed') => ({
    id, number, title: id, status, elements, decisions: [], milestones: [], body: '',
  })

  it('reads the open scope\'s plans off its session and every other scope\'s off the index, the first of each', () => {
    const root: HostModel = { ...ROOT, transitions: [plan('tr-r', 3, [{ elementId: 'data', role: 'retires' }])] }
    // What the index read of this scope is the session's to say: a plan taken off since is not read.
    const read: HostModel = { ...SHIPPING, transitions: [plan('tr-old', 9, [{ elementId: 'shipping', role: 'introduces' }])] }
    const tree = indexScopes([{ path: '', model: root }, { path: 'shipping', model: read }])
    const session: HostModel = {
      ...SHIPPING,
      transitions: [plan('tr-1', 1, [{ elementId: 'shipping', role: 'introduces' }, { elementId: 'shipping', role: 'retires' }]), plan('tr-2', 2, [{ elementId: 'shipping', role: 'retires' }])],
    }
    const here = unitViewsHere(tree, 'shipping', session)
    expect(here.plansOf('shipping')).toEqual({ introduces: { id: 'tr-1', number: 1 }, retires: { id: 'tr-1', number: 1 } })
    expect(here.plansOf('data')).toEqual({ retires: { id: 'tr-r', number: 3 } })
    expect(here.plansOf('board')).toEqual({})
  })

  it('takes nothing from an abandoned plan', () => {
    const session: HostModel = { ...SHIPPING, transitions: [plan('tr-1', 1, [{ elementId: 'shipping', role: 'introduces' }], 'abandoned')] }
    expect(unitViewsHere(index, 'shipping', session).plansOf('shipping')).toEqual({})
  })
})

/**
 * A Conway map reads each application's lifecycle on its day (ADR-0009),
 * whichever scope keeps it — the index carries the master's — and counts what
 * a unit owns on that day too.
 */
describe('a Conway map in a scope, on its day', () => {
  const app = (id: string, over: Partial<DesignElement> = {}): DesignElement => ({
    id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, partyId: 'shipping', ...over,
  })
  const kept = { ...SHIPPING, elements: [...SHIPPING.elements, app('here')] }
  const below: HostModel = {
    name: 'Parcel', relations: [], diagrams: [],
    elements: [app('gone', { lifecycleDates: { retired: '2026-09-01' } }), app('coming', { lifecycle: 'planned', lifecycleDates: { live: '2027-01-01' } })],
  }
  const tree = indexScopes([{ path: '', model: ROOT }, { path: 'shipping', model: kept }, { path: 'shipping/parcel', model: below }])

  it('carries the lifecycle of an application another scope keeps, and leaves off what is not there on the day', () => {
    const here = unitViewsHere(tree, 'shipping', kept)
    const input = conwayInputHere(tree, 'shipping', kept, here, '2026-10-11')
    expect(input.applications.find((one) => one.id === 'coming')).toMatchObject({ lifecycle: 'planned', lifecycleDates: { live: '2027-01-01' } })
    const drawn = (day: string) => conwayMap(input, day).groups.flatMap((group) => group.applications.map((one) => one.id)).sort()
    expect(drawn('2026-10-11')).toEqual(['here'])
    expect(drawn('2027-01-01')).toEqual(['coming', 'here'])
    expect(input.owns?.('shipping', '2026-10-11')).toBe(1)
    expect(input.owns?.('shipping', '2027-01-01')).toBe(2)
    expect(here.at.owns('shipping')).toBe(3)
  })
})

/**
 * Around some units, across the organisation (ADR-0036 §6): what a plan's day
 * is held against reads their applications wherever each is filed, and the
 * applications at the other end of their interfaces, from whichever scope.
 */
describe('a Conway map around some units', () => {
  const app = (id: string, partyId?: string): DesignElement => ({
    id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...(partyId ? { partyId } : {}),
  })
  const root: HostModel = { ...ROOT, elements: [...ROOT.elements, app('hub', 'data'), app('ledger', 'board')] }
  const flow = (id: string, sourceId: string, targetId: string) => ({ id, type: 'flow' as const, sourceId, targetId, isBidirectional: false })
  const open: HostModel = {
    ...SHIPPING,
    elements: [...SHIPPING.elements, app('portal', 'shipping'), app('desk', 'crew'), app('old')],
    relations: [flow('f-1', 'portal', 'hub'), flow('f-2', 'desk', 'old'), flow('f-3', 'portal', 'old')],
  }
  const below: HostModel = { name: 'Parcel', relations: [flow('f-4', 'labels', 'portal')], diagrams: [], elements: [app('labels', 'nobody-here')] }
  const tree = indexScopes([{ path: '', model: root }, { path: 'shipping', model: open }, { path: 'shipping/parcel', model: below }])

  it('reads what the units own and what their interfaces reach, the open scope\'s from its session', () => {
    const here = unitViewsHere(tree, 'shipping', open)
    const input = conwayInputAround(tree, 'shipping', open, here.at, new Set(['shipping']))
    expect(input.applications.map((one) => one.id).sort()).toEqual(['hub', 'labels', 'old', 'portal'])
    expect(input.flows.map((one) => one.id).sort()).toEqual(['f-1', 'f-3', 'f-4'])
    expect(input.units.map((one) => one.id).sort()).toEqual(['board', 'data', 'shipping'])
    // Gone from the session, gone from the map, whatever the index read last.
    const without = { ...open, elements: open.elements.filter((one) => one.id !== 'old') }
    expect(conwayInputAround(tree, 'shipping', without, here.at, new Set(['shipping'])).applications.map((one) => one.id).sort())
      .toEqual(['hub', 'labels', 'portal'])
  })
})

describe('where a link to a unit lands', () => {
  it('lands on the scope\'s organisation chart with the unit chosen, where there is one', () => {
    expect(unitLanding(SHIPPING, { page: 'element', id: 'shipping' })).toEqual({ page: 'chart', id: 'oc-1', select: 'shipping' })
  })

  it('leaves every other link where it was going: an actor with no type, a stand-in, a scope with no chart, another page', () => {
    expect(unitLanding(SHIPPING, { page: 'element', id: 'crew' })).toEqual({ page: 'element', id: 'crew' })
    expect(unitLanding(SHIPPING, { page: 'element', id: 'tt-copy' })).toEqual({ page: 'element', id: 'tt-copy' })
    expect(unitLanding({ ...SHIPPING, diagrams: [] }, { page: 'element', id: 'shipping' })).toEqual({ page: 'element', id: 'shipping' })
    expect(unitLanding(SHIPPING, { page: 'document', id: 'shipping' })).toEqual({ page: 'document', id: 'shipping' })
  })
})
