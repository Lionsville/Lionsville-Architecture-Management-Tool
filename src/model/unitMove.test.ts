// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A unit moved to another place in the organisation (ADR-0036, amended 17
 * October 2026; 3.7.1). One fictional organisation: a Board and Technology
 * side by side at the top, and two lines of business filed under Technology
 * where they belong under the Board.
 */
import { describe, expect, it } from 'vitest'
import type { Role, UnitType } from './operatingModel'
import type { DesignElement } from './types'
import { reportingLinesOn } from './units'
import type { Assignment, Organisation } from './units'
import { unitFits, unitMove, unitsBeside, withUnitsMoved } from './unitMove'
import type { UnitMovePlan } from './unitMove'

const board: UnitType = { id: 'ut-board', name: 'Board', top: true, within: [], slots: [{ role: 'ro-chair', min: 1, max: 1 }] }
const tech: UnitType = { id: 'ut-tech', name: 'Technology', top: true, within: ['ut-board'], slots: [{ role: 'ro-cio', min: 1, max: 1 }] }
const lob: UnitType = {
  id: 'ut-lob', name: 'Line of business', within: ['ut-board'],
  slots: [{ role: 'ro-lead', min: 1, max: 1 }, { role: 'ro-itm', min: 0, max: 1 }],
}
const team: UnitType = { id: 'ut-team', name: 'Team', within: ['ut-lob'], slots: [{ role: 'ro-dev', min: 1 }] }
const roles: Role[] = [
  { id: 'ro-chair', name: 'Chair', duties: [], manages: true },
  { id: 'ro-cio', name: 'Chief information officer', duties: [], manages: true },
  { id: 'ro-lead', name: 'Business lead', duties: [], manages: true },
  // Reports to the nearest holder of the CIO role above, or the one unit that holds it.
  { id: 'ro-itm', name: 'IT manager', duties: [], reportsTo: { role: 'ro-cio', kind: 'solid' } },
  { id: 'ro-dev', name: 'Developer', duties: [] },
]

function unit(id: string, unitTypeId: string | undefined, parentId?: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'actor', name: id, lifecycle: 'live', isManaged: false, aspects: {},
    ...(unitTypeId ? { unitTypeId } : {}), ...(parentId ? { parentId } : {}), ...over,
  }
}

const assignments: Assignment[] = [
  { id: 'as-chair', unitId: 'board', roleId: 'ro-chair', person: { person: 'p-chair' } },
  { id: 'as-cio', unitId: 'tech', roleId: 'ro-cio', person: { person: 'p-cio' } },
  { id: 'as-lead-a', unitId: 'lob-a', roleId: 'ro-lead', person: { person: 'p-lead-a' } },
  { id: 'as-itm-a', unitId: 'lob-a', roleId: 'ro-itm', person: { person: 'p-itm-a' } },
  { id: 'as-dev', unitId: 'team-a1', roleId: 'ro-dev', person: { person: 'p-dev' } },
]

function organisation(over: Partial<Organisation> = {}): Organisation {
  return {
    units: [
      unit('board', 'ut-board'),
      unit('tech', 'ut-tech'),
      unit('lob-a', 'ut-lob', 'tech', { order: 2 }),
      unit('lob-b', 'ut-lob', 'tech', { order: 1 }),
      unit('team-a1', 'ut-team', 'lob-a'),
      unit('group', undefined),
    ],
    assignments, roles, unitTypes: [board, tech, lob, team],
    ...over,
  }
}

const DAY = '2026-10-17'
const keptIn = (id: string) => (id === 'group' ? undefined : 'organisation/technology')

function planned(answer: ReturnType<typeof unitMove>): UnitMovePlan {
  if (!answer.ok) throw new Error(`refused: ${answer.reason}`)
  return answer
}

