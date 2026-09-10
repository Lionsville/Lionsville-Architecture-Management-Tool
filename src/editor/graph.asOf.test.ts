/**
 * The board on a day (ADR-0009).
 *
 * The projection is where time reaches the canvas: a card draws the phase it is
 * in on the day the diagram shows, and a line with a window of its own is drawn
 * only inside it. Both are pure, so the hybrid phase this whole record exists
 * for can be checked without a browser: old system live, new one planned, a
 * sync between them, and three dates that tell three different stories about
 * the same single model.
 */
import { describe, expect, it } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { placedNodes } from '../model/placement';
import { buildEdges, buildNodes } from './graph'
import type { BuildGraphArgs } from './graph'
import type { DesignDiagram, DesignElement, DesignModel, Relation } from '../model/types'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live',
    isManaged: true, aspects: {}, ...over,
  }
}

function connection(id: string, sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation {
  return { id, type: 'flow', sourceId, targetId, isBidirectional: false, ...over }
}

/** The hybrid run: the old system retires as the new one arrives, with a sync between. */
function model(): DesignModel {
  return {
    name: 'Acme', customerName: 'Acme',
    elements: [
      element('wms-old', { lifecycleDates: { retiring: '2027-04-01', retired: '2028-01-31' } }),
      element('wms-new', { lifecycle: 'planned', lifecycleDates: { live: '2027-04-01' } }),
      element('billing'),
    ],
    relations: [
      connection('c#sync', 'wms-old', 'wms-new', { validFrom: '2027-04-01', validUntil: '2028-01-31' }),
      connection('c#billing', 'billing', 'wms-old'),
    ],
    diagrams: [],
  }
}

function diagram(asOf?: string): DesignDiagram {
  return laidOut({
    id: 'l7', kind: 'layer7', name: 'Landscape', asOf,
    placements: ['wms-old', 'wms-new', 'billing'].map((id) => ({ id, x: 0, y: 0 })),
  })
}

/**
 * One model and one diagram for the whole file, reused across days.
 *
 * Not a fresh pair per call: `sameNodeData` compares the element and the
 * placement by identity — which is the optimisation the identity suite below
 * is about — so a helper that rebuilt them would report every node as changed
 * and prove nothing.
 */
const MODEL = model()
const DIAGRAM = diagram()

function args(asOfDay?: string): BuildGraphArgs {
  return { model: MODEL, diagram: DIAGRAM, readOnly: false, edgeColor: '#000', asOfDay }
}

const phaseOf = (asOfDay: string, id: string) =>
  buildNodes(args(asOfDay)).find((node) => node.id === id)?.data.phase

const edgeIds = (asOfDay?: string) => buildEdges(args(asOfDay)).map((edge) => edge.id).sort()

describe('a card draws the phase it is in on the day', () => {
  it('before the cutover: the old one is live and the new one is still planned', () => {
    expect(phaseOf('2026-09-08', 'wms-old')).toBe('live')
    expect(phaseOf('2026-09-08', 'wms-new')).toBe('planned')
  })

  it('during the hybrid run: one retiring, one live', () => {
    expect(phaseOf('2027-06-01', 'wms-old')).toBe('retiring')
    expect(phaseOf('2027-06-01', 'wms-new')).toBe('live')
  })

  it('after decommissioning: the old one is gone and the new one carries on', () => {
    // On and after the day it is gone, it is not drawn at all (ADR-0010) —
    // the day before, it is still there, retiring.
    expect(phaseOf('2028-01-30', 'wms-old')).toBe('retiring')
    expect(phaseOf('2028-06-01', 'wms-old')).toBeUndefined()
    expect(buildNodes(args('2028-06-01')).some((node) => node.id === 'wms-old')).toBe(false)
    expect(phaseOf('2028-06-01', 'wms-new')).toBe('live')
  })

  it('leaves an element that says nothing about time exactly as it was', () => {
    for (const day of ['2026-09-08', '2027-06-01', '2028-06-01']) {
      expect(phaseOf(day, 'billing'), day).toBe('live')
    }
  })
})

describe('a line is drawn inside its own window', () => {
  it('holds the sync back until the hybrid run starts', () => {
    expect(edgeIds('2026-09-08')).toEqual(['c#billing'])
  })

  it('draws it while the run is on', () => {
    expect(edgeIds('2027-06-01')).toEqual(['c#billing', 'c#sync'])
  })

  it('takes it away once the old system is decommissioned — and the old system\'s own lines with it', () => {
    // The sync closed with its window; billing's line to the old system has
    // no window, but its end is gone on that day and so is the card (ADR-0010).
    expect(edgeIds('2028-06-01')).toEqual([])
    expect(edgeIds('2028-01-30')).toEqual(['c#billing', 'c#sync'])
  })
})

describe('a board with no day at all', () => {
  it('draws every stored phase and every line, exactly as before dates existed', () => {
    // `asOfDay` absent means no time is applied. This is what lets every test
    // and every call site that is not about time carry on unchanged.
    const nodes = buildNodes(args(undefined))
    expect(nodes.find((n) => n.id === 'wms-new')?.data.phase).toBe('planned')
    expect(nodes.find((n) => n.id === 'wms-old')?.data.phase).toBe('live')
    expect(edgeIds(undefined)).toEqual(['c#billing', 'c#sync'])
  })
})

describe('identity', () => {
  it('reuses a node whose phase did not change', () => {
    // The reason `phase` is a field beside the element rather than a rewritten
    // element: the card compares the element by reference, and a fresh object
    // per derive is what ADR-0004 measured and removed.
    const first = buildNodes(args('2026-09-08'))
    const again = buildNodes(args('2026-09-08'), first)
    expect(again[0]).toBe(first[0])
    expect(again[0].data.element).toBe(first[0].data.element)
  })

  it('replaces a node whose phase did change, and only that one', () => {
    const before = buildNodes(args('2026-09-08'))
    const after = buildNodes(args('2027-06-01'), before)
    const id = (nodes: typeof before, key: string) => nodes.find((n) => n.id === key)!
    expect(id(after, 'wms-old')).not.toBe(id(before, 'wms-old'))
    expect(id(after, 'billing')).toBe(id(before, 'billing'))
  })
})

describe('the replaces mark (ADR-0010)', () => {
  const withSuccessor: DesignModel = {
    ...MODEL,
    elements: MODEL.elements.map((e) => (e.id === 'wms-old' ? { ...e, successorId: 'wms-new' } : e)),
  }
  const args = (over: Partial<BuildGraphArgs> = {}): BuildGraphArgs => ({
    model: withSuccessor, diagram: DIAGRAM, readOnly: false, edgeColor: '#888', replacesLabel: 'replaces', ...over,
  })

  it('draws a mark from an element to its successor when both are on the board', () => {
    const mark = buildEdges(args()).find((edge) => edge.id === 'replaces:wms-old:wms-new')
    expect(mark).toBeDefined()
    expect(mark).toMatchObject({ source: 'wms-old', target: 'wms-new', selectable: false, reconnectable: false })
    expect(mark?.data).toMatchObject({ label: 'replaces', lineStyle: 'dotted' })
  })

  it('draws nothing when the toggle is off, or when the successor is not on the board', () => {
    expect(buildEdges(args({ showLifecycle: false })).some((edge) => edge.id.startsWith('replaces:'))).toBe(false)
    const without = laidOut({ ...DIAGRAM, placements: placedNodes(DIAGRAM).filter((p) => p.id !== 'wms-new') })
    expect(buildEdges(args({ diagram: without })).some((edge) => edge.id.startsWith('replaces:'))).toBe(false)
  })

  it('is not a connection: nothing else in the projection changes', () => {
    const plain = buildEdges({ model: MODEL, diagram: DIAGRAM, readOnly: false, edgeColor: '#888' })
    const marked = buildEdges(args()).filter((edge) => !edge.id.startsWith('replaces:'))
    expect(marked.map((edge) => edge.id)).toEqual(plain.map((edge) => edge.id))
  })
})
