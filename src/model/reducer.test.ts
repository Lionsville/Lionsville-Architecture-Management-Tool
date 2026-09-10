/**
 * The reducer is the only writer, so this is where the model's rules are pinned.
 *
 * The three properties ADR-0002 leans on get their own sections: a command
 * touches the path it names (identity), every command has an exact inverse
 * (reversibility), and a transaction that refuses anywhere changes nothing
 * (atomicity). The last suite is the one the phase's exit criterion names — a
 * mixed run of twenty commands, undone to the start and redone to the end, with
 * the model compared at every step.
 */
import { describe, expect, it } from 'vitest'
import { placeOn } from '../model/commands';
import { placedOn } from '../model/normalised';
import { apply, applyAll } from './reducer'
import type { ApplyResult } from './reducer'
import { NOTHING, transaction } from './commands'
import type { Command } from './commands'
import { fromArrays, toArrays, toDiagram } from './normalised'
import type { Model } from './normalised'
import type { HostModel } from './fromInterchange'
import { RELATION_TYPES } from './relations'
import type { Relation } from './types'
import { connection, diagram, element, placement } from './testFixtures'
import type { Adr } from './adr'
import type { EdgeRoute } from './types'

function adr(id: string, number: number, overrides: Partial<Adr> = {}): Adr {
  return {
    id, number, title: `Decision ${number}`, status: 'proposed',
    date: '2026-09-06', body: '', signers: [], ...overrides,
  }
}

function route(connectionId: string, overrides: Partial<EdgeRoute> = {}): EdgeRoute {
  return { relationId: connectionId, waypoints: [{ x: 1, y: 2 }], ...overrides }
}

/** Two applications, a line between them, on a landscape and a container view. */
function sample(overrides: Partial<HostModel> = {}): Model {
  return fromArrays({
    name: 'Design',
    customerName: 'ACME',
    elements: [element('a'), element('b'), element('c', { kind: 'component', parentApplicationId: 'a' })],
    relations: [connection('c#1', 'a', 'b'), connection('c#2', 'b', 'a')],
    diagrams: [
      diagram('landscape', {
        placements: [placement('a'), placement('b')],
        edgeRoutes: [route('c#1'), route('c#2')],
      }),
      diagram('inside-a', {
        kind: 'container',
        applicationElementId: 'a',
        placements: [placement('c')],
      }),
    ],
    ...overrides,
  })
}

function ok(result: ApplyResult): { model: Model; inverse: Command } {
  if (!result.ok) throw new Error(`refused: ${result.reason}`)
  return result
}

/** Applying a command and then its inverse leaves the model as it was found. */
function reversible(model: Model, command: Command): Model {
  const forward = ok(apply(model, command))
  const back = ok(apply(forward.model, forward.inverse))
  expect(back.model).toStrictEqual(model)
  return forward.model
}

