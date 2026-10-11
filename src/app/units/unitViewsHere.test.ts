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
import { unitLanding, unitViewsHere } from './unitViewsHere'

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
