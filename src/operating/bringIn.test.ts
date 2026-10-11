// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Bringing a library in (ADR-0036 §5): one step, undone as one; what an entry
 * needs comes with it; nothing comes twice; every item says where it came
 * from; the names, places and reuse chosen before the step are what it
 * writes, and what it brings follows them; and a name chosen and a reuse are
 * recorded, so a library opened again reads them.
 */
import { describe, expect, it } from 'vitest'
import { summarise } from '../model/activity'
import { apply } from '../model/reducer'
import type { Command } from '../model/commands'
import type { Model } from '../model/normalised'
import { bringIn, broughtFrom, entriesBrought, entriesReached, notBroughtIn, standsFor } from './bringIn'
import type { BringIn } from './bringIn'
import { newRole, newUnitType } from './edit'
import { IT4IT } from './libraries/it4it'
import { SAFE } from './libraries/safe'
import { SCRUM } from './libraries/scrum'
import { TEAM_TOPOLOGIES } from './libraries/teamTopologies'
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

/** An organisation of its own: a Cluster at the top, a Team in it, and two roles of its own words. */
function ownModel(): Model {
  const ids = counter()
  const cluster = { ...newUnitType('Cluster', (prefix) => `own-${ids(prefix)}`).unitType, top: true }
  const team = { ...newUnitType('Team', (prefix) => `own-${ids(prefix)}`).unitType, top: false, within: [cluster.id] }
  const lead = newRole('Product lead', (prefix) => `own-${ids(prefix)}`).role
  const coach = newRole('Team coach', (prefix) => `own-${ids(prefix)}`).role
  return applyAll(empty(), [
    { type: 'unitType.add', unitType: cluster }, { type: 'unitType.add', unitType: team },
    { type: 'role.add', role: lead }, { type: 'role.add', role: coach },
  ])
}

function typeNamed(model: Model, name: string) {
  return listsOf(model).unitTypes.find((one) => one.name === name)!
}

function roleNamed(model: Model, name: string) {
  return listsOf(model).roles.find((one) => one.name === name)!
}

/** The step an ask makes, applied: the model after it. */
function brought(before: Model, ask: Omit<BringIn, 'lists' | 'language' | 'makeId'>): Model {
  return applyAll(before, [bringIn({ lists: listsOf(before), language: 'en', makeId: counter(), ...ask })!])
}

describe('names chosen before the step', () => {
  it('are what the items made are called, so a rename is no second step', () => {
    const model = brought(empty(), { library: SCRUM, entries: ['scrum-team'], names: { 'scrum-team': ' Squad ', 'scrum-master': 'Agile coach', 'plan-the-cycle': 'Plan the sprint' } })
    const lists = listsOf(model)
    expect(lists.unitTypes.map((one) => one.name)).toEqual(['Squad'])
    expect(lists.roles.map((one) => one.name)).toEqual(['Product Owner', 'Agile coach', 'Developer'])
    expect(lists.responsibilities.map((one) => one.name)).toContain('Plan the sprint')
    // Renamed, still from its entry, and the name chosen kept beside it for compare to read against.
    expect(lists.unitTypes[0].basedOn).toEqual({ library: 'scrum', entry: 'scrum-team', version: '1', language: 'en', name: 'Squad' })
    expect(lists.responsibilities.find((one) => one.name === 'Plan the sprint')?.basedOn?.name).toBe('Plan the sprint')
  })

  it('are kept in basedOn only where they are not the library\'s term in the language brought in', () => {
    const model = applyAll(empty(), [bringIn({
      lists: listsOf(empty()), library: SCRUM, entries: ['scrum-team'], language: 'nl', makeId: counter(),
      names: { 'scrum-team': 'Scrum Team', 'product-owner': 'Product Owner', 'plan-the-cycle': 'De cyclus plannen' },
    })!])
    const lists = listsOf(model)
    // Scrum Team is the English term; brought in in Dutch, where the library says Scrumteam, it is a name chosen.
    expect(lists.unitTypes[0].basedOn).toEqual({ library: 'scrum', entry: 'scrum-team', version: '1', language: 'nl', name: 'Scrum Team' })
    expect(lists.roles.map((one) => 'name' in one.basedOn!)).toEqual([false, false, false])
    expect(lists.responsibilities.find((one) => one.name === 'De cyclus plannen')?.basedOn).toEqual({ library: 'scrum', entry: 'plan-the-cycle', version: '1', language: 'nl' })
  })

  it('leave the library\'s term where a name is blank, and rename nothing already in the model', () => {
    const first = brought(empty(), { library: SCRUM, entries: ['product-owner'] })
    const model = brought(first, { library: SCRUM, entries: ['scrum-team'], names: { 'scrum-team': '  ', 'product-owner': 'Owner' } })
    expect(listsOf(model).unitTypes[0].name).toBe('Scrum Team')
    expect(listsOf(model).roles.filter((one) => one.basedOn?.entry === 'product-owner').map((one) => one.name)).toEqual(['Product Owner'])
  })
})

