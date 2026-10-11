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
  dayBefore, endingFor, holdersOn, isUnit, leavingStep, loadOn, managedBy, managersOf, mayHaveParent, parentTypeOf, runsOn, shareOf, slotsOf,
  unitEnded, unitFindings, unitLastDay, unitOn, unitsAbove, unitsBelow,
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

  it('finds a unit that serves several domains under a type that serves one', () => {
    const narrow: Organisation = { ...organisation, unitTypes: [domain, { ...cluster, spans: undefined }, team] }
    expect(unitFindings(narrow, TODAY).filter((one) => one.kind === 'spans')).toEqual([{ kind: 'spans', unitId: 'data', serves: 2 }])
  })

  it('reads nothing of a unit whose type the model does not hold, and nothing of a planned one', () => {
    const lost: Organisation = { units: [unit('x', 'ut-gone'), units[3]], assignments: [], roles, unitTypes: [team] }
    expect(unitFindings(lost, TODAY)).toEqual([])
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