describe('apply — elements', () => {
  it('creates, updates and deletes, each reversibly', () => {
    const m = sample()
    const created = reversible(m, { type: 'element.create', element: element('d') })
    expect(created.elements.d.id).toBe('d')
    expect(created.order.elements).toEqual(['a', 'b', 'c', 'd'])

    const updated = reversible(m, { type: 'element.update', id: 'a', patch: { name: 'Renamed' } })
    expect(updated.elements.a.name).toBe('Renamed')

    const deleted = reversible(m, { type: 'element.delete', id: 'b' })
    expect(deleted.elements.b).toBeUndefined()
  })

  it('puts a deleted element back where it was, not at the end', () => {
    const m = sample()
    const forward = ok(apply(m, { type: 'element.delete', id: 'a' }))
    expect(ok(apply(forward.model, forward.inverse)).model.order.elements).toEqual(['a', 'b', 'c'])
  })

  /**
   * A patch key holding `undefined` deletes the field, and the inverse has to
   * put an absent field back as absent — not as present and undefined, which is
   * the shape no hand-written file has.
   */
  it('clears a field and puts the absence back', () => {
    const m = sample({ elements: [element('a', { vendor: 'Acme' })], diagrams: [diagram('landscape')] })
    const cleared = ok(apply(m, { type: 'element.update', id: 'a', patch: { vendor: undefined } }))
    expect('vendor' in cleared.model.elements.a).toBe(false)

    const back = ok(apply(cleared.model, cleared.inverse)).model
    expect(back.elements.a.vendor).toBe('Acme')

    const added = ok(apply(m, { type: 'element.update', id: 'a', patch: { technology: 'Java' } }))
    expect('technology' in ok(apply(added.model, added.inverse)).model.elements.a).toBe(false)
  })

  it('takes the connections, the placements and the container view with it', () => {
    const m = sample()
    const gone = ok(apply(m, { type: 'element.delete', id: 'a' })).model

    expect(gone.order.relations).toEqual([])
    expect(gone.order.diagrams).toEqual(['landscape'])
    expect(gone.diagrams.landscape.order.members).toEqual(['b'])
    expect(gone.diagrams.landscape.edgeRoutes).toBeUndefined()
  })

  it('puts all of that back, in one step', () => {
    const m = sample()
    reversible(m, { type: 'element.delete', id: 'a' })
  })

  it('refuses to touch an element that is not there', () => {
    expect(apply(sample(), { type: 'element.update', id: 'nope', patch: {} }))
      .toEqual({ ok: false, reason: 'command.gone' })
    expect(apply(sample(), { type: 'element.delete', id: 'nope' }))
      .toEqual({ ok: false, reason: 'command.gone' })
  })
})

describe('apply — relations', () => {
  it('creates, updates and deletes, each reversibly', () => {
    const m = sample()
    reversible(m, { type: 'relation.create', relation: connection('c#3', 'a', 'c') })
    reversible(m, { type: 'relation.update', id: 'c#1', patch: { label: 'reads' } })
    reversible(m, { type: 'relation.delete', id: 'c#1' })
  })

  it('takes its geometry off every diagram, and gives it back', () => {
    const m = sample()
    const gone = ok(apply(m, { type: 'relation.delete', id: 'c#1' }))
    expect(gone.model.diagrams.landscape.order.routes).toEqual(['c#2'])
    expect(ok(apply(gone.model, gone.inverse)).model.diagrams.landscape.order.routes)
      .toEqual(['c#1', 'c#2'])
  })

  it('refuses a line to an element that is not there', () => {
    expect(apply(sample(), { type: 'relation.create', relation: connection('c#9', 'a', 'nope') }))
      .toEqual({ ok: false, reason: 'command.gone' })
  })

  /**
   * The reducer is the model's writer, and the model is what ADR-0012 §5
   * widened — not the file. Every type it can hold has to land and come back,
   * whether or not this build's file format has a place for it yet.
   */
  it.each(RELATION_TYPES)('lands a %s row and gives it back on undo, window and all', (type) => {
    const m = sample()
    const row: Relation = {
      id: `r-${type}`, type, sourceId: 'a', targetId: 'c',
      validFrom: '2027-03-01', validUntil: '2027-12-31',
    }
    const landed = ok(apply(m, { type: 'relation.create', relation: row }))
    expect(landed.model.relations[row.id]).toEqual(row)
    expect(ok(apply(landed.model, landed.inverse)).model.relations[row.id]).toBeUndefined()

    const dated = ok(apply(landed.model, { type: 'relation.update', id: row.id, patch: { validUntil: '2028-06-30' } }))
    expect(dated.model.relations[row.id].validUntil).toBe('2028-06-30')
    expect(ok(apply(dated.model, dated.inverse)).model.relations[row.id]).toEqual(row)
  })
})

