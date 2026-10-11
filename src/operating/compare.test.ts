// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Compare* (ADR-0036 §5): what was brought in, against the library as it
 * ships — and against a later version of it — read in the language the item
 * was brought in in, and never merged; a name against the one chosen when it
 * came in, and what an item names by the records of what stands for each
 * entry, matches included.
 */
import { describe, expect, it } from 'vitest'
import type { Model } from '../model/normalised'
import { bringIn } from './bringIn'
import type { BringIn } from './bringIn'
import { compareWithLibraries } from './compare'
import { newRole, newUnitType } from './edit'
import type { Library } from './library'
import { SAFE } from './libraries/safe'
import { SCRUM } from './libraries/scrum'
import { applyAll, empty, listsOf } from './testing'

function counter(): (prefix: string) => string {
  let n = 0
  return (prefix) => `${prefix}-${++n}`
}

/** Scrum brought in whole, in a language. */
function withScrum(language: 'en' | 'nl' = 'en') {
  const step = bringIn({ lists: listsOf(empty()), library: SCRUM, entries: ['scrum-team'], language, makeId: counter() })!
  return applyAll(empty(), [step])
}

describe('comparing with the libraries', () => {
  it('finds nothing to say about what was brought in and left alone, in the language it came in', () => {
    expect(compareWithLibraries(listsOf(withScrum()), [SCRUM])).toEqual([])
    expect(compareWithLibraries(listsOf(withScrum('nl')), [SCRUM])).toEqual([])
  })

  it('says what the organisation changed, field by field, and changes nothing', () => {
    const model = withScrum()
    const lists = listsOf(model)
    const master = lists.roles.find((role) => role.basedOn?.entry === 'scrum-master')!
    const team = lists.unitTypes[0]
    const edited = applyAll(model, [
      { type: 'role.update', id: master.id, patch: { name: 'Team coach', manages: true } },
      { type: 'unitType.update', id: team.id, patch: { slots: team.slots.map((slot) => (slot.role === master.id ? { ...slot, min: 0 } : slot)) } },
    ])
    const found = compareWithLibraries(listsOf(edited), [SCRUM])
    expect(found).toEqual([
      { item: { kind: 'unitType', id: team.id, name: 'Scrum Team' }, what: 'slot', about: 'Scrum Master', here: '0–1', there: '1' },
      { item: { kind: 'role', id: master.id, name: 'Team coach' }, what: 'name', here: 'Team coach', there: 'Scrum Master' },
      { item: { kind: 'role', id: master.id, name: 'Team coach' }, what: 'manages', here: 'true' },
    ])
    // Reading is all it did.
    expect(listsOf(edited).roles.find((role) => role.id === master.id)?.name).toBe('Team coach')
  })

  it('never counts where a unit type stands in its lane as a difference: the order is the organisation\'s own', () => {
    const model = withScrum()
    const team = listsOf(model).unitTypes[0]
    const moved = applyAll(model, [{ type: 'unitType.update', id: team.id, patch: { order: 3 } }])
    expect(listsOf(moved).unitTypes[0].order).toBe(3)
    expect(compareWithLibraries(listsOf(moved), [SCRUM])).toEqual([])
  })

  it('says a slot or a duty that one side has and the other has not', () => {
    const model = withScrum()
    const lists = listsOf(model)
    const developer = lists.roles.find((role) => role.basedOn?.entry === 'developer')!
    const edited = applyAll(model, [{ type: 'role.update', id: developer.id, patch: { duties: developer.duties.slice(1) } }])
    expect(compareWithLibraries(listsOf(edited), [SCRUM])).toEqual([
      { item: { kind: 'role', id: developer.id, name: 'Developer' }, what: 'duty', about: 'Order the backlog', there: 'C' },
    ])
  })

  it('says the organisation\'s own items are its own', () => {
    const model = applyAll(empty(), [{ type: 'role.add', role: { id: 'ro-own', name: 'Platform engineer', duties: [] } }])
    expect(compareWithLibraries(listsOf(model), [SCRUM])).toEqual([
      { item: { kind: 'role', id: 'ro-own', name: 'Platform engineer' }, what: 'own' },
    ])
  })

  it('reads a later version of a library: the version moved, and what its entries say now', () => {
    const later: Library = {
      ...SCRUM,
      version: '2',
      roles: SCRUM.roles.map((role) => (role.entry === 'product-owner'
        ? { ...role, purpose: { ...role.purpose, en: 'Answers for the product and what it is worth.' } }
        : role)),
      responsibilities: SCRUM.responsibilities.filter((one) => one.entry !== 'improve-the-way-of-working'),
    }
    const found = compareWithLibraries(listsOf(withScrum()), [later])
    const owner = found.filter((one) => one.item.name === 'Product Owner')
    expect(owner).toEqual(expect.arrayContaining([
      expect.objectContaining({ what: 'version', here: '1', there: '2' }),
      expect.objectContaining({ what: 'purpose', there: 'Answers for the product and what it is worth.' }),
    ]))
    expect(found.find((one) => one.item.name === 'Improve the way of working')).toMatchObject({ what: 'entryGone' })
  })

  it('says an item came from a library this build no longer ships', () => {
    expect(compareWithLibraries(listsOf(withScrum()), [])[0]).toMatchObject({ what: 'libraryGone', there: 'scrum' })
  })
})