describe('placements chosen before the step', () => {
  it('put a unit type where it is said, and its library\'s own places do not come along', () => {
    const asked = { library: SAFE, entries: ['agile-team'], placements: { 'agile-team': { top: true, within: [] } } }
    expect(entriesBrought(listsOf(empty()), SAFE, asked.entries, asked)).not.toContain('agile-release-train')
    const lists = listsOf(brought(empty(), asked))
    expect(lists.unitTypes.map((one) => [one.name, one.top, one.within])).toEqual([['Agile Team', true, []]])
    expect(lists.roles.map((one) => one.basedOn?.entry)).toEqual(['product-owner', 'team-coach', 'team-member'])
  })

  it('may name the organisation\'s own unit types, passing over a type it does not hold', () => {
    const before = ownModel()
    const cluster = typeNamed(before, 'Cluster')
    const model = brought(before, {
      library: TEAM_TOPOLOGIES, entries: ['stream-aligned'],
      placements: { 'stream-aligned': { top: false, within: [{ type: cluster.id }, { type: 'nobody' }, { type: cluster.id }] } },
    })
    const aligned = listsOf(model).unitTypes.find((one) => one.basedOn?.entry === 'stream-aligned')!
    expect(aligned.top).toBeUndefined()
    expect(aligned.within).toEqual([cluster.id])
  })

  it('may name entries of the ask, which come with it, and passes over an entry that is no unit type', () => {
    const asked = { library: SAFE, entries: ['agile-team'], placements: { 'agile-team': { top: false, within: [{ entry: 'agile-release-train' }, { entry: 'product-owner' }, { entry: 'nonsense' }] } } }
    expect(entriesBrought(listsOf(empty()), SAFE, asked.entries, asked)).toEqual(expect.arrayContaining(['agile-team', 'agile-release-train', 'portfolio']))
    const lists = listsOf(brought(empty(), asked))
    const train = lists.unitTypes.find((one) => one.basedOn?.entry === 'agile-release-train')!
    expect(lists.unitTypes.find((one) => one.basedOn?.entry === 'agile-team')?.within).toEqual([train.id])
  })
})

