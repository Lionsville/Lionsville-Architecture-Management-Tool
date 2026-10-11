// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A list of people brought in, each row through the duplicate check (ADR-0036 §9). */
import { describe, expect, it } from 'vitest'
import { matchRows, newPersonOf, readCsv } from './csv'
import type { Person } from './person'

const register: Person[] = [
  { id: 'pe-pia', name: 'Pia Schulz', email: 'pia@acme.example', pseudonym: '4K7Q', kind: 'internal', state: 'active' },
  { id: 'pe-ivo1', name: 'Ivo Peters', pseudonym: 'BCDF', kind: 'internal', state: 'active' },
  { id: 'pe-ivo2', name: 'Ivo Peters', pseudonym: 'GHJK', kind: 'external', state: 'active' },
  { id: 'pe-kees', name: 'Kees Vos', pseudonym: 'MNPQ', kind: 'internal', state: 'active' },
]

describe('reading the rows', () => {
  it('reads name, address and kind in that order where no row names the columns', () => {
    expect(readCsv('Ada Verbeek,ada@acme.example,internal\nBram de Wit,,extern\n\n')).toEqual([
      { line: 1, name: 'Ada Verbeek', email: 'ada@acme.example', kind: 'internal' },
      { line: 2, name: 'Bram de Wit', kind: 'external' },
    ])
  })

  it('reads the columns a heading names, with semicolons as a Dutch spreadsheet saves them', () => {
    expect(readCsv('\uFEFFSoort;Naam;E-mail\r\nextern;"de Graaf; Fleur";fleur@acme.example\r\nIntern;Inge Postma;\r\n')).toEqual([
      { line: 2, name: 'de Graaf; Fleur', email: 'fleur@acme.example', kind: 'external' },
      { line: 3, name: 'Inge Postma', kind: 'internal' },
    ])
  })

  it('reads a quote inside a quoted cell, and a heading with no address column', () => {
    expect(readCsv('name\n"Rik ""the"" Smeets"')).toEqual([{ line: 2, name: 'Rik "the" Smeets' }])
    expect(readCsv('')).toEqual([])
  })
})

describe('each row against the register', () => {
  it('matches the one entry of an address or a name, flags who may be there, and adds nobody twice', () => {
    const rows = readCsv([
      'Pia S.,pia@acme.example',
      'Kees Vos',
      'Ivo Peters',
      'Pia Schultz',
      'Sara Kaya,sara@acme.example',
      'Sara Kaya',
      ',nobody@acme.example',
      'Tim de Boer,not an address',
    ].join('\n'))
    const matched = matchRows(rows, register)
    expect(matched.map((one) => one.as)).toEqual(['matched', 'matched', 'flagged', 'flagged', 'new', 'flagged', 'invalid', 'invalid'])
    expect(matched[0].as === 'matched' && matched[0].person.id).toBe('pe-pia')
    expect(matched[1].as === 'matched' && matched[1].person.id).toBe('pe-kees')
    expect(matched[2].as === 'flagged' && matched[2].candidates.map((one) => one.person.id)).toEqual(['pe-ivo1', 'pe-ivo2'])
    expect(matched[5].as === 'flagged' && matched[5].candidates.map((one) => one.person.name)).toEqual(['Sara Kaya'])
    expect(matched[6].as === 'invalid' && matched[6].why).toBe('noName')
    expect(matched[7].as === 'invalid' && matched[7].why).toBe('badEmail')
  })

  it('makes a row the register’s kind of newcomer', () => {
    expect(newPersonOf({ line: 1, name: 'Ada', email: 'ada@acme.example', kind: 'external' })).toEqual({ name: 'Ada', email: 'ada@acme.example', kind: 'external' })
    expect(newPersonOf({ line: 1, name: 'Ada' })).toEqual({ name: 'Ada' })
  })
})
