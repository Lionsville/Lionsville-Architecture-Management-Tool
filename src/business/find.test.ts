// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { drawnOnSheet, findOnSheet } from './find'
import { sheetPage } from './sheet'
import { shippingScope } from './testFixtures'
import type { DesignDiagram, DesignModel } from '../model'

const SHEET: DesignDiagram = {
  id: 'sh-1', kind: 'sheet', name: 'Business architecture',
  journeyId: 'ship', lanes: ['key-account', 'partner'], areas: ['fulfilment', 'billing'],
  members: [], geometry: { nodes: [] },
}

function page(over: Partial<DesignDiagram> = {}) {
  const { elements, relations } = shippingScope()
  const model: DesignModel = { name: 'Acme Logistics', diagrams: [SHEET], elements, relations }
  return sheetPage(model, { ...SHEET, ...over })
}

describe('what can be found on the sheet', () => {
  it('walks the page in reading order: rail, journey, areas, unmapped', () => {
    const ids = drawnOnSheet(page({ areas: ['fulfilment'] })).map((hit) => hit.element.id)
    const at = (id: string) => ids.indexOf(id)
    expect(at('warehouse-team')).toBeGreaterThanOrEqual(0)
    expect(at('warehouse-team')).toBeLessThan(at('order'))
    expect(at('order')).toBeLessThan(at('take-order'))
    expect(at('take-order')).toBeLessThan(at('fulfilment'))
    expect(at('fulfilment')).toBeLessThan(at('warehousing'))
    expect(at('warehousing')).toBeLessThan(at('picking'))
    expect(at('picking')).toBeLessThan(at('billing'))
    expect(drawnOnSheet(page({ areas: ['fulfilment'] })).at(-1)?.band).toBe('unmapped')
  })

  it('says what a hit sits in — the phase for a step, the grouping for a capability', () => {
    const hits = drawnOnSheet(page())
    expect(hits.find((hit) => hit.element.id === 'negotiate')?.within).toBe('Quote')
    expect(hits.find((hit) => hit.element.id === 'dunning')?.within).toBe('Invoicing')
    expect(hits.find((hit) => hit.element.id === 'warehousing')?.within).toBe('Fulfilment')
  })

  it('offers only what the page draws: an area the sheet leaves out is not a hit', () => {
    const ids = drawnOnSheet(page({ areas: ['fulfilment'] })).map((hit) => hit.element.id)
    expect(ids).toContain('picking')
    expect(ids).not.toContain('invoice')
    // …though its root is, in the unmapped band, which is where the page draws it.
    expect(ids).toContain('billing')
  })

  it('leaves the rail out when the sheet does not draw it', () => {
    const bands = drawnOnSheet(page({ showActors: false })).map((hit) => hit.band)
    expect(bands).not.toContain('actor')
  })
})

describe('finding by name', () => {
  it('folds case and accents, and every word must occur', () => {
    expect(findOnSheet(page(), 'RATE').map((hit) => hit.element.id)).toEqual(['standard-rate', 'negotiate'])
    expect(findOnSheet(page(), 'négotiate rate').map((hit) => hit.element.id)).toEqual(['negotiate'])
    expect(findOnSheet(page(), 'rate delivery')).toEqual([])
  })

  it('answers with everything for a blank query, so the list is the page', () => {
    expect(findOnSheet(page(), '  ')).toEqual(drawnOnSheet(page()))
  })
})
