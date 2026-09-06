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
import { apply, applyAll } from './reducer'
import type { ApplyResult } from './reducer'
import { NOTHING, transaction } from './commands'
import type { Command } from './commands'
import { fromArrays, toDiagram } from './normalised'
import type { Model } from './normalised'
import type { HostModel } from './fromInterchange'
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
  return { connectionId, waypoints: [{ x: 1, y: 2 }], ...overrides }
}

/** Two applications, a line between them, on a landscape and a container view. */
function sample(overrides: Partial<HostModel> = {}): Model {
  return fromArrays({
    name: 'Design',
    customerName: 'ACME',
    elements: [element('a'), element('b'), element('c', { kind: 'component', parentApplicationId: 'a' })],
    connections: [connection('c#1', 'a', 'b'), connection('c#2', 'b', 'a')],
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

    expect(gone.order.connections).toEqual([])
    expect(gone.order.diagrams).toEqual(['landscape'])
    expect(gone.diagrams.landscape.order.placements).toEqual(['b'])
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

describe('apply — connections', () => {
  it('creates, updates and deletes, each reversibly', () => {
    const m = sample()
    reversible(m, { type: 'connection.create', connection: connection('c#3', 'a', 'c') })
    reversible(m, { type: 'connection.update', id: 'c#1', patch: { label: 'reads' } })
    reversible(m, { type: 'connection.delete', id: 'c#1' })
  })

  it('takes its geometry off every diagram, and gives it back', () => {
    const m = sample()
    const gone = ok(apply(m, { type: 'connection.delete', id: 'c#1' }))
    expect(gone.model.diagrams.landscape.order.routes).toEqual(['c#2'])
    expect(ok(apply(gone.model, gone.inverse)).model.diagrams.landscape.order.routes)
      .toEqual(['c#1', 'c#2'])
  })

  it('refuses a line to an element that is not there', () => {
    expect(apply(sample(), { type: 'connection.create', connection: connection('c#9', 'a', 'nope') }))
      .toEqual({ ok: false, reason: 'command.gone' })
  })
})

describe('apply — geometry', () => {
  it('moves what is placed and adds what is not, reversibly', () => {
    const m = sample()
    const moved = reversible(m, {
      type: 'placement.set',
      diagramId: 'landscape',
      placements: [placement('a', { x: 40 }), placement('c', { x: 10 })],
    })
    expect(moved.diagrams.landscape.placements.a.x).toBe(40)
    expect(moved.diagrams.landscape.order.placements).toEqual(['a', 'b', 'c'])
  })

  it('removes placements and puts each back on its own index', () => {
    const m = sample({
      elements: [element('a'), element('b'), element('c')],
      diagrams: [diagram('landscape', {
        placements: [placement('a'), placement('b'), placement('c')],
      })],
    })
    const removed = ok(apply(m, {
      type: 'placement.remove', diagramId: 'landscape', elementIds: ['a', 'c'],
    }))
    expect(removed.model.diagrams.landscape.order.placements).toEqual(['b'])
    expect(ok(apply(removed.model, removed.inverse)).model.diagrams.landscape.order.placements)
      .toEqual(['a', 'b', 'c'])
  })

  it('sets and clears routes, reversibly', () => {
    const m = sample()
    reversible(m, {
      type: 'route.set', diagramId: 'landscape', routes: [route('c#1', { pinned: true })],
    })
    reversible(m, { type: 'route.clear', diagramId: 'landscape', connectionIds: ['c#1'] })
  })

  /** An emptied optional list loses its key — see the note on the reducer. */
  it('drops the routes key when the last route goes, and brings it back', () => {
    const m = sample()
    const cleared = ok(apply(m, {
      type: 'route.clear', diagramId: 'landscape', connectionIds: ['c#1', 'c#2'],
    }))
    expect('edgeRoutes' in cleared.model.diagrams.landscape).toBe(false)
    expect(ok(apply(cleared.model, cleared.inverse)).model.diagrams.landscape.order.routes)
      .toEqual(['c#1', 'c#2'])
  })

  it('sets and clears a layout config, reversibly', () => {
    const m = sample()
    const laid = reversible(m, {
      type: 'layout.set', diagramId: 'landscape', layoutConfig: { zones: { actors: { size: 90 } } },
    })
    expect(laid.diagrams.landscape.layoutConfig?.zones?.actors?.size).toBe(90)
    reversible(laid, { type: 'layout.set', diagramId: 'landscape' })
  })

  it('refuses geometry for a diagram that is not there', () => {
    expect(apply(sample(), { type: 'placement.set', diagramId: 'nope', placements: [] }))
      .toEqual({ ok: false, reason: 'command.gone' })
  })

  it('ignores a placement for an element the model does not hold', () => {
    const result = ok(apply(sample(), {
      type: 'placement.set', diagramId: 'landscape', placements: [placement('nope')],
    }))
    expect(result.model.diagrams.landscape.placements.nope).toBeUndefined()
    expect(result.inverse).toEqual(NOTHING)
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
      { type: 'connection.create', connection: connection('c#3', 'a', 'd') },
      { type: 'placement.set', diagramId: 'landscape', placements: [placement('d')] },
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

  it('carries the label and the coalesce key onto the inverse', () => {
    const step = ok(apply(sample(), {
      type: 'element.update', id: 'a', patch: { name: 'x' }, label: 'kind.actor', coalesce: 'name:a',
    }))
    expect(step.inverse.label).toBe('kind.actor')
    expect(step.inverse.coalesce).toBe('name:a')
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
    const next = ok(apply(m, {
      type: 'placement.set', diagramId: 'landscape', placements: [placement('a', { x: 99 })],
    })).model

    expect(next).not.toBe(m)
    expect(next.diagrams['inside-a']).toBe(m.diagrams['inside-a'])
    expect(next.elements).toBe(m.elements)
    expect(next.connections).toBe(m.connections)
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
    { type: 'placement.set', diagramId: 'landscape', placements: [placement('d'), placement('e')] },
    { type: 'connection.create', connection: connection('c#3', 'd', 'e') },
    { type: 'route.set', diagramId: 'landscape', routes: [route('c#3')] },
    { type: 'element.update', id: 'd', patch: { vendor: 'Acme' } },
    { type: 'element.update', id: 'd', patch: { vendor: undefined } },
    { type: 'connection.update', id: 'c#3', patch: { label: 'invoices' } },
    { type: 'diagram.rename', id: 'landscape', name: 'The landscape' },
    { type: 'diagram.settings', id: 'landscape', settings: { name: 'The landscape', author: 'W' } },
    { type: 'diagram.update', id: 'landscape', patch: { autoRoute: true } },
    { type: 'layout.set', diagramId: 'landscape', layoutConfig: { zones: { actors: { size: 90 } } } },
    { type: 'decision.add', decision: adr('d1', 1) },
    { type: 'decision.update', id: 'd1', patch: { status: 'reviewing' } },
    { type: 'project.settings', patch: { name: 'Landscape of Acme' } },
    { type: 'diagram.create', diagram: toDiagram(diagram('second', { name: 'Second' })), at: 1 },
    { type: 'placement.remove', diagramId: 'landscape', elementIds: ['b'] },
    { type: 'route.clear', diagramId: 'landscape', connectionIds: ['c#1'] },
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
    return fromArrays({ name: 'Big', customerName: 'ACME', elements, connections, diagrams })
  }

  const m = big(1000)

  it.each([
    ['element.create', { type: 'element.create', element: element('new') }],
    ['element.update', { type: 'element.update', id: 'e500', patch: { name: 'Renamed' } }],
    ['element.delete', { type: 'element.delete', id: 'e500' }],
    ['connection.create', { type: 'connection.create', connection: connection('c#new', 'e1', 'e9') }],
    ['connection.delete', { type: 'connection.delete', id: 'c#7' }],
    ['placement.set', { type: 'placement.set', diagramId: 'two', placements: [placement('e3', { x: 1 })] }],
    ['placement.remove', { type: 'placement.remove', diagramId: 'two', elementIds: ['e3', 'e4'] }],
    ['route.set', { type: 'route.set', diagramId: 'two', routes: [route('c#14', { pinned: true })] }],
    ['route.clear', { type: 'route.clear', diagramId: 'two', connectionIds: ['c#14'] }],
    ['diagram.rename', { type: 'diagram.rename', id: 'two', name: 'Two, renamed' }],
    ['diagram.delete', { type: 'diagram.delete', id: 'two' }],
  ] as const satisfies readonly (readonly [string, Command])[])('%s is exactly reversible', (_name, command) => {
    reversible(m, command)
  })

  it('leaves the diagrams it did not name alone', () => {
    const next = ok(apply(m, {
      type: 'placement.set', diagramId: 'two', placements: [placement('e3', { x: 1 })],
    })).model
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
