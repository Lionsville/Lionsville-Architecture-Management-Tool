/**
 * Where an application runs, read off its containers (ADR-0013, redone).
 *
 * The roll-up is the whole of it, and the cases worth pinning are the two that
 * differ: an application with containers answers with theirs and never with
 * its own row, and one with none answers with its own — which is the only
 * sentence anybody can write about a vendor-hosted service.
 */
import { describe, expect, it } from 'vitest'
import { ancestorPlatforms, containersOf, descendantPlatforms, hostingOf, mayBeHosted, rootPlatformsOf } from './hosting'
import { element } from './testFixtures'
import type { DesignElement, Relation } from './types'

const component = (id: string, parentId: string): DesignElement =>
  element(id, { kind: 'component', parentId })

const elements = [
  element('wms'), element('portal'), element('partner', { outside: true }),
  component('wms-api', 'wms'), component('wms-events', 'wms'), component('wms-db', 'wms'),
  element('openshift', { kind: 'platform' }),
  element('ns', { kind: 'platform', parentId: 'openshift' }),
]

const host = (id: string, sourceId: string, targetId: string): Relation =>
  ({ id, type: 'hostedOn', sourceId, targetId })

describe('what is filed under an application', () => {
  it('names its containers, in the order the model holds them', () => {
    expect(containersOf(elements, 'wms').map((e) => e.id)).toEqual(['wms-api', 'wms-events', 'wms-db'])
    expect(containersOf(elements, 'portal')).toEqual([])
  })
})

describe('who may say where it runs', () => {
  it('lets a container say it, refuses an application whose containers do, and yes to a far end', () => {
    expect(mayBeHosted(elements, 'wms-api')).toBe(true)
    expect(mayBeHosted(elements, 'wms')).toBe(false)
    expect(mayBeHosted(elements, 'elsewhere')).toBe(true)
  })

  it('lets an application with no containers say it — a SaaS service, a bought package', () => {
    expect(mayBeHosted(elements, 'portal')).toBe(true)
    expect(mayBeHosted(elements, 'partner')).toBe(true)
  })

})

describe('the roll-up', () => {
  const relations = [
    host('h1', 'wms-api', 'ns'),
    host('h2', 'wms-events', 'ns'),
    host('h3', 'wms-db', 'openshift'),
    host('h4', 'portal', 'openshift'),
  ]

  it('is the union of the containers’ places without repeats, or the application’s own row', () => {
    expect(hostingOf({ elements, relations }, 'wms'))
      .toEqual({ platformIds: ['ns', 'openshift'], from: 'containers', containers: 3 })
    const some = [host('h1', 'wms-api', 'ns')]
    expect(hostingOf({ elements, relations: some }, 'wms'))
      .toEqual({ platformIds: ['ns'], from: 'containers', containers: 1 })
    expect(hostingOf({ elements, relations }, 'portal'))
      .toEqual({ platformIds: ['openshift'], from: 'itself', containers: 0 })
    // A row somebody wrote before this rule existed is not read: the answer is
    // the containers', and saying otherwise would be two answers again.
    const stale = [host('old', 'wms', 'openshift')]
    expect(hostingOf({ elements, relations: stale }, 'wms'))
      .toEqual({ platformIds: [], from: 'containers', containers: 0 })
    expect(hostingOf({ elements, relations }, 'wms-api'))
      .toEqual({ platformIds: ['ns'], from: 'itself', containers: 0 })
    expect(hostingOf({ elements, relations: [] }, 'partner'))
      .toEqual({ platformIds: [], from: 'itself', containers: 0 })
  })

})

/**
 * The platform tree every reader walks (ADR-0014 §2.7): `parentId` is the one
 * containment, a stand-in carries none and is told by the tree, and the
 * coarse answer stops at the edge of the organisation.
 */
describe('the platform tree', () => {
  const account = element('account', { kind: 'platform', name: 'Cloud account', outside: true })
  const tree = [...elements, account].map((e) => (e.id === 'openshift' ? { ...e, parentId: 'account' } : e))
  const relations = [host('h1', 'wms-api', 'ns'), host('h2', 'wms-db', 'openshift'), host('h3', 'portal', 'account')]

  it('walks up to the outermost platform, nearest first, and stops at a loop', () => {
    expect(ancestorPlatforms(tree, 'ns').map((e) => e.id)).toEqual(['openshift', 'account'])
    expect(ancestorPlatforms(tree, 'account')).toEqual([])
    const looped = tree.map((e) => (e.id === 'account' ? { ...e, parentId: 'ns' } : e))
    expect(ancestorPlatforms(looped, 'ns').map((e) => e.id)).toEqual(['openshift', 'account'])
  })

  it('asks the tree where a stand-in carries no parent of its own', () => {
    const standIns = tree.map((e) => (e.id === 'ns' ? { ...e, ref: 'platforms', parentId: undefined } : e))
    expect(ancestorPlatforms(standIns, 'ns')).toEqual([])
    const parentOf = (id: string) => (id === 'ns' ? 'openshift' : undefined)
    expect(ancestorPlatforms(standIns, 'ns', { parentOf }).map((e) => e.id)).toEqual(['openshift', 'account'])
    expect(descendantPlatforms(standIns, 'account', { parentOf }).map((e) => e.id)).toEqual(['openshift', 'ns'])
  })

  it('lists everything filed under a platform at any depth, in the model\'s order', () => {
    expect(descendantPlatforms(tree, 'account').map((e) => e.id)).toEqual(['openshift', 'ns'])
    expect(descendantPlatforms(tree, 'openshift').map((e) => e.id)).toEqual(['ns'])
    expect(descendantPlatforms(tree, 'ns')).toEqual([])
  })

  it('answers the coarse place with the outermost platform the organisation runs, once each', () => {
    // The namespace and the cluster both roll up to the cluster: the account
    // above it is somebody else's, and the landscape is coloured by ours.
    expect(rootPlatformsOf({ elements: tree, relations }, 'wms')).toEqual(['openshift'])
    // A chain that is outside throughout answers with its top.
    expect(rootPlatformsOf({ elements: tree, relations }, 'portal')).toEqual(['account'])
    // And a place this scope does not hold is named as the row names it.
    expect(rootPlatformsOf({ elements: tree, relations: [host('h9', 'partner', 'elsewhere')] }, 'partner')).toEqual(['elsewhere'])
    // What the tree says about a stand-in counts here too.
    const standIns = tree.map((e) => (e.id === 'account' ? { ...e, ref: 'platforms', outside: undefined } : e))
    expect(rootPlatformsOf({ elements: standIns, relations }, 'wms')).toEqual(['account'])
    expect(rootPlatformsOf({ elements: standIns, relations }, 'wms', { outsideOf: (id) => id === 'account' })).toEqual(['openshift'])
  })
})
