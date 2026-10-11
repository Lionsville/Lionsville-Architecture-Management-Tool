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
})
