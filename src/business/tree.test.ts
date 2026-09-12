import { describe, expect, it } from 'vitest'
import { childrenOf, depthOf, descendantsOf, flatten, inOrder, moveAmongSiblings, wouldCycle } from './tree'
import { area, capability, grouping, journey } from './testFixtures'

/**
 * The tree, over a small responsibility area: *Fulfilment* with two groupings
 * under it, one of which has two capabilities. Depth is what a sheet draws
 * from (ADR-0012 §4) and nothing else here knows the words.
 */
const areas = () => [
  area('fulfilment', 'Fulfilment'),
  grouping('warehousing', 'Warehousing', 'fulfilment', { order: 2 }),
  grouping('transport', 'Transport', 'fulfilment', { order: 1 }),
  capability('picking', 'Picking', 'warehousing'),
  capability('packing', 'Packing', 'warehousing'),
  area('billing', 'Billing'),
]

describe('inOrder', () => {
  it('puts what said an order first, low to high', () => {
    expect(inOrder([
      capability('c', 'C', 'x', { order: 3 }),
      capability('a', 'A', 'x', { order: 1 }),
    ]).map((e) => e.id)).toEqual(['a', 'c'])
  })

  it('leaves what said nothing in the order the list had', () => {
    // The reason `order` is optional: a list nobody ordered is not renumbered
    // to say so, and two people do not both renumber it.
    expect(inOrder([
      capability('b', 'B', 'x'),
      capability('a', 'A', 'x'),
    ]).map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('draws what said an order before what did not', () => {
    expect(inOrder([
      capability('silent', 'Silent', 'x'),
      capability('third', 'Third', 'x', { order: 3 }),
    ]).map((e) => e.id)).toEqual(['third', 'silent'])
  })

  it('keeps a tie in the order the list had, so two reads agree', () => {
    expect(inOrder([
      capability('b', 'B', 'x', { order: 3 }),
      capability('a', 'A', 'x', { order: 3 }),
    ]).map((e) => e.id)).toEqual(['b', 'a'])
  })
})

describe('childrenOf', () => {
  it('answers what sits directly under one, in order', () => {
    expect(childrenOf(areas(), 'fulfilment').map((e) => e.id)).toEqual(['transport', 'warehousing'])
  })

  it('answers the roots for no parent at all', () => {
    expect(childrenOf(areas(), undefined).map((e) => e.id)).toEqual(['fulfilment', 'billing'])
  })

  it('answers nothing for a leaf', () => {
    expect(childrenOf(areas(), 'picking')).toEqual([])
  })
})

describe('depthOf', () => {
  it('counts from 0 at a root — an area, a grouping, a capability', () => {
    expect(depthOf(areas(), 'fulfilment')).toBe(0)
    expect(depthOf(areas(), 'warehousing')).toBe(1)
    expect(depthOf(areas(), 'picking')).toBe(2)
  })

  it('says nothing about a chain that does not end at a root', () => {
    // A parent this scope does not hold is a dangling end (ADR-0012 §5): kept
    // and reported, never dropped — and not a thing with a depth.
    expect(depthOf([capability('orphan', 'Orphan', 'somewhere-else')], 'orphan')).toBeUndefined()
    expect(depthOf(areas(), 'nobody')).toBeUndefined()
  })

  it('says nothing about a loop instead of counting forever', () => {
    const looped = [
      capability('a', 'A', 'b'),
      capability('b', 'B', 'a'),
    ]
    expect(depthOf(looped, 'a')).toBeUndefined()
  })
})

describe('descendantsOf', () => {
  it('lists everything under one, in drawing order', () => {
    expect(descendantsOf(areas(), 'fulfilment').map((e) => e.id))
      .toEqual(['transport', 'warehousing', 'picking', 'packing'])
  })

  it('walks a loop once rather than hanging', () => {
    const looped = [capability('a', 'A', 'b'), capability('b', 'B', 'a')]
    expect(descendantsOf(looped, 'a').map((e) => e.id)).toEqual(['b'])
  })
})

describe('wouldCycle', () => {
  it('refuses a thing under itself', () => {
    expect(wouldCycle(areas(), 'fulfilment', 'fulfilment')).toBe(true)
  })

  it('refuses a thing under something already under it', () => {
    expect(wouldCycle(areas(), 'fulfilment', 'picking')).toBe(true)
  })

  it('allows a move that is not a loop, and allows letting go of a parent', () => {
    expect(wouldCycle(areas(), 'picking', 'transport')).toBe(false)
    expect(wouldCycle(areas(), 'picking', undefined)).toBe(false)
  })

  it('answers rather than hanging when the model already holds a loop', () => {
    const looped = [capability('a', 'A', 'b'), capability('b', 'B', 'a')]
    expect(wouldCycle(looped, 'c', 'a')).toBe(false)
  })
})

describe('moveAmongSiblings', () => {
  it('swaps a thing with the neighbour it is moving past', () => {
    // Transport is first and Warehousing second; moving Warehousing up puts
    // the pair back the other way round.
    expect(moveAmongSiblings(areas(), 'warehousing', -1))
      .toEqual([{ id: 'warehousing', order: 1 }, { id: 'transport', order: 2 }])
  })

  it('renumbers a list that never said an order, because now it has one', () => {
    const unordered = [
      area('a', 'A'), capability('x', 'X', 'a'), capability('y', 'Y', 'a'), capability('z', 'Z', 'a'),
    ]
    expect(moveAmongSiblings(unordered, 'z', -1))
      .toEqual([{ id: 'x', order: 1 }, { id: 'z', order: 2 }, { id: 'y', order: 3 }])
  })

  it('writes nothing at either end, so there is nothing to undo', () => {
    expect(moveAmongSiblings(areas(), 'transport', -1)).toEqual([])
    expect(moveAmongSiblings(areas(), 'warehousing', 1)).toEqual([])
  })

  it('writes nothing for something the scope does not hold', () => {
    expect(moveAmongSiblings(areas(), 'nobody', 1)).toEqual([])
  })

  it('counts only its own kind as neighbours', () => {
    // A journey and an area are both roots and are not in one another's row.
    const mixed = [area('a', 'A'), area('b', 'B'), journey('j', 'J')]
    expect(moveAmongSiblings(mixed, 'b', -1))
      .toEqual([{ id: 'b', order: 1 }, { id: 'a', order: 2 }])
  })
})

describe('flatten', () => {
  it('is the whole scope, each row with the depth it is drawn at', () => {
    expect(flatten(areas()).map(({ element, depth }) => [element.id, depth])).toEqual([
      ['fulfilment', 0],
      ['transport', 1],
      ['warehousing', 1],
      ['picking', 2],
      ['packing', 2],
      ['billing', 0],
    ])
  })

  it('is one root and what is under it, counted from that root', () => {
    expect(flatten(areas(), 'warehousing').map(({ element, depth }) => [element.id, depth]))
      .toEqual([['warehousing', 0], ['picking', 1], ['packing', 1]])
  })

  it('is empty for a root the scope does not hold', () => {
    expect(flatten(areas(), 'nobody')).toEqual([])
  })
})
