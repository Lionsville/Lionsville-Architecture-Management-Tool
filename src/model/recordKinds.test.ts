// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { fromArrays, toArrays } from './normalised'
import { RECORD_KINDS, RECORD_LISTS } from './recordKey'
import { KINDS, LISTS_BY_KIND, OPTIONAL_LISTS, RECORD_LIST_NAMES } from './recordKinds'
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

describe('what a list may say of itself', () => {
  const table: KindTable = KINDS
  const plain = (list: (typeof RECORD_LIST_NAMES)[number]) => table[list].commands !== 'own'

  it('is written by the plain three for fourteen of the nineteen, each under its own payload', () => {
    const payloads = RECORD_LIST_NAMES.flatMap((list) => {
      const { commands } = table[list]
      return commands === 'own' ? [] : [commands.payload]
    })
    expect(payloads).toEqual([
      'decision', 'transition', 'observation', 'cause', 'solution', 'experiment',
      'unitType', 'role', 'responsibility', 'rule', 'assignment', 'principle', 'citation', 'evaluation',
    ])
    expect(new Set(payloads).size).toBe(payloads.length)
  })

  it('is put back the plain way by a whole restore only where it is written the plain way', () => {
    for (const list of RECORD_LIST_NAMES) {
      const { restore } = table[list]
      if (restore === 'rows' || restore === 'list') expect(plain(list), list).toBe(true)
    }
    expect(RECORD_LIST_NAMES.filter((list) => table[list].restore === 'none')).toEqual(['transitions'])
  })

  it('gives a step a word only where it is plain and a diff names it', () => {
    for (const list of RECORD_LIST_NAMES) {
      if (table[list].step === 'own') continue
      expect(plain(list), list).toBe(true)
      expect(table[list].diff, list).toBe('compare')
    }
  })

  it('is compared record by record by a diff but for the four it says more of', () => {
    expect(RECORD_LIST_NAMES.filter((list) => table[list].diff === 'own')).toEqual(['elements', 'relations', 'diagrams', 'checkMarks'])
  })

  it('names a record that another names from what the scope calls it, and by its id where it calls it nothing', () => {
    const nothing = { element: () => undefined, record: () => undefined }
    const named = { element: (id: string) => `the ${id}`, record: (about: { id: string }) => `the ${about.id}` }
    const assignment = { id: 'as-1', unitId: 'crews', roleId: 'lead', person: { person: 'pe-1' } }
    const kind = table.assignments
    expect(kind.diff === 'compare' && [kind.nameOf(assignment, named), kind.nameOf(assignment, nothing)]).toEqual(['the crews', 'crews'])
    const citation = { id: 'ci-1', about: { kind: 'decision' as const, id: 'adr-1' }, principle: { scope: '', id: 'pr-1' }, stance: 'supports' as const, on: '2026-10-25' }
    const cited = table.citations
    expect(cited.diff === 'compare' && [cited.nameOf(citation, named), cited.nameOf(citation, nothing)]).toEqual(['the adr-1', 'adr-1'])
  })
})

describe('a list the file may leave out', () => {
  it('is every list but the three a landscape always has', () => {
    expect(RECORD_LIST_NAMES.filter((list) => !OPTIONAL_LISTS.includes(list))).toEqual(['elements', 'relations', 'diagrams'])
  })

  it('comes back absent where the file had none and empty where it was empty, each of them', () => {
    const bare = { name: 'Acme', elements: [], relations: [], diagrams: [] }
    const absent = fromArrays(bare)
    for (const list of OPTIONAL_LISTS) {
      expect(list in absent).toBe(false)
      expect(absent.order[list]).toEqual([])
      const empty = fromArrays({ ...bare, [list]: [] })
      expect(empty[list]).toEqual({})
      expect(toArrays(empty)[list]).toEqual([])
    }
    expect(toArrays(absent)).toEqual(bare)
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
