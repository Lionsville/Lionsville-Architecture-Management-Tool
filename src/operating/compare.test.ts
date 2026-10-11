// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Compare* (ADR-0036 §5): what was brought in, against the library as it
 * ships — and against a later version of it — read in the language the item
 * was brought in in, and never merged.
 */
import { describe, expect, it } from 'vitest'
import { bringIn } from './bringIn'
import { compareWithLibraries } from './compare'
import type { Library } from './library'
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
