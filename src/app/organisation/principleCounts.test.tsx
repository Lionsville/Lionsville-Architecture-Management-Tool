// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Principle } from '../../model/principle'
import type { ScopePrinciples } from '../../projects/scopeIndex'
import { principleCounts } from './principleCounts'

const one = (id: string, over: Partial<Principle> = {}): Principle => ({
  id, number: 1, title: id, statement: '', aspects: [{ id: 'a', number: 1, text: 'x', nature: 'design' }], lastAspect: 1,
  groups: [], regime: 'flexible', status: 'accepted', ...over,
})
const at: Record<string, ScopePrinciples> = {
  '': { principles: [one('org-1'), one('org-2', { status: 'retired' })], groups: [] },
  acme: { principles: [one('acme-1'), one('acme-2', { mergedInto: 'acme-1' })], groups: [] },
  'acme/rail': { principles: [one('rail-1'), one('rail-2', { status: 'candidate' })], groups: [] },
}
const principlesAt = (path: string) => at[path] ?? { principles: [], groups: [] }

describe('what a home counts of principles (ADR-0041 §12)', () => {
  it('counts the scope\'s own standing principles and those in force from above, retired and absorbed ones left out', () => {
    expect(principleCounts('acme/rail', principlesAt)).toEqual({ own: 2, inForce: 4 })
    expect(principleCounts('', principlesAt)).toEqual({ own: 1, inForce: 1 })
    expect(principleCounts('elsewhere', principlesAt)).toEqual({ own: 0, inForce: 1 })
  })

  it('counts a topic\'s principles in force where the topic is relevant, once (ADR-0042 §4)', () => {
    const withTopic = (path: string) => (path === 'topics/security' ? { principles: [one('sec-1'), one('sec-2')], groups: [] } : principlesAt(path))
    expect(principleCounts('acme/rail', withTopic, ['topics/security', 'acme'])).toEqual({ own: 2, inForce: 6 })
  })
})
