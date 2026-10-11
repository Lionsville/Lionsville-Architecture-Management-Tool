// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *What came in* (ADR-0036, amended 11 October 2026): per library, the items
 * made from it with the library's term and their name now, what has changed
 * since — a name or a place chosen on the way in being no change — and the
 * organisation's own items matched to its entries, all of it read from the
 * records.
 */
import { describe, expect, it } from 'vitest'
import type { Model } from '../model/normalised'
import { bringIn } from './bringIn'
import type { BringIn } from './bringIn'
import { whatCameIn } from './cameIn'
import { newRole } from './edit'
import type { Library } from './library'
import { LIBRARIES } from './libraries'
import { IT4IT } from './libraries/it4it'
import { SAFE } from './libraries/safe'
import { SCRUM } from './libraries/scrum'
import { TEAM_TOPOLOGIES } from './libraries/teamTopologies'
import { applyAll, empty, listsOf } from './testing'

function counter(prefix: string): (kind: string) => string {
  let n = 0
  return (kind) => `${prefix}${kind}-${++n}`
}

function brought(before: Model, ask: Omit<BringIn, 'lists' | 'makeId'>): Model {
  return applyAll(before, [bringIn({ lists: listsOf(before), makeId: counter(`${ask.library.id}-`), ...ask })!])
}

/** An organisation with a role of its own, Scrum brought in with that role for its product owner, and a rename since. */
function organisation(): Model {
  const lead = newRole('Product lead', () => 'own-lead').role
  const own = applyAll(empty(), [{ type: 'role.add', role: lead }])
  const scrum = brought(own, {
    library: SCRUM, entries: ['scrum-team'], language: 'nl',
    names: { 'scrum-team': 'Squad' }, reuse: { 'product-owner': 'own-lead' },
  })
  const master = listsOf(scrum).roles.find((one) => one.basedOn?.entry === 'scrum-master')!
  return applyAll(scrum, [{ type: 'role.update', id: master.id, patch: { name: 'Agile coach' } }])
}

const from = (model: Model, library: Library) => whatCameIn(listsOf(model), LIBRARIES).find((one) => one.library.id === library.id)!

describe('what came in', () => {
  it('lists every library given, in their order, empty where nothing came in', () => {
    const came = whatCameIn(listsOf(empty()), [SAFE, SCRUM])
    expect(came.map((one) => [one.library.id, one.made, one.matched])).toEqual([['safe', [], []], ['scrum', [], []]])
  })

  it('says of each item made its term in the language it came in, its name now and what changed since — unit types, then roles, then responsibilities', () => {
    const model = organisation()
    const { made } = from(model, SCRUM)
    expect(made.map((one) => [one.kind, one.entry, one.term, one.name])).toEqual([
      ['unitType', 'scrum-team', 'Scrumteam', 'Squad'],
      ['role', 'scrum-master', 'Scrum Master', 'Agile coach'],
      ['role', 'developer', 'Developer', 'Developer'],
      ['responsibility', 'order-the-backlog', 'De backlog ordenen', 'De backlog ordenen'],
      ['responsibility', 'plan-the-cycle', 'De cyclus plannen', 'De cyclus plannen'],
      ['responsibility', 'deliver-an-increment', 'Een bruikbaar increment opleveren', 'Een bruikbaar increment opleveren'],
      ['responsibility', 'improve-the-way-of-working', 'De werkwijze verbeteren', 'De werkwijze verbeteren'],
    ])
    // The name chosen on the way in is no change; the rename since is.
    expect(made[0].changed).toEqual([])
    expect(made[1].changed).toEqual([{ item: { kind: 'role', id: made[1].id, name: 'Agile coach' }, what: 'name', here: 'Agile coach', there: 'Scrum Master' }])
  })

  it('says nothing has changed of a type put elsewhere than its library puts it on the way in, and says a move since', () => {
    const own = applyAll(empty(), [
      { type: 'unitType.add', unitType: { id: 'own-cluster', name: 'Cluster', top: true, within: [], slots: [] } },
    ])
    const model = brought(own, {
      library: TEAM_TOPOLOGIES, entries: ['stream-aligned'], language: 'en',
      placements: { 'stream-aligned': { top: false, within: [{ type: 'own-cluster' }] } },
    })
    const [aligned] = from(model, TEAM_TOPOLOGIES).made
    expect([aligned.entry, aligned.changed]).toEqual(['stream-aligned', []])
    const moved = applyAll(model, [{ type: 'unitType.update', id: aligned.id, patch: { top: true } }])
    expect(from(moved, TEAM_TOPOLOGIES).made[0].changed).toEqual([
      { item: { kind: 'unitType', id: aligned.id, name: 'Stream-aligned team' }, what: 'top', here: 'true', moved: true },
    ])
  })

  it('says of each entry matched the organisation\'s own item it was matched to, and nothing of a library it was not', () => {
    const model = organisation()
    expect(from(model, SCRUM).matched).toEqual([{ kind: 'role', id: 'own-lead', entry: 'product-owner', term: 'Product Owner', name: 'Product lead' }])
    expect(from(model, SAFE)).toMatchObject({ made: [], matched: [] })
  })

  it('lists matches in the library\'s order, unit types first, whatever order they were made in', () => {
    const own = applyAll(empty(), [
      { type: 'role.add', role: newRole('Lead', () => 'own-lead').role },
      { type: 'unitType.add', unitType: { id: 'own-train', name: 'Train', top: true, within: [], slots: [] } },
    ])
    const one = brought(own, { library: SAFE, entries: ['product-management'], language: 'en', reuse: { 'product-management': 'own-lead' } })
    const two = brought(one, { library: SAFE, entries: ['agile-team', 'business-owner'], language: 'de', reuse: { 'agile-release-train': 'own-train', 'business-owner': 'own-lead' } })
    expect(from(two, SAFE).matched.map((match) => [match.kind, match.entry, match.term, match.name])).toEqual([
      ['unitType', 'agile-release-train', 'Agile Release Train', 'Train'],
      ['role', 'business-owner', 'Business Owner', 'Lead'],
      ['role', 'product-management', 'Product Management', 'Lead'],
    ])
    expect(from(two, IT4IT).matched).toEqual([])
  })

  it('leaves the term out, and lists the item after the others of its kind, where the library no longer has the entry', () => {
    const later: Library = { ...SCRUM, version: '2', roles: SCRUM.roles.filter((role) => role.entry !== 'scrum-master') }
    const { made } = whatCameIn(listsOf(organisation()), [later])[0]
    const roles = made.filter((one) => one.kind === 'role')
    expect(roles.map((one) => [one.entry, one.term])).toEqual([['developer', 'Developer'], ['scrum-master', undefined]])
    expect(roles[1]).not.toHaveProperty('term')
    expect(roles[1].changed).toEqual([expect.objectContaining({ what: 'entryGone' })])
  })
})