describe('unitMove — the commands', () => {
  it('is one element.update of parentId in the scope that keeps the unit, its order cleared', () => {
    const plan = planned(unitMove({ organisation: organisation(), scopeOf: keptIn, unitIds: ['lob-a'], parentId: 'board', day: DAY }))
    expect(plan.moved).toEqual(['lob-a'])
    expect([...plan.steps]).toEqual([
      ['organisation/technology', [{ type: 'element.update', id: 'lob-a', patch: { parentId: 'board', order: undefined } }]],
    ])
  })

  it('leaves the units inside it as they are: they keep their own parent, so they come with it', () => {
    const plan = planned(unitMove({ organisation: organisation(), scopeOf: keptIn, unitIds: ['lob-a'], parentId: 'board', day: DAY }))
    const commands = [...plan.steps.values()].flat()
    expect(commands.some((one) => 'id' in one && one.id === 'team-a1')).toBe(false)
    const after = withUnitsMoved(organisation(), new Set(['lob-a']), 'board')
    expect(after.units.find((one) => one.id === 'team-a1')?.parentId).toBe('lob-a')
  })

  it('touches no assignment and no reporting line: they are keyed by the unit, which keeps its id', () => {
    const plan = planned(unitMove({ organisation: organisation(), scopeOf: keptIn, unitIds: ['lob-a'], parentId: 'board', day: DAY }))
    const commands = [...plan.steps.values()].flat()
    expect(commands.every((one) => one.type === 'element.update' && Object.keys(one.patch).sort().join() === 'order,parentId')).toBe(true)
  })

  it('moves several siblings at once, one command each', () => {
    const plan = planned(unitMove({ organisation: organisation(), scopeOf: keptIn, unitIds: ['lob-a', 'lob-b'], parentId: 'board', day: DAY }))
    expect(plan.moved).toEqual(['lob-a', 'lob-b'])
    expect(plan.steps.get('organisation/technology')?.map((one) => ('id' in one ? one.id : ''))).toEqual(['lob-a', 'lob-b'])
  })

  it('gives one list per scope where the units are kept in different scopes', () => {
    const scopeOf = (id: string) => (id === 'lob-a' ? 'a' : 'b')
    const plan = planned(unitMove({ organisation: organisation(), scopeOf, unitIds: ['lob-a', 'lob-b'], parentId: 'board', day: DAY }))
    expect([...plan.steps.keys()]).toEqual(['a', 'b'])
    expect(plan.steps.get('b')).toEqual([{ type: 'element.update', id: 'lob-b', patch: { parentId: 'board', order: undefined } }])
  })

  it('moves to the top with no parent', () => {
    const plan = planned(unitMove({ organisation: organisation(), scopeOf: keptIn, unitIds: ['lob-a'], day: DAY }))
    expect(plan.parentId).toBeUndefined()
    expect(plan.steps.get('organisation/technology')).toEqual([{ type: 'element.update', id: 'lob-a', patch: { parentId: undefined, order: undefined } }])
  })

  it('writes nothing for a unit already there', () => {
    const plan = planned(unitMove({ organisation: organisation(), scopeOf: keptIn, unitIds: ['lob-a'], parentId: 'tech', day: DAY }))
    expect(plan.moved).toEqual([])
    expect(plan.steps.size).toBe(0)
  })
})

describe('unitMove — refusals', () => {
  const ask = (unitIds: string[], parentId: string | undefined, over: Partial<Organisation> = {}) => unitMove({
    organisation: organisation(over), scopeOf: keptIn, unitIds, ...(parentId !== undefined ? { parentId } : {}), day: DAY,
  })

  it('refuses what is not a unit, and a parent that is not one or is not there', () => {
    expect(ask(['group'], 'board')).toEqual({ ok: false, reason: 'notAUnit', unitId: 'group' })
    expect(ask(['nowhere'], 'board')).toEqual({ ok: false, reason: 'notAUnit', unitId: 'nowhere' })
    expect(ask(['lob-a'], 'nowhere')).toEqual({ ok: false, reason: 'unknownParent', parentId: 'nowhere' })
    expect(ask(['lob-a'], 'group')).toEqual({ ok: false, reason: 'parentNotAUnit', parentId: 'group' })
  })

  it('refuses a unit under itself', () => {
    expect(ask(['lob-a'], 'lob-a')).toEqual({ ok: false, reason: 'itself', unitId: 'lob-a' })
  })

  it('refuses a loop: under a unit inside it, or a unit it sits in moved under it', () => {
    expect(ask(['lob-a'], 'team-a1')).toEqual({ ok: false, reason: 'loop', unitId: 'lob-a', day: DAY })
    expect(ask(['tech'], 'lob-b')).toEqual({ ok: false, reason: 'loop', unitId: 'tech', day: DAY })
  })

  it('refuses a loop on a later day a plan\'s move reaches', () => {
    const moves = [{ unitId: 'board', parentId: 'lob-b', on: '2027-01-01' }]
    // Today the Board is at the top, so the business is fine under it; from the plan's day it would be under itself.
    expect(ask(['lob-b'], 'board', { moves })).toEqual({ ok: false, reason: 'loop', unitId: 'lob-b', day: '2027-01-01' })
    expect(ask(['lob-a'], 'board', { moves }).ok).toBe(true)
  })

  it('refuses where the scope that keeps a unit is not known', () => {
    expect(unitMove({ organisation: organisation(), scopeOf: () => undefined, unitIds: ['lob-a'], parentId: 'board', day: DAY }))
      .toEqual({ ok: false, reason: 'notKept', unitId: 'lob-a' })
  })
})

describe('unitMove — its type\'s place', () => {
  it('says a unit fits where its type may sit', () => {
    const plan = planned(unitMove({ organisation: organisation(), scopeOf: keptIn, unitIds: ['lob-a'], parentId: 'board', day: DAY }))
    expect(plan.fits).toEqual([{ unitId: 'lob-a', fits: true, parentType: 'ut-board' }])
  })

  it('allows a misfit and flags it: the finding stands, the move is not refused', () => {
    const top = planned(unitMove({ organisation: organisation(), scopeOf: keptIn, unitIds: ['lob-a'], day: DAY }))
    expect(top.fits).toEqual([{ unitId: 'lob-a', fits: false }])
    expect(top.steps.size).toBe(1)
    const underTeam = planned(unitMove({ organisation: organisation(), scopeOf: keptIn, unitIds: ['lob-b'], parentId: 'team-a1', day: DAY }))
    expect(underTeam.fits).toEqual([{ unitId: 'lob-b', fits: false, parentType: 'ut-team' }])
  })

  it('asks no type the model does not hold', () => {
    expect(unitFits(organisation(), { unitTypeId: 'ut-gone' }, undefined)).toBe(true)
    expect(unitFits(organisation(), { unitTypeId: 'ut-tech' }, undefined)).toBe(true)
    expect(unitFits(organisation(), { unitTypeId: 'ut-tech' }, 'board')).toBe(true)
    expect(unitFits(organisation(), { unitTypeId: 'ut-lob' }, 'tech')).toBe(false)
  })
})

