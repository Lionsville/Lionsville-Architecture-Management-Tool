// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The deployment boxes: which containers sit in which platform, and how deep
 * (ADR-0013, redone).
 *
 * Derived from the rows, so the cases worth pinning are the ones that make the
 * picture wrong if they slip: the nesting following the platform tree, a
 * container hosted on nothing sitting outside every box, and a container the
 * board is not drawing today taking its box with it.
 */
import { describe, expect, it } from 'vitest'
import { deploymentBoxes } from './deployment'
import { element } from './testFixtures'
import type { DesignElement, Relation } from './types'

const platform = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement =>
  element(id, { kind: 'platform', name, ...over })
const container = (id: string, parentId: string): DesignElement =>
  element(id, { kind: 'component', parentId, name: id })
const host = (id: string, sourceId: string, targetId: string): Relation =>
  ({ id, type: 'hostedOn', sourceId, targetId })

const elements = [
  element('wms'), element('orders'),
  container('wms-api', 'wms'), container('wms-events', 'wms'), container('wms-db', 'wms'),
  container('wms-loose', 'wms'), container('orders-ui', 'orders'),
  platform('account', 'Cloud account', { platformArchetype: 'place' }),
  platform('openshift', 'OpenShift', { parentId: 'account', platformArchetype: 'place' }),
  platform('ns', 'Logistics namespace', { parentId: 'openshift', platformArchetype: 'place' }),
]
const relations = [
  host('h1', 'wms-api', 'ns'),
  host('h2', 'wms-events', 'ns'),
  host('h3', 'wms-db', 'openshift'),
  host('h4', 'orders-ui', 'ns'),
]
const view = { kind: 'container' as const, applicationElementId: 'wms' }
const placed = new Set(['wms', 'wms-api', 'wms-events', 'wms-db', 'wms-loose', 'orders'])

describe('the boxes a container diagram draws', () => {
  it('nests the boxes the way the platforms nest, leaving what stands on nothing outside them', () => {
    const boxes = deploymentBoxes({ elements, relations }, view, placed)
    expect(boxes.map((box) => [box.name, box.depth])).toEqual([
      ['Cloud account', 0], ['OpenShift', 1], ['Logistics namespace', 2],
    ])
    const boxes2 = deploymentBoxes({ elements, relations }, view, placed)
    expect(boxes2.some((box) => box.memberIds.includes('wms-loose'))).toBe(false)
    const today = new Set(['wms', 'wms-db'])
    const boxes3 = deploymentBoxes({ elements, relations }, view, today)
    expect(boxes3.map((box) => box.name)).toEqual(['Cloud account', 'OpenShift'])
  })

  it('puts a container in its own box and in every box that one sits in', () => {
    const boxes = deploymentBoxes({ elements, relations }, view, placed)
    const members = Object.fromEntries(boxes.map((box) => [box.id, box.memberIds]))
    expect(members.ns).toEqual(['wms-api', 'wms-events'])
    expect(members.openshift).toEqual(['wms-api', 'wms-events', 'wms-db'])
    expect(members.account).toEqual(['wms-api', 'wms-events', 'wms-db'])
  })

  it('draws nothing for another application’s containers, nor off a container view, nor down a loop', () => {
    const boxes = deploymentBoxes({ elements, relations }, view, placed)
    expect(boxes.some((box) => box.memberIds.includes('orders-ui'))).toBe(false)
    expect(deploymentBoxes({ elements, relations }, { kind: 'layer7' }, placed)).toEqual([])
    const looped = elements.map((e) => (e.id === 'account' ? { ...e, parentId: 'ns' } : e))
    const boxes2 = deploymentBoxes({ elements: looped, relations }, view, placed)
    expect(boxes2.map((box) => box.id).sort()).toEqual(['account', 'ns', 'openshift'])
  })

  /**
   * A box is a place (ADR-0014). A container on a broker is consuming it, not
   * sitting in it, and a platform that says nothing is a service — so neither
   * draws a box, and the chain walks on to the place above.
   */
  it('draws a box for a place only, and walks through a service to the place above it', () => {
    const withBus = [
      ...elements,
      platform('bus', 'Enterprise bus', { parentId: 'openshift' }),
      platform('unsaid', 'Unsaid', { parentId: 'openshift' }),
    ]
    const onBus = [...relations, host('h5', 'wms-loose', 'bus')]
    const boxes = deploymentBoxes({ elements: withBus, relations: onBus }, view, placed)
    expect(boxes.map((box) => box.id)).toEqual(['account', 'openshift', 'ns'])
    expect(boxes.find((box) => box.id === 'openshift')!.memberIds).toContain('wms-loose')
    const onUnsaid = [...relations, host('h5', 'wms-loose', 'unsaid')]
    expect(deploymentBoxes({ elements: withBus, relations: onUnsaid }, view, placed).map((box) => box.id))
      .toEqual(['account', 'openshift', 'ns'])
  })

  it('takes what a platform is from the tree, where this scope holds only a stand-in', () => {
    // A stand-in carries nothing the owner answers for: the namespace here
    // says nothing, and the index says it is a place.
    const standIn = elements.map((e) => (e.id === 'ns' ? { ...e, ref: 'platforms', platformArchetype: undefined } : e))
    expect(deploymentBoxes({ elements: standIn, relations }, view, placed).map((box) => box.id))
      .toEqual(['account', 'openshift'])
    const archetypeOf = (id: string) => (id === 'ns' ? 'place' as const : undefined)
    expect(deploymentBoxes({ elements: standIn, relations }, view, placed, { archetypeOf }).map((box) => box.id))
      .toEqual(['account', 'openshift', 'ns'])
  })

})
