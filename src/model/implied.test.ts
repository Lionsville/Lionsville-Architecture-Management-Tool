/**
 * The interface container lines imply when they refine nothing
 * (ADR-0013, redone).
 *
 * One row per pair however many lines run between it, and the union of the
 * directions — because the line an *Accept* writes has to be true of every
 * line it lands.
 */
import { describe, expect, it } from 'vitest'
import { acceptImplied, impliedInterfaces } from './implied'
import { element } from './testFixtures'
import type { DesignElement, Relation } from './types'

const component = (id: string, parentId: string): DesignElement =>
  element(id, { kind: 'component', parentId })

const elements = [
  element('wms'), element('orders'), element('billing'),
  component('wms-api', 'wms'), component('wms-events', 'wms'),
  component('orders-ui', 'orders'), component('billing-ledger', 'billing'),
]
const held = (id: string) => elements.find((e) => e.id === id)

const flow = (id: string, sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation =>
  ({ id, type: 'flow', sourceId, targetId, ...over })

describe('what unrefined container lines imply', () => {
  it('is one interface per pair, whichever containers the lines run between', () => {
    const implied = impliedInterfaces([
      flow('x1', 'billing-ledger', 'wms-api'),
      flow('x2', 'billing', 'wms-events'),
    ], held)
    expect(implied).toHaveLength(1)
    expect(implied[0]).toMatchObject({ sourceId: 'billing', targetId: 'wms', isBidirectional: false })
    expect(implied[0].relations.map((r) => r.id)).toEqual(['x1', 'x2'])
  })

  it('takes the direction of the first line, and says both ways when the lines disagree', () => {
    const oneWay = impliedInterfaces([flow('x1', 'wms-api', 'billing-ledger')], held)
    expect(oneWay[0]).toMatchObject({ sourceId: 'wms', targetId: 'billing', isBidirectional: false })
    const both = impliedInterfaces([
      flow('x1', 'wms-api', 'billing-ledger'),
      flow('x2', 'billing-ledger', 'wms-api'),
    ], held)
    expect(both).toHaveLength(1)
    expect(both[0]).toMatchObject({ sourceId: 'wms', targetId: 'billing', isBidirectional: true })
  })

  it('says both ways when one line says so by itself', () => {
    const implied = impliedInterfaces([flow('x1', 'wms-api', 'billing-ledger', { isBidirectional: true })], held)
    expect(implied[0].isBidirectional).toBe(true)
  })

  it('implies nothing from a line that has landed, from an application line, or from any other row', () => {
    expect(impliedInterfaces([
      flow('r1', 'orders', 'wms-api', { refines: 'c16' }),
      flow('c16', 'orders', 'wms'),
      { id: 'u1', type: 'uses', sourceId: 'wms-api', targetId: 'kafka' },
    ], held)).toEqual([])
  })

  it('implies nothing from two containers of the same application', () => {
    expect(impliedInterfaces([flow('x1', 'wms-api', 'wms-events')], held)).toEqual([])
  })

  it('keeps the pairs apart, in the order the first line of each was written', () => {
    const implied = impliedInterfaces([
      flow('x1', 'billing-ledger', 'wms-api'),
      flow('x2', 'orders-ui', 'wms-api'),
      flow('x3', 'billing', 'wms-events'),
    ], held)
    expect(implied.map((one) => [one.sourceId, one.targetId])).toEqual([['billing', 'wms'], ['orders', 'wms']])
    expect(implied[0].relations.map((r) => r.id)).toEqual(['x1', 'x3'])
  })
})


describe('accepting one', () => {
  it('writes the interface and lands every line on it, as one step', () => {
    const implied = impliedInterfaces([
      flow('x1', 'billing-ledger', 'wms-api'),
      flow('x2', 'billing', 'wms-events', { label: 'settles' }),
    ], held)[0]
    const command = acceptImplied(implied, 'c#99', (id) => ({ billing: 'Billing', wms: 'WMS' }[id] ?? id))
    expect(command.type).toBe('transaction')
    const inner = command.type === 'transaction' ? command.commands : []
    expect(inner.map((one) => one.type)).toEqual(['relation.create', 'relation.update', 'relation.update'])
    // The line first: the writer refuses a landing on a row that is not there.
    expect(inner[0]).toMatchObject({
      relation: { id: 'c#99', type: 'flow', sourceId: 'billing', targetId: 'wms', label: 'settles' },
    })
    expect(inner.slice(1)).toEqual([
      { type: 'relation.update', id: 'x1', patch: { refines: 'c#99' } },
      { type: 'relation.update', id: 'x2', patch: { refines: 'c#99' } },
    ])
  })

  it('names it after the two applications when no line says what flows', () => {
    const implied = impliedInterfaces([flow('x1', 'billing-ledger', 'wms-api')], held)[0]
    const command = acceptImplied(implied, 'c#99', (id) => ({ billing: 'Billing', wms: 'WMS' }[id] ?? id))
    const inner = command.type === 'transaction' ? command.commands : []
    expect(inner[0]).toMatchObject({ relation: { label: 'Billing → WMS' } })
  })

  it('carries the union of the directions', () => {
    const implied = impliedInterfaces([
      flow('x1', 'billing-ledger', 'wms-api'),
      flow('x2', 'wms-events', 'billing-ledger'),
    ], held)[0]
    const command = acceptImplied(implied, 'c#99', (id) => id)
    const inner = command.type === 'transaction' ? command.commands : []
    expect(inner[0]).toMatchObject({ relation: { isBidirectional: true } })
  })
})