describe('unitMove — who manages it, before and after', () => {
  it('says the managers above it by nesting, before and after, and leaves its own out', () => {
    const plan = planned(unitMove({ organisation: organisation(), scopeOf: keptIn, unitIds: ['lob-a'], parentId: 'board', day: DAY }))
    const [moved] = plan.managers
    expect(moved.unitId).toBe('lob-a')
    expect(moved.before.map((one) => [one.person, one.unitId, one.via])).toEqual([['p-cio', 'tech', 'nesting']])
    expect(moved.after.map((one) => [one.person, one.unitId, one.via])).toEqual([['p-chair', 'board', 'nesting']])
  })

  it('re-lands a line by role on the nearest holder above after the move, or the single holder elsewhere', () => {
    const second = unit('tech-2', 'ut-tech', 'board')
    const org = organisation({
      units: [...organisation().units, second],
      assignments: [...assignments, { id: 'as-cio-2', unitId: 'tech-2', roleId: 'ro-cio', person: { person: 'p-cio-2' } }],
    })
    const itmLine = (at: Organisation) => reportingLinesOn(at, DAY).find((line) => line.unitId === 'lob-a' && line.roleId === 'ro-itm')
    // Under Technology, the nearest unit above that holds the CIO role is Technology.
    expect(itmLine(org)?.to?.unitId).toBe('tech')
    // Under the second Technology unit, it is that one.
    expect(itmLine(withUnitsMoved(org, new Set(['lob-a']), 'tech-2'))?.to?.unitId).toBe('tech-2')
    // Under the Board, none above holds it, and two units elsewhere do: the line says nothing until one is named.
    expect(itmLine(withUnitsMoved(org, new Set(['lob-a']), 'board'))?.state).toBe('ambiguous')
    // With one holder in the organisation, it lands on that one wherever the unit sits.
    expect(itmLine(withUnitsMoved(organisation(), new Set(['lob-a']), 'board'))?.to?.unitId).toBe('tech')
  })

  it('says a manager by line, and keeps saying it after the move where the line still lands', () => {
    // The business lead reports to the CIO by a line, wherever the line of business sits.
    const withLine = roles.map((role) => (role.id === 'ro-lead' ? { ...role, reportsTo: { role: 'ro-cio', kind: 'solid' as const } } : role))
    const org = organisation({ roles: withLine })
    const plan = planned(unitMove({ organisation: org, scopeOf: keptIn, unitIds: ['lob-a'], parentId: 'board', day: DAY }))
    const [moved] = plan.managers
    expect(moved.after.map((one) => [one.person, one.via])).toEqual([['p-cio', 'line'], ['p-chair', 'nesting']])
  })

  it('names a plan\'s move of a unit moved, and whether the day has reached it', () => {
    const moves = [{ unitId: 'lob-a', parentId: 'tech', on: '2026-01-01' }, { unitId: 'lob-a', parentId: 'board', on: '2027-06-01' }]
    const plan = planned(unitMove({ organisation: organisation({ moves }), scopeOf: keptIn, unitIds: ['lob-a'], parentId: 'board', day: DAY }))
    expect(plan.planned).toEqual([
      { unitId: 'lob-a', parentId: 'tech', on: '2026-01-01', reached: true },
      { unitId: 'lob-a', parentId: 'board', on: '2027-06-01', reached: false },
    ])
  })
})

describe('unitsBeside', () => {
  it('lists the units under the same parent on the day, the unit itself left out', () => {
    expect(unitsBeside(organisation(), 'lob-a', DAY).map((one) => one.id)).toEqual(['lob-b'])
    expect(unitsBeside(organisation(), 'board', DAY).map((one) => one.id)).toEqual(['tech'])
    expect(unitsBeside(organisation(), 'team-a1', DAY)).toEqual([])
  })

  it('reads the parents a plan gives on the day, and leaves out a unit not there', () => {
    const moves = [{ unitId: 'lob-b', parentId: 'board', on: '2026-01-01' }]
    expect(unitsBeside(organisation({ moves }), 'lob-a', DAY)).toEqual([])
    const ended = organisation({ units: organisation().units.map((one) => (one.id === 'lob-b' ? { ...one, lifecycleDates: { retired: '2026-01-01' } } : one)) })
    expect(unitsBeside(ended, 'lob-a', DAY)).toEqual([])
  })
})
