// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Cause, Observation, Solution } from '../model/observation'
import { rootsFromSolutions } from './rootsFromSolutions'

const cause = (id: string, over: Partial<Cause> = {}): Cause => ({
  id, number: Number(id.replace(/\D/g, '')) || 1, title: id, state: 'assumed', body: '', explains: [], ...over,
})
const solution = (id: string, addresses: string[], state: Solution['state'] = 'idea'): Solution => ({
  id, number: 1, title: id, state, addresses: addresses.map((one) => ({ id: one, strength: 'strong' as const })),
  validatedWith: [], attempts: [], body: '', history: [],
})
const observation = (id: string, over: Record<string, unknown> = {}): Observation => ({
  id, number: 1, title: id, date: '2026-09-01', impact: 'minor', seen: 1, body: '',
  history: [{ date: '2026-09-01', kind: 'recorded' }, { date: '2026-09-02', kind: 'shared' }], ...over,
} as Observation)

describe('an analysis kept before a root cause was said (ADR-0032 §9)', () => {
  it('reads a cause a live solution addresses as a root cause, and no other', () => {
    const read = rootsFromSolutions({
      causes: [cause('ca-1'), cause('ca-2'), cause('ca-3', { explains: [{ id: 'ca-1', strength: 'normal' }] }), cause('ca-4')],
      solutions: [solution('so-1', ['ca-1']), solution('so-2', ['ca-2'], 'dropped'), solution('so-3', ['ca-1', 'ca-4'], 'adopted')],
    })
    expect(read.causes?.map((one) => [one.id, one.root])).toEqual([
      ['ca-1', true], ['ca-2', undefined], ['ca-3', undefined], ['ca-4', true],
    ])
  })

  it('drops `shared` from an observation, and keeps its events as history', () => {
    const read = rootsFromSolutions({ observations: [observation('ob-1', { shared: true }), observation('ob-2')] })
    expect(read.observations?.[0]).not.toHaveProperty('shared')
    expect(read.observations?.[0].history.map((event) => event.kind)).toEqual(['recorded', 'shared'])
    expect(read.observations?.[1]).toEqual(observation('ob-2'))
  })

  it('changes nothing over data that already says its roots, and keeps the rest of the model', () => {
    const model = {
      name: 'Claims',
      causes: [cause('ca-1', { root: true }), cause('ca-2', { explains: [{ id: 'ca-1', strength: 'weak' }] })],
      solutions: [solution('so-1', ['ca-1'])],
    }
    expect(rootsFromSolutions(model)).toEqual(model)
    const empty: { name: string; causes?: Cause[] } = { name: 'Empty' }
    expect(rootsFromSolutions(empty)).toEqual(empty)
  })
})
