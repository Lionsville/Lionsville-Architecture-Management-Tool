// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Not the same person* (ADR-0036 §9, as built in 3.6.1): the pair, and how
 * the register's rules carry it through every other change. The contract
 * suite holds every repository to the same; these hold the rules themselves.
 */
import { describe, expect, it } from 'vitest'
import { answeredKeys, answeredWith, distinctFrom, distinctPair, pairKey, sameDistinct, tidyDistinct } from './distinct'
import type { DistinctPair } from './distinct'
import type { Person } from './person'
import { changePeople } from './register'
import type { ChangeAnswer, Changed, PeopleChange } from './register'

const person = (id: string, name: string, extra: Partial<Person> = {}): Person => ({
  id, name, pseudonym: `P${id.slice(-3).toUpperCase()}`, kind: 'internal', state: 'active', ...extra,
})

const YARA = person('pe-a', 'Yara Kok')
const VERA = person('pe-b', 'Vera Kok')
const VERA_TOO = person('pe-c', 'Vera Kokk')
const EVERYONE = [YARA, VERA, VERA_TOO]

function done(answer: ChangeAnswer): Changed {
  if ('refused' in answer) throw new Error(`refused ${answer.refused}`)
  return answer
}

const change = (people: readonly Person[], what: PeopleChange, distinct: readonly DistinctPair[] = [], removed: ReadonlySet<string> = new Set()) =>
  changePeople(people, what, {}, removed, distinct)

describe('a pair', () => {
  it('is kept with its lower id first, whichever is named first, and found either way round', () => {
    expect(distinctPair('pe-b', 'pe-a', '2026-10-11')).toEqual({ a: 'pe-a', b: 'pe-b', on: '2026-10-11' })
    expect(pairKey('pe-b', 'pe-a')).toBe(pairKey('pe-a', 'pe-b'))
    const pairs = [distinctPair('pe-a', 'pe-b', '2026-10-11'), distinctPair('pe-c', 'pe-a', '2026-10-11')]
    expect(answeredKeys(pairs).has(pairKey('pe-b', 'pe-a'))).toBe(true)
    expect([...answeredWith(pairs, 'pe-a')]).toEqual(['pe-b', 'pe-c'])
    expect([...answeredWith(pairs, 'pe-b')]).toEqual(['pe-a'])
  })

  it('reads back from a file tolerantly, and refuses what is no pair', () => {
    expect(distinctFrom({ a: 'pe-b', b: 'pe-a', on: '2026-10-11', by: 'x' })).toEqual({ a: 'pe-a', b: 'pe-b', on: '2026-10-11' })
    for (const value of [{ a: 'pe-a', b: 'pe-a', on: '2026-10-11' }, { a: 'pe-a', on: '2026-10-11' }, { a: 'pe-a', b: 'pe-b' }, [], 'pe-a', null]) {
      expect(distinctFrom(value)).toBeUndefined()
    }
  })

  it('says two lists are the same whatever order they were written in, and not where a day differs', () => {
    const one = [distinctPair('pe-a', 'pe-b', '2026-10-01'), distinctPair('pe-a', 'pe-c', '2026-10-02')]
    expect(sameDistinct(one, [...one].reverse())).toBe(true)
    expect(sameDistinct(one, [one[0], { ...one[1], on: '2026-10-03' }])).toBe(false)
    expect(sameDistinct(one, [one[0]])).toBe(false)
  })

  it('stands over the entries as they are: followed through a merge, dropped where either is gone or forgotten, once, under its first day', () => {
    const merged = { ...VERA_TOO, name: undefined, mergedInto: 'pe-b' }
    const gone = person('pe-d', 'Gijs Mulder', { name: undefined, state: 'forgotten', forgottenOn: '2026-10-01' })
    expect(tidyDistinct([
      distinctPair('pe-c', 'pe-a', '2026-10-05'),
      distinctPair('pe-a', 'pe-b', '2026-10-03'),
      distinctPair('pe-b', 'pe-c', '2026-10-01'),
      distinctPair('pe-a', 'pe-d', '2026-10-01'),
      distinctPair('pe-a', 'pe-nobody', '2026-10-01'),
    ], [YARA, VERA, merged, gone])).toEqual([distinctPair('pe-a', 'pe-b', '2026-10-03')])
  })
})

