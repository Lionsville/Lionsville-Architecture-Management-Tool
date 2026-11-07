// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Role, UnitType } from '../model/operatingModel'
import { apply } from '../model/reducer'
import { exceptionsOf, manySayTheSame } from './exceptions'
import { moveLineToRole } from './edit'
import { organisationFacts } from './organisationFacts'
import { applyAll, empty, listsOf } from './testing'

const role = (id: string, reportsTo?: Role['reportsTo']): Role => ({ id, name: id.toUpperCase(), duties: [], ...(reportsTo ? { reportsTo } : {}) })
const type = (id: string, slots: UnitType['slots']): UnitType => ({ id, name: id, top: true, within: [], slots })
const ROLES = [role('head'), role('tech', [{ kind: 'solid', role: 'head' }]), role('chief')]
const TYPES = [
  type('team', [{ role: 'tech', min: 0, reportsTo: [{ kind: 'solid', role: 'chief' }] }]),
  type('platform', [{ role: 'tech', min: 0, reportsTo: [{ kind: 'solid', role: 'chief' }] }]),
  type('same', [{ role: 'tech', min: 0, reportsTo: [{ kind: 'solid', role: 'head' }] }]),
]
const unit = (id: string, unitTypeId: string, more: object = {}) => ({ id, name: id, kind: 'actor', lifecycle: 'live', unitTypeId, ...more })
const facts = organisationFacts({
  day: '2026-01-01',
  organisation: {
    roles: ROLES, unitTypes: TYPES,
    units: [
      unit('t1', 'team'), unit('t2', 'team', { reportingLines: [{ role: 'tech', kind: 'solid', to: { scope: '', unit: 't1', role: 'head' } }] }), unit('p1', 'platform'),
    ] as never,
    assignments: [
      { id: 'a1', unitId: 't1', roleId: 'tech', person: { person: 'p-1' } },
      { id: 'a2', unitId: 't1', roleId: 'head', person: { person: 'p-2' }, reportsTo: [{ kind: 'solid', to: { scope: '', unit: 'p1', role: 'chief' } }] },
      { id: 'gone', unitId: 't1', roleId: 'tech', person: { person: 'p-3' }, until: '2020-01-01' },
    ] as never,
  },
  personName: (one) => `Name of ${one.id}`, scopeOfUnit: () => '', scopeOfAssignment: () => 'there',
})

describe('what says otherwise', () => {
  it('lists a slot that departs from its role, not one that says the same', () => {
    const found = exceptionsOf(TYPES, ROLES, facts)
    const slots = found.filter((one) => one.on === 'type')
    expect(slots.map((one) => one.typeId)).toEqual(['team', 'platform'])
    expect(slots[0]).toMatchObject({ saysRole: 'chief', departsFrom: 'head', units: 2 })
  })

  it('lists a unit\'s own line, a holder\'s own, and a role held outside the slots, where each is kept', () => {
    const below = facts.saidBelow
    expect(below.find((one) => one.on === 'unit')).toMatchObject({ unitName: 't2', saysRole: 'head', departsFrom: 'chief', own: [] })
    expect(below.find((one) => one.on === 'holder')).toMatchObject({ holder: 'Name of a2', scope: 'there', saysRole: 'chief', ownHolder: [] })
    expect(below.find((one) => one.on === 'outside')).toMatchObject({ assignmentId: 'a2', roleId: 'head' })
  })

  it('says where many say the same, and that as one step the role says it and they stop', () => {
    const [many] = manySayTheSame(exceptionsOf(TYPES, ROLES, facts))
    expect(many).toMatchObject({ roleId: 'tech', saysRole: 'chief', types: 2, units: 3 })
    const start = applyAll(empty(), [
      ...ROLES.map((one) => ({ type: 'role.add', role: one }) as const),
      ...TYPES.map((one) => ({ type: 'unitType.add', unitType: one }) as const),
    ])
    const result = apply(start, moveLineToRole({ unitTypes: TYPES }, ROLES[1], many.line))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const lists = listsOf(result.model)
    expect(lists.roles.find((one) => one.id === 'tech')?.reportsTo).toEqual([{ kind: 'solid', role: 'chief' }])
    expect(lists.unitTypes.find((one) => one.id === 'team')?.slots[0].reportsTo).toBeUndefined()
    expect(lists.unitTypes.find((one) => one.id === 'same')?.slots[0].reportsTo).toEqual([{ kind: 'solid', role: 'head' }])
  })
})

describe('who holds what', () => {
  it('says a unit\'s roles, its running holders, and what is vacant by the slot\'s minimum', () => {
    expect(facts.holdersIn('t1', 'tech')).toEqual([{ name: 'Name of a1', acting: false }])
    expect(facts.unitsOfType('team').map((one) => one.id)).toEqual(['t1', 't2'])
    expect(facts.units.find((one) => one.id === 't1')?.roles).toEqual(['tech', 'head'])
    expect(facts.placesOf('tech').map((one) => [one.unit.id, one.holders.length])).toEqual([['p1', 0], ['t1', 1], ['t2', 0]])
  })
})
