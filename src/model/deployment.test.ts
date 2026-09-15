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
  platform('account', 'Cloud account'),
  platform('openshift', 'OpenShift', { parentId: 'account' }),
  platform('ns', 'Logistics namespace', { parentId: 'openshift' }),
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
  it('nests them the way the platforms nest, outermost first', () => {
    const boxes = deploymentBoxes({ elements, relations }, view, placed)
    expect(boxes.map((box) => [box.name, box.depth])).toEqual([
      ['Cloud account', 0], ['OpenShift', 1], ['Logistics namespace', 2],
    ])
  })

  it('puts a container in its own box and in every box that one sits in', () => {
    const boxes = deploymentBoxes({ elements, relations }, view, placed)
    const members = Object.fromEntries(boxes.map((box) => [box.id, box.memberIds]))
    expect(members.ns).toEqual(['wms-api', 'wms-events'])
    expect(members.openshift).toEqual(['wms-api', 'wms-events', 'wms-db'])
    expect(members.account).toEqual(['wms-api', 'wms-events', 'wms-db'])
  })

  it('leaves a container hosted on nothing outside every box', () => {
    const boxes = deploymentBoxes({ elements, relations }, view, placed)
    expect(boxes.some((box) => box.memberIds.includes('wms-loose'))).toBe(false)
  })

  it('draws nothing for another application\'s containers: their deployment is not this picture', () => {
    const boxes = deploymentBoxes({ elements, relations }, view, placed)
    expect(boxes.some((box) => box.memberIds.includes('orders-ui'))).toBe(false)
  })

  it('takes a box with the container the board is not drawing today', () => {
    const today = new Set(['wms', 'wms-db'])
    const boxes = deploymentBoxes({ elements, relations }, view, today)
    expect(boxes.map((box) => box.name)).toEqual(['Cloud account', 'OpenShift'])
  })

  it('says the platform\'s sort, for the box to wear', () => {
    const typed = elements.map((e) => (e.id === 'ns' ? { ...e, platformCategory: 'runtime' as const } : e))
    const boxes = deploymentBoxes({ elements: typed, relations }, view, placed)
    expect(boxes.find((box) => box.id === 'ns')?.platformCategory).toBe('runtime')
    // Unsaid reads as tooling, as everywhere.
    expect(boxes.find((box) => box.id === 'openshift')?.platformCategory).toBe('tooling')
  })

  it('draws nothing on a view that is not a container diagram', () => {
    expect(deploymentBoxes({ elements, relations }, { kind: 'layer7' }, placed)).toEqual([])
  })

  it('survives a platform filed under itself rather than looping for ever', () => {
    const looped = elements.map((e) => (e.id === 'account' ? { ...e, parentId: 'ns' } : e))
    const boxes = deploymentBoxes({ elements: looped, relations }, view, placed)
    expect(boxes.map((box) => box.id).sort()).toEqual(['account', 'ns', 'openshift'])
  })
})
