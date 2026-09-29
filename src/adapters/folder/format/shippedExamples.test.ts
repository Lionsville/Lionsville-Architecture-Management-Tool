// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { EXAMPLE_CATALOGUE } from '../../../app/examples/offers'
import { SHIPPED_EXAMPLES } from './shippedExamples'

describe('the examples that ship', () => {
  it('has one for every entry in the catalogue, and nothing the catalogue does not offer', () => {
    expect(Object.keys(SHIPPED_EXAMPLES).sort()).toEqual(EXAMPLE_CATALOGUE.map((entry) => entry.key).sort())
  })

  it('reads each, when asked, as its scopes filed under the path given, parents first', async () => {
    for (const load of Object.values(SHIPPED_EXAMPLES)) {
      const scopes = await load('somewhere')
      expect(scopes.length).toBeGreaterThan(0)
      expect(scopes[0].path).toBe('somewhere')
      expect(scopes.every((scope) => scope.path === 'somewhere' || scope.path.startsWith('somewhere/'))).toBe(true)
    }
  })
})
