// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { inOwnOrder } from '../model/operatingModel'
import type { Responsibility, Role } from '../model/operatingModel'
import { ALL_OF_THE_MATRIX, groupsOf, matrixOf } from './matrixView'

// Added in an order that is not the alphabet's, as a model grows.
const responsibilities: Responsibility[] = [
  { id: 'rs-1', name: 'Test', group: 'Build' },
  { id: 'rs-2', name: 'Plan', group: 'Run' },
  { id: 'rs-3', name: 'Code', group: 'Build' },
  { id: 'rs-4', name: 'Budget' },
]
const roles: Role[] = [
  { id: 'ro-1', name: 'Tester', duties: [{ responsibility: 'rs-1', raci: 'A' }] },
  { id: 'ro-2', name: 'Developer', short: 'Dev', duties: [{ responsibility: 'rs-3', raci: 'A' }, { responsibility: 'rs-1', raci: 'C' }] },
  { id: 'ro-3', name: 'Owner', duties: [{ responsibility: 'rs-2', raci: 'A' }, { responsibility: 'rs-4', raci: 'A' }] },
]
const model = { roles, responsibilities }
const byName = { ...ALL_OF_THE_MATRIX, order: 'name' } as const
const shape = (view: Parameters<typeof matrixOf>[1], over: Parameters<typeof matrixOf>[0] = model) => {
  const matrix = matrixOf(over, view)
  return { roles: matrix.roles.map((role) => role.id), rows: matrix.groups.map(({ group, responsibilities: held }) => [group, ...held.map((r) => r.name)]) }
}

describe('the responsibilities matrix as it is looked at', () => {
  it('opens in the organisation\'s own order: as added until something is moved', () => {
    expect(shape(ALL_OF_THE_MATRIX)).toEqual({
      roles: ['ro-1', 'ro-2', 'ro-3'],
      rows: [['Build', 'Test', 'Code'], ['Run', 'Plan'], ['', 'Budget']],
    })
  })

  it('reads the own order from each role\'s and responsibility\'s order, a group standing where its first one does', () => {
    const moved = {
      roles: roles.map((role) => ({ ...role, order: { 'ro-1': 3, 'ro-2': 1, 'ro-3': 2 }[role.id] })),
      responsibilities: responsibilities.map((one) => ({ ...one, order: { 'rs-1': 4, 'rs-2': 1, 'rs-3': 2, 'rs-4': 3 }[one.id] })),
    }
    expect(shape(ALL_OF_THE_MATRIX, moved)).toEqual({
      roles: ['ro-2', 'ro-3', 'ro-1'],
      rows: [['Run', 'Plan'], ['Build', 'Code', 'Test'], ['', 'Budget']],
    })
  })

  it('goes by name when asked: columns by their heading, groups and the rows in them by name, the ungrouped last', () => {
    expect(shape(byName)).toEqual({
      roles: ['ro-2', 'ro-3', 'ro-1'],
      rows: [['Build', 'Code', 'Test'], ['Run', 'Plan'], ['', 'Budget']],
    })
  })

  it('keeps the picked roles and the responsibilities any of them has a part in', () => {
    expect(shape({ ...ALL_OF_THE_MATRIX, roles: ['ro-1'] })).toEqual({ roles: ['ro-1'], rows: [['Build', 'Test']] })
    expect(shape({ ...byName, roles: ['ro-1', 'ro-3'] })).toEqual({
      roles: ['ro-3', 'ro-1'], rows: [['Build', 'Test'], ['Run', 'Plan'], ['', 'Budget']],
    })
  })

  it('keeps the picked groups, the ungrouped being one, and both filters together', () => {
    expect(shape({ ...ALL_OF_THE_MATRIX, groups: ['Run', ''] }).rows).toEqual([['Run', 'Plan'], ['', 'Budget']])
    expect(shape({ ...ALL_OF_THE_MATRIX, groups: ['Build'], roles: ['ro-3'] }).rows).toEqual([])
  })

  it('lets a role or a group that has gone keep nothing out', () => {
    expect(shape({ ...ALL_OF_THE_MATRIX, roles: ['ro-9'], groups: ['Gone'] }).roles).toHaveLength(3)
    expect(shape({ ...ALL_OF_THE_MATRIX, roles: ['ro-9'], groups: ['Gone'] }).rows).toHaveLength(3)
  })

  it('lists the groups by name, the ungrouped last', () => {
    expect(groupsOf(responsibilities)).toEqual(['Build', 'Run', ''])
    expect(groupsOf(responsibilities.slice(0, 3))).toEqual(['Build', 'Run'])
  })
})

describe('the organisation\'s own order', () => {
  it('goes by order, low first, and puts those without one after, as they were added', () => {
    const list = [{ id: 'a' }, { id: 'b', order: 2 }, { id: 'c' }, { id: 'd', order: 1 }]
    expect(inOwnOrder(list).map((one) => one.id)).toEqual(['d', 'b', 'a', 'c'])
  })
})
