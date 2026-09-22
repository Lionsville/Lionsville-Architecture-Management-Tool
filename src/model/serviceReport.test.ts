// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a service's report holds (ADR-0014 §2.8): who maintains it, what
 * realises it, who consumes it — by application, with the container said
 * beside it and the scope it came from — and what would be stranded on the
 * day it goes.
 */
import { describe, expect, it } from 'vitest'
import { serviceReport } from './serviceReport'
import { element } from './testFixtures'
import type { DesignElement, Relation } from './types'

const row = (id: string, type: Relation['type'], sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation =>
  ({ id, type, sourceId, targetId, ...over })
const container = (id: string, parentId: string): DesignElement => element(id, { kind: 'component', parentId, name: id })

const elements = [
  element('containers', { kind: 'platformService', name: 'Container platform', shared: true }),
  element('brokering', { kind: 'platformService', name: 'Message brokering', lifecycleDates: { retired: '2027-06-30' } }),
  element('platform-team', { kind: 'actor', name: 'Platform team' }),
  element('openshift', { kind: 'platform', name: 'OpenShift' }),
  element('wms', { name: 'WMS' }), element('billing', { name: 'Billing' }), element('portal', { name: 'Portal' }),
  container('wms-api', 'wms'), container('wms-events', 'wms'),
]
const relations: Relation[] = [
  row('a1', 'assigned', 'platform-team', 'containers'),
  row('r1', 'realises', 'openshift', 'containers'),
  row('u1', 'uses', 'wms-api', 'containers'),
  row('u2', 'uses', 'wms-events', 'containers'),
  row('u3', 'uses', 'billing', 'containers'),
  row('u4', 'uses', 'wms', 'brokering'),
  row('u5', 'uses', 'portal', 'brokering', { validUntil: '2027-03-31' }),
]

describe('the report on a service', () => {
  it('says who maintains it, what realises it, and who consumes it by application, once, with the container beside it', () => {
    const report = serviceReport({ elements, relations }, 'containers')!
    expect(report.service).toMatchObject({ id: 'containers', name: 'Container platform', shared: true })
    expect(report.maintainers.map((e) => e.id)).toEqual(['platform-team'])
    expect(report.realisedBy.map((e) => e.id)).toEqual(['openshift'])
    expect(report.consumers.map((one) => [one.id, one.via?.id])).toEqual([['billing', undefined], ['wms', 'wms-api']])
    expect(report.counts).toEqual({ maintainers: 1, realisedBy: 1, consumers: 2, stranded: 2 })
  })

  it('says a gap as an empty list, and strands every consumer where no day is set', () => {
    const bare = serviceReport({ elements, relations: relations.filter((r) => r.targetId !== 'containers' || r.type === 'uses') }, 'containers')!
    expect(bare.maintainers).toEqual([])
    expect(bare.realisedBy).toEqual([])
    expect(bare.stranded.map((one) => one.id)).toEqual(['billing', 'wms'])
  })

  it('strands only the consumers still on it on the day it goes', () => {
    const report = serviceReport({ elements, relations }, 'brokering')!
    expect(report.service.retiredOn).toBe('2027-06-30')
    expect(report.service.shared).toBe(false)
    // The portal's row closes in March; the WMS is still on it in June.
    expect(report.consumers.map((one) => one.id)).toEqual(['portal', 'wms'])
    expect(report.stranded.map((one) => one.id)).toEqual(['wms'])
  })

  it('reads the rows the rest of the tree wrote, names them off the index, and says which scopes they came from', () => {
    const elsewhere: Relation[] = [row('x1', 'uses', 'crm', 'containers'), row('u3', 'uses', 'billing', 'containers')]
    const describe = (id: string) => (id === 'crm' ? { name: 'CRM', kind: 'application' as const, where: 'sales' } : undefined)
    const report = serviceReport({ elements, relations }, 'containers', { elsewhere, describe })!
    expect(report.consumers.map((one) => [one.id, one.where])).toEqual([['billing', undefined], ['crm', 'sales'], ['wms', undefined]])
    expect(report.scopes).toEqual(['sales'])
    expect(report.consumers.find((one) => one.id === 'crm')).toMatchObject({ known: true, name: 'CRM' })
  })

  it('is a report about nothing when the service is not held here, and drops the rows of a thing gone on the day', () => {
    expect(serviceReport({ elements, relations }, 'elsewhere')).toBeUndefined()
    const gone = elements.map((e) => (e.id === 'billing' ? { ...e, lifecycleDates: { retired: '2027-01-01' } } : e))
    expect(serviceReport({ elements: gone, relations }, 'containers', { today: '2027-02-01' })!.consumers.map((one) => one.id)).toEqual(['wms'])
  })
})
