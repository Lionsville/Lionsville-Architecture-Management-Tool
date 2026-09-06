/**
 * What changed, in the landscape's own terms.
 *
 * The test that matters most is the last one: a tidy pass must not read like
 * forty decisions. Everything else here is the arithmetic that makes that
 * sentence possible.
 */
import { describe, expect, it } from 'vitest'
import { countChanges, diffModels, isUnchanged } from './diff'
import type { HostModel } from './fromInterchange'
import type { DesignElement } from './types'

const element = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement =>
  ({ id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, parameters: {}, ...over })

function model(over: Partial<HostModel> = {}): HostModel {
  return {
    name: 'Landscape',
    customerName: 'Acme',
    elements: [element('crews', 'Crews'), element('reisinfo', 'Reisinformatie')],
    connections: [{ id: 'c-1', sourceId: 'crews', targetId: 'reisinfo', isBidirectional: false }],
    diagrams: [{
      id: 'l7', kind: 'layer7', name: 'Landschap',
      placements: [{ elementId: 'crews', x: 0, y: 0 }, { elementId: 'reisinfo', x: 100, y: 0 }],
    }],
    ...over,
  }
}

describe('diffModels', () => {
  it('says nothing about two models that are the same', () => {
    expect(isUnchanged(diffModels(model(), model()))).toBe(true)
  })

  it('names an application that arrived and one that went', () => {
    const after = model({ elements: [element('crews', 'Crews'), element('planning', 'Planning')] })
    expect(diffModels(model(), after)).toEqual([
      { kind: 'added', what: 'element', id: 'planning', name: 'Planning' },
      // Nameable only from the version it was removed from, which is the whole
      // reason the diff carries a name at all.
      { kind: 'removed', what: 'element', id: 'reisinfo', name: 'Reisinformatie' },
    ])
  })

  it('says which fields of an application changed', () => {
    const after = model({
      elements: [element('crews', 'Crew planning', { vendor: 'Acme' }), element('reisinfo', 'Reisinformatie')],
    })
    expect(diffModels(model(), after)[0]).toEqual({
      kind: 'changed', what: 'element', id: 'crews', name: 'Crew planning',
      fields: ['name', 'vendor'],
    })
  })

  it('names a connection by its ends when it has no label', () => {
    const after = model({ connections: [] })
    expect(diffModels(model(), after)).toEqual([
      { kind: 'removed', what: 'connection', id: 'c-1', name: 'Crews → Reisinformatie' },
    ])
  })

  it('reports a decision by its title', () => {
    const after = model({
      decisions: [{
        id: 'a1', number: 1, title: 'One writer', status: 'accepted',
        date: '2026-09-06', body: '', signers: [],
      }],
    })
    expect(diffModels(model(), after)).toEqual([
      { kind: 'added', what: 'decision', id: 'a1', name: 'One writer' },
    ])
  })

  it('sees a decision that was accepted', () => {
    const proposed = model({
      decisions: [{
        id: 'a1', number: 1, title: 'One writer', status: 'proposed',
        date: '2026-09-06', body: '', signers: [],
      }],
    })
    const accepted = model({
      decisions: [{
        id: 'a1', number: 1, title: 'One writer', status: 'accepted',
        date: '2026-09-07', body: '', signers: [],
      }],
    })
    expect(diffModels(proposed, accepted)[0]).toMatchObject({
      kind: 'changed', what: 'decision', name: 'One writer', fields: ['date', 'status'],
    })
  })

  it('reports a whole tidy pass as one line and a number', () => {
    // The point of the file. Forty rows saying "moved" is not information; it
    // is why people stop reading a change list.
    const tidied = model({
      diagrams: [{
        id: 'l7', kind: 'layer7', name: 'Landschap',
        placements: [{ elementId: 'crews', x: 40, y: 40 }, { elementId: 'reisinfo', x: 240, y: 40 }],
      }],
    })
    expect(diffModels(model(), tidied)).toEqual([
      { kind: 'changed', what: 'placement', id: 'l7', name: 'Landschap', count: 2 },
    ])
  })

  it('does not call a renamed diagram a geometry change', () => {
    const renamed = model({ diagrams: [{ ...model().diagrams[0], name: 'Landscape' }] })
    expect(diffModels(model(), renamed)).toEqual([
      { kind: 'changed', what: 'diagram', id: 'l7', name: 'Landscape', fields: ['name'] },
    ])
  })

  it('reads in one order however the models were built', () => {
    const after = model({
      elements: [element('crews', 'Crews'), element('planning', 'Planning')],
      connections: [],
      diagrams: [{ ...model().diagrams[0], name: 'Board' }],
    })
    expect(diffModels(model(), after).map((change) => change.what))
      .toEqual(['element', 'element', 'connection', 'diagram'])
  })
})

describe('countChanges', () => {
  it('counts the geometry apart from everything else', () => {
    // "12 changes" reading as twelve decisions when eleven of them are a tidy
    // pass is the misreading this whole file exists to prevent.
    const after = model({
      elements: [element('crews', 'Crews'), element('planning', 'Planning')],
      diagrams: [{
        id: 'l7', kind: 'layer7', name: 'Landschap',
        placements: [{ elementId: 'crews', x: 9, y: 9 }],
      }],
    })
    expect(countChanges(diffModels(model(), after)))
      .toEqual({ added: 1, removed: 1, changed: 0, moved: 2 })
  })
})
