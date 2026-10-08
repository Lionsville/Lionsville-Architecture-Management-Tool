// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import { addCauseLinked, newObservationProblems, observationBody, observationProblems, recordObservation } from './form'
import type { ObservationFields } from './form'
import { observationTemplate } from './observation'
import type { Analysis, Cause, Observation } from './observation'

const t = translator('en')

const observation = (over: Partial<Observation>): Observation => ({
  id: 'o1', number: 1, title: 'Batch overruns', date: '2026-09-08', impact: 'major', seen: 1, body: '',
  history: [{ date: '2026-09-08', kind: 'recorded' }], ...over,
})
const cause = (over: Partial<Cause>): Cause => ({
  id: 'c1', number: 1, title: 'Window too small', state: 'assumed', body: '', explains: [], ...over,
})
const fields: ObservationFields = {
  title: 'Labels print twice', where: 'Pick station 3', by: 'Shift lead', date: '2026-09-20', impact: 'minor', body: '',
}
const counter = () => {
  let n = 0
  return (prefix: string) => `${prefix}-${++n}`
}

describe('what an observation needs', () => {
  it('names each of the four facts that is missing, and a day after today', () => {
    expect(observationProblems({ title: ' ', where: '', by: 'W.S.', date: '' }, '2026-09-30')).toEqual({ title: 'missing', where: 'missing', date: 'missing' })
    expect(observationProblems({ title: 'x', where: 'y', by: 'z', date: '2026-10-01' }, '2026-09-30')).toEqual({ date: 'future' })
    expect(observationProblems({ title: 'x', where: 'y', by: 'z', date: '2026-09-30' }, '2026-09-30')).toEqual({})
  })
})

describe('the three answers of a new observation', () => {
  it('make one body under the template’s headings, an empty answer leaving its heading', () => {
    expect(observationBody({ saw: ' Two labels. ', evidence: '', affected: 'Packers\n' }, t))
      .toBe('## What we saw\n\nTwo labels.\n\n## Evidence\n\n\n## Who or what it affected\n\nPackers\n')
    expect(observationBody({ saw: '', evidence: '', affected: '' }, t)).toBe(observationTemplate(t))
  })

  it('refuse a new observation that says nobody and nothing was affected, beside the four facts', () => {
    const facts = { title: 'x', where: 'y', by: 'z', date: '2026-09-30' }
    expect(newObservationProblems({ ...facts, affected: ' ' }, '2026-09-30')).toEqual({ affected: 'missing' })
    expect(newObservationProblems({ ...facts, title: '', affected: 'Packers' }, '2026-09-30')).toEqual({ title: 'missing' })
  })
})

describe('recording an observation with its causes', () => {
  const analysis: Analysis = {
    observations: [observation({})],
    causes: [cause({ explains: [{ id: 'o1', strength: 'strong' }] }), cause({ id: 'c2', number: 2, title: 'No owner', root: true })],
  }

  it('makes the observation, the new causes explaining it and the links from existing ones, in one answer', () => {
    const { analysis: next, id } = recordObservation(analysis, {
      fields,
      causes: [
        { kind: 'new', draft: { title: 'The WMS re-sends a split list', why: 'Seen in the log', root: false, strength: 'strong' } },
        { kind: 'new', draft: { title: 'Splits are not modelled', why: '', root: true, strength: 'normal' } },
        { kind: 'existing', causeId: 'c2', strength: 'weak' },
      ],
      makeId: counter(), t,
    })
    expect(id).toBe('ob-1')
    expect(next.observations.at(-1)).toMatchObject({ id: 'ob-1', number: 2, title: 'Labels print twice', where: 'Pick station 3', by: 'Shift lead', date: '2026-09-20', seen: 1 })
    expect(next.causes.map((one) => [one.id, one.number, one.root === true])).toEqual([['c1', 1, false], ['c2', 2, true], ['ca-2', 3, false], ['ca-3', 4, true]])
    expect(next.causes[2].explains).toEqual([{ id: 'ob-1', strength: 'strong' }])
    expect(next.causes[2].body).toContain('Seen in the log')
    expect(next.causes[3].explains).toEqual([{ id: 'ob-1', strength: 'normal' }])
    expect(next.causes[1].explains).toEqual([{ id: 'ob-1', strength: 'weak' }])
    // What was there is untouched.
    expect(next.causes[0]).toEqual(analysis.causes[0])
  })

  it('passes over a cause the scope no longer holds', () => {
    const { analysis: next } = recordObservation(analysis, { fields, causes: [{ kind: 'existing', causeId: 'gone', strength: 'normal' }], makeId: counter(), t })
    expect(next.causes).toEqual(analysis.causes)
    expect(next.observations).toHaveLength(2)
  })
})

describe('a new cause with what it explains and what lies behind it', () => {
  const causes = [cause({}), cause({ id: 'c2', number: 2, title: 'Nobody plans capacity' })]

  it('explains the record it was made from, and each cause behind it explains the new one', () => {
    const next = addCauseLinked(causes, {
      draft: { title: 'The batch grew', why: '', root: false, strength: 'strong' },
      explains: { id: 'c1' }, behind: [{ causeId: 'c2', strength: 'weak' }], id: 'n', t,
    })
    expect(next.find((one) => one.id === 'n')).toMatchObject({ number: 3, explains: [{ id: 'c1', strength: 'strong' }] })
    expect(next.find((one) => one.id === 'c2')!.explains).toEqual([{ id: 'n', strength: 'weak' }])
  })

  it('keeps the scope of a cause below it explains, and a root cause takes nothing behind it', () => {
    const next = addCauseLinked(causes, {
      draft: { title: 'No shared message standard', why: '', root: true, strength: 'normal' },
      explains: { id: 'x9', scope: 'acme/warehouse' }, behind: [{ causeId: 'c2', strength: 'weak' }], id: 'n', t,
    })
    expect(next.find((one) => one.id === 'n')).toMatchObject({ root: true, explains: [{ id: 'x9', scope: 'acme/warehouse', strength: 'normal' }] })
    expect(next.find((one) => one.id === 'c2')!.explains).toEqual([])
  })
})
