// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it, vi } from 'vitest'
import type { TreeView } from '../agent/tree'
import { asksTheScope, landingFor } from './placeLanding'

describe('where a place lands', () => {
  it('reads the scope only where a record or a view is named, or a bare scope lands on its first view', () => {
    expect(asksTheScope({ scope: 'a', page: 'observations' })).toBe(false)
    expect(asksTheScope({ scope: 'a', page: 'decisions' })).toBe(false)
    expect(asksTheScope({ scope: 'a', page: 'board' })).toBe(false)
    expect(asksTheScope({ scope: 'a', page: 'register' })).toBe(false)
    expect(asksTheScope({ scope: 'a', page: 'board', id: 'v1' })).toBe(true)
    expect(asksTheScope({ scope: 'a', page: 'decisions', id: 'adr-1' })).toBe(true)
    expect(asksTheScope({ scope: 'a' })).toBe(true)
  })

  it('opens a listed scope\'s page that names nothing without reading the scope', async () => {
    const read = vi.fn()
    const tree = { scopes: () => [{ path: 'a', name: 'A', views: 1 }], read } as unknown as TreeView
    expect(await landingFor({ scope: 'a', page: 'observations' }, tree, () => undefined)).toEqual({ scope: 'a', page: 'observations' })
    expect(read).not.toHaveBeenCalled()
  })
})
