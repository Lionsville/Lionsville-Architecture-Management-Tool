// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Comment } from '../model/comment'
import type { Cause, Observation, ScopeAnalysis, Solution } from '../model/observation'
import { planMerge } from './merge'
import { planMove, scopesForMove } from './move'
import type { MovePlan, MoveRequest } from './move'
import { isMerged, isMoved, liveObservations, movedTo } from './observation'
import { mergedTo } from './mergeScreen'
import { absorbedKeys, analysisGraph, pictureKey } from './graph'
import { seenSinceImplemented } from './solution'

const DAY = '2026-10-16'
const AT = '2026-10-16T09:00:00Z'

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
const said = (id: string, about: string, over: Partial<Comment> = {}): Comment => ({
  id, about: { kind: 'observation', id: about }, by: { person: 'pe-1' }, at: AT, body: id, ...over,
})

function written(plan: MovePlan): Map<string, ScopeAnalysis> {
  if (!plan.ok) throw new Error(`refused: ${plan.refusal}`)
  return new Map(plan.writes.map((one) => [one.scope, one]))
}
const move = (scopes: ScopeAnalysis[], from: MoveRequest['from'], to: string) => planMove({ from, to, scopes, date: DAY })
const ob = (scopes: Map<string, ScopeAnalysis>, path: string, id: string) => scopes.get(path)!.observations.find((one) => one.id === id)!

describe('scopesForMove', () => {
  it('reads both scopes and every scope above either, the organisation first', () => {
    expect(scopesForMove({ scope: 'north/east', id: 'o1' }, 'south')).toEqual(['', 'north', 'north/east', 'south'])
    expect(scopesForMove({ scope: '', id: 'o1' }, 'north/east')).toEqual(['', 'north', 'north/east'])
  })
  it('and, once the source is read, every scope holding a record it absorbed', () => {
    const read = [scope('north', { observations: [observation('o1', {
      history: [{ date: DAY, kind: 'absorbed', id: 'x', scope: 'west/far', seen: 1 }, { date: DAY, kind: 'absorbed', id: 'y', seen: 1 }],
    })] })]
    expect(scopesForMove({ scope: 'north', id: 'o1' }, 'south', read)).toEqual(['', 'north', 'south', 'west/far'])
  })
})

