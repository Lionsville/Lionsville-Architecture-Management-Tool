// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { apply } from '../model/reducer'
import {
  addSlot, cycleRaci, editResponsibility, editRole, editUnitType, itemOf, newResponsibility, newRole, newUnitType,
  removeResponsibility, removeRole, removeSlot, removeUnitType, setFlag, setLimit, setRule, setSlot, setWithin,
} from './edit'
import { applyAll, empty, listsOf } from './testing'

const ids = () => {
  let n = 0
  return (prefix: string) => `${prefix}-${++n}`
}

/** A small model: two types, two roles, two responsibilities and a rule. */
function small() {
  return applyAll(empty(), [
    { type: 'responsibility.add', responsibility: { id: 'rs-1', name: 'Release' } },
    { type: 'responsibility.add', responsibility: { id: 'rs-2', name: 'Run' } },
    { type: 'role.add', role: { id: 'ro-1', name: 'Lead', duties: [{ responsibility: 'rs-1', raci: 'A' }] } },
    { type: 'role.add', role: { id: 'ro-2', name: 'Dev', duties: [{ responsibility: 'rs-1', raci: 'R' }, { responsibility: 'rs-2', raci: 'A' }] } },
    { type: 'unitType.add', unitType: { id: 'ut-1', name: 'Train', top: true, within: [], slots: [{ role: 'ro-1', min: 1, max: 1 }] } },
    { type: 'unitType.add', unitType: { id: 'ut-2', name: 'Team', within: ['ut-1'], slots: [{ role: 'ro-1', min: 1 }, { role: 'ro-2', min: 3, max: 9 }] } },
    { type: 'operatingRule.add', rule: { id: 'applicationOwner', role: 'ro-1' } },
  ])
}

