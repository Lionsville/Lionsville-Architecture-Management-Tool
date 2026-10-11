// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A reorganisation and the people in it (ADR-0036 §6), over one fictional
 * organisation, Acme Logistics: on 1 January 2027 a plan splits the Parcel &
 * Freight cluster into Parcel and Freight, moves its three teams under them,
 * and ends the role of release manager, whose successor is the cluster lead.
 * Nobody's new place is guessed: every assignment that runs past its unit or
 * its role is listed with a suggestion, and writing them is one step.
 */
import { describe, expect, it } from 'vitest'
import { transaction } from './commands'
import { assignmentList, fromArrays } from './normalised'
import type { Model } from './normalised'
import type { Responsibility, Role, UnitType } from './operatingModel'
import { apply } from './reducer'
import type { ConwayInput } from './conway'
import {
  beforeAndAfter, interactionsToDeclare, lostAccountability, peopleMoveSteps, peopleToMove, placesIn, planReorganisation,
  reorganisationRoots, reorganisedUnits, roleEnding, samePlace, slotEnding, unitsOfEndedType, unitTree, withoutSlot,
} from './reorganisation'
import type { PeopleChoice, PeopleMove } from './reorganisation'
import type { Transition } from './transition'
import type { DesignElement } from './types'
import type { Assignment, Organisation } from './units'

const domain: UnitType = { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [] }
const cluster: UnitType = {
  id: 'ut-cluster', name: 'Cluster', within: ['ut-domain'],
  slots: [{ role: 'ro-lead', min: 1, max: 1 }, { role: 'ro-pm', min: 1, max: 1 }, { role: 'ro-rel', min: 0, max: 1 }],
}
const team: UnitType = { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [{ role: 'ro-po', min: 1, max: 1 }] }
const roles: Role[] = [
  { id: 'ro-lead', name: 'Cluster lead', duties: [{ responsibility: 'rs-plan', raci: 'A' }], manages: true },
  { id: 'ro-pm', name: 'Product manager', duties: [] },
  { id: 'ro-rel', name: 'Release manager', duties: [{ responsibility: 'rs-release', raci: 'A' }], until: '2026-12-31', successors: ['ro-lead'] },
  { id: 'ro-po', name: 'Product owner', duties: [] },
]
const responsibilities: Responsibility[] = [
  { id: 'rs-plan', name: 'Plan the cluster' }, { id: 'rs-release', name: 'Release to production' },
]

function unit(id: string, unitTypeId: string, parentId?: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'actor', name: id, lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId, ...(parentId ? { parentId } : {}), ...over }
}

const SPLIT = '2027-01-01'
const EVE = '2026-12-31'
const TODAY = '2026-10-11'

const units = [
  unit('shipping', 'ut-domain'),
  unit('parcel-freight', 'ut-cluster', 'shipping', { lifecycleDates: { retired: SPLIT }, successorId: 'parcel' }),
  unit('parcel', 'ut-cluster', 'shipping', { lifecycle: 'planned', lifecycleDates: { live: SPLIT } }),
  unit('freight', 'ut-cluster', 'shipping', { lifecycle: 'planned', lifecycleDates: { live: SPLIT } }),
  unit('tracking', 'ut-team', 'parcel-freight'),
  unit('booking', 'ut-team', 'parcel-freight'),
  unit('data', 'ut-cluster'),
]
const assignments: Assignment[] = [
  { id: 'as-1', unitId: 'parcel-freight', roleId: 'ro-lead', person: { person: 'pe-omar' }, from: '2024-01-01' },
  { id: 'as-2', unitId: 'parcel-freight', roleId: 'ro-pm', person: { person: 'pe-sanne' }, share: 0.5, until: '2027-06-30' },
  { id: 'as-3', unitId: 'parcel-freight', roleId: 'ro-rel', person: { person: 'pe-joost' }, acting: true },
  { id: 'as-4', unitId: 'tracking', roleId: 'ro-po', person: { person: 'pe-lisa' } },
  { id: 'as-5', unitId: 'data', roleId: 'ro-rel', person: { person: 'pe-eva' } },
  { id: 'as-6', unitId: 'parcel-freight', roleId: 'ro-pm', person: { person: 'pe-old' }, until: '2026-06-30' },
  { id: 'as-7', unitId: 'parcel-freight', roleId: 'ro-pm', person: { person: 'pe-late' }, from: '2027-03-01' },
]
const plan: Transition = {
  id: 'tr-7', number: 7, title: 'Split Parcel & Freight', status: 'agreed', from: '2026-11-01', to: SPLIT,
  elements: [
    { elementId: 'parcel', role: 'introduces' }, { elementId: 'freight', role: 'introduces' },
    { elementId: 'parcel-freight', role: 'retires' }, { elementId: 'nothing-here', role: 'retires' },
  ],
  moves: [{ unitId: 'tracking', parentId: 'parcel', on: SPLIT }, { unitId: 'booking', parentId: 'freight', on: SPLIT }],
  decisions: [], milestones: [], body: '',
}
const organisation: Organisation = { units, assignments, roles, unitTypes: [domain, cluster, team], moves: plan.moves }

