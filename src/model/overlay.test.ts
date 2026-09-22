// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the overlay bands say (ADR-0013, redone).
 *
 * Derived on every render, so what matters is the order — the palette slot a
 * band takes must not move because another card was added — and that the two
 * questions really are different: one groups by which platform, the other by
 * how healthy it is.
 */
import { describe, expect, it } from 'vitest'
import { colourByOne, isColourBy, oneColouredBy, overlayBandOf, overlayBands } from './overlay'
import { element } from './testFixtures'
import type { DesignDiagram, DesignElement, Relation } from './types'

const platform = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement =>
  element(id, { kind: 'platform', name, ...over })
const container = (id: string, parentId: string): DesignElement =>
  element(id, { kind: 'component', parentId, name: id })
const host = (id: string, sourceId: string, targetId: string): Relation =>
  ({ id, type: 'hostedOn', sourceId, targetId })

const elements = [
  element('wms', { name: 'WMS' }), element('portal', { name: 'Portal' }),
  element('billing', { name: 'Billing' }), element('partner', { name: 'Partner', outside: true }),
  container('wms-api', 'wms'),
  platform('openshift', 'OpenShift'),
  platform('azure', 'Azure', { lifecycle: 'retiring' }),
]
const relations = [
  host('h1', 'wms-api', 'openshift'),
  host('h2', 'portal', 'openshift'),
  host('h3', 'billing', 'azure'),
]
const board = (kind: DesignDiagram['kind'] = 'layer7'): Pick<DesignDiagram, 'kind' | 'members'> => ({
  kind,
  members: [{ id: 'wms' }, { id: 'portal' }, { id: 'billing' }, { id: 'partner' }, { id: 'openshift' }],
})

describe('colouring by platform', () => {
  it('gives one band per platform, and one for the cards on nothing', () => {
    const bands = overlayBands({ elements, relations }, board(), 'platform')
    expect(bands.map((band) => [band.key, band.name, band.slot])).toEqual([
      ['azure', 'Azure', 0],
      ['openshift', 'OpenShift', 1],
      ['none', undefined, 2],
    ])
  })

  it('puts a card in the band of what its CONTAINERS run on', () => {
    const bands = overlayBandOf(overlayBands({ elements, relations }, board(), 'platform'))
    expect(bands.get('wms')?.key).toBe('openshift')
    expect(bands.get('portal')?.key).toBe('openshift')
    expect(bands.get('partner')?.key).toBe('none')
  })

  it('orders the bands by name, so a card added above nobody changes colour, and keeps "on nothing" last', () => {
    const more = [...elements, element('crm', { name: 'CRM' }), platform('aws', 'AWS')]
    const bands = overlayBands(
      { elements: more, relations: [...relations, host('h4', 'crm', 'aws')] },
      { ...board(), members: [...board().members, { id: 'crm' }] },
      'platform',
    )
    expect(bands.map((band) => band.key)).toEqual(['aws', 'azure', 'openshift', 'none'])
  })

  it('colours nothing that is not an application: a platform chip is not tinted by itself', () => {
    const bands = overlayBandOf(overlayBands({ elements, relations }, board(), 'platform'))
    expect(bands.has('openshift')).toBe(false)
  })
})

describe('colouring by technology lifecycle', () => {
  it('takes the worst phase among the platforms a card stands on', () => {
    const bands = overlayBandOf(overlayBands({ elements, relations }, board(), 'technologyLifecycle'))
    expect(bands.get('billing')?.phase).toBe('retiring')
    expect(bands.get('wms')?.phase).toBe('live')
    expect(bands.get('partner')?.key).toBe('none')
  })

  it('reads the phase on the day the board shows, not the one stored', () => {
    const dated = elements.map((e) => (
      e.id === 'openshift' ? { ...e, lifecycleDates: { retiring: '2027-06-01' } } : e
    ))
    const before = overlayBandOf(overlayBands({ elements: dated, relations }, board(), 'technologyLifecycle', '2027-01-01'))
    expect(before.get('wms')?.phase).toBe('live')
    const after = overlayBandOf(overlayBands({ elements: dated, relations }, board(), 'technologyLifecycle', '2027-09-01'))
    expect(after.get('wms')?.phase).toBe('retiring')
  })

  it('lists the bands worst first', () => {
    const bands = overlayBands({ elements, relations }, board(), 'technologyLifecycle')
    expect(bands.map((band) => band.key)).toEqual(['retiring', 'live', 'none'])
  })
})

describe('when it says nothing at all', () => {
  it('is empty with no overlay chosen, and on a view that is not a landscape', () => {
    expect(overlayBands({ elements, relations }, board(), undefined)).toEqual([])
    expect(overlayBands({ elements, relations }, board('container'), 'platform')).toEqual([])
  })
})

/**
 * Over the platform tree (ADR-0014 §2.7): a card is coloured by the cluster
 * and not the namespace, the account above the cluster is somebody else's,
 * and a namespace inherits the phase of what it sits in.
 */
