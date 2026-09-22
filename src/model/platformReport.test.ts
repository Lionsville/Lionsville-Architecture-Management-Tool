// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a platform's report holds (ADR-0013, redone).
 *
 * Derived from the rows that name one platform, and the things worth pinning
 * are the ones a reader would otherwise have to trust: that a row written in
 * another scope lands on it, that the same row held from both sides appears
 * once, that a container is named beside the application it belongs to, and
 * that the interfaces crossing it come with the application interface they are
 * part of — which is what makes a retirement legible.
 */
import { describe, expect, it } from 'vitest'
import { platformReport } from './platformReport'
import { element } from './testFixtures'
import type { DesignElement, Relation } from './types'

const platform = (id: string, over: Partial<DesignElement> = {}): DesignElement =>
  element(id, { kind: 'platform', name: id.toUpperCase(), isManaged: true, ...over })
const container = (id: string, parentId: string): DesignElement =>
  element(id, { kind: 'component', parentId, name: id })

const row = (id: string, type: Relation['type'], sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation =>
  ({ id, type, sourceId, targetId, ...over })
const flow = (id: string, sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation =>
  ({ id, type: 'flow', sourceId, targetId, ...over })

const elements = [
  platform('esb'),
  platform('kafka'),
  platform('cluster', { platformArchetype: 'place' }),
  platform('ns-orders', { parentId: 'cluster' }),
  element('orders', { name: 'Order management' }), element('billing', { name: 'Billing' }),
  element('wms', { name: 'WMS' }), element('portal', { name: 'Portal' }),
  container('orders-api', 'orders'), container('billing-ledger', 'billing'),
]
const relations: Relation[] = [
  row('h1', 'hostedOn', 'orders-api', 'cluster'),
  row('h2', 'hostedOn', 'portal', 'cluster'),
  row('u1', 'uses', 'orders', 'kafka'),
  row('u2', 'uses', 'billing', 'cluster'),
]

describe('the report on a platform', () => {
  it('says what runs on it, what uses it, what it stands on, and what is under it', () => {
    const cluster = platformReport({ elements, relations }, 'cluster')!
    expect(cluster.hosted.map((e) => e.id)).toEqual(['orders-api', 'portal'])
    expect(cluster.users.map((e) => e.id)).toEqual(['billing'])
    expect(cluster.children.map((e) => e.id)).toEqual(['ns-orders'])
    expect(cluster.platform.platformArchetype).toBe('place')
    // The chain above it, nearest first: `parentId` is the one containment.
    const ns = platformReport({ elements, relations }, 'ns-orders')!
    expect(ns.standsOn.map((e) => e.id)).toEqual(['cluster'])
    expect(ns.hosted).toEqual([])
    // Unsaid is a service (ADR-0014).
    expect(platformReport({ elements, relations }, 'esb')!.platform.platformArchetype).toBe('service')
  })

  /**
   * The tree is walked (ADR-0014 §2.7): a cluster's report is about the
   * cluster and its namespaces, each row naming the descendant it sits on —
   * because "retire the cluster" is a question about all of it.
   */
  it('gathers what is hosted on, uses and crosses anything filed under it, naming the place', () => {
    const under: Relation[] = [
      ...relations,
      row('h4', 'hostedOn', 'billing-ledger', 'ns-orders'),
      row('u3', 'uses', 'wms', 'ns-orders'),
      flow('r9', 'billing-ledger', 'orders-api', { protocol: 'REST' }),
    ]
    const cluster = platformReport({ elements, relations: under }, 'cluster')!
    expect(cluster.hosted.map((e) => [e.id, e.place?.id])).toEqual([['billing-ledger', 'ns-orders'], ['orders-api', undefined], ['portal', undefined]])
    expect(cluster.users.map((e) => [e.id, e.place?.name])).toEqual([['billing', undefined], ['wms', 'NS-ORDERS']])
    expect(cluster.landings.map((one) => [one.relation.id, one.on.id, one.on.place?.id])).toEqual([['r9', 'billing-ledger', 'ns-orders']])
    // The namespace's own report is only about the namespace.
    expect(platformReport({ elements, relations: under }, 'ns-orders')!.hosted.map((e) => e.id)).toEqual(['billing-ledger'])
  })

  it('walks the tree the index holds, where this scope holds a stand-in that carries no parent', () => {
    const standIn = elements.map((e) => (e.id === 'ns-orders' ? { ...e, ref: 'platforms', parentId: undefined } : e))
    const under = [...relations, row('h4', 'hostedOn', 'billing-ledger', 'ns-orders')]
    expect(platformReport({ elements: standIn, relations: under }, 'cluster')!.hosted.map((e) => e.id)).toEqual(['orders-api', 'portal'])
    const describe = (id: string) => (id === 'ns-orders' ? { name: 'Orders namespace', kind: 'platform' as const, parentId: 'cluster' } : undefined)
    const told = platformReport({ elements: standIn, relations: under }, 'cluster', { describe })!
    expect(told.hosted.map((e) => [e.id, e.place?.name])).toEqual([['billing-ledger', 'Orders namespace'], ['orders-api', undefined], ['portal', undefined]])
    expect(told.children.map((e) => e.id)).toEqual(['ns-orders'])
    expect(platformReport({ elements: standIn, relations: under }, 'ns-orders', { describe })!.standsOn.map((e) => e.id)).toEqual(['cluster'])
  })

  it('takes what the platform is from the tree, where this scope holds only a stand-in', () => {
    // A stand-in carries nothing the owner answers for, so the record here
    // says nothing and the index says what the master does.
    const standIn = elements.map((e) => (e.id === 'cluster' ? { ...e, ref: 'platforms', platformArchetype: undefined } : e))
    const describe = (id: string) => (id === 'cluster' ? { name: 'CLUSTER', kind: 'platform' as const, platformArchetype: 'place' as const } : undefined)
    expect(platformReport({ elements: standIn, relations }, 'cluster')!.platform.platformArchetype).toBe('service')
    expect(platformReport({ elements: standIn, relations }, 'cluster', { describe })!.platform.platformArchetype).toBe('place')
  })

  it('names a container beside the application it belongs to, and leaves an application bare', () => {
    const cluster = platformReport({ elements, relations }, 'cluster')!
    expect(cluster.hosted.find((e) => e.id === 'orders-api')?.application)
      .toEqual({ id: 'orders', name: 'Order management' })
    expect(cluster.hosted.find((e) => e.id === 'portal')?.application).toBeUndefined()
  })

  it('is a report about nothing when the platform is not held here', () => {
    expect(platformReport({ elements, relations }, 'elsewhere')).toBeUndefined()
  })
})

describe('the interfaces that cross it', () => {
  const crossing: Relation[] = [
    ...relations,
    // Two container lines touching a container hosted on the cluster.
    flow('r1', 'billing-ledger', 'orders-api', { refines: 'c16', protocol: 'REST' }),
    flow('r2', 'wms', 'orders-api', { protocol: 'AMQP' }),
    flow('c16', 'billing', 'orders', { label: 'invoices' }),
    // An application line and a container line that touch nothing hosted here.
    flow('c17', 'wms', 'billing'),
    flow('r3', 'billing-ledger', 'wms'),
  ]

  it('lists the container lines landing on what is hosted here, and nothing else', () => {
    const cluster = platformReport({ elements, relations: crossing }, 'cluster')!
    expect(cluster.landings.map((one) => one.relation.id)).toEqual(['r1', 'r2'])
    expect(cluster.counts.landings).toBe(2)
  })

  it('says which container it lands on, and which interface it is part of', () => {
    const cluster = platformReport({ elements, relations: crossing }, 'cluster')!
    const landed = cluster.landings.find((one) => one.relation.id === 'r1')!
    expect(landed.on.id).toBe('orders-api')
    expect(landed.partOf).toEqual({ id: 'c16', label: 'invoices' })
    // One that is part of nothing says so by saying nothing.
    expect(cluster.landings.find((one) => one.relation.id === 'r2')!.partOf).toBeUndefined()
  })
})

describe('rows from the rest of the tree', () => {
  it('draws a row another scope wrote, named by the index, and never twice', () => {
    const elsewhere: Relation[] = [
      row('x2', 'hostedOn', 'crm', 'cluster'),
      // The same row this scope also holds: once.
      row('h2', 'hostedOn', 'portal', 'cluster'),
    ]
    const describe = (id: string) => (id === 'crm' ? { name: 'CRM', kind: 'application' as const, where: 'sales' } : undefined)
    const cluster = platformReport({ elements, relations }, 'cluster', { elsewhere, describe })!
    expect(cluster.hosted.map((e) => e.id)).toEqual(['crm', 'orders-api', 'portal'])
    expect(cluster.hosted.find((e) => e.id === 'crm'))
      .toEqual({ id: 'crm', name: 'CRM', kind: 'application', known: true, where: 'sales' })
  })

  it('keeps a dangling end as an end, said by its id and marked unknown', () => {
    const report = platformReport({ elements, relations: [row('d1', 'hostedOn', 'ghost', 'cluster')] }, 'cluster')!
    expect(report.hosted[0]).toEqual({ id: 'ghost', name: 'ghost', known: false })
  })
})

describe('the day it is read', () => {
  it('counts a windowed row only on a day it holds, and drops the rows of a thing that is gone', () => {
    const dated: Relation[] = [
      row('w1', 'hostedOn', 'portal', 'cluster', { validFrom: '2027-03-01' }),
      row('h9', 'hostedOn', 'wms', 'cluster'),
    ]
    const withGone = elements.map((e) => (e.id === 'wms' ? { ...e, lifecycleDates: { retired: '2027-01-01' } } : e))
    expect(platformReport({ elements: withGone, relations: dated }, 'cluster', { today: '2027-02-01' })!.hosted)
      .toEqual([])
    expect(platformReport({ elements: withGone, relations: dated }, 'cluster', { today: '2027-03-01' })!.hosted
      .map((e) => e.id)).toEqual(['portal'])
    // With no day, every row counts.
    expect(platformReport({ elements: withGone, relations: dated }, 'cluster')!.hosted.map((e) => e.id))
      .toEqual(['portal', 'wms'])
  })
})
