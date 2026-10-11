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
