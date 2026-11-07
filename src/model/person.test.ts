// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A person as the model names one: an id into the register, or text (ADR-0036 §8). */
import { describe, expect, it } from 'vitest'
import {
  isBlankRef, isPersonRef, isPicked, personIdOf, personIdsIn, personRefFromKey, personRefKey, personRefOf, pickedPerson, refText, sameRef,
} from './person'

describe('a reference to a person', () => {
  it('is picked when it names an entry, and text otherwise', () => {
    expect(isPicked(pickedPerson('pe-1'))).toBe(true)
    expect(isPicked('Pia Schulz')).toBe(false)
    expect(isPicked(undefined)).toBe(false)
    expect(isPicked({ person: '' })).toBe(false)
  })

  it('says the id it points at, and none for text', () => {
    expect(personIdOf({ person: 'pe-1' })).toBe('pe-1')
    expect(personIdOf('Operations')).toBeUndefined()
    expect(personIdOf(undefined)).toBeUndefined()
  })

  it('reads a reference out of a file or a call, and nothing that carries more', () => {
    expect(isPersonRef('Operations')).toBe(true)
    expect(isPersonRef({ person: 'pe-1' })).toBe(true)
    expect(isPersonRef({ person: 'pe-1', name: 'Pia Schulz' })).toBe(false)
    expect(isPersonRef({ person: '' })).toBe(false)
    expect(isPersonRef({ person: 3 })).toBe(false)
    expect(isPersonRef(['pe-1'])).toBe(false)
    expect(isPersonRef(null)).toBe(false)
    expect(isPersonRef(7)).toBe(false)
  })
})

describe('the register ids a value names', () => {
  it('finds a reference wherever it sits, and nothing that only looks like one', () => {
    const model = {
      elements: [{ id: 'crm', owner: { person: 'pe-1' } }, { id: 'wms', owner: 'Operations' }],
      decisions: [{ id: 'ad-1', signers: [{ person: 'pe-2' }, 'Board'], note: { person: 'pe-3', name: 'x' } }],
    }
    expect([...personIdsIn(model)].sort()).toEqual(['pe-1', 'pe-2'])
    expect(personIdsIn('pe-1').size).toBe(0)
  })
})

describe('a reference as a field keeps it', () => {
  it('trims text, keeps a picked entry, and is nothing for blank text or no reference at all', () => {
    expect(personRefOf('  Operations ')).toBe('Operations')
    expect(personRefOf('   ')).toBeUndefined()
    expect(personRefOf({ person: 'pe-1' })).toEqual({ person: 'pe-1' })
    expect(personRefOf({ person: 'pe-1', name: 'Pia' })).toBeUndefined()
    expect(personRefOf(7)).toBeUndefined()
    expect(isBlankRef(undefined)).toBe(true)
    expect(isBlankRef(' ')).toBe(true)
    expect(isBlankRef({ person: 'pe-1' })).toBe(false)
  })

  it('says the text of a reference, and nothing of a picked one: its name is the register’s', () => {
    expect(refText('Pia Schulz')).toBe('Pia Schulz')
    expect(refText({ person: 'pe-1' })).toBeUndefined()
  })

  it('tells the same person by id — through a merge — and the same text in any case, never one by the other', () => {
    expect(sameRef({ person: 'pe-1' }, { person: 'pe-1' })).toBe(true)
    expect(sameRef({ person: 'pe-old' }, { person: 'pe-1' }, (id) => (id === 'pe-old' ? 'pe-1' : id))).toBe(true)
    expect(sameRef(' pia schulz', 'Pia Schulz ')).toBe(true)
    expect(sameRef({ person: 'pe-1' }, 'Pia Schulz')).toBe(false)
    expect(sameRef(undefined, undefined)).toBe(false)
  })

  it('goes through one string and back, for a screen that offers values as strings', () => {
    for (const ref of ['Operations', { person: 'pe-1' }] as const) expect(personRefFromKey(personRefKey(ref)!)).toEqual(ref)
    expect(personRefKey(undefined)).toBeUndefined()
    expect(personRefFromKey('{"person": 3}')).toBe('{"person": 3}')
    expect(personRefFromKey('{"person":broken')).toBe('{"person":broken')
  })
})

describe('who recorded a record, among the ids a value names', () => {
  it('finds the entry beside a name, an account and an agent, and in a record that holds nothing else', () => {
    expect([...personIdsIn({ observations: [
      { recordedBy: { name: 'Eva', account: 'sub-1', person: 'pe-1', via: 'An agent' } },
      { recordedBy: { account: 'sub-2', person: 'pe-2' } },
      { recordedBy: { person: 'pe-3' } },
    ] })].sort()).toEqual(['pe-1', 'pe-2', 'pe-3'])
  })

  it('takes nothing else for an id: a name, an account, an empty id, or a person field that is no reference elsewhere', () => {
    expect(personIdsIn({ recordedBy: { name: 'pe-1', account: 'pe-2' } }).size).toBe(0)
    expect(personIdsIn({ recordedBy: { person: '' } }).size).toBe(0)
    expect(personIdsIn({ recordedBy: { person: 7 } }).size).toBe(0)
    expect(personIdsIn({ recordedBy: 'pe-1' }).size).toBe(0)
    expect(personIdsIn({ said: { person: 'pe-1', name: 'Eva' } }).size).toBe(0)
  })
})