describe('what a plan does to the organisation', () => {
  it('reads the units it introduces, retires and moves, and the roles that end the day before', () => {
    const found = planReorganisation(plan, organisation)
    expect(found.introduces).toEqual([{ unitId: 'parcel', on: SPLIT }, { unitId: 'freight', on: SPLIT }])
    expect(found.retires).toEqual([{ unitId: 'parcel-freight', lastDay: EVE }])
    expect(found.moves).toEqual(plan.moves)
    expect(found.roles).toEqual([{ roleId: 'ro-rel', lastDay: EVE }])
    expect(found.days).toEqual([SPLIT])
    expect(beforeAndAfter(found)).toEqual({ before: EVE, after: SPLIT })
  })

  it('has no day, and nothing before or after, for a plan that touches no unit', () => {
    const none = planReorganisation({ elements: [{ elementId: 'shipping', role: 'changes' }] }, organisation)
    expect(none).toEqual({ days: [], introduces: [], retires: [], moves: [], roles: [] })
    expect(beforeAndAfter(none)).toBeUndefined()
  })

  it('says a role that ends on its own day, and nothing of one with no last day', () => {
    expect(roleEnding(roles[2])).toEqual([{ roleId: 'ro-rel', lastDay: EVE }])
    expect(roleEnding(roles[0])).toEqual([])
  })
})

