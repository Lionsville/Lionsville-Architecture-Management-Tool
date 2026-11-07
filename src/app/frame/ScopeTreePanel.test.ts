// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { ScopeSummary } from '../../projects/scope'
import { scopesFound } from './ScopeTreePanel'

const scope = (path: string, name: string, over: Partial<ScopeSummary> = {}): ScopeSummary => ({ path, name, diagrams: 0, children: [], ...over })

const TREE = scope('', 'Org', {
  children: [
    scope('sales', 'Sales'),
    scope('stock', 'Depot stock'),
    scope('topics', 'Topics', { children: [scope('topics/security', 'Security', { relevantTo: [{ path: 'sales' }, { path: 'stock', until: '2020-01-01' }] })] }),
  ],
})

describe('scopesFound', () => {
  it('finds by name, and never the organisation itself', () => {
    expect(scopesFound(TREE, 'depot', '2026-11-07')).toEqual(['stock'])
    expect(scopesFound(TREE, 'org', '2026-11-07')).toEqual([])
  })

  it('finds a scope by a topic relevant to it today, and not by one that has ended', () => {
    expect(scopesFound(TREE, 'security', '2026-11-07')).toEqual(['sales', 'topics/security'])
  })
})