/** The step an ask makes, applied. */
function brought(before: Model, ask: Omit<BringIn, 'lists' | 'language' | 'makeId'>): Model {
  return applyAll(before, [bringIn({ lists: listsOf(before), language: 'en', makeId: counter(), ...ask })!])
}

describe('a name chosen when an item came in', () => {
  const model = () => brought(empty(), { library: SCRUM, entries: ['scrum-team'], names: { 'scrum-team': 'Squad', 'plan-the-cycle': 'Plan the sprint' } })

  it('is no difference: the name is read against it', () => {
    expect(compareWithLibraries(listsOf(model()), [SCRUM])).toEqual([])
  })

  it('makes a rename since a difference, with the library\'s term and the name chosen beside it', () => {
    const squad = listsOf(model()).unitTypes[0]
    const renamed = applyAll(model(), [{ type: 'unitType.update', id: squad.id, patch: { name: 'Pod' } }])
    expect(compareWithLibraries(listsOf(renamed), [SCRUM])).toEqual([
      { item: { kind: 'unitType', id: squad.id, name: 'Pod' }, what: 'name', here: 'Pod', there: 'Scrum Team', chosen: 'Squad' },
    ])
    // Renamed back to the library's term is a rename since too.
    const back = applyAll(model(), [{ type: 'unitType.update', id: squad.id, patch: { name: 'Scrum Team' } }])
    expect(compareWithLibraries(listsOf(back), [SCRUM])).toEqual([
      expect.objectContaining({ what: 'name', here: 'Scrum Team', there: 'Scrum Team', chosen: 'Squad' }),
    ])
  })
})

/** An organisation of its own: a Cluster at the top and a Team coach. */
function ownModel(): Model {
  const cluster = { ...newUnitType('Cluster', () => 'own-cluster').unitType, top: true }
  const coach = newRole('Team coach', () => 'own-coach').role
  return applyAll(empty(), [{ type: 'unitType.add', unitType: cluster }, { type: 'role.add', role: coach }])
}

describe('what an item names, matched', () => {
  it('reads a slot naming a role a bring-in matched to the entry as that entry', () => {
    const safe = brought(empty(), { library: SAFE, entries: ['agile-team'] })
    const id = (entry: string) => listsOf(safe).roles.find((one) => one.basedOn?.entry === entry)!.id
    const model = brought(safe, {
      library: SCRUM, entries: ['scrum-team'],
      reuse: { 'product-owner': id('product-owner'), 'scrum-master': id('team-coach'), developer: id('team-member') },
    })
    expect(compareWithLibraries(listsOf(model), [SCRUM, SAFE])).toEqual([])
  })

  it('reads a type it sits in that was matched to the entry as that entry', () => {
    const model = brought(ownModel(), { library: SAFE, entries: ['agile-team'], reuse: { 'agile-release-train': 'own-cluster' } })
    const found = compareWithLibraries(listsOf(model), [SAFE])
    expect(found.filter((one) => one.what === 'within')).toEqual([])
    // The matched type is the organisation's own: that is all compare says of it.
    expect(found.filter((one) => one.item.id === 'own-cluster')).toEqual([{ item: { kind: 'unitType', id: 'own-cluster', name: 'Cluster' }, what: 'own' }])
  })

  it('reads a role matched to two entries as filling both slots', () => {
    const model = brought(ownModel(), { library: SCRUM, entries: ['scrum-team'], reuse: { 'scrum-master': 'own-coach', developer: 'own-coach' } })
    const team = listsOf(model).unitTypes.find((one) => one.basedOn?.entry === 'scrum-team')!
    expect(team.slots.map((slot) => slot.role).slice(1)).toEqual(['own-coach', 'own-coach'])
    expect(compareWithLibraries(listsOf(model), [SCRUM]).filter((one) => one.item.id === team.id)).toEqual([])
  })

  it('still says a slot whose role stands for no entry the library names there', () => {
    const model = brought(ownModel(), { library: SCRUM, entries: ['scrum-team'] })
    const team = listsOf(model).unitTypes.find((one) => one.basedOn?.entry === 'scrum-team')!
    const master = listsOf(model).roles.find((one) => one.basedOn?.entry === 'scrum-master')!
    const swapped = applyAll(model, [{ type: 'unitType.update', id: team.id, patch: { slots: team.slots.map((slot) => (slot.role === master.id ? { ...slot, role: 'own-coach' } : slot)) } }])
    expect(compareWithLibraries(listsOf(swapped), [SCRUM]).filter((one) => one.item.id === team.id)).toEqual([
      { item: { kind: 'unitType', id: team.id, name: 'Scrum Team' }, what: 'slot', about: 'Scrum Master', there: '1' },
    ])
  })
})
