// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *What will come in* (ADR-0036, amended 11 October 2026): what the dialog
 * suggests reusing, where a unit type lands unless the person says otherwise,
 * the rows it shows before anything is written, and the step those rows make.
 */
import { describe, expect, it } from 'vitest'
import type { Command } from '../model/commands'
import type { Model } from '../model/normalised'
import type { UnitType } from '../model/operatingModel'
import { apply } from '../model/reducer'
import { bringIn } from './bringIn'
import { choicesOf, defaultPlacement, placementChoices, placementKey, placementOf, suggestedReuse, whatWillComeIn } from './comingIn'
import type { ComingInEdits } from './comingIn'
import { newRole } from './edit'
import { IT4IT } from './libraries/it4it'
import { SAFE } from './libraries/safe'
import { SCRUM } from './libraries/scrum'
import { TEAM_TOPOLOGIES } from './libraries/teamTopologies'
import type { Library } from './library'
import { applyAll, empty, listsOf } from './testing'

function counter(prefix = ''): (kind: string) => string {
  let n = 0
  return (kind) => `${prefix}${kind}-${++n}`
}

type TypeAt = Pick<UnitType, 'id' | 'name'> & Partial<Pick<UnitType, 'top' | 'within' | 'order'>>

/** An organisation holding these unit types and roles, of its own words. */
function organisation(types: readonly TypeAt[], roles: readonly string[] = []): Model {
  const ids = counter('own-')
  return applyAll(empty(), [
    ...types.map((type): Command => ({ type: 'unitType.add', unitType: { within: [], slots: [], ...type } })),
    ...roles.map((name): Command => ({ type: 'role.add', role: newRole(name, ids).role })),
  ])
}

/** Cluster at the top, Team in it: the organisation the design draws. */
const CLUSTER_AND_TEAM: readonly TypeAt[] = [{ id: 'cluster', name: 'Cluster', top: true }, { id: 'team', name: 'Team', within: ['cluster'] }]

function broughtIn(model: Model, library: Library, entries: readonly string[]): Model {
  return applyAll(model, [bringIn({ lists: listsOf(model), library, entries, language: 'en', makeId: counter('lib-') })!])
}

function idFrom(model: Model, library: string, entry: string): string {
  const lists = listsOf(model)
  return [...lists.unitTypes, ...lists.roles].find((one) => one.basedOn?.library === library && one.basedOn.entry === entry)!.id
}

describe('the reuse suggested for an entry', () => {
  it('is what came in from an entry its library calls alike, under whatever name it has now', () => {
    const safe = broughtIn(empty(), SAFE, ['agile-team'])
    const owner = idFrom(safe, 'safe', 'product-owner')
    const renamed = applyAll(safe, [{ type: 'role.update', id: owner, patch: { name: 'Product lead' } }])
    const lists = listsOf(renamed)
    expect(suggestedReuse(lists, SCRUM, 'product-owner')).toBe(owner)
    expect(suggestedReuse(lists, SCRUM, 'scrum-master')).toBe(idFrom(safe, 'safe', 'team-coach'))
    expect(suggestedReuse(lists, SCRUM, 'scrum-team')).toBe(idFrom(safe, 'safe', 'agile-team'))
    // What came in from the entry itself stands for it most of all.
    expect(suggestedReuse(lists, SAFE, 'product-owner')).toBe(owner)
  })

  it('is otherwise one of the same name, whatever its case, accents, spaces and punctuation, in any of the library\'s languages', () => {
    const lists = listsOf(organisation([{ id: 'own-team', name: 'scrum-team', top: true }], ['Prodüct  owner', 'Productmanager', 'Scrum Masters']))
    expect(suggestedReuse(lists, SCRUM, 'product-owner')).toBe(lists.roles[0].id)
    expect(suggestedReuse(lists, IT4IT, 'product-manager')).toBe(lists.roles[1].id)
    expect(suggestedReuse(lists, SCRUM, 'scrum-team')).toBe('own-team')
    // Near is not the same.
    expect(suggestedReuse(lists, SCRUM, 'scrum-master')).toBeUndefined()
  })

  it('takes an alike entry before a name', () => {
    const model = broughtIn(organisation([], ['Scrum Master']), SAFE, ['team-coach'])
    expect(suggestedReuse(listsOf(model), SCRUM, 'scrum-master')).toBe(idFrom(model, 'safe', 'team-coach'))
  })

  it('takes a role only for a role, and of several unit types the first in the structure\'s order', () => {
    const lists = listsOf(organisation([
      { id: 'coach', name: 'Scrum Master', top: true },
      { id: 'deep', name: 'Agile team', within: ['top'] },
      { id: 'top', name: 'Agile Team', top: true, order: 1 },
    ]))
    expect(suggestedReuse(lists, SCRUM, 'scrum-master')).toBeUndefined()
    expect(suggestedReuse(lists, SAFE, 'agile-team')).toBe('top')
  })

  it('is nothing for a responsibility, an entry the library lacks, or one nothing stands for', () => {
    const lists = listsOf(broughtIn(empty(), SCRUM, ['scrum-team']))
    expect(suggestedReuse(lists, SCRUM, 'plan-the-cycle')).toBeUndefined()
    expect(suggestedReuse(lists, SCRUM, 'nonsense')).toBeUndefined()
    expect(suggestedReuse(lists, TEAM_TOPOLOGIES, 'platform')).toBeUndefined()
  })
})

