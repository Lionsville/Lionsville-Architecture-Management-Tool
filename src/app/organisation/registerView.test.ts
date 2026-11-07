// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { FRESH_VIEW, listed } from '../../widgets/kit/listView'
import { translator } from '../../i18n'
import type { RegisterRow } from './register'
import { applicationHow, findingsByRecord, keptIn, weightsOf } from './registerView'
import { coverageSentence, registerWords } from './registerWords'
import type { CheckInstance } from './treeChecks'

const s = translator('en')
const row = (id: string, over: Partial<RegisterRow> = {}): RegisterRow => ({ id, name: id, master: 'a', owner: { kind: 'none' }, drawnIn: [], findings: [], ...over })
const words = registerWords(s, 'en', (path) => (path === 'a' ? 'Landscape' : path))
const instance = (about: string, key: CheckInstance['key']): CheckInstance => ({ key, about, scope: 'a', text: 'x', finding: {} as never, id: about, attributes: {} })

describe('the register, said in one sentence', () => {
  it('says how much of the tree it covers, and who has no owner, in the check\'s own count', () => {
    const rows = [row('a'), row('b', { owner: { kind: 'unit', unitId: 'u' }, ownerUnit: 'Team' }), row('c', { outside: true, party: 'Them', owner: { kind: 'unit', unitId: 'p' } })]
    const said = coverageSentence('applications', rows, [], 4, s)
    expect(said).toContain('3 applications, all kept in 1 of 4 scopes.')
    expect(said).toContain('1 is outside.')
    expect(said).toContain('1 has no owner.')
    expect(said).not.toContain('owned by a domain')
  })

  it('does not read one scope among many as coverage', () => {
    const rows = [row('a'), row('b'), row('c'), row('d', { master: 'z' })]
    expect(keptIn(rows)).toEqual({ scopes: 2, most: 3 })
    expect(coverageSentence('applications', rows, [], 67, s)).toContain('3 of them kept in 1 of 67 scopes')
  })
})

describe('the owner, one field said in words', () => {
  it('reads a unit, a name flagged as not a unit, outside, and nobody', () => {
    expect(words.owner(row('a', { owner: { kind: 'unit', unitId: 'u' }, ownerUnit: 'Team' }))).toBe('Team')
    expect(words.owner(row('a', { owner: { kind: 'named', name: 'Revenue' } }))).toBe('Revenue (not a unit)')
    expect(words.owner(row('a', { outside: true, party: 'Them' }))).toBe('Them (outside)')
    expect(words.owner(row('a'))).toBe('Nobody')
  })
})

describe('a tab as a list', () => {
  const rows = [row('Billing', { category: 'Money' }), row('Dock', { lifecycle: 'retiring', lifecycleDates: { retired: '2027-03-31' }, outside: true })]
  const found = findingsByRecord([instance('Billing', 'check.applicationUnowned'), instance('Dock', 'check.applicationOwnerNamed')])
  const how = applicationHow(words, found, 'en')
  const names = (view: typeof FRESH_VIEW) => listed(rows, view, how).flatMap((group) => group.rows.map((one) => one.name))

  it('finds what a column shows: what Outside says, and what used to find nothing', () => {
    expect(names({ ...FRESH_VIEW, find: 'outside' })).toEqual(['Dock'])
    expect(names({ ...FRESH_VIEW, find: 'money' })).toEqual(['Billing'])
  })

  it('filters by has findings on a fix or review, a note may well be intended', () => {
    expect(names({ ...FRESH_VIEW, filters: { findings: ['yes'] } })).toEqual(['Billing'])
    expect(weightsOf(found.get('Dock'))).toEqual({ fix: 0, review: 0, note: 1 })
  })

  it('groups with a head per value', () => {
    expect(listed(rows, { ...FRESH_VIEW, group: 'lifecycle' }, how).map((one) => one.label)).toEqual(['Live', 'Retiring'])
  })
})
