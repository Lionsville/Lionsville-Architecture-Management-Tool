/**
 * What a relation is, and the one thing only a flow means.
 *
 * This file used to also pin the boundary between what the model could say and
 * what format 3 could hold. The file says what the model says since format 4,
 * so that pair is gone; `projects/migrate3to4.test.ts` is where the old
 * spelling is pinned now.
 */
import { describe, expect, it } from 'vitest'
import {
  PLATFORM_ARCHETYPES, PLATFORM_ARCHETYPE_LABEL, RELATION_LABEL, RELATION_TYPES,
  flowsOf, isFlow, isPlatformArchetype, isRelationType, isTechnologyRelation, platformArchetypeOf,
  technologyEndsRefusal,
} from './relations'
import { nodeFigure } from './kinds'
import type { Relation } from './types'

const flow = (id: string, over: Partial<Relation> = {}): Relation =>
  ({ id, type: 'flow', sourceId: 'a', targetId: 'b', isBidirectional: false, ...over })

describe('the vocabulary', () => {
  it('has a label for every type, so a page can name one without asking this module twice', () => {
    for (const type of RELATION_TYPES) expect(RELATION_LABEL[type]).toBe(`relation.${type}`)
    expect(Object.keys(RELATION_LABEL)).toHaveLength(RELATION_TYPES.length)
  })

  it('recognises its own members and nothing else', () => {
    for (const type of RELATION_TYPES) expect(isRelationType(type)).toBe(true)
    expect(isRelationType('connection')).toBe(false)
    expect(isRelationType(undefined)).toBe(false)
  })

  it('tells a flow from the rest', () => {
    expect(isFlow(flow('c1'))).toBe(true)
    expect(isFlow({ type: 'supports' })).toBe(false)
    expect(flowsOf([flow('c1'), { ...flow('c2'), type: 'supports' }, flow('c3')]).map((r) => r.id))
      .toEqual(['c1', 'c3'])
  })

  it('has the two rows of the physical view, and tells them from the rest (ADR-0013)', () => {
    expect(RELATION_TYPES).toContain('uses')
    expect(RELATION_TYPES).toContain('hostedOn')
    expect(isTechnologyRelation({ type: 'uses' })).toBe(true)
    expect(isTechnologyRelation({ type: 'hostedOn' })).toBe(true)
    expect(isTechnologyRelation({ type: 'flow' })).toBe(false)
    expect(isTechnologyRelation({ type: 'supports' })).toBe(false)
  })
})

describe('what a platform is (ADR-0013, ADR-0014)', () => {
  it('is a place, a service or a network, each with a label, and recognises its own members', () => {
    expect(PLATFORM_ARCHETYPES).toEqual(['place', 'service', 'network'])
    for (const archetype of PLATFORM_ARCHETYPES) {
      expect(PLATFORM_ARCHETYPE_LABEL[archetype]).toBe(`platformArchetype.${archetype}`)
      expect(isPlatformArchetype(archetype)).toBe(true)
    }
    // The old closed category is not an archetype: a runtime is a place, and
    // the folder reader says so.
    expect(isPlatformArchetype('runtime')).toBe(false)
    expect(isPlatformArchetype(undefined)).toBe(false)
  })

  it('reads a platform that says nothing as a service, the archetype that draws nothing nobody asked for', () => {
    expect(platformArchetypeOf({})).toBe('service')
    expect(platformArchetypeOf({ platformArchetype: 'place' })).toBe('place')
  })

  it('is drawn as the chip the management band draws, wherever it sits', () => {
    // The tooling in that band was platforms all along; a platform placed in
    // the open landscape is the same sort of thing, and the band still wins.
    const platform = { kind: 'platform' as const }
    expect(nodeFigure(platform)).toBe('managementTool')
    expect(nodeFigure(platform, 'landscape')).toBe('managementTool')
    expect(nodeFigure(platform, 'management')).toBe('managementTool')
    expect(nodeFigure(platform, 'externalSystems')).toBe('externalSystem')
    // What a platform offers is drawn beside it, as the same chip (ADR-0014).
    expect(nodeFigure({ kind: 'platformService' })).toBe('managementTool')
    expect(nodeFigure({ kind: 'platformService' }, 'landscape')).toBe('managementTool')
  })
})

describe('the ends of the technology rows (ADR-0014)', () => {
  const kinds: Record<string, Relation['type'] | string> = {
    wms: 'application', api: 'component', clerk: 'actor', pick: 'function',
    openshift: 'platform', ns: 'platform', containers: 'platformService', flow: 'process',
  }
  const kindOf = (id: string) => (id in kinds ? { kind: kinds[id] as never } : undefined)
  const row = (type: Relation['type'], sourceId: string, targetId: string) => ({ type, sourceId, targetId })

  it('runs hostedOn from an application or a container to a platform, and nowhere else', () => {
    expect(technologyEndsRefusal(row('hostedOn', 'api', 'ns'), kindOf)).toBeUndefined()
    expect(technologyEndsRefusal(row('hostedOn', 'wms', 'openshift'), kindOf)).toBeUndefined()
    // A platform inside a platform is `parentId`, the one containment.
    expect(technologyEndsRefusal(row('hostedOn', 'ns', 'openshift'), kindOf)).toBe('hostedOn')
    // Not on a service, and not from an actor.
    expect(technologyEndsRefusal(row('hostedOn', 'api', 'containers'), kindOf)).toBe('hostedOn')
    expect(technologyEndsRefusal(row('hostedOn', 'clerk', 'openshift'), kindOf)).toBe('hostedOn')
  })

  it('lets uses end on a platform or on the service it realises', () => {
    expect(technologyEndsRefusal(row('uses', 'wms', 'containers'), kindOf)).toBeUndefined()
    expect(technologyEndsRefusal(row('uses', 'api', 'openshift'), kindOf)).toBeUndefined()
    expect(technologyEndsRefusal(row('uses', 'wms', 'pick'), kindOf)).toBe('uses')
    expect(technologyEndsRefusal(row('uses', 'openshift', 'containers'), kindOf)).toBe('uses')
  })

  it('lets a platform realise a service, and leaves a process realising a function alone', () => {
    expect(technologyEndsRefusal(row('realises', 'openshift', 'containers'), kindOf)).toBeUndefined()
    expect(technologyEndsRefusal(row('realises', 'flow', 'pick'), kindOf)).toBeUndefined()
    expect(technologyEndsRefusal(row('realises', 'openshift', 'pick'), kindOf)).toBe('realises')
    expect(technologyEndsRefusal(row('realises', 'wms', 'containers'), kindOf)).toBe('realises')
  })

  it('lets an actor be assigned a service or a platform, and nobody else', () => {
    expect(technologyEndsRefusal(row('assigned', 'clerk', 'containers'), kindOf)).toBeUndefined()
    expect(technologyEndsRefusal(row('assigned', 'clerk', 'openshift'), kindOf)).toBeUndefined()
    expect(technologyEndsRefusal(row('assigned', 'clerk', 'pick'), kindOf)).toBeUndefined()
    expect(technologyEndsRefusal(row('assigned', 'wms', 'containers'), kindOf)).toBe('assigned')
  })

  it('trusts an end this scope does not hold, as every other row\'s far end is', () => {
    expect(technologyEndsRefusal(row('hostedOn', 'api', 'elsewhere'), kindOf)).toBeUndefined()
    expect(technologyEndsRefusal(row('hostedOn', 'elsewhere', 'openshift'), kindOf)).toBeUndefined()
    expect(technologyEndsRefusal(row('flow', 'wms', 'openshift'), kindOf)).toBeUndefined()
  })
})
