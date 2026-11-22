// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Adr } from '../model/adr'
import type { Observation, ScopeAnalysis } from '../model/observation'
import { decisionsAbout, observationsOn } from './about'

const adr = (id: string, number: number, subjectId?: string): Adr => ({
  id, number, title: id, status: 'proposed', date: '2026-11-01', body: '', signers: [], ...(subjectId ? { subjectId } : {}),
})
const ob = (id: string, number: number, over: Partial<Observation> = {}): Observation => ({
  id, number, title: id, date: '2026-11-01', impact: 'minor', seen: 1, body: '', history: [{ date: '2026-11-01', kind: 'recorded' }], ...over,
})
const at = (scope: string, observations: Observation[]): ScopeAnalysis => ({ scope, observations, causes: [], solutions: [], experiments: [] })

describe('decisionsAbout', () => {
  it('is the records whose subject is the element, by number', () => {
    expect(decisionsAbout([adr('b', 2, 'crm'), adr('a', 1, 'crm'), adr('c', 3), adr('d', 4, 'erp')], 'crm').map((one) => one.id)).toEqual(['a', 'b'])
    expect(decisionsAbout(undefined, 'crm')).toEqual([])
  })
})

describe('observationsOn', () => {
  const own = [
    ob('o2', 2, { about: ['crm'] }), ob('o1', 1, { about: ['erp', 'crm'] }), ob('o3', 3, { about: ['crm'], archived: true }),
    ob('o4', 4, { about: ['crm'], history: [{ date: '2026-11-01', kind: 'recorded' }, { date: '2026-11-02', kind: 'merged', id: 'o1' }] }), ob('o5', 5),
  ]
  const tree = [at('', [ob('x1', 1, { about: ['crm'] })]), at('sales', [ob('stale', 9, { about: ['crm'] })]), at('retail', [ob('r1', 1, { about: ['crm'] })])]

  it('is this scope\'s open ones first, from its own list, then every other scope\'s in path order', () => {
    expect(observationsOn(own, tree, 'sales', 'crm').map((one) => [one.scope, one.observation.id])).toEqual([
      [undefined, 'o1'], [undefined, 'o2'], ['', 'x1'], ['retail', 'r1'],
    ])
  })

  it('is nothing where nothing names the element', () => {
    expect(observationsOn([ob('o1', 1)], [], '', 'crm')).toEqual([])
  })
})