describe('the register, answering', () => {
  it('answers two entries as not the same person, on a day, and changes no entry', () => {
    const answer = done(change(EVERYONE, { kind: 'distinct', a: 'pe-b', b: 'pe-a', on: '2026-10-11' }))
    expect(answer.distinct).toEqual([{ a: 'pe-a', b: 'pe-b', on: '2026-10-11' }])
    expect(answer.distinctChanged).toBe(true)
    expect(answer.people).toEqual(EVERYONE)
    expect([answer.changed, answer.removed, answer.tombstones]).toEqual([[], [], []])
  })

  it('keeps the first day when the same two are answered again, and says nothing moved', () => {
    const held = [distinctPair('pe-a', 'pe-b', '2026-10-01')]
    const answer = done(change(EVERYONE, { kind: 'distinct', a: 'pe-a', b: 'pe-b', on: '2026-10-11' }, held))
    expect(answer.distinct).toEqual(held)
    expect(answer.distinctChanged).toBe(false)
  })

  it('refuses an entry against itself, a bad day, nobody, a redirect and a forgotten entry', () => {
    const merged = { ...VERA_TOO, name: undefined, mergedInto: 'pe-b' }
    const gone = person('pe-d', 'Gijs Mulder', { name: undefined, state: 'forgotten', forgottenOn: '2026-10-01' })
    const people = [YARA, VERA, merged, gone]
    const refusal = (a: string, b: string, on = '2026-10-11') => {
      const answer = change(people, { kind: 'distinct', a, b, on })
      return 'refused' in answer ? answer.refused : undefined
    }
    expect(refusal('pe-a', 'pe-a')).toBe('people.badDistinct')
    expect(refusal('pe-a', 'pe-b', '11 October')).toBe('people.badDay')
    expect(refusal('pe-a', 'pe-nobody')).toBe('people.unknown')
    expect(refusal('pe-a', 'pe-c')).toBe('people.merged')
    expect(refusal('pe-d', 'pe-a')).toBe('people.forgotten')
  })

  it('answers somebody who has left: the signs still compare them', () => {
    const left = { ...VERA, state: 'left' as const, leftOn: '2026-09-30' }
    expect(done(change([YARA, left], { kind: 'distinct', a: 'pe-a', b: 'pe-b', on: '2026-10-11' })).distinct).toHaveLength(1)
  })

  it('takes an answer back, either way round, and takes back one never given as nothing to do', () => {
    const held = [distinctPair('pe-a', 'pe-b', '2026-10-01'), distinctPair('pe-a', 'pe-c', '2026-10-01')]
    const back = done(change(EVERYONE, { kind: 'takeBack', a: 'pe-b', b: 'pe-a' }, held))
    expect(back.distinct).toEqual([held[1]])
    expect(back.distinctChanged).toBe(true)
    const again = done(change(EVERYONE, { kind: 'takeBack', a: 'pe-b', b: 'pe-a' }, back.distinct))
    expect([again.distinct, again.distinctChanged]).toEqual([[held[1]], false])
  })
})

