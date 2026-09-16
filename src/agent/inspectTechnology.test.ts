/**
 * What an agent is told about a technology landscape (ADR-0015): the bands
 * and the lines, over the scope's own rows, bounded.
 */
import { describe, expect, it } from 'vitest'
import { inspectTechnology } from './inspectTechnology'
import { fromArrays } from '../model/normalised'
import { element } from '../model/testFixtures'
import type { DesignDiagram, Relation } from '../model/types'

const row = (id: string, type: Relation['type'], sourceId: string, targetId: string): Relation => ({ id, type, sourceId, targetId })
const VIEW: DesignDiagram = { id: 'tl', kind: 'technology', name: 'Technology landscape', members: [], geometry: { nodes: [] } }

const model = fromArrays({
  name: 'Landscape',
  diagrams: [VIEW],
  elements: [
    element('wms', { name: 'WMS' }),
    element('wms-api', { kind: 'component', parentId: 'wms', name: 'WMS API' }),
    element('containers', { kind: 'platformService', name: 'Container platform', shared: true }),
    element('data', { kind: 'platformService', name: 'Data services' }),
    element('postgres', { kind: 'platformService', name: 'Managed database', parentId: 'data' }),
    element('landing-zone', { kind: 'platform', name: 'Landing zone', platformArchetype: 'place', outside: true }),
    element('openshift', { kind: 'platform', name: 'OpenShift', platformArchetype: 'place', parentId: 'landing-zone' }),
  ],
  relations: [
    row('r1', 'realises', 'openshift', 'containers'),
    row('u1', 'uses', 'wms', 'containers'),
    row('u2', 'uses', 'wms-api', 'postgres'),
    row('h1', 'hostedOn', 'wms-api', 'openshift'),
  ],
})

describe('the report', () => {
  it('says the bands with their nesting, and every line as a row', () => {
    const report = inspectTechnology(model, model.diagrams['tl']!)
    expect(report.kind).toBe('technology')
    expect(report.groups.some).toEqual([{
      scope: undefined,
      applications: [{ id: 'wms', name: 'WMS', known: true, uses: ['containers', 'postgres'], binds: [], hostedOn: ['openshift'] }],
    }])
    expect(report.services.some.map((one) => [one.id, one.depth, one.shared, one.consumers])).toEqual([
      ['containers', 0, true, 1], ['data', 0, false, 0], ['postgres', 1, false, 1],
    ])
    expect(report.platforms.some.map((one) => [one.id, one.depth, one.outside, one.applications])).toEqual([
      ['landing-zone', 0, true, 0], ['openshift', 1, false, 1],
    ])
    expect(report.edges.some.map((one) => `${one.kind} ${one.from} ${one.to}`)).toEqual([
      'uses application:wms service:containers',
      'uses application:wms service:postgres',
      'hostedOn application:wms platform:openshift',
      'realises service:containers platform:openshift',
    ])
  })

  it('is bounded, with the totals whole', () => {
    const report = inspectTechnology(model, model.diagrams['tl']!, 1)
    expect(report.services).toMatchObject({ total: 3 })
    expect(report.services.some).toHaveLength(1)
    expect(report.edges).toMatchObject({ total: 4 })
    expect(report.edges.some).toHaveLength(1)
  })
})
