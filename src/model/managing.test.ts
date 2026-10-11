// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a right from a managing role reaches (ADR-0036 §12): the units a
 * person holds a managing role in and every unit below, a managing role only
 * strictly below, on the day it is asked — and whether a step's commands
 * change only those units' people. One fictional organisation, Acme Logistics.
 */
import { describe, expect, it } from 'vitest'
import type { Command } from './commands'
import type { HostModel } from './hostModel'
import {
  holdsAllIn, managedReach, managesPeople, managingRoleIds, mayChangeIn, onlyAssignments, onlyPeopleIn, reachesAssignment,
} from './managing'
import { fromArrays } from './normalised'
import type { Role } from './operatingModel'
import type { DesignElement } from './types'
import type { Assignment, Organisation } from './units'

const TODAY = '2026-10-11'
const roles: Role[] = [
  { id: 'ro-lead', name: 'Cluster lead', duties: [], manages: true },
  { id: 'ro-dev', name: 'Developer', duties: [] },
]

function unit(id: string, parentId?: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'actor', name: id, lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId: 'ut-team',
    ...(parentId ? { parentId } : {}), ...over,
  }
}

const lead: Assignment = { id: 'as-lead', unitId: 'sales', roleId: 'ro-lead', person: { person: 'pe-chloe' }, from: '2026-01-01', until: '2026-12-31' }
const dev: Assignment = { id: 'as-dev', unitId: 'webshop', roleId: 'ro-dev', person: { person: 'pe-bram' } }
const units = [unit('customer'), unit('sales', 'customer'), unit('webshop', 'sales'), unit('parcel', 'customer')]
const organisation: Organisation = { units, assignments: [lead, dev], roles, unitTypes: [] }

describe('what a managing role reaches on a day', () => {
  it('is the unit held, every unit below it, and below it alone for a managing role', () => {
    const reach = managedReach(organisation, 'pe-chloe', TODAY)
    expect(reach?.held).toEqual(['sales'])
    expect([...reach!.units].sort()).toEqual(['sales', 'webshop'])
    expect([...reach!.below]).toEqual(['webshop'])
    const managing = managingRoleIds(organisation)
    expect([...managing]).toEqual(['ro-lead'])
    expect(reachesAssignment(reach!, { unitId: 'webshop', roleId: 'ro-dev' }, managing)).toBe(true)
    expect(reachesAssignment(reach!, { unitId: 'webshop', roleId: 'ro-lead' }, managing)).toBe(true)
    expect(reachesAssignment(reach!, { unitId: 'sales', roleId: 'ro-dev' }, managing)).toBe(true)
    // No self-escalation: a managing role in their own unit, and nothing beside or above it.
    expect(reachesAssignment(reach!, { unitId: 'sales', roleId: 'ro-lead' }, managing)).toBe(false)
    expect(reachesAssignment(reach!, { unitId: 'parcel', roleId: 'ro-dev' }, managing)).toBe(false)
    expect(reachesAssignment(reach!, { unitId: 'customer', roleId: 'ro-dev' }, managing)).toBe(false)
  })

  it('holds from the first day of the assignment to its last, counts a merged id, and is nothing for whoever manages nothing', () => {
    expect(managedReach(organisation, 'pe-chloe', '2025-12-31')).toBeUndefined()
    expect(managedReach(organisation, 'pe-chloe', '2027-01-01')).toBeUndefined()
    expect(managedReach(organisation, 'pe-bram', TODAY)).toBeUndefined()
    expect(managedReach(organisation, 'pe-chloe-too', TODAY, (id) => (id === 'pe-chloe' ? 'pe-chloe-too' : id))?.held).toEqual(['sales'])
    // A plan's move puts a unit under theirs from its day on.
    const moved: Organisation = { ...organisation, moves: [{ unitId: 'parcel', parentId: 'sales', on: '2026-11-01' }] }
    expect(managedReach(moved, 'pe-chloe', TODAY)?.units.has('parcel')).toBe(false)
    expect(managedReach(moved, 'pe-chloe', '2026-11-01')?.units.has('parcel')).toBe(true)
  })

  it('says what a screen asks of a unit and a role, with the managing roles beside the reach', () => {
    const manages = managesPeople(organisation, 'pe-chloe', TODAY)
    expect(mayChangeIn(manages, 'webshop', 'ro-dev')).toBe(true)
    expect(mayChangeIn(manages, 'sales', 'ro-lead')).toBe(false)
    expect(mayChangeIn(undefined, 'webshop', 'ro-dev')).toBe(false)
    expect(managesPeople(organisation, 'pe-bram', TODAY)).toBeUndefined()
  })
})

