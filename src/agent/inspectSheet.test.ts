/**
 * The sheet's report, as an agent reads it: the grid it can set up with
 * `diagram.update`, and the columns each area takes.
 */
import { describe, expect, it } from 'vitest'
import { inspectSheet } from './inspectSheet'
import { fromArrays } from '../model/normalised'
import { shippingScope } from '../business/testFixtures'
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
    expect(held.grid).toEqual({ maxSpan: 4 })
    expect(held.areas.some.map((area) => [area.id, area.span])).toEqual([['fulfilment', 1], ['billing', 1]])
  })

  it('reports the columns and the spans the sheet was given', () => {
    const held = report({ ...SHEET, columns: 4, areaSpans: { billing: 2, fulfilment: 9 } })
    expect(held.grid).toEqual({ columns: 4, maxSpan: 4 })
    // Clamped to the widest an area may be, the way the page clamps it.
    expect(held.areas.some.map((area) => area.span)).toEqual([4, 2])
  })
})
