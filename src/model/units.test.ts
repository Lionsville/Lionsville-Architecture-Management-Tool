// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation as it is, on a day (ADR-0036 §3, §4, §12): units as typed
 * actors, who holds which role, who manages what, and what the two
 * contradict. One fictional organisation, Acme Logistics.
 */
import { describe, expect, it } from 'vitest'
import type { Role, UnitType } from './operatingModel'
import type { DesignElement } from './types'
import {
  dayBefore, endedBy, endingFor, heldThroughType, holdersOn, holdingFrom, isUnit, leavingStep, loadOn, makesLoop, managedBy, managersOf, mayHaveParent,
  organisationOn, parentOn, parentTypeOf, runsOn, shareOf, slotsOf, unitCountsOn, unitEnded, unitFindings, unitLastDay, unitOn, unitsAbove, unitsBelow, unitsOn,
  unitTypeOn,
} from './units'
import type { Assignment, Organisation } from './units'

const domain: UnitType = { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [{ role: 'ro-owner', min: 1, max: 1 }] }
const cluster: UnitType = {
  id: 'ut-cluster', name: 'Cluster', top: true, within: ['ut-domain'], spans: true,
  slots: [{ role: 'ro-lead', min: 1, max: 1 }, { role: 'ro-pm', min: 1, max: 1 }],
}
const team: UnitType = {
  id: 'ut-team', name: 'Team', within: ['ut-cluster'], limit: 3,
  slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 3, max: 9 }],
}
const roles: Role[] = [
  { id: 'ro-owner', name: 'Domain owner', duties: [], manages: true },
  { id: 'ro-lead', name: 'Cluster lead', duties: [], manages: true },
  { id: 'ro-pm', name: 'Product manager', duties: [] },
  { id: 'ro-po', name: 'Product owner', duties: [], manages: true },
  { id: 'ro-dev', name: 'Developer', duties: [] },
  { id: 'ro-rel', name: 'Release manager', duties: [], until: '2026-12-31' },
]

function unit(id: string, unitTypeId: string | undefined, parentId?: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'actor', name: id, lifecycle: 'live', isManaged: false, aspects: {},
    ...(unitTypeId ? { unitTypeId } : {}), ...(parentId ? { parentId } : {}), ...over,
  }
}

let next = 0
function held(unitId: string, roleId: string, person: string, over: Partial<Assignment> = {}): Assignment {
  next += 1
  return { id: `as-${next}`, unitId, roleId, person: { person }, ...over }
}

const units = [
  unit('customer', 'ut-domain'),
  unit('sales', 'ut-cluster', 'customer'),
  unit('webshop', 'ut-team', 'sales'),
  unit('mobile', 'ut-team', 'sales', { lifecycle: 'planned', lifecycleDates: { live: '2027-01-01' } }),
  unit('parcel', 'ut-cluster', 'customer', { lifecycleDates: { retired: '2027-01-01' } }),
  unit('data', 'ut-cluster', undefined, { scopes: ['customer', 'shipping'] }),
  unit('stakeholders', undefined),
]
const assignments = [
  held('customer', 'ro-owner', 'pe-ada'),
  held('sales', 'ro-lead', 'pe-chloe'),
  held('sales', 'ro-pm', 'pe-daan', { share: 0.5 }),
  held('webshop', 'ro-po', 'pe-femke'),
  held('webshop', 'ro-dev', 'pe-bram', { share: 0.5 }),
  held('webshop', 'ro-dev', 'pe-ivo'),
  held('webshop', 'ro-po', 'pe-gijs', { from: '2022-01-01', until: '2026-08-14' }),
  held('data', 'ro-lead', 'pe-daan', { share: 0.75 }),
  held('parcel', 'ro-lead', 'pe-omar'),
]
const organisation: Organisation = { units, assignments, roles, unitTypes: [domain, cluster, team] }
const TODAY = '2026-10-11'

