// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { byPickUp, CHAINS_FIRST, chainsOf, mapWindow, seenBelow, splitResults, splitSeen, splitWhy, standingOf } from './chain'
import type { Cause, Observation, ScopeAnalysis } from './observation'
import type { Solution } from './solution'
import { pictureLinks } from './graph'

const observation = (id: string, over: Partial<Observation> = {}): Observation => ({
  id, number: Number(id.slice(1)) || 1, title: id, date: '2026-01-01', impact: 'minor', seen: 1, body: '', history: [], ...over,
} as Observation)
const cause = (id: string, explains: string[], over: Partial<Cause> = {}): Cause => ({
  id, number: 1, title: id, state: 'assumed', body: '', explains: explains.map((one) => ({ id: one, strength: 'normal' as const })), ...over,
} as Cause)
const scope = (over: Partial<ScopeAnalysis>): ScopeAnalysis => ({ scope: '', observations: [], causes: [], solutions: [], experiments: [], ...over })

describe('what waits', () => {
  it('puts problems and bright spots before what is neutral, then by impact and sightings', () => {
    const list = [
      observation('o1', { impact: 'critical', tone: 'neutral', seen: 9 }),
      observation('o2', { impact: 'minor', tone: 'problem' }),
      observation('o3', { impact: 'major', tone: 'problem', seen: 1 }),
      observation('o4', { impact: 'major', tone: 'problem', seen: 4 }),
    ]
    expect([...list].sort(byPickUp).map((one) => one.id)).toEqual(['o4', 'o3', 'o2', 'o1'])
  })

  it('tells what waits from what has a why and what was noted, an answer before the mark', () => {
    const split = splitSeen(
      [observation('o1'), observation('o2'), observation('o3', { noted: true }), observation('o4', { noted: true }), observation('o5', { archived: true })],
      (id) => id === 'o2' || id === 'o4',
    )
    expect(split.waiting.map((one) => one.id)).toEqual(['o1'])
    expect(split.explained.map((one) => one.id).sort()).toEqual(['o2', 'o4'])
    expect(split.noted.map((one) => one.id)).toEqual(['o3'])
  })

  it('lists open ends before causes, and root causes last', () => {
    const split = splitWhy([cause('a', []), cause('b', ['a']), cause('c', [], { root: true })], (one) => one.id === 'b')
    expect(split.openEnds.map((one) => one.id)).toEqual(['b'])
    expect(split.causes.map((one) => one.id)).toEqual(['a'])
    expect(split.roots.map((one) => one.id)).toEqual(['c'])
  })
})

describe('where a chain stands', () => {
  it('is as far as it has got', () => {
    expect(standingOf({ explained: false, solved: false, built: false })).toBe('seen')
    expect(standingOf({ explained: true, solved: false, built: false })).toBe('why')
    expect(standingOf({ explained: true, solved: true, built: false })).toBe('solve')
    expect(standingOf({ explained: true, solved: true, built: true })).toBe('results')
  })
})

describe('did it work', () => {
  const plan = { id: 'p', status: 'done' as const, to: '2026-02-01' }
  it('says first what came back, then what stayed away, then what is still being built', () => {
    const root = cause('r', ['o1'], { root: true })
    const quietRoot = cause('q', ['o2'], { root: true })
    const solutions = [
      { id: 's1', number: 1, state: 'adopted', plan: 'p', addresses: [{ id: 'r', strength: 'normal' }], history: [] },
      { id: 's2', number: 2, state: 'adopted', plan: 'p', addresses: [{ id: 'q', strength: 'normal' }], history: [] },
      { id: 's3', number: 3, state: 'adopted', addresses: [], history: [] },
      { id: 's4', number: 4, state: 'dropped', addresses: [], history: [] },
    ] as unknown as Solution[]
    const seenSince = observation('o1', { history: [{ date: '2026-03-01', kind: 'seen' }] })
    const split = splitResults(solutions, { observations: [seenSince, observation('o2')], causes: [root, quietRoot] }, [], [plan as never])
    expect(split.seenAgain.map((one) => one.solution.id)).toEqual(['s1'])
    expect(split.quiet.map((one) => one.solution.id)).toEqual(['s2'])
    expect(split.waiting.map((one) => one.id)).toEqual(['s3'])
  })
})

