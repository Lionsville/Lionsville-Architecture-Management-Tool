import { describe, expect, it } from 'vitest'
import { rootsOfKind, seedSheet } from './sheetDiagram'
import { actor, area, capability, grouping, journey, phase } from './testFixtures'

const scope = () => [
  journey('ship', 'Ship a consignment'),
  phase('order', 'Order', 'ship'),
  area('fulfilment', 'Fulfilment', { order: 2 }),
  area('billing', 'Billing', { order: 1 }),
  grouping('warehousing', 'Warehousing', 'fulfilment'),
  capability('picking', 'Picking', 'warehousing'),
  actor('customer', 'Customer'),
]

describe('rootsOfKind', () => {
  it('answers one tree’s roots, in drawing order', () => {
    expect(rootsOfKind(scope(), 'function').map((e) => e.id)).toEqual(['billing', 'fulfilment'])
    expect(rootsOfKind(scope(), 'step').map((e) => e.id)).toEqual(['ship'])
  })

  it('leaves what sits under something else out of it', () => {
    expect(rootsOfKind(scope(), 'function').map((e) => e.id)).not.toContain('warehousing')
  })
})

describe('seedSheet', () => {
  it('picks up the journey and the areas the scope already has', () => {
    expect(seedSheet(scope(), { id: 'sh-1', name: 'Business architecture' })).toMatchObject({
      id: 'sh-1',
      kind: 'sheet',
      name: 'Business architecture',
      journeyId: 'ship',
      areas: ['billing', 'fulfilment'],
    })
  })

  it('has no geometry and nothing on it', () => {
    // A sheet is laid out (ADR-0012 §6): a coordinate on one would be a number
    // nothing reads, and a member row a second place to keep what the tree says.
    const sheet = seedSheet(scope(), { id: 'sh-1', name: 'Business architecture' })
    expect(sheet.members).toEqual([])
    expect(sheet.geometry).toEqual({ nodes: [] })
  })

  it('takes no journey when there are two, rather than guessing which', () => {
    const two = [...scope(), journey('return', 'Return a consignment')]
    expect(seedSheet(two, { id: 'sh-1', name: 'Sheet' }).journeyId).toBeUndefined()
  })

  it('is an empty sheet on a scope with no business layer yet', () => {
    const sheet = seedSheet([], { id: 'sh-1', name: 'Sheet' })
    expect(sheet).toMatchObject({ kind: 'sheet', members: [] })
    expect(sheet.journeyId).toBeUndefined()
    expect(sheet.areas).toBeUndefined()
  })
})
