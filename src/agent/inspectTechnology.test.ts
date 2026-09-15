/**
 * The technology view's report, as an agent reads it (ADR-0013).
 *
 * The arithmetic is `model/technologyDiagram.test.ts`'s; what is pinned here
 * is the shape an agent is promised, and that the cap cuts the list and not
 * the total.
 */
import { describe, expect, it } from 'vitest'
import { inspectTechnology } from './inspectTechnology'
import { fromArrays } from '../model/normalised'
import { connection, element } from '../model/testFixtures'
import type { DesignDiagram, Relation } from '../model/types'

const VIEW: DesignDiagram = {
  id: 'tv-1', kind: 'technology', name: 'ESB · technology', platformId: 'esb', members: [], geometry: { nodes: [] },
}

const model = () => fromArrays({
  name: 'Landscape',
  diagrams: [VIEW],
  elements: [
    element('esb', { kind: 'platform', name: 'ESB', platformCategory: 'integration' }),
    element('cluster', { kind: 'platform', name: 'Cluster', platformCategory: 'runtime' }),
    element('orders'), element('billing'), element('wms'),
  ],
  relations: [
    connection('c1', 'orders', 'billing', { via: ['esb'], label: 'invoices', protocol: 'SOAP' }),
    connection('c2', 'wms', 'orders', { via: ['esb'], isBidirectional: true }),
    connection('c3', 'wms', 'billing'),
    { id: 'h1', type: 'hostedOn', sourceId: 'esb', targetId: 'cluster' } as Relation,
    { id: 'u1', type: 'uses', sourceId: 'wms', targetId: 'esb' } as Relation,
  ],
})

describe('inspectTechnology', () => {
  it('reports the platform, what stands on it, and every flow through it with both ends', () => {
    const held = model()
    const report = inspectTechnology(held, held.diagrams['tv-1'])
    expect(report).toMatchObject({
      diagramId: 'tv-1', kind: 'technology',
      platform: { id: 'esb', name: 'ESB', platformCategory: 'integration' },
      standsOn: [{ id: 'cluster', name: 'Cluster', known: true }],
      users: [{ id: 'wms', known: true }],
      hosted: [],
      counts: { hosted: 0, users: 1, flows: 2 },
    })
    expect(report.flows.some).toEqual([
      { id: 'c1', source: { id: 'orders', name: 'App orders', known: true }, target: { id: 'billing', name: 'App billing', known: true }, label: 'invoices', protocol: 'SOAP', via: ['esb'], at: 0, transport: 'mediated' },
      { id: 'c2', source: { id: 'wms', name: 'App wms', known: true }, target: { id: 'orders', name: 'App orders', known: true }, isBidirectional: true, via: ['esb'], at: 0, transport: 'mediated' },
    ])
  })

  it('caps the flows and keeps the total whole', () => {
    const held = model()
    const report = inspectTechnology(held, held.diagrams['tv-1'], 1)
    expect(report.flows.some).toHaveLength(1)
    expect(report.flows.total).toBe(2)
  })

  it('answers honestly for a view about a platform this scope does not hold', () => {
    const held = fromArrays({ name: 'Landscape', diagrams: [VIEW], elements: [element('orders')], relations: [] })
    const report = inspectTechnology(held, held.diagrams['tv-1'])
    expect(report.platform).toBeUndefined()
    expect(report.flows).toEqual({ total: 0, some: [] })
  })
})