describe('moving an observation (ADR-0038 §1)', () => {
  const source = scope('north', {
    observations: [observation('o7', { number: 7, seen: 3, bright: true, where: 'Desk', by: 'Kim' }), observation('o8', { number: 8 })],
  })
  const target = scope('south', { observations: [observation('s11', { number: 11 })] })

  it('is the same record under the same id in the target, with the target’s next number and a movedIn event', () => {
    const plan = move([scope(''), source, target], { scope: 'north', id: 'o7' }, 'south')
    expect(plan.ok && plan.number).toBe(12)
    expect(plan.ok && plan.revived).toBe(false)
    const writes = written(plan)
    expect([...writes.keys()]).toEqual(['north', 'south'])
    const arrived = ob(writes, 'south', 'o7')
    expect(arrived).toMatchObject({ number: 12, seen: 3, bright: true, where: 'Desk', by: 'Kim', title: 'o7', body: 'About o7.' })
    expect(arrived.history.at(-1)).toEqual({ date: DAY, kind: 'movedIn', id: 'o7', scope: 'north', number: 7 })
    expect(plan.ok && plan.observation).toEqual(arrived)
  })

  it('leaves a tombstone in the source, read as a merged record and out of the analysis', () => {
    const writes = written(move([scope(''), source, target], { scope: 'north', id: 'o7' }, 'south'))
    const left = writes.get('north')!.observations
    const tombstone = left.find((one) => one.id === 'o7')!
    expect(tombstone.number).toBe(7)
    expect(tombstone.history.at(-1)).toEqual({ date: DAY, kind: 'moved', id: 'o7', scope: 'south', number: 12 })
    expect(isMoved(tombstone)).toBe(true)
    expect(movedTo(tombstone.history)).toEqual({ id: 'o7', scope: 'south', number: 12, date: DAY })
    expect(isMerged(left, 'o7')).toBe(true)
    expect(liveObservations(left).map((one) => one.id)).toEqual(['o8'])
    expect(analysisGraph({ observations: [...left], causes: [] }).nodes.map((one) => one.id)).toEqual(['o8'])
    expect(absorbedKeys([writes.get('north')!], '').has(pictureKey('', 'north', 'o7'))).toBe(true)
    expect(isMoved(ob(writes, 'south', 'o7'))).toBe(false)
  })

  it('moves into the organisation, saying it as the empty path', () => {
    const writes = written(move([scope(''), source], { scope: 'north', id: 'o8' }, ''))
    expect(ob(writes, '', 'o8').number).toBe(1)
    expect(ob(writes, 'north', 'o8').history.at(-1)).toEqual({ date: DAY, kind: 'moved', id: 'o8', scope: '', number: 1 })
  })

  it('never reuses a number: a tombstone or a merged record of the target counts', () => {
    const busy = scope('south', { observations: [observation('s3', { number: 3, history: [{ date: DAY, kind: 'moved', id: 's3', scope: 'west', number: 1 }] })] })
    expect(move([scope(''), source, busy], { scope: 'north', id: 'o7' }, 'south')).toMatchObject({ ok: true, number: 4 })
  })

  it('refuses what a move may not do, and says the links all the same', () => {
    const tree = [scope(''), source, target, scope('north', {
      observations: [
        observation('o7', { number: 7 }),
        observation('ar', { archived: true }),
        observation('gone', { history: [{ date: DAY, kind: 'moved', id: 'gone', scope: 'south', number: 3 }] }),
        observation('mg', { history: [{ date: DAY, kind: 'merged', id: 'o7' }] }),
        observation('s11'),
      ],
      causes: [cause('c1', [{ id: 'o7', strength: 'strong' }])],
    })].slice(2)
    const refusal = (id: string, to: string) => {
      const plan = move([scope(''), ...tree], { scope: 'north', id }, to)
      return plan.ok ? 'ok' : plan.refusal
    }
    expect(refusal('o7', 'north')).toBe('sameScope')
    expect(refusal('o7', 'nowhere')).toBe('unknownScope')
    expect(refusal('nothing', 'south')).toBe('missing')
    expect(refusal('ar', 'south')).toBe('archived')
    expect(refusal('gone', 'south')).toBe('moved')
    expect(refusal('mg', 'south')).toBe('merged')
    expect(refusal('s11', 'south')).toBe('taken')
    const plan = move([scope(''), ...tree], { scope: 'north', id: 'o7' }, 'north')
    expect(!plan.ok && plan.cut.map((one) => one.holder.id)).toEqual(['c1'])
  })

  it('refuses a record a survivor of another scope absorbed, as merged', () => {
    const above = scope('', { observations: [observation('top', { history: [{ date: DAY, kind: 'absorbed', id: 'o7', scope: 'north', seen: 1 }] })] })
    expect(move([above, source, target], { scope: 'north', id: 'o7' }, 'south')).toMatchObject({ ok: false, refusal: 'merged' })
  })
})

