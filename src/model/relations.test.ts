/**
 * The boundary between what the model can say and what format 3 can hold.
 *
 * ADR-0012 §5 gave a relation a type; the file it is written to still has one
 * list, called `connections`, and one kind of row in it. These are the two
 * functions that keep both statements true at once.
 */
import { describe, expect, it } from 'vitest'
import { ShellError } from '../platform/errors'
import {
  RELATION_LABEL, RELATION_TYPES, asConnections, asRelations, flowsOf, isFlow, isRelationType,
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

describe('what format 3 may hold', () => {
  it('writes a flow as the connection it has always been — the word `flow` and nothing else goes', () => {
    const row = flow('c1', { label: 'orders', protocol: 'REST', validFrom: '2027-01-01' })
    const [written] = asConnections([row])
    expect(written).toEqual({
      id: 'c1', sourceId: 'a', targetId: 'b', isBidirectional: false,
      label: 'orders', protocol: 'REST', validFrom: '2027-01-01',
    })
    expect('type' in written).toBe(false)
  })

  it('refuses any other type, so this build cannot write a file a 1.x build misreads', () => {
    const supports: Relation = { id: 'r1', type: 'supports', sourceId: 'wms', targetId: 'fulfilment' }
    expect(() => asConnections([supports])).toThrow(ShellError)
    try {
      asConnections([supports])
    } catch (error) {
      // A key, never a sentence: `app/messageFor.ts` is the one place that has words.
      expect((error as ShellError).key).toBe('relation.notInThisFormat')
      expect((error as ShellError).params).toEqual({ type: 'supports' })
    }
  })

  it('refuses the whole list rather than writing the flows and dropping the rest', () => {
    expect(() => asConnections([flow('c1'), { id: 'r1', type: 'serves', sourceId: 'a', targetId: 'b' }]))
      .toThrow(ShellError)
  })

  it('reads every connection back as the flow it is', () => {
    expect(asRelations([{ id: 'c1', sourceId: 'a', targetId: 'b', isBidirectional: true }]))
      .toEqual([{ id: 'c1', type: 'flow', sourceId: 'a', targetId: 'b', isBidirectional: true }])
  })

  /**
   * The property the file boundary rests on: reading a file and writing it out
   * again is the bytes it started with, which is what keeps a save after this
   * change from being a diff nobody asked for.
   */
  it('is an exact round trip over the rows a format-3 file holds', () => {
    const rows = [
      { id: 'c1', sourceId: 'a', targetId: 'b', isBidirectional: false },
      { id: 'c2', sourceId: 'b', targetId: 'c', label: 'orders', validUntil: '2027-06-30' },
    ]
    expect(JSON.stringify(asConnections(asRelations(rows)))).toBe(JSON.stringify(rows))
  })
})
