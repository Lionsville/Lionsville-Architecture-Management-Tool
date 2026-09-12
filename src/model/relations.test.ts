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
  RELATION_LABEL, RELATION_TYPES, flowsOf, isFlow, isRelationType,
} from './relations'
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
})
