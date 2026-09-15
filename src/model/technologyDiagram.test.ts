/**
 * What a technology view holds (ADR-0013).
 *
 * The page is derived from the rows that name one platform, and the things
 * worth pinning are the ones a reader would otherwise have to trust: that a
 * row written in another scope lands on the page rather than being dropped,
 * that the same row held from both sides appears once, and that a row ending
 * on a thing nobody defines is still an end.
 */
import { describe, expect, it } from 'vitest'
import { findTechnologyDiagram, seedTechnologyDiagram, technologyPage } from './technologyDiagram'
import { element } from './testFixtures'
import type { DesignDiagram, DesignElement, Relation } from './types'

const platform = (id: string, over: Partial<DesignElement> = {}): DesignElement =>
  element(id, { kind: 'platform', name: id.toUpperCase(), isManaged: true, ...over })

const row = (id: string, type: Relation['type'], sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation =>
  ({ id, type, sourceId, targetId, ...over })

const elements = [
  platform('esb', { platformCategory: 'integration' }),
  platform('kafka', { platformCategory: 'messaging' }),
  platform('cluster', { platformCategory: 'runtime' }),
  platform('ns-orders', { parentId: 'cluster' }),
  element('orders'), element('billing'), element('wms'), element('portal'),
]
const relations: Relation[] = [
  row('h1', 'hostedOn', 'orders', 'cluster'),
  row('h2', 'hostedOn', 'billing', 'cluster'),
  row('u1', 'uses', 'orders', 'kafka'),
  row('u2', 'uses', 'esb', 'cluster'),
  row('h3', 'hostedOn', 'esb', 'cluster'),
]
const view = (platformId: string, over: Partial<DesignDiagram> = {}): DesignDiagram =>
  ({ id: 'tv', kind: 'technology', name: 'ESB', platformId, members: [], geometry: { nodes: [] }, ...over })

describe('the page of a platform', () => {
  it('says what runs on it, what uses it, what it stands on, and what is under it', () => {
    const cluster = technologyPage({ elements, relations }, view('cluster'))!
    expect(cluster.hosted.map((e) => e.id)).toEqual(['billing', 'orders', 'esb'])
    expect(cluster.users.map((e) => e.id)).toEqual(['esb'])
    expect(cluster.children.map((e) => e.id)).toEqual(['ns-orders'])
    expect(cluster.platform.platformCategory).toBe('runtime')
    expect(cluster.counts).toEqual({ hosted: 3, users: 1 })
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
      row('x2', 'hostedOn', 'crm', 'cluster'),
      // The same row this scope also holds: once.
      row('h1', 'hostedOn', 'orders', 'cluster'),
    ]
    const describe = (id: string) => (id === 'crm' ? { name: 'CRM', kind: 'application' as const, where: 'sales' } : undefined)
    const cluster = technologyPage({ elements, relations }, view('cluster'), { elsewhere, describe })!
    expect(cluster.hosted.map((e) => e.id)).toEqual(['billing', 'orders', 'crm', 'esb'])
    expect(cluster.hosted.find((e) => e.id === 'crm'))
      .toEqual({ id: 'crm', name: 'CRM', kind: 'application', known: true, where: 'sales' })
  })

  it('keeps a dangling end as an end, said by its id and marked unknown', () => {
    const page = technologyPage(
      { elements, relations: [row('d1', 'hostedOn', 'ghost', 'cluster')] },
      view('cluster'),
    )!
    expect(page.hosted[0]).toEqual({ id: 'ghost', name: 'ghost', known: false })
  })
})

describe('the day the view shows', () => {
  it('counts a windowed row only on a day it holds, and drops the rows of a thing that is gone', () => {
    const dated: Relation[] = [
      row('w1', 'hostedOn', 'orders', 'cluster', { validFrom: '2027-03-01' }),
      row('h1', 'hostedOn', 'wms', 'cluster'),
    ]
    const withGone = elements.map((e) => (e.id === 'wms' ? { ...e, lifecycleDates: { retired: '2027-01-01' } } : e))
    const before = technologyPage({ elements: withGone, relations: dated }, view('cluster'), { today: '2027-02-01' })!
    expect(before.hosted).toEqual([])
    const after = technologyPage({ elements: withGone, relations: dated }, view('cluster'), { today: '2027-03-01' })!
    expect(after.hosted.map((e) => e.id)).toEqual(['orders'])
    // With no day, every row counts — what a view with nothing dated should do.
    expect(technologyPage({ elements: withGone, relations: dated }, view('cluster'))!.hosted.map((e) => e.id))
      .toEqual(['orders', 'wms'])
  })

  it('prefers the view\'s own day over today', () => {
    const dated = [row('w1', 'hostedOn', 'orders', 'cluster', { validUntil: '2027-01-31' })]
    const page = technologyPage({ elements, relations: dated }, view('cluster', { asOf: '2027-01-15' }), { today: '2027-06-01' })!
    expect(page.hosted.map((e) => e.id)).toEqual(['orders'])
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