describe('days', () => {
  it('reads from and until as inclusive, and a date that is not a day as nothing', () => {
    expect(runsOn({ from: '2026-10-11', until: '2026-10-11' }, TODAY)).toBe(true)
    expect(runsOn({ from: '2026-10-12' }, TODAY)).toBe(false)
    expect(runsOn({ until: '2026-10-10' }, TODAY)).toBe(false)
    expect(runsOn({ from: 'soon' }, TODAY)).toBe(true)
  })

  it('has a unit there while it is live or retiring, and ended once retired', () => {
    expect(unitOn(units[3], TODAY)).toBe(false)
    expect(unitOn(units[3], '2027-01-01')).toBe(true)
    expect(unitOn(units[4], '2026-12-31')).toBe(true)
    expect(unitEnded(units[4], '2027-01-01')).toBe(true)
    expect(unitLastDay(units[4])).toBe('2026-12-31')
    expect(unitLastDay(units[0])).toBeUndefined()
    expect(dayBefore('2026-03-01')).toBe('2026-02-28')
  })

  it('takes a share as given, and all of the time where none or a nonsense one is', () => {
    expect(shareOf({ share: 0.5 })).toBe(0.5)
    expect(shareOf({})).toBe(1)
    expect(shareOf({ share: -1 })).toBe(1)
  })
})

