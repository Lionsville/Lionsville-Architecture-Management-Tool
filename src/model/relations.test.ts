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
  PLATFORM_CATEGORIES, PLATFORM_CATEGORY_LABEL, RELATION_LABEL, RELATION_TYPES,
  flowsOf, isFlow, isPlatformCategory, isRelationType, isTechnologyRelation, platformCategoryOf,
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

describe('what a platform is (ADR-0013)', () => {
  it('has a label for every category, and recognises its own members', () => {
    for (const category of PLATFORM_CATEGORIES) {
      expect(PLATFORM_CATEGORY_LABEL[category]).toBe(`platformCategory.${category}`)
      expect(isPlatformCategory(category)).toBe(true)
    }
    expect(isPlatformCategory('cloud')).toBe(false)
    expect(isPlatformCategory(undefined)).toBe(false)
  })

  it('reads a platform that says nothing as tooling, the category with the fewest consequences', () => {
    expect(platformCategoryOf({})).toBe('tooling')
    expect(platformCategoryOf({ platformCategory: 'messaging' })).toBe('messaging')
  })

  it('is drawn as the chip the management band draws, wherever it sits', () => {
    // The tooling in that band was platforms all along; a platform placed in
    // the open landscape is the same sort of thing, and the band still wins.
    const platform = { kind: 'platform' as const }
    expect(nodeFigure(platform)).toBe('managementTool')
    expect(nodeFigure(platform, 'landscape')).toBe('managementTool')
    expect(nodeFigure(platform, 'management')).toBe('managementTool')
    expect(nodeFigure(platform, 'externalSystems')).toBe('externalSystem')
  })
})
