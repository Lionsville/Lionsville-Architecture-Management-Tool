import { describe, expect, it } from 'vitest'
import { mayRemove, nextOrder } from './authoring'
import { area, capability, grouping, phase, shippingScope } from './testFixtures'

describe('nextOrder', () => {
  const { elements } = shippingScope()

  it('is one past the highest when every sibling carries an order', () => {
    // The journey's four phases are ordered 1..4, so a fifth goes at the end.
    expect(nextOrder(elements, 'step', 'ship')).toBe(5)
  })

  it('is nothing when no sibling carries one, because appending is what lands last', () => {
    // The capabilities under a grouping are in the model's own order. A 1 here
    // would sort the new one ahead of all of them.
    expect(nextOrder(elements, 'function', 'warehousing')).toBeUndefined()
  })

  it('is nothing when only some of them do', () => {
    const mixed = [...elements, phase('extra', 'Extra', 'ship')]
    expect(nextOrder(mixed, 'step', 'ship')).toBeUndefined()
  })

  it('is nothing for the first of a kind under a parent', () => {
    expect(nextOrder(elements, 'function', 'picking')).toBeUndefined()
  })

  it('counts only siblings of the same kind', () => {
    // A step and a function can share a parent in a hand-edited file; the
    // order of one row says nothing about the other.
    const crossed = [...elements, grouping('odd', 'Odd', 'ship')]
    expect(nextOrder(crossed, 'step', 'ship')).toBe(5)
  })

  it('counts the roots of a kind when there is no parent', () => {
    expect(nextOrder([...elements, area('third', 'Third', { order: 7 })], 'function', undefined))
      .toBe(8)
  })
})

describe('mayRemove', () => {
  const { elements } = shippingScope()

  it('lets a leaf go', () => {
    expect(mayRemove(elements, 'packing')).toEqual({ ok: true })
  })

  it('refuses one with something inside it, and says how many', () => {
    expect(mayRemove(elements, 'warehousing'))
      .toEqual({ ok: false, reason: 'sheet.deleteChildrenFirst', count: 2 })
  })

  it('refuses a journey while it has phases', () => {
    expect(mayRemove(elements, 'ship')).toMatchObject({ ok: false, count: 4 })
  })

  it('counts a child of any kind, because anything left behind is dangling', () => {
    const mixed = [...elements, capability('odd', 'Odd', 'packing')]
    expect(mayRemove(mixed, 'packing')).toMatchObject({ ok: false, count: 1 })
  })

  it('lets an id nobody holds go, which is a delete that does nothing', () => {
    expect(mayRemove(elements, 'never-was')).toEqual({ ok: true })
  })
})