describe('the people to move', () => {
  const ends = planReorganisation(plan, organisation)
  const moves = peopleToMove(organisation, { units: ends.retires, roles: ends.roles })
  const byId = (id: string) => moves.find((one) => one.assignment.id === id)

  it('lists every assignment past the end of its unit or role, and none in a team that only moves', () => {
    expect(moves.map((one) => one.assignment.id)).toEqual(['as-1', 'as-2', 'as-3', 'as-5', 'as-7'])
    expect(byId('as-4')).toBeUndefined()
    expect(byId('as-6')).toBeUndefined()
  })

  it('suggests where the unit went and the role\'s successor, from the day after', () => {
    expect(byId('as-1')).toMatchObject({ lastDay: EVE, unitEnds: true, roleEnds: false, suggestion: { unitId: 'parcel', roleId: 'ro-lead' } })
    expect(byId('as-3')).toMatchObject({ unitEnds: true, roleEnds: true, suggestion: { unitId: 'parcel', roleId: 'ro-lead' } })
    // A role that ends in a unit that goes on: the successor, in the same unit.
    expect(byId('as-5')).toMatchObject({ unitEnds: false, roleEnds: true, suggestion: { unitId: 'data', roleId: 'ro-lead' } })
  })

  it('suggests nothing where the unit ended with no successor, or the role with none', () => {
    const noSuccessor: Organisation = {
      ...organisation,
      units: units.map((one) => (one.id === 'parcel-freight' ? { ...one, successorId: undefined } : one)),
      roles: roles.map((one) => (one.id === 'ro-rel' ? { ...one, successors: undefined } : one)),
    }
    const found = peopleToMove(noSuccessor, { units: ends.retires, roles: ends.roles })
    expect(found.find((one) => one.assignment.id === 'as-1')).not.toHaveProperty('suggestion')
    expect(found.find((one) => one.assignment.id === 'as-5')).not.toHaveProperty('suggestion')
  })

  it('lists the people of a role that ends outside a plan, with its successor in the same unit', () => {
    const found = peopleToMove(organisation, { roles: roleEnding(roles[2]) })
    expect(found.map((one) => [one.assignment.id, one.suggestion])).toEqual([
      ['as-3', { unitId: 'parcel-freight', roleId: 'ro-lead' }], ['as-5', { unitId: 'data', roleId: 'ro-lead' }],
    ])
  })

  it('lists the people a unit type leaves where it stops holding a role, with the role\'s successor in the same unit', () => {
    const found = slotEnding(organisation, 'ut-cluster', 'ro-rel', TODAY)
    expect(found.map((one) => [one.assignment.id, one.lastDay, one.slotEnds, one.suggestion])).toEqual([
      ['as-3', TODAY, true, { unitId: 'parcel-freight', roleId: 'ro-lead' }], ['as-5', TODAY, true, { unitId: 'data', roleId: 'ro-lead' }],
    ])
    expect(found[0]).toMatchObject({ unitEnds: false, roleEnds: false })
    // The same once the type no longer holds it: what is left of the list is read off the people, not the slot.
    expect(slotEnding(withoutSlot(organisation, 'ut-cluster', 'ro-rel'), 'ut-cluster', 'ro-rel', TODAY)).toEqual(found)
  })

  it('suggests nothing where the role has no successor the unit still holds, and passes over one ended by then', () => {
    const found = slotEnding(organisation, 'ut-cluster', 'ro-pm', TODAY)
    expect(found.map((one) => one.assignment.id)).toEqual(['as-2', 'as-7'])
    expect(found.every((one) => one.suggestion === undefined)).toBe(true)
    // A successor the unit's type does not hold is not where its people go.
    const elsewhere: Organisation = { ...organisation, roles: roles.map((one) => (one.id === 'ro-pm' ? { ...one, successors: ['ro-po'] } : one)) }
    expect(slotEnding(elsewhere, 'ut-cluster', 'ro-pm', TODAY)[0]).not.toHaveProperty('suggestion')
    // Nor the role itself, which the type no longer holds.
    const toItself: Organisation = { ...organisation, roles: roles.map((one) => (one.id === 'ro-pm' ? { ...one, successors: ['ro-pm'] } : one)) }
    expect(slotEnding(toItself, 'ut-cluster', 'ro-pm', TODAY)[0]).not.toHaveProperty('suggestion')
    expect(withoutSlot(organisation, 'ut-cluster', 'ro-pm').unitTypes[1].slots.map((slot) => slot.role)).toEqual(['ro-lead', 'ro-rel'])
  })

  it('offers the places in each unit whose role runs that day', () => {
    expect(placesIn(organisation, ['parcel', 'parcel-freight', 'tracking'], SPLIT)).toEqual([
      { unitId: 'parcel', roleId: 'ro-lead' }, { unitId: 'parcel', roleId: 'ro-pm' }, { unitId: 'tracking', roleId: 'ro-po' },
    ])
    expect(samePlace({ unitId: 'parcel', roleId: 'ro-pm' }, { unitId: 'parcel', roleId: 'ro-pm' })).toBe(true)
    expect(samePlace(undefined, { unitId: 'parcel', roleId: 'ro-pm' })).toBe(false)
  })
})

