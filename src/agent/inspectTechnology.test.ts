/**
 * What an agent is told about a technology landscape (ADR-0015): the bands
 * and the lines, over the scope's own rows, bounded.
 */
import { describe, expect, it } from 'vitest'
import { inspectTechnology, sharedElsewhereOf } from './inspectTechnology'
import { fromArrays } from '../model/normalised'
import { element } from '../model/testFixtures'
import type { DesignDiagram, Relation } from '../model/types'
import type { TreeTechnologyRow } from './tree'

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
      applications: [{ id: 'wms', name: 'WMS', known: true, uses: ['containers', 'postgres'], implied: [], binds: [], hostedOn: ['openshift'] }],
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

  it('reports the shared row off the tree, with the scope that answers and whether a stand-in is held (ADR-0020)', () => {
    const service = (id: string, name: string, master: string, over: Partial<TreeTechnologyRow> = {}): TreeTechnologyRow => ({
      id, kind: 'platformService', name, master, declarations: [], drawnIn: [], findings: [],
      maintainers: [], consumers: { applications: 0, scopes: 0 }, realisedBy: [], realises: [], hosts: 0, ...over,
    })
    const technology = (): readonly TreeTechnologyRow[] => [
      service('managed-db', 'Managed database', 'platforms', { shared: true, realisedBy: [{ id: 'azure-sql', name: 'Azure SQL' }] }),
      service('own', 'Own offering', 'acme/landscape', { shared: true }),
      service('private', 'Team database', 'warehouse'),
    ]
    const shared = sharedElsewhereOf({ technology }, 'acme/landscape')
    expect(shared).toEqual([{ id: 'managed-db', name: 'Managed database', where: 'platforms', realisedBy: ['azure-sql'] }])
    const report = inspectTechnology(model, model.diagrams['tl']!, undefined, shared)
    expect(report.services.some.at(-1)).toEqual({ id: 'managed-db', name: 'Managed database', depth: 0, shared: true, consumers: 0, realisedBy: ['azure-sql'], where: 'platforms', standIn: false })
    expect(report.services.some.slice(0, -1).every((one) => one.where === undefined)).toBe(true)
    // Hosting is drawn at rest, and not folded (ADR-0020).
    expect(report.edges.some.some((one) => one.kind === 'hostedOn')).toBe(true)
  })

  it('is bounded, with the totals whole', () => {
    const report = inspectTechnology(model, model.diagrams['tl']!, 1)
    expect(report.services).toMatchObject({ total: 3 })
    expect(report.services.some).toHaveLength(1)
    expect(report.edges).toMatchObject({ total: 4 })
    expect(report.edges.some).toHaveLength(1)
  })
})
