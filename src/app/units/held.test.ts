// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a person holds across the tree, as the People page shows it (ADR-0036
 * §4): every assignment under one of their ids, the role and the unit by name.
 */
import { describe, expect, it } from 'vitest'
import type { Person } from '../../people/person'
import { indexScopes } from '../../projects/scopeIndex'
import { heldAssignments, idsOfPerson } from './held'

const people: Person[] = [
  { id: 'pe-femke', name: 'Femke Bos', pseudonym: 'BCDF', kind: 'internal', state: 'active' },
  { id: 'pe-old', pseudonym: 'CDFG', kind: 'internal', state: 'active', mergedInto: 'pe-femke' },
]

describe('what a person holds', () => {
  it('is every assignment under their ids, the role and the unit named, the scope said', () => {
    const index = indexScopes([
      { path: '', model: { elements: [], relations: [], roles: [{ id: 'ro-po', name: 'Product owner', duties: [] }] } },
      {
        path: 'customer',
        model: {
          elements: [{ id: 'webshop', kind: 'actor', name: 'Webshop', unitTypeId: 'ut-team', lifecycle: 'live', isManaged: false, aspects: {} }],
          relations: [],
          assignments: [
            { id: 'as-1', unitId: 'webshop', roleId: 'ro-po', person: { person: 'pe-femke' }, share: 0.5, from: '2022-01-01', until: '2026-12-31', acting: true },
            { id: 'as-2', unitId: 'gone', roleId: 'ro-gone', person: { person: 'pe-old' } },
            { id: 'as-3', unitId: 'webshop', roleId: 'ro-po', person: { person: 'pe-bram' } },
          ],
        },
      },
    ])
    const ids = idsOfPerson('pe-femke', people)
    expect([...ids]).toEqual(['pe-femke', 'pe-old'])
    expect(heldAssignments(index, ids)).toEqual([
      { id: 'as-1', scope: 'customer', unit: 'Webshop', role: 'Product owner', share: 0.5, from: '2022-01-01', until: '2026-12-31', acting: true },
      { id: 'as-2', scope: 'customer', unit: 'gone', role: 'ro-gone' },
    ])
  })
})
