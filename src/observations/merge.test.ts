// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import type { Cause, Observation, ScopeAnalysis, Solution } from '../model/observation'
import {
  causeDefaults, observationDefaults, planMerge, scopesForMerge, withMergedDescriptions,
} from './merge'
import type { MergeLink, MergePlan, MergeRequest } from './merge'
import { isCauseMerged, isMerged, mergeObservations } from './observation'

const t = translator('en')
const DAY = '2026-10-08'

const observation = (id: string, over: Partial<Observation> = {}): Observation => ({
  id, number: Number(id.replace(/\D/g, '')) || 1, title: id, date: '2026-09-01', impact: 'minor', seen: 1, body: `About ${id}.`,
  history: [{ date: '2026-09-01', kind: 'recorded' }], ...over,
})
const cause = (id: string, explains: Cause['explains'] = [], over: Partial<Cause> = {}): Cause => ({
  id, number: Number(id.replace(/\D/g, '')) || 1, title: id, state: 'assumed', body: '', explains, ...over,
})
const solution = (id: string, addresses: Solution['addresses'], over: Partial<Solution> = {}): Solution => ({
  id, number: 1, title: id, state: 'idea', addresses, validatedWith: [], attempts: [], body: '', history: [], ...over,
})
const scope = (path: string, over: Partial<ScopeAnalysis> = {}): ScopeAnalysis => ({
  scope: path, observations: [], causes: [], solutions: [], experiments: [], ...over,
})

function written(plan: MergePlan): Map<string, ScopeAnalysis> {
  if (!plan.ok) throw new Error(`refused: ${plan.refusal}`)
  return new Map(plan.writes.map((one) => [one.scope, one]))
}
const rowOf = (plan: MergePlan, holder: string, target: string): MergeLink => {
  const found = plan.links.find((one) => one.holder.id === holder && one.target.id === target)
  if (!found) throw new Error(`no row ${holder} > ${target}`)
  return found
}

describe('scopesForMerge', () => {
  it('reads every record’s scope and every scope above it, the organisation first', () => {
    expect(scopesForMerge('observation', [{ scope: 'north/east', id: 'o1' }, { scope: 'south', id: 'o2' }]))
      .toEqual(['', 'north', 'north/east', 'south'])
    expect(scopesForMerge('observation', [{ scope: '', id: 'o1' }])).toEqual([''])
  })
  it('for causes, the scopes below that an absorbed cause explains a record of, once it has been read', () => {
    const read = [scope('north', { causes: [cause('c1', [{ id: 'x', scope: 'north/east/far', strength: 'normal' }])] })]
    expect(scopesForMerge('cause', [{ scope: 'north', id: 'c1' }], read)).toEqual(['', 'north', 'north/east/far'])
    expect(scopesForMerge('observation', [{ scope: 'north', id: 'c1' }], read)).toEqual(['', 'north'])
  })
})

describe('defaults and descriptions', () => {
  it('starts an observation at its own values and the earliest day of the set', () => {
    const survivor = observation('o1', { date: '2026-09-05', where: 'Desk', by: 'Kim', impact: 'major' })
    expect(observationDefaults(survivor, [observation('o2', { date: '2026-08-30' }), observation('o3', { date: 'soon' })])).toEqual({
      title: 'o1', where: 'Desk', by: 'Kim', impact: 'major', date: '2026-08-30', body: 'About o1.',
    })
    expect(observationDefaults(observation('o4', { date: '' }), [])).toEqual({ title: 'o4', impact: 'minor', date: '', body: 'About o4.' })
  })
  it('starts a cause at its own values', () => {
    expect(causeDefaults(cause('c1', [], { root: true, state: 'verified', body: 'B' }))).toEqual({ title: 'c1', state: 'verified', root: true, body: 'B' })
    expect(causeDefaults(cause('c2')).root).toBe(false)
  })
  it('appends each absorbed description under a heading of its own, naming the scope where it is another', () => {
    const body = withMergedDescriptions('Mine.\n\n', [
      { label: 'OB-0007', body: 'Seen at the desk.\n' },
      { label: 'OB-0003', scope: 'Rail', body: 'Seen on the line.' },
      { label: 'OB-0004', body: '   ' },
    ], t)
    expect(body).toBe('Mine.\n\n## Merged from OB-0007\n\nSeen at the desk.\n\n## Merged from OB-0003 in Rail\n\nSeen on the line.\n')
    expect(withMergedDescriptions('', [{ label: 'CA-0002', body: 'Why.' }], t)).toBe('## Merged from CA-0002\n\nWhy.\n')
  })
})

