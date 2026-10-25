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
import type { Principle } from '../principle'
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
  const observed = r.chance(0.6)
  const held = fromArrays({
    name: 'Design',
    elements,
    relations,
    diagrams: [view('d1', 'layer7'), view('d2', r.chance(0.5) ? 'layer7' : 'container')],
    ...(r.chance(0.6) ? { decisions: [adr(r, 'adr-1', 1)] } : {}),
    ...(r.chance(0.6) ? { transitions: [plan(r, 'tr-1', 1)] } : {}),
    ...(observed ? { observations: [observation(r, 'ob-1', 1)] } : {}),
    ...(r.chance(0.6) ? { causes: [cause(r, 'ca-1', 1)] } : {}),
    ...(r.chance(0.6) ? { solutions: [solution(r, 'so-1', 1)] } : {}),
    ...(r.chance(0.6) ? { experiments: [experiment(r, 'ex-1', 1)] } : {}),
    ...(r.chance(0.6) ? { unitTypes: [unitType(r, 'ut-1')] } : {}),
    ...(r.chance(0.6) ? { roles: [role(r, 'ro-1')] } : {}),
    ...(r.chance(0.6) ? { responsibilities: [responsibility(r, 'rs-1')] } : {}),
    ...(r.chance(0.6) ? { operatingRules: [{ id: 'applicationOwner' as const, role: 'ro-1' }] } : {}),
    ...(r.chance(0.6) ? { assignments: [assignment(r, 'as-1')] } : {}),
    // Every reader passes a fix's mark over, so a model never holds one.
    ...(r.chance(0.6) ? { checkMarks: [{ ...checkMark(r, 'r-1 a b'), check: 'check.interactionUnused' as const }] } : {}),
    // A thread on the first element, which every model has: a comment, and now and then a reply under it.
    ...(r.chance(0.6) ? { comments: [thread(r, 'cm-1'), ...(r.chance(0.5) ? [{ ...thread(r, 'cm-2'), replyTo: 'cm-1' }] : [])] } : {}),
    ...(r.chance(0.6) ? { principles: [principle(r, 'pr-1'), ...(r.chance(0.5) ? [{ ...principle(r, 'pr-2'), status: 'accepted' as const }] : [])] } : {}),
    ...(r.chance(0.4) ? { principleGroups: [{ id: 'pg-1', name: 'Data' }] } : {}),
    // A citation needs the record that cites: the observation above, where there is one.
    ...(observed && r.chance(0.5) ? { citations: [{ id: 'ci-1', about: { kind: 'observation' as const, id: 'ob-1' }, principle: { scope: '', id: 'pr-1' }, stance: 'holds' as const, on: '2026-10-25' }] } : {}),
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
const unitType = (r: Random, id: string) => ({
  id, name: r.pick(WORDS) || 'Team', within: [], slots: r.chance(0.5) ? [{ role: 'ro-1', min: 1, max: 1 }] : [],
  ...(r.chance(0.5) ? { top: true } : {}),
})
const role = (r: Random, id: string) => ({
  id, name: r.pick(WORDS) || 'Lead', duties: r.chance(0.5) ? [{ responsibility: 'rs-1', raci: 'A' as const }] : [],
  ...(r.chance(0.3) ? { manages: true } : {}),
})
const assignment = (r: Random, id: string) => ({
  id, unitId: r.chance(0.8) ? 'a' : 'b', roleId: 'ro-1', person: { person: r.pick(['pe-1', 'pe-2']) },
  ...(r.chance(0.5) ? { share: r.pick([0.2, 0.5, 1]) } : {}),
  ...(r.chance(0.5) ? { from: '2026-01-01' } : {}),
  ...(r.chance(0.3) ? { acting: true as const } : {}),
})
/** A mark of a review or a note, now and then of a fix, which the writer refuses. */
const checkMark = (r: Random, key: string) => ({
  check: r.chance(0.9) ? r.pick(['check.interactionUnused', 'check.roleVacant', 'check.notDrawn'] as const) : 'check.conflict' as const,
  key, on: r.pick(DAYS), ...(r.chance(0.5) ? { reason: r.pick(WORDS) || 'Meant so' } : {}),
})
/** A comment on the first element, or now and then on a record nobody holds or of a kind nobody comments on. */
const comment = (r: Random, id: string) => ({
  id, about: r.chance(0.9) ? { kind: 'element' as const, id: 'e0' } : r.pick([{ kind: 'element' as const, id: 'gone' }, { kind: 'diagram' as const, id: 'd1' }]),
  by: { person: r.pick(['pe-1', 'pe-2']) }, at: `${r.pick(DAYS)}T10:00:00Z`, body: r.pick(WORDS) || 'A remark',
  ...(r.chance(0.2) ? { edited: `${r.pick(DAYS)}T11:00:00Z` } : {}),
  ...(r.chance(0.2) ? { via: 'agent' } : {}),
})
/** A comment a model may hold: every reader passes over one about nothing, so the thread is on the first element. */
const thread = (r: Random, id: string) => ({ ...comment(r, id), about: { kind: 'element' as const, id: 'e0' } })
const responsibility = (r: Random, id: string) => ({
  id, name: r.pick(WORDS) || 'Release', ...(r.chance(0.5) ? { group: 'Deliver' } : {}),
})

// --- a command of every kind --------------------------------------------------

/** An id the model holds, or now and then one it does not. */
/** A principle with one aspect, accepted or not: what a page writes. */
function principle(r: Random, id: string): Principle {
  return {
    id, number: 1 + r.int(20), title: r.pick(WORDS) || 'Reuse first', statement: 'Reuse before buy before build.',
    aspects: [{ id: `${id}-a1`, number: 1, text: 'Look for one first', nature: 'design' }], lastAspect: 1,
    groups: r.chance(0.5) ? ['pg-1'] : [], regime: r.pick(['fixed', 'flexible'] as const), status: r.pick(['candidate', 'accepted'] as const),
  }
}

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
    patch: {
      state: r.pick(['assumed', 'verified'] as const), ...(r.chance(0.5) ? { body: 'Because, really.' } : {}),
      // A merge writes the history (ADR-0035 §4), and an undo takes it back off.
      ...(r.chance(0.3) ? { history: [{ date: '2026-10-01', kind: 'merged' as const, id: 'ca-1' }] } : {}),
    },
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
  'unitType.add': (r, m) => ({
    type: 'unitType.add', unitType: unitType(r, r.chance(0.8) ? `ut-${2 + r.int(100)}` : 'ut-1'),
    ...(r.chance(0.3) ? { at: r.int(m.order.unitTypes.length + 1) } : {}),
  }),
  'unitType.update': (r, m) => ({
    type: 'unitType.update', id: held(r, m.order.unitTypes, 'ut'),
    patch: {
      name: r.pick(WORDS) || 'Named',
      ...(r.chance(0.5) ? { limit: either(r, 1 + r.int(5)) } : {}),
      ...(r.chance(0.5) ? { slots: [{ role: 'ro-1', min: r.int(3) }] } : {}),
      ...(r.chance(0.3) ? { spans: either(r, true) } : {}),
    },
  }),
  'unitType.remove': (r, m) => ({ type: 'unitType.remove', id: held(r, m.order.unitTypes, 'ut') }),
  'role.add': (r, m) => ({
    type: 'role.add', role: role(r, r.chance(0.8) ? `ro-${2 + r.int(100)}` : 'ro-1'),
    ...(r.chance(0.3) ? { at: r.int(m.order.roles.length + 1) } : {}),
  }),
  'role.update': (r, m) => ({
    type: 'role.update', id: held(r, m.order.roles, 'ro'),
    patch: {
      ...(r.chance(0.6) ? { duties: [{ responsibility: 'rs-1', raci: r.pick(['R', 'A', 'C', 'I'] as const) }] } : {}),
      ...(r.chance(0.5) ? { manages: either(r, true) } : {}),
      ...(r.chance(0.5) ? { purpose: either(r, 'Leads it.') } : {}),
    },
  }),
  'role.remove': (r, m) => ({ type: 'role.remove', id: held(r, m.order.roles, 'ro') }),
  'responsibility.add': (r, m) => ({
    type: 'responsibility.add', responsibility: responsibility(r, r.chance(0.8) ? `rs-${2 + r.int(100)}` : 'rs-1'),
    ...(r.chance(0.3) ? { at: r.int(m.order.responsibilities.length + 1) } : {}),
  }),
  'responsibility.update': (r, m) => ({
    type: 'responsibility.update', id: held(r, m.order.responsibilities, 'rs'),
    patch: { name: r.pick(WORDS) || 'Named', ...(r.chance(0.5) ? { group: either(r, 'Run') } : {}) },
  }),
  'responsibility.remove': (r, m) => ({ type: 'responsibility.remove', id: held(r, m.order.responsibilities, 'rs') }),
  'operatingRule.add': (r) => ({
    type: 'operatingRule.add', rule: { id: r.pick(['applicationOwner', 'domainOwner'] as const), role: 'ro-1' },
  }),
  'operatingRule.update': (r, m) => ({
    type: 'operatingRule.update', id: r.chance(0.9) && m.order.operatingRules.length ? 'applicationOwner' : 'domainOwner',
    patch: { role: `ro-${r.int(5)}` },
  }),
  'operatingRule.remove': (r, m) => ({
    type: 'operatingRule.remove', id: r.chance(0.9) && m.order.operatingRules.length ? 'applicationOwner' : 'domainOwner',
  }),
  'assignment.add': (r, m) => ({
    type: 'assignment.add', assignment: assignment(r, r.chance(0.8) ? `as-${2 + r.int(100)}` : 'as-1'),
    ...(r.chance(0.3) ? { at: r.int(m.order.assignments.length + 1) } : {}),
  }),
  'assignment.update': (r, m) => ({
    type: 'assignment.update', id: held(r, m.order.assignments, 'as'),
    patch: {
      ...(r.chance(0.6) ? { until: either(r, r.pick(['2026-12-31', '2025-01-01'])) } : {}),
      ...(r.chance(0.4) ? { share: either(r, 0.5) } : {}),
      ...(r.chance(0.3) ? { acting: either(r, true as const) } : {}),
      ...(r.chance(0.3) ? { person: { person: 'pe-3' } } : {}),
    },
  }),
  'assignment.remove': (r, m) => ({ type: 'assignment.remove', id: held(r, m.order.assignments, 'as') }),
  'checkMark.add': (r, m) => ({
    type: 'checkMark.add', mark: checkMark(r, r.chance(0.8) ? `r-${2 + r.int(100)} a b` : 'r-1 a b'),
    ...(r.chance(0.3) ? { at: r.int(m.order.checkMarks.length + 1) } : {}),
  }),
  'checkMark.remove': (r, m) => ({ type: 'checkMark.remove', id: held(r, m.order.checkMarks, 'check.notDrawn x') }),
  'comment.add': (r, m) => ({
    type: 'comment.add',
    comment: {
      ...comment(r, r.chance(0.85) ? `cm-${3 + r.int(100)}` : 'cm-1'),
      ...(r.chance(0.3) ? { replyTo: held(r, m.order.comments, 'cm') } : {}),
    },
    ...(r.chance(0.3) ? { at: r.int(m.order.comments.length + 1) } : {}),
  }),
  'comment.update': (r, m) => ({ type: 'comment.update', id: held(r, m.order.comments, 'cm'), body: r.pick(WORDS) || 'Said again', edited: '2026-10-16T12:00:00Z' }),
  'comment.remove': (r, m) => ({ type: 'comment.remove', id: held(r, m.order.comments, 'cm'), removed: { at: '2026-10-16T12:00:00Z', by: { person: 'pe-1' } } }),
  'comment.take': (r, m) => ({ type: 'comment.take', id: held(r, m.order.comments, 'cm') }),
  'comment.put': (r, m) => ({
    type: 'comment.put', comment: thread(r, r.chance(0.5) ? held(r, m.order.comments, 'cm') : `cm-${3 + r.int(100)}`),
    ...(r.chance(0.3) ? { at: r.int(m.order.comments.length + 1) } : {}),
  }),
  'principle.add': (r, m) => ({
    type: 'principle.add',
    principle: principle(r, r.chance(0.85) ? `pr-${3 + r.int(100)}` : 'pr-1'),
    ...(r.chance(0.3) ? { at: r.int(m.order.principles.length + 1) } : {}),
  }),
  'principle.update': (r, m) => {
    const id = held(r, m.order.principles, 'pr')
    const was = m.principles?.[id]
    return {
      type: 'principle.update', id,
      patch: {
        ...(r.chance(0.5) ? { title: r.pick(WORDS) || 'Renamed' } : {}),
        ...(r.chance(0.4) ? { status: r.pick(['candidate', 'accepted', 'retired'] as const) } : {}),
        ...(r.chance(0.3) ? { question: either(r, 'Does it hold?') } : {}),
        ...(r.chance(0.3) ? { groups: r.some(['pg-1', 'pg-2']) } : {}),
        // An aspect added, with its note where an accepted one is sharpened: what the editor sends.
        ...(was && r.chance(0.3) ? {
          aspects: [...was.aspects, { id: `as-${r.int(1000)}`, number: was.lastAspect + 1, text: 'Also this', nature: 'design' as const }],
          lastAspect: was.lastAspect + 1,
          ...(r.chance(0.8) ? { sharpened: [...(was.sharpened ?? []), { on: '2026-10-25', note: 'Said more' }] } : {}),
        } : {}),
      },
    }
  },
  'principle.remove': (r, m) => ({ type: 'principle.remove', id: held(r, m.order.principles, 'pr') }),
  'citation.add': (r, m) => ({
    type: 'citation.add',
    citation: {
      id: r.chance(0.85) ? `ci-${3 + r.int(100)}` : 'ci-1',
      // Mostly a record the scope holds; sometimes one it does not, which is refused.
      about: { kind: 'observation', id: held(r, m.order.observations, 'ob') },
      principle: { scope: '', id: 'pr-1' }, stance: r.pick(['holds', 'chafes', 'missing', 'supports'] as const), on: '2026-10-25',
    },
    ...(r.chance(0.3) ? { at: r.int(m.order.citations.length + 1) } : {}),
  }),
  'citation.update': (r, m) => ({
    type: 'citation.update', id: held(r, m.order.citations, 'ci'),
    patch: { ...(r.chance(0.6) ? { stance: r.pick(['holds', 'chafes', 'missing'] as const) } : {}), ...(r.chance(0.4) ? { aspect: either(r, 1 + r.int(3)) } : {}) },
  }),
  'citation.remove': (r, m) => ({ type: 'citation.remove', id: held(r, m.order.citations, 'ci') }),

  'project.settings': (r) => ({
    type: 'project.settings',
    patch: {
      ...(r.chance(0.6) ? { name: r.pick(WORDS) || 'Named' } : {}),
      ...(r.chance(0.5) ? { description: either(r, 'What this is.') } : {}),
      ...(r.chance(0.4) ? { defaultAuthor: either(r, 'Somebody') } : {}),
      ...(r.chance(0.3) ? { principleGroups: r.chance(0.8) ? [{ id: 'pg-1', name: 'Data' }, { id: 'pg-2', name: 'Reuse' }] : [{ id: 'pg-1', name: '' }] } : {}),
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