describe('apply — geometry', () => {
  it('moves what is placed and adds what is not, reversibly', () => {
    const m = sample()
    const moved = reversible(m, placeOn('landscape', [
      placement('a', { x: 40 }), placement('c', { x: 10 }),
    ]))
    expect(placedOn(moved.diagrams.landscape, 'a')!.x).toBe(40)
    expect(moved.diagrams.landscape.order.members).toEqual(['a', 'b', 'c'])
  })

  it('removes placements and puts each back on its own index', () => {
    const m = sample({
      elements: [element('a'), element('b'), element('c')],
      diagrams: [diagram('landscape', {
        placements: [placement('a'), placement('b'), placement('c')],
      })],
    })
    const removed = ok(apply(m, {
      type: 'member.remove', diagramId: 'landscape', elementIds: ['a', 'c'],
    }))
    expect(removed.model.diagrams.landscape.order.members).toEqual(['b'])
    expect(ok(apply(removed.model, removed.inverse)).model.diagrams.landscape.order.members)
      .toEqual(['a', 'b', 'c'])
  })

  it('sets and clears routes, reversibly', () => {
    const m = sample()
    reversible(m, {
      type: 'route.set', diagramId: 'landscape', routes: [route('c#1', { pinned: true })],
    })
    reversible(m, { type: 'route.clear', diagramId: 'landscape', relationIds: ['c#1'] })
  })

  /** An emptied optional list loses its key — see the note on the reducer. */
  it('drops the routes key when the last route goes, and brings it back', () => {
    const m = sample()
    const cleared = ok(apply(m, {
      type: 'route.clear', diagramId: 'landscape', relationIds: ['c#1', 'c#2'],
    }))
    expect('edgeRoutes' in cleared.model.diagrams.landscape).toBe(false)
    expect(ok(apply(cleared.model, cleared.inverse)).model.diagrams.landscape.order.routes)
      .toEqual(['c#1', 'c#2'])
  })

  it('sets and clears the board, reversibly', () => {
    const m = sample()
    const laid = reversible(m, {
      type: 'board.set', diagramId: 'landscape', patch: { zones: { actors: { size: 90 } } },
    })
    expect(laid.diagrams.landscape?.zones?.actors?.size).toBe(90)
    reversible(laid, { type: 'board.set', diagramId: 'landscape', patch: { zones: undefined } })
  })

  it('refuses geometry for a diagram that is not there', () => {
    expect(apply(sample(), placeOn('nope', [])))
      .toEqual({ ok: false, reason: 'command.gone' })
  })

  it('ignores a placement for an element the model does not hold', () => {
    const result = ok(apply(sample(), placeOn('landscape', [placement('nope')])))
    expect(placedOn(result.model.diagrams.landscape, 'nope')).toBeUndefined()
    expect(result.inverse).toEqual(NOTHING)
  })
})

/**
 * A dashed group is a thing with an id (ADR-0012 §6), so what it is CALLED and
 * where its box is are two commands. These pin the half that is the definition:
 * renaming touches one row and nothing else moves.
 */
/**
 * What is on a view, and where it ended up: two questions, two commands
 * (ADR-0012 §6). What these pin is the seam — a drag writes geometry and
 * nothing else, and a card told to join a group writes membership and nothing
 * else — because that seam is what a review of the geometry file can skip.
 */
