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
const open: LandscapeView = { services: true, foldHosting: false, folded: new Set() }

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
    // Two consumers: the portal says so, and WMS is hosted under the landing zone that realises it (ADR-0017).
    expect(cloud).toMatchObject({ summary: 'An account with a landing zone.', shared: true, consumers: 2, realisedBy: ['landing-zone', 'aws'] })
    expect(landscape().counts).toEqual({ applications: 3, services: 5, shared: 0, platforms: 7 })
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
    expect(edges.filter((edge) => edge.kind === 'uses' && !edge.implied).map((edge) => `${edge.from}>${edge.to}`)).toEqual([
      'application:portal>service:cloud', 'application:portal>service:postgres',
      'application:wms>service:containers', 'application:wms>service:postgres', 'application:wms>service:brokering',
    ])
    expect(edges.filter((edge) => edge.kind === 'realises')).toHaveLength(6)
    expect(edges.find((edge) => edge.kind === 'binds')).toMatchObject({ from: 'application:rater', to: 'platform:kafka' })
    // Hosting is a line at rest (ADR-0020); the leverage only with the band hidden.
    expect(edges.filter((edge) => edge.kind === 'hostedOn').map((edge) => `${edge.from}>${edge.to}`)).toEqual(['application:wms>platform:ns'])
    expect(edges.some((edge) => edge.kind === 'leverages')).toBe(false)
  })

  it('draws the leverage straight to the platforms with the band hidden, narrowed by where the application runs', () => {
    const edges = landscapeEdges(landscape(), { ...open, services: false })
    const wms = edges.filter((edge) => edge.from === 'application:wms').map((edge) => [edge.to, edge.kind, edge.via])
    expect(wms).toEqual([
      ['platform:openshift', 'leverages', ['containers']],
      ['platform:az-postgres', 'leverages', ['postgres']],
      ['platform:kafka', 'leverages', ['brokering']],
      ['platform:ns', 'hostedOn', undefined],
    ])
    // Nothing says where the portal runs, so both deliveries are drawn.
    const portal = edges.filter((edge) => edge.from === 'application:portal').map((edge) => edge.to)
    expect(portal).toEqual(['platform:landing-zone', 'platform:aws', 'platform:az-postgres', 'platform:rds'])
    expect(edges.some((edge) => edge.kind === 'uses' || edge.kind === 'realises')).toBe(false)
  })

  it('merges a folded group\'s lines into one per target with the count', () => {
    const edges = landscapeEdges(landscape(), { services: true, foldHosting: false, folded: new Set(['logistics']) })
    expect(edges.filter((edge) => edge.from === 'group:logistics').map((edge) => [edge.to, edge.kind, edge.count])).toEqual([
      ['platform:kafka', 'binds', 1],
      ['service:containers', 'uses', 1], ['service:postgres', 'uses', 1], ['service:brokering', 'uses', 1],
      ['service:cloud', 'uses', 1],
      ['platform:ns', 'hostedOn', 1],
    ])
    const both = landscapeEdges(
      technologyLandscape({ elements, relations }, diagram, { elsewhere: [...elsewhere, row('l8', 'uses', 'rater', 'postgres')], describe: describe_ }),
      { services: true, foldHosting: false, folded: new Set(['logistics']) },
    )
    expect(both.find((edge) => edge.from === 'group:logistics' && edge.to === 'service:postgres')!.count).toBe(2)
  })
})

