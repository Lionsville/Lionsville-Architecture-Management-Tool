// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Apply, then the inverse, is where you started* — over every kind of command,
 * on models and commands nobody wrote by hand.
 *
 * `reducer.test.ts` pins the property one hand-made case at a time, and a case
 * nobody thought of is exactly where an inverse goes wrong: a field cleared
 * that was never there, a row put back at the wrong index, a list emptied
 * and left behind. So this generates them. A seeded generator of its own
 * rather than a property-testing library: the shapes are the model's and
 * have to be written out either way, and a seed printed in a failure is all
 * the shrinking a reducer this small needs to be debugged.
 *
 * Every generated command is either refused — and then nothing changed,
 * which the purity of `apply` already says — or applied, and then applying
 * what it answered as its inverse gives back the model it started from,
 * deep-equal, order arrays included. A refusal of the inverse is a failure:
 * an undo that cannot be done is the bug this looks for.
 */
import { describe, expect, it } from 'vitest'
import type { Command } from '../commands'
import type { Model } from '../normalised'
import { fromArrays } from '../normalised'
import { apply } from '../reducer'
import { connection, diagram, element } from '../testFixtures'
import type { DesignElement, ElementKind } from '../types'
import type { CommandType } from './handler'

// --- a seeded generator -------------------------------------------------------

/** mulberry32: small, fast, and the same sequence from the same seed everywhere. */
function random(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (below: number) => Math.floor(next() * below)
  const pick = <T,>(from: readonly T[]): T => from[int(from.length)]
  const chance = (p: number) => next() < p
  /** A few of these, in their own order, possibly none. */
  const some = <T,>(from: readonly T[], most = 3): T[] =>
    from.filter(() => chance(Math.min(1, most / Math.max(1, from.length))))
  return { int, pick, chance, some }
}

type Random = ReturnType<typeof random>

const WORDS = ['Crews', 'Billing', 'Ledger', 'Depot', 'Portal', 'Rostering', '']
const DAYS = ['2025-01-01', '2026-03-15', '2027-06-30', '2028-12-31']
const KINDS: ElementKind[] = ['application', 'component', 'platform', 'platformService', 'actor', 'function']

/** Maybe a value, maybe the key cleared — the two things a patch says about a field. */
function either<T>(r: Random, value: T): T | undefined {
  return r.chance(0.3) ? undefined : value
}

/**
 * A model with a bit of everything in it: elements of several kinds, a
 * stand-in, lines, two views with members, nodes, groups, boxes and routes,
 * and each of the six record lists — or none of some, because a list that is
 * absent has to stay absent.
 */
function someModel(r: Random): Model {
  const elements: DesignElement[] = Array.from({ length: 3 + r.int(5) }, (_, i) => element(`e${i}`, {
    kind: r.pick(KINDS),
    ...(r.chance(0.3) ? { description: `About e${i}.` } : {}),
    ...(r.chance(0.3) ? { vendor: r.pick(WORDS) } : {}),
    ...(r.chance(0.2) ? { ref: 'acme/elsewhere' } : {}),
  }))
  const ids = elements.map((one) => one.id)
  const relations = Array.from({ length: r.int(5) }, (_, i) => connection(`r${i}`, r.pick(ids), r.pick(ids), r.chance(0.3) ? { label: r.pick(WORDS) } : {}))
  const view = (id: string, kind: 'layer7' | 'container') => {
    const on = r.some(ids, 4)
    return diagram(id, {
      kind,
      placements: on.map((one) => ({ id: one, x: r.int(500), y: r.int(500) })),
      ...(r.chance(0.5) ? { groups: [{ id: `${id}-g`, name: 'Group' }] } : {}),
      ...(relations.length && r.chance(0.5)
        ? { edgeRoutes: [{ relationId: relations[0].id, waypoints: [{ x: 1, y: 2 }] }] } : {}),
    })
  }
  const held = fromArrays({
    name: 'Design',
    elements,
    relations,
    diagrams: [view('d1', 'layer7'), view('d2', r.chance(0.5) ? 'layer7' : 'container')],
    ...(r.chance(0.6) ? { decisions: [adr(r, 'adr-1', 1)] } : {}),
    ...(r.chance(0.6) ? { transitions: [plan(r, 'tr-1', 1)] } : {}),
    ...(r.chance(0.6) ? { observations: [observation(r, 'ob-1', 1)] } : {}),
    ...(r.chance(0.6) ? { causes: [cause(r, 'ca-1', 1)] } : {}),
    ...(r.chance(0.6) ? { solutions: [solution(r, 'so-1', 1)] } : {}),
    ...(r.chance(0.6) ? { experiments: [experiment(r, 'ex-1', 1)] } : {}),
  })
  return held
}