describe('writing the people\'s moves as one step', () => {
  const ends = planReorganisation(plan, organisation)
  const moves = peopleToMove(organisation, { units: ends.retires, roles: ends.roles })
  const choose = (move: PeopleMove): PeopleChoice => (move.assignment.id === 'as-5' ? 'end' : move.suggestion ?? 'end')
  let made = 0
  const steps = peopleMoveSteps(moves.map((move) => ({ move, choice: choose(move) })), {
    scopeOfAssignment: (one) => (one.unitId === 'data' ? '' : 'shipping'),
    scopeOfUnit: (id) => (id === 'data' ? '' : 'shipping'),
    makeId: (prefix) => `${prefix}-new-${(made += 1)}`,
  })

  it('ends each on its last day, takes away one not yet begun, and begins each the day after, per scope', () => {
    expect([...steps.keys()]).toEqual(['shipping', ''])
    expect(steps.get('')).toEqual([{ type: 'assignment.update', id: 'as-5', patch: { until: EVE } }])
    expect(steps.get('shipping')).toEqual([
      { type: 'assignment.update', id: 'as-1', patch: { until: EVE } },
      { type: 'assignment.add', assignment: { id: 'as-new-1', unitId: 'parcel', roleId: 'ro-lead', person: { person: 'pe-omar' }, from: SPLIT } },
      { type: 'assignment.update', id: 'as-2', patch: { until: EVE } },
      {
        type: 'assignment.add',
        assignment: { id: 'as-new-2', unitId: 'parcel', roleId: 'ro-pm', person: { person: 'pe-sanne' }, share: 0.5, from: SPLIT, until: '2027-06-30' },
      },
      { type: 'assignment.update', id: 'as-3', patch: { until: EVE } },
      {
        type: 'assignment.add',
        assignment: { id: 'as-new-3', unitId: 'parcel', roleId: 'ro-lead', person: { person: 'pe-joost' }, from: SPLIT, acting: true },
      },
      { type: 'assignment.remove', id: 'as-7' },
      { type: 'assignment.add', assignment: { id: 'as-new-4', unitId: 'parcel', roleId: 'ro-pm', person: { person: 'pe-late' }, from: '2027-03-01' } },
    ])
  })

  it('lands as one step in a scope, and undo takes all of it back', () => {
    const shipping: Model = fromArrays({
      name: 'Shipping', elements: units.filter((one) => one.id !== 'data'), relations: [], diagrams: [],
      assignments: assignments.filter((one) => one.unitId !== 'data'),
    })
    const step = transaction(steps.get('shipping')!)
    const result = apply(shipping, step)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const after = assignmentList(result.model)
    expect(after.filter((one) => one.from === SPLIT || one.from === '2027-03-01').map((one) => one.person.person))
      .toEqual(['pe-omar', 'pe-sanne', 'pe-joost', 'pe-late'])
    expect(after.find((one) => one.id === 'as-1')?.until).toBe(EVE)
    const undone = apply(result.model, result.inverse)
    expect(undone.ok && assignmentList(undone.model)).toEqual(assignmentList(shipping))
  })

  it('passes over a row whose assignment or unit has no scope', () => {
    const none = peopleMoveSteps([{ move: moves[0], choice: { unitId: 'parcel', roleId: 'ro-lead' } }], {
      scopeOfAssignment: () => undefined, scopeOfUnit: () => 'shipping', makeId: () => 'as-x',
    })
    expect(none.size).toBe(0)
    const ended = peopleMoveSteps([{ move: moves[0], choice: { unitId: 'parcel', roleId: 'ro-lead' } }], {
      scopeOfAssignment: () => 'shipping', scopeOfUnit: () => undefined, makeId: () => 'as-x',
    })
    expect(ended.get('shipping')).toEqual([{ type: 'assignment.update', id: 'as-1', patch: { until: EVE } }])
  })

  /** A person kept under an id merged into another's is moved as the entry the merge kept. */
  it('writes the new assignment under the id a merge kept, never the merged one', () => {
    const merged = peopleMoveSteps([{ move: moves[0], choice: { unitId: 'parcel', roleId: 'ro-lead' } }], {
      scopeOfAssignment: () => 'shipping', scopeOfUnit: () => 'shipping', makeId: () => 'as-x',
      canonical: (id) => (id === 'pe-omar' ? 'pe-omar-kept' : id),
    })
    expect(merged.get('shipping')).toEqual([
      { type: 'assignment.update', id: 'as-1', patch: { until: EVE } },
      { type: 'assignment.add', assignment: { id: 'as-x', unitId: 'parcel', roleId: 'ro-lead', person: { person: 'pe-omar-kept' }, from: SPLIT } },
    ])
  })
})

describe('the organisation before and after', () => {
  const found = planReorganisation(plan, organisation)

  it('draws from the smallest trees that hold the whole change', () => {
    expect(reorganisationRoots(organisation, found, EVE, SPLIT)).toEqual(['shipping'])
  })

  it('draws a loop a move makes from the first of its units, rather than from none', () => {
    const looped: Organisation = {
      units: [unit('a', 'ut-team'), unit('b', 'ut-team', 'a')], assignments: [], roles: [], unitTypes: [team],
      moves: [{ unitId: 'a', parentId: 'b', on: SPLIT }],
    }
    const moving: Transition = { ...plan, elements: [], moves: [{ unitId: 'a', parentId: 'b', on: SPLIT }] }
    expect(reorganisationRoots(looped, planReorganisation(moving, looped), EVE, SPLIT)).toEqual(['a'])
  })

  it('has the cluster and its teams before, and the two new clusters with the teams moved under them after', () => {
    const shape = (nodes: ReturnType<typeof unitTree>): unknown[] => nodes.map((node) => [node.unit.id, node.holders.map((one) => one.id), shape(node.children)])
    expect(shape(unitTree(organisation, EVE, ['shipping']))).toEqual([
      ['shipping', [], [['parcel-freight', ['as-1', 'as-2', 'as-3'], [['tracking', ['as-4'], []], ['booking', [], []]]]]],
    ])
    expect(shape(unitTree(organisation, SPLIT, ['shipping']))).toEqual([
      ['shipping', [], [['parcel', [], [['tracking', ['as-4'], []]]], ['freight', [], [['booking', [], []]]]]],
    ])
    expect(unitTree(organisation, TODAY, ['parcel'])).toEqual([])
  })

  it('finds a responsibility that loses its A when the role that held it ends', () => {
    expect(lostAccountability(responsibilities, organisation, EVE, SPLIT).map((one) => one.id)).toEqual(['rs-release'])
    expect(lostAccountability(responsibilities, organisation, TODAY, EVE)).toEqual([])
  })

  it('lists the units still of a unit type that has ended, with who holds a role in each', () => {
    const ending = { ...team, until: EVE }
    expect(unitsOfEndedType(organisation, ending).map((one) => [one.unit.id, one.holders.map((held) => held.id)])).toEqual([
      ['tracking', ['as-4']], ['booking', []],
    ])
    expect(unitsOfEndedType(organisation, team)).toEqual([])
  })
})