describe('reuse chosen before the step', () => {
  it('brings nothing for a role the organisation has, and the slots name the role it has', () => {
    const before = ownModel()
    const lead = roleNamed(before, 'Product lead')
    const model = brought(before, { library: SCRUM, entries: ['scrum-team'], reuse: { 'product-owner': lead.id } })
    const lists = listsOf(model)
    expect(lists.roles.filter((one) => one.basedOn?.entry === 'product-owner')).toEqual([])
    expect(lists.unitTypes.find((one) => one.basedOn?.entry === 'scrum-team')?.slots[0]).toEqual({ role: lead.id, min: 1, max: 1 })
    // Left as it was but for the match: its own name, no basedOn, no duties brought for it.
    expect(roleNamed(model, 'Product lead')).toStrictEqual({ ...lead, alsoBasedOn: [{ library: 'scrum', entry: 'product-owner', version: '1', language: 'en' }] })
  })

  it('does not bring the responsibilities only a reused role would have had', () => {
    const before = ownModel()
    const lead = roleNamed(before, 'Product lead')
    const all = IT4IT.roles.map((one) => one.entry)
    const brings = entriesBrought(listsOf(before), IT4IT, all, { reuse: { 'product-manager': lead.id } })
    expect(brings).not.toContain('product-manager')
    for (const only of ['weigh-the-portfolio', 'fund-an-idea', 'shape-the-next-features']) expect(brings).not.toContain(only)
    expect(brings).toEqual(expect.arrayContaining(['release-manager', 'operations-manager', 'build-a-release', 'keep-it-running']))
  })

  it('stands a unit type the organisation has for an entry: nothing it holds comes, and what sat in it sits in yours', () => {
    const before = ownModel()
    const cluster = typeNamed(before, 'Cluster')
    const asked = { library: SAFE, entries: ['agile-team'], reuse: { 'agile-release-train': cluster.id } }
    expect(entriesBrought(listsOf(before), SAFE, asked.entries, asked)).toEqual(['agile-team', 'product-owner', 'team-coach', 'team-member', 'plan-the-interval', 'order-the-train-backlog', 'keep-the-runway', 'deliver-the-iteration'])
    const model = brought(before, asked)
    expect(listsOf(model).unitTypes.find((one) => one.basedOn?.entry === 'agile-team')?.within).toEqual([cluster.id])
    expect(typeNamed(model, 'Cluster')).toStrictEqual({ ...cluster, alsoBasedOn: [{ library: 'safe', entry: 'agile-release-train', version: SAFE.version, language: 'en' }] })
  })

  it('wins over an entry brought in before, and a step where all it is asked for is reused only records the match', () => {
    const first = brought(ownModel(), { library: SCRUM, entries: ['product-owner'] })
    const lead = roleNamed(first, 'Product lead')
    const model = brought(first, { library: SCRUM, entries: ['scrum-team'], reuse: { 'product-owner': lead.id } })
    expect(listsOf(model).unitTypes.find((one) => one.basedOn?.entry === 'scrum-team')?.slots[0].role).toBe(lead.id)
    const ask = { lists: listsOf(model), library: SCRUM, entries: ['scrum-master'], language: 'en' as const, makeId: counter(), reuse: { 'scrum-master': lead.id } }
    const step = bringIn(ask)
    expect(step).toEqual({ type: 'transaction', commands: [{
      type: 'role.update', id: lead.id,
      patch: { alsoBasedOn: [{ library: 'scrum', entry: 'product-owner', version: '1', language: 'en' }, { library: 'scrum', entry: 'scrum-master', version: '1', language: 'en' }] },
    }] })
    expect(summarise([step!], model)).toEqual({ key: 'activity.matchedIn', count: 1 })
    // Asked again, with the match recorded, there is nothing left to write.
    expect(bringIn({ ...ask, lists: listsOf(applyAll(model, [step!])) })).toBeUndefined()
  })

  it('passes over a reuse the organisation cannot stand for: an id it does not hold, or of the other kind', () => {
    const before = ownModel()
    const cluster = typeNamed(before, 'Cluster')
    const lead = roleNamed(before, 'Product lead')
    const brings = entriesBrought(listsOf(before), SCRUM, ['scrum-team'], {
      reuse: { 'product-owner': cluster.id, 'scrum-master': 'nobody', 'scrum-team': lead.id, 'plan-the-cycle': lead.id },
    })
    expect(brings).toEqual(entriesBrought(listsOf(before), SCRUM, ['scrum-team']))
  })
})