describe('apply — membership and geometry', () => {
  it('a drag writes the node and leaves the member alone', () => {
    const m = sample()
    const before = m.diagrams.landscape.members.a
    const moved = reversible(m, {
      type: 'node.set', diagramId: 'landscape', nodes: [{ id: 'a', x: 40, y: 50 }],
    })
    expect(moved.diagrams.landscape.nodes.a).toEqual({ id: 'a', x: 40, y: 50 })
    expect(moved.diagrams.landscape.members.a).toBe(before)
  })

  it('a card told to join a group writes the member and leaves the node alone', () => {
    const m = sample({
      elements: [element('a')],
      diagrams: [diagram('landscape', {
        groups: [{ id: 'core', name: 'Core' }],
        placements: [placement('a', { x: 10, y: 20 })],
      })],
    })
    const before = m.diagrams.landscape.nodes.a
    const filed = reversible(m, {
      type: 'member.set', diagramId: 'landscape', members: [{ id: 'a', group: 'core' }],
    })
    expect(filed.diagrams.landscape.members.a).toEqual({ id: 'a', group: 'core' })
    expect(filed.diagrams.landscape.nodes.a).toBe(before)
  })

  it('saying the same thing is not a change', () => {
    // A drag re-states the band a card is already in, and a routing pass
    // re-emits a row it did not touch. A fresh object would look like a change
    // to everything memoised below — and to `diff.ts`.
    const m = sample()
    expect(apply(m, {
      type: 'member.set', diagramId: 'landscape', members: [{ ...m.diagrams.landscape.members.a }],
    })).toEqual({ ok: true, model: m, inverse: NOTHING })
    expect(apply(m, {
      type: 'node.set', diagramId: 'landscape', nodes: [{ ...m.diagrams.landscape.nodes.a }],
    })).toEqual({ ok: true, model: m, inverse: NOTHING })
  })

  it('ignores a node for something that is not on the view', () => {
    // An element is on a view because a MEMBER row says so; a coordinate for
    // something that is not on it has nothing to be about.
    const m = sample()
    expect(apply(m, { type: 'node.set', diagramId: 'landscape', nodes: [{ id: 'c', x: 1, y: 2 }] }))
      .toEqual({ ok: true, model: m, inverse: NOTHING })
  })

  it('taking a member off takes its node with it, and undo brings both back', () => {
    const m = sample()
    const off = ok(apply(m, { type: 'member.remove', diagramId: 'landscape', elementIds: ['a'] }))
    expect(off.model.diagrams.landscape.members.a).toBeUndefined()
    expect(off.model.diagrams.landscape.nodes.a).toBeUndefined()
    expect(ok(apply(off.model, off.inverse)).model).toStrictEqual(m)
  })

  it('ignores a box for a group the view does not hold, and takes one that it does', () => {
    const m = sample({
      elements: [element('a')],
      diagrams: [diagram('landscape', {
        groups: [{ id: 'core', name: 'Core' }],
        placements: [placement('a')],
      })],
    })
    expect(apply(m, {
      type: 'box.set', diagramId: 'landscape', boxes: [{ id: 'nobody', x: 0, y: 0, width: 1, height: 1 }],
    })).toEqual({ ok: true, model: m, inverse: NOTHING })
    const boxed = reversible(m, {
      type: 'box.set', diagramId: 'landscape', boxes: [{ id: 'core', x: 1, y: 2, width: 3, height: 4 }],
    })
    expect(boxed.diagrams.landscape.boxes.core).toEqual({ id: 'core', x: 1, y: 2, width: 3, height: 4 })
  })

  it('patches the board, and clearing a key is a key with nothing after it', () => {
    const m = sample()
    const sized = reversible(m, {
      type: 'board.set', diagramId: 'landscape', patch: { canvas: { width: 2400, height: 1600 } },
    })
    expect(sized.diagrams.landscape.canvas).toEqual({ width: 2400, height: 1600 })
    const cleared = ok(apply(sized, {
      type: 'board.set', diagramId: 'landscape', patch: { canvas: undefined },
    }))
    expect('canvas' in cleared.model.diagrams.landscape).toBe(false)
  })
})

