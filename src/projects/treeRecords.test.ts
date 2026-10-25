// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The tree's 3.8.0 records for a reader with no screen: in force where the
 * page says so — its own, above it, a topic relevant today — and the topics
 * with their links and where they hold.
 */
import { describe, expect, it } from 'vitest'
import type { Principle } from '../model/principle'
import { treeRecords } from './treeRecords'

const principle = (id: string, number: number, over: Partial<Principle> = {}): Principle => ({
  id, number, title: id, statement: `${id} holds.`, aspects: [], lastAspect: 0, groups: [], regime: 'flexible', status: 'accepted', ...over,
})

const kept: Record<string, Principle[]> = {
  '': [principle('pr-org', 1)],
  'topics/security': [principle('pr-sec', 1), principle('pr-old', 2, { mergedInto: 'pr-sec' })],
  retail: [principle('pr-retail', 1)],
}

const index = {
  principleScopes: () => Object.keys(kept),
  principlesAt: (path: string) => ({ principles: kept[path] ?? [], groups: [] }),
  buildingBlocks: () => [],
  evaluations: () => [],
  citations: () => [],
}

const scopes = [
  { path: '', name: 'Acme' }, { path: 'retail', name: 'Retail' }, { path: 'retail/stores', name: 'Stores' }, { path: 'stock', name: 'Stock' },
  { path: 'topics', name: 'Topics' },
  { path: 'topics/security', name: 'Security', relevantTo: [{ path: 'retail', from: '2026-01-01' }, { path: 'stock', from: '2026-01-01', until: '2026-03-01' }] },
]

describe('the tree’s records', () => {
  const records = treeRecords(index, scopes, '2026-10-25')

  it('holds a principle in force where it is kept, below it, and where its topic is relevant today', () => {
    expect(records.inForce('retail/stores').map((one) => [one.principle.id, one.scope, one.via])).toEqual([
      ['pr-retail', 'retail', 'above'], ['pr-org', '', 'above'], ['pr-sec', 'topics/security', 'topic'],
    ])
    // An ended link holds no more, and a merged principle is never in force.
    expect(records.inForce('stock').map((one) => one.principle.id)).toEqual(['pr-org'])
    expect(records.inForce('retail').map((one) => one.via)).toEqual(['here', 'above', 'topic'])
  })

  it('lists the topics with their own links and where they hold today', () => {
    expect(records.topics()).toEqual([{
      path: 'topics/security', name: 'Security',
      links: [{ path: 'retail', from: '2026-01-01' }, { path: 'stock', from: '2026-01-01', until: '2026-03-01' }],
      relevantTo: ['retail'],
    }])
  })
})
