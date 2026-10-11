// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a scope's *Served by* says, off the index (ADR-0036, amended 11
 * October 2026): the units, their leads, how many serve through them, the
 * domain owner in each of its three cases, and what *+ Unit* offers.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import type { DesignElement } from '../../model'
import type { HostModel } from '../../model/hostModel'
import type { Role, UnitType } from '../../model/operatingModel'
import { indexScopes } from '../../projects/scopeIndex'
import { servedByOf } from './servedByView'

const s = translator('en')
const DAY = '2026-10-11'
const words = { scopeName: (path: string) => (path === '' ? 'the organisation' : path), s }

const types: UnitType[] = [
  { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [] },
  { id: 'ut-team', name: 'Team', within: ['ut-domain'], slots: [] },
]
const roles: Role[] = [{ id: 'ro-lead', name: 'Lead', duties: [], manages: true }]
const unit = (id: string, unitTypeId: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name: id[0].toUpperCase() + id.slice(1), unitTypeId, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})

function root(over: Partial<HostModel> = {}): HostModel {
  return { name: 'Acme', elements: [], relations: [], diagrams: [], unitTypes: types, roles, operatingRules: [{ id: 'domainOwner', role: 'ro-lead' }], ...over }
}
const shipping: HostModel = {
  name: 'Shipping', relations: [], diagrams: [],
  elements: [unit('shipping', 'ut-domain'), unit('tracking', 'ut-team', { parentId: 'shipping' })],
  assignments: [{ id: 'as-1', unitId: 'shipping', roleId: 'ro-lead', person: { person: 'pe-noor' } }],
}
const warehouse: HostModel = { name: 'Warehouse', relations: [], diagrams: [], elements: [unit('robotics', 'ut-team')] }

describe('what Served by says', () => {
  it('lists the units serving it with their leads, how many serve through them, and the domain owner', () => {
    const view = servedByOf(indexScopes([{ path: '', model: root() }, { path: 'shipping', model: shipping }, { path: 'warehouse', model: warehouse }]), 'shipping', DAY, words)
    expect(view?.rows).toEqual([{ id: 'shipping', name: 'Shipping', type: 'Domain', filedIn: 'shipping', managers: ['pe-noor'], mayStop: false }])
    expect(view?.through).toBe(1)
    expect(view?.owner).toEqual({ role: 'Lead', unit: 'Shipping', people: ['pe-noor'] })
    // A team serving another domain is offered, and said why it cannot take a second.
    expect(view?.choices).toEqual([{ id: 'robotics', label: 'Robotics', group: 'Team', note: 'a Team serves one domain', disabled: true }])
  })

  it('says the owner is vacant, that no unit serves it, or nothing where there is no rule', () => {
    const vacant = indexScopes([{ path: '', model: root() }, { path: 'shipping', model: { ...shipping, assignments: [] } }])
    expect(servedByOf(vacant, 'shipping', DAY, words)?.owner).toEqual({ role: 'Lead', unit: 'Shipping', people: [] })
    expect(servedByOf(vacant, 'customer', DAY, words)?.owner).toEqual({ role: 'Lead', people: [] })
    const noRule = indexScopes([{ path: '', model: root({ operatingRules: [] }) }, { path: 'shipping', model: shipping }])
    expect(servedByOf(noRule, 'shipping', DAY, words)?.owner).toBeUndefined()
  })

  it('has nothing to say where the organisation has no unit types and no units', () => {
    expect(servedByOf(indexScopes([{ path: '', model: root({ unitTypes: [] }) }]), '', DAY, words)).toBeUndefined()
  })
})
