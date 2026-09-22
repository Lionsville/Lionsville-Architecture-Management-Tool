// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { organisationLabel, scopeClient } from './scopeLabel'
import type { ScopeSummary } from './scope'

const at = (path: string, name: string, client?: string): ScopeSummary => ({
  path, name, diagrams: 0, children: [], ...(client ? { client } : {}),
})

const tree = [
  at('', 'Acme Logistics'),
  at('retail', 'Retail'),
  at('retail/warehouse', 'Warehouse landscape'),
]

describe('organisationLabel', () => {
  it('is the root’s name, whatever depth the scope is at', () => {
    expect(organisationLabel('retail/warehouse', tree)).toBe('Acme Logistics')
    expect(organisationLabel('retail', tree)).toBe('Acme Logistics')
  })

  /**
   * A bar reading "Warehouse / Warehouse" says less than "Warehouse" does, and
   * a scope with nothing above it genuinely has no organisation yet.
   */
  it('is never the scope’s own name', () => {
    expect(organisationLabel('', tree)).toBe('')
    expect(organisationLabel('acme', [at('acme', 'Acme')])).toBe('')
  })

  /** A tree somebody has half filled in still says something true. */
  it('falls back to the outermost ancestor that has a name, skipping one somebody cleared', () => {
    const held = [at('retail', 'Retail'), at('retail/warehouse', 'Warehouse')]
    expect(organisationLabel('retail/warehouse', held)).toBe('Retail')
    expect(organisationLabel('retail/warehouse', [at('retail/warehouse', 'Warehouse')])).toBe('')
    const held2 = [at('', '   '), at('acme', 'Acme'), at('acme/rail', 'Rail')]
    expect(organisationLabel('acme/rail', held2)).toBe('Acme')
  })

})

describe('scopeClient', () => {
  it('is the organisation’s name until somebody says otherwise, nearest answer first', () => {
    expect(scopeClient('retail/warehouse', tree)).toBe('Acme Logistics')
    const held = [at('', 'Acme Logistics', 'Acme Logistics BV'), ...tree.slice(1)]
    expect(scopeClient('retail/warehouse', held)).toBe('Acme Logistics BV')
    // The closest record to the drawing is the one that knows.
    const held2 = [
      at('', 'Acme Logistics', 'Acme Logistics BV'),
      at('retail', 'Retail', 'Acme Retail BV'),
      at('retail/warehouse', 'Warehouse landscape'),
    ]
    expect(scopeClient('retail/warehouse', held2)).toBe('Acme Retail BV')
    const held3 = [
      at('', 'Acme Logistics', 'Acme Logistics BV'),
      at('acme', 'Acme', 'Acme Rail BV'),
    ]
    expect(scopeClient('acme', held3)).toBe('Acme Rail BV')
  })

  /** A title block is never blank. */
  it('falls all the way back to the scope’s own name', () => {
    expect(scopeClient('acme', [at('acme', 'Acme')])).toBe('Acme')
    expect(scopeClient('nowhere', [])).toBe('')
  })
})
