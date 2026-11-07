// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Person } from '../people/person'
import { registerOf } from '../people/shown'
import { isMine, mineCaption, mineOf, whoRecords } from './recordedBy'

describe('who records (ADR-0038, amended §10)', () => {
  it('is the account where the source has accounts, with the entry it is linked to', () => {
    expect(whoRecords({ id: 'acc-1', name: 'Ada' }, { id: 'pe-1', name: 'Ada Example' }))
      .toEqual({ account: 'acc-1', person: 'pe-1' })
    expect(whoRecords({ id: 'acc-1', name: 'Ada' }, undefined)).toEqual({ name: 'Ada', account: 'acc-1' })
  })

  it('is This is me on a source with no accounts', () => {
    expect(whoRecords(undefined, { id: 'pe-1', name: 'Ada Example' })).toEqual({ person: 'pe-1' })
  })

  it('is nobody with neither, rather than a word that names no one', () => {
    expect(whoRecords(undefined, undefined)).toBeUndefined()
    expect(whoRecords(undefined, { id: 'pe-1', name: '' })).toBeUndefined()
  })

  it('says the agent an agent recorded through', () => {
    expect(whoRecords(undefined, { id: 'pe-1', name: 'Ada' }, 'An agent')).toEqual({ person: 'pe-1', via: 'An agent' })
  })
})

