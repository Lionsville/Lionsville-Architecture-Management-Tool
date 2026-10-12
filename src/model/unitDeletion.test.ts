// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { UnitType } from './operatingModel'
import type { DesignElement, Relation } from './types'
import type { Assignment } from './units'
import { deletionWorld, intoOf, openStep, unitDeletion, unitsChoiceOf } from './unitDeletion'

const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})

const TYPES: UnitType[] = [
  { id: 'ut-division', name: 'Division', top: true, within: [], slots: [] },
  { id: 'ut-team', name: 'Team', within: ['ut-division'], slots: [] },
]

/**
 * Acme Logistics: North and South at the top, Booking in North kept here
 * with a party in it, Rates in North kept in Shipping, and Quotes inside
 * Rates; Shipping keeps an application of North's and a row from North to a
 * capability; an assignment in North and one in Rates.
 */
function world(types: UnitType[] = TYPES) {
  const elements = [
    actor('north', 'North', { unitTypeId: 'ut-division', scopes: ['shipping'] }),
    actor('south', 'South', { unitTypeId: 'ut-division' }),
    actor('booking', 'Booking', { unitTypeId: 'ut-team', parentId: 'north' }),
    actor('shipper', 'Shipper', { parentId: 'booking' }),
    { ...actor('east', 'East', { unitTypeId: 'ut-division' }), ref: 'shipping' },
    { id: 'portal', kind: 'application' as const, name: 'Portal', lifecycle: 'live' as const, isManaged: true, aspects: {}, partyId: 'north' },
  ]
  const here: Relation[] = [{ id: 'r-here', type: 'assigned', sourceId: 'north', targetId: 'fn-here' }]
  const elsewhere: { scope: string; relation: Relation }[] = [
    { scope: 'shipping', relation: { id: 'r-book', type: 'assigned', sourceId: 'north', targetId: 'book' } },
    { scope: 'shipping', relation: { id: 'r-quotes', type: 'assigned', sourceId: 'quotes', targetId: 'book' } },
  ]
  const assignments: Assignment[] = [{ id: 'as-1', unitId: 'north', roleId: 'ro-lead', person: { person: 'pe-ada' } }]
  return deletionWorld(
    { scope: '', elements, relations: here, assignments },
    {
      units: [
        { scope: '', unit: elements[0] },
        { scope: 'shipping', unit: actor('rates', 'Rates', { unitTypeId: 'ut-team', parentId: 'north' }) },
        { scope: 'shipping', unit: actor('quotes', 'Quotes', { unitTypeId: 'ut-team', parentId: 'rates' }) },
        { scope: 'shipping', unit: actor('east', 'East', { unitTypeId: 'ut-division' }) },
      ],
      rowsOf: (id) => elsewhere.filter((row) => row.relation.sourceId === id || row.relation.targetId === id),
      owned: [
        { scope: 'shipping', id: 'tms', name: 'TMS', kind: 'application', partyId: 'north' },
        { scope: 'shipping', id: 'svc', name: 'Rating', kind: 'platformService', partyId: 'north' },
        // The open scope's as the index read them: its session's are what count.
        { scope: '', id: 'portal', name: 'Portal (as read)', kind: 'application', partyId: 'north' },
      ],
      assignments: [
        { scope: '', assignment: assignments[0] },
        { scope: 'shipping', assignment: { id: 'as-2', unitId: 'rates', roleId: 'ro-lead', person: { person: 'pe-bo' } } },
      ],
      unitTypes: types,
    },
  )
}

