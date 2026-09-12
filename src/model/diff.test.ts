/**
 * What changed, in the landscape's own terms.
 *
 * The test that matters most is the tidy pass: it must not read like forty
 * decisions. The membership block beside it is the other half of the same
 * point (ADR-0012 §6) — what came onto a board is news and gets a sentence,
 * where it ended up is not and gets a number. Everything else here is the
 * arithmetic that makes those two sentences possible.
 */
import { describe, expect, it } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { countChanges, diffModels, isUnchanged } from './diff'
import type { HostModel } from './fromInterchange'
import type { DesignElement } from './types'

const element = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement =>
  ({ id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, ...over })

function model(over: Partial<HostModel> = {}): HostModel {
  return {
    name: 'Landscape',
    elements: [element('crews', 'Crews'), element('reisinfo', 'Reisinformatie')],
    relations: [{ type: 'flow', id: 'c-1', sourceId: 'crews', targetId: 'reisinfo', isBidirectional: false }],
    diagrams: [laidOut({
      id: 'l7', kind: 'layer7', name: 'Landschap',
      placements: [{ id: 'crews', x: 0, y: 0 }, { id: 'reisinfo', x: 100, y: 0 }],
    })],
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
    const after = model({ relations: [] })
    expect(diffModels(model(), after)).toEqual([
      { kind: 'removed', what: 'relation', id: 'c-1', name: 'Crews → Reisinformatie', relationType: 'flow' },
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
      diagrams: [laidOut({
        id: 'l7', kind: 'layer7', name: 'Landschap',
        placements: [{ id: 'crews', x: 40, y: 40 }, { id: 'reisinfo', x: 240, y: 40 }],
      })],
    })
    expect(diffModels(model(), tidied)).toEqual([
      { kind: 'changed', what: 'geometry', id: 'l7', name: 'Landschap', count: 2 },
    ])
  })

  it('does not call a renamed diagram a geometry change', () => {
    const renamed = model({ diagrams: [{ ...model().diagrams[0], name: 'Landscape' }] })
    expect(diffModels(model(), renamed)).toEqual([
      { kind: 'changed', what: 'diagram', id: 'l7', name: 'Landscape', fields: ['name'] },
    ])
  })

  it('names what left a board, and which board', () => {
    // The element is still in the landscape: it was taken off this view, which
    // is a decision somebody made and the reason membership is not a count.
    const after = model({
      diagrams: [laidOut({
        id: 'l7', kind: 'layer7', name: 'Landschap',
        placements: [{ id: 'crews', x: 0, y: 0 }],
      })],
    })
    expect(diffModels(model(), after)).toEqual([
      { kind: 'removed', what: 'membership', id: 'reisinfo', name: 'Reisinformatie', on: 'Landschap', onId: 'l7' },
    ])
  })

  it('names what came onto one, and does not also count it as a move', () => {
    const before = model({
      diagrams: [laidOut({
        id: 'l7', kind: 'layer7', name: 'Landschap',
        placements: [{ id: 'crews', x: 0, y: 0 }],
      })],
    })
    expect(diffModels(before, model())).toEqual([
      { kind: 'added', what: 'membership', id: 'reisinfo', name: 'Reisinformatie', on: 'Landschap', onId: 'l7' },
    ])
  })

  it('calls filing a card in another band a membership change, not a move', () => {
    const after = model({
      diagrams: [laidOut({
        id: 'l7', kind: 'layer7', name: 'Landschap',
        placements: [{ id: 'crews', x: 0, y: 0, zone: 'management' }, { id: 'reisinfo', x: 100, y: 0 }],
      })],
    })
    expect(diffModels(model(), after)).toEqual([
      { kind: 'changed', what: 'membership', id: 'crews', name: 'Crews', on: 'Landschap', onId: 'l7' },
    ])
  })

  it('says nothing per board about an application that left the landscape', () => {
    // Deleting one application would otherwise be one row plus a row per view
    // it happened to be drawn on, which says the same thing five times.
    const after = model({
      elements: [element('crews', 'Crews')],
      diagrams: [laidOut({
        id: 'l7', kind: 'layer7', name: 'Landschap',
        placements: [{ id: 'crews', x: 0, y: 0 }],
      })],
    })
    expect(diffModels(model(), after)).toEqual([
      { kind: 'removed', what: 'element', id: 'reisinfo', name: 'Reisinformatie' },
    ])
  })

  it('reports a dashed group renamed as one line in the definition', () => {
    const named = (name: string) => model({
      diagrams: [laidOut({
        id: 'l7', kind: 'layer7', name: 'Landschap',
        groups: [{ id: 'g1', name }],
        placements: [{ id: 'crews', x: 0, y: 0, group: 'g1' }, { id: 'reisinfo', x: 100, y: 0 }],
      })],
    })
    expect(diffModels(named('Finance'), named('Ledger'))).toEqual([
      { kind: 'changed', what: 'diagram', id: 'l7', name: 'Landschap', fields: ['groups'] },
    ])
  })

  it('counts a group box dragged wider, and the board resized, as moves', () => {
    const boxed = (width: number) => model({
      diagrams: [laidOut({
        id: 'l7', kind: 'layer7', name: 'Landschap',
        placements: [{ id: 'crews', x: 0, y: 0 }, { id: 'reisinfo', x: 100, y: 0 }],
        layoutConfig: {
          canvas: { width, height: 600 },
          domainGroups: [{ id: 'g1', x: 0, y: 0, width, height: 200 }],
        },
      })],
    })
    expect(diffModels(boxed(300), boxed(400))).toEqual([
      { kind: 'changed', what: 'geometry', id: 'l7', name: 'Landschap', count: 2 },
    ])
  })

  it('reads in one order however the models were built', () => {
    const after = model({
      elements: [element('crews', 'Crews'), element('planning', 'Planning')],
      relations: [],
      diagrams: [{ ...model().diagrams[0], name: 'Board' }],
    })
    expect(diffModels(model(), after).map((change) => change.what))
      .toEqual(['element', 'element', 'relation', 'diagram'])
  })
})

describe('countChanges', () => {
  it('counts the geometry apart from everything else', () => {
    // "12 changes" reading as twelve decisions when eleven of them are a tidy
    // pass is the misreading this whole file exists to prevent.
    const after = model({
      elements: [element('crews', 'Crews'), element('planning', 'Planning')],
      diagrams: [laidOut({
        id: 'l7', kind: 'layer7', name: 'Landschap',
        placements: [{ id: 'crews', x: 9, y: 9 }],
      })],
    })
    // Two rows differ in the placement file — one moved, one gone — but only
    // the move is geometry now: the departure is the element's own removal.
    expect(countChanges(diffModels(model(), after)))
      .toEqual({ added: 1, removed: 1, changed: 0, moved: 1 })
  })
})