describe('where a unit type lands unless the person says otherwise', () => {
  it('is as in its library in an organisation with no unit types', () => {
    expect(defaultPlacement(listsOf(empty()), TEAM_TOPOLOGIES, 'stream-aligned')).toEqual({ how: 'library' })
  })

  it('is beside the deepest type that holds nothing, for a type at the top of its library that holds none of it', () => {
    const lists = listsOf(organisation([...CLUSTER_AND_TEAM, { id: 'guild', name: 'Guild', top: true }]))
    expect(defaultPlacement(lists, TEAM_TOPOLOGIES, 'stream-aligned')).toEqual({ how: 'beside', type: 'team' })
    expect(defaultPlacement(lists, SCRUM, 'scrum-team')).toEqual({ how: 'beside', type: 'team' })
  })

  it('goes by the lane\'s order between types equally deep, then by name', () => {
    const ordered = organisation([...CLUSTER_AND_TEAM, { id: 'squad', name: 'Squad', within: ['cluster'], order: 1 }])
    expect(defaultPlacement(listsOf(ordered), TEAM_TOPOLOGIES, 'platform')).toEqual({ how: 'beside', type: 'squad' })
    const named = organisation([...CLUSTER_AND_TEAM, { id: 'squad', name: 'Squad', within: ['cluster'] }])
    expect(defaultPlacement(listsOf(named), TEAM_TOPOLOGIES, 'platform')).toEqual({ how: 'beside', type: 'squad' })
  })

  it('counts a type that may sit only in itself as holding nothing', () => {
    const lists = listsOf(organisation([{ id: 'dept', name: 'Department', top: true, within: ['dept'] }]))
    expect(defaultPlacement(lists, TEAM_TOPOLOGIES, 'enabling')).toEqual({ how: 'beside', type: 'dept' })
  })

  it('is as in its library for a type that sits in or holds another of its library, or where no type of the organisation holds nothing', () => {
    const lists = listsOf(organisation(CLUSTER_AND_TEAM))
    expect(defaultPlacement(lists, SAFE, 'agile-team')).toEqual({ how: 'library' })
    expect(defaultPlacement(lists, SAFE, 'portfolio')).toEqual({ how: 'library' })
    const loop = listsOf(organisation([{ id: 'a', name: 'A', top: true, within: ['b'] }, { id: 'b', name: 'B', within: ['a'] }]))
    expect(defaultPlacement(loop, TEAM_TOPOLOGIES, 'platform')).toEqual({ how: 'library' })
    const nowhere = listsOf(organisation([{ id: 'loose', name: 'Loose' }]))
    expect(defaultPlacement(nowhere, TEAM_TOPOLOGIES, 'platform')).toEqual({ how: 'library' })
    expect(defaultPlacement(lists, SCRUM, 'product-owner')).toBeUndefined()
  })
})