describe('merging observations in one scope', () => {
  const here = scope('', {
    observations: [observation('o1', { seen: 2 }), observation('o2', { seen: 3 }), observation('o3')],
    causes: [
      cause('c1', [{ id: 'o2', strength: 'weak' }, { id: 'o1', strength: 'normal' }]),
      cause('c2', [{ id: 'o3', strength: 'normal' }, { id: 'o2', strength: 'strong' }]),
    ],
  })
  const request: MergeRequest = { kind: 'observation', survivor: { scope: '', id: 'o1' }, absorbed: [{ scope: '', id: 'o2' }], scopes: [here], date: DAY }

  it('writes what mergeObservations writes, when nothing is chosen', () => {
    const plan = planMerge(request)
    const after = written(plan).get('')!
    const before = mergeObservations({ observations: [...here.observations], causes: [...here.causes] }, 'o2', 'o1', DAY)
    expect(after.observations).toEqual(before.observations)
    expect(after.causes).toEqual(before.causes)
    expect(plan.ok && plan.writes.map((one) => one.scope)).toEqual([''])
  })

  it('reports every link that names the absorbed one, and offers the stronger where both were linked', () => {
    const plan = planMerge(request)
    expect(plan.links.map((one) => one.key).sort()).toEqual(['explains:#c1>#o2', 'explains:#c2>#o2'])
    const both = rowOf(plan, 'c1', 'o2')
    expect(both).toMatchObject({ both: true, offered: 'normal', moves: true, targetKind: 'observation', into: { holder: { scope: '', id: 'c1' }, target: { scope: '', id: 'o1' } } })
    expect(rowOf(plan, 'c2', 'o2')).toMatchObject({ both: false, offered: 'strong', moves: true })
  })

  it('keeps the chosen values, sums the sightings, and leaves an unticked link on the absorbed record', () => {
    const plan = planMerge({
      ...request,
      absorbed: [{ scope: '', id: 'o2' }, { scope: '', id: 'o3' }, { scope: '', id: 'o2' }],
      values: { title: '  Both  ', where: ' Gate 4 ', by: '', impact: 'critical', date: '2026-08-01', body: 'One thing.' },
      choices: { 'explains:#c1>#o2': { strength: 'weak' }, 'explains:#c2>#o3': { move: false } },
    })
    const after = written(plan).get('')!
    const survivor = after.observations.find((one) => one.id === 'o1')!
    expect(survivor).toMatchObject({ title: 'Both', where: 'Gate 4', impact: 'critical', date: '2026-08-01', body: 'One thing.', seen: 6 })
    expect(survivor.by).toBeUndefined()
    expect(survivor.history.slice(1)).toEqual([
      { date: DAY, kind: 'absorbed', id: 'o2', seen: 3 }, { date: DAY, kind: 'absorbed', id: 'o3', seen: 1 },
    ])
    expect(after.causes.find((one) => one.id === 'c1')!.explains).toEqual([{ id: 'o1', strength: 'weak' }])
    // c2's link to o3 stays, as history; its link to o2 moves.
    expect(after.causes.find((one) => one.id === 'c2')!.explains).toEqual([{ id: 'o3', strength: 'normal' }, { id: 'o1', strength: 'strong' }])
    expect(isMerged(after.observations, 'o3')).toBe(true)
  })

  it('takes a by that is said', () => {
    const after = written(planMerge({ ...request, values: { by: ' Lee ' } })).get('')!
    expect(after.observations.find((one) => one.id === 'o1')!.by).toBe('Lee')
  })
})