describe('apply — dashed groups', () => {
  const grouped = () => sample({
    elements: [element('a'), element('b')],
    diagrams: [diagram('landscape', {
      groups: [{ id: 'core', name: 'Core' }, { id: 'edge', name: 'Edge' }],
      placements: [placement('a', { group: 'core' }), placement('b', { group: 'edge' })],
    })],
  })

  it('renames one group and leaves every member where it was', () => {
    const m = grouped()
    const before = m.diagrams.landscape.members
    const renamed = reversible(m, {
      type: 'group.set', diagramId: 'landscape', groups: [{ id: 'core', name: 'Kern' }],
    })
    expect(renamed.diagrams.landscape.groups?.core).toEqual({ id: 'core', name: 'Kern' })
    // The one property the id buys: the members point at it, so none of them moved.
    expect(renamed.diagrams.landscape.members).toBe(before)
    expect(renamed.diagrams.landscape.order.groups).toEqual(['core', 'edge'])
  })

  it('adds a group at the end, and its inverse takes exactly that one back', () => {
    const m = grouped()
    const added = reversible(m, {
      type: 'group.set', diagramId: 'landscape', groups: [{ id: 'ops', name: 'Ops', color: '#123456' }],
    })
    expect(added.diagrams.landscape.order.groups).toEqual(['core', 'edge', 'ops'])
  })

  it('removes groups and puts each back on its own index', () => {
    const m = grouped()
    const removed = ok(apply(m, { type: 'group.remove', diagramId: 'landscape', groupIds: ['core'] }))
    expect(removed.model.diagrams.landscape.order.groups).toEqual(['edge'])
    const back = ok(apply(removed.model, removed.inverse)).model
    expect(back.diagrams.landscape.order.groups).toEqual(['core', 'edge'])
    expect(back).toStrictEqual(m)
  })

  /**
   * Dissolving the last group and undoing must give back the document you had,
   * written the way you had it — which is why the key keeps its slot rather
   * than being deleted and re-appended (`withGroups`).
   */
  it('survives losing its last group as an exact round trip', () => {
    const m = sample({
      elements: [element('a')],
      diagrams: [diagram('landscape', {
        groups: [{ id: 'core', name: 'Core' }],
        placements: [placement('a', { group: 'core' })],
      })],
    })
    const before = JSON.stringify(toArrays(m))
    const removed = ok(apply(m, { type: 'group.remove', diagramId: 'landscape', groupIds: ['core'] }))
    expect(toArrays(removed.model).diagrams[0].groups).toBeUndefined()
    expect(JSON.stringify(toArrays(ok(apply(removed.model, removed.inverse)).model))).toBe(before)
  })

  it('refuses a diagram that is not there', () => {
    expect(apply(grouped(), { type: 'group.set', diagramId: 'gone', groups: [] }))
      .toEqual({ ok: false, reason: 'command.gone' })
    expect(apply(grouped(), { type: 'group.remove', diagramId: 'gone', groupIds: ['core'] }))
      .toEqual({ ok: false, reason: 'command.gone' })
  })
})

describe('apply — diagrams', () => {
  it('creates, renames and deletes, each reversibly', () => {
    const m = sample()
    const made = reversible(m, { type: 'diagram.create', diagram: toDiagram(diagram('second')) })
    expect(made.order.diagrams).toEqual(['landscape', 'inside-a', 'second'])

    reversible(m, { type: 'diagram.rename', id: 'landscape', name: 'The landscape' })
    reversible(m, { type: 'diagram.delete', id: 'inside-a' })
  })

  it('puts a duplicate next to its original, and takes it away again', () => {
    const m = sample()
    const copy = { ...toDiagram(diagram('landscape-2')), name: 'Landscape (copy)' }
    const made = reversible(m, { type: 'diagram.create', diagram: copy, at: 1 })
    expect(made.order.diagrams).toEqual(['landscape', 'landscape-2', 'inside-a'])
  })

  it('refuses an empty name and a name that is the one it already has', () => {
    const m = sample()
    expect(ok(apply(m, { type: 'diagram.rename', id: 'landscape', name: '  ' })).model).toBe(m)
    expect(ok(apply(m, { type: 'diagram.rename', id: 'landscape', name: 'Diagram landscape' })).model).toBe(m)
  })

  it('refuses to delete the last landscape', () => {
    const m = sample()
    expect(apply(m, { type: 'diagram.delete', id: 'landscape' }))
      .toEqual({ ok: false, reason: 'command.lastLandscape' })
  })

  /** Settings are the whole answer: an absent field clears the diagram's own. */
  it('applies settings as a whole answer, reversibly', () => {
    const m = sample({
      diagrams: [diagram('landscape', { author: 'W. Simons', showAspects: false })],
    })
    const set = ok(apply(m, {
      type: 'diagram.settings', id: 'landscape', settings: { name: 'Landscape', client: 'Acme' },
    }))
    expect(set.model.diagrams.landscape.client).toBe('Acme')
    expect('author' in set.model.diagrams.landscape).toBe(false)
    expect('showAspects' in set.model.diagrams.landscape).toBe(false)

    const back = ok(apply(set.model, set.inverse)).model
    expect(back).toStrictEqual(m)
  })

  it('patches the machine-facing fields, reversibly', () => {
    const m = sample()
    const on = reversible(m, { type: 'diagram.update', id: 'landscape', patch: { autoRoute: true } })
    expect(on.diagrams.landscape.autoRoute).toBe(true)
    reversible(on, { type: 'diagram.update', id: 'landscape', patch: { autoRoute: undefined } })
  })
})