describe('the places offered a unit type', () => {
  const lists = listsOf(organisation([...CLUSTER_AND_TEAM, { id: 'loose', name: 'Loose', within: ['ghost'] }]))

  it('are as in its library, at the top, then beside and inside each type that sits somewhere, in the structure\'s order', () => {
    expect(placementChoices(lists).map(placementKey)).toEqual(['library', 'top', 'beside:cluster', 'beside:team', 'inside:cluster', 'inside:team'])
  })

  it('each read as bringIn reads a placement', () => {
    expect(placementOf(lists, SAFE, 'agile-team', { how: 'library' })).toEqual({ top: false, within: [{ entry: 'agile-release-train' }] })
    expect(placementOf(lists, SAFE, 'portfolio', { how: 'library' })).toEqual({ top: true, within: [] })
    expect(placementOf(lists, SAFE, 'agile-team', { how: 'top' })).toEqual({ top: true, within: [] })
    expect(placementOf(lists, SAFE, 'agile-team', { how: 'beside', type: 'team' })).toEqual({ top: false, within: [{ type: 'cluster' }] })
    expect(placementOf(lists, SAFE, 'agile-team', { how: 'beside', type: 'cluster' })).toEqual({ top: true, within: [] })
    expect(placementOf(lists, SAFE, 'agile-team', { how: 'beside', type: 'loose' })).toEqual({ top: false, within: [] })
    expect(placementOf(lists, SAFE, 'agile-team', { how: 'inside', type: 'cluster' })).toEqual({ top: false, within: [{ type: 'cluster' }] })
  })

  it('read as nothing where the type named is not the organisation\'s, or the entry is no unit type', () => {
    expect(placementOf(lists, SAFE, 'agile-team', { how: 'beside', type: 'ghost' })).toBeUndefined()
    expect(placementOf(lists, SAFE, 'agile-team', { how: 'inside', type: 'ghost' })).toBeUndefined()
    expect(placementOf(lists, SAFE, 'product-owner', { how: 'top' })).toBeUndefined()
  })
})

describe('the rows of what will come in', () => {
  it('place Team Topologies\' teams beside your Team, and say what each makes', () => {
    const lists = listsOf(organisation(CLUSTER_AND_TEAM))
    const coming = whatWillComeIn({ lists, library: TEAM_TOPOLOGIES, entries: ['stream-aligned', 'platform'], language: 'nl' })
    expect(coming.rows.map((row) => [row.entry, row.kind, row.fate, row.name, row.asked, row.place])).toEqual([
      ['stream-aligned', 'unitType', 'made', 'Stream-aligned team', true, { how: 'beside', type: 'team' }],
      ['platform', 'unitType', 'made', 'Platformteam', true, { how: 'beside', type: 'team' }],
    ])
    expect(coming.rows[0].placement).toEqual({ top: false, within: [{ type: 'cluster' }] })
    expect(coming.rows[0].places?.map(placementKey)).toEqual(placementChoices(lists).map(placementKey))
    expect(coming.rows[0].term).toBe('Stream-aligned team')
    expect(coming).toMatchObject({ responsibilities: [], made: 2 })
  })

  it('say what comes along and for which, and what is in the model already, under its name now', () => {
    const before = broughtIn(empty(), SAFE, ['business-owner'])
    const owner = idFrom(before, 'safe', 'business-owner')
    const lists = listsOf(applyAll(before, [{ type: 'role.update', id: owner, patch: { name: 'Sponsor' } }]))
    const { rows } = whatWillComeIn({ lists, library: SAFE, entries: ['agile-team'], language: 'en' })
    const row = (entry: string) => rows.find((one) => one.entry === entry)!
    expect(row('agile-team')).toMatchObject({ asked: true, by: [], place: { how: 'library' } })
    expect(row('agile-release-train')).toMatchObject({ asked: false, by: ['agile-team'], fate: 'made' })
    expect(row('portfolio')).toMatchObject({ asked: false, by: ['agile-release-train'] })
    expect(row('business-owner')).toEqual({
      entry: 'business-owner', kind: 'role', term: 'Business Owner', asked: false, by: ['agile-release-train', 'portfolio'],
      fate: 'inModel', name: 'Sponsor', id: owner,
    })
    expect(rows.map((one) => one.kind)).toEqual([...rows.filter((one) => one.kind === 'unitType'), ...rows.filter((one) => one.kind === 'role')].map((one) => one.kind))
  })

  it('reuse by default the roles that stand for those of the library, which then bring nothing', () => {
    const before = broughtIn(organisation(CLUSTER_AND_TEAM), SAFE, ['team-coach', 'product-owner'])
    const lists = listsOf(before)
    const coming = whatWillComeIn({ lists, library: SCRUM, entries: ['scrum-team'], language: 'en' })
    expect(coming.rows.map((row) => [row.entry, row.fate, row.id, row.suggested])).toEqual([
      ['scrum-team', 'made', undefined, undefined],
      ['product-owner', 'reused', idFrom(before, 'safe', 'product-owner'), idFrom(before, 'safe', 'product-owner')],
      ['scrum-master', 'reused', idFrom(before, 'safe', 'team-coach'), idFrom(before, 'safe', 'team-coach')],
      ['developer', 'made', undefined, undefined],
    ])
    expect(coming.rows[1].name).toBe('Product Owner')
    expect(coming.responsibilities).toEqual(['order-the-backlog', 'plan-the-cycle', 'deliver-an-increment', 'improve-the-way-of-working'])
    expect(coming.made).toBe(6)
  })

  it('follow the edits: a name, a place, a role brought in after all, a unit type reused, a place that no longer holds', () => {
    const before = broughtIn(organisation(CLUSTER_AND_TEAM), SAFE, ['agile-team'])
    const lists = listsOf(before)
    const agile = idFrom(before, 'safe', 'agile-team')
    const edits: ComingInEdits = { names: { developer: ' Engineer ' }, places: { 'scrum-team': { how: 'top' } }, reuse: { 'product-owner': null, developer: null } }
    const coming = whatWillComeIn({ lists, library: SCRUM, entries: ['scrum-team'], language: 'en', edits })
    expect(coming.rows.map((row) => [row.entry, row.fate, row.name])).toEqual([
      ['scrum-team', 'made', 'Scrum Team'], ['product-owner', 'made', 'Product Owner'],
      ['scrum-master', 'reused', 'Scrum Master/Team Coach'], ['developer', 'made', 'Engineer'],
    ])
    expect(coming.rows[0]).toMatchObject({ place: { how: 'top' }, placement: { top: true, within: [] }, suggested: agile })
    // A unit type is offered its suggestion and reused only when the person takes it, which brings nothing it holds.
    const reused = whatWillComeIn({ lists, library: SCRUM, entries: ['scrum-team'], language: 'en', edits: { reuse: { 'scrum-team': agile } } })
    expect(reused.rows).toEqual([{ entry: 'scrum-team', kind: 'unitType', term: 'Scrum Team', asked: true, by: [], fate: 'reused', name: 'Agile Team', id: agile, suggested: agile }])
    expect(reused.made).toBe(0)
    const gone = whatWillComeIn({ lists, library: SCRUM, entries: ['scrum-team'], language: 'en', edits: { places: { 'scrum-team': { how: 'inside', type: 'ghost' } } } })
    expect(gone.rows[0].place).toEqual(defaultPlacement(lists, SCRUM, 'scrum-team'))
  })
})

