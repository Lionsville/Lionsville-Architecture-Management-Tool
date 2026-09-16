/**
 * The technology landscape (ADR-0015): the three bands, the lines the page
 * would draw for how it is shown, and what one card touches.
 *
 * Over the platform scope's own model plus the rows the landscapes wrote —
 * the shape the view is made in — so the applications arrive through
 * `elsewhere` and are named through `describe`, as on the real tree.
 */
import { describe, expect, it } from 'vitest'
import { element } from './testFixtures'
import {
  FOLD_ABOVE, applicationList, landscapeEdges, nodeKey, platformList, serviceList, startsFolded,
  technologyLandscape, touchedBy,
} from './technologyLandscape'
import type { LandscapeView } from './technologyLandscape'
import type { PlatformDescribe } from './platformReport'
import type { DesignElement, Relation } from './types'

const row = (id: string, type: Relation['type'], sourceId: string, targetId: string): Relation =>
  ({ id, type, sourceId, targetId })

// The platform scope: offerings, and the tree that delivers them.
const elements: DesignElement[] = [
  element('cloud', { kind: 'platformService', name: 'Cloud environment', description: 'An account with a landing zone.\n\nMore.', shared: true }),
  element('containers', { kind: 'platformService', name: 'Container platform', shared: true }),
  element('data', { kind: 'platformService', name: 'Data services' }),
  element('postgres', { kind: 'platformService', name: 'Managed database', parentId: 'data', shared: true }),
  element('brokering', { kind: 'platformService', name: 'Message brokering' }),
  element('landing-zone', { kind: 'platform', name: 'Azure landing zone', platformArchetype: 'place', outside: true }),
  element('openshift', { kind: 'platform', name: 'OpenShift', platformArchetype: 'place', parentId: 'landing-zone' }),
  element('ns', { kind: 'platform', name: 'Logistics namespace', platformArchetype: 'place', parentId: 'openshift' }),
  element('az-postgres', { kind: 'platform', name: 'Azure Postgres', parentId: 'landing-zone' }),
  element('aws', { kind: 'platform', name: 'AWS account', platformArchetype: 'place', outside: true }),
  element('rds', { kind: 'platform', name: 'RDS', parentId: 'aws' }),
  element('kafka', { kind: 'platform', name: 'Event broker' }),
]
const relations: Relation[] = [
  row('r1', 'realises', 'landing-zone', 'cloud'),
  row('r2', 'realises', 'aws', 'cloud'),
  row('r3', 'realises', 'openshift', 'containers'),
  row('r4', 'realises', 'az-postgres', 'postgres'),
  row('r5', 'realises', 'rds', 'postgres'),
  row('r6', 'realises', 'kafka', 'brokering'),
]
// The landscape's rows: what its applications use, and where their containers run.
const elsewhere: Relation[] = [
  row('l1', 'uses', 'wms', 'containers'),
  row('l2', 'uses', 'wms-api', 'postgres'),
  row('l3', 'hostedOn', 'wms-api', 'ns'),
  row('l4', 'uses', 'portal', 'cloud'),
  row('l5', 'uses', 'portal', 'postgres'),
  row('l6', 'uses', 'rater', 'kafka'),
  row('l7', 'uses', 'wms', 'brokering'),
  // A row this scope also holds, once each.
  row('r1', 'realises', 'landing-zone', 'cloud'),
]
const describe_: PlatformDescribe = (id) => ({
  wms: { name: 'Warehouse Management', kind: 'application' as const, where: 'logistics' },
  'wms-api': { name: 'WMS API', kind: 'component' as const, parentId: 'wms', where: 'logistics' },
  portal: { name: 'Customer portal', kind: 'application' as const, where: 'channels' },
  rater: { name: 'Rating (legacy)', kind: 'application' as const, where: 'logistics' },
}[id])
const diagram = { id: 'tl-1', name: 'Technology landscape' }
const landscape = () => technologyLandscape({ elements, relations }, diagram, { elsewhere, describe: describe_ })
const open: LandscapeView = { services: true, hosting: false, folded: new Set() }

