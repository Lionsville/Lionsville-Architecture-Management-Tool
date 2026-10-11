// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a reference reads as (ADR-0036 §8, §10): the one render every screen
 * that shows a person uses, so a forget made once reaches all of them, and a
 * merged id resolves wherever it is held.
 */
import { describe, expect, it } from 'vitest'
import { translateFrom } from '../i18n/interpolate'
import type { Person } from './person'
import { personText, registerOf, resolvePerson, shownEnglish, shownPerson, shownText, withoutNames } from './shown'
import { DE } from './strings/de'
import { EN } from './strings/en'

const t = translateFrom(EN)

const pia: Person = { id: 'pe-pia', name: 'Pia Schulz', email: 'pia@acme.example', pseudonym: '4K7Q', kind: 'internal', state: 'active' }
const gijs: Person = { id: 'pe-gijs', name: 'Gijs Mulder', pseudonym: 'BCDF', kind: 'internal', state: 'left', leftOn: '2026-08-14' }
const gone: Person = { id: 'pe-gone', pseudonym: '7KQM', kind: 'internal', state: 'forgotten', leftOn: '2025-06-30', forgottenOn: '2025-09-28' }
const lindt: Person = { id: 'pe-lindt', pseudonym: 'GHJK', kind: 'internal', state: 'active', mergedInto: 'pe-pia' }
const twice: Person = { id: 'pe-twice', pseudonym: 'MNPQ', kind: 'internal', state: 'active', mergedInto: 'pe-lindt' }
const loop: Person = { id: 'pe-loop', pseudonym: 'RSTV', kind: 'internal', state: 'active', mergedInto: 'pe-loop' }
const register = registerOf([pia, gijs, gone, lindt, twice, loop])

describe('a reference, through the register', () => {
  it('reads as the name, and as the name of someone who left', () => {
    expect(personText({ person: 'pe-pia' }, register, t)).toBe('Pia Schulz')
    expect(shownPerson({ person: 'pe-gijs' }, register).as).toBe('left')
    expect(personText({ person: 'pe-gijs' }, register, t)).toBe('Gijs Mulder')
  })

  it('reads as the pseudonym once forgotten', () => {
    expect(personText({ person: 'pe-gone' }, register, t)).toBe('Former colleague 7KQM')
    expect(personText({ person: 'pe-gone' }, register, translateFrom(DE))).toBe('Ehemalige Person 7KQM')
  })

  it('follows a merge, and a chain of merges, to the entry kept', () => {
    expect(resolvePerson('pe-lindt', register)).toBe(pia)
    expect(personText({ person: 'pe-twice' }, register, t)).toBe('Pia Schulz')
  })

  it('reads a former colleague for an id the register no longer holds, and for a loop', () => {
    expect(personText({ person: 'pe-removed' }, register, t)).toBe('A former colleague')
    expect(personText({ person: 'pe-loop' }, register, t)).toBe('A former colleague')
  })

  it('reads text as the text, and nothing as nothing', () => {
    expect(personText('Operations', register, t)).toBe('Operations')
    expect(personText(undefined, register, t)).toBe('')
  })

  it('withholds every name where names are withheld, and says the pseudonym instead', () => {
    expect(personText({ person: 'pe-pia' }, register, t, { withhold: true })).toBe('Person 4K7Q')
    expect(personText({ person: 'pe-gone' }, register, t, { withhold: true })).toBe('Former colleague 7KQM')
  })
})

describe('in English, for a protocol answer', () => {
  it('says each case', () => {
    expect(shownEnglish(shownPerson({ person: 'pe-pia' }, register))).toBe('Pia Schulz')
    expect(shownEnglish(shownPerson({ person: 'pe-gone' }, register))).toBe('Former colleague 7KQM')
    expect(shownEnglish(shownPerson({ person: 'pe-pia' }, register, { withhold: true }))).toBe('Person 4K7Q')
    expect(shownEnglish(shownPerson({ person: 'pe-nobody' }, register))).toBe('A former colleague')
    expect(shownEnglish(shownPerson('Ops', register))).toBe('Ops')
    expect(shownText({ as: 'former' }, t)).toBe('A former colleague')
  })
})

describe('the register without names', () => {
  it('holds no name and no address, and keeps every id, state and redirect', () => {
    const nameless = withoutNames([pia, gijs, gone, lindt])
    expect(JSON.stringify(nameless)).not.toMatch(/Pia|Schulz|Gijs|Mulder|acme/)
    expect(nameless.map((one) => [one.id, one.state, one.mergedInto])).toEqual([
      ['pe-pia', 'active', undefined], ['pe-gijs', 'left', undefined], ['pe-gone', 'forgotten', undefined], ['pe-lindt', 'active', 'pe-pia'],
    ])
    expect(personText({ person: 'pe-lindt' }, registerOf(nameless), t)).toBe('Person 4K7Q')
  })
})
