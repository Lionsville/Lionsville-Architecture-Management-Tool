// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The register as a folder and a working file keep it (ADR-0036 §8). */
import { describe, expect, it } from 'vitest'
import type { Person } from '../../../people/person'
import { PEOPLE_FILE_VERSION, PEOPLE_PATH, peopleFileText, readPeopleFile } from './peopleFile'

const pia: Person = { id: 'pe-b', name: 'Pia Schulz', pseudonym: '4K7Q', kind: 'internal', state: 'active' }
const gone: Person = { id: 'pe-a', pseudonym: '7KQM', kind: 'external', state: 'forgotten', leftOn: '2025-06-30', forgottenOn: '2025-09-28' }

describe('the people file', () => {
  it('sits beside the organisation’s settings', () => {
    expect(PEOPLE_PATH).toBe('.lionsville-architecture/people.json')
  })

  it('writes one entry per person in id order, so one register is always the same bytes', () => {
    const text = peopleFileText([pia, gone])
    expect(text).toBe(peopleFileText([gone, pia]))
    expect(JSON.parse(text)).toEqual({ version: PEOPLE_FILE_VERSION, people: [gone, pia] })
    expect(readPeopleFile(text)).toEqual({ kind: 'read', people: [gone, pia] })
  })

  it('keeps the ids the register removed, in id order and only where there are any', () => {
    const text = peopleFileText([pia], ['pe-z', 'pe-c', 'pe-z'])
    expect(JSON.parse(text)).toEqual({ version: PEOPLE_FILE_VERSION, people: [pia], removed: ['pe-c', 'pe-z'] })
    expect(readPeopleFile(text)).toEqual({ kind: 'read', people: [pia], removed: ['pe-c', 'pe-z'] })
    expect(readPeopleFile('{"version":1,"people":[],"removed":["pe-c",7,""]}')).toEqual({ kind: 'read', people: [], removed: ['pe-c'] })
    expect(peopleFileText([pia], [])).toBe(peopleFileText([pia]))
  })

  it('keeps the pairs answered as not the same person, in id order, only where there are any and only over its entries', () => {
    const vera: Person = { id: 'pe-c', name: 'Vera Kok', pseudonym: 'B7KQ', kind: 'internal', state: 'active' }
    const text = peopleFileText([pia, gone, vera], [], [{ a: 'pe-c', b: 'pe-b', on: '2026-10-11' }])
    expect(JSON.parse(text).distinct).toEqual([{ a: 'pe-b', b: 'pe-c', on: '2026-10-11' }])
    expect(readPeopleFile(text)).toEqual({ kind: 'read', people: [gone, pia, vera], distinct: [{ a: 'pe-b', b: 'pe-c', on: '2026-10-11' }] })
    expect(peopleFileText([pia, vera], [], [])).toBe(peopleFileText([pia, vera]))
    // A pair about a forgotten entry, about nobody here, or that is no pair, is none.
    const odd = { version: 1, people: [pia, gone, vera], distinct: [{ a: 'pe-a', b: 'pe-b', on: '2026-10-11' }, { a: 'pe-b', b: 'pe-z', on: '2026-10-11' }, { a: 'pe-b' }, 7] }
    expect(readPeopleFile(JSON.stringify(odd))).toEqual({ kind: 'read', people: [pia, gone, vera] })
  })

  it('reads a file a build before the answers wrote as one with none', () => {
    expect(readPeopleFile(JSON.stringify({ version: 1, people: [pia] }))).toEqual({ kind: 'read', people: [pia] })
  })

  it('reads a file that is not there as absent, and an entry that does not read as nobody', () => {
    expect(readPeopleFile(undefined)).toEqual({ kind: 'absent' })
    expect(readPeopleFile('{"people":[{"id":"pe-x"},{"id":"pe-b","pseudonym":"4K7Q","name":"Pia Schulz"}]}'))
      .toEqual({ kind: 'read', people: [pia] })
  })

  it('never takes a file it cannot read, or one a later build wrote, as one it may write over', () => {
    expect(readPeopleFile('not json')).toEqual({ kind: 'unwritable', people: [], why: 'unreadable' })
    expect(readPeopleFile('{"version":1}')).toEqual({ kind: 'unwritable', people: [], why: 'unreadable' })
    expect(readPeopleFile(JSON.stringify({ version: PEOPLE_FILE_VERSION + 1, people: [pia] })))
      .toEqual({ kind: 'unwritable', people: [pia], why: 'later' })
  })
})