describe('the three bands', () => {
  it('finds every application the rows name, named off the index and grouped by the scope that answers for it', () => {
    const groups = landscape().groups.map((group) => [group.label, group.applications.map((app) => app.name)])
    expect(groups).toEqual([
      ['channels', ['Customer portal']],
      ['logistics', ['Rating (legacy)', 'Warehouse Management']],
    ])
    const wms = applicationList(landscape()).find((app) => app.id === 'wms')!
    // A container's row counts for its application, and its hosting with it.
    expect(wms).toMatchObject({ known: true, uses: ['containers', 'postgres', 'brokering'], binds: [], hostedOn: ['ns'] })
    expect(applicationList(landscape()).find((app) => app.id === 'rater')).toMatchObject({ uses: [], binds: ['kafka'] })
  })

  it('puts this scope\'s own applications first, and an unknown consumer in by its id', () => {
    const own = technologyLandscape(
      { elements: [...elements, element('ops', { name: 'Ops console' })], relations: [...relations, row('x1', 'uses', 'ghost', 'kafka')] },
      diagram,
      { describe: describe_ },
    )
    expect(own.groups.map((group) => [group.key, group.applications.map((app) => app.id)])).toEqual([
      ['', ['ghost', 'ops']],
    ])
    expect(own.groups[0].applications[0]).toMatchObject({ id: 'ghost', name: 'ghost', known: false })
  })

  it('nests the services by parent, with the first line of the description and the counts', () => {
    const services = serviceList(landscape()).map(({ node, depth }) => [node.id, depth])
    expect(services).toEqual([['cloud', 0], ['containers', 0], ['data', 0], ['postgres', 1], ['brokering', 0]])
    const cloud = landscape().services[0]
    expect(cloud).toMatchObject({ summary: 'An account with a landing zone.', shared: true, consumers: 1, realisedBy: ['landing-zone', 'aws'] })
    expect(landscape().counts).toEqual({ applications: 3, services: 5, platforms: 7 })
  })

  it('nests the platforms where the tree nests, and counts what stands on each', () => {
    const platforms = platformList(landscape()).map(({ node, depth }) => [node.id, depth])
    expect(platforms).toEqual([
      ['landing-zone', 0], ['openshift', 1], ['ns', 2], ['az-postgres', 1], ['aws', 0], ['rds', 1], ['kafka', 0],
    ])
    const byId = new Map(platformList(landscape()).map(({ node }) => [node.id, node]))
    expect(byId.get('landing-zone')).toMatchObject({ outside: true, archetype: 'place', realises: ['cloud'] })
    // Every realiser counts where the chain says nothing; the one under the same root where it does.
    expect(byId.get('aws')!.applications).toBe(1)
    expect(byId.get('az-postgres')!.applications).toBe(2)
    expect(byId.get('rds')!.applications).toBe(1)
    expect(byId.get('ns')!.applications).toBe(1)
    expect(byId.get('kafka')!.applications).toBe(2)
  })

  it('is told the tree by the host where a stand-in carries no parent', () => {
    const told = technologyLandscape(
      { elements: elements.map((one) => (one.id === 'ns' ? { ...one, parentId: undefined } : one)), relations },
      diagram,
      { tree: { parentOf: (id) => (id === 'ns' ? 'openshift' : undefined) } },
    )
    expect(platformList(told).find(({ node }) => node.id === 'ns')!.depth).toBe(2)
  })
})

describe('the lines', () => {
  it('draws uses and realises with the service band open, once each', () => {
    const edges = landscapeEdges(landscape(), open)
    expect(edges.filter((edge) => edge.kind === 'uses').map((edge) => `${edge.from}>${edge.to}`)).toEqual([
      'application:portal>service:cloud', 'application:portal>service:postgres',
      'application:wms>service:containers', 'application:wms>service:postgres', 'application:wms>service:brokering',
    ])
    expect(edges.filter((edge) => edge.kind === 'realises')).toHaveLength(6)
    expect(edges.find((edge) => edge.kind === 'binds')).toMatchObject({ from: 'application:rater', to: 'platform:kafka' })
    expect(edges.some((edge) => edge.kind === 'leverages' || edge.kind === 'hostedOn')).toBe(false)
  })

  it('draws the leverage straight to the platforms with the band hidden, narrowed by where the application runs', () => {
    const edges = landscapeEdges(landscape(), { ...open, services: false })
    const wms = edges.filter((edge) => edge.from === 'application:wms').map((edge) => [edge.to, edge.kind, edge.via])
    expect(wms).toEqual([
      ['platform:openshift', 'leverages', ['containers']],
      ['platform:az-postgres', 'leverages', ['postgres']],
      ['platform:kafka', 'leverages', ['brokering']],
    ])
    // Nothing says where the portal runs, so both deliveries are drawn.
    const portal = edges.filter((edge) => edge.from === 'application:portal').map((edge) => edge.to)
    expect(portal).toEqual(['platform:landing-zone', 'platform:aws', 'platform:az-postgres', 'platform:rds'])
    expect(edges.some((edge) => edge.kind === 'uses' || edge.kind === 'realises')).toBe(false)
  })

  it('merges a folded group\'s lines into one per target with the count, and draws hosting when asked', () => {
    const edges = landscapeEdges(landscape(), { services: true, hosting: true, folded: new Set(['logistics']) })
    expect(edges.filter((edge) => edge.from === 'group:logistics').map((edge) => [edge.to, edge.kind, edge.count])).toEqual([
      ['platform:kafka', 'binds', 1],
      ['service:containers', 'uses', 1], ['service:postgres', 'uses', 1], ['service:brokering', 'uses', 1],
      ['platform:ns', 'hostedOn', 1],
    ])
    const both = landscapeEdges(
      technologyLandscape({ elements, relations }, diagram, { elsewhere: [...elsewhere, row('l8', 'uses', 'rater', 'postgres')], describe: describe_ }),
      { services: true, hosting: false, folded: new Set(['logistics']) },
    )
    expect(both.find((edge) => edge.from === 'group:logistics' && edge.to === 'service:postgres')!.count).toBe(2)
  })
})

describe('what a card touches', () => {
  it('lights an application\'s services and the platforms behind them', () => {
    expect([...touchedBy(landscape(), nodeKey.application('wms'), open)].sort()).toEqual([
      'application:wms', 'platform:az-postgres', 'platform:kafka', 'platform:openshift', 'platform:rds',
      'service:brokering', 'service:containers', 'service:postgres',
    ])
  })

  it('lights a service\'s consumers and realisers, and a platform\'s consumers through its services', () => {
    expect([...touchedBy(landscape(), nodeKey.service('postgres'), open)].sort()).toEqual([
      'application:portal', 'application:wms', 'platform:az-postgres', 'platform:rds', 'service:postgres',
    ])
    expect([...touchedBy(landscape(), nodeKey.platform('kafka'), open)].sort()).toEqual([
      'application:rater', 'application:wms', 'platform:kafka', 'service:brokering',
    ])
  })

  it('folds above the threshold and not at it', () => {
    expect(startsFolded(FOLD_ABOVE)).toBe(false)
    expect(startsFolded(FOLD_ABOVE + 1)).toBe(true)
  })
})