describe('what a reuse records', () => {
  it('is the entry, on the item reused, appended to what it was matched to before', () => {
    const before = ownModel()
    const lead = roleNamed(before, 'Product lead')
    const safe = brought(before, { library: SAFE, entries: ['product-owner'], reuse: { 'product-owner': lead.id } })
    const model = brought(safe, { library: SCRUM, entries: ['product-owner'], reuse: { 'product-owner': lead.id } })
    expect(roleNamed(model, 'Product lead').alsoBasedOn).toEqual([
      { library: 'safe', entry: 'product-owner', version: SAFE.version, language: 'en' },
      { library: 'scrum', entry: 'product-owner', version: '1', language: 'en' },
    ])
    expect(standsFor(roleNamed(model, 'Product lead'), 'scrum', 'product-owner')).toBe('matched')
  })

  it('is one update for an item that stands for several entries, after everything the step makes', () => {
    const before = ownModel()
    const coach = roleNamed(before, 'Team coach')
    const step = bringIn({ lists: listsOf(before), library: SCRUM, entries: ['scrum-team'], language: 'en', makeId: counter(), reuse: { 'scrum-master': coach.id, developer: coach.id } })!
    const commands = (step as Extract<Command, { type: 'transaction' }>).commands
    expect(commands.map((one) => one.type).slice(-2)).toEqual(['unitType.add', 'role.update'])
    expect(commands.at(-1)).toEqual({ type: 'role.update', id: coach.id, patch: { alsoBasedOn: [
      { library: 'scrum', entry: 'scrum-master', version: '1', language: 'en' }, { library: 'scrum', entry: 'developer', version: '1', language: 'en' },
    ] } })
    // The step leads with what it made, and says so.
    expect(summarise([step], before)).toEqual({ key: 'activity.broughtIn', count: 6 })
  })

  it('says nothing of the item made from the entry itself', () => {
    const model = brought(empty(), { library: SCRUM, entries: ['product-owner'] })
    const owner = listsOf(model).roles[0]
    expect(bringIn({ lists: listsOf(model), library: SCRUM, entries: ['product-owner'], language: 'en', makeId: counter(), reuse: { 'product-owner': owner.id } })).toBeUndefined()
  })

  it('makes the entry stand in the model on a later bring-in: not offered, not brought, and what is new names the item', () => {
    const before = ownModel()
    const lead = roleNamed(before, 'Product lead')
    const model = brought(before, { library: SCRUM, entries: ['product-owner'], reuse: { 'product-owner': lead.id } })
    const lists = listsOf(model)
    expect(broughtFrom(lists, 'scrum', 'product-owner')?.id).toBe(lead.id)
    expect(notBroughtIn(lists, SCRUM)).not.toContain('product-owner')
    expect(entriesReached(lists, SCRUM, ['scrum-team'])[1]).toEqual({
      entry: 'product-owner', kind: 'role', fate: { as: 'inModel', id: lead.id, matched: true }, asked: false, by: ['scrum-team'],
    })
    const after = listsOf(brought(model, { library: SCRUM, entries: ['scrum-team'] }))
    expect(after.roles.filter((one) => one.basedOn?.entry === 'product-owner')).toEqual([])
    expect(after.unitTypes.find((one) => one.basedOn?.entry === 'scrum-team')?.slots[0].role).toBe(lead.id)
  })

  it('reads an entry made before a match as the one brought in from it', () => {
    const first = brought(ownModel(), { library: SCRUM, entries: ['product-owner'] })
    const owner = listsOf(first).roles.find((one) => one.basedOn?.entry === 'product-owner')!
    const lead = roleNamed(first, 'Product lead')
    const lists = listsOf(brought(first, { library: SCRUM, entries: ['scrum-team'], reuse: { 'product-owner': lead.id } }))
    expect(broughtFrom(lists, 'scrum', 'product-owner')?.id).toBe(owner.id)
    expect(entriesReached(lists, SCRUM, ['product-owner'])[0].fate).toEqual({ as: 'inModel', id: owner.id })
    expect(standsFor(owner, 'scrum', 'scrum-team')).toBeUndefined()
  })
})