describe('how much of a map is drawn', () => {
  const many = (count: number, prefix = 'x') => Array.from({ length: count }, (_, index) => observation(`${prefix}${index + 1}`))

  it('makes chains of what is joined, heaviest first, and one pile of what no line reaches', () => {
    const one = scope({
      observations: [observation('o1', { impact: 'minor' }), observation('o2', { impact: 'critical' }), observation('o3')],
      causes: [cause('c1', ['o1']), cause('c2', ['o2'])],
    })
    const records = chainsOf([one], '')
    expect(records.chains.map((chain) => chain.id)).toEqual(['o2', 'o1'])
    expect(records.loose).toEqual(['o3'])
  })

  it('counts a cause with no line as a chain of its own', () => {
    const records = chainsOf([scope({ causes: [cause('c1', [])] })], '')
    expect(records.chains.map((chain) => chain.keys)).toEqual([['c1']])
  })

  it('opens on the first chains, folds a long list, and puts the rest on a pile', () => {
    const list = many(12)
    const heavy = cause('heavy', list.map((one) => one.id))
    const lights = Array.from({ length: 8 }, (_, index) => {
      const id = `l${index + 1}`
      return { seen: observation(id, { impact: 'minor' }), why: cause(`c${id}`, [id]) }
    })
    const one = scope({
      observations: [...list.map((held) => ({ ...held, impact: 'critical' as const })), ...lights.map((held) => held.seen), observation('alone')],
      causes: [heavy, ...lights.map((held) => held.why)],
    })
    const window = mapWindow(chainsOf([one], ''), '', { limit: CHAINS_FIRST, opened: new Set() }, pictureLinks([one], ''))
    expect(window.shownChains).toBe(6)
    expect(window.totalChains).toBe(9)
    const fold = window.cards.find((card) => card.kind === 'fold')
    expect(fold?.count).toBe(8)
    expect(fold?.to).toEqual(['heavy'])
    expect(window.cards.find((card) => card.kind === 'pile')?.count).toBe(1)
    expect(window.drawn.has('alone')).toBe(false)
    expect(window.drawn.has('heavy')).toBe(true)
  })

  it('does not fold a list of one more than it would show: a card saying one more says nothing', () => {
    const list = many(5)
    const one = scope({ observations: list, causes: [cause('c', list.map((held) => held.id))] })
    expect(mapWindow(chainsOf([one], ''), '', { limit: 6, opened: new Set() }, pictureLinks([one], '')).cards).toEqual([])
  })

  it('opens a chain’s list when asked, and draws everything under Show all', () => {
    const list = many(9)
    const one = scope({ observations: [...list, observation('alone')], causes: [cause('c', list.map((held) => held.id))] })
    const links = pictureLinks([one], '')
    const records = chainsOf([one], '')
    const closed = mapWindow(records, '', { limit: 6, opened: new Set() }, links)
    const chain = closed.cards[0].chain as string
    expect(mapWindow(records, '', { limit: 6, opened: new Set([chain]) }, links).drawn.size).toBe(10)
    const all = mapWindow(records, '', { limit: 'all', opened: new Set() }, links)
    expect(all.drawn.size).toBe(11)
    expect(all.cards).toEqual([])
  })

  it('draws what a filter kept, however light: nothing searched for is left behind a button', () => {
    const lights = Array.from({ length: 9 }, (_, index) => ({ seen: observation(`l${index + 1}`), why: cause(`c${index + 1}`, [`l${index + 1}`]) }))
    const one = scope({ observations: lights.map((held) => held.seen), causes: lights.map((held) => held.why) })
    const kept = mapWindow(chainsOf([one], ''), '', { limit: 2, opened: new Set() }, pictureLinks([one], ''), new Set(['l9', 'c9']))
    expect([...kept.drawn].sort()).toEqual(['c9', 'l9'])
  })
})

describe('this scope comes first', () => {
  const heavyBelow = (count: number) => scope({
    scope: 'a/b',
    observations: Array.from({ length: count }, (_, index) => observation(`h${index + 1}`, { impact: 'critical', seen: 9 })),
    causes: Array.from({ length: count }, (_, index) => cause(`hc${index + 1}`, [`h${index + 1}`])),
  })
  const light = scope({ scope: 'a', observations: [observation('o1')], causes: [cause('c1', ['o1'])] })

  it('keeps this scope’s chain in the window, however heavy the chains below', () => {
    const scopes = [light, heavyBelow(10)]
    const records = chainsOf(scopes, 'a')
    expect(records.chains[0].id).toBe('o1')
    const window = mapWindow(records, 'a', { limit: CHAINS_FIRST, opened: new Set() }, pictureLinks(scopes, 'a'))
    expect(window.drawn.has('o1')).toBe(true)
    expect(window.shownChains).toBe(CHAINS_FIRST)
  })

  it('counts a chain as this scope’s where it holds one record of it, and lists this scope’s first in a chain and on the pile', () => {
    const below = scope({
      scope: 'a/b',
      observations: [observation('b1', { impact: 'critical' }), observation('loose-below', { impact: 'critical' })],
      causes: [cause('bc', ['b1'])],
    })
    const here = scope({
      scope: 'a',
      observations: [observation('o1'), observation('alone')],
      causes: [{ ...cause('c1', ['o1']), explains: [{ id: 'o1', strength: 'normal' as const }, { id: 'b1', scope: 'a/b', strength: 'normal' as const }] }],
    })
    const records = chainsOf([here, below], 'a')
    expect(records.chains[0].observations).toEqual(['o1', 'a/b#b1'])
    expect(records.loose).toEqual(['alone', 'a/b#loose-below'])
  })
})

describe('how many were seen, counted one way', () => {
  it('is the live observations in view, here and below, the pile what waits for a why, and a home\'s count below the same', () => {
    const here = scope({
      observations: [
        observation('o1'), observation('o2', { noted: true }), observation('o3', { archived: true }),
        observation('o4', { history: [{ date: '2026-01-02', kind: 'merged', id: 'o1' }] }), observation('o5', { tone: 'bright' }),
      ],
      causes: [cause('c1', ['o5'])],
    })
    const below = scope({ scope: 'team', observations: [observation('o1'), observation('o2', { archived: true }), observation('o3', { noted: true })] })
    const records = chainsOf([here, below], '')
    // o1, the noted o2 and the bright o5 here; o1 and the noted o3 below. Archived and merged ones are not seen any more.
    expect(records.seen).toEqual({ here: 3, below: 2 })
    expect(seenBelow([below])).toBe(records.seen.below)
    // What waits: nothing explains it and nobody noted it — o1 here and o1 below; o5 has a why.
    expect(records.loose).toEqual(['o1', 'team#o1'])
  })
})
