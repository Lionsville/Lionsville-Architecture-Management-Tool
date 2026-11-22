// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a person holds across the tree, as the People page shows it (ADR-0036
 * §4): every assignment under one of their ids, the role and the unit by name.
 */
import { describe, expect, it } from 'vitest'
import type { Person } from '../../people/person'
import { indexScopes } from '../../projects/scopeIndex'
import { heldAssignments, idsOfPerson, ownedByRule, reportingOf } from './held'

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
      { id: 'as-1', scope: 'customer', unit: 'Webshop', unitId: 'webshop', role: 'Product owner', share: 0.5, from: '2022-01-01', until: '2026-12-31', acting: true },
      { id: 'as-2', scope: 'customer', unit: 'gone', unitId: 'gone', role: 'ro-gone' },
    ])
  })

  it('says where each role held reports on the day, the line manager\'s line and the functional one (ADR-0039)', () => {
    const index = indexScopes([
      {
        path: '',
        model: {
          elements: [
            { id: 'customer', kind: 'actor', name: 'Customer', unitTypeId: 'ut-domain', lifecycle: 'live', isManaged: false, aspects: {} },
            { id: 'webshop', kind: 'actor', name: 'Webshop', unitTypeId: 'ut-team', parentId: 'customer', lifecycle: 'live', isManaged: false, aspects: {} },
          ],
          relations: [],
          unitTypes: [
            { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [{ role: 'ro-owner', min: 1 }] },
            { id: 'ut-team', name: 'Team', within: ['ut-domain'], slots: [{ role: 'ro-po', min: 1 }, { role: 'ro-dev', min: 0 }] },
          ],
          roles: [
            { id: 'ro-owner', name: 'Domain owner', duties: [], manages: true }, { id: 'ro-po', name: 'Product owner', duties: [] },
            { id: 'ro-dev', name: 'Developer', duties: [], reportsTo: [{ role: 'ro-po', kind: 'solid', within: true }, { role: 'ro-owner', kind: 'dotted' }] },
          ],
          assignments: [{ id: 'as-1', unitId: 'webshop', roleId: 'ro-dev', person: { person: 'pe-femke' } }],
        },
      },
    ])
    expect(heldAssignments(index, new Set(['pe-femke']), '2026-10-17')).toEqual([{
      id: 'as-1', scope: '', unit: 'Webshop', role: 'Developer',
      unitId: 'webshop', reportsTo: [{ kind: 'solid', role: 'Product owner', unit: 'Webshop' }, { kind: 'dotted', role: 'Domain owner', unit: 'Customer' }],
    }])
    // Without a day, nothing is said about reporting.
    expect(heldAssignments(index, new Set(['pe-femke']))[0]).not.toHaveProperty('reportsTo')
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

describe('who a person reports to, and who reports to them', () => {
  const unit = (id: string, name: string, parentId?: string) => ({
    id, kind: 'actor' as const, name, unitTypeId: 'ut', lifecycle: 'live' as const, isManaged: false, aspects: {}, ...(parentId ? { parentId } : {}),
  })
  const index = indexScopes([{
    path: '',
    model: {
      elements: [unit('terminal', 'Terminal'), unit('dock', 'Dock crew', 'terminal'), unit('desk', 'Planning desk', 'terminal')],
      relations: [],
      unitTypes: [{ id: 'ut', name: 'Unit', top: true, within: ['ut'], slots: [] }],
      roles: [
        { id: 'ro-head', name: 'Head', duties: [], manages: true },
        { id: 'ro-lead', name: 'Lead', duties: [], manages: true },
        { id: 'ro-member', name: 'Member', duties: [] },
      ],
      assignments: [
        { id: 'a-anna', unitId: 'terminal', roleId: 'ro-head', person: { person: 'pe-anna' } },
        { id: 'a-tom', unitId: 'dock', roleId: 'ro-lead', person: { person: 'pe-tom' } },
        { id: 'a-sam', unitId: 'dock', roleId: 'ro-member', person: { person: 'pe-sam' } },
        { id: 'a-pia', unitId: 'desk', roleId: 'ro-lead', person: { person: 'pe-pia' }, reportsTo: [{ kind: 'dotted', to: { scope: '', unit: 'dock', role: 'ro-lead' } }] },
      ],
    },
  }])
  const of = (id: string) => reportingOf(index, new Set([id]), '2026-11-07')

  it('says nesting as a line is said, nearest first', () => {
    expect(of('pe-sam').reportsTo.map(({ person, role, unit: where, via }) => [person, role, where, via])).toEqual([
      ['pe-tom', 'Lead', 'Dock crew', 'nesting'],
      ['pe-anna', 'Head', 'Terminal', 'nesting'],
    ])
  })

  it('says a functional line, and that it is the holder\'s own, from both ends', () => {
    expect(of('pe-pia').reportsTo).toContainEqual(expect.objectContaining({ person: 'pe-tom', functional: true, via: 'override' }))
    expect(of('pe-tom').manages).toContainEqual(expect.objectContaining({ person: 'pe-pia', role: 'Lead', unit: 'Planning desk', functional: true }))
  })

  it('lists only who has them as their nearest manager, the rest being further down the chart', () => {
    expect(of('pe-tom').manages.filter((one) => !one.functional).map((one) => one.person)).toEqual(['pe-sam'])
    expect(of('pe-anna').manages.map((one) => one.person).sort()).toEqual(['pe-pia', 'pe-tom'])
    expect(of('pe-sam').manages).toEqual([])
  })

  it('reports to nobody on a day nothing runs', () => {
    expect(of('pe-nobody')).toEqual({ reportsTo: [], manages: [] })
  })
})
