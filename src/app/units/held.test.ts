// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a person holds across the tree, as the People page shows it (ADR-0036
 * §4): every assignment under one of their ids, the role and the unit by name.
 */
import { describe, expect, it } from 'vitest'
import type { Person } from '../../people/person'
import { indexScopes } from '../../projects/scopeIndex'
import { heldAssignments, idsOfPerson, ownedByRule } from './held'

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

describe('what the rules make a person own', () => {
  const index = indexScopes([
    {
      path: '',
      model: {
        elements: [{ id: 'retail', kind: 'actor', name: 'Retail', unitTypeId: 'ut-domain', scopes: ['retail'], lifecycle: 'live', isManaged: false, aspects: {} }],
        relations: [],
        roles: [{ id: 'ro-po', name: 'Product owner', duties: [] }, { id: 'ro-lead', name: 'Domain lead', duties: [] }],
        operatingRules: [{ id: 'applicationOwner', role: 'ro-po' }, { id: 'domainOwner', role: 'ro-lead' }],
        assignments: [{ id: 'as-9', unitId: 'retail', roleId: 'ro-lead', person: { person: 'pe-old' } }],
      },
    },
    {
      path: 'retail',
      model: {
        elements: [
          { id: 'webshop', kind: 'actor', name: 'Webshop', unitTypeId: 'ut-team', lifecycle: 'live', isManaged: false, aspects: {} },
          { id: 'shop', kind: 'application', name: 'Shop', partyId: 'webshop', lifecycle: 'live', isManaged: true, aspects: {} },
          { id: 'cart', kind: 'application', name: 'Cart', partyId: 'webshop', owner: 'Somebody', lifecycle: 'live', isManaged: true, aspects: {} },
        ],
        relations: [],
        assignments: [{ id: 'as-1', unitId: 'webshop', roleId: 'ro-po', person: { person: 'pe-femke' }, until: '2026-12-31' }],
      },
    },
  ])
  const ids = idsOfPerson('pe-femke', people)

  it('is every application nobody wrote an owner on whose unit they hold the role in, and every domain theirs serves', () => {
    expect(ownedByRule(index, ids, '2026-10-11', (path) => `[${path}]`)).toEqual([
      { kind: 'application', scope: 'retail', id: 'shop', name: 'Shop', day: '2026-10-11' },
      { kind: 'domain', scope: 'retail', id: 'retail', name: '[retail]', day: '2026-10-11' },
    ])
  })

  it('is nothing once the role is no longer theirs that day', () => {
    expect(ownedByRule(index, ids, '2027-01-01', (path) => path)).toEqual([
      { kind: 'domain', scope: 'retail', id: 'retail', name: 'retail', day: '2027-01-01' },
    ])
    expect(ownedByRule(index, new Set(['pe-bram']), '2026-10-11', (path) => path)).toEqual([])
  })

  it('is no domain for a unit kept at the organisation that says nothing: the organisation is none', () => {
    const top = indexScopes([{
      path: '',
      model: {
        elements: [{ id: 'retail', kind: 'actor', name: 'Retail', unitTypeId: 'ut-domain', lifecycle: 'live', isManaged: false, aspects: {} }],
        relations: [],
        roles: [{ id: 'ro-lead', name: 'Domain lead', duties: [] }],
        operatingRules: [{ id: 'domainOwner', role: 'ro-lead' }],
        assignments: [{ id: 'as-9', unitId: 'retail', roleId: 'ro-lead', person: { person: 'pe-old' } }],
      },
    }])
    expect(ownedByRule(top, ids, '2026-10-11', (path) => path)).toEqual([])
  })
})
