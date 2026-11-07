// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../../model'
import { indexScopes } from '../../projects/scopeIndex'
import { markSharedFix, setOwnerFix } from './checkFixes'

const element = (id: string, over: Partial<DesignElement> = {}): DesignElement => ({ id, kind: 'application', name: id, lifecycle: 'live', isManaged: false, aspects: {}, ...over })

const index = indexScopes([
  { path: '', model: { elements: [], relations: [] } },
  { path: 'retail', model: { elements: [element('billing', { owner: 'Revenue systems' }), element('team', { kind: 'actor' }), element('svc', { kind: 'platformService' })], relations: [] } },
] as never)

describe('a fix of one field', () => {
  it('sets the owner in the scope that keeps the record, both keys said each way so the field stays one answer', () => {
    const fix = setOwnerFix(index, 'billing', { unit: 'team' })
    expect(fix?.scope).toBe('retail')
    expect(fix?.commands).toEqual([{ type: 'element.update', id: 'billing', patch: { owner: undefined, partyId: 'team' } }])
    expect(fix?.back).toEqual([{ type: 'element.update', id: 'billing', patch: { owner: 'Revenue systems', partyId: undefined } }])
  })

  it('takes a typed name as the owner, flagged by the field as not a unit', () => {
    expect(setOwnerFix(index, 'billing', { name: 'Finance desk' })?.commands)
      .toEqual([{ type: 'element.update', id: 'billing', patch: { owner: 'Finance desk', partyId: undefined } }])
  })

  it('marks a service shared, and puts it back', () => {
    const fix = markSharedFix(index, 'svc')
    expect(fix?.commands).toEqual([{ type: 'element.update', id: 'svc', patch: { shared: true } }])
    expect(fix?.back).toEqual([{ type: 'element.update', id: 'svc', patch: { shared: undefined } }])
  })

  it('offers nothing for a record the tree does not hold', () => {
    expect(setOwnerFix(index, 'nobody', { unit: 'team' })).toBeUndefined()
  })
})