describe('unitDeletion', () => {
  it('is nothing where none of the elements is a unit kept in the open scope', () => {
    expect(unitDeletion(world(), ['shipper'])).toBeUndefined()
    // A stand-in is the other scope's unit, not this one's.
    expect(unitDeletion(world(), ['east'])).toBeUndefined()
  })

  it('offers another unit of its type first where the units inside may not sit in its parent, and says what else goes', () => {
    const plan = unitDeletion(world(), ['north'], undefined, '2026-10-12')!
    expect(plan.inside.map((one) => one.id)).toEqual(['booking', 'rates'])
    expect(plan.up).toEqual({ fits: false })
    expect(plan.into.map((one) => one.id)).toEqual(['east', 'south'])
    expect(plan.initial).toBe('into:east')
    expect(plan.choice).toBe('into:east')
    expect(plan.roles).toEqual([{ person: 'pe-ada', roleId: 'ro-lead', unitId: 'north' }])
    // Only an application counts as one whose team is cleared; the service's goes too, said nowhere.
    expect(plan.applications).toEqual([{ scope: '', id: 'portal', name: 'Portal' }, { scope: 'shipping', id: 'tms', name: 'TMS' }])
    expect(plan.serves).toEqual(['shipping'])
    expect(plan.responsibleFor).toBe(2)
    expect(plan.steps.get('')).toEqual([
      { type: 'element.update', id: 'booking', patch: { parentId: 'east' } },
      { type: 'element.update', id: 'portal', patch: { partyId: undefined } },
    ])
    expect(plan.steps.get('shipping')).toEqual([
      { type: 'element.update', id: 'rates', patch: { parentId: 'east' } },
      { type: 'relation.delete', id: 'r-book' },
      { type: 'element.update', id: 'tms', patch: { partyId: undefined } },
      { type: 'element.update', id: 'svc', patch: { partyId: undefined } },
    ])
  })

  it('moves them up by default where their type may sit there, and up anyway when asked', () => {
    const fits = TYPES.map((type) => (type.id === 'ut-team' ? { ...type, top: true } : type))
    const plan = unitDeletion(world(fits), ['north'])!
    expect(plan.initial).toBe('up')
    expect(plan.up).toEqual({ fits: true })
    expect(plan.steps.get('shipping')?.[0]).toEqual({ type: 'element.update', id: 'rates', patch: { parentId: undefined } })
    const anyway = unitDeletion(world(), ['north'], 'up')!
    expect(anyway.choice).toBe('up')
    expect(anyway.steps.get('')?.[0]).toEqual({ type: 'element.update', id: 'booking', patch: { parentId: undefined } })
  })

  it('takes the whole subtree on delete, from the bottom up in each scope, with everyone in it', () => {
    const plan = unitDeletion(world(), ['north'], 'delete', '2026-10-12')!
    expect(plan.below.map((one) => one.id)).toEqual(['booking', 'rates', 'shipper', 'quotes'])
    expect(plan.roles.map((one) => one.unitId)).toEqual(['north', 'rates'])
    expect(plan.steps.get('')?.slice(0, 2)).toEqual([
      { type: 'element.delete', id: 'shipper' },
      { type: 'element.delete', id: 'booking' },
    ])
    // Quotes' row goes with Quotes, in the scope that keeps both.
    expect(plan.steps.get('shipping')).toEqual([
      { type: 'element.delete', id: 'quotes' },
      { type: 'element.delete', id: 'rates' },
      { type: 'relation.delete', id: 'r-book' },
      { type: 'element.update', id: 'tms', patch: { partyId: undefined } },
      { type: 'element.update', id: 'svc', patch: { partyId: undefined } },
    ])
  })

  it('falls back to the default for a unit it does not offer, and offers none to move into for several', () => {
    expect(unitDeletion(world(), ['north'], 'into:booking')!.choice).toBe('into:east')
    const both = unitDeletion(world(), ['north', 'south'])!
    expect(both.into).toEqual([])
    expect(both.initial).toBe('up')
    // A unit deleted with it is not inside: it goes with the delete, and what sits in it is inside.
    expect(unitDeletion(world(), ['north', 'booking'])!.inside.map((one) => one.id)).toEqual(['shipper', 'rates'])
  })

  it('puts the open scope\'s part before the delete\'s own commands, each said once', () => {
    const plan = unitDeletion(world(), ['north'])!
    const here = [{ type: 'element.delete' as const, id: 'north' }, { type: 'element.update' as const, id: 'portal', patch: { partyId: undefined } }]
    expect(openStep(plan, '', here)).toEqual([{ type: 'element.update', id: 'booking', patch: { parentId: 'east' } }, ...here])
  })
})

describe('a choice as it is handed over', () => {
  it('reads up, delete and into:<id>, and nothing else', () => {
    expect(unitsChoiceOf('up')).toBe('up')
    expect(unitsChoiceOf('delete')).toBe('delete')
    expect(unitsChoiceOf('into:south')).toBe('into:south')
    expect(unitsChoiceOf('into:')).toBeUndefined()
    expect(unitsChoiceOf('sideways')).toBeUndefined()
    expect(unitsChoiceOf(3)).toBeUndefined()
    expect(intoOf('into:south')).toBe('south')
    expect(intoOf('up')).toBeUndefined()
  })
})