describe('the operating model\'s page, said as commands', () => {
  it('makes a new item with nothing in it but its name', () => {
    const make = ids()
    expect(newUnitType('Squad', make)).toEqual({ type: 'unitType.add', unitType: { id: 'ut-1', name: 'Squad', top: true, within: [], slots: [] } })
    expect(newRole('Coach', make)).toEqual({ type: 'role.add', role: { id: 'ro-2', name: 'Coach', duties: [] } })
    expect(newResponsibility('Plan', make, ' Run ')).toEqual({ type: 'responsibility.add', responsibility: { id: 'rs-3', name: 'Plan', group: 'Run' } })
    expect(newResponsibility('Plan', make, '')).toEqual({ type: 'responsibility.add', responsibility: { id: 'rs-4', name: 'Plan' } })
    // An id the model holds already is made distinct, whatever the ids it is given say.
    expect(newRole('Coach', () => 'ro-1', listsOf(small())).role.id).toBe('ro-1-2')
  })

  it('types into a field as one undo step per field, and an emptied optional field goes', () => {
    expect(editRole('ro-1', 'purpose', '')).toEqual({ type: 'role.update', id: 'ro-1', patch: { purpose: undefined }, coalesce: 'field:ro-1:purpose' })
    expect(editRole('ro-1', 'name', '')).toMatchObject({ patch: { name: '' } })
    expect(editUnitType('ut-1', 'name', 'Tribe')).toMatchObject({ patch: { name: 'Tribe' }, coalesce: 'field:ut-1:name' })
    expect(editResponsibility('rs-1', 'group', 'Deliver')).toMatchObject({ patch: { group: 'Deliver' } })
  })

  it('cycles a cell of the matrix through the letters', () => {
    let model = small()
    const press = () => { model = applyAll(model, [cycleRaci(listsOf(model).roles[0], 'rs-2')]) }
    const cell = () => listsOf(model).roles[0].duties.find((duty) => duty.responsibility === 'rs-2')?.raci
    const seen = []
    for (let n = 0; n < 5; n += 1) { press(); seen.push(cell()) }
    expect(seen).toEqual(['R', 'A', 'C', 'I', undefined])
  })

  it('edits a unit type\'s slots, flags, place and limit', () => {
    const model = small()
    const team = listsOf(model).unitTypes[1]
    const after = applyAll(model, [
      setSlot(team, 1, { min: 5 }),
      addSlot(listsOf(model).unitTypes[0], 'ro-2'),
      setFlag('unitType', 'ut-2', 'spans', true),
      setFlag('role', 'ro-1', 'manages', true),
      setWithin(team, 'ut-1', false),
      setLimit(team, 3.7),
    ])
    const [train, edited] = listsOf(after).unitTypes
    expect(edited.slots[1]).toEqual({ role: 'ro-2', min: 5, max: 9 })
    expect(train.slots).toEqual([{ role: 'ro-1', min: 1, max: 1 }, { role: 'ro-2', min: 0, max: 1 }])
    expect(edited).toMatchObject({ spans: true, within: [], limit: 3 })
    expect(listsOf(after).roles[0].manages).toBe(true)
    // A maximum below the minimum is the minimum; no maximum is none.
    expect(setSlot(team, 1, { max: 1 })).toMatchObject({ patch: { slots: [team.slots[0], { role: 'ro-2', min: 3, max: 3 }] } })
    expect(setSlot(team, 1, { max: undefined })).toMatchObject({ patch: { slots: [team.slots[0], { role: 'ro-2', min: 3 }] } })
    expect(removeSlot(team, 0)).toMatchObject({ patch: { slots: [team.slots[1]] } })
    expect(setLimit(team, undefined)).toEqual({ type: 'unitType.update', id: 'ut-2', patch: { limit: undefined } })
    expect(setFlag('unitType', 'ut-1', 'top', false)).toEqual({ type: 'unitType.update', id: 'ut-1', patch: { top: undefined } })
  })

  it('sets a rule to a role, changes it, and takes it away — and does nothing where nothing changes', () => {
    const { operatingRules } = listsOf(small())
    expect(setRule(operatingRules, 'domainOwner', 'ro-2')).toEqual({ type: 'operatingRule.add', rule: { id: 'domainOwner', role: 'ro-2' } })
    expect(setRule(operatingRules, 'applicationOwner', 'ro-2')).toEqual({ type: 'operatingRule.update', id: 'applicationOwner', patch: { role: 'ro-2' } })
    expect(setRule(operatingRules, 'applicationOwner', 'ro-1')).toBeUndefined()
    expect(setRule(operatingRules, 'applicationOwner', undefined)).toEqual({ type: 'operatingRule.remove', id: 'applicationOwner' })
    expect(setRule(operatingRules, 'domainOwner', undefined)).toBeUndefined()
  })

  it('takes a role out of the slots and the rules that name it, in one step undo puts back', () => {
    const before = small()
    const result = apply(before, removeRole(listsOf(before), 'ro-1'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const lists = listsOf(result.model)
    expect(lists.roles.map((role) => role.id)).toEqual(['ro-2'])
    expect(lists.unitTypes.map((type) => type.slots.map((slot) => slot.role))).toEqual([[], ['ro-2']])
    expect(lists.operatingRules).toEqual([])
    expect(apply(result.model, result.inverse)).toMatchObject({ ok: true, model: before })
  })

  it('takes a unit type out of the types that sat in it, and a responsibility out of every role', () => {
    const before = small()
    const types = applyAll(before, [removeUnitType(listsOf(before), 'ut-1')])
    expect(listsOf(types).unitTypes).toEqual([expect.objectContaining({ id: 'ut-2', within: [] })])
    const duties = applyAll(before, [removeResponsibility(listsOf(before), 'rs-1')])
    expect(listsOf(duties).roles.map((role) => role.duties)).toEqual([[], [{ responsibility: 'rs-2', raci: 'A' }]])
  })

  it('finds an item by id in whichever list it is', () => {
    const lists = listsOf(small())
    expect(itemOf(lists, 'ut-2')?.kind).toBe('unitType')
    expect(itemOf(lists, 'ro-2')?.kind).toBe('role')
    expect(itemOf(lists, 'rs-2')?.kind).toBe('responsibility')
    expect(itemOf(lists, 'nope')).toBeUndefined()
    expect(itemOf(lists, undefined)).toBeUndefined()
  })
})
