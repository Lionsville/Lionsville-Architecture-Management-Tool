// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Responsibility, Role } from '../model/operatingModel'
import { ALL_OF_THE_MATRIX } from './matrixView'
import { needOf, raciCsv, raciGrid, raciParts, readLook, rowsNeeding, writeLook } from './raciView'

const row = (id: string, group: string): Responsibility => ({ id, name: `Row ${id}`, group })
const role = (id: string, duties: Record<string, 'R' | 'A' | 'C' | 'I'>): Role => ({
  id, name: `Role ${id}`, duties: Object.entries(duties).map(([responsibility, raci]) => ({ responsibility, raci })),
})
const MODEL = {
  responsibilities: [row('a', 'Plan'), row('b', 'Plan'), row('c', 'Move')],
  roles: [role('r1', { a: 'A', c: 'R' }), role('r2', { b: 'C' }), role('r3', {}), role('r4', { c: 'A' }), role('r5', { c: 'A' })],
}
const ids = (list: readonly { id: string }[]) => list.map((one) => one.id)

describe('what the look says', () => {
  it('is read back as it is written, the whole organisation as a star', () => {
    for (const look of [{ part: 'Plan' }, { whole: true }, { unit: 'u1', part: '' }, { row: 'a', part: 'Plan', select: 'r1', needs: true }]) {
      expect(readLook(writeLook(look))).toEqual(look)
    }
    expect(readLook(writeLook({ whole: true })).whole).toBe(true)
    expect(writeLook({})).toBeUndefined()
  })
})

describe('the grid a look leaves', () => {
  it('opens on the first part, with only the roles that have a part, the rest folded', () => {
    const grid = raciGrid(MODEL, {}, ALL_OF_THE_MATRIX, undefined, [])
    expect(grid.rows.map((one) => one.responsibility.id)).toEqual(['a', 'b'])
    expect(ids(grid.columns)).toEqual(['r1', 'r2'])
    expect(ids(grid.folded)).toEqual(['r3', 'r4', 'r5'])
    expect(grid.headings).toBe(false)
  })

  it('shows every row under its heading in the whole organisation', () => {
    const grid = raciGrid(MODEL, { whole: true }, ALL_OF_THE_MATRIX, undefined, [])
    expect(grid.rows).toHaveLength(3)
    expect(ids(grid.folded)).toEqual(['r3'])
    expect(grid.headings).toBe(true)
  })

  it('takes a role out of the fold when somebody adds it', () => {
    const grid = raciGrid(MODEL, { part: 'Plan' }, ALL_OF_THE_MATRIX, undefined, ['r3'])
    expect(ids(grid.columns)).toEqual(['r1', 'r2', 'r3'])
  })

  it('narrows to a unit: its roles, and the rows they have a part in', () => {
    const grid = raciGrid(MODEL, { unit: 'u' }, ALL_OF_THE_MATRIX, ['r2', 'r3'], [])
    expect(grid.rows.map((one) => one.responsibility.id)).toEqual(['b'])
    expect(ids(grid.columns)).toEqual(['r2'])
    expect(ids(grid.folded)).toEqual(['r3'])
  })

  it('shows only what needs one A over everything, wherever the look was', () => {
    const grid = raciGrid(MODEL, { part: 'Plan', needs: true }, ALL_OF_THE_MATRIX, undefined, [])
    expect(grid.rows.map((one) => one.responsibility.id)).toEqual(['b', 'c'])
  })
})

describe('what needs one A', () => {
  it('is counted over every role, whatever the view keeps', () => {
    expect(needOf(MODEL.roles, 'a')).toBeUndefined()
    expect(needOf(MODEL.roles, 'b')).toBe(0)
    expect(needOf(MODEL.roles, 'c')).toBe(2)
    expect(ids(rowsNeeding(MODEL))).toEqual(['b', 'c'])
  })

  it('marks a closed group by what is below it, and under a unit keeps only its rows', () => {
    expect(raciParts(MODEL).map((one) => [one.group, one.needing])).toEqual([['Plan', 1], ['Move', 1]])
    expect(raciParts(MODEL, ['r2']).map((one) => one.responsibilities.length)).toEqual([1, 0])
  })
})

describe('the export', () => {
  it('writes a row per responsibility, quoting what a comma would break', () => {
    const rows = [{ responsibility: { id: 'c', name: 'Run, and restore' }, group: 'Move' }]
    const csv = raciCsv(MODEL.roles.slice(3), rows, { group: 'Group', responsibility: 'Responsibility', needs: 'Needs', noGroup: 'None', need: (count) => `${count} A` }, MODEL.roles)
    expect(csv).toBe('Group,Responsibility,Role r4,Role r5,Needs\nMove,"Run, and restore",A,A,2 A\n')
  })
})