describe('what a move cuts (ADR-0038 §2)', () => {
  const tree = () => [
    scope('', {
      // A link from above that ADR-0021 allowed, reported since ADR-0032 §9.
      causes: [cause('a1', [{ id: 'o7', scope: 'north', strength: 'weak' }])],
    }),
    scope('north', {
      observations: [observation('o7', { number: 7 }), observation('o8', { number: 8 })],
      causes: [
        cause('c1', [{ id: 'o7', strength: 'strong' }, { id: 'o8', strength: 'normal' }]),
        cause('c2', [{ id: 'c1', strength: 'normal' }], { root: true, number: 2 }),
        cause('c3', [{ id: 'o8', strength: 'normal' }], { number: 3 }),
        cause('cm', [{ id: 'o7', strength: 'normal' }], { number: 9, history: [{ date: DAY, kind: 'merged', id: 'c1' }] }),
      ],
      solutions: [solution('so1', [{ id: 'c2', strength: 'normal' }])],
    }),
    scope('south'),
  ]

  it('lists every link that explains it, with the solutions on the root causes they lead to', () => {
    const plan = move(tree(), { scope: 'north', id: 'o7' }, 'south')
    expect(plan.ok && plan.cut).toEqual([
      { holder: { scope: '', id: 'a1' }, strength: 'weak', solutions: [] },
      { holder: { scope: 'north', id: 'c1' }, strength: 'strong', solutions: [{ scope: 'north', id: 'so1' }] },
    ])
  })

  it('writes nothing on a cause: the links stay, naming the tombstone, as history', () => {
    const writes = written(move(tree(), { scope: 'north', id: 'o7' }, 'south'))
    expect(writes.get('north')!.causes).toEqual(tree()[1].causes)
    expect(writes.has('')).toBe(false)
  })

  it('stops a solution’s seen-since-implemented counting the moved record’s sightings', () => {
    const here = tree()[1]
    const done = solution('so1', [{ id: 'c2', strength: 'normal' }], { plan: 'tr1', state: 'adopted' })
    const plans = [{ id: 'tr1', status: 'done' as const, to: '2026-09-01', elements: [] }]
    const seen = { date: '2026-10-01', kind: 'seen' as const }
    const before = { observations: [observation('o7', { history: [seen] }), observation('o8')], causes: [...here.causes] }
    expect(seenSinceImplemented(done, before, [], plans).map((one) => one.id)).toEqual(['o7'])
    const after = written(move(tree().map((one) => (one.scope === 'north' ? { ...one, observations: before.observations } : one)), { scope: 'north', id: 'o7' }, 'south'))
    const left = { observations: [...after.get('north')!.observations], causes: [...here.causes] }
    expect(seenSinceImplemented(done, left, [], plans)).toEqual([])
  })
})

describe('moving back (ADR-0038 §1)', () => {
  it('brings the tombstone back to life under its number, and the links cut when it left explain it again', () => {
    const start = [
      scope(''),
      scope('north', { observations: [observation('o7', { number: 7 })], causes: [cause('c1', [{ id: 'o7', strength: 'strong' }])] }),
      scope('south', { observations: [observation('s4', { number: 4 })] }),
    ]
    const away = written(move(start, { scope: 'north', id: 'o7' }, 'south'))
    const tree = start.map((one) => away.get(one.scope) ?? one)
    // Something in the target explains it meanwhile, and is cut in its turn.
    const south = tree.find((one) => one.scope === 'south')!
    const linked = tree.map((one) => (one.scope === 'south' ? { ...south, causes: [cause('d1', [{ id: 'o7', strength: 'normal' }])] } : one))
    const back = move(linked, { scope: 'south', id: 'o7' }, 'north')
    expect(back).toMatchObject({ ok: true, number: 7, revived: true })
    expect(back.ok && back.cut.map((one) => one.holder)).toEqual([{ scope: 'south', id: 'd1' }])
    expect(back.ok && back.restored.map((one) => one.holder)).toEqual([{ scope: 'north', id: 'c1' }])
    const writes = written(back)
    const north = writes.get('north')!.observations
    expect(north).toHaveLength(1)
    expect(north[0].number).toBe(7)
    expect(isMoved(north[0])).toBe(false)
    expect(isMerged(north, 'o7')).toBe(false)
    expect(north[0].history.slice(-2)).toEqual([
      { date: DAY, kind: 'movedIn', id: 'o7', scope: 'north', number: 7 },
      { date: DAY, kind: 'movedIn', id: 'o7', scope: 'south', number: 5 },
    ])
    const tomb = writes.get('south')!.observations.find((one) => one.id === 'o7')!
    expect(movedTo(tomb.history)).toEqual({ id: 'o7', scope: 'north', number: 7, date: DAY })
  })
})