describe('the step the rows make', () => {
  function stepOf(model: Model, library: Library, entries: readonly string[], edits?: ComingInEdits) {
    const lists = listsOf(model)
    const coming = whatWillComeIn({ lists, library, entries, language: 'en', edits })
    const step = bringIn({ lists, library, entries, language: 'en', makeId: counter('new-'), ...choicesOf(coming.rows) })
    return { coming, step }
  }

  it('makes exactly what the rows say: their names, their places, their reuse, and as many items', () => {
    const before = broughtIn(organisation(CLUSTER_AND_TEAM), SAFE, ['product-owner'])
    const { coming, step } = stepOf(before, SCRUM, ['scrum-team'], { names: { 'scrum-team': 'Squad' } })
    const after = listsOf(applyAll(before, [step!]))
    const was = listsOf(before)
    const added = [...after.unitTypes, ...after.roles, ...after.responsibilities].length - [...was.unitTypes, ...was.roles, ...was.responsibilities].length
    expect(added).toBe(coming.made)
    const squad = after.unitTypes.find((one) => one.name === 'Squad')!
    expect(squad).toMatchObject({ within: ['cluster'], basedOn: { library: 'scrum', entry: 'scrum-team' } })
    expect(squad.top).toBeUndefined()
    expect(squad.slots[0].role).toBe(idFrom(before, 'safe', 'product-owner'))
    expect(after.roles.filter((one) => one.basedOn?.library === 'scrum').map((one) => one.name)).toEqual(['Scrum Master', 'Developer'])
  })

  it('is undone whole', () => {
    const before = broughtIn(organisation(CLUSTER_AND_TEAM), SAFE, ['team-coach'])
    const { step } = stepOf(before, TEAM_TOPOLOGIES, ['stream-aligned', 'platform'], { names: { platform: 'Foundations' } })
    const done = apply(before, step!)
    expect(done.ok).toBe(true)
    if (!done.ok) return
    const undone = apply(done.model, done.inverse)
    expect(undone.ok && undone.model).toStrictEqual(before)
  })

  it('takes nothing from a row that is in the model already', () => {
    const before = broughtIn(empty(), SCRUM, ['scrum-master'])
    const { rows } = whatWillComeIn({ lists: listsOf(before), library: SCRUM, entries: ['scrum-team'], language: 'en' })
    expect(choicesOf(rows).names).not.toHaveProperty('scrum-master')
    expect(choicesOf(rows).reuse).toEqual({})
  })
})
