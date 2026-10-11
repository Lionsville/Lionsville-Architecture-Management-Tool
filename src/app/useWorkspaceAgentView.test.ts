// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The tree as the agent reads it with a scope open (ADR-0012, ADR-0036):
 * what the organisation contradicts about itself is the organisation as this
 * window has it — the open scope's session laid over the index, as the screens
 * read it — and one person under every id a merge left.
 */
import { describe, expect, it } from 'vitest'
import type { HostModel } from '../model/hostModel'
import type { Role, UnitType } from '../model/operatingModel'
import type { DesignElement, Relation } from '../model/types'
import type { Assignment } from '../model/units'
import type { Person } from '../people/person'
import { indexScopes } from '../projects/scopeIndex'
import type { ScopeReader } from '../projects/scopeAccess'
import type { ModelSession } from './useModelSession'
import { agentTree } from './useWorkspaceAgentView'

const TODAY = '2026-10-11'
const team: UnitType = { id: 'ut-team', name: 'Team', top: true, within: [], slots: [{ role: 'ro-dev', min: 1 }] }
const roles: Role[] = [{ id: 'ro-dev', name: 'Developer', duties: [] }]
const unit: DesignElement = { id: 'web', kind: 'actor', name: 'Webshop', lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId: 'ut-team' }
const as = (id: string, person: string, share: number): Assignment => ({ id, unitId: 'web', roleId: 'ro-dev', person: { person }, share })

const ROOT: HostModel = { name: 'Acme Logistics', elements: [], relations: [], diagrams: [], unitTypes: [team], roles }
const CUSTOMER: HostModel = { name: 'Customer', elements: [unit], relations: [], diagrams: [] }

function tree(now: HostModel, people: readonly Person[]) {
  const index = indexScopes([{ path: '', model: ROOT }, { path: 'customer', model: CUSTOMER }])
  return agentTree({
    session: { current: () => now } as unknown as ModelSession,
    scope: 'customer',
    indexRef: { current: index },
    rowsElsewhereRef: { current: [] as Relation[] },
    scopes: { path: '', name: 'Acme Logistics', diagrams: 0, children: [] } as never,
    reader: {} as ScopeReader,
    people: () => people,
  })
}

describe('the findings an agent reads with a scope open', () => {
  it('are of the organisation as the session holds it, and count a merged id as the person it went into', () => {
    const people: Person[] = [
      { id: 'pe-sara', name: 'Sara Kaya', pseudonym: 'BCDF', kind: 'internal', state: 'active' },
      { id: 'pe-sara2', pseudonym: 'CDFG', kind: 'internal', state: 'active', mergedInto: 'pe-sara' },
    ]
    const findings = (now: HostModel) => tree(now, people)?.findings(TODAY) ?? []
    const keys = (now: HostModel) => findings(now).map((one) => one.key)
    expect(keys(CUSTOMER)).toContain('check.roleVacant')
    const filled = { ...CUSTOMER, assignments: [as('as-1', 'pe-sara', 0.6), as('as-2', 'pe-sara2', 0.6)] }
    expect(keys(filled)).not.toContain('check.roleVacant')
    expect(findings(filled).filter((one) => one.key === 'check.personOverloaded').map((one) => one.id)).toEqual(['pe-sara'])
  })
})