describe('what a card touches', () => {
  it('lights an application\'s services and the platforms behind them', () => {
    expect([...touchedBy(landscape(), nodeKey.application('wms'), open)].sort()).toEqual([
      'application:wms', 'platform:aws', 'platform:az-postgres', 'platform:kafka', 'platform:landing-zone', 'platform:ns', 'platform:openshift', 'platform:rds',
      'service:brokering', 'service:cloud', 'service:containers', 'service:postgres',
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

describe('what hosting implies (ADR-0017)', () => {
  it('counts a hosted application as a consumer of what its platform realises, and draws the use as implied', () => {
    // WMS API is hosted in the namespace under OpenShift under the landing
    // zone; the zone realises the cloud environment WMS never said it uses.
    const wms = applicationList(landscape()).find((app) => app.id === 'wms')!
    expect(wms.implied).toEqual(['cloud'])
    expect(landscape().services[0].consumers).toBe(2)
    const edge = landscapeEdges(landscape(), open).find((one) => one.from === 'application:wms' && one.to === 'service:cloud')
    expect(edge).toMatchObject({ kind: 'uses', implied: true })
    // With the band hidden nothing is drawn for it: the hosting is the line.
    expect(landscapeEdges(landscape(), { ...open, services: false }).some((one) => one.implied)).toBe(false)
  })
})

describe('hosting at rest, and folding it (ADR-0020)', () => {
  // A scope with places and no offerings: the only sentence its applications
  // have is where they run.
  const bare = () => technologyLandscape(
    {
      elements: [
        element('sheets', { name: 'Spreadsheets' }),
        element('portal', { name: 'Order portal' }),
        element('o365', { kind: 'platform', name: 'Office 365', platformArchetype: 'place', outside: true }),
        element('k8s', { kind: 'platform', name: 'Cluster', platformArchetype: 'place' }),
        element('bus', { kind: 'platform', name: 'Event bus' }),
      ],
      relations: [
        row('h1', 'hostedOn', 'sheets', 'o365'),
        row('h2', 'hostedOn', 'portal', 'k8s'),
        row('u1', 'uses', 'portal', 'k8s'),
        row('u2', 'uses', 'portal', 'bus'),
      ],
    },
    diagram,
  )

  it('draws the hosting of an application that says nothing else, at the default view', () => {
    const edges = landscapeEdges(bare(), open).filter((edge) => edge.from === 'application:sheets')
    expect(edges.map((edge) => [edge.to, edge.kind])).toEqual([['platform:o365', 'hostedOn']])
    // Folding has nothing to fold it into.
    expect(landscapeEdges(bare(), { ...open, foldHosting: true }).some((edge) => edge.from === 'application:sheets')).toBe(true)
  })

  it('folds a hosting line into a use that already reaches the same platform, and keeps the use', () => {
    const at = (view: LandscapeView) => landscapeEdges(bare(), view).filter((edge) => edge.from === 'application:portal').map((edge) => `${edge.kind}>${edge.to}`)
    expect(at(open)).toEqual(['binds>platform:k8s', 'binds>platform:bus', 'hostedOn>platform:k8s'])
    expect(at({ ...open, foldHosting: true })).toEqual(['binds>platform:k8s', 'binds>platform:bus'])
    // And through a service: WMS is hosted in the namespace, which nothing
    // it uses reaches, so that line stays folded or not; the landing zone
    // its implied use reaches is not where it is hosted.
    const wms = landscapeEdges(landscape(), { ...open, foldHosting: true }).filter((edge) => edge.from === 'application:wms' && edge.kind === 'hostedOn')
    expect(wms.map((edge) => edge.to)).toEqual(['platform:ns'])
  })

  it('lights the platform behind an application that is only hosted', () => {
    expect([...touchedBy(bare(), nodeKey.application('sheets'), open)].sort()).toEqual(['application:sheets', 'platform:o365'])
    expect([...touchedBy(bare(), nodeKey.platform('o365'), open)].sort()).toEqual(['application:sheets', 'platform:o365'])
  })
})

describe('shared offerings from elsewhere (ADR-0020)', () => {
  const shared = [
    { id: 'ent-bus', name: 'Enterprise integration bus', where: 'platforms', realisedBy: ['asb'] },
    { id: 'managed-db', name: 'Managed database', where: 'platforms', realisedBy: [] },
  ]
  const own = () => technologyLandscape(
    {
      elements: [
        element('billing', { name: 'Billing' }),
        element('k8s', { kind: 'platform', name: 'Cluster', platformArchetype: 'place' }),
        // A stand-in this scope already keeps of one of them.
        element('managed-db', { kind: 'platformService', name: 'Managed database', ref: 'platforms', lifecycle: 'retiring' }),
      ],
      relations: [row('u1', 'uses', 'billing', 'ent-bus'), row('u2', 'uses', 'billing', 'managed-db')],
    },
    diagram,
    { sharedElsewhere: shared },
  )

  it('lists them after this scope\'s own services, with the scope that answers and the stand-in marked', () => {
    const page = own()
    expect(page.counts).toEqual({ applications: 1, services: 0, shared: 2, platforms: 1 })
    expect(page.services.map((one) => [one.id, one.where, one.shared, one.standIn, one.consumers, one.realisedBy, one.lifecycle])).toEqual([
      ['ent-bus', 'platforms', true, undefined, 1, ['asb'], 'live'],
      ['managed-db', 'platforms', true, true, 1, [], 'retiring'],
    ])
    expect(serviceList(page).map(({ node }) => node.id)).toEqual(['ent-bus', 'managed-db'])
  })

  it('draws a use of one as a line like any other', () => {
    const edges = landscapeEdges(own(), open).filter((edge) => edge.from === 'application:billing')
    expect(edges.map((edge) => `${edge.kind}>${edge.to}`)).toEqual(['uses>service:ent-bus', 'uses>service:managed-db'])
    expect(applicationList(own())[0]).toMatchObject({ uses: ['ent-bus', 'managed-db'] })
    expect([...touchedBy(own(), nodeKey.service('ent-bus'), open)].sort()).toEqual(['application:billing', 'service:ent-bus'])
  })
})