const adr = (r: Random, id: string, number: number) => ({
  id, number, title: r.pick(WORDS), status: 'proposed' as const, date: r.pick(DAYS), body: 'Why.', signers: [],
})
const plan = (r: Random, id: string, number: number) => ({
  id, number, title: r.pick(WORDS), status: 'draft' as const, elements: [], decisions: [], milestones: [], body: 'How.',
  ...(r.chance(0.5) ? { from: r.pick(DAYS) } : {}),
})
const observation = (r: Random, id: string, number: number) => ({
  id, number, title: r.pick(WORDS), date: r.pick(DAYS), impact: 'minor' as const, seen: 1 + r.int(3), body: 'Seen.',
  history: [{ date: r.pick(DAYS), kind: 'recorded' as const }],
})
const cause = (r: Random, id: string, number: number) => ({
  id, number, title: r.pick(WORDS), state: 'assumed' as const, body: 'Because.', explains: [],
})
const solution = (r: Random, id: string, number: number) => ({
  id, number, title: r.pick(WORDS), state: 'idea' as const, addresses: [], validatedWith: [], attempts: [],
  body: 'Try this.', history: [{ date: r.pick(DAYS), kind: 'proposed' as const }],
})
const experiment = (r: Random, id: string, number: number) => ({
  id, number, title: r.pick(WORDS), tests: [], hypothesis: 'It holds.', outcome: 'running' as const, body: 'Set up.',
})

// --- a command of every kind --------------------------------------------------

/** An id the model holds, or now and then one it does not. */
function held(r: Random, ids: readonly string[], prefix: string): string {
  return ids.length && r.chance(0.9) ? r.pick(ids) : `${prefix}-missing`
}

/**
 * One generator per kind of command, typed over the vocabulary so a command
 * added without one here fails the typecheck of this file too.
 */