describe('units, slots and holders', () => {
  it('knows a unit as an actor with a type', () => {
    expect(isUnit(units[0])).toBe(true)
    expect(isUnit(units[6])).toBe(false)
    expect(isUnit({ kind: 'application', unitTypeId: 'ut-team' })).toBe(false)
  })

  it('holds its type\'s slots and its own extra ones, the type\'s numbers first', () => {
    const extra = { ...units[2], extraSlots: [{ role: 'ro-rel', min: 0, max: 1 }, { role: 'ro-po', min: 2 }] }
    expect(slotsOf(extra, team)).toEqual([...team.slots, { role: 'ro-rel', min: 0, max: 1 }])
    expect(slotsOf(extra, undefined)).toEqual(extra.extraSlots)
  })

  it('says who holds a role on a day, and how much of a person\'s time is taken', () => {
    expect(holdersOn(assignments, 'webshop', 'ro-po', TODAY).map((one) => one.person.person)).toEqual(['pe-femke'])
    expect(holdersOn(assignments, 'webshop', 'ro-po', '2023-01-01').map((one) => one.person.person)).toEqual(['pe-femke', 'pe-gijs'])
    expect(loadOn(assignments, 'pe-daan', TODAY)).toBe(1.25)
    expect(loadOn(assignments, 'pe-merged', TODAY, (id) => (id === 'pe-merged' ? 'pe-ivo' : id))).toBe(1)
  })

  it('says who a type leaves where it stops holding a role: through the type alone, past the last day', () => {
    const mobile = { ...units[3], extraSlots: [{ role: 'ro-dev', min: 1 }] }
    const later = held('mobile', 'ro-dev', 'pe-noor', { from: '2027-01-01' })
    const at: Organisation = { ...organisation, units: units.map((one) => (one.id === 'mobile' ? mobile : one)), assignments: [...assignments, later] }
    // Webshop holds developers through its type; Mobile has a slot of its own, so it keeps its people.
    expect(heldThroughType(at, 'ut-team', 'ro-dev', TODAY).map((one) => one.person.person)).toEqual(['pe-bram', 'pe-ivo'])
    // Gijs's role ended before the day; one that begins after it is left too.
    expect(heldThroughType(at, 'ut-team', 'ro-po', TODAY).map((one) => one.person.person)).toEqual(['pe-femke'])
    expect(heldThroughType(at, 'ut-team', 'ro-po', '2022-06-30').map((one) => one.person.person)).toEqual(['pe-femke', 'pe-gijs'])
    expect(heldThroughType({ ...at, units: units.map((one) => (one.id === 'mobile' ? { ...one } : one)) }, 'ut-team', 'ro-dev', TODAY).map((one) => one.person.person))
      .toEqual(['pe-bram', 'pe-ivo', 'pe-noor'])
    expect(heldThroughType(at, 'ut-cluster', 'ro-dev', TODAY)).toEqual([])
  })

  it('says who a role taken out altogether leaves: in any unit, from the day on', () => {
    const later = held('data', 'ro-lead', 'pe-noor', { from: '2027-01-01' })
    const ending = held('sales', 'ro-lead', 'pe-otto', { until: TODAY })
    const at: Organisation = { ...organisation, assignments: [...assignments, later, ending] }
    expect(holdingFrom(at, 'ro-lead', TODAY).map((one) => one.person.person)).toEqual(['pe-chloe', 'pe-daan', 'pe-omar', 'pe-noor', 'pe-otto'])
    // Gijs held the role until August: by today, he holds nothing.
    expect(holdingFrom(at, 'ro-po', TODAY).map((one) => one.person.person)).toEqual(['pe-femke'])
    expect(holdingFrom(at, 'ro-rel', TODAY)).toEqual([])
  })

  it('counts the units of each type there on a day', () => {
    expect([...unitCountsOn(organisation, TODAY)]).toEqual([['ut-domain', 1], ['ut-cluster', 3], ['ut-team', 1]])
    // Mobile goes live in January, and Parcel retires the same day.
    expect(unitCountsOn(organisation, '2027-01-01').get('ut-team')).toBe(2)
    expect(unitCountsOn(organisation, '2027-01-01').get('ut-cluster')).toBe(2)
  })

  it('walks the tree of units up and down, through units only', () => {
    expect(unitsAbove(units, 'webshop')).toEqual(['sales', 'customer'])
    expect(unitsBelow(units, 'customer')).toEqual(['sales', 'webshop', 'mobile', 'parcel'])
    const loop = [unit('a', 'ut-team', 'b'), unit('b', 'ut-team', 'a')]
    expect(unitsAbove(loop, 'a')).toEqual(['b'])
    expect(unitsBelow(loop, 'a')).toEqual(['b'])
  })

  it('asks a unit\'s type whether it may sit where it does', () => {
    expect(parentTypeOf(units, units[2])).toBe('ut-cluster')
    expect(parentTypeOf(units, units[0])).toBeUndefined()
    expect(mayHaveParent(team, 'ut-cluster')).toBe(true)
    expect(mayHaveParent(team, undefined)).toBe(false)
    expect(mayHaveParent(cluster, undefined)).toBe(true)
  })
})

describe('a move that would make a loop', () => {
  const tree: Organisation = { units: [unit('a', 'ut-team'), unit('b', 'ut-team', 'a'), unit('c', 'ut-team', 'b')], assignments: [], roles, unitTypes: [team] }

  it('is one under a unit below it on its day, or on a later day another move reaches, and not one before', () => {
    expect(makesLoop(tree, { unitId: 'a', parentId: 'c', on: '2027-01-01' })).toBe(true)
    expect(makesLoop(tree, { unitId: 'a', parentId: 'a', on: '2027-01-01' })).toBe(true)
    expect(makesLoop(tree, { unitId: 'c', parentId: 'a', on: '2027-01-01' })).toBe(false)
    expect(makesLoop(tree, { unitId: 'c', on: '2027-01-01' })).toBe(false)
    // From June another plan puts c under a's sibling d; a under d from January loops only once d sits under a.
    const later: Organisation = { ...tree, units: [...tree.units, unit('d', 'ut-team')], moves: [{ unitId: 'd', parentId: 'b', on: '2027-06-01' }] }
    expect(makesLoop(later, { unitId: 'a', parentId: 'd', on: '2027-01-01' })).toBe(true)
    expect(makesLoop({ ...later, moves: [] }, { unitId: 'a', parentId: 'd', on: '2027-01-01' })).toBe(false)
  })
})

