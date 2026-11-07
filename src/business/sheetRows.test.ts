// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../model'
import type { SheetArea, SheetCapability } from './sheet'
import { leavesOfArea, rowAbove, rowsOfArea, unfoldedRows } from './sheetRows'

const element = (id: string): DesignElement => ({ id, kind: 'function', name: id, lifecycle: 'live' } as DesignElement)
const capability = (id: string, depth = 1): SheetCapability => ({
  element: element(id), depth, coverage: { supportedBy: [], assignedTo: [], coverage: 'uncovered' },
})
const area: SheetArea = {
  element: element('area'),
  groupings: [{ element: element('group'), capabilities: [capability('a'), capability('a1', 2), capability('a2', 2), capability('b')] }],
  capabilities: [capability('loose')],
}

describe('an area as rows', () => {
  it('draws one kind of row, indented, in the sheet’s order', () => {
    expect(rowsOfArea(area).map((row) => [row.element.id, row.depth, row.parentId])).toEqual([
      ['group', 0, 'area'], ['a', 1, 'group'], ['a1', 2, 'a'], ['a2', 2, 'a'], ['b', 1, 'group'], ['loose', 0, 'area'],
    ])
  })

  it('knows the leaves under each parent, and counts only those on the area', () => {
    const rows = rowsOfArea(area)
    expect(rows[0].leaves).toEqual(['a1', 'a2', 'b'])
    expect(rows[1]).toMatchObject({ parent: true, leaves: ['a1', 'a2'] })
    expect(leavesOfArea(rows)).toEqual(['a1', 'a2', 'b', 'loose'])
  })

  it('takes out what is folded, at any depth, and keeps the folded row', () => {
    const rows = rowsOfArea(area)
    expect(unfoldedRows(rows, new Set(['group'])).map((row) => row.element.id)).toEqual(['group', 'loose'])
    expect(unfoldedRows(rows, new Set(['a'])).map((row) => row.element.id)).toEqual(['group', 'a', 'b', 'loose'])
  })

  it('finds the sibling above, to file a row under', () => {
    const rows = rowsOfArea(area)
    expect(rowAbove(rows, 'b')?.element.id).toBe('a')
    expect(rowAbove(rows, 'a')).toBeUndefined()
  })
})