describe('what an ask reaches', () => {
  it('says of every entry what becomes of it, whether it was asked for, and which entries made need it', () => {
    const first = brought(ownModel(), { library: SCRUM, entries: ['scrum-master'] })
    const lead = roleNamed(first, 'Product lead')
    const master = listsOf(first).roles.find((one) => one.basedOn?.entry === 'scrum-master')!
    const reached = entriesReached(listsOf(first), SCRUM, ['scrum-team', 'developer'], { reuse: { 'product-owner': lead.id } })
    expect(reached.slice(0, 4)).toEqual([
      { entry: 'scrum-team', kind: 'unitType', fate: { as: 'made' }, asked: true, by: [] },
      { entry: 'product-owner', kind: 'role', fate: { as: 'reused', id: lead.id }, asked: false, by: ['scrum-team'] },
      { entry: 'scrum-master', kind: 'role', fate: { as: 'inModel', id: master.id }, asked: false, by: ['scrum-team'] },
      { entry: 'developer', kind: 'role', fate: { as: 'made' }, asked: true, by: ['scrum-team'] },
    ])
    // The master's responsibilities are in already; the developer's that are not come with it.
    expect(reached.slice(4).map((one) => [one.entry, one.fate.as, one.by])).toEqual([
      ['order-the-backlog', 'made', ['developer']],
      ['plan-the-cycle', 'inModel', ['developer']],
      ['deliver-an-increment', 'made', ['developer']],
      ['improve-the-way-of-working', 'inModel', ['developer']],
    ])
  })
})

/** The step applied, then its inverse: the model it started from, deep and in order. */
function undoesWhole(before: Model, step: Command | undefined): void {
  expect(step).toBeDefined()
  const done = apply(before, step!)
  expect(done.ok).toBe(true)
  if (!done.ok) return
  expect(done.model).not.toStrictEqual(before)
  const undone = apply(done.model, done.inverse)
  expect(undone.ok && undone.model).toStrictEqual(before)
}

describe('bringing in, then undoing', () => {
  const ask = (before: Model, rest: Omit<BringIn, 'lists' | 'language' | 'makeId'>) =>
    bringIn({ lists: listsOf(before), language: 'en', makeId: counter(), ...rest })

  it('leaves the model as it was, for a plain step', () => {
    const before = brought(ownModel(), { library: SCRUM, entries: ['scrum-master'] })
    undoesWhole(before, ask(before, { library: SAFE, entries: SAFE.unitTypes.map((one) => one.entry) }))
  })

  it('leaves the model as it was, for a step with names', () => {
    const before = ownModel()
    undoesWhole(before, ask(before, { library: SCRUM, entries: ['scrum-team'], names: { 'scrum-team': 'Squad', developer: 'Engineer' } }))
  })

  it('leaves the model as it was, for a step placing types in the organisation\'s own', () => {
    const before = ownModel()
    const team = typeNamed(before, 'Team')
    const cluster = typeNamed(before, 'Cluster')
    undoesWhole(before, ask(before, {
      library: TEAM_TOPOLOGIES, entries: ['stream-aligned', 'platform'],
      placements: { 'stream-aligned': { top: false, within: [{ type: cluster.id }] }, platform: { top: team.top === true, within: team.within.map((type) => ({ type })) } },
    }))
  })

  it('leaves the model as it was, for a step reusing the organisation\'s own', () => {
    const before = ownModel()
    undoesWhole(before, ask(before, {
      library: SAFE, entries: ['agile-team'],
      reuse: { 'agile-release-train': typeNamed(before, 'Cluster').id, 'team-coach': roleNamed(before, 'Team coach').id },
    }))
  })

  it('leaves the model as it was, for a step that only records a reuse, beside a match made before', () => {
    const before = brought(ownModel(), { library: SAFE, entries: ['team-coach'], reuse: { 'team-coach': roleNamed(ownModel(), 'Team coach').id } })
    const coach = roleNamed(before, 'Team coach')
    expect(coach.alsoBasedOn).toHaveLength(1)
    undoesWhole(before, ask(before, { library: SCRUM, entries: ['scrum-master'], reuse: { 'scrum-master': coach.id } }))
  })

  it('leaves the model as it was, for a step that matches an item for the first time', () => {
    const before = ownModel()
    undoesWhole(before, ask(before, { library: IT4IT, entries: ['product-manager'], reuse: { 'product-manager': roleNamed(before, 'Product lead').id } }))
  })
})
