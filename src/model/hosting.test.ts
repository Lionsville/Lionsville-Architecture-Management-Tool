/**
 * Where an application runs, read off its containers (ADR-0013, redone).
 *
 * The roll-up is the whole of it, and the cases worth pinning are the two that
 * differ: an application with containers answers with theirs and never with
 * its own row, and one with none answers with its own — which is the only
 * sentence anybody can write about a vendor-hosted service.
 */
import { describe, expect, it } from 'vitest'
import { containersOf, hostingOf, mayBeHosted } from './hosting'
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
  it('lets a container say it, always', () => {
    expect(mayBeHosted(elements, 'wms-api')).toBe(true)
  })

  it('lets an application with no containers say it — a SaaS service, a bought package', () => {
    expect(mayBeHosted(elements, 'portal')).toBe(true)
    expect(mayBeHosted(elements, 'partner')).toBe(true)
  })

  it('refuses it to an application whose containers say it', () => {
    expect(mayBeHosted(elements, 'wms')).toBe(false)
  })

  it('says yes about an id it does not hold: a far end is somebody else\'s business', () => {
    expect(mayBeHosted(elements, 'elsewhere')).toBe(true)
  })
})

describe('the roll-up', () => {
  const relations = [
    host('h1', 'wms-api', 'ns'),
    host('h2', 'wms-events', 'ns'),
    host('h3', 'wms-db', 'openshift'),
    host('h4', 'portal', 'openshift'),
  ]

  it('is the union of the containers\' places, without repeats, and counts them', () => {
    expect(hostingOf({ elements, relations }, 'wms'))
      .toEqual({ platformIds: ['ns', 'openshift'], from: 'containers', containers: 3 })
  })

  it('counts only the containers that stand on something', () => {
    const some = [host('h1', 'wms-api', 'ns')]
    expect(hostingOf({ elements, relations: some }, 'wms'))
      .toEqual({ platformIds: ['ns'], from: 'containers', containers: 1 })
  })

  it('is the application\'s own row where it has no containers', () => {
    expect(hostingOf({ elements, relations }, 'portal'))
      .toEqual({ platformIds: ['openshift'], from: 'itself', containers: 0 })
  })

  it('is nothing for an application whose containers stand on nothing, and never its own row', () => {
    // A row somebody wrote before this rule existed is not read: the answer is
    // the containers', and saying otherwise would be two answers again.
    const stale = [host('old', 'wms', 'openshift')]
    expect(hostingOf({ elements, relations: stale }, 'wms'))
      .toEqual({ platformIds: [], from: 'containers', containers: 0 })
  })

  it('answers for a container with its own rows', () => {
    expect(hostingOf({ elements, relations }, 'wms-api'))
      .toEqual({ platformIds: ['ns'], from: 'itself', containers: 0 })
  })

  it('answers honestly about something nobody has hosted', () => {
    expect(hostingOf({ elements, relations: [] }, 'partner'))
      .toEqual({ platformIds: [], from: 'itself', containers: 0 })
  })
})
