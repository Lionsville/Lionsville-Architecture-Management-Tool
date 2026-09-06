import { describe, expect, it } from 'vitest'
import {
  connectionList, decisionList, decisionsOf, diagramList, elementList, fromArrays,
  placementList, routeList, routesOf, toArrays,
} from './normalised'
import type { Model } from './normalised'
import type { HostModel } from './fromInterchange'
import { connection, diagram, element, placement } from './testFixtures'
import type { Adr } from './adr'

function adr(id: string, number: number, overrides: Partial<Adr> = {}): Adr {
  return {
    id, number, title: `Decision ${number}`, status: 'proposed',
    date: '2026-09-06', body: '', signers: [], ...overrides,
  }
}

function host(overrides: Partial<HostModel> = {}): HostModel {
  return {
    name: 'Design', customerName: 'ACME', elements: [], connections: [], diagrams: [],
    ...overrides,
  }
}

describe('fromArrays / toArrays', () => {
  it('indexes the four lists by id and remembers the order', () => {
    const m = fromArrays(host({
      elements: [element('b'), element('a')],
      connections: [connection('c#2', 'b', 'a'), connection('c#1', 'a', 'b')],
      diagrams: [diagram('two'), diagram('one')],
      decisions: [adr('d2', 2), adr('d1', 1)],
    }))

    expect(m.elements.a.id).toBe('a')
    expect(m.order.elements).toEqual(['b', 'a'])
    expect(m.order.connections).toEqual(['c#2', 'c#1'])
    expect(m.order.diagrams).toEqual(['two', 'one'])
    expect(m.order.decisions).toEqual(['d2', 'd1'])
    expect(elementList(m).map((e) => e.id)).toEqual(['b', 'a'])
    expect(connectionList(m).map((c) => c.id)).toEqual(['c#2', 'c#1'])
    expect(diagramList(m).map((d) => d.id)).toEqual(['two', 'one'])
    expect(decisionList(m).map((d) => d.id)).toEqual(['d2', 'd1'])
  })

  it('indexes a diagram’s placements and routes the same way', () => {
    const m = fromArrays(host({
      diagrams: [diagram('one', {
        placements: [placement('b', { x: 1 }), placement('a')],
        edgeRoutes: [{ connectionId: 'c#1', waypoints: [{ x: 1, y: 2 }] }],
      })],
    }))
    const d = m.diagrams.one

    expect(d.placements.b.x).toBe(1)
    expect(d.order.placements).toEqual(['b', 'a'])
    expect(placementList(d).map((p) => p.elementId)).toEqual(['b', 'a'])
    expect(routesOf(d)['c#1'].waypoints).toHaveLength(1)
    expect(routeList(d).map((r) => r.connectionId)).toEqual(['c#1'])
  })

  /**
   * The reason order is carried and not left to the record: `Object.keys` puts
   * integer-like keys first, and an element key is a slug of the element's name.
   */
  it('keeps a numeric id where the file put it', () => {
    const m = fromArrays(host({ elements: [element('alpha'), element('2024'), element('beta')] }))

    expect(Object.keys(m.elements)).toEqual(['2024', 'alpha', 'beta'])
    expect(m.order.elements).toEqual(['alpha', '2024', 'beta'])
    expect(toArrays(m).elements.map((e) => e.id)).toEqual(['alpha', '2024', 'beta'])
  })

  it('tells an absent list from an empty one, both ways', () => {
    const absent = fromArrays(host({ diagrams: [diagram('one')] }))
    expect(absent.decisions).toBeUndefined()
    expect(absent.diagrams.one.edgeRoutes).toBeUndefined()
    expect('decisions' in toArrays(absent)).toBe(false)
    expect('edgeRoutes' in toArrays(absent).diagrams[0]).toBe(false)

    const empty = fromArrays(host({ decisions: [], diagrams: [diagram('one', { edgeRoutes: [] })] }))
    expect(empty.decisions).toEqual({})
    expect(empty.diagrams.one.edgeRoutes).toEqual({})
    expect(toArrays(empty).decisions).toEqual([])
    expect(toArrays(empty).diagrams[0].edgeRoutes).toEqual([])
  })

  it('reads an absent list through the helpers without a default at each site', () => {
    const m = fromArrays(host({ diagrams: [diagram('one')] }))
    expect(decisionsOf(m)).toEqual({})
    expect(routesOf(m.diagrams.one)).toEqual({})
    expect(decisionList(m)).toEqual([])
    expect(routeList(m.diagrams.one)).toEqual([])
  })

  it('collapses a repeated id onto the last row rather than carrying it', () => {
    const m = fromArrays(host({
      elements: [element('a', { name: 'first' }), element('a', { name: 'second' })],
    }))
    expect(m.order.elements).toEqual(['a'])
    expect(toArrays(m).elements.map((e) => e.name)).toEqual(['second'])
  })

  it('carries the extras the interchange document needs handed back', () => {
    const extras = host({
      description: 'A landscape',
      defaultAuthor: 'W. Simons',
      formatVersion: 'solution-design/v1',
      adrLinks: [{ key: 'x' }],
      explicitFields: { a: { lifecycle: true } },
    })
    expect(toArrays(fromArrays(extras))).toEqual(extras)
  })

  /**
   * The whole point of the boundary: opening a file and writing it out again
   * has to produce the same bytes, key order included, or every save after this
   * phase is a diff nobody asked for.
   */
  it('round-trips a full model byte for byte', () => {
    const before = host({
      description: 'A landscape',
      elements: [element('a'), element('b', { parentApplicationId: 'a' })],
      connections: [connection('c#1', 'a', 'b')],
      decisions: [adr('d1', 1)],
      diagrams: [
        diagram('one', {
          aspectConfig: [{ key: 'dr', label: 'Disaster recovery' }],
          placements: [placement('a', { zone: 'landscape' }), placement('b')],
          edgeRoutes: [{ connectionId: 'c#1', waypoints: [], pinned: true }],
          layoutConfig: { zones: { actors: { size: 120 } } },
        }),
        diagram('two', { kind: 'container', applicationElementId: 'a' }),
      ],
    })

    expect(JSON.stringify(toArrays(fromArrays(before)))).toBe(JSON.stringify(before))
  })

  it('leaves the rows themselves alone — the same objects come back out', () => {
    const el = element('a')
    const m = fromArrays(host({ elements: [el] }))
    expect(m.elements.a).toBe(el)
    expect(toArrays(m).elements[0]).toBe(el)
  })

  it('is total over a model whose optional lists are missing entirely', () => {
    const bare = { name: 'D', customerName: 'C' } as unknown as HostModel
    const m: Model = fromArrays(bare)
    expect(m.order).toEqual({ elements: [], connections: [], diagrams: [], decisions: [] })
    expect(toArrays(m).elements).toEqual([])
  })
})
