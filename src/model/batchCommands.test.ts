/**
 * The bridge has one job: land a batch exactly where `applyBatch` landed it.
 *
 * So every case here runs both — the old function on the array model, the new
 * commands on the indexed one — and compares the results. Where they
 * deliberately differ, the difference is asserted rather than allowed for; see
 * the two "improves on" cases at the bottom and the note on the bridge itself.
 */
import { describe, expect, it } from 'vitest'
import { batchToCommands } from './batchCommands'
import { applyBatch } from './hostModel'
import { fromArrays, toArrays } from './normalised'
import { apply } from './reducer'
import { transaction } from './commands'
import type { HostModel } from './fromInterchange'
import { connection, diagram, element, placement } from './testFixtures'
import type { DiagramContentBatch } from './types'

function batch(overrides: Partial<DiagramContentBatch> = {}): DiagramContentBatch {
  return {
    diagramId: 'landscape',
    elements: [],
    deletedElementIds: [],
    connections: [],
    deletedConnectionIds: [],
    placements: [],
    removedPlacementElementIds: [],
    edgeRoutes: [],
    ...overrides,
  }
}

function base(overrides: Partial<HostModel> = {}): HostModel {
  return {
    name: 'Design',
    customerName: 'ACME',
    elements: [element('a'), element('b')],
    connections: [connection('c#1', 'a', 'b')],
    diagrams: [
      diagram('landscape', {
        placements: [placement('a'), placement('b')],
        edgeRoutes: [{ connectionId: 'c#1', waypoints: [{ x: 1, y: 1 }] }],
      }),
      diagram('inside-a', { kind: 'container', applicationElementId: 'a', placements: [] }),
    ],
    ...overrides,
  }
}

/** Both roads, and where they end. */
function both(model: HostModel, content: DiagramContentBatch): { old: HostModel; commanded: HostModel } {
  const indexed = fromArrays(model)
  const result = apply(indexed, transaction(batchToCommands(content, indexed)))
  if (!result.ok) throw new Error(`refused: ${result.reason}`)
  return { old: applyBatch(model, content), commanded: toArrays(result.model) }
}

/**
 * `applyBatch` walked every diagram in the model on every change and rebuilt it,
 * which stamped `edgeRoutes: []` onto each one that had none. The commands walk
 * only what they name, so an empty routes list is simply absent — the shape a
 * hand-written file has. That difference is everywhere, so it is taken out here
 * and asserted once, on its own, below.
 */
function withoutEmptyRoutes(model: HostModel): HostModel {
  return {
    ...model,
    diagrams: model.diagrams.map((d) => {
      if (d.edgeRoutes?.length !== 0) return d
      const out = { ...d }
      delete out.edgeRoutes
      return out
    }),
  }
}

function agrees(model: HostModel, content: DiagramContentBatch): HostModel {
  const { old, commanded } = both(model, content)
  expect(commanded).toStrictEqual(withoutEmptyRoutes(old))
  return commanded
}

