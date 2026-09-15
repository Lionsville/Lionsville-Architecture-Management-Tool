/**
 * What a technology view holds (ADR-0013).
 *
 * The page is derived from the rows that name one platform, and the two
 * things worth pinning are the ones a reader would otherwise have to trust:
 * that a flow through the bus appears once, split at the bus, and that a row
 * written in another scope or ending on a thing nobody defines still lands
 * on the page rather than being dropped.
 */
import { describe, expect, it } from 'vitest'
import { findTechnologyDiagram, seedTechnologyDiagram, technologyPage } from './technologyDiagram'
import { connection, element } from './testFixtures'
import type { DesignDiagram, DesignElement, Relation } from './types'

const platform = (id: string, over: Partial<DesignElement> = {}): DesignElement =>
  element(id, { kind: 'platform', name: id.toUpperCase(), isManaged: true, ...over })

const row = (id: string, type: Relation['type'], sourceId: string, targetId: string): Relation =>
  ({ id, type, sourceId, targetId })

const elements = [
  platform('esb', { platformCategory: 'integration' }),
  platform('kafka', { platformCategory: 'messaging' }),
  platform('cluster', { platformCategory: 'runtime' }),
  platform('ns-orders', { parentId: 'cluster' }),
  element('orders'), element('billing'), element('wms'), element('portal'),
]
const relations: Relation[] = [
  connection('c1', 'orders', 'billing', { via: ['esb'], protocol: 'SOAP' }),
  connection('c2', 'wms', 'orders', { via: ['esb', 'kafka'] }),
  connection('c3', 'portal', 'orders'),
  connection('c4', 'billing', 'wms', { via: ['esb'], isBidirectional: true }),
  row('h1', 'hostedOn', 'orders', 'cluster'),
  row('h2', 'hostedOn', 'billing', 'cluster'),
  row('u1', 'uses', 'orders', 'kafka'),
  row('u2', 'uses', 'esb', 'cluster'),
  row('h3', 'hostedOn', 'esb', 'cluster'),
]
const view = (platformId: string, over: Partial<DesignDiagram> = {}): DesignDiagram =>
  ({ id: 'tv', kind: 'technology', name: 'ESB', platformId, members: [], geometry: { nodes: [] }, ...over })

describe('the page of a platform', () => {
  it('lists every flow that passes through it once, split at the platform, by source then target', () => {
    const page = technologyPage({ elements, relations }, view('esb'))!
    expect(page.flows.map((f) => [f.source.id, f.target.id, f.at])).toEqual([
      ['billing', 'wms', 0],
      ['orders', 'billing', 0],
      ['wms', 'orders', 0],
    ])
    // The whole path is there, so the page can say what comes after the bus.
    expect(page.flows[2].path.map((p) => p.id)).toEqual(['esb', 'kafka'])
    expect(page.flows.map((f) => f.transport)).toEqual(['mediated', 'mediated', 'evented'])
    expect(page.counts.flows).toBe(3)
  })

  it('leaves a point-to-point flow off every platform', () => {
    for (const id of ['esb', 'kafka', 'cluster']) {
      expect(technologyPage({ elements, relations }, view(id))!.flows.map((f) => f.relation.id)).not.toContain('c3')
    }
  })

  it('says what runs on it, what uses it, what it stands on, and what is under it', () => {
    const cluster = technologyPage({ elements, relations }, view('cluster'))!
    expect(cluster.hosted.map((e) => e.id)).toEqual(['billing', 'orders', 'esb'])
    expect(cluster.users.map((e) => e.id)).toEqual(['esb'])
    expect(cluster.children.map((e) => e.id)).toEqual(['ns-orders'])
    expect(cluster.platform.platformCategory).toBe('runtime')
    const esb = technologyPage({ elements, relations }, view('esb'))!
    expect(esb.standsOn.map((e) => e.id)).toEqual(['cluster'])
    expect(esb.hosted).toEqual([])
  })

  it('is a page about nothing when the platform is not held here', () => {
    expect(technologyPage({ elements, relations }, view('elsewhere'))).toBeUndefined()
    expect(technologyPage({ elements, relations }, { platformId: undefined })).toBeUndefined()
  })
})

