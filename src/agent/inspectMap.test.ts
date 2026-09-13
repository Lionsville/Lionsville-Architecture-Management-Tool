/**
 * The map's report, as an agent reads it (ADR-0012 §6, §9).
 *
 * The arithmetic is `business/map.test.ts`'s; what is pinned here is the
 * shape an agent is promised, and that the caps cut the lists and not the
 * totals.
 */
import { describe, expect, it } from 'vitest'
import { inspectMap } from './inspectMap'
import { fromArrays } from '../model/normalised'
import { shippingScope } from '../business/testFixtures'

const MAP = { id: 'mp-1', kind: 'map' as const, name: 'Enterprise map', members: [], geometry: { nodes: [] } }

const model = () => {
  const { elements, relations } = shippingScope()
  return fromArrays({ name: 'Landscape', elements, relations, diagrams: [MAP] })
}

describe('inspectMap', () => {
  it('reports the rows in tree order with what each leans on, and the columns the rows name', () => {
    const report = inspectMap(model(), model().diagrams['mp-1'])
    expect(report).toMatchObject({ diagramId: 'mp-1', kind: 'map', counts: { covered: 2, manual: 1, uncovered: 1 } })
    expect(report.columns.some.map((column) => column.id)).toEqual(['wms', 'scanner', 'erp'])
    expect(report.rows.some.map((row) => row.id)).toEqual([
      'fulfilment', 'warehousing', 'picking', 'packing', 'billing', 'invoicing', 'invoice', 'dunning',
    ])
    expect(report.rows.some.find((row) => row.id === 'invoicing')).toMatchObject({
      leaf: false, supportedBy: ['erp'], coverage: 'covered', gaps: 1,
    })
  })

  it('caps the lists and keeps the totals whole', () => {
    const report = inspectMap(model(), model().diagrams['mp-1'], 2)
    expect(report.rows.some).toHaveLength(2)
    expect(report.rows.total).toBe(8)
    expect(report.columns.some).toHaveLength(2)
    expect(report.columns.total).toBe(3)
  })

  it('counts the rows live on the day it is given, where the map names none', () => {
    const held = model()
    held.relations.s3 = { ...held.relations.s3, validFrom: '2027-03-01' }
    const before = inspectMap(held, held.diagrams['mp-1'], MAP_ROWS, '2027-02-01')
    expect(before.rows.some.find((row) => row.id === 'invoice')?.coverage).toBe('uncovered')
  })
})

const MAP_ROWS = 200
