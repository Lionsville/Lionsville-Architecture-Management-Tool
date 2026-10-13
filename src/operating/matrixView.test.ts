// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
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
  {
    id: 'ro-1',
    name: 'Tester',
    duties: [{ responsibility: 'rs-1', raci: 'A' }],
  },
  {
    id: 'ro-2',
    name: 'Developer',
    short: 'Dev',
    duties: [
      { responsibility: 'rs-3', raci: 'A' },
      { responsibility: 'rs-1', raci: 'C' },
    ],
  },
  {
    id: 'ro-3',
    name: 'Owner',
    duties: [
      { responsibility: 'rs-2', raci: 'A' },
      { responsibility: 'rs-4', raci: 'A' },
    ],
  },
]
const model = { roles, responsibilities }
const shape = (view: Parameters<typeof matrixOf>[1]) => {
  const matrix = matrixOf(model, view)
  return {
    roles: matrix.roles.map((role) => role.id),
    rows: matrix.groups.map(({ group, responsibilities: held }) => [group, ...held.map((r) => r.name)]),
  }
}

describe('the responsibilities matrix as it is looked at', () => {
  it('goes by name: columns by their heading, groups and the rows in them by name, the ungrouped last', () => {
    expect(shape(ALL_OF_THE_MATRIX)).toEqual({
      roles: ['ro-2', 'ro-3', 'ro-1'],
      rows: [
        ['Build', 'Code', 'Test'],
        ['Run', 'Plan'],
        ['', 'Budget'],
      ],
    })
  })

  it('goes as added when asked, as the model holds them', () => {
    expect(shape({ ...ALL_OF_THE_MATRIX, order: 'added' })).toEqual({
      roles: ['ro-1', 'ro-2', 'ro-3'],
      rows: [
        ['Build', 'Test', 'Code'],
        ['Run', 'Plan'],
        ['', 'Budget'],
      ],
    })
  })

  it('keeps the picked roles and the responsibilities any of them has a part in', () => {
    expect(shape({ ...ALL_OF_THE_MATRIX, roles: ['ro-1'] })).toEqual({
      roles: ['ro-1'],
      rows: [['Build', 'Test']],
    })
    expect(shape({ ...ALL_OF_THE_MATRIX, roles: ['ro-1', 'ro-3'] })).toEqual({
      roles: ['ro-3', 'ro-1'],
      rows: [
        ['Build', 'Test'],
        ['Run', 'Plan'],
        ['', 'Budget'],
      ],
    })
  })

  it('keeps the picked groups, the ungrouped being one, and both filters together', () => {
    expect(shape({ ...ALL_OF_THE_MATRIX, groups: ['Run', ''] }).rows).toEqual([
      ['Run', 'Plan'],
      ['', 'Budget'],
    ])
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
