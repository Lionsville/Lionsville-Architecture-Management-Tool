// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { showOnDoor } from './pageLanding'

describe('a door that shows something on a view of a kind', () => {
  const door = () => undefined
  it('is offered while the scope has a view of that kind', () => {
    expect(showOnDoor('technology', [{ id: 'l7', kind: 'layer7' }, { id: 'tl', kind: 'technology' }], door)).toBe(door)
  })
  it('is not offered once that view is gone, whatever else the scope holds', () => {
    expect(showOnDoor('technology', [{ id: 'l7', kind: 'layer7' }], door)).toBeUndefined()
    expect(showOnDoor('technology', [], door)).toBeUndefined()
  })
  it('is not offered where the host has no door', () => {
    expect(showOnDoor('technology', [{ id: 'tl', kind: 'technology' }], undefined)).toBeUndefined()
  })
})
