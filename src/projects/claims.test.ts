// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../model'
import { claimable, takenUpBelow, takenUpBy, takenUpIds } from './claims'
import { indexScopes } from './scopeIndex'

const fn = (id: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'function', name: id[0].toUpperCase() + id.slice(1), lifecycle: 'live', isManaged: true, aspects: {}, ...over,
})
const standIn = (id: string, ref: string, over: Partial<DesignElement> = {}) =>
  ({ ...fn(id, over), ref, isManaged: false })

/**
 * The organisation defines two areas and a capability under one; retail took
 * billing up and filed its own work under it; wholesale defines an area of its
 * own; a landscape below retail draws the organisation's CRM, which is no claim.
 */
const index = () => indexScopes([
  { path: '', model: { elements: [fn('billing'), fn('invoicing', { parentId: 'billing' }), fn('fulfilment')], relations: [] } },
  { path: 'retail', model: { elements: [standIn('billing', ''), fn('shop-billing', { parentId: 'billing' })], relations: [] } },
  { path: 'retail/shops', model: { elements: [standIn('invoicing', ''), { ...standIn('crm', ''), kind: 'application' }], relations: [] } },
  { path: 'wholesale', model: { elements: [fn('trade')], relations: [] } },
])

describe('takenUpBelow', () => {
  it('answers every function a scope below holds a stand-in of, with who holds it', () => {
    expect([...takenUpBelow(index(), '')]).toEqual([['billing', ['retail']], ['invoicing', ['retail/shops']]])
    expect([...takenUpBelow(index(), 'retail')]).toEqual([['invoicing', ['retail/shops']]])
    expect([...takenUpBelow(index(), 'wholesale')]).toEqual([])
  })

  it('is the same answer, and the same set of ids, for the same index and scope', () => {
    const held = index()
    expect(takenUpBelow(held, '')).toBe(takenUpBelow(held, ''))
    expect(takenUpIds(takenUpBelow(held, ''))).toBe(takenUpIds(takenUpBelow(held, '')))
    expect([...takenUpIds(takenUpBelow(held, ''))]).toEqual(['billing', 'invoicing'])
  })
})

describe('takenUpBy', () => {
  it('names the scopes below the one that defines it', () => {
    expect(takenUpBy(index(), 'billing')).toEqual(['retail'])
    expect(takenUpBy(index(), 'fulfilment')).toEqual([])
    expect(takenUpBy(index(), 'nobody')).toEqual([])
  })
})

describe('claimable', () => {
  it('offers the functions of every scope above that this one does not hold, each with what it sits in', () => {
    const shops = claimable(index(), 'retail/shops', { elements: [standIn('invoicing', '')] })
    expect(shops.map(({ entry, within }) => [entry.master, entry.id, within])).toEqual([
      ['', 'billing', []],
      ['', 'fulfilment', []],
      ['retail', 'shop-billing', ['Billing']],
    ])
  })

  it('offers nothing beside, below or here, and nothing to the organisation', () => {
    expect(claimable(index(), 'wholesale', { elements: [fn('trade')] }).map(({ entry }) => entry.id)).toEqual(['billing', 'fulfilment', 'invoicing'])
    expect(claimable(index(), '', { elements: [] })).toEqual([])
  })
})