describe('apply — decisions and the project', () => {
  it('adds, updates and removes a decision, reversibly', () => {
    const m = sample()
    const added = reversible(m, { type: 'decision.add', decision: adr('d1', 1) })
    expect(added.order.decisions).toEqual(['d1'])
    reversible(added, { type: 'decision.update', id: 'd1', patch: { status: 'accepted' } })
    reversible(added, { type: 'decision.remove', id: 'd1' })
  })

  it('leaves no decisions key behind when the list empties', () => {
    const m = sample()
    const added = ok(apply(m, { type: 'decision.add', decision: adr('d1', 1) }))
    expect('decisions' in ok(apply(added.model, added.inverse)).model).toBe(false)
  })

  it('edits the project’s own fields, reversibly', () => {
    const m = sample()
    const named = reversible(m, { type: 'project.settings', patch: { name: 'Another', defaultAuthor: 'W' } })
    expect(named.name).toBe('Another')
    reversible(named, { type: 'project.settings', patch: { defaultAuthor: undefined } })
  })
})

describe('apply — transactions', () => {
  it('is one step: several commands in, one inverse out', () => {
    const m = sample()
    const step = ok(apply(m, transaction([
      { type: 'element.create', element: element('d') },
      { type: 'relation.create', relation: connection('c#3', 'a', 'd') },
      placeOn('landscape', [placement('d')]),
    ])))
    expect(step.model.order.elements).toEqual(['a', 'b', 'c', 'd'])
    expect(ok(apply(step.model, step.inverse)).model).toStrictEqual(m)
  })

  it('changes nothing when any part of it refuses', () => {
    const m = sample()
    expect(apply(m, transaction([
      { type: 'element.create', element: element('d') },
      { type: 'element.update', id: 'nope', patch: {} },
    ]))).toEqual({ ok: false, reason: 'command.gone' })
  })

  it('is nothing when nothing inside it changed anything', () => {
    const m = sample()
    const step = ok(apply(m, transaction([{ type: 'diagram.rename', id: 'landscape', name: '' }])))
    expect(step.model).toBe(m)
    expect(step.inverse).toEqual(NOTHING)
  })

  it('carries the meta onto the inverse', () => {
    const step = ok(apply(sample(), {
      type: 'element.update', id: 'a', patch: { name: 'x' }, coalesce: 'name:a', undoable: false,
    }))
    expect(step.inverse.coalesce).toBe('name:a')
    expect(step.inverse.undoable).toBe(false)
  })
})

/**
 * Why the model is indexed at all: a command names a path, and everything off
 * that path has to come out by identity or the memoisation below the reducer is
 * worthless.
 */
describe('apply — what it does not touch', () => {
  it('leaves every other diagram, element and order array alone', () => {
    const m = sample()
    const next = ok(apply(m, placeOn('landscape', [placement('a', { x: 99 })]))).model

    expect(next).not.toBe(m)
    expect(next.diagrams['inside-a']).toBe(m.diagrams['inside-a'])
    expect(next.elements).toBe(m.elements)
    expect(next.relations).toBe(m.relations)
    expect(next.order).toBe(m.order)
    expect(next.diagrams.landscape.order).toBe(m.diagrams.landscape.order)
  })

  it('keeps the order array itself when a row is only updated', () => {
    const m = sample()
    const next = ok(apply(m, { type: 'element.update', id: 'a', patch: { name: 'x' } })).model
    expect(next.order).toBe(m.order)
    expect(next.elements.b).toBe(m.elements.b)
  })
})

