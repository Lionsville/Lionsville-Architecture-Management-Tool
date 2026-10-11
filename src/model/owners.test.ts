// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Owners worked out on the day from the operating model's rules (ADR-0036
 * §2): the owner follows whoever holds the role, and nothing is stored.
 */
import { describe, expect, it } from 'vitest'
import { applicationOwnersOn, domainOwnersOn, ruleRole, unitsByRule } from './owners'
import type { OperatingRule, Role } from './operatingModel'
import type { Assignment, Organisation, UnitLike } from './units'

const unit = (id: string, over: Partial<UnitLike> = {}): UnitLike => ({
  id, name: id, kind: 'actor', unitTypeId: 'ut-team', lifecycle: 'live', ...over,
})
const po: Role = { id: 'ro-po', name: 'Product Owner', duties: [] }
const lead: Role = { id: 'ro-lead', name: 'Domain lead', duties: [] }
const rules: OperatingRule[] = [{ id: 'applicationOwner', role: 'ro-po' }, { id: 'domainOwner', role: 'ro-lead' }]

// Femke holds the role until the end of June; Bram takes it over from July.
const femke: Assignment = { id: 'as-1', unitId: 'orders', roleId: 'ro-po', person: { person: 'pe-femke' }, from: '2025-01-01', until: '2026-06-30' }
const bram: Assignment = { id: 'as-2', unitId: 'orders', roleId: 'ro-po', person: { person: 'pe-bram' }, from: '2026-07-01' }
const sara: Assignment = { id: 'as-3', unitId: 'retail', roleId: 'ro-lead', person: { person: 'pe-sara' } }

const organisation: Organisation = {
  units: [unit('retail', { scopes: ['retail'] }), unit('orders', { parentId: 'retail' })],
  assignments: [femke, bram, sara],
  roles: [po, lead],
  unitTypes: [],
}

describe('an application’s owner, worked out on the day', () => {
  it('follows whoever holds the rule’s role in the unit it belongs to', () => {
    const shop = { partyId: 'orders' }
    expect(applicationOwnersOn(organisation, rules, shop, '2026-03-01').map((one) => one.person)).toEqual(['pe-femke'])
    expect(applicationOwnersOn(organisation, rules, shop, '2026-08-01').map((one) => one.person)).toEqual(['pe-bram'])
    expect(applicationOwnersOn(organisation, rules, shop, '2026-08-01')[0]).toMatchObject({ roleId: 'ro-po', unitId: 'orders' })
  })

  it('is nobody where an owner is written, the application belongs to no unit, or there is no rule', () => {
    expect(applicationOwnersOn(organisation, rules, { partyId: 'orders', owner: 'Operations' }, '2026-08-01')).toEqual([])
    expect(applicationOwnersOn(organisation, rules, { partyId: 'orders', owner: { person: 'pe-x' } }, '2026-08-01')).toEqual([])
    expect(applicationOwnersOn(organisation, rules, { partyId: 'orders', owner: '  ' }, '2026-08-01')).toHaveLength(1)
    expect(applicationOwnersOn(organisation, rules, {}, '2026-08-01')).toEqual([])
    expect(applicationOwnersOn(organisation, [], { partyId: 'orders' }, '2026-08-01')).toEqual([])
    expect(ruleRole(undefined, 'applicationOwner')).toBeUndefined()
  })

  it('is nobody while the unit is not there or the role has ended', () => {
    const ended: Organisation = { ...organisation, units: [unit('orders', { lifecycle: 'retired' })] }
    expect(applicationOwnersOn(ended, rules, { partyId: 'orders' }, '2026-08-01')).toEqual([])
    const roleGone: Organisation = { ...organisation, roles: [{ ...po, until: '2026-07-31' }, lead] }
    expect(applicationOwnersOn(roleGone, rules, { partyId: 'orders' }, '2026-08-01')).toEqual([])
  })
})

describe('a domain’s owner, worked out on the day', () => {
  it('is whoever holds the rule’s role in a unit that serves the scope, or is filed in it', () => {
    const filedIn = (id: string) => (id === 'orders' ? 'retail/orders' : '')
    expect(domainOwnersOn(organisation, rules, 'retail', '2026-08-01', filedIn).map((one) => one.person)).toEqual(['pe-sara'])
    expect(domainOwnersOn(organisation, rules, 'retail/orders', '2026-08-01', filedIn)).toEqual([])
    expect(domainOwnersOn(organisation, [], 'retail', '2026-08-01', filedIn)).toEqual([])
  })
})

describe('what a rule makes one person', () => {
  it('is the units they hold the rule’s role in that day, under any id that is theirs', () => {
    expect(unitsByRule(organisation, rules, 'applicationOwner', 'pe-bram', '2026-08-01')).toEqual(['orders'])
    expect(unitsByRule(organisation, rules, 'applicationOwner', 'pe-femke', '2026-08-01')).toEqual([])
    expect(unitsByRule(organisation, rules, 'applicationOwner', 'pe-b2', '2026-08-01', (id) => (id === 'pe-bram' ? 'pe-b2' : id))).toEqual(['orders'])
    expect(unitsByRule(organisation, [], 'applicationOwner', 'pe-bram', '2026-08-01')).toEqual([])
  })
})
