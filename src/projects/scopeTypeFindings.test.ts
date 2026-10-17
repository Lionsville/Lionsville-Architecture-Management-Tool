// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's type against the units that serve it (ADR-0036, amended 17
 * October 2026), as the checks say it: typed unlike its serving units, typed
 * and unserved, typed by a unit type the operating model no longer holds.
 *
 * Acme Logistics, fictional: Shipping is served by a domain unit of its own
 * and says it is a Team; Parcels says Team and nobody serves it; Returns says
 * a type the model does not hold; Warehouse is a Domain served by one.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import type { DesignElement } from '../model'
import type { UnitType } from '../model/operatingModel'
import { findingSentence, organisationFindings } from './checks'
import { indexScopes } from './scopeIndex'
import type { ScopeModel } from './scope'

const DAY = '2026-10-17'
const s = translator('en')

const types: UnitType[] = [
  { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [] },
  { id: 'ut-team', name: 'Team', within: ['ut-domain'], slots: [] },
]
const unit = (id: string, name: string, unitTypeId: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, unitTypeId, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})

function tree(): ScopeModel[] {
  return [
    { path: '', model: { elements: [], relations: [], unitTypes: types, roles: [] } },
    { path: 'shipping', unitTypeId: 'ut-team', model: { elements: [unit('shipping', 'Shipping', 'ut-domain')], relations: [] } },
    { path: 'parcels', unitTypeId: 'ut-team', model: { elements: [], relations: [] } },
    { path: 'returns', unitTypeId: 'ut-gone', model: { elements: [unit('returns', 'Returns', 'ut-team')], relations: [] } },
    { path: 'warehouse', unitTypeId: 'ut-domain', model: { elements: [unit('warehouse', 'Warehouse', 'ut-domain')], relations: [] } },
    { path: 'plain', model: { elements: [unit('plain', 'Plain', 'ut-domain')], relations: [] } },
  ]
}

const name = (path: string) => ({ shipping: 'Shipping', parcels: 'Parcels', returns: 'Returns' }[path] ?? path)

describe('a scope\'s type against the units that serve it', () => {
  it('finds the three, each about the scope, and nothing where the type agrees or is unsaid', () => {
    const index = indexScopes(tree())
    expect(index.scopeTypes()).toEqual(new Map([['shipping', 'ut-team'], ['parcels', 'ut-team'], ['returns', 'ut-gone'], ['warehouse', 'ut-domain']]))
    const found = organisationFindings(index, DAY).filter((one) => one.key.startsWith('check.scopeType'))
    expect(found).toEqual([
      { key: 'check.scopeTypeUnserved', scope: 'parcels', id: 'parcels', scopes: ['parcels'], detail: 'Team', name: 'Team', fields: ['ut-team'] },
      { key: 'check.scopeTypeGone', scope: 'returns', id: 'returns', scopes: ['returns'], detail: 'ut-gone', name: 'ut-gone', fields: ['ut-gone'] },
      { key: 'check.scopeTypeDisagrees', scope: 'shipping', id: 'shipping', scopes: ['shipping'], detail: 'Team', name: 'Domain', fields: ['ut-team', 'shipping'] },
    ])
    expect(found.map((one) => findingSentence(one, s, name))).toEqual([
      'Parcels says it is a Team, and no unit serves it yet',
      'Returns says it is a unit type the operating model does not hold (ut-gone)',
      'Shipping says it is a Team, and the units that serve it are of another type: Domain',
    ])
  })

  it('says nothing where no store read the headers', () => {
    const index = indexScopes(tree().map(({ path, model }) => ({ path, model })))
    expect(index.scopeTypes().size).toBe(0)
    expect(organisationFindings(index, DAY).filter((one) => one.key.startsWith('check.scopeType'))).toEqual([])
  })
})