/** The phase's exit criterion, as a test. */
describe('a session of twenty commands', () => {
  const script: Command[] = [
    { type: 'element.create', element: element('d', { name: 'Dispatch' }) },
    { type: 'element.create', element: element('e', { name: 'Billing' }) },
    placeOn('landscape', [placement('d'), placement('e')]),
    { type: 'relation.create', relation: connection('c#3', 'd', 'e') },
    { type: 'route.set', diagramId: 'landscape', routes: [route('c#3')] },
    { type: 'element.update', id: 'd', patch: { vendor: 'Acme' } },
    { type: 'element.update', id: 'd', patch: { vendor: undefined } },
    { type: 'relation.update', id: 'c#3', patch: { label: 'invoices' } },
    { type: 'diagram.rename', id: 'landscape', name: 'The landscape' },
    { type: 'diagram.settings', id: 'landscape', settings: { name: 'The landscape', author: 'W' } },
    { type: 'diagram.update', id: 'landscape', patch: { autoRoute: true } },
    { type: 'board.set', diagramId: 'landscape', patch: { zones: { actors: { size: 90 } } } },
    { type: 'decision.add', decision: adr('d1', 1) },
    { type: 'decision.update', id: 'd1', patch: { status: 'reviewing' } },
    { type: 'project.settings', patch: { name: 'Landscape of Acme' } },
    { type: 'diagram.create', diagram: toDiagram(diagram('second', { name: 'Second' })), at: 1 },
    { type: 'member.remove', diagramId: 'landscape', elementIds: ['b'] },
    { type: 'route.clear', diagramId: 'landscape', relationIds: ['c#1'] },
    { type: 'element.delete', id: 'a' },
    { type: 'decision.remove', id: 'd1' },
  ]

  it('undoes back to the start and redoes back to the end, step by step', () => {
    const states: Model[] = [sample()]
    const inverses: Command[] = []
    for (const command of script) {
      const step = ok(apply(states[states.length - 1], command))
      inverses.push(step.inverse)
      states.push(step.model)
    }
    expect(states).toHaveLength(21)

    let model = states[states.length - 1]
    for (let i = script.length - 1; i >= 0; i--) {
      model = ok(apply(model, inverses[i])).model
      expect(model, `after undoing step ${i + 1}`).toStrictEqual(states[i])
    }

    for (let i = 0; i < script.length; i++) {
      model = ok(apply(model, script[i])).model
      expect(model, `after redoing step ${i + 1}`).toStrictEqual(states[i + 1])
    }
  })
})

/**
 * The same properties over something the size of a real landscape, so "cost is
 * proportional to the change" is a measurement rather than a claim.
 */
