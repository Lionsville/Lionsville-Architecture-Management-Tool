// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { readPlace, writePlace } from '../../agent/place'
import { comparisonIn, comparisonLook } from './comparisonPlace'

describe('a comparison in the address', () => {
  it('is read back as the scope it was written for, the organisation and a path with slashes in it', () => {
    for (const scope of ['', 'acme/rail', 'a&b=c']) expect(comparisonIn(comparisonLook(scope))).toBe(scope)
  })

  it('is no comparison where the look says none', () => {
    expect(comparisonIn(undefined)).toBeUndefined()
    expect(comparisonIn('unit=warehouse')).toBeUndefined()
  })

  it('goes through a place\'s address and back whole', () => {
    const place = { scope: '', page: 'blocks' as const, id: 'blk-gw', tab: 'used', look: comparisonLook('acme/rail') }
    const read = readPlace(writePlace(place))
    expect(read).toEqual(place)
    expect(comparisonIn(read?.look)).toBe('acme/rail')
  })
})
