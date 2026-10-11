// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A person as the model names one: an id into the register, or text (ADR-0036 §8). */
import { describe, expect, it } from 'vitest'
import { isPersonRef, isPicked, personIdOf, personIdsIn, pickedPerson } from './person'

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
