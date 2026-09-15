/**
 * What it means for a container line to be part of an application interface
 * (ADR-0013, redone).
 *
 * The rule is the whole of it: source under source, target under target, one
 * level only. Everything a page draws about a landing rests on this answer,
 * so the shapes it has to get right are the ones that look almost right — the
 * same two containers the wrong way round, a component of the wrong
 * application, and a line that would make a chain.
 */
import { describe, expect, it } from 'vitest'
import {
  applicationOf, hasRefinements, isApplicationLine, isContainerLine, landingPlaces,
  protocolsOf, refinementRefusal, refinementsOf,
} from './refines'
import { element } from './testFixtures'
import type { DesignElement, Relation } from './types'

const component = (id: string, parentId: string): DesignElement =>
  element(id, { kind: 'component', parentId })

const elements = [
  element('wms'), element('orders'), element('billing'),
  component('wms-api', 'wms'), component('wms-events', 'wms'), component('wms-db', 'wms'),
  component('orders-ui', 'orders'),
]
const held = (id: string) => elements.find((e) => e.id === id)

const flow = (id: string, sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation =>
  ({ id, type: 'flow', sourceId, targetId, ...over })

describe('which level a line is on', () => {
  it('is a container line when either end is a component, and an application line otherwise', () => {
    expect(isContainerLine(flow('a', 'orders', 'wms-api'), held)).toBe(true)
    expect(isContainerLine(flow('b', 'wms-api', 'orders-ui'), held)).toBe(true)
    expect(isApplicationLine(flow('c', 'orders', 'wms'), held)).toBe(true)
    expect(isApplicationLine(flow('d', 'orders', 'wms-api'), held)).toBe(false)
  })

  it('reads an end nobody holds as an application, which is what keeps it off a level it says nothing about', () => {
    expect(isApplicationLine(flow('a', 'orders', 'somebody-elses'), held)).toBe(true)
    expect(isContainerLine(flow('a', 'orders', 'somebody-elses'), held)).toBe(false)
  })

  it('is only ever about a flow', () => {
    expect(isContainerLine({ type: 'uses', sourceId: 'wms-api', targetId: 'kafka' }, held)).toBe(false)
    expect(isApplicationLine({ type: 'uses', sourceId: 'wms', targetId: 'kafka' }, held)).toBe(false)
  })

  it('answers which application an end belongs to, a component by its parent', () => {
    expect(applicationOf('wms-api', held)).toBe('wms')
    expect(applicationOf('wms', held)).toBe('wms')
    expect(applicationOf('nobody', held)).toBe('nobody')
  })
})

describe('the rule a landing has to satisfy', () => {
  const landscape = flow('c16', 'orders', 'wms')

  it('holds for a line whose ends sit under the interface\'s, each under its own', () => {
    expect(refinementRefusal(flow('r1', 'orders', 'wms-api'), landscape, held)).toBeUndefined()
    expect(refinementRefusal(flow('r2', 'orders-ui', 'wms-api'), landscape, held)).toBeUndefined()
    // Both ends the same as the interface's is the degenerate case and holds:
    // a landing that has not been moved off the boundary yet.
    expect(refinementRefusal(flow('r3', 'orders', 'wms'), landscape, held)).toBeUndefined()
  })

  it('refuses the same two containers the other way round', () => {
    expect(refinementRefusal(flow('r1', 'wms-api', 'orders'), landscape, held)).toBe('ends')
  })

  it('refuses a component of an application the interface does not name', () => {
    expect(refinementRefusal(flow('r1', 'orders', 'orders-ui'), landscape, held)).toBe('ends')
    expect(refinementRefusal(flow('r1', 'billing', 'wms-api'), landscape, held)).toBe('ends')
  })

  it('refuses a chain: what it names is itself part of something', () => {
    const landed = { ...landscape, refines: 'c1' }
    expect(refinementRefusal(flow('r1', 'orders', 'wms-api'), landed, held)).toBe('level')
  })
})

describe('what the landings add up to', () => {
  const relations = [
    flow('c16', 'orders', 'wms', { label: 'requests picking' }),
    flow('r1', 'orders', 'wms-api', { refines: 'c16', protocol: 'REST' }),
    flow('r2', 'orders', 'wms-events', { refines: 'c16', protocol: 'AMQP' }),
    flow('r3', 'orders', 'wms-db', { refines: 'c16', protocol: 'REST' }),
    flow('x1', 'billing', 'wms-api'),
  ]

  it('names the lines that landed on an interface, in order, and says whether any did', () => {
    expect(refinementsOf(relations, 'c16').map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
    expect(hasRefinements(relations, 'c16')).toBe(true)
    expect(hasRefinements(relations, 'x1')).toBe(false)
  })

  it('collects the protocols the landings carry, in order and without repeats', () => {
    expect(protocolsOf(relations, 'c16')).toEqual(['REST', 'AMQP'])
    expect(protocolsOf(relations, 'x1')).toEqual([])
  })

  it('lists the containers an interface could land on', () => {
    expect(landingPlaces(elements, 'wms').map((e) => e.id)).toEqual(['wms-api', 'wms-events', 'wms-db'])
    expect(landingPlaces(elements, 'billing')).toEqual([])
  })
})
