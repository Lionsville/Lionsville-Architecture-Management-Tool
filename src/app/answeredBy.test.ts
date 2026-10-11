// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who answers for a record beyond its own owner field (ADR-0036 §2, §8): a
 * stand-in shows the owner its master names, by id; an application nobody
 * wrote an owner on is owned, on the day, by whoever holds the rule's role in
 * the unit it belongs to — this scope's session laid over the tree.
 */
import { describe, expect, it } from 'vitest'
import type { HostModel } from '../model/hostModel'
import type { DesignElement } from '../model/types'
import { indexScopes } from '../projects/scopeIndex'
import { answeredByOf } from './useWorkspaceOwnership'

const app = (id: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over,
})

const root = {
  elements: [], relations: [],
  roles: [{ id: 'ro-po', name: 'Product owner', duties: [] }],
  operatingRules: [{ id: 'applicationOwner' as const, role: 'ro-po' }],
}
const retail: HostModel = {
  name: 'Retail', relations: [], diagrams: [],
  elements: [
    { id: 'webshop', kind: 'actor', name: 'Team Webshop', unitTypeId: 'ut-team', lifecycle: 'live', isManaged: false, aspects: {} },
    app('shop', { partyId: 'webshop' }),
    app('crm', { owner: { person: 'pe-kim' } }),
  ],
  assignments: [{ id: 'as-1', unitId: 'webshop', roleId: 'ro-po', person: { person: 'pe-femke' }, until: '2026-12-31' }],
}
const index = indexScopes([{ path: '', model: root }, { path: 'retail', model: retail }])
const at = (model: HostModel, scope: string, today = '2026-10-11') => ({ session: { current: () => model }, scope, index, today })

describe('who answers for a record', () => {
  it('works an application’s owner out from the rule, on the day, and never where one is written', () => {
    expect(answeredByOf(retail.elements[1], at(retail, 'retail'))).toEqual({
      workedOut: { people: ['pe-femke'], role: 'Product owner', unit: 'Team Webshop', day: '2026-10-11' },
    })
    expect(answeredByOf(retail.elements[1], at(retail, 'retail', '2027-01-01'))).toBeUndefined()
    expect(answeredByOf(retail.elements[2], at(retail, 'retail'))).toBeUndefined()
  })

  it('shows a stand-in the owner its master names, by id', () => {
    const overview: HostModel = { name: 'Overview', relations: [], diagrams: [], elements: [app('crm', { ref: 'retail' })] }
    expect(answeredByOf(overview.elements[0], at(overview, 'overview'))).toEqual({ owner: { person: 'pe-kim' } })
    expect(answeredByOf(app('nothing', { kind: 'function' }), at(overview, 'overview'))).toBeUndefined()
  })
})