describe('whether a manager\'s units hold some people today', () => {
  const reach = managedReach(organisation, 'pe-chloe', TODAY)!
  const yara: Assignment = { id: 'as-yara', unitId: 'webshop', roleId: 'ro-dev', person: { person: 'pe-yara' }, until: '2026-09-30' }
  const sam: Assignment = { id: 'as-sam', unitId: 'parcel', roleId: 'ro-dev', person: { person: 'pe-sam' } }
  const held: Organisation = { ...organisation, assignments: [lead, dev, yara, sam] }

  it('is so where each holds a role running today in a unit reached, their own manager included', () => {
    expect(holdsAllIn(held, reach, ['pe-bram', 'pe-chloe'], TODAY)).toBe(true)
  })

  it('is not where one holds a role only outside it, or one that has ended, or nobody is asked', () => {
    expect(holdsAllIn(held, reach, ['pe-bram', 'pe-sam'], TODAY)).toBe(false)
    expect(holdsAllIn(held, reach, ['pe-bram', 'pe-yara'], TODAY)).toBe(false)
    expect(holdsAllIn(held, reach, ['pe-bram', 'pe-yara'], '2026-09-30')).toBe(true)
    expect(holdsAllIn(held, reach, [], TODAY)).toBe(false)
  })

  it('counts a role held under an id merged into the person asked about', () => {
    expect(holdsAllIn(held, reach, ['pe-bram-kept', 'pe-chloe'], TODAY, (id) => (id === 'pe-bram' ? 'pe-bram-kept' : id))).toBe(true)
  })
})

describe('a step that changes only the people of units in reach', () => {
  const model: HostModel = { name: 'Customer', elements: [...units, { ...unit('payments', 'sales'), ref: 'elsewhere' }], relations: [], diagrams: [], assignments: [lead, dev] }
  const reach = managedReach(organisation, 'pe-chloe', TODAY)!
  const managing = managingRoleIds(organisation)
  const asked = (...commands: Command[]) => onlyPeopleIn(fromArrays(model), commands, reach, managing)
  const add = (over: Partial<Assignment>): Command => ({
    type: 'assignment.add', assignment: { id: 'as-new', unitId: 'webshop', roleId: 'ro-dev', person: { person: 'pe-femke' }, ...over },
  })

  it('takes an assignment added, corrected, ended or taken away in a unit reached', () => {
    expect(asked(add({}))).toBe(true)
    expect(asked({ type: 'assignment.update', id: 'as-dev', patch: { until: TODAY } })).toBe(true)
    expect(asked({ type: 'assignment.remove', id: 'as-dev' })).toBe(true)
    expect(asked({ type: 'transaction', commands: [add({}), { type: 'assignment.update', id: 'as-new', patch: { share: 0.5 } }] })).toBe(true)
  })

  it('refuses anything else, a unit out of reach before or after, a managing role in their own unit, a stand-in, and nothing at all', () => {
    expect(asked(add({ unitId: 'parcel' }))).toBe(false)
    expect(asked({ type: 'assignment.update', id: 'as-dev', patch: { unitId: 'parcel' } })).toBe(false)
    expect(asked({ type: 'assignment.update', id: 'as-lead', patch: { until: TODAY } })).toBe(false)
    expect(asked(add({ unitId: 'sales', roleId: 'ro-lead' }))).toBe(false)
    expect(asked(add({ unitId: 'payments' }))).toBe(false)
    expect(asked({ type: 'element.update', id: 'webshop', patch: { name: 'Web shop' } })).toBe(false)
    expect(asked({ type: 'transaction', commands: [add({}), { type: 'element.update', id: 'webshop', patch: { name: 'Web shop' } }] })).toBe(false)
    expect(asked()).toBe(false)
    // A command the writer refuses is not this right's to allow.
    expect(asked({ type: 'assignment.remove', id: 'as-nobody' })).toBe(false)
  })

  it('knows a step of assignments alone by its kind, before anything is read', () => {
    expect(onlyAssignments({ type: 'assignment.add' })).toBe(true)
    expect(onlyAssignments({ type: 'transaction', commands: [{ type: 'assignment.update' }, { type: 'assignment.remove' }] })).toBe(true)
    expect(onlyAssignments({ type: 'transaction', commands: [] })).toBe(false)
    expect(onlyAssignments({ type: 'transaction', commands: [{ type: 'assignment.add' }, { type: 'element.add' }] })).toBe(false)
  })
})
