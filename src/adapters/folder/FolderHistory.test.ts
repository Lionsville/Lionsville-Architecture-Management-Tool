// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { inBudget, TEXT_BUDGET } from './FolderHistory'

describe('texts asked for within a byte budget', () => {
  it('asks in order, a batch at most the budget, one larger than it alone, one of no known size counted as nothing', () => {
    const sizes = { a: 4, b: 4, c: 3, d: 11, e: 1 }
    expect(inBudget(['a', 'b', 'c', 'd', 'e', 'missing'], sizes, 10)).toEqual([['a', 'b'], ['c'], ['d'], ['e', 'missing']])
    expect(inBudget([], sizes, 10)).toEqual([])
    expect(inBudget(['a', 'b'], sizes)).toEqual([['a', 'b']])
    expect(TEXT_BUDGET).toBe(32 * 1024 * 1024)
  })
})
