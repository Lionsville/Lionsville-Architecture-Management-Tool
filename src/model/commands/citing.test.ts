// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Citation } from '../citable'
import { citationList, fromArrays, observationList } from '../normalised'
import { apply } from '../reducer'

const seen = { id: 'ob-1', number: 1, title: 'Seen', date: '2026-10-01', impact: 'minor' as const, seen: 1, body: '', history: [] }
const holds: Citation = { id: 'ci-1', about: { kind: 'observation', id: 'ob-1' }, principle: { scope: '', id: 'pr-1' }, aspect: 2, stance: 'holds', on: '2026-10-25' }
const scope = (citations: Citation[] = []) => fromArrays({ name: 'Acme', elements: [], relations: [], diagrams: [], observations: [seen], citations })

function landed(result: ReturnType<typeof apply>) {
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe('a citation\'s commands (ADR-0041 §7)', () => {
  it('cites, changes and takes off, each undone', () => {
    const added = landed(apply(scope(), { type: 'citation.add', citation: holds }))
    expect(citationList(added.model)).toEqual([holds])
    const changed = landed(apply(added.model, { type: 'citation.update', id: 'ci-1', patch: { stance: 'chafes' } }))
    expect(citationList(changed.model)[0].stance).toBe('chafes')
    expect(citationList(landed(apply(changed.model, changed.inverse)).model)[0].stance).toBe('holds')
    const removed = landed(apply(added.model, { type: 'citation.remove', id: 'ci-1' }))
    expect(citationList(landed(apply(removed.model, removed.inverse)).model)).toEqual([holds])
  })

  it('refuses a stance the kind does not take and a record the scope does not hold', () => {
    expect(apply(scope(), { type: 'citation.add', citation: { ...holds, stance: 'deviates', reason: 'x' } })).toEqual({ ok: false, reason: 'command.notCitable' })
    expect(apply(scope(), { type: 'citation.add', citation: { ...holds, about: { kind: 'observation', id: 'ob-9' } } })).toEqual({ ok: false, reason: 'command.unknownRecord' })
    expect(apply(scope([holds]), { type: 'citation.update', id: 'ci-1', patch: { stance: 'supports' } })).toEqual({ ok: false, reason: 'command.notCitable' })
  })

  it('goes with its record when the record is removed, and comes back with it', () => {
    const removed = landed(apply(scope([holds]), { type: 'observation.remove', id: 'ob-1' }))
    expect(citationList(removed.model)).toEqual([])
    const back = landed(apply(removed.model, removed.inverse)).model
    expect(observationList(back).map((one) => one.id)).toEqual(['ob-1'])
    expect(citationList(back)).toEqual([holds])
  })
})
