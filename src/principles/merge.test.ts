// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { transaction } from '../model/commands'
import { citationList, commentList, fromArrays, principlesOf } from '../model/normalised'
import type { Principle } from '../model/principle'
import { apply } from '../model/reducer'
import { principleMerge } from './merge'

const principle = (id: string, number: number, aspects = 1): Principle => ({
  id, number, title: id, statement: `${id} says`, groups: [], regime: 'flexible', status: 'candidate', lastAspect: aspects,
  aspects: Array.from({ length: aspects }, (_, at) => ({ id: `${id}-a${at + 1}`, number: at + 1, text: `${id} ${at + 1}`, nature: 'design' as const })),
})

const model = fromArrays({
  name: 'Scope', elements: [], relations: [], diagrams: [],
  decisions: [],
  principles: [principle('pr-a', 1, 2), principle('pr-b', 2, 2)],
  observations: [{ id: 'ob-1', number: 1, title: 'Seen', date: '2026-10-01', impact: 'minor', seen: 1, body: '', history: [] }],
  citations: [
    { id: 'ci-1', about: { kind: 'observation', id: 'ob-1' }, principle: { scope: 'here', id: 'pr-b' }, aspect: 2, stance: 'holds', on: '2026-10-01' },
    { id: 'ci-2', about: { kind: 'observation', id: 'ob-1' }, principle: { scope: 'here', id: 'pr-a' }, stance: 'chafes', on: '2026-10-01' },
    { id: 'ci-3', about: { kind: 'observation', id: 'ob-1' }, principle: { scope: 'here', id: 'pr-b' }, stance: 'chafes', on: '2026-10-02' },
  ],
  comments: [{ id: 'cm-1', about: { kind: 'principle', id: 'pr-b' }, by: { person: 'pe-1' }, at: '2026-10-01T10:00:00Z', body: 'Said' }],
})

describe('one principle absorbing another', () => {
  const merged = principleMerge(model, 'here', 'pr-a', ['pr-b'])!
  const after = apply(model, transaction(merged.commands))
  if (!after.ok) throw new Error(after.reason)

  it('keeps the absorbed one as history and renumbers its aspects after the survivor\'s', () => {
    expect(principlesOf(after.model)['pr-b'].mergedInto).toBe('pr-a')
    expect(principlesOf(after.model)['pr-a'].aspects.map((one) => one.number)).toEqual([1, 2, 3, 4])
    expect(merged.renumbered).toEqual([{ from: 'pr-b', aspect: 1, now: 3 }, { from: 'pr-b', aspect: 2, now: 4 }])
  })

  it('brings this scope\'s citations along, under the new number, once each', () => {
    expect(citationList(after.model).map((one) => [one.id, one.principle.id, one.aspect])).toEqual([['ci-1', 'pr-a', 4], ['ci-2', 'pr-a', undefined]])
  })

  it('brings their comments along', () => {
    expect(commentList(after.model)[0]).toMatchObject({ id: 'cm-1', about: { kind: 'principle', id: 'pr-a' } })
  })

  it('is nothing without a survivor or something to absorb', () => {
    expect(principleMerge(model, 'here', 'pr-x', ['pr-b'])).toBeUndefined()
    expect(principleMerge(model, 'here', 'pr-a', ['pr-a', 'pr-x'])).toBeUndefined()
  })
})
