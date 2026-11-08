// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { ScopeModel, ScopeSummary } from '../../projects/scope'
import { holdingsOf, nearestWork } from './holdings'

const scope = (path: string, name: string, diagrams: number, children: ScopeSummary[] = []): ScopeSummary => ({ path, name, diagrams, children })

const TREE = scope('', 'Org', 1, [
  scope('road', 'Road', 0, [scope('road/line', 'Line', 2), scope('road/last', 'Last', 0)]),
  scope('sales', 'Sales', 0),
])

const MODELS: ScopeModel[] = [
  { path: 'road/last', model: { elements: [], relations: [], decisionCount: 3 } },
]

describe('holdingsOf', () => {
  it('counts views and records, a scope itself and with all under it', () => {
    const held = holdingsOf(TREE, MODELS)
    expect(held.own('road').views).toBe(0)
    expect(held.count('road')).toBe(5)
    expect(held.count('')).toBe(6)
    expect(held.all('road')).toMatchObject({ views: 2, decisions: 3 })
  })

  it('says on a row the work, not the principles kept beside it, which the breakdown still names', () => {
    const principle = { id: 'p1', number: 1, title: 'P', statement: '', aspects: [], lastAspect: 0, groups: [], regime: 'flexible', status: 'accepted' }
    const held = holdingsOf(TREE, [...MODELS, { path: '', model: { elements: [], relations: [], principles: [principle, { ...principle, id: 'p2' }] } as unknown as ScopeModel['model'] }])
    expect(held.count('')).toBe(8)
    expect(held.work('')).toBe(6)
    expect(held.all('')).toMatchObject({ principles: 2 })
  })

  it('keeps only what holds something, and the path down to it', () => {
    expect([...holdingsOf(TREE, MODELS).withWork].sort()).toEqual(['', 'road', 'road/last', 'road/line'])
  })

  it('counts a scope only its reader sees on its own row and in no scope above it', () => {
    const withOwn = { ...TREE, children: [...TREE.children, { ...scope('mine', 'Mine', 3), personal: true as const }] }
    const held = holdingsOf(withOwn, MODELS)
    expect(held.count('mine')).toBe(3)
    expect(held.count('')).toBe(6)
  })

  it('reads an absent index as the views alone', () => {
    expect(holdingsOf(TREE, []).count('road')).toBe(2)
  })
})

describe('nearestWork', () => {
  const held = holdingsOf(TREE, MODELS)

  it('looks under a scope first, then beside it, then above', () => {
    expect(nearestWork(TREE, 'road', held).map((one) => [one.path, one.stands])).toEqual([['road/line', 'below'], ['road/last', 'below'], ['', 'above']])
    expect(nearestWork(TREE, 'sales', held).map((one) => [one.path, one.stands])).toEqual([['road/line', 'beside'], ['road/last', 'beside'], ['', 'above']])
  })

  it('stops at what it was asked for, and has nothing for a scope that is gone', () => {
    expect(nearestWork(TREE, 'sales', held, 1)).toHaveLength(1)
    expect(nearestWork(TREE, 'gone', held)).toEqual([])
  })
})
