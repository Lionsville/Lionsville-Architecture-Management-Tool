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
  it('falls back to the outermost ancestor that has a name', () => {
    const held = [at('retail', 'Retail'), at('retail/warehouse', 'Warehouse')]
    expect(organisationLabel('retail/warehouse', held)).toBe('Retail')
  })

  it('is nothing when nothing above this scope has been read', () => {
    expect(organisationLabel('retail/warehouse', [at('retail/warehouse', 'Warehouse')])).toBe('')
  })

  it('skips a scope somebody cleared the name of', () => {
    const held = [at('', '   '), at('acme', 'Acme'), at('acme/rail', 'Rail')]
    expect(organisationLabel('acme/rail', held)).toBe('Acme')
  })
})

describe('scopeClient', () => {
  it('is the organisation’s name when nobody has said otherwise', () => {
    expect(scopeClient('retail/warehouse', tree)).toBe('Acme Logistics')
  })

  it('is what the root says once it says something', () => {
    const held = [at('', 'Acme Logistics', 'Acme Logistics BV'), ...tree.slice(1)]
    expect(scopeClient('retail/warehouse', held)).toBe('Acme Logistics BV')
  })

  /** The closest record to the drawing is the one that knows. */
  it('prefers the nearest answer up the chain', () => {
    const held = [
      at('', 'Acme Logistics', 'Acme Logistics BV'),
      at('retail', 'Retail', 'Acme Retail BV'),
      at('retail/warehouse', 'Warehouse landscape'),
    ]
    expect(scopeClient('retail/warehouse', held)).toBe('Acme Retail BV')
  })

  it('takes the scope’s own answer over its parent’s', () => {
    const held = [
      at('', 'Acme Logistics', 'Acme Logistics BV'),
      at('acme', 'Acme', 'Acme Rail BV'),
    ]
    expect(scopeClient('acme', held)).toBe('Acme Rail BV')
  })

  /** A title block is never blank. */
  it('falls all the way back to the scope’s own name', () => {
    expect(scopeClient('acme', [at('acme', 'Acme')])).toBe('Acme')
    expect(scopeClient('nowhere', [])).toBe('')
  })
})