describe('merging observations across the tree', () => {
  const tree = [
    scope('', { causes: [cause('rc1', [{ id: 'b1', scope: 'north', strength: 'normal' }])] }),
    scope('north', {
      observations: [observation('o1'), observation('b1')],
      causes: [cause('c1', [{ id: 'o1', strength: 'normal' }])],
    }),
    scope('north/east', {
      observations: [observation('e1', { seen: 4 })],
      causes: [cause('ce1', [{ id: 'e1', strength: 'strong' }])],
    }),
    scope('south', { observations: [observation('s1')] }),
  ]

  it('writes the absorbed record where it lives, naming the survivor’s scope, and the survivor naming its', () => {
    const plan = planMerge({ kind: 'observation', survivor: { scope: 'north', id: 'o1' }, absorbed: [{ scope: 'north/east', id: 'e1' }, { scope: 'south', id: 's1' }], scopes: tree, date: DAY })
    expect(plan.ok && plan.writes.map((one) => one.scope)).toEqual(['north', 'north/east', 'south'])
    const writes = written(plan)
    const survivor = writes.get('north')!.observations.find((one) => one.id === 'o1')!
    expect(survivor.seen).toBe(6)
    expect(survivor.history.slice(1)).toEqual([
      { date: DAY, kind: 'absorbed', id: 'e1', scope: 'north/east', seen: 4 },
      { date: DAY, kind: 'absorbed', id: 's1', scope: 'south', seen: 1 },
    ])
    expect(writes.get('north/east')!.observations[0].history.at(-1)).toEqual({ date: DAY, kind: 'merged', id: 'o1', scope: 'north' })
    expect(isMerged(writes.get('south')!.observations, 's1')).toBe(true)
  })

  it('never moves a cause’s link to an observation of another scope: it stays as history, and the row says why', () => {
    const plan = planMerge({ kind: 'observation', survivor: { scope: 'north', id: 'o1' }, absorbed: [{ scope: 'north/east', id: 'e1' }], scopes: tree, date: DAY })
    expect(rowOf(plan, 'ce1', 'e1')).toMatchObject({ refusal: 'observationElsewhere', moves: false })
    expect(written(plan).get('north/east')!.causes).toEqual(tree[2].causes)
    const down = planMerge({ kind: 'observation', survivor: { scope: 'north/east', id: 'e1' }, absorbed: [{ scope: 'north', id: 'o1' }], scopes: tree, date: DAY })
    expect(rowOf(down, 'c1', 'o1')).toMatchObject({ refusal: 'observationBelow', moves: false })
  })

  it('repairs a link from above to an observation below when the survivor is the scope above’s own', () => {
    const withOwn = [{ ...tree[0], observations: [observation('r1')] }, ...tree.slice(1)]
    const plan = planMerge({ kind: 'observation', survivor: { scope: '', id: 'r1' }, absorbed: [{ scope: 'north', id: 'b1' }], scopes: withOwn, date: DAY })
    expect(rowOf(plan, 'rc1', 'b1')).toMatchObject({ moves: true, into: { target: { scope: '', id: 'r1' } } })
    expect(written(plan).get('')!.causes[0].explains).toEqual([{ id: 'r1', strength: 'normal' }])
  })

  it('refuses a record folded in before, by its own word or by a survivor elsewhere, and one archived or missing', () => {
    const absorbedAbove = [scope('', { observations: [observation('r1', { history: [{ date: 'd', kind: 'absorbed', id: 'b1', scope: 'north' }] })] }), tree[1]]
    const survivor = { scope: 'north', id: 'o1' }
    expect(planMerge({ kind: 'observation', survivor, absorbed: [{ scope: 'north', id: 'b1' }], scopes: absorbedAbove, date: DAY }))
      .toEqual({ ok: false, refusal: 'merged', record: { scope: 'north', id: 'b1' }, links: [] })
    const archived = [scope('north', { observations: [observation('o1'), observation('o2', { archived: true })] })]
    expect(planMerge({ kind: 'observation', survivor, absorbed: [{ scope: 'north', id: 'o2' }], scopes: archived, date: DAY }))
      .toMatchObject({ ok: false, refusal: 'archived' })
    expect(planMerge({ kind: 'observation', survivor, absorbed: [{ scope: 'west', id: 'w1' }], scopes: tree, date: DAY }))
      .toMatchObject({ ok: false, refusal: 'missing', record: { scope: 'west', id: 'w1' } })
    expect(planMerge({ kind: 'observation', survivor, absorbed: [], scopes: tree, date: DAY })).toMatchObject({ ok: false, refusal: 'nothing' })
    expect(planMerge({ kind: 'observation', survivor, absorbed: [survivor], scopes: tree, date: DAY })).toMatchObject({ ok: false, refusal: 'survivorAbsorbed' })
    expect(planMerge({ kind: 'observation', survivor, absorbed: [{ scope: 'north', id: 'b1' }], scopes: tree, values: { date: 'yesterday' }, date: DAY }))
      .toMatchObject({ ok: false, refusal: 'notADay' })
  })
})