const COMMANDS: { [K in CommandType]: (r: Random, model: Model) => Extract<Command, { type: K }> } = {
  'element.create': (r, m) => ({
    type: 'element.create', element: element(r.chance(0.9) ? `new-${r.int(1000)}` : m.order.elements[0], { kind: r.pick(KINDS) }),
    ...(r.chance(0.3) ? { at: r.int(m.order.elements.length + 1) } : {}),
  }),
  'element.update': (r, m) => ({
    type: 'element.update',
    id: held(r, m.order.elements, 'e'),
    patch: {
      ...(r.chance(0.6) ? { name: r.pick(WORDS) || 'Named' } : {}),
      ...(r.chance(0.5) ? { description: either(r, 'Rewritten.') } : {}),
      ...(r.chance(0.4) ? { vendor: either(r, r.pick(WORDS)) } : {}),
      ...(r.chance(0.3) ? { accentColor: either(r, '#123456') } : {}),
      ...(r.chance(0.3) ? { lifecycleDates: either(r, { live: DAYS[0], retiring: DAYS[1 + r.int(2)] }) } : {}),
      ...(r.chance(0.2) ? { aspects: { cost: { status: 'atRisk' as const } } } : {}),
    },
  }),
  'element.delete': (r, m) => ({ type: 'element.delete', id: held(r, m.order.elements, 'e') }),
  'standin.refresh': (r, m) => ({
    type: 'standin.refresh',
    entries: r.some(m.order.elements).map((id) => ({ id, name: r.pick(WORDS) || 'Fresh', ref: r.pick(['acme/elsewhere', 'acme/other']) })),
  }),
  'element.link': (r, m) => ({ type: 'element.link', id: held(r, m.order.elements, 'e'), name: r.pick(WORDS) || 'Master', ref: 'acme/master' }),

  'relation.create': (r, m) => ({
    type: 'relation.create',
    relation: connection(`new-r${r.int(1000)}`, held(r, m.order.elements, 'e'), held(r, m.order.elements, 'e')),
    ...(r.chance(0.3) ? { at: r.int(m.order.relations.length + 1) } : {}),
  }),
  'relation.update': (r, m) => ({
    type: 'relation.update',
    id: held(r, m.order.relations, 'r'),
    patch: {
      ...(r.chance(0.6) ? { label: either(r, r.pick(WORDS)) } : {}),
      ...(r.chance(0.4) ? { protocol: either(r, 'REST') } : {}),
      ...(r.chance(0.3) ? { isBidirectional: r.chance(0.5) } : {}),
    },
  }),
  'relation.delete': (r, m) => ({ type: 'relation.delete', id: held(r, m.order.relations, 'r') }),

  'member.set': (r, m) => ({
    type: 'member.set', diagramId: held(r, m.order.diagrams, 'd'),
    members: r.some(m.order.elements).map((id) => ({ id, ...(r.chance(0.3) ? { zone: 'landscape' as const } : {}) })),
  }),
  'member.remove': (r, m) => ({ type: 'member.remove', diagramId: held(r, m.order.diagrams, 'd'), elementIds: r.some(m.order.elements) }),
  'node.set': (r, m) => ({
    type: 'node.set', diagramId: held(r, m.order.diagrams, 'd'),
    nodes: r.some(m.order.elements).map((id) => ({ id, x: r.int(900), y: r.int(900) })),
  }),
  'node.remove': (r, m) => ({ type: 'node.remove', diagramId: held(r, m.order.diagrams, 'd'), elementIds: r.some(m.order.elements) }),
  'group.set': (r, m) => ({
    type: 'group.set', diagramId: held(r, m.order.diagrams, 'd'),
    groups: [{ id: r.pick(['d1-g', 'd2-g', `g${r.int(100)}`]), name: r.pick(WORDS) || 'Named' }],
  }),
  'group.remove': (r, m) => ({ type: 'group.remove', diagramId: held(r, m.order.diagrams, 'd'), groupIds: [r.pick(['d1-g', 'd2-g', 'nope'])] }),
  'box.set': (r, m) => ({
    type: 'box.set', diagramId: held(r, m.order.diagrams, 'd'),
    boxes: [{ id: r.pick(['d1-g', 'd2-g']), x: r.int(100), y: r.int(100), width: 50 + r.int(100), height: 50 + r.int(100) }],
  }),
  'box.remove': (r, m) => ({ type: 'box.remove', diagramId: held(r, m.order.diagrams, 'd'), groupIds: [r.pick(['d1-g', 'd2-g'])] }),
  'route.set': (r, m) => ({
    type: 'route.set', diagramId: held(r, m.order.diagrams, 'd'),
    routes: r.some(m.order.relations).map((relationId) => ({ relationId, waypoints: [{ x: r.int(50), y: r.int(50) }] })),
  }),
  'route.clear': (r, m) => ({ type: 'route.clear', diagramId: held(r, m.order.diagrams, 'd'), relationIds: r.some(m.order.relations) }),
  'board.set': (r, m) => ({
    type: 'board.set', diagramId: held(r, m.order.diagrams, 'd'),
    patch: {
      ...(r.chance(0.5) ? { canvas: either(r, { width: 800 + r.int(400), height: 600 }) } : {}),
      ...(r.chance(0.5) ? { needsLayout: either(r, true) } : {}),
    },
  }),

  'diagram.create': (r, m) => ({
    type: 'diagram.create', diagram: { ...m.diagrams[m.order.diagrams[0]], id: r.chance(0.9) ? `new-d${r.int(1000)}` : 'd1', name: 'Copy' },
    ...(r.chance(0.5) ? { at: r.int(m.order.diagrams.length + 1) } : {}),
  }),
  'diagram.rename': (r, m) => ({ type: 'diagram.rename', id: held(r, m.order.diagrams, 'd'), name: r.pick(WORDS) }),
  'diagram.settings': (r, m) => ({
    type: 'diagram.settings', id: held(r, m.order.diagrams, 'd'),
    settings: { name: r.pick(WORDS) || 'Named', ...(r.chance(0.5) ? { author: 'Somebody' } : {}), ...(r.chance(0.5) ? { showAspects: true } : {}) },
  }),
  'diagram.update': (r, m) => ({
    type: 'diagram.update', id: held(r, m.order.diagrams, 'd'),
    patch: {
      ...(r.chance(0.5) ? { autoRoute: either(r, r.chance(0.5)) } : {}),
      ...(r.chance(0.5) ? { asOf: either(r, r.pick(DAYS)) } : {}),
    },
  }),
  'diagram.delete': (r, m) => ({ type: 'diagram.delete', id: held(r, m.order.diagrams, 'd') }),

  'decision.add': (r) => ({ type: 'decision.add', decision: adr(r, r.chance(0.8) ? `adr-${2 + r.int(100)}` : 'adr-1', 2) }),
  'decision.update': (r, m) => ({
    type: 'decision.update', id: held(r, m.order.decisions, 'adr'),
    patch: { title: r.pick(WORDS) || 'Titled', ...(r.chance(0.5) ? { subjectId: either(r, 'e0') } : {}) },
  }),
  'decision.remove': (r, m) => ({ type: 'decision.remove', id: held(r, m.order.decisions, 'adr') }),
  'transition.add': (r) => ({ type: 'transition.add', transition: plan(r, r.chance(0.8) ? `tr-${2 + r.int(100)}` : 'tr-1', 2) }),
  'transition.update': (r, m) => ({
    type: 'transition.update', id: held(r, m.order.transitions, 'tr'),
    patch: { title: r.pick(WORDS) || 'Titled', ...(r.chance(0.5) ? { owner: either(r, 'Somebody') } : {}) },
  }),
  'transition.remove': (r, m) => ({ type: 'transition.remove', id: held(r, m.order.transitions, 'tr') }),
  'observation.add': (r) => ({ type: 'observation.add', observation: observation(r, r.chance(0.8) ? `ob-${2 + r.int(100)}` : 'ob-1', 2) }),
  'observation.update': (r, m) => ({
    type: 'observation.update', id: held(r, m.order.observations, 'ob'),
    patch: { seen: 1 + r.int(9), ...(r.chance(0.5) ? { shared: either(r, true as const) } : {}) },
  }),
  'observation.remove': (r, m) => ({ type: 'observation.remove', id: held(r, m.order.observations, 'ob') }),
  'cause.add': (r) => ({ type: 'cause.add', cause: cause(r, r.chance(0.8) ? `ca-${2 + r.int(100)}` : 'ca-1', 2) }),
  'cause.update': (r, m) => ({
    type: 'cause.update', id: held(r, m.order.causes, 'ca'),
    patch: { state: r.pick(['assumed', 'verified'] as const), ...(r.chance(0.5) ? { body: 'Because, really.' } : {}) },
  }),
  'cause.remove': (r, m) => ({ type: 'cause.remove', id: held(r, m.order.causes, 'ca') }),
  'solution.add': (r) => ({ type: 'solution.add', solution: solution(r, r.chance(0.8) ? `so-${2 + r.int(100)}` : 'so-1', 2) }),
  'solution.update': (r, m) => ({
    type: 'solution.update', id: held(r, m.order.solutions, 'so'),
    patch: { title: r.pick(WORDS) || 'Titled', ...(r.chance(0.5) ? { whyNow: either(r, 'Now.') } : {}) },
  }),
  'solution.remove': (r, m) => ({ type: 'solution.remove', id: held(r, m.order.solutions, 'so') }),
  'experiment.add': (r) => ({ type: 'experiment.add', experiment: experiment(r, r.chance(0.8) ? `ex-${2 + r.int(100)}` : 'ex-1', 2) }),
  'experiment.update': (r, m) => ({
    type: 'experiment.update', id: held(r, m.order.experiments, 'ex'),
    patch: { hypothesis: 'It holds, mostly.', ...(r.chance(0.5) ? { measure: either(r, 'Minutes') } : {}) },
  }),
  'experiment.remove': (r, m) => ({ type: 'experiment.remove', id: held(r, m.order.experiments, 'ex') }),

  'project.settings': (r) => ({
    type: 'project.settings',
    patch: {
      ...(r.chance(0.6) ? { name: r.pick(WORDS) || 'Named' } : {}),
      ...(r.chance(0.5) ? { description: either(r, 'What this is.') } : {}),
      ...(r.chance(0.4) ? { defaultAuthor: either(r, 'Somebody') } : {}),
    },
  }),
  'transaction': (r, m) => ({ type: 'transaction', commands: someCommands(r, m) }),
  'restore': (r, m) => ({
    type: 'restore', restored: { what: 'project', name: 'Design', asOf: r.pick(DAYS) }, commands: someCommands(r, m),
  }),
}

