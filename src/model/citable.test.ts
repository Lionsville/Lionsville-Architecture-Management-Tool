// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { carryCitations, CITING_KINDS, citationPrincipleRefusal, citationShapeRefusal, stancesOf } from './citable'
import type { Citation } from './citable'
import { fromArrays } from './normalised'

const model = fromArrays({
  name: 'Acme', elements: [], relations: [], diagrams: [],
  observations: [{ id: 'ob-1', number: 1, title: 'Seen', date: '2026-10-01', impact: 'minor', seen: 1, body: '', history: [] }],
})
const citation = (over: Partial<Citation> = {}): Citation => ({
  id: 'ci-1', about: { kind: 'observation', id: 'ob-1' }, principle: { scope: '', id: 'pr-1' }, stance: 'holds', on: '2026-10-25', ...over,
})

describe('which records cite, with which stances (ADR-0041 §7)', () => {
  it('is one table: a decision supports or departs, a design, plan or solution supports, an observation holds, chafes or misses', () => {
    expect(CITING_KINDS).toEqual(['decision', 'element', 'transition', 'solution', 'observation'])
    expect(stancesOf('decision')).toEqual(['supports', 'deviates'])
    expect(stancesOf('element')).toEqual(['supports'])
    expect(stancesOf('observation')).toEqual(['holds', 'chafes', 'missing'])
  })

  it('refuses a stance the kind does not take, a record the scope does not hold, and a departure with no reason', () => {
    expect(citationShapeRefusal(model, citation())).toBeUndefined()
    expect(citationShapeRefusal(model, citation({ stance: 'supports' }))).toBe('notCitable')
    expect(citationShapeRefusal(model, citation({ about: { kind: 'diagram', id: 'd1' } }))).toBe('notCitable')
    expect(citationShapeRefusal(model, citation({ about: { kind: 'observation', id: 'ob-9' } }))).toBe('unknownRecord')
    const decided = fromArrays({ name: 'Acme', elements: [], relations: [], diagrams: [], decisions: [{ id: 'adr-1', number: 1, title: 'T', status: 'proposed', date: '2026-10-01', body: '' } as never] })
    expect(citationShapeRefusal(decided, citation({ about: { kind: 'decision', id: 'adr-1' }, stance: 'deviates' }))).toBe('reasonMissing')
    expect(citationShapeRefusal(decided, citation({ about: { kind: 'decision', id: 'adr-1' }, stance: 'deviates', reason: 'Speed' }))).toBeUndefined()
  })

  it('lets a departure be only from a flexible principle, and nothing new cite a retired or absorbed one', () => {
    const flexible = { regime: 'flexible' as const, status: 'accepted' as const }
    expect(citationPrincipleRefusal(flexible, 'deviates')).toBeUndefined()
    expect(citationPrincipleRefusal({ ...flexible, regime: 'fixed' }, 'deviates')).toBe('principleFixed')
    expect(citationPrincipleRefusal({ ...flexible, regime: 'fixed' }, 'supports')).toBeUndefined()
    expect(citationPrincipleRefusal({ ...flexible, status: 'retired' }, 'supports')).toBe('principleRetired')
    expect(citationPrincipleRefusal({ ...flexible, mergedInto: 'pr-2' }, 'supports')).toBe('principleRetired')
  })
})

describe('a record\'s citations, carried (ADR-0041 §7)', () => {
  it('go with a merge to the survivor, once each, in one scope', () => {
    const list = [citation(), citation({ id: 'ci-2', about: { kind: 'observation', id: 'ob-2' } }), citation({ id: 'ci-3', about: { kind: 'observation', id: 'ob-2' }, stance: 'chafes' })]
    const carried = carryCitations(list, list, { kind: 'observation', id: 'ob-2' }, { kind: 'observation', id: 'ob-1' }, true)
    expect(carried.moved).toBe(2)
    // ci-2 says what ci-1 already says: it is said once.
    expect(carried.to.map((one) => [one.id, one.about.id, one.stance])).toEqual([['ci-1', 'ob-1', 'holds'], ['ci-3', 'ob-1', 'chafes']])
    expect(carried.from).toEqual(carried.to)
  })

  it('go with a move to the scope the record now lives in, and leave the rest', () => {
    const leaving = [citation(), citation({ id: 'ci-2', about: { kind: 'observation', id: 'ob-2' } })]
    const carried = carryCitations(leaving, [], { kind: 'observation', id: 'ob-1' }, { kind: 'observation', id: 'ob-1' }, false)
    expect(carried.from.map((one) => one.id)).toEqual(['ci-2'])
    expect(carried.to.map((one) => one.id)).toEqual(['ci-1'])
    expect(carryCitations(leaving, [], { kind: 'observation', id: 'ob-9' }, { kind: 'observation', id: 'ob-9' }, false).moved).toBe(0)
  })
})
