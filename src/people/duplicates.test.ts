// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The four signs of a possible duplicate (ADR-0036 §9), checked on every way in. */
import { describe, expect, it } from 'vitest'
import { comparableName, duplicatePairs, editDistance, possibleDuplicates, signBetween } from './duplicates'
import type { Person } from './person'

function person(id: string, name: string, extra: Partial<Person> = {}): Person {
  return { id, name, pseudonym: `C${id}`, kind: 'internal', state: 'active', ...extra }
}

describe('the four signs', () => {
  it('finds the same work address, whatever the case', () => {
    expect(signBetween({ name: 'P. S.', email: 'Pia.Schulz@acme.example' }, { name: 'Someone', email: 'pia.schulz@acme.example ' })).toBe('sameEmail')
  })

  it('finds the same name, ignoring case, accents and spacing', () => {
    expect(signBetween({ name: 'chloe  MARTIN' }, { name: 'Chloé Martin' })).toBe('sameName')
    expect(comparableName('  Zeynep   Arslan-Öz ')).toBe('zeynep arslan oz')
  })

  it('finds names within two letters of each other: Pia Schultz and Pia Schulz', () => {
    expect(signBetween({ name: 'Pia Schultz' }, { name: 'Pia Schulz' })).toBe('nearName')
    expect(signBetween({ name: 'Eva Lindt' }, { name: 'Eva Lind' })).toBe('nearName')
    expect(editDistance('kitten', 'sitting')).toBe(3)
    expect(editDistance('same', 'same')).toBe(0)
  })

  it('does not call two short names near: Ivo and Ida are two people', () => {
    expect(signBetween({ name: 'Ivo' }, { name: 'Ida' })).toBeUndefined()
  })

  it('finds the same family name and first initial', () => {
    expect(signBetween({ name: 'J. Smit' }, { name: 'Julia Smit' })).toBe('familyAndInitial')
    expect(signBetween({ name: 'Noah Smit' }, { name: 'Julia Smit' })).toBeUndefined()
  })

  it('finds nothing without a name to compare', () => {
    expect(signBetween({ name: '' }, { name: 'Julia Smit' })).toBeUndefined()
    expect(signBetween({}, { name: 'Julia Smit', email: 'j@acme.example' })).toBeUndefined()
  })
})

describe('who a newcomer may be', () => {
  const register: Person[] = [
    person('1', 'Pia Schulz', { email: 'pia@acme.example' }),
    person('2', 'Gijs Mulder', { state: 'left', leftOn: '2026-08-14' }),
    { id: '3', pseudonym: 'BCDF', kind: 'internal', state: 'forgotten', forgottenOn: '2026-01-01' },
    { id: '4', pseudonym: 'GHJK', kind: 'internal', state: 'active', mergedInto: '1' },
    person('5', 'Pia Schultze'),
  ]

  it('is everyone a sign points at, strongest first, a leaver included', () => {
    expect(possibleDuplicates({ name: 'Pia Schultz', email: 'pia@acme.example' }, register).map((one) => [one.person.id, one.sign]))
      .toEqual([['1', 'sameEmail'], ['5', 'nearName']])
    expect(possibleDuplicates({ name: 'gijs mulder' }, register).map((one) => one.person.id)).toEqual(['2'])
  })

  it('is never a forgotten entry or a redirect, and never the entry being corrected', () => {
    expect(possibleDuplicates({ name: 'Pia Schulz' }, register, '1').map((one) => one.person.id)).toEqual(['5'])
  })

  it('is never somebody the entry being corrected was answered as not being, and a newcomer is still checked against both', () => {
    const answered = [{ a: '1', b: '5', on: '2026-10-11' }]
    expect(possibleDuplicates({ name: 'Pia Schulz' }, register, '1', answered)).toEqual([])
    expect(possibleDuplicates({ name: 'Pia Schultze' }, register, '5', answered).map((one) => one.person.id)).toEqual([])
    expect(possibleDuplicates({ name: 'Pia Schultz', email: 'pia@acme.example' }, register, undefined, answered).map((one) => one.person.id))
      .toEqual(['1', '5'])
  })
})

describe('the pairs a merge could tidy', () => {
  it('names each pair once, keeping the entry more is known about', () => {
    const pairs = duplicatePairs([
      person('lindt', 'Eva Lindt'),
      person('lind', 'Eva Lind', { email: 'eva@acme.example' }),
      person('gone', 'Eva Lin', { state: 'left', leftOn: '2026-01-01' }),
      person('other', 'Kees Vos'),
    ])
    expect(pairs.map((pair) => [pair.keep.id, pair.drop.id, pair.sign])).toEqual([
      ['lind', 'lindt', 'nearName'],
      ['lindt', 'gone', 'nearName'],
      ['lind', 'gone', 'nearName'],
    ])
  })

  it('leaves out a pair answered as not the same person, either way round, and no other', () => {
    const register = [person('lindt', 'Eva Lindt'), person('lind', 'Eva Lind', { email: 'eva@acme.example' }), person('gone', 'Eva Lin')]
    const pairs = duplicatePairs(register, [{ a: 'lind', b: 'lindt', on: '2026-10-11' }])
    expect(pairs.map((pair) => [pair.keep.id, pair.drop.id])).toEqual([['lindt', 'gone'], ['lind', 'gone']])
  })
})

describe('the pairs over a large register', () => {
  it('are the pairs comparing every entry with every other would give, in the same order, without comparing them all', () => {
    let seed = 11
    const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
    const syllables = ['an', 'be', 'co', 'da', 'el', 'fi', 'go', 'ha', 'in', 'jo', 'ka', 'li', 'mo', 'ne', 'or', 'pa']
    const word = (count: number) => Array.from({ length: count }, () => syllables[Math.floor(random() * syllables.length)]).join('')
    const slips = [
      (name: string) => name.slice(0, 3) + name.slice(4),
      (name: string) => `${name.slice(0, 2)}x${name.slice(2)}`,
      (name: string) => name.toUpperCase(),
      (name: string) => `${name[0]}. ${name.split(' ').at(-1)}`,
      (name: string) => name.replace('a', 'á'),
    ]
    const people: Person[] = []
    for (let at = 0; at < 300; at++) {
      const name = at % 7 === 0 && people.length ? slips[at % slips.length](people[Math.floor(random() * people.length)].name!) : `${word(2)} ${word(2 + (at % 2))}`
      people.push({ id: `pe-${at}`, name, pseudonym: `P${at}`, kind: 'internal', state: 'active', ...(at % 13 === 0 ? { email: 'shared@acme.example' } : {}) })
    }
    people.push({ id: 'pe-five', name: 'abcde', pseudonym: 'F1', kind: 'internal', state: 'active' }, { id: 'pe-fiv2', name: 'axcye', pseudonym: 'F2', kind: 'internal', state: 'active' })
    const everyPair: { keep: string; drop: string; sign: string }[] = []
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const sign = signBetween(people[i], people[j])
        // The one kept is the one with an address, as a merge would keep it.
        const [keep, drop] = people[j].email && !people[i].email ? [people[j], people[i]] : [people[i], people[j]]
        if (sign) everyPair.push({ keep: keep.id, drop: drop.id, sign })
      }
    }
    const order = ['sameEmail', 'sameName', 'nearName', 'familyAndInitial']
    everyPair.sort((one, other) => order.indexOf(one.sign) - order.indexOf(other.sign))
    const found = duplicatePairs(people).map((pair) => ({ keep: pair.keep.id, drop: pair.drop.id, sign: pair.sign }))
    expect(found.length).toBeGreaterThan(40)
    expect(found).toEqual(everyPair)
  })
})