describe('the register, carrying an answer through every other change', () => {
  const held = [distinctPair('pe-a', 'pe-b', '2026-10-01')]

  it('keeps it through a correction, a leave and an addition', () => {
    for (const what of [
      { kind: 'change', id: 'pe-a', patch: { name: 'Yara Kók' } },
      { kind: 'leave', id: 'pe-b', on: '2026-10-11' },
      { kind: 'add', person: { name: 'Vera Kok' } },
    ] as PeopleChange[]) {
      const answer = done(change(EVERYONE, what, held))
      expect([answer.distinct, answer.distinctChanged]).toEqual([held, false])
    }
  })

  it('drops it when either is forgotten, or removed', () => {
    const forgotten = done(change(EVERYONE, { kind: 'forget', id: 'pe-b', on: '2026-10-11' }, held))
    expect([forgotten.distinct, forgotten.distinctChanged]).toEqual([[], true])
    const gone = { ...YARA, name: undefined, state: 'forgotten' as const, forgottenOn: '2026-10-11', leftOn: '2026-10-11' }
    // Held where it should not be — a forgotten half — and dropped by the removal all the same.
    const removed = done(change([gone, VERA], { kind: 'remove', id: 'pe-a' }, held))
    expect([removed.distinct, removed.distinctChanged]).toEqual([[], true])
  })

  it('carries it to the entry kept when either is merged into a third', () => {
    const merged = done(change(EVERYONE, { kind: 'merge', from: 'pe-b', into: 'pe-c' }, held))
    expect(merged.distinct).toEqual([{ a: 'pe-a', b: 'pe-c', on: '2026-10-01' }])
    expect(merged.distinctChanged).toBe(true)
    const other = done(change(EVERYONE, { kind: 'merge', from: 'pe-a', into: 'pe-c' }, held))
    expect(other.distinct).toEqual([{ a: 'pe-b', b: 'pe-c', on: '2026-10-01' }])
  })

  it('drops it when one is merged into its other half: one entry is not two people', () => {
    const merged = done(change(EVERYONE, { kind: 'merge', from: 'pe-b', into: 'pe-a' }, held))
    expect([merged.distinct, merged.distinctChanged]).toEqual([[], true])
  })

  it('keeps one pair where a merge makes two the same, under the first day', () => {
    const two = [distinctPair('pe-a', 'pe-b', '2026-10-05'), distinctPair('pe-a', 'pe-c', '2026-10-01')]
    expect(done(change(EVERYONE, { kind: 'merge', from: 'pe-b', into: 'pe-c' }, two)).distinct).toEqual([{ a: 'pe-a', b: 'pe-c', on: '2026-10-01' }])
  })
})

describe('the register, bringing answers in', () => {
  it('joins the answers carried in to those held', () => {
    const held = [distinctPair('pe-a', 'pe-b', '2026-10-01')]
    const carried = [distinctPair('pe-a', 'pe-c', '2026-10-02')]
    const answer = done(change(EVERYONE, { kind: 'bringIn', people: [], distinct: carried }, held))
    expect(answer.distinct).toEqual([...held, ...carried])
    expect(answer.distinctChanged).toBe(true)
    expect(answer.changed).toEqual([])
  })

  it('drops a pair carried in whose ids were removed here or there: more-forgotten still wins', () => {
    const carried = [distinctPair('pe-a', 'pe-gone', '2026-10-02'), distinctPair('pe-a', 'pe-b', '2026-10-02')]
    const removedHere = done(change(EVERYONE, { kind: 'bringIn', people: [person('pe-gone', 'Ada Verbeek')], distinct: carried }, [], new Set(['pe-gone'])))
    expect(removedHere.distinct).toEqual([carried[1]])
    const removedThere = done(change(EVERYONE, { kind: 'bringIn', people: [], removed: ['pe-b'], distinct: carried }))
    expect(removedThere.distinct).toEqual([])
  })

  it('drops a pair whose half a forgetting carried in forgot, and follows a merge carried in', () => {
    const held = [distinctPair('pe-a', 'pe-b', '2026-10-01')]
    const forgotten = { ...VERA, name: undefined, state: 'forgotten' as const, leftOn: '2026-10-01', forgottenOn: '2026-10-02' }
    expect(done(change(EVERYONE, { kind: 'bringIn', people: [forgotten] }, held)).distinct).toEqual([])
    const merged = { ...VERA, name: undefined, mergedInto: 'pe-c' }
    expect(done(change(EVERYONE, { kind: 'bringIn', people: [merged] }, held)).distinct).toEqual([{ a: 'pe-a', b: 'pe-c', on: '2026-10-01' }])
  })

  it('takes a pair about entries it brings in too, and none about anybody it holds nowhere', () => {
    const carried = [distinctPair('pe-x', 'pe-y', '2026-10-02'), distinctPair('pe-x', 'pe-z', '2026-10-02')]
    const answer = done(change([], { kind: 'bringIn', people: [person('pe-x', 'Lea Vos'), person('pe-y', 'Lea Voss')], distinct: carried }))
    expect(answer.distinct).toEqual([carried[0]])
  })
})
