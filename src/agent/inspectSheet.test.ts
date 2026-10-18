// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The sheet's report, as an agent reads it: the grid it can set up with
 * `diagram.update`, and the columns each area takes.
 */
import { describe, expect, it } from 'vitest'
import { inspectSheet } from './inspectSheet'
import { fromArrays } from '../model/normalised'
import { actor, relation, shippingScope } from '../business/testFixtures'
import type { DesignDiagram } from '../model/types'

const SHEET: DesignDiagram = {
  id: 'sh-1', kind: 'sheet', name: 'Business architecture', journeyId: 'ship',
  areas: ['fulfilment', 'billing'], members: [], geometry: { nodes: [] },
}

function report(sheet: DesignDiagram) {
  const { elements, relations } = shippingScope()
  const model = fromArrays({ name: 'Acme', elements, relations, diagrams: [sheet] })
  return inspectSheet(model, model.diagrams[sheet.id])
}

describe('inspectSheet', () => {
  it('says the grid fits the window until the sheet fixes it, and every area is one column', () => {
    const held = report(SHEET)
    expect(held.grid).toEqual({ paper: 'A2', width: 2245, height: 1587, maxSpan: 4 })
    expect(held.areas.some.map((area) => [area.id, area.span])).toEqual([['fulfilment', 1], ['billing', 1]])
  })

  it('reports the columns and the spans the sheet was given', () => {
    const held = report({ ...SHEET, columns: 4, areaSpans: { billing: 2, fulfilment: 9 } })
    expect(held.grid).toEqual({ paper: 'A2', width: 2245, height: 1587, columns: 4, maxSpan: 4 })
    // Clamped to the widest an area may be, the way the page clamps it.
    expect(held.areas.some.map((area) => area.span)).toEqual([4, 2])
  })

  it('reads the rail a person first sees: the parties, the units the sheet uses and why, and how many it leaves out', () => {
    const { elements, relations } = shippingScope()
    const model = fromArrays({
      name: 'Acme',
      elements: [
        ...elements,
        actor('billing-team', 'Billing team', { unitTypeId: 'team' }),
        actor('dispatch', 'Dispatch', { unitTypeId: 'team' }),
      ],
      relations: [...relations, relation('a3', 'assigned', 'billing-team', 'invoice')],
      diagrams: [SHEET],
    })
    const held = inspectSheet(model, model.diagrams[SHEET.id])
    expect(held.actors.unitsNotDrawn).toBe(1)
    expect(held.actors.some.map((row) => [row.id, row.group])).toEqual([
      ['warehouse-team', 'parties'], ['key-account', 'parties'], ['partner', 'parties'], ['billing-team', 'used'],
    ])
    expect(held.actors.some[3]).toMatchObject({ responsibleFor: ['invoice'], lane: false })
    expect(held.actors.some[0].responsibleFor).toBeUndefined()
  })

  it('counts an area as mapped once a scope below took up something under it (ADR-0040 §6)', () => {
    const { elements, relations } = shippingScope()
    const sheet = { ...SHEET, areas: ['fulfilment'] }
    const model = fromArrays({ name: 'Acme', elements, relations, diagrams: [sheet] })
    expect(inspectSheet(model, model.diagrams[sheet.id]).unmapped.some.map((row) => row.id)).toEqual(['billing'])
    expect(inspectSheet(model, model.diagrams[sheet.id], undefined, new Set(['invoice'])).unmapped.total).toBe(0)
  })
})
