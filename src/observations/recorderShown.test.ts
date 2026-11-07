// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a recorder reads as, and what a copy carries of one (ADR-0036 §10,
 * ADR-0038 §10, amended 7 November 2026): an entry answers wherever there is
 * one, through the one render a forget reaches; the name stored beside it is
 * never read.
 */
import { describe, expect, it } from 'vitest'
import type { Person } from '../people/person'
import { registerOf, shownEnglish } from '../people/shown'
import type { RecordedBy } from '../model/observation'
import { recorderInCopy, recorderShown, whoRecords } from './recordedBy'

const entry = (id: string, name: string | undefined, over: Partial<Person> = {}): Person => ({
  id, ...(name ? { name } : {}), pseudonym: `Q${id.length}Z7`, kind: 'internal', state: 'active', ...over,
})
const register = registerOf([
  entry('pe-mira', 'Mira Kuiper'),
  entry('pe-left', 'Lode Smit', { state: 'left', leftOn: '2026-09-01' }),
  entry('pe-gone', undefined, { state: 'forgotten', pseudonym: '4K7Q', forgottenOn: '2026-10-01' }),
  entry('pe-old', undefined, { mergedInto: 'pe-mira' }),
])
const read = (by: RecordedBy, withhold = false, source?: Parameters<typeof recorderShown>[3]) => {
  const shown = recorderShown(by, register, { withhold }, source)
  return shown === undefined ? undefined : shown.as === 'nameWithheld' ? shown.as : shownEnglish(shown)
}

describe('what a recorder reads as', () => {
  it('reads through the entry, never the name stored beside it', () => {
    expect(read({ name: 'Stored Words', account: 'sub-1', person: 'pe-mira' })).toBe('Mira Kuiper')
    expect(read({ name: 'Stored Words', person: 'pe-left' })).toBe('Lode Smit')
  })

  it('is the pseudonym once forgotten, a former colleague once removed, and the kept entry after a merge', () => {
    expect(read({ name: 'Stored Words', person: 'pe-gone' })).toBe('Former colleague 4K7Q')
    expect(read({ name: 'Stored Words', person: 'pe-removed' })).toBe('A former colleague')
    expect(read({ name: 'Stored Words', person: 'pe-old' })).toBe('Mira Kuiper')
  })

  it('is the withheld form under a pseudonym policy', () => {
    expect(read({ name: 'Stored Words', person: 'pe-mira' }, true)).toMatch(/^Person /)
  })

  it('asks the source about an account with no entry on the record', () => {
    const source = (account: string) => ({ 'sub-linked': { person: 'pe-gone' }, 'sub-renamed': { name: 'Erased person 12' } } as Record<string, { person?: string; name?: string }>)[account]
    expect(read({ name: 'Stored Words', account: 'sub-linked' }, false, source)).toBe('Former colleague 4K7Q')
    expect(read({ name: 'Stored Words', account: 'sub-renamed' }, false, source)).toBe('Erased person 12')
    expect(read({ name: 'Stored Words', account: 'sub-silent' }, false, source)).toBe('Stored Words')
  })

  it('takes the entry on the record before anything a source says', () => {
    expect(read({ account: 'sub-1', person: 'pe-mira' }, false, () => ({ person: 'pe-gone', name: 'Other' }))).toBe('Mira Kuiper')
  })

  it('reads a record with no name, and says nothing where nothing answers', () => {
    expect(read({ person: 'pe-mira' })).toBe('Mira Kuiper')
    expect(read({ account: 'sub-silent' })).toBeUndefined()
    expect(read({ via: 'An agent' })).toBeUndefined()
  })

  it('leaves a name out where names are withheld and no entry can give a pseudonym, and says so', () => {
    expect(read({ name: 'Stored Words', account: 'sub-1' }, true)).toBe('nameWithheld')
    expect(read({ name: 'Stored Words', account: 'sub-1' }, true, () => ({ name: 'Erased person 12' }))).toBe('nameWithheld')
    expect(read({ account: 'sub-1' }, true)).toBeUndefined()
  })
})

describe('who records, where an entry answers', () => {
  it('writes no name beside it', () => {
    expect(whoRecords({ id: 'sub-1', name: 'Mira' }, { id: 'pe-mira', name: 'Mira Kuiper' }, 'An agent'))
      .toEqual({ account: 'sub-1', person: 'pe-mira', via: 'An agent' })
    expect(whoRecords(undefined, { id: 'pe-mira', name: 'Mira Kuiper' })).toEqual({ person: 'pe-mira' })
  })

  it('still writes the account\'s name where nothing else would say who', () => {
    expect(whoRecords({ id: 'sub-1', name: 'Mira' }, undefined)).toEqual({ name: 'Mira', account: 'sub-1' })
  })
})

describe('what a copy carries of a recorder', () => {
  const both: RecordedBy = { name: 'Stored Words', account: 'sub-1', person: 'pe-mira', via: 'An agent' }

  it('without names, keeps the entry and the agent and neither the name nor the account', () => {
    expect(recorderInCopy(both, { nameless: true })).toEqual({ person: 'pe-mira', via: 'An agent' })
    expect(recorderInCopy({ name: 'Stored Words', account: 'sub-1', via: 'An agent' }, { nameless: true })).toEqual({ via: 'An agent' })
  })

  it('without names, keeps no record where nothing is left', () => {
    expect(recorderInCopy({ name: 'Stored Words', account: 'sub-1' }, { nameless: true })).toBeUndefined()
  })

  it('with names, leaves the account behind: it means something only at the source that keeps it', () => {
    expect(recorderInCopy({ name: 'Stored Words', account: 'sub-1' }, {})).toEqual({ name: 'Stored Words' })
  })

  it('with names, carries the entry where one answers rather than the name beside it', () => {
    expect(recorderInCopy(both, {})).toEqual({ person: 'pe-mira', via: 'An agent' })
    expect(recorderInCopy({ name: 'Stored Words', account: 'sub-1' }, { source: () => ({ person: 'pe-mira' }) })).toEqual({ person: 'pe-mira' })
    expect(recorderInCopy({ name: 'Stored Words', account: 'sub-1' }, { source: () => ({ name: 'Erased person 12' }) })).toEqual({ name: 'Erased person 12' })
  })
})
