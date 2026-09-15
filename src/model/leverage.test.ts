/**
 * What an application leverages (ADR-0014): the services it uses, itself or
 * through its containers, and the platforms behind each — derived, never
 * stored, over this scope's rows and the tree's.
 */
import { describe, expect, it } from 'vitest'
import { consumersOf, describeLeverage, leverageOf, platformsBehind, platformsBoundTo, servicesOf } from './leverage'
import { element } from './testFixtures'
import type { DesignElement, Relation } from './types'

const component = (id: string, parentId: string): DesignElement =>
  element(id, { kind: 'component', parentId, name: id })
const row = (id: string, type: Relation['type'], sourceId: string, targetId: string): Relation =>
  ({ id, type, sourceId, targetId })

const elements = [
  element('wms', { name: 'WMS' }), element('portal', { name: 'Portal' }),
  component('wms-api', 'wms'), component('wms-events', 'wms'),
  element('containers', { kind: 'platformService', name: 'Container platform' }),
  element('brokering', { kind: 'platformService', name: 'Message brokering' }),
  element('openshift', { kind: 'platform', name: 'OpenShift', platformArchetype: 'place' }),
  element('kafka', { kind: 'platform', name: 'Event broker' }),
  element('legacy-bus', { kind: 'platform', name: 'Legacy bus' }),
]
const relations = [
  row('u1', 'uses', 'wms', 'containers'),
  row('u2', 'uses', 'wms-events', 'brokering'),
  row('u3', 'uses', 'wms-api', 'containers'),
  row('u4', 'uses', 'portal', 'legacy-bus'),
  row('u5', 'uses', 'portal', 'containers'),
  row('r1', 'realises', 'openshift', 'containers'),
  row('r2', 'realises', 'kafka', 'brokering'),
  row('h1', 'hostedOn', 'wms-api', 'openshift'),
]
const model = { elements, relations }

describe('what an application leverages', () => {
  it('names the services it uses, itself or through its containers, once each and in row order', () => {
    expect(servicesOf(model, 'wms')).toEqual(['containers', 'brokering'])
    // A container answers with its own rows.
    expect(servicesOf(model, 'wms-events')).toEqual(['brokering'])
  })

  it('keeps a platform bound to directly beside the services, never among them', () => {
    expect(servicesOf(model, 'portal')).toEqual(['containers'])
    expect(platformsBoundTo(model, 'portal')).toEqual(['legacy-bus'])
    expect(platformsBoundTo(model, 'wms')).toEqual([])
  })

  it('reads the platforms behind a service off what realises it, and puts them on the line', () => {
    expect(platformsBehind(model, 'containers')).toEqual(['openshift'])
    expect(leverageOf(model, 'wms')).toEqual({
      services: [
        { id: 'containers', platformIds: ['openshift'] },
        { id: 'brokering', platformIds: ['kafka'] },
      ],
      platformIds: [],
    })
  })

  it('takes the rows the rest of the tree wrote, and never a row twice', () => {
    // The landscape holds the consumer's row; the platform scope holds what
    // realises the service — and an overview that holds both sees each once.
    const landscape = { elements, relations: relations.filter((r) => r.type === 'uses') }
    const elsewhere = [...relations.filter((r) => r.type === 'realises'), row('u1', 'uses', 'wms', 'containers')]
    expect(leverageOf(landscape, 'wms').services.map((one) => one.platformIds)).toEqual([[], []])
    expect(leverageOf(landscape, 'wms', { elsewhere }).services.map((one) => one.platformIds)).toEqual([['openshift'], ['kafka']])
    expect(servicesOf(landscape, 'wms', { elsewhere })).toEqual(['containers', 'brokering'])
  })

  it('says it by name, and by id where nothing here names it', () => {
    const nameOf = (id: string) => elements.find((e) => e.id === id)?.name
    expect(describeLeverage(leverageOf(model, 'wms'), nameOf)).toEqual({
      services: [
        { id: 'containers', name: 'Container platform', platforms: [{ id: 'openshift', name: 'OpenShift' }] },
        { id: 'brokering', name: 'Message brokering', platforms: [{ id: 'kafka', name: 'Event broker' }] },
      ],
      platforms: [],
    })
    expect(describeLeverage({ services: [{ id: 'ghost', platformIds: [] }], platformIds: [] }, nameOf).services[0].name).toBe('ghost')
  })
})

describe('who consumes a service', () => {
  it('names the applications, a container by its application, once each', () => {
    expect(consumersOf(model, 'containers')).toEqual(['wms', 'portal'])
    expect(consumersOf(model, 'brokering')).toEqual(['wms'])
  })

  it('names a consumer another scope holds as the row names it', () => {
    const elsewhere = [row('x1', 'uses', 'crm', 'containers')]
    expect(consumersOf(model, 'containers', { elsewhere })).toEqual(['wms', 'portal', 'crm'])
  })
})
