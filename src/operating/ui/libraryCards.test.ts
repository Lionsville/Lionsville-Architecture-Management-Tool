// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A library read as the structure it would make, for the dialog that brings
 * it in; what of the organisation's stands for an entry; and the words the
 * dialog, its toast and *What came in* say, each from plain data.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import { transaction } from '../../model/commands'
import { unitTypeLanes } from '../../model/unitOrder'
import { whatWillComeIn } from '../comingIn'
import type { Library } from '../library'
import { libraryById } from '../libraries'
import { applyAll, empty, listsOf } from '../testing'
import { placeLabel } from './ComingInPane'
import { landedWords } from './LandedToast'
import { changedWords } from './LibrariesPanel'
import { addedBy, answersOf, libraryRoles, libraryTypes, looseRoles, standingFor } from './libraryCards'

const t = translator('en')
const SAFE = libraryById('safe')!
const SCRUM = libraryById('scrum')!
const IT4IT = libraryById('it4it')!

describe('a library read as a structure', () => {
  it('keys its unit types by entry, so the lanes draw it as they draw the organisation\'s own', () => {
    const types = libraryTypes(SAFE, 'nl')
    expect(types.map((one) => [one.id, one.top === true, one.within])).toEqual([
      ['portfolio', true, []], ['agile-release-train', true, ['portfolio']], ['agile-team', false, ['agile-release-train']],
    ])
    expect(types[2].slots[0]).toEqual({ role: 'product-owner', min: 1, max: 1 })
    expect(types[0].slots.find((slot) => slot.role === 'epic-owner')).toEqual({ role: 'epic-owner', min: 0 })
    expect(unitTypeLanes(types).lanes.map((lane) => lane.types.map((one) => one.id))).toEqual([['portfolio'], ['agile-release-train'], ['agile-team']])
    expect(libraryRoles(SAFE, 'de').get('release-train-engineer')).toEqual({ id: 'release-train-engineer', name: 'Release Train Engineer' })
    const managing = { ...SCRUM, roles: SCRUM.roles.map((one) => ({ ...one, manages: true })) }
    expect(libraryRoles(managing, 'nl').get('product-owner')).toEqual({ id: 'product-owner', name: 'Product Owner', manages: true })
  })

  it('finds the roles no type holds, and what a role answers for with its letter', () => {
    expect(looseRoles(SAFE)).toEqual([])
    expect(looseRoles(IT4IT).map((one) => one.entry)).toEqual(IT4IT.roles.map((one) => one.entry))
    expect(answersOf(SCRUM, 'scrum-master', 'en')).toEqual([
      { entry: 'plan-the-cycle', name: expect.any(String), raci: 'C' },
      { entry: 'improve-the-way-of-working', name: expect.any(String), raci: 'A' },
    ])
    expect(answersOf(SCRUM, 'scrum-team', 'en')).toEqual([])
  })

  it('says what stands for an entry: brought in from it, or matched to it', () => {
    const lists = listsOf(applyAll(empty(), [
      { type: 'role.add', role: { id: 'ro-dev', name: 'Engineer', duties: [], alsoBasedOn: [{ library: 'scrum', entry: 'developer', version: '1', language: 'en' }] } },
      { type: 'role.add', role: { id: 'ro-sm', name: 'Coach', duties: [], basedOn: { library: 'scrum', entry: 'scrum-master', version: '1', language: 'en' } } },
    ]))
    expect(standingFor(lists, SCRUM, 'developer')).toEqual({ id: 'ro-dev', name: 'Engineer', matched: true })
    expect(standingFor(lists, SCRUM, 'scrum-master')).toEqual({ id: 'ro-sm', name: 'Coach', matched: false })
    expect(standingFor(lists, SCRUM, 'product-owner')).toBeUndefined()
  })

  it('reads the items a step adds, however deep its transactions go', () => {
    const step = transaction([
      { type: 'role.add', role: { id: 'ro-1', name: 'A', duties: [] } },
      transaction([{ type: 'unitType.add', unitType: { id: 'ut-1', name: 'B', within: [], slots: [] } }]),
      { type: 'responsibility.add', responsibility: { id: 'rs-1', name: 'C' } },
      { type: 'role.update', id: 'ro-0', patch: { name: 'D' } },
    ])
    expect([...addedBy(step)]).toEqual(['ro-1', 'ut-1', 'rs-1'])
  })
})

describe('the words around a library brought in', () => {
  const lists = listsOf(applyAll(empty(), [
    { type: 'unitType.add', unitType: { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [] } },
    { type: 'unitType.add', unitType: { id: 'ut-team', name: 'Team', within: ['ut-domain'], slots: [] } },
  ]))

  it('says each place a unit type is offered', () => {
    const coming = whatWillComeIn({ lists, library: SAFE, entries: ['agile-team'], language: 'en' })
    const rows = new Map(coming.rows.map((row) => [row.entry, row]))
    const context = { library: SAFE as Library, lists, rows, edits: {}, onEdit: () => {}, t }
    const team = rows.get('agile-team')!
    const art = rows.get('agile-release-train')!
    expect(team.places!.map((choice) => placeLabel(choice, team, context))).toEqual([
      'As in SAFe: in Agile Release Train', 'At the top',
      'Beside your Domain, in the organisation', 'Beside your Team, in Domain', 'Inside your Domain', 'Inside your Team',
    ])
    expect(placeLabel({ how: 'library' }, art, context)).toBe('As in SAFe: in Portfolio, or at the top')
    expect(placeLabel({ how: 'library' }, rows.get('portfolio')!, context)).toBe('At the top, as in SAFe')
  })

  it('says what a step did, and that an undo came too late', () => {
    const brought = { step: transaction([]), library: SCRUM, made: 4, reused: 2 }
    expect(landedWords({ key: 1, kind: 'brought', brought, ids: new Set() }, t))
      .toBe('One step: 4 items brought in from Scrum. 2 matched to yours. What is new is marked until you leave the page.')
    expect(landedWords({ key: 1, kind: 'brought', brought: { ...brought, made: 1, reused: 0 }, ids: new Set() }, t))
      .toBe('One step: 1 item brought in from Scrum. What is new is marked until you leave the page.')
    expect(landedWords({ key: 1, kind: 'brought', brought: { ...brought, made: 0, reused: 1 }, ids: new Set() }, t))
      .toBe('One step, from Scrum: 1 matched to one of yours.')
    expect(landedWords({ key: 2, kind: 'notUndone' }, t)).toMatch(/^Not undone/)
  })

  it('says what changed since an item came in, in a few words', () => {
    const item = { kind: 'role' as const, id: 'ro-1', name: 'Coach' }
    expect(changedWords([], t)).toBe('nothing')
    expect(changedWords([
      { item, what: 'name', here: 'Coach', there: 'Scrum Master', chosen: 'Agile coach' },
      { item, what: 'purpose', here: 'x' },
      { item, what: 'duty', about: 'Plan the cycle', there: 'C' },
      { item, what: 'version', here: '1', there: '2' },
      { item, what: 'entryGone' },
    ], t)).toBe('the name, the purpose, its part in Plan the cycle, version 1 → 2, no longer in the library')
  })
})