describe('who manages a unit on a day', () => {
  it('is whoever holds a managing role in it or above it, nearest first', () => {
    expect(managersOf(organisation, 'webshop', TODAY).map((one) => [one.person, one.unitId, one.roleId])).toEqual([
      ['pe-femke', 'webshop', 'ro-po'], ['pe-chloe', 'sales', 'ro-lead'], ['pe-ada', 'customer', 'ro-owner'],
    ])
  })

  it('follows the day: an assignment that has ended manages nothing', () => {
    expect(managersOf(organisation, 'webshop', '2023-01-01').map((one) => one.person)).toContain('pe-gijs')
    expect(managersOf(organisation, 'webshop', TODAY).map((one) => one.person)).not.toContain('pe-gijs')
  })

  it('reaches from a managing role to the unit and every unit below it', () => {
    expect(managedBy(organisation, 'pe-chloe', TODAY)).toEqual({ held: ['sales'], units: ['sales', 'webshop', 'mobile'] })
    expect(managedBy(organisation, 'pe-ada', TODAY).units).toEqual(['customer', 'sales', 'webshop', 'mobile', 'parcel'])
    expect(managedBy(organisation, 'pe-bram', TODAY)).toEqual({ held: [], units: [] })
    expect(managedBy(organisation, 'pe-gijs', TODAY)).toEqual({ held: [], units: [] })
  })

  it('counts an id merged into the person, and not a role that has stopped managing', () => {
    const merged = (id: string) => (id === 'pe-old' ? 'pe-new' : id)
    const moved: Organisation = { ...organisation, assignments: [...assignments, held('webshop', 'ro-po', 'pe-old')] }
    expect(managedBy(moved, 'pe-new', TODAY, merged).held).toEqual(['webshop'])
    const plain: Organisation = { ...organisation, roles: roles.map((role) => ({ ...role, manages: undefined })) }
    expect(managersOf(plain, 'webshop', TODAY)).toEqual([])
  })
})

describe('what the organisation contradicts on a day', () => {
  it('finds vacancies, too many, a misplaced unit, one over its limit, an ended unit or role, and a person over all of their time', () => {
    const extra: Organisation = {
      ...organisation,
      units: [...units, unit('loose', 'ut-team', undefined, { extraSlots: [{ role: 'ro-rel', min: 0 }] })],
      assignments: [...assignments, held('sales', 'ro-lead', 'pe-eva'), held('webshop', 'ro-rel', 'pe-kees'), held('loose', 'ro-po', 'pe-noor'),
        held('loose', 'ro-dev', 'pe-sara'), held('loose', 'ro-dev', 'pe-tim'), held('loose', 'ro-dev', 'pe-yara')],
    }
    const found = unitFindings(extra, '2027-01-02', { owns: (id) => (id === 'webshop' ? 4 : 0) })
    expect(found.map((one) => (one.kind === 'overloaded' ? [one.kind, one.person, one.load] : [one.kind, one.unitId]))).toEqual([
      ['overMax', 'sales'],
      ['vacant', 'webshop'], ['overLimit', 'webshop'],
      ['vacant', 'mobile'], ['vacant', 'mobile'],
      ['vacant', 'data'],
      ['misplaced', 'loose'],
      ['endedUnit', 'parcel'], ['endedRole', 'webshop'],
      ['overloaded', 'pe-daan', 1.25],
    ])
    expect(found.find((one) => one.kind === 'vacant' && one.unitId === 'webshop')).toMatchObject({ roleId: 'ro-dev', held: 2, min: 3 })
  })

  it('finds an assignment still running in a unit or a role taken away since, which nobody can hold', () => {
    const gone: Organisation = {
      units: [unit('webshop', 'ut-team')], roles, unitTypes: [team],
      assignments: [
        { id: 'as-a', unitId: 'removed', roleId: 'ro-po', person: { person: 'pe-a' } },
        { id: 'as-b', unitId: 'webshop', roleId: 'ro-gone', person: { person: 'pe-b' } },
      ],
    }
    const found = unitFindings(gone, TODAY).filter((one) => one.kind === 'endedUnit' || one.kind === 'endedRole')
    expect(found.map((one) => [one.kind, one.unitId])).toEqual([['endedUnit', 'removed'], ['endedRole', 'webshop']])
    // With no operating model read at all, a role is nobody's to judge.
    expect(unitFindings({ ...gone, roles: [] }, TODAY).filter((one) => one.kind === 'endedRole')).toEqual([])
  })

  it('finds a unit that serves several domains under a type that serves one', () => {
    const narrow: Organisation = { ...organisation, unitTypes: [domain, { ...cluster, spans: undefined }, team] }
    expect(unitFindings(narrow, TODAY).filter((one) => one.kind === 'spans')).toEqual([{ kind: 'spans', unitId: 'data', serves: 2 }])
  })

  it('reads nothing of a unit whose type the model does not hold, and nothing of a planned one', () => {
    const lost: Organisation = { units: [unit('x', 'ut-gone'), units[3]], assignments: [], roles, unitTypes: [team] }
    expect(unitFindings(lost, TODAY)).toEqual([])
  })
})

