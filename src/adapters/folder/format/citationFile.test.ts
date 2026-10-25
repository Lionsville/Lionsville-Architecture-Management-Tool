// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Citation } from '../../../model/citable'
import { citationFiles, citationFileUnreadable, citationsFrom, citationsPath, citingOf, isCitationsPath } from './citationFile'

const one: Citation = { id: 'ci-1', about: { kind: 'decision', id: 'adr 1' }, principle: { scope: '', id: 'pr-1' }, aspect: 2, stance: 'deviates', reason: 'Speed first', on: '2026-10-25' }
const two: Citation = { id: 'ci-2', about: { kind: 'observation', id: 'ob-1' }, principle: { scope: 'acme/rail', id: 'pr-7' }, stance: 'chafes', on: '2026-10-24' }

describe('a record\'s citations as a file (ADR-0041 §14)', () => {
  it('is named by the record it is about, whatever its id holds, which no scope can be called', () => {
    expect(citationsPath(one.about)).toBe('_citations/decision-adr%201.json')
    expect(citingOf('_citations/decision-adr%201.json')).toEqual(one.about)
    expect(isCitationsPath('_citations/README.md')).toBe(false)
    expect(isCitationsPath('_citations/nothing-x.json')).toBe(false)
  })

  it('reads back what it wrote, one file per citing record', () => {
    const files = citationFiles({ citations: [one, two] })
    expect(files.map((file) => file.path)).toEqual(['_citations/decision-adr%201.json', '_citations/observation-ob-1.json'])
    const text = new Map(files.map((file) => [file.path, file.text]))
    expect(citationsFrom([...text.keys()], (path) => text.get(path)).citations).toEqual([one, two])
  })

  it('passes over a row with no principle, a stance it does not know, or no day, and says a file that is not a list', () => {
    const text = JSON.stringify([{ id: 'a', stance: 'holds', on: '2026-10-25' }, { id: 'b', principle: { id: 'pr-1' }, stance: 'glows', on: '2026-10-25' }, { id: 'c', principle: { id: 'pr-1' }, stance: 'holds' }, { id: 'd', principle: { id: 'pr-1' }, stance: 'holds', on: '2026-10-25' }])
    expect(citationsFrom(['_citations/observation-ob-1.json'], () => text).citations?.map((row) => [row.id, row.principle.scope])).toEqual([['d', '']])
    expect(citationFileUnreadable('{}')).toBe(true)
    expect(citationFileUnreadable(undefined)).toBe(false)
  })
})
