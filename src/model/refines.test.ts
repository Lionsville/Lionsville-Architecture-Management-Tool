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
  applicationOf, hasRefinements, isApplicationLine, isContainerLine, landingGesture,
  landingPlaces, protocolsOf, refinementRefusal, refinementsOf,
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

  it('holds either way round once the interface says it runs both ways', () => {
    // Which is the same reading `candidateInterfaces` offers, and what
    // `acceptImplied` needs to land the lines that made a pair two-way in the
    // first place: without it the inspector offers a landing the writer refuses.
    const twoWay = { ...landscape, isBidirectional: true }
    expect(refinementRefusal(flow('r1', 'orders', 'wms-api'), twoWay, held)).toBeUndefined()
    expect(refinementRefusal(flow('r2', 'wms-api', 'orders-ui'), twoWay, held)).toBeUndefined()
    // Still about the ends, not a free pass: Billing is neither of them.
    expect(refinementRefusal(flow('r3', 'billing', 'wms-api'), twoWay, held)).toBe('ends')
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


/**
 * What dropping a line's end somewhere means (ADR-0013, redone).
 *
 * Four answers, and the fourth is the one that matters most: a landing end
 * dropped somewhere meaningless is NOTHING, never a reconnect. Re-pointing the
 * functional interface at another application because a drop missed by ten
 * pixels is the worst thing this gesture could do, and it would do it in
 * silence.
 */
describe('what a drop means', () => {
  const view = { kind: 'container' as const, applicationElementId: 'wms' }
  const interfaceLine = flow('c16', 'orders', 'wms')
  const landed = flow('r1', 'orders', 'wms-api', { refines: 'c16' })

  it('lands the boundary end on one of the application\'s own containers', () => {
    expect(landingGesture(view, interfaceLine, { sourceId: 'orders', targetId: 'wms-api' }, held))
      .toEqual({ kind: 'land', interfaceId: 'c16', containerId: 'wms-api' })
  })

  it('moves a landed end to another container, and takes it off at the boundary', () => {
    expect(landingGesture(view, landed, { sourceId: 'orders', targetId: 'wms-events' }, held))
      .toEqual({ kind: 'move', containerId: 'wms-events' })
    expect(landingGesture(view, landed, { sourceId: 'orders', targetId: 'wms' }, held))
      .toEqual({ kind: 'unland' })
  })

  it('does NOTHING with a boundary end dropped anywhere else — it never re-points the interface', () => {
    // Another application, one of ITS containers, and a card that is not a
    // container at all: three ways to miss, none of them a reconnect.
    for (const target of ['billing', 'orders-ui', 'erp']) {
      expect(landingGesture(view, interfaceLine, { sourceId: 'orders', targetId: target }, held), target)
        .toEqual({ kind: 'none' })
    }
  })

  it('does nothing with a landed end dropped anywhere else either', () => {
    expect(landingGesture(view, landed, { sourceId: 'orders', targetId: 'billing' }, held))
      .toEqual({ kind: 'none' })
  })

  it('leaves a line that touches neither the boundary nor a landing to an ordinary reconnect', () => {
    const inside = flow('x1', 'wms-api', 'wms-events')
    expect(landingGesture(view, inside, { sourceId: 'wms-api', targetId: 'wms-db' }, held))
      .toEqual({ kind: 'reconnect' })
  })

  it('says nothing at all on a view that is not a container diagram, or about a row that is not a line', () => {
    expect(landingGesture({ kind: 'layer7' }, interfaceLine, { sourceId: 'orders', targetId: 'wms-api' }, held))
      .toEqual({ kind: 'reconnect' })
    const row = { id: 'u1', type: 'uses' as const, sourceId: 'wms', targetId: 'kafka' }
    expect(landingGesture(view, row, { sourceId: 'wms-api', targetId: 'kafka' }, held))
      .toEqual({ kind: 'reconnect' })
  })
})
