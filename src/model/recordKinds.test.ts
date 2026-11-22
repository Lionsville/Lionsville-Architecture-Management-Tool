// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { fromArrays } from './normalised'
import { RECORD_KINDS, RECORD_LISTS } from './recordKey'
import { KINDS, LISTS_BY_KIND, RECORD_LIST_NAMES } from './recordKinds'
import type { KindTable } from './recordKinds'

const KEY = 'check.unattributed'

describe('the kinds of record, described once', () => {
  it('has one descriptor per list the model keeps, under the list it names', () => {
    const model = fromArrays({ name: 'Acme', elements: [], relations: [], diagrams: [] })
    expect(RECORD_LIST_NAMES).toEqual(Object.keys(model.order))
    for (const list of RECORD_LIST_NAMES) expect(KINDS[list].list).toBe(list)
  })

  it('names each kind once', () => {
    const kinds = RECORD_LIST_NAMES.map((list) => KINDS[list].kind)
    expect(new Set(kinds).size).toBe(kinds.length)
  })

  it('does not compile without an entry for a list', () => {
    const { evaluations: _left, ...rest } = KINDS
    // @ts-expect-error — a list of the model with no descriptor is not a table of kinds
    const short: KindTable = rest
    // @ts-expect-error — and neither is one whose entry is filed under another list
    const misfiled: KindTable = { ...KINDS, evaluations: KINDS.citations }
    expect([short, misfiled]).toHaveLength(2)
  })

  it('says a record’s id: its own, and for a mark its check and key', () => {
    const table: KindTable = KINDS
    expect(table.elements.idOf({ id: 'crews', kind: 'application', name: 'Crews', lifecycle: 'live', isManaged: true, aspects: {} })).toBe('crews')
    expect(table.checkMarks.idOf({ check: KEY, key: 'crews', on: '2026-10-11' })).toBe(`${KEY} crews`)
  })
})

describe('what is derived from the descriptors', () => {
  // Written out, not derived again: these words are in every history and every
  // step a source keeps, so a descriptor changed by accident fails here.
  it('is the kinds a record key may name, in the model’s order, then the picture and the scope', () => {
    expect(RECORD_KINDS).toEqual([
      'element', 'relation', 'diagram', 'decision', 'transition',
      'observation', 'cause', 'solution', 'experiment',
      'unitType', 'role', 'responsibility', 'operatingRule', 'assignment', 'checkMark', 'comment', 'principle', 'citation', 'evaluation',
      'image', 'scope',
    ])
  })

  it('is the list each kind is kept in', () => {
    expect(RECORD_LISTS).toBe(LISTS_BY_KIND)
    expect(RECORD_LISTS).toEqual({
      element: 'elements', relation: 'relations', diagram: 'diagrams', decision: 'decisions',
      transition: 'transitions', observation: 'observations', cause: 'causes', solution: 'solutions',
      experiment: 'experiments',
      unitType: 'unitTypes', role: 'roles', responsibility: 'responsibilities', operatingRule: 'operatingRules',
      assignment: 'assignments', checkMark: 'checkMarks', comment: 'comments', principle: 'principles', citation: 'citations', evaluation: 'evaluations',
    })
    expect(Object.keys(RECORD_LISTS)).toEqual(RECORD_KINDS.slice(0, -2))
  })
})
