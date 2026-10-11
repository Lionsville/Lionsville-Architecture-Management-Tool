// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The retention policy, and *This is me* (ADR-0036 §10, §11). */
import { describe, expect, it } from 'vitest'
import { meIn, meOf, mePatch } from './me'
import type { Person } from './person'
import { DEFAULT_POLICY, dueOn, forgetDay, policyOf, policyPatch, removeDay } from './policy'
import { registerOf } from './shown'

const left: Person = { id: 'pe-left', name: 'Gijs Mulder', pseudonym: 'BCDF', kind: 'internal', state: 'left', leftOn: '2026-08-14' }
const gone: Person = { id: 'pe-gone', pseudonym: '7KQM', kind: 'internal', state: 'forgotten', leftOn: '2024-01-01', forgottenOn: '2024-04-01' }
const here: Person = { id: 'pe-here', name: 'Ada Verbeek', pseudonym: 'GHJK', kind: 'internal', state: 'active' }
const redirect: Person = { id: 'pe-was', pseudonym: 'MNPQ', kind: 'internal', state: 'left', leftOn: '2020-01-01', mergedInto: 'pe-here' }

describe('the policy', () => {
  it('is the owner’s numbers where nobody set it', () => {
    expect(policyOf({})).toEqual({ keepNameDays: 90, removeAfterDays: 730, agentsSee: 'names' })
    expect(policyOf({ people: 'not a policy' })).toEqual(DEFAULT_POLICY)
  })

  it('reads what was set, and the default for anything that is no value it could be', () => {
    expect(policyOf({ people: { keepNameDays: 30, removeAfterDays: 365, agentsSee: 'pseudonyms' } }))
      .toEqual({ keepNameDays: 30, removeAfterDays: 365, agentsSee: 'pseudonyms' })
    expect(policyOf({ people: { keepNameDays: -1, removeAfterDays: 1.5, agentsSee: 'everything' } })).toEqual(DEFAULT_POLICY)
  })

  it('is changed by a patch under its key, which keeps only values it could be', () => {
    expect(policyPatch({ keepNameDays: 30 })).toEqual({ people: { keepNameDays: 30 } })
    expect(policyPatch({ removeAfterDays: 10, agentsSee: 'pseudonyms' })).toEqual({ people: { removeAfterDays: 10, agentsSee: 'pseudonyms' } })
    expect(policyPatch({ agentsSee: 'all' as never })).toEqual({ people: {} })
  })

  it('keeps a period longer than a century as a century, never as the default, which would forget sooner than asked', () => {
    expect(policyPatch({ keepNameDays: 99_999 })).toEqual({ people: { keepNameDays: 36_500 } })
    expect(policyOf({ people: { keepNameDays: 99_999, removeAfterDays: 50_000 } })).toMatchObject({ keepNameDays: 36_500, removeAfterDays: 36_500 })
  })

  it('says the day a name is forgotten and the day an entry goes', () => {
    expect(forgetDay(left, DEFAULT_POLICY)).toBe('2026-11-12')
    expect(forgetDay(here, DEFAULT_POLICY)).toBeUndefined()
    expect(removeDay(gone, DEFAULT_POLICY)).toBe('2026-04-01')
    expect(removeDay(left, DEFAULT_POLICY)).toBeUndefined()
  })

  it('says who is due on a day, and never a redirect', () => {
    const people = [left, gone, here, redirect]
    expect(dueOn(people, DEFAULT_POLICY, '2026-10-11')).toEqual({ forget: [], remove: ['pe-gone'] })
    expect(dueOn(people, DEFAULT_POLICY, '2026-11-12')).toEqual({ forget: ['pe-left'], remove: ['pe-gone'] })
    expect(dueOn(people, DEFAULT_POLICY, '2026-03-31')).toEqual({ forget: [], remove: [] })
  })
})

describe('This is me', () => {
  it('is read from the person’s own settings, and said back as a patch', () => {
    expect(meOf({ people: { me: 'pe-here' } })).toBe('pe-here')
    expect(meOf({ people: { me: '' } })).toBeUndefined()
    expect(meOf({ people: ['pe-here'] })).toBeUndefined()
    expect(meOf({})).toBeUndefined()
    expect(mePatch('pe-here')).toEqual({ people: { me: 'pe-here' } })
    expect(mePatch(undefined)).toEqual({ people: { me: null } })
  })

  it('is the entry followed through a merge, and nobody once it is forgotten or gone', () => {
    const register = registerOf([left, gone, here, redirect])
    expect(meIn('pe-was', register)).toBe(here)
    expect(meIn('pe-gone', register)).toBeUndefined()
    expect(meIn('pe-nobody', register)).toBeUndefined()
    expect(meIn(undefined, register)).toBeUndefined()
  })
})
