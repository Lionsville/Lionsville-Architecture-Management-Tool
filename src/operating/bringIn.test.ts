// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Bringing a library in (ADR-0036 §5): one step, undone as one; what an entry
 * needs comes with it; nothing comes twice; and every item says where it came
 * from.
 */
import { describe, expect, it } from 'vitest'
import { summarise } from '../model/activity'
import { apply } from '../model/reducer'
import { bringIn, broughtFrom, entriesBrought, notBroughtIn } from './bringIn'
import { SAFE } from './libraries/safe'
import { SCRUM } from './libraries/scrum'
import { applyAll, empty, listsOf } from './testing'

function counter(): (prefix: string) => string {
  let n = 0
  return (prefix) => `${prefix}-${++n}`
}

describe('bringing entries in', () => {
  it('is one step, which undo takes out again whole', () => {
    const before = empty()
    const step = bringIn({ lists: listsOf(before), library: SCRUM, entries: ['scrum-team'], language: 'en', makeId: counter() })!
    expect(step.type).toBe('transaction')
    const result = apply(before, step)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(summarise([step], before)).toEqual({ key: 'activity.broughtIn', count: 8 })
    const undone = apply(result.model, result.inverse)
    expect(undone.ok && undone.model).toStrictEqual(before)
  })

  it('brings what a unit type needs: the roles of its slots, and their responsibilities', () => {
    const model = applyAll(empty(), [bringIn({ lists: listsOf(empty()), library: SCRUM, entries: ['scrum-team'], language: 'en', makeId: counter() })!])
    const lists = listsOf(model)
    expect(lists.unitTypes.map((one) => one.name)).toEqual(['Scrum Team'])
    expect(lists.roles.map((one) => one.name)).toEqual(['Product Owner', 'Scrum Master', 'Developer'])
    expect(lists.responsibilities).toHaveLength(4)
    const team = lists.unitTypes[0]
    // The slots name the roles made, by their new ids.
    expect(team.slots.map((slot) => lists.roles.find((role) => role.id === slot.role)?.name)).toEqual(['Product Owner', 'Scrum Master', 'Developer'])
    expect(team.slots[2]).toMatchObject({ min: 3, max: 9 })
    const owner = lists.roles[0]
    expect(owner.duties.map((duty) => [lists.responsibilities.find((one) => one.id === duty.responsibility)?.name, duty.raci]))
      .toContainEqual(['Order the backlog', 'A'])
  })

  it('brings the unit types an entry may sit in, so it has somewhere to sit', () => {
    expect(entriesBrought(listsOf(empty()), SAFE, ['agile-team'])).toEqual(expect.arrayContaining(['agile-team', 'agile-release-train', 'portfolio']))
  })

  it('says where each item came from: the library, the entry, the version and the language', () => {
    const model = applyAll(empty(), [bringIn({ lists: listsOf(empty()), library: SCRUM, entries: ['scrum-master'], language: 'nl', makeId: counter() })!])
    const role = listsOf(model).roles[0]
    expect(role.basedOn).toEqual({ library: 'scrum', entry: 'scrum-master', version: '1', language: 'nl' })
    expect(listsOf(model).responsibilities.map((one) => one.name)).toEqual(['De cyclus plannen', 'De werkwijze verbeteren'])
  })

  it('brings nothing twice, and what is new refers to what is there, under whatever name it has now', () => {
    const first = applyAll(empty(), [bringIn({ lists: listsOf(empty()), library: SCRUM, entries: ['product-owner'], language: 'en', makeId: counter() })!])
    const owner = listsOf(first).roles[0]
    const renamed = applyAll(first, [{ type: 'role.update', id: owner.id, patch: { name: 'Product lead' } }])
    const ids = counter()
    const second = applyAll(renamed, [bringIn({ lists: listsOf(renamed), library: SCRUM, entries: ['scrum-team'], language: 'en', makeId: (prefix) => `two-${ids(prefix)}` })!])
    const lists = listsOf(second)
    expect(lists.roles.filter((role) => role.basedOn?.entry === 'product-owner')).toHaveLength(1)
    expect(lists.unitTypes[0].slots[0].role).toBe(owner.id)
    expect(lists.roles.find((role) => role.id === owner.id)?.name).toBe('Product lead')
    // Asked again for what is all there: no step at all.
    expect(bringIn({ lists, library: SCRUM, entries: ['scrum-team'], language: 'en', makeId: counter() })).toBeUndefined()
    expect(notBroughtIn(lists, SCRUM)).toEqual([])
    expect(broughtFrom(lists, 'scrum', 'scrum-team')?.id).toBe(lists.unitTypes[0].id)
  })

  it('passes over an entry the library does not have', () => {
    expect(entriesBrought(listsOf(empty()), SCRUM, ['nonsense'])).toEqual([])
    expect(bringIn({ lists: listsOf(empty()), library: SCRUM, entries: ['nonsense'], language: 'en', makeId: counter() })).toBeUndefined()
  })
})

describe('the ids of what is brought in', () => {
  it('are distinct, whatever the ids it is given say', () => {
    const step = bringIn({ lists: listsOf(empty()), library: SCRUM, entries: ['scrum-team'], language: 'en', makeId: (prefix) => `${prefix}-new` })!
    const model = applyAll(empty(), [step])
    expect(listsOf(model).roles.map((role) => role.id)).toEqual(['ro-new', 'ro-new-2', 'ro-new-3'])
  })
})