describe('rows from the rest of the tree', () => {
  it('draws a row another scope wrote, named by the index, and never twice', () => {
    const elsewhere: Relation[] = [
      connection('x1', 'crm', 'orders', { via: ['esb'] }),
      row('x2', 'hostedOn', 'crm', 'cluster'),
      // The same row this scope also holds: once.
      connection('c1', 'orders', 'billing', { via: ['esb'] }),
    ]
    const describe = (id: string) => (id === 'crm' ? { name: 'CRM', kind: 'application' as const, where: 'sales' } : undefined)
    const page = technologyPage({ elements, relations }, view('esb'), { elsewhere, describe })!
    expect(page.flows.map((f) => f.relation.id)).toEqual(['c4', 'c1', 'c2', 'x1'])
    const crm = page.flows.find((f) => f.relation.id === 'x1')!.source
    expect(crm).toEqual({ id: 'crm', name: 'CRM', kind: 'application', known: true, where: 'sales' })
    const cluster = technologyPage({ elements, relations }, view('cluster'), { elsewhere, describe })!
    expect(cluster.hosted.map((e) => e.id)).toEqual(['billing', 'orders', 'crm', 'esb'])
  })

  it('keeps a dangling end as an end, said by its id and marked unknown', () => {
    const page = technologyPage(
      { elements, relations: [connection('d1', 'ghost', 'orders', { via: ['esb'] })] },
      view('esb'),
    )!
    expect(page.flows[0].source).toEqual({ id: 'ghost', name: 'ghost', known: false })
  })

  it('reads a platform it cannot see through the index, so the pattern is right', () => {
    const page = technologyPage(
      { elements, relations: [connection('d1', 'orders', 'billing', { via: ['esb', 'mq'] })] },
      view('esb'),
      { describe: (id) => (id === 'mq' ? { name: 'MQ', kind: 'platform', platformCategory: 'messaging' } : undefined) },
    )!
    expect(page.flows[0].transport).toBe('evented')
    expect(page.flows[0].path.map((p) => p.name)).toEqual(['ESB', 'MQ'])
  })
})

describe('the day the view shows', () => {
  it('counts a windowed flow only on a day it holds, and drops the rows of a thing that is gone', () => {
    const dated: Relation[] = [
      connection('w1', 'orders', 'billing', { via: ['esb'], validFrom: '2027-03-01' }),
      row('h1', 'hostedOn', 'wms', 'cluster'),
    ]
    const withGone = elements.map((e) => (e.id === 'wms' ? { ...e, lifecycleDates: { retired: '2027-01-01' } } : e))
    const before = technologyPage({ elements: withGone, relations: dated }, view('esb'), { today: '2027-02-01' })!
    expect(before.flows).toEqual([])
    const after = technologyPage({ elements: withGone, relations: dated }, view('esb'), { today: '2027-03-01' })!
    expect(after.flows.map((f) => f.relation.id)).toEqual(['w1'])
    const cluster = technologyPage({ elements: withGone, relations: dated }, view('cluster'), { today: '2027-03-01' })!
    expect(cluster.hosted).toEqual([])
    // With no day, every row counts — what a view with nothing dated should do.
    expect(technologyPage({ elements: withGone, relations: dated }, view('cluster'))!.hosted.map((e) => e.id)).toEqual(['wms'])
  })

  it('prefers the view\'s own day over today', () => {
    const dated = [connection('w1', 'orders', 'billing', { via: ['esb'], validUntil: '2027-01-31' })]
    const page = technologyPage({ elements, relations: dated }, view('esb', { asOf: '2027-01-15' }), { today: '2027-06-01' })!
    expect(page.flows.map((f) => f.relation.id)).toEqual(['w1'])
  })
})

describe('making one', () => {
  it('seeds a view about a platform and nothing else, laid out, with no members', () => {
    const seeded = seedTechnologyDiagram({ elements }, 'esb', { id: 'tv-1', name: (name) => `${name} · technology` })!
    expect(seeded).toEqual({
      id: 'tv-1', kind: 'technology', name: 'ESB · technology', platformId: 'esb', members: [], geometry: { nodes: [] },
    })
    expect(seedTechnologyDiagram({ elements }, 'orders', { id: 'tv-2', name: (n) => n })).toBeUndefined()
    expect(seedTechnologyDiagram({ elements }, 'nowhere', { id: 'tv-2', name: (n) => n })).toBeUndefined()
  })

  it('finds the one already about a platform', () => {
    const diagrams = [view('esb'), { ...view('kafka'), id: 'tv-k' }]
    expect(findTechnologyDiagram({ diagrams }, 'kafka')?.id).toBe('tv-k')
    expect(findTechnologyDiagram({ diagrams }, 'cluster')).toBeUndefined()
  })
})