describe('colouring over the platform tree', () => {
  const tree = [
    ...elements,
    platform('account', 'Cloud account', { outside: true }),
    platform('ns', 'Logistics namespace', { parentId: 'openshift', platformArchetype: 'place' }),
  ].map((e) => (e.id === 'openshift' ? { ...e, parentId: 'account' } : e))
  const rows = [host('h1', 'wms-api', 'ns'), host('h2', 'portal', 'openshift'), host('h3', 'billing', 'azure')]

  it('names the outermost platform the organisation runs, not the namespace and not the account', () => {
    const bands = overlayBands({ elements: tree, relations: rows }, board(), 'platform')
    expect(bands.map((band) => band.key)).toEqual(['azure', 'openshift', 'none'])
    expect(overlayBandOf(bands).get('wms')?.name).toBe('OpenShift')
  })

  it('takes the worst phase of the whole chain, and asks the tree about a stand-in', () => {
    const retiring = tree.map((e) => (e.id === 'openshift' ? { ...e, lifecycle: 'retiring' as const } : e))
    expect(overlayBandOf(overlayBands({ elements: retiring, relations: rows }, board(), 'technologyLifecycle')).get('wms')?.phase).toBe('retiring')
    const standIn = retiring.map((e) => (e.id === 'ns' ? { ...e, ref: 'platforms', parentId: undefined } : e))
    expect(overlayBandOf(overlayBands({ elements: standIn, relations: rows }, board(), 'technologyLifecycle')).get('wms')?.phase).toBe('live')
    const parentOf = (id: string) => (id === 'ns' ? 'openshift' : undefined)
    expect(overlayBandOf(overlayBands({ elements: standIn, relations: rows }, board(), 'technologyLifecycle', undefined, { parentOf })).get('wms')?.phase).toBe('retiring')
    expect(overlayBandOf(overlayBands({ elements: standIn, relations: rows }, board(), 'platform', undefined, { parentOf })).get('wms')?.name).toBe('OpenShift')
  })
})

/**
 * The reverse question (ADR-0020): who stands on this one platform or
 * offering. Coloured by a use, by a hosting, by a leverage through what
 * realises the service; the rest faded.
 */
describe('colouring by one platform or offering', () => {
  const layer = [
    ...elements,
    element('brokering', { kind: 'platformService', name: 'Message brokering' }),
    element('kafka', { kind: 'platform', name: 'Event broker' }),
    platform('ns', 'Logistics namespace', { parentId: 'openshift', platformArchetype: 'place' }),
  ]
  const rows: Relation[] = [
    host('h1', 'wms-api', 'ns'),
    host('h2', 'portal', 'openshift'),
    { id: 'u1', type: 'uses', sourceId: 'billing', targetId: 'brokering' },
    { id: 'u2', type: 'uses', sourceId: 'portal', targetId: 'kafka' },
    { id: 'r1', type: 'realises', sourceId: 'kafka', targetId: 'brokering' },
  ]
  const drawn = { ...board(), members: [...board().members, { id: 'kafka' }, { id: 'brokering' }] }

  it('colours by a use, a hosting under it, a binding, and a leverage through what realises the service', () => {
    const byOffering = overlayBands({ elements: layer, relations: rows }, drawn, colourByOne('brokering'))
    expect(byOffering.map((band) => [band.key, band.name, band.faded, band.memberIds])).toEqual([
      ['brokering', 'Message brokering', undefined, ['billing']],
      ['none', undefined, true, ['wms', 'portal', 'partner']],
    ])
    // The broker: bound to by the portal, leveraged by billing through the offering it realises.
    expect(overlayBandOf(overlayBands({ elements: layer, relations: rows }, drawn, colourByOne('kafka'))).get('billing')?.key).toBe('kafka')
    expect(overlayBandOf(overlayBands({ elements: layer, relations: rows }, drawn, colourByOne('kafka'))).get('portal')?.key).toBe('kafka')
    // The cluster: WMS through its container in the namespace under it, the portal hosted on it.
    const byCluster = overlayBandOf(overlayBands({ elements: layer, relations: rows }, drawn, colourByOne('openshift')))
    expect(byCluster.get('wms')?.key).toBe('openshift')
    expect(byCluster.get('portal')?.key).toBe('openshift')
    expect(byCluster.get('billing')?.faded).toBe(true)
  })

  it('keeps the one band even where nothing stands on it, and no faded band where everything does', () => {
    const none = overlayBands({ elements: layer, relations: rows }, drawn, colourByOne('azure'))
    expect(none.map((band) => [band.key, band.memberIds.length])).toEqual([['azure', 0], ['none', 4]])
    const all = overlayBands({ elements: layer, relations: rows }, { kind: 'layer7', members: [{ id: 'billing' }] }, colourByOne('brokering'))
    expect(all.map((band) => band.key)).toEqual(['brokering'])
  })

  it('says the value as one string, and reads it back', () => {
    expect(colourByOne('kafka')).toBe('one:kafka')
    expect(oneColouredBy('one:kafka')).toBe('kafka')
    expect(oneColouredBy('platform')).toBeUndefined()
    expect(isColourBy('one:kafka')).toBe(true)
    expect(isColourBy('one:')).toBe(false)
    expect(isColourBy('platform')).toBe(true)
    expect(isColourBy('service')).toBe(false)
  })
})