describe('over a thousand elements', () => {
  function big(n: number): Model {
    const elements = Array.from({ length: n }, (_, i) => element(`e${i}`, { name: `App ${i}` }))
    const connections = Array.from({ length: n - 1 }, (_, i) => connection(`c#${i}`, `e${i}`, `e${i + 1}`))
    const diagrams = ['one', 'two', 'three'].map((id) => diagram(id, {
      placements: elements.map((e, i) => placement(e.id, { x: i * 10, y: i * 4 })),
      edgeRoutes: connections.filter((_, i) => i % 7 === 0).map((c) => route(c.id)),
    }))
    return fromArrays({ name: 'Big', customerName: 'ACME', elements, relations: connections, diagrams })
  }

  const m = big(1000)

  it.each([
    ['element.create', { type: 'element.create', element: element('new') }],
    ['element.update', { type: 'element.update', id: 'e500', patch: { name: 'Renamed' } }],
    ['element.delete', { type: 'element.delete', id: 'e500' }],
    ['relation.create', { type: 'relation.create', relation: connection('c#new', 'e1', 'e9') }],
    ['relation.delete', { type: 'relation.delete', id: 'c#7' }],
    ['member.set', placeOn('two', [placement('e3', { x: 1 })])],
    ['placement.remove', { type: 'member.remove', diagramId: 'two', elementIds: ['e3', 'e4'] }],
    ['route.set', { type: 'route.set', diagramId: 'two', routes: [route('c#14', { pinned: true })] }],
    ['route.clear', { type: 'route.clear', diagramId: 'two', relationIds: ['c#14'] }],
    ['diagram.rename', { type: 'diagram.rename', id: 'two', name: 'Two, renamed' }],
    ['diagram.delete', { type: 'diagram.delete', id: 'two' }],
  ] as const satisfies readonly (readonly [string, Command])[])('%s is exactly reversible', (_name, command) => {
    reversible(m, command)
  })

  it('leaves the diagrams it did not name alone', () => {
    const next = ok(apply(m, placeOn('two', [placement('e3', { x: 1 })]))).model
    expect(next.diagrams.one).toBe(m.diagrams.one)
    expect(next.diagrams.three).toBe(m.diagrams.three)
  })
})

describe('applyAll', () => {
  it('runs a list as one step', () => {
    const m = sample()
    const step = ok(applyAll(m, [
      { type: 'element.create', element: element('d') },
      { type: 'element.create', element: element('e') },
    ]))
    expect(step.model.order.elements).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(ok(apply(step.model, step.inverse)).model).toStrictEqual(m)
  })
})
describe('lifecycle dates (ADR-0009)', () => {
  it('takes dates that run forwards', () => {
    const next = apply(sample(), {
      type: 'element.update', id: 'a',
      patch: { lifecycleDates: { live: '2027-04-01', retired: '2029-01-01' } },
    })
    expect(next.ok).toBe(true)
  })

  it('refuses dates that run backwards, with a key rather than a throw', () => {
    // Refused in the reducer and not in the inspector, so the agent, a paste
    // and an undo all get the same answer.
    const next = apply(sample(), {
      type: 'element.update', id: 'a',
      patch: { lifecycleDates: { live: '2029-01-01', retired: '2027-04-01' } },
    })
    expect(next).toEqual({ ok: false, reason: 'command.datesOutOfOrder' })
  })

  it('judges the dates the element would END UP with, not the ones in the patch', () => {
    const held = apply(sample(), {
      type: 'element.update', id: 'a', patch: { lifecycleDates: { live: '2029-01-01' } },
    })
    expect(held.ok).toBe(true)
    if (!held.ok) return
    // On its own this retirement is fine; against the go-live already stored it
    // is backwards, and a patch that names one key must still be judged whole.
    expect(apply(held.model, {
      type: 'element.update', id: 'a', patch: { lifecycleDates: { live: '2029-01-01', retired: '2028-01-01' } },
    })).toEqual({ ok: false, reason: 'command.datesOutOfOrder' })
  })

  it('undoes a date the way it undoes any other field', () => {
    const before = sample()
    const dated = apply(before, {
      type: 'element.update', id: 'a', patch: { lifecycleDates: { retired: '2029-01-01' } },
    })
    expect(dated.ok).toBe(true)
    if (!dated.ok) return
    const back = apply(dated.model, dated.inverse)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.model).toEqual(before)
  })

  it('sets the day a diagram shows through the ordinary patch', () => {
    const next = apply(sample(), { type: 'diagram.update', id: 'landscape', patch: { asOf: '2028-01-01' } })
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.model.diagrams.landscape.asOf).toBe('2028-01-01')
    // And clearing it is a patch naming the key with nothing, as everywhere.
    const cleared = apply(next.model, { type: 'diagram.update', id: 'landscape', patch: { asOf: undefined } })
    expect(cleared.ok).toBe(true)
    if (!cleared.ok) return
    expect('asOf' in cleared.model.diagrams.landscape).toBe(false)
  })
})

