/**
 * The layout report, against a board with the faults planted: two cards on
 * top of each other, a line through a third, a card filed in one band and
 * drawn in another, a group member outside its group, one off the board, and
 * one nothing connects to. Each has to be found, and nothing else reported.
 */
import { describe, expect, it } from 'vitest'
import type { HostModel } from '../model/fromInterchange'
import { fromArrays } from '../model/normalised'
import { NODE_SIZES } from '../model/placement'
import { boundsOf, inspect } from './inspect'

const app = (id: string, name = id) => ({
  id, kind: 'application' as const, name, lifecycle: 'live' as const, isManaged: true, aspects: {},
})

// The default board is 1680x1040; actors band 140 high, management 120,
// the side bands 220 wide (`model/zones.ts`). The landscape band runs from
// x=220 to x=1460 and y=140 to y=920.
const host: HostModel = {
  name: 'Board',
  customerName: 'Acme',
  elements: [
    app('a'), app('b'), app('c'), app('d'), app('e'), app('f'), app('g'),
    { ...app('who', 'Clerk'), kind: 'actor' },
  ],
  relations: [
    // a → c runs level through d, which sits between them.
    { type: 'flow', id: 'ac', sourceId: 'a', targetId: 'c', isBidirectional: false },
    { type: 'flow', id: 'ab', sourceId: 'a', targetId: 'b', isBidirectional: false },
    { type: 'flow', id: 'ef', sourceId: 'e', targetId: 'f', isBidirectional: false },
  ],
  diagrams: [{
    id: 'l7', kind: 'layer7', name: 'Landscape',
    layoutConfig: { domainGroups: [{ name: 'Finance', x: 240, y: 160, width: 500, height: 300 }] },
    placements: [
      { elementId: 'a', zone: 'landscape', domainGroup: 'Finance', x: 260, y: 200 },
      // b overlaps a: the full width, and thirty high.
      { elementId: 'b', zone: 'landscape', domainGroup: 'Finance', x: 260, y: 300 },
      // d sits on the level line from a's centre to c's centre.
      { elementId: 'd', zone: 'landscape', x: 700, y: 200 },
      { elementId: 'c', zone: 'landscape', x: 1100, y: 200 },
      // e says landscape and is drawn in the actors band.
      { elementId: 'e', zone: 'landscape', x: 1300, y: 20 },
      // f is filed under Finance and drawn outside its box.
      { elementId: 'f', zone: 'landscape', domainGroup: 'Finance', x: 1200, y: 800 },
      // g is off the board, and connected to nothing.
      { elementId: 'g', zone: 'landscape', x: 1700, y: 500 },
      { elementId: 'who', zone: 'actors', x: 20, y: 20 },
    ],
  }],
}

const model = fromArrays(host)
const report = inspect(model, model.diagrams['l7'])

describe('inspect', () => {
  it('counts what is drawn, and boxes it', () => {
    expect(report.drawn).toEqual({ elements: 8, connections: 3 })
    expect(report.canvas).toEqual({ x: 0, y: 0, width: 1680, height: 1040 })
    expect(report.bounds).toMatchObject({ x: 20, y: 20 })
    expect(report.routes).toEqual({ stored: 0, floating: 3 })
  })

  it('says where every band and every group box is, with the group’s members', () => {
    expect(report.bands?.map((band) => band.zone)).toEqual(['actors', 'inputChannels', 'externalSystems', 'landscape', 'management'])
    expect(report.bands?.find((band) => band.zone === 'actors')?.rect).toMatchObject({ x: 0, y: 0 })
    expect(report.groups).toEqual([{ name: 'Finance', rect: { x: 240, y: 160, width: 500, height: 300 }, members: ['a', 'b', 'f'] }])
  })

  it('finds the two cards on top of each other, and says by how much', () => {
    expect(report.overlaps).toEqual({
      total: 1, some: [{ a: 'a', b: 'b', width: NODE_SIZES.application.width, height: 30 }],
    })
  })

  it('finds the line that cuts through a card that is not one of its ends', () => {
    expect(report.crossings).toEqual({ total: 1, some: [{ connectionId: 'ac', elementId: 'd' }] })
  })

  it('finds the cards drawn in another band than they are filed in', () => {
    // The card off the board counts too: its centre clamps into the side band.
    expect(report.outsideZone).toEqual({ total: 2, some: [
      { elementId: 'e', zone: 'landscape', actually: 'actors' },
      { elementId: 'g', zone: 'landscape', actually: 'externalSystems' },
    ] })
  })

  it('finds the group member outside its group', () => {
    expect(report.outsideGroup).toEqual({ total: 1, some: [{ elementId: 'f', domainGroup: 'Finance', actually: undefined }] })
  })

  it('finds the card off the board, and the ones nothing connects to', () => {
    expect(report.offCanvas).toEqual({ total: 1, some: ['g'] })
    expect(report.orphans).toEqual({ total: 3, some: ['d', 'g', 'who'] })
  })

  it('says how full each band is', () => {
    const landscape = report.density!.find((row) => row.zone === 'landscape')!
    expect(landscape.elements).toBe(7)
    expect(landscape.fill).toBeGreaterThan(0)
    expect(landscape.fill).toBeLessThan(1)
    expect(report.density!.find((row) => row.zone === 'management')).toEqual({ zone: 'management', elements: 0, fill: 0 })
  })

  it('lists at most the limit, and keeps the whole count', () => {
    const small = inspect(model, model.diagrams['l7'], 1)
    expect(small.orphans).toEqual({ total: 3, some: ['d'] })
  })

  it('grades a stored route as drawn, not as the straight line', () => {
    // A route for a → c that dips under d instead of running through it.
    const routed = fromArrays({
      ...host,
      diagrams: [{
        ...host.diagrams[0],
        edgeRoutes: [{
          relationId: 'ac',
          waypoints: [{ x: 600, y: 265 }, { x: 600, y: 450 }, { x: 1000, y: 450 }, { x: 1000, y: 265 }],
        }],
      }],
    })
    const held = inspect(routed, routed.diagrams['l7'])
    expect(held.crossings.total).toBe(0)
    expect(held.routes).toEqual({ stored: 1, floating: 2 })
  })

  it('has nothing to say about a container view’s bands', () => {
    const container = fromArrays({
      ...host,
      diagrams: [{ id: 'cd', kind: 'container', name: 'Inside a', applicationElementId: 'a', placements: [{ elementId: 'a', x: 0, y: 0 }] }],
    })
    const held = inspect(container, container.diagrams['cd'])
    expect(held.density).toBeUndefined()
    expect(held.canvas).toBeUndefined()
    expect(held.outsideZone.total).toBe(0)
  })
})

describe('boundsOf', () => {
  it('boxes the named placements with their canonical sizes, and ignores what is not drawn', () => {
    expect(boundsOf(model, model.diagrams['l7'], ['a', 'ghost'])).toEqual({ x: 260, y: 200, width: 200, height: 130 })
    expect(boundsOf(model, model.diagrams['l7'], ['ghost'])).toBeUndefined()
  })
})
