// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { ScopeIndex } from '../projects/scopeIndex'
import { platformTreeOf } from './platformTree'

describe('platformTreeOf', () => {
  it('answers each question off the index entry, and nothing for an id it does not hold', () => {
    const entries: Record<string, unknown> = {
      ns: { parentId: 'cluster', platformArchetype: 'place', outside: true, retired: '2027-01-01' },
    }
    const tree = platformTreeOf({ lookup: (id) => entries[id] } as Pick<ScopeIndex, 'lookup'>)
    expect(tree.parentOf?.('ns')).toBe('cluster')
    expect(tree.archetypeOf?.('ns')).toBe('place')
    expect(tree.outsideOf?.('ns')).toBe(true)
    expect(tree.retiredOf?.('ns')).toBe('2027-01-01')
    expect(tree.parentOf?.('other')).toBeUndefined()
    expect(tree.retiredOf?.('other')).toBeUndefined()
  })
})