/** A few commands of any single kind, for the two kinds made of others. */
function someCommands(r: Random, model: Model): Command[] {
  const single = (Object.keys(COMMANDS) as CommandType[]).filter((type) => type !== 'transaction' && type !== 'restore')
  return Array.from({ length: 1 + r.int(3) }, () => COMMANDS[r.pick(single)](r, model))
}

// --- the property -------------------------------------------------------------

const RUNS = 120

describe('apply, then its inverse, is where it started', () => {
  for (const type of Object.keys(COMMANDS) as CommandType[]) {
    it(`for ${type}`, () => {
      let applied = 0
      for (let seed = 1; seed <= RUNS; seed += 1) {
        const r = random(seed * 7919 + type.length)
        const before = someModel(r)
        const command = COMMANDS[type](r, before)
        const result = apply(before, command)
        if (!result.ok) continue
        applied += 1
        const undone = apply(result.model, result.inverse)
        expect(undone.ok, `${type}, seed ${seed}: the inverse was refused (${!undone.ok && undone.reason})`).toBe(true)
        expect(undone.ok && undone.model, `${type}, seed ${seed}`).toStrictEqual(before)
      }
      // A generator that only ever made refused commands would pass by testing nothing.
      expect(applied).toBeGreaterThan(RUNS / 4)
    })
  }

  it('over a run of commands of every kind, one after the other, undone in reverse', () => {
    const types = Object.keys(COMMANDS) as CommandType[]
    for (let seed = 1; seed <= 40; seed += 1) {
      const r = random(seed)
      const start = someModel(r)
      let model = start
      const inverses: Command[] = []
      const models: Model[] = []
      for (let step = 0; step < 25; step += 1) {
        const result = apply(model, COMMANDS[r.pick(types)](r, model))
        if (!result.ok) continue
        models.push(model)
        inverses.push(result.inverse)
        model = result.model
      }
      while (inverses.length) {
        const undone = apply(model, inverses.pop()!)
        expect(undone.ok, `run ${seed}`).toBe(true)
        model = undone.ok ? undone.model : model
        expect(model, `run ${seed}`).toStrictEqual(models.pop())
      }
      expect(model).toStrictEqual(start)
    }
  })
})