describe('the organisation on a day', () => {
  // A plan moves the webshop team from sales to a cluster that serves several
  // domains, on the first day of 2027 (ADR-0036 §6).
  const moved: Organisation = { ...organisation, moves: [{ unitId: 'webshop', parentId: 'data', on: '2027-01-01' }] }

  it('puts a unit under the parent the latest move by then gives it, and its own before', () => {
    expect(parentOn(units[2], moved.moves, '2026-12-31')).toBe('sales')
    expect(parentOn(units[2], moved.moves, '2027-01-01')).toBe('data')
    const twice = [...moved.moves!, { unitId: 'webshop', on: '2027-06-01' }, { unitId: 'webshop', parentId: 'customer', on: 'later' }]
    expect(parentOn(units[2], twice, '2027-07-01')).toBeUndefined()
    expect(parentOn(units[2], undefined, '2027-07-01')).toBe('sales')
  })

  it('is the organisation itself where no move has come, and every unit under its parent of the day after', () => {
    expect(organisationOn(moved, '2026-12-31')).toBe(moved)
    const after = organisationOn(moved, '2027-01-01')
    expect(after.units.find((one) => one.id === 'webshop')?.parentId).toBe('data')
    expect(after.assignments).toBe(moved.assignments)
    const top = organisationOn({ ...organisation, moves: [{ unitId: 'webshop', on: '2027-01-01' }] }, '2027-02-01')
    expect(top.units.find((one) => one.id === 'webshop')).not.toHaveProperty('parentId')
  })

  it('lists the units there on a day, under the parent of that day', () => {
    expect(unitsOn(moved, TODAY).map((one) => one.id)).toEqual(['customer', 'sales', 'webshop', 'parcel', 'data'])
    expect(unitsOn(moved, '2027-01-01').map((one) => [one.id, one.parentId])).toContainEqual(['webshop', 'data'])
    expect(unitsOn(moved, '2027-01-01').map((one) => one.id)).not.toContain('parcel')
  })

  it('has the managers above a moved unit follow it on its day', () => {
    expect(managersOf(moved, 'webshop', TODAY).map((one) => one.unitId)).toEqual(['webshop', 'sales', 'customer'])
    expect(managersOf(moved, 'webshop', '2027-01-01').map((one) => [one.person, one.unitId])).toEqual([
      ['pe-femke', 'webshop'], ['pe-daan', 'data'],
    ])
    expect(managedBy(moved, 'pe-chloe', '2027-01-01').units).toEqual(['sales', 'mobile'])
  })

  it('checks a moved unit where it sits on the day', () => {
    // A team may sit in a cluster, so the move is sound; under the domain it is not.
    expect(unitFindings(moved, '2027-01-01').filter((one) => one.kind === 'misplaced')).toEqual([])
    const wrong: Organisation = { ...organisation, moves: [{ unitId: 'webshop', parentId: 'customer', on: '2027-01-01' }] }
    expect(unitFindings(wrong, TODAY).filter((one) => one.kind === 'misplaced')).toEqual([])
    expect(unitFindings(wrong, '2027-01-01').filter((one) => one.kind === 'misplaced')).toEqual([
      { kind: 'misplaced', unitId: 'webshop', parentType: 'ut-domain' },
    ])
  })

  it('reads a unit type\'s days: one that has ended asks for nobody, and a unit still of it is found', () => {
    expect(unitTypeOn({ until: '2026-12-31' }, TODAY)).toBe(true)
    expect(endedBy({ until: '2026-12-31' }, '2027-01-01')).toBe(true)
    expect(endedBy({}, '2027-01-01')).toBe(false)
    const ending: Organisation = { ...organisation, unitTypes: [domain, cluster, { ...team, until: '2026-12-31', successors: ['ut-cluster'] }] }
    const found = unitFindings(ending, '2027-01-02')
    expect(found.filter((one) => one.kind === 'endedType').map((one) => one.unitId)).toEqual(['webshop', 'mobile'])
    expect(found.filter((one) => one.kind === 'vacant' && one.unitId === 'webshop')).toEqual([])
    expect(unitFindings(ending, TODAY).filter((one) => one.kind === 'endedType')).toEqual([])
  })
})

