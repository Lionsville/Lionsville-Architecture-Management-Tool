/**
 * The technology view's report, as an agent reads it (ADR-0013).
 *
 * The arithmetic is `model/technologyDiagram.test.ts`'s; what is pinned here
 * is the shape an agent is promised.
 */
import { describe, expect, it } from 'vitest'
import { inspectTechnology } from './inspectTechnology'
import { fromArrays } from '../model/normalised'
import { element } from '../model/testFixtures'
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
    { id: 'h1', type: 'hostedOn', sourceId: 'esb', targetId: 'cluster' } as Relation,
    { id: 'u1', type: 'uses', sourceId: 'wms', targetId: 'esb' } as Relation,
    { id: 'h2', type: 'hostedOn', sourceId: 'orders', targetId: 'esb' } as Relation,
  ],
})

describe('inspectTechnology', () => {
  it('reports the platform, what stands on it, what uses it and what it stands on', () => {
    const held = model()
    const report = inspectTechnology(held, held.diagrams['tv-1'])
    expect(report).toMatchObject({
      diagramId: 'tv-1', kind: 'technology',
      platform: { id: 'esb', name: 'ESB', platformCategory: 'integration' },
      standsOn: [{ id: 'cluster', name: 'Cluster', known: true }],
      users: [{ id: 'wms', known: true }],
      hosted: [{ id: 'orders', known: true }],
      counts: { hosted: 1, users: 1 },
    })
  })

  it('answers honestly for a view about a platform this scope does not hold', () => {
    const held = fromArrays({ name: 'Landscape', diagrams: [VIEW], elements: [element('orders')], relations: [] })
    const report = inspectTechnology(held, held.diagrams['tv-1'])
    expect(report.platform).toBeUndefined()
    expect(report.hosted).toEqual([])
    expect(report.counts).toEqual({ hosted: 0, users: 0 })
  })
})