describe('batchToCommands lands a batch where applyBatch landed it', () => {
  it('does nothing with an empty batch', () => {
    agrees(base(), batch({ placements: [placement('a'), placement('b')] }))
  })

  it('adds an element and its placement', () => {
    const after = agrees(base(), batch({
      elements: [element('c')],
      placements: [placement('a'), placement('b'), placement('c', { x: 30 })],
    }))
    expect(after.elements.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('adds a connection and its route', () => {
    agrees(base(), batch({
      connections: [connection('c#2', 'b', 'a')],
      edgeRoutes: [{ connectionId: 'c#2', waypoints: [{ x: 5, y: 5 }] }],
      placements: [placement('a'), placement('b')],
    }))
  })

  it('moves what is placed', () => {
    agrees(base(), batch({ placements: [placement('a', { x: 99 }), placement('b')] }))
  })

  it('takes a placement off the diagram without deleting the element', () => {
    agrees(base(), batch({ placements: [placement('a')], removedPlacementElementIds: ['b'] }))
  })

  it('deletes an element, its connections, its placements and its container view', () => {
    const after = agrees(base(), batch({ deletedElementIds: ['a'], placements: [placement('b')] }))
    expect(after.diagrams.map((d) => d.id)).toEqual(['landscape'])
    expect(after.connections).toEqual([])
  })

  it('deletes a connection and its route', () => {
    agrees(base(), batch({
      deletedConnectionIds: ['c#1'],
      placements: [placement('a'), placement('b')],
    }))
  })

  it('drops a route row that carries nothing', () => {
    agrees(base(), batch({
      edgeRoutes: [{ connectionId: 'c#1', waypoints: [] }],
      placements: [placement('a'), placement('b')],
    }))
  })

  it('keeps a pinned route that carries nothing else', () => {
    agrees(base(), batch({
      edgeRoutes: [{ connectionId: 'c#1', waypoints: [], pinned: true }],
      placements: [placement('a'), placement('b')],
    }))
  })

  it('upserts the layout config and the auto-route toggle', () => {
    agrees(base(), batch({
      placements: [placement('a'), placement('b')],
      layoutConfig: { zones: { actors: { size: 140 } } },
      autoRoute: true,
    }))
  })

  it('ignores a batch that names an element it also deletes', () => {
    agrees(base(), batch({
      elements: [element('a', { name: 'Renamed' })],
      deletedElementIds: ['a'],
      placements: [placement('b')],
    }))
  })

  it('ignores a connection whose endpoint is going away in the same batch', () => {
    agrees(base(), batch({
      connections: [connection('c#2', 'a', 'b')],
      deletedElementIds: ['a'],
      placements: [placement('b')],
    }))
  })

  it('ignores a placement for an element the batch does not bring', () => {
    agrees(base(), batch({ placements: [placement('a'), placement('b'), placement('ghost')] }))
  })

  it('lands a batch aimed at a diagram that is not there', () => {
    agrees(base(), batch({ diagramId: 'nope', elements: [element('c')] }))
  })
})

/**
 * Where the commands are deliberately better than the batch. Both were dropped
 * on the floor by the array model; neither is a behaviour anybody asked for.
 */
describe('batchToCommands improves on applyBatch', () => {
  it('leaves an edited element where it is in the file', () => {
    const { old, commanded } = both(base(), batch({
      elements: [element('a', { name: 'Renamed' })],
      placements: [placement('a'), placement('b')],
    }))
    expect(old.elements.map((e) => e.id)).toEqual(['b', 'a'])
    expect(commanded.elements.map((e) => e.id)).toEqual(['a', 'b'])
    expect(commanded.elements[0].name).toBe('Renamed')
  })

  it('leaves a diagram it did not name untouched, empty routes list and all', () => {
    const { old, commanded } = both(base(), batch({ placements: [placement('a'), placement('b')] }))
    expect(old.diagrams[1].edgeRoutes).toEqual([])
    expect('edgeRoutes' in commanded.diagrams[1]).toBe(false)
  })

  it('does not store a route for a connection the model does not hold', () => {
    const { old, commanded } = both(base(), batch({
      edgeRoutes: [{ connectionId: 'c#404', waypoints: [{ x: 1, y: 1 }] }],
      placements: [placement('a'), placement('b')],
    }))
    expect(old.diagrams[0].edgeRoutes?.map((r) => r.connectionId)).toEqual(['c#1', 'c#404'])
    expect(commanded.diagrams[0].edgeRoutes?.map((r) => r.connectionId)).toEqual(['c#1'])
  })
})

describe('the batch is one undo step', () => {
  it('reverses whole, back to the model it was applied to', () => {
    const model = fromArrays(base())
    const content = batch({
      elements: [element('c')],
      deletedConnectionIds: ['c#1'],
      placements: [placement('a'), placement('b'), placement('c')],
      layoutConfig: { zones: { actors: { size: 140 } } },
    })
    const step = apply(model, transaction(batchToCommands(content, model)))
    if (!step.ok) throw new Error(step.reason)
    const back = apply(step.model, step.inverse)
    if (!back.ok) throw new Error(back.reason)
    expect(back.model).toStrictEqual(model)
  })
})