describe('what a person\'s leaving ends', () => {
  it('ends what runs past the last day, takes away what would begin after it, and leaves what is over', () => {
    const held = [
      held2('as-a', 'pe-femke'), held2('as-b', 'pe-femke', { until: '2027-06-30' }), held2('as-c', 'pe-femke', { until: '2026-01-31' }),
      held2('as-d', 'pe-femke', { from: '2027-01-01' }), held2('as-e', 'pe-old'), held2('as-f', 'pe-bram'),
    ]
    expect(endingFor(held, new Set(['pe-femke', 'pe-old']), '2026-10-31')).toEqual([
      { type: 'assignment.update', id: 'as-a', patch: { until: '2026-10-31' } },
      { type: 'assignment.update', id: 'as-b', patch: { until: '2026-10-31' } },
      { type: 'assignment.remove', id: 'as-d' },
      { type: 'assignment.update', id: 'as-e', patch: { until: '2026-10-31' } },
    ])
  })
})

function held2(id: string, person: string, over: Partial<Assignment> = {}): Assignment {
  return { id, unitId: 'webshop', roleId: 'ro-dev', person: { person }, ...over }
}

describe('the one step a leaving makes in a scope', () => {
  it('is one command for one end, a transaction for several, nothing for none, marked as asked', () => {
    const one = leavingStep([held2('as-a', 'pe-femke')], new Set(['pe-femke']), '2026-10-31')
    expect(one).toEqual({ command: { type: 'assignment.update', id: 'as-a', patch: { until: '2026-10-31' } }, ended: 1 })
    const two = leavingStep([held2('as-a', 'pe-femke'), held2('as-b', 'pe-femke', { from: '2027-01-01' })], new Set(['pe-femke']), '2026-10-31', { origin: 'agent' })
    expect(two).toEqual({
      command: {
        type: 'transaction', origin: 'agent',
        commands: [{ type: 'assignment.update', id: 'as-a', patch: { until: '2026-10-31' } }, { type: 'assignment.remove', id: 'as-b' }],
      },
      ended: 2,
    })
    expect(leavingStep([held2('as-c', 'pe-bram')], new Set(['pe-femke']), '2026-10-31')).toBeUndefined()
  })
})