describe('mine', () => {
  const entry = (id: string, name: string | undefined, over: Partial<Person> = {}): Person => ({
    id, ...(name ? { name } : {}), pseudonym: `Code ${id}`, kind: 'internal', state: 'active', ...over,
  })
  const register = registerOf([
    entry('pe-1', 'Anna de Vries'),
    entry('pe-old', undefined, { mergedInto: 'pe-1' }),
    entry('pe-2', 'Anna de Vries'),
    entry('pe-gone', undefined, { state: 'forgotten', pseudonym: 'Former colleague 4K7Q', forgottenOn: '2026-10-01' }),
    entry('pe-left', 'Bo Jansen', { state: 'left', leftOn: '2026-09-01' }),
  ])
  const mine = (over: { account?: { id: string; name: string }; me?: string } = {}) => mineOf(over, register)
  const ofAccount = (name: string) => mine({ account: { id: 'acc-1', name } })
  const ofEntry = mine({ me: 'pe-1' })

  it('is recorded by my account, by the person I am, or seen by that person', () => {
    expect(isMine({ recordedBy: { name: 'Ada', account: 'acc-1' } }, ofAccount('Ada'))).toBe(true)
    expect(isMine({ recordedBy: { name: 'Ada', person: 'pe-1' } }, ofEntry)).toBe(true)
    expect(isMine({ by: { person: 'pe-1' } }, ofEntry)).toBe(true)
  })

  it('is not somebody else\'s, or anything with nobody said', () => {
    expect(isMine({ recordedBy: { name: 'Bo Jansen', account: 'acc-2' } }, { ...ofAccount('Anna de Vries'), person: 'pe-1' })).toBe(false)
    expect(isMine({ by: 'Bo Jansen' }, ofAccount('Anna de Vries'))).toBe(false)
    expect(isMine({ recordedBy: { name: 'Anna de Vries', person: 'pe-1' }, by: 'Anna de Vries' }, mine())).toBe(false)
    expect(isMine({}, ofEntry)).toBe(false)
  })

  describe('a name as typed', () => {
    it('counts in any order, with case, diacritics and punctuation folded', () => {
      const me = ofAccount('De Vries, Anna')
      for (const by of ['Anna de Vries', 'ANNA DE VRIES', 'de vries, anna', 'Anna de Vries (told at the stand-up)', 'Ánna dé Vriës', 'Anna, de; Vries.']) {
        expect(isMine({ by }, me)).toBe(true)
      }
    })

    it('is compared to my entry\'s name as well as my account\'s', () => {
      const me = mine({ account: { id: 'acc-1', name: 'A. Vries' }, me: 'pe-1' })
      expect(isMine({ by: 'Anna de Vries' }, me)).toBe(true)
      expect(isMine({ by: 'A Vries' }, me)).toBe(true)
    })

    it('wants every word, each whole', () => {
      const me = ofAccount('Anna de Vries')
      expect(isMine({ by: 'Anna Vries' }, me)).toBe(false)
      expect(isMine({ by: 'Annabel de Vries' }, me)).toBe(false)
      expect(isMine({ by: 'Anna de Vriesland' }, me)).toBe(false)
      expect(isMine({ by: '' }, me)).toBe(false)
    })

    it('counts for each person a text names', () => {
      const by = 'Anna de Vries and Bo Jansen'
      expect(isMine({ by }, ofAccount('Anna de Vries'))).toBe(true)
      expect(isMine({ by }, ofAccount('Jansen, Bo'))).toBe(true)
      expect(isMine({ by }, ofAccount('Piet Bakker'))).toBe(false)
    })

    it('never matches a name of fewer than two words, which would claim everyone who shares it', () => {
      for (const name of ['Anna', 'Anna ', 'Anna,', 'Anna -', 'Anne-Marie', 'anna.devries@example.org']) {
        expect(isMine({ by: `${name} de Vries` }, ofAccount(name))).toBe(false)
        expect(isMine({ recordedBy: { name: `${name} de Vries` } }, ofAccount(name))).toBe(false)
      }
    })

    it('is not read off a person picked: that is answered by the entry', () => {
      expect(isMine({ by: { person: 'pe-2' } }, ofEntry)).toBe(false)
    })
  })

  describe('who logged it', () => {
    it('counts by name where the account differs', () => {
      expect(isMine({ recordedBy: { name: 'De Vries, Anna', account: 'acc-2' } }, ofAccount('Anna de Vries'))).toBe(true)
    })

    it('leaves a namesake with an entry of their own out, whose name is the same words', () => {
      expect(isMine({ recordedBy: { name: 'Anna de Vries', account: 'acc-2', person: 'pe-2' } }, ofEntry)).toBe(false)
    })
  })

  describe('through the register', () => {
    it('follows a merge from a record\'s id and from mine', () => {
      expect(isMine({ recordedBy: { name: 'Anyone', person: 'pe-old' } }, ofEntry)).toBe(true)
      expect(isMine({ by: { person: 'pe-old' } }, ofEntry)).toBe(true)
      expect(isMine({ by: { person: 'pe-1' } }, mine({ me: 'pe-old' }))).toBe(true)
      expect(isMine({ by: 'Anna de Vries' }, mine({ me: 'pe-old' }))).toBe(true)
    })

    it('reads a name while the entry has left, as the register shows it', () => {
      expect(isMine({ by: 'Bo Jansen' }, mine({ me: 'pe-left' }))).toBe(true)
    })

    it('makes nobody of a forgotten entry, and of its pseudonym', () => {
      const me = mine({ me: 'pe-gone' })
      expect(me.person).toBeUndefined()
      expect(me.names).toEqual([])
      expect(isMine({ by: 'Former colleague 4K7Q' }, me)).toBe(false)
      expect(isMine({ by: { person: 'pe-gone' } }, me)).toBe(false)
    })

    it('connects a name kept beside a forgotten entry to nobody', () => {
      expect(isMine({ recordedBy: { name: 'Anna de Vries', person: 'pe-gone' } }, ofAccount('Anna de Vries'))).toBe(false)
      // A forgotten entry and one the register no longer holds read alike.
      expect(isMine({ recordedBy: { name: 'Anna de Vries', person: 'pe-removed' } }, ofAccount('Anna de Vries'))).toBe(false)
    })

    it('compares no name where names are withheld, and still every id', () => {
      const withheld = mineOf({ account: { id: 'acc-1', name: 'Anna de Vries' }, me: 'pe-1' }, register, { withhold: true })
      expect(isMine({ by: 'Anna de Vries' }, withheld)).toBe(false)
      expect(isMine({ recordedBy: { name: 'Anna de Vries' } }, withheld)).toBe(false)
      expect(isMine({ by: { person: 'pe-old' } }, withheld)).toBe(true)
      expect(isMine({ recordedBy: { name: 'x', account: 'acc-1' } }, withheld)).toBe(true)
    })

    it('takes an id as itself, and a name for the account alone, with no register to ask', () => {
      const me = mineOf({ account: { id: 'acc-1', name: 'Anna de Vries' }, me: 'pe-1' }, undefined)
      expect(isMine({ by: { person: 'pe-1' } }, me)).toBe(true)
      expect(isMine({ by: { person: 'pe-old' } }, me)).toBe(false)
      expect(isMine({ by: 'Anna de Vries' }, me)).toBe(true)
    })

    it('asks nothing of the register per row but a lookup', () => {
      class Lookups extends Map<string, Person> {
        override values(): never { throw new Error('a row walked the register') }
        override forEach(): never { throw new Error('a row walked the register') }
        override entries(): never { throw new Error('a row walked the register') }
        override [Symbol.iterator](): never { throw new Error('a row walked the register') }
      }
      const large = new Lookups()
      large.set('pe-1', entry('pe-1', 'Anna de Vries'))
      large.set('pe-old', entry('pe-old', undefined, { mergedInto: 'pe-1' }))
      const me = mineOf({ me: 'pe-1' }, large)
      expect(isMine({ by: 'Anna de Vries' }, me)).toBe(true)
      expect(isMine({ by: { person: 'pe-old' } }, me)).toBe(true)
    })
  })

  describe('what the toolbar says', () => {
    it('says nobody is me where nobody is said, found or not', () => {
      expect(mineCaption(mine(), false)).toBe('nobody')
    })

    it('says nothing once it has found something', () => {
      expect(mineCaption(ofEntry, true)).toBeUndefined()
      expect(mineCaption(ofAccount('Anna de Vries'), true)).toBeUndefined()
    })

    it('says what it counts where it found nothing, and leaves the entry out for an account linked to none', () => {
      expect(mineCaption(ofEntry, false)).toBe('counts')
      expect(mineCaption(mine({ account: { id: 'acc-1', name: 'Anna de Vries' }, me: 'pe-1' }), false)).toBe('counts')
      expect(mineCaption(ofAccount('Anna de Vries'), false)).toBe('noEntry')
    })
  })
})
