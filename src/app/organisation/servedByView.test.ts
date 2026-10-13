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
import { pickableBy, servedByOf, servingChoicesOf } from './servedByView'
import { servedByPicked } from './useOrganisation'

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
    expect(servedByOf(indexScopes([{ path: '', model: root({ unitTypes: [] }) }]), 'shipping', DAY, words)).toBeUndefined()
  })

  it('has nothing to say about the organisation itself, which is no domain', () => {
    const kept = indexScopes([{ path: '', model: root({ elements: [unit('operations', 'ut-domain')] }) }, { path: 'shipping', model: shipping }])
    expect(servedByOf(kept, '', DAY, words)).toBeUndefined()
  })

  it('offers a one-domain unit kept at the organisation that says nothing, since it serves nothing yet', () => {
    // The usual organisation: every unit filed at the top, where the operating model lives.
    const kept = indexScopes([
      { path: '', model: root({ elements: [unit('operations', 'ut-domain'), unit('robotics', 'ut-team', { parentId: 'operations' })] }) },
      { path: 'shipping', model: { name: 'Shipping', relations: [], diagrams: [], elements: [] } },
    ])
    const view = servedByOf(kept, 'shipping', DAY, words)
    expect(view?.rows).toEqual([])
    expect(view?.choices.map((one) => [one.id, one.disabled ?? false, one.note])).toEqual([
      ['operations', false, 'filed in the organisation'],
      ['robotics', false, 'filed in the organisation'],
    ])
  })
})

describe('what a new scope may be served by', () => {
  it('is every unit there, nothing serving the scope yet, a one-domain unit serving one shown and said why not', () => {
    const kept = indexScopes([{ path: '', model: root() }, { path: 'shipping', model: shipping }, { path: 'warehouse', model: warehouse }])
    expect(servingChoicesOf(kept, undefined, DAY, words).map((one) => [one.id, one.disabled ?? false])).toEqual([
      ['shipping', true], ['robotics', true], ['tracking', true],
    ])
    expect(servingChoicesOf(indexScopes([{ path: '', model: root() }]), undefined, DAY, words)).toEqual([])
  })

  it('shows a unit kept where the person may only read, and says so', () => {
    const options = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', disabled: true, note: 'why' }, { id: 'c', label: 'C' }]
    expect(pickableBy(options, (id) => id !== 'c', { s })).toEqual([
      { id: 'a', label: 'A' }, { id: 'b', label: 'B', disabled: true, note: 'why' }, { id: 'c', label: 'C', disabled: true, note: 'kept where you may only read' },
    ])
  })

  it('is held by the new-scope dialog alone, and taken back', () => {
    const asked = { kind: 'newScope' as const, parent: '', name: 'Customer', withBoard: false }
    expect(servedByPicked(asked, 'ops')).toEqual({ ...asked, servedBy: 'ops' })
    expect(servedByPicked({ ...asked, servedBy: 'ops' }, undefined)).toEqual(asked)
    expect(servedByPicked({ kind: 'none' }, 'ops')).toEqual({ kind: 'none' })
  })
})