describe('what it absorbed (ADR-0038 §1)', () => {
  it('readdresses each absorbed record’s merged event to the target, and says its own absorbed events from there', () => {
    const tree = [
      scope(''),
      scope('north', {
        observations: [
          observation('o7', { number: 7, seen: 3, history: [
            { date: '2026-09-01', kind: 'recorded' },
            { date: '2026-09-02', kind: 'absorbed', id: 'o2', seen: 1 },
            { date: '2026-09-03', kind: 'absorbed', id: 'w1', scope: 'west', seen: 1 },
            { date: '2026-09-04', kind: 'absorbed', id: 'sx', scope: 'south', seen: 1 },
          ] }),
          observation('o2', { history: [{ date: '2026-09-02', kind: 'merged', id: 'o7' }] }),
        ],
      }),
      scope('south', { observations: [observation('sx', { history: [{ date: '2026-09-04', kind: 'merged', id: 'o7', scope: 'north' }] })] }),
      scope('west', { observations: [observation('w1', { history: [{ date: '2026-09-03', kind: 'merged', id: 'o7', scope: 'north' }] })] }),
    ]
    const writes = written(move(tree, { scope: 'north', id: 'o7' }, 'south'))
    expect([...writes.keys()]).toEqual(['north', 'south', 'west'])
    expect(ob(writes, 'south', 'o7').history.slice(1, 4)).toEqual([
      { date: '2026-09-02', kind: 'absorbed', id: 'o2', scope: 'north', seen: 1 },
      { date: '2026-09-03', kind: 'absorbed', id: 'w1', scope: 'west', seen: 1 },
      { date: '2026-09-04', kind: 'absorbed', id: 'sx', seen: 1 },
    ])
    expect(ob(writes, 'north', 'o2').history).toEqual([{ date: '2026-09-02', kind: 'merged', id: 'o7', scope: 'south' }])
    expect(ob(writes, 'south', 'sx').history).toEqual([{ date: '2026-09-04', kind: 'merged', id: 'o7' }])
    expect(ob(writes, 'west', 'w1').history).toEqual([{ date: '2026-09-03', kind: 'merged', id: 'o7', scope: 'south' }])
    // Reading follows: each says where its survivor lives now.
    expect(mergedTo(writes.get('west')!, 'observation', 'w1')).toEqual({ scope: 'south', id: 'o7', date: '2026-09-03' })
    expect(mergedTo(writes.get('south')!, 'observation', 'sx')).toEqual({ scope: 'south', id: 'o7', date: '2026-09-04' })
  })

  it('leaves a tombstone a merge refuses, so nothing is merged into it', () => {
    const writes = written(move([scope(''), scope('north', { observations: [observation('o7'), observation('o8')] }), scope('south')], { scope: 'north', id: 'o7' }, 'south'))
    const plan = planMerge({ kind: 'observation', survivor: { scope: 'north', id: 'o8' }, absorbed: [{ scope: 'north', id: 'o7' }], scopes: [...writes.values()], date: DAY })
    expect(plan).toMatchObject({ ok: false, refusal: 'merged' })
  })
})

describe('what travels with a move (ADR-0037 §6)', () => {
  it('takes its thread to the target, each comment saying the scope it came from', () => {
    const tree = [
      scope(''),
      scope('north', { observations: [observation('o7'), observation('o8')], comments: [said('cm-1', 'o7'), said('cm-2', 'o8'), said('cm-3', 'o7', { replyTo: 'cm-1' })] }),
      scope('south', { comments: [said('cm-9', 'sx')] }),
    ]
    const plan = move(tree, { scope: 'north', id: 'o7' }, 'south')
    expect(plan.ok && plan.comments).toBe(2)
    const writes = written(plan)
    expect(writes.get('north')!.comments).toEqual([said('cm-2', 'o8')])
    expect(writes.get('south')!.comments).toEqual([
      said('cm-9', 'sx'),
      said('cm-1', 'o7', { from: { kind: 'observation', id: 'o7', scope: 'north' } }),
      said('cm-3', 'o7', { replyTo: 'cm-1', from: { kind: 'observation', id: 'o7', scope: 'north' } }),
    ])
  })

  it('counts the thread where only the source’s comments are known, and carries nothing then', () => {
    const tree = [scope(''), scope('north', { observations: [observation('o7')], comments: [said('cm-1', 'o7')] }), scope('south')]
    const plan = move(tree, { scope: 'north', id: 'o7' }, 'south')
    expect(plan.ok && plan.comments).toBe(1)
    expect(written(plan).get('north')!.comments).toEqual([said('cm-1', 'o7')])
  })
})
