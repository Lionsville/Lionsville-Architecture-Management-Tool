// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it, vi } from 'vitest'
import type { TreeView } from '../agent/tree'
import { nearestPlace } from '../agent/place'
import type { HostModel } from '../model/hostModel'
import { asksTheScope, factsOf, landingFor } from './placeLanding'

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

  it('reopens a principle at its address, and the list where it is gone', () => {
    const model = { name: 'Acme', elements: [], relations: [], diagrams: [], principles: [{ id: 'pr-buy', number: 1 }] } as unknown as HostModel
    const facts = { ...factsOf({ model, ancestorDecisions: [] }), scopeIs: () => true }
    expect(nearestPlace({ scope: '', page: 'principles', id: 'pr-buy' }, facts)).toEqual({ scope: '', page: 'principles', id: 'pr-buy' })
    expect(nearestPlace({ scope: '', page: 'principles', id: 'pr-gone' }, facts)).toEqual({ scope: '', page: 'principles' })
  })
})