describe('the interactions a plan\'s day leaves to declare', () => {
  const found = planReorganisation(plan, organisation)
  const days = { before: EVE, after: SPLIT }
  // Integration Platform under Data, and a Webshop team elsewhere, with nothing declared between it and anyone.
  const input: ConwayInput = {
    units: [...units, unit('ip', 'ut-team', 'data'), unit('sales', 'ut-cluster'), unit('web', 'ut-team', 'sales')],
    moves: plan.moves,
    unitTypes: [domain, cluster, team],
    applications: [
      { id: 'a-track', name: 'Track', partyId: 'tracking' }, { id: 'a-book', name: 'Book', partyId: 'booking' },
      { id: 'a-hub', name: 'Hub', partyId: 'ip' }, { id: 'a-web', name: 'Web', partyId: 'web' },
    ],
    flows: [
      { id: 'f-1', sourceId: 'a-track', targetId: 'a-hub' }, { id: 'f-2', sourceId: 'a-book', targetId: 'a-hub' },
      { id: 'f-3', sourceId: 'a-track', targetId: 'a-book' }, { id: 'f-4', sourceId: 'a-web', targetId: 'a-hub' },
    ],
    interactions: [{ id: 'i-1', sourceId: 'parcel-freight', targetId: 'data', mode: 'service' }],
  }
  const said = (given: ConwayInput) => interactionsToDeclare(given, found, days)
    .map((one) => [one.unitId, one.withId, one.flows.map((flow) => flow.id)])

  it('reads the units the plan introduces or moves, and those under them on its day', () => {
    expect(reorganisedUnits(organisation, found, SPLIT)).toEqual(['parcel', 'tracking', 'freight', 'booking'])
  })

  it('names the new cluster and the unit the retired one worked with, and two new clusters whose teams talk', () => {
    // Parcel & Freight worked with Data as a service; it ends, and its teams' interfaces to Data's team have nothing
    // declared under Parcel and Freight. Webshop's crossing is not the plan's.
    expect(said(input)).toEqual([
      ['parcel', 'data', ['f-1']],
      ['freight', 'data', ['f-2']],
      ['parcel', 'freight', ['f-3']],
    ])
  })

  it('leaves out an interface a moved team declared itself, which moves with it', () => {
    const declared = { ...input, interactions: [...input.interactions, { id: 'i-2', sourceId: 'tracking', targetId: 'ip' }] }
    expect(said(declared).map(([unitId, withId]) => `${String(unitId)} ${String(withId)}`)).toEqual(['freight data', 'parcel freight'])
  })

  it('says each two units once, with every interface between them, and nothing for a plan that touches no unit', () => {
    const twice = { ...input, flows: [...input.flows, { id: 'f-5', sourceId: 'a-hub', targetId: 'a-track' }, { id: 'f-6', sourceId: 'a-track', targetId: 'a-web' }] }
    expect(said(twice)[0]).toEqual(['parcel', 'data', ['f-1', 'f-5']])
    // Nothing covered Tracking's interface to Webshop before either: the other side is the team that owns its end.
    expect(said(twice)[3]).toEqual(['parcel', 'web', ['f-6']])
    expect(interactionsToDeclare(input, planReorganisation({ elements: [] }, organisation), days)).toEqual([])
  })
})
