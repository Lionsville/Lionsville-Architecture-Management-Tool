// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Citation } from '../model/citable'
import type { Principle } from '../model/principle'
import { principleFindings } from './principleFindings'
import { indexScopes } from './scopeIndex'

const principle = (id: string, number: number, over: Partial<Principle> = {}): Principle => ({
  id, number, title: id, statement: '', aspects: [{ id: `${id}-a`, number: 1, text: 'x', nature: 'design' }], lastAspect: 1,
  groups: [], regime: 'flexible', status: 'accepted', ...over,
})
const chafes = (id: string, observation: string): Citation => ({ id, about: { kind: 'observation', id: observation }, principle: { scope: '', id: 'pr-chafed' }, stance: 'chafes', on: '2026-10-25' })

describe('what principles and their citations say about themselves (ADR-0041 §10)', () => {
  const index = indexScopes([
    { path: '', model: { elements: [], relations: [], principles: [principle('pr-unused', 1), principle('pr-chafed', 2), principle('pr-candidate', 3, { status: 'candidate' }), principle('pr-gone', 4, { mergedInto: 'pr-chafed' })] } },
    { path: 'acme', model: { elements: [], relations: [], principles: [principle('pr-acme', 1)], citations: [chafes('c1', 'o1'), chafes('c2', 'o2'), chafes('c3', 'o3'), { ...chafes('c4', 'o4'), principle: { scope: '', id: 'pr-gone' } }] } },
    // A scope beside acme cites a principle kept in acme: it does not read here.
    { path: 'beta', model: { elements: [], relations: [], citations: [{ ...chafes('c5', 'o5'), stance: 'holds', principle: { scope: 'acme', id: 'pr-acme' } }] } },
  ])
  const found = principleFindings(index)
  const of = (key: string) => found.filter((one) => one.key === key).map((one) => [one.scope, one.id])

  it('says an accepted principle nothing cites, and never a candidate or one absorbed', () => {
    expect(of('check.principleUnused')).toEqual([['', 'pr-unused']])
  })

  it('says a principle three observations say chafes', () => {
    expect(found.find((one) => one.key === 'check.principleChafes')).toMatchObject({ scope: '', id: 'pr-chafed', count: 3 })
  })

  it('says a citation of a principle absorbed, or one that does not read where the record is, on the record\'s scope', () => {
    expect(of('check.citationGone')).toEqual([['acme', 'o4'], ['beta', 'o5']])
  })
})