describe('merging causes', () => {
  const tree = [
    scope('', {
      causes: [
        cause('top', [{ id: 'k2', scope: 'north', strength: 'weak' }]),
        cause('top2', [{ id: 'k1', scope: 'north', strength: 'normal' }, { id: 'k2', scope: 'north', strength: 'strong' }]),
      ],
    }),
    scope('north', {
      observations: [observation('n1'), observation('n2')],
      causes: [
        cause('k1', [{ id: 'n1', strength: 'normal' }]),
        cause('k2', [{ id: 'n2', strength: 'normal' }, { id: 'n1', strength: 'strong' }, { id: 'd1', scope: 'north/east', strength: 'normal' }]),
        cause('k3', [{ id: 'k2', strength: 'normal' }]),
      ],
      solutions: [solution('p1', [{ id: 'k2', strength: 'normal' }])],
    }),
    scope('north/east', { causes: [cause('d1')] }),
    scope('south', { causes: [cause('s1', [], { root: true })], solutions: [solution('ps', [{ id: 's1', strength: 'weak' }])] }),
  ]
  const request = (over: Partial<Extract<MergeRequest, { kind: 'cause' }>> = {}): MergeRequest => ({
    kind: 'cause', survivor: { scope: 'north', id: 'k1' }, absorbed: [{ scope: 'north', id: 'k2' }], scopes: tree, date: DAY, ...over,
  })

  it('moves what the absorbed cause explains, what explains it, and from above, keeping one link of each', () => {
    const plan = planMerge(request())
    const writes = written(plan)
    const north = writes.get('north')!
    const survivor = north.causes.find((one) => one.id === 'k1')!
    expect(survivor.explains).toEqual([
      { id: 'n1', strength: 'strong' }, { id: 'n2', strength: 'normal' }, { id: 'd1', scope: 'north/east', strength: 'normal' },
    ])
    expect(survivor.history).toEqual([{ date: DAY, kind: 'absorbed', id: 'k2' }])
    const absorbed = north.causes.find((one) => one.id === 'k2')!
    expect(absorbed.explains).toEqual([])
    expect(absorbed.history).toEqual([{ date: DAY, kind: 'merged', id: 'k1' }])
    expect(isCauseMerged(north.causes, 'k2')).toBe(true)
    expect(north.causes.find((one) => one.id === 'k3')!.explains).toEqual([{ id: 'k1', strength: 'normal' }])
    const root = writes.get('')!
    expect(root.causes[0].explains).toEqual([{ id: 'k1', scope: 'north', strength: 'weak' }])
    expect(root.causes[1].explains).toEqual([{ id: 'k1', scope: 'north', strength: 'strong' }])
    expect(rowOf(plan, 'top2', 'k2')).toMatchObject({ both: true, offered: 'strong' })
    expect(plan.ok && plan.writes.map((one) => one.scope)).toEqual(['north', ''])
  })

  it('does not move a solution to a survivor that is no root cause, and moves it to one that is', () => {
    const plan = planMerge(request())
    expect(rowOf(plan, 'p1', 'k2')).toMatchObject({ kind: 'addresses', refusal: 'notRoot', moves: false })
    expect(written(plan).get('north')!.solutions).toEqual(tree[1].solutions)
    const rooted = tree.map((one) => (one.scope === 'north'
      ? { ...one, causes: [cause('k1', [], { root: true }), cause('k2', [], { root: true })] }
      : one.scope === '' ? scope('') : one))
    const moved = planMerge(request({ scopes: rooted }))
    expect(written(moved).get('north')!.solutions[0].addresses).toEqual([{ id: 'k1', strength: 'normal' }])
  })

  it('does not move a solution of another scope, nor a link that would point up or sideways', () => {
    const plan = planMerge(request({ survivor: { scope: 'south', id: 's1' }, absorbed: [{ scope: 'north', id: 'k2' }], values: { root: false } }))
    // Refused as a whole: the survivor made a cause again while a solution addresses it.
    expect(plan).toMatchObject({ ok: false, refusal: 'command.rootAddressed', record: { scope: 'south', id: 's1' } })
    const sideways = planMerge(request({ survivor: { scope: 'north/east', id: 'd1' }, absorbed: [{ scope: 'north', id: 'k2' }] }))
    expect(rowOf(sideways, 'p1', 'k2').refusal).toBe('solutionElsewhere')
    // k2 explained d1, which is the survivor now: a cause does not explain itself.
    expect(rowOf(sideways, 'k2', 'd1').refusal).toBe('self')
    // What k2 explained in its own scope would be explained from below: up.
    expect(rowOf(sideways, 'k2', 'n2').refusal).toBe('observationElsewhere')
    // k3 explains k2 from the scope above the survivor: the link becomes one to a cause below.
    expect(rowOf(sideways, 'k3', 'k2')).toMatchObject({ moves: true, into: { holder: { scope: 'north', id: 'k3' }, target: { scope: 'north/east', id: 'd1' } } })
    const south = planMerge(request({ survivor: { scope: 'north/east', id: 'd1' }, absorbed: [{ scope: 'south', id: 's1' }], values: { root: true } }))
    expect(south.ok).toBe(false)
    expect(rowOf(south, 'ps', 's1').refusal).toBe('solutionElsewhere')
    const up = planMerge(request({ survivor: { scope: '', id: 'top' }, absorbed: [{ scope: 'north', id: 'k3' }] }))
    expect(rowOf(up, 'k3', 'k2')).toMatchObject({ moves: true, into: { target: { scope: 'north', id: 'k2' } } })
    const sidewaysCause = planMerge(request({ survivor: { scope: 'south', id: 's1' }, absorbed: [{ scope: 'north', id: 'k3' }] }))
    expect(rowOf(sidewaysCause, 'k3', 'k2').refusal).toBe('sideways')
    const upward = planMerge(request({
      scopes: [...tree.slice(0, 2), scope('north/east', { causes: [cause('d1'), cause('d2', [{ id: 'd1', strength: 'normal' }])] })],
      survivor: { scope: 'north/east', id: 'd2' }, absorbed: [{ scope: 'north', id: 'k1' }],
    }))
    expect(rowOf(upward, 'top2', 'k1')).toMatchObject({ moves: true, into: { target: { scope: 'north/east', id: 'd2' } } })
    const climbing = planMerge(request({
      scopes: [scope(''), scope('north', { causes: [cause('k1')] }), scope('north/east', { causes: [cause('d1', [], { root: true }), cause('d2')] }), scope('north/east/far', { causes: [cause('f1', [{ id: 'f2', strength: 'weak' }]), cause('f2')] })],
      survivor: { scope: 'north/east', id: 'd2' }, absorbed: [{ scope: 'north/east/far', id: 'f1' }],
    }))
    expect(rowOf(climbing, 'f1', 'f2')).toMatchObject({ moves: true, into: { holder: { scope: 'north/east', id: 'd2' }, target: { scope: 'north/east/far', id: 'f2' } } })
    const wrongWay = planMerge(request({
      scopes: [scope(''), scope('north', { causes: [cause('k1'), cause('k9')] }), scope('north/east', { causes: [cause('d1', [{ id: 'k9', scope: 'north', strength: 'weak' }])] })],
      survivor: { scope: 'north/east', id: 'd1' }, absorbed: [{ scope: 'north', id: 'k1' }],
    }))
    expect(wrongWay.ok).toBe(true)
  })

  it('names a root that something would explain, a loop, a merged cause, and a record it cannot find', () => {
    const scopes = [
      scope('north', {
        causes: [
          cause('a', [{ id: 'b', strength: 'normal' }]),
          cause('b', [{ id: 'gone', scope: 'north/far', strength: 'normal' }]),
          cause('r', [], { root: true }),
          cause('m', [], { history: [{ date: 'd', kind: 'merged', id: 'r' }] }),
          cause('x', [{ id: 'r', strength: 'weak' }, { id: 'm', strength: 'weak' }]),
        ],
      }),
    ]
    const ask = (survivor: string, absorbed: string, over: Partial<Extract<MergeRequest, { kind: 'cause' }>> = {}) => planMerge({
      kind: 'cause', survivor: { scope: 'north', id: survivor }, absorbed: [{ scope: 'north', id: absorbed }], scopes, date: DAY, ...over,
    })
    // a explains b; folding b into a makes the link a > a.
    expect(rowOf(ask('a', 'b'), 'a', 'b').refusal).toBe('self')
    expect(rowOf(ask('a', 'b'), 'b', 'gone').refusal).toBe('unknown')
    // x explains r, a root: folded into r, x would explain a root.
    const rooted = ask('r', 'a')
    expect(rowOf(rooted, 'a', 'b')).toMatchObject({ moves: true })
    // Folding x into b: b would explain r, a root, and m, merged.
    const fromX = ask('b', 'x')
    expect(rowOf(fromX, 'x', 'r').refusal).toBe('root')
    // m is merged: its link stays and it is no row. Folding x into a: a explains b, and b would explain... nothing new.
    expect(fromX.links.some((one) => one.holder.id === 'm')).toBe(false)
    expect(rowOf(fromX, 'x', 'm').refusal).toBe('merged')
    const loop = planMerge({
      kind: 'cause', survivor: { scope: 'north', id: 'p' }, absorbed: [{ scope: 'north', id: 'q' }], date: DAY,
      scopes: [scope('north', { causes: [cause('p', [{ id: 's', strength: 'normal' }]), cause('s', [{ id: 't', strength: 'normal' }]), cause('t'), cause('q'), cause('u', [{ id: 'q', strength: 'normal' }])] }), scope('north/far')],
    })
    expect(rowOf(loop, 'u', 'q')).toMatchObject({ moves: true })
    const closing = planMerge({
      kind: 'cause', survivor: { scope: 'north', id: 'p' }, absorbed: [{ scope: 'north', id: 'q' }], date: DAY,
      scopes: [scope('north', { causes: [cause('p', [{ id: 's', strength: 'normal' }]), cause('s'), cause('q', [], {}), cause('s2', [{ id: 'q', strength: 'normal' }])].map((one) => (one.id === 's' ? { ...one, explains: [{ id: 'q', strength: 'normal' as const }] } : one)) })],
    })
    // s explains q; folded into p, s would explain p, and p explains s: a loop.
    expect(rowOf(closing, 's', 'q').refusal).toBe('loop')
  })

  it('refuses a root cause something still explains, and verified without the evidence written down', () => {
    expect(planMerge(request({ survivor: { scope: 'north', id: 'k2' }, absorbed: [{ scope: 'north', id: 'k1' }], values: { root: true } })))
      .toMatchObject({ ok: false, refusal: 'command.rootExplained', record: { scope: 'north', id: 'k2' } })
    const refused = planMerge(request({ values: { state: 'verified' } }))
    expect(refused).toMatchObject({ ok: false, refusal: 'unverified' })
    expect(refused.links.length).toBeGreaterThan(0)
    const evidence = '## Why we think so\n\nThe logs.\n\n## How to verify\n\nChecked on 1 October.\n'
    const verified = written(planMerge(request({ values: { state: 'verified', body: evidence, title: ' One ', root: false } })))
    expect(verified.get('north')!.causes.find((one) => one.id === 'k1')).toMatchObject({ state: 'verified', body: evidence, title: 'One' })
    const made = written(planMerge(request({ scopes: [scope('north', { causes: [cause('k1', [], { root: true }), cause('k2')] })], values: { root: false } })))
    expect(made.get('north')!.causes[0].root).toBeUndefined()
    const rooted = written(planMerge(request({ scopes: [scope('north', { causes: [cause('k1'), cause('k2')] })], values: { root: true } })))
    expect(rooted.get('north')!.causes[0].root).toBe(true)
  })

  it('leaves an unticked link where it was, and takes the strength chosen over the stronger', () => {
    const plan = planMerge(request({ choices: { 'explains:north#k2>north#n1': { move: false }, 'explains:#top2>north#k2': { strength: 'weak' } } }))
    const writes = written(plan)
    expect(writes.get('north')!.causes.find((one) => one.id === 'k2')!.explains).toEqual([{ id: 'n1', strength: 'strong' }])
    expect(writes.get('')!.causes[1].explains).toEqual([{ id: 'k1', scope: 'north', strength: 'weak' }])
  })

  it('writes a cause merged into another scope with that scope, and the survivor with the absorbed one’s', () => {
    // d1 is explained from north, so it cannot be made a root here.
    expect(planMerge(request({ survivor: { scope: 'north/east', id: 'd1' }, absorbed: [{ scope: 'south', id: 's1' }], values: { root: true } })))
      .toMatchObject({ ok: false, refusal: 'command.rootExplained' })
    const plan = planMerge(request({ survivor: { scope: 'north/east', id: 'd1' }, absorbed: [{ scope: 'south', id: 's1' }] }))
    const writes = written(plan)
    expect(writes.get('north/east')!.causes[0].history).toEqual([{ date: DAY, kind: 'absorbed', id: 's1', scope: 'south' }])
    expect(writes.get('south')!.causes[0].history).toEqual([{ date: DAY, kind: 'merged', id: 'd1', scope: 'north/east' }])
  })
})
