// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { HostModel } from '../model/hostModel'
import { HOLDS_NOTHING, holdsOf, isEmpty, VIEW_NAMES_SAID } from './scopeHolds'

const bare: HostModel = { name: 'Acme Rail', description: 'Trains', elements: [], relations: [], diagrams: [] }

const board = (id: string) => ({ id, kind: 'layer7' as const, name: `Board ${id}`, members: [], geometry: { nodes: [] } })

describe('what a scope holds (ADR-0040 §2)', () => {
  it('is nothing for a scope that only says what it is', () => {
    const holds = holdsOf({ model: bare, images: [], logoLibrary: [] })
    expect(holds).toEqual(HOLDS_NOTHING)
    expect(isEmpty(holds)).toBe(true)
  })

  it('counts every kind of work by kind, and names the views', () => {
    const model = {
      ...bare,
      diagrams: [board('one'), board('two')],
      elements: [{ id: 'crews', kind: 'application', name: 'Crews', lifecycle: 'live', isManaged: false, aspects: {} }],
      relations: [{ type: 'flow', id: 'c1', sourceId: 'crews', targetId: 'crews', isBidirectional: false }],
      decisions: [{}], transitions: [{}, {}], observations: [{}], causes: [{}], solutions: [{}], experiments: [{}],
      assignments: [{}], comments: [{}], checkMarks: [{}], unitTypes: [{}], roles: [{}, {}], responsibilities: [{}], operatingRules: [{}],
    } as unknown as HostModel
    const holds = holdsOf({ model, images: [{} as never], logoLibrary: [{}] })
    expect(holds).toEqual({
      views: 2, elements: 1, relations: 1, decisions: 1, plans: 2, observations: 1, causes: 1, solutions: 1, experiments: 1,
      assignments: 1, comments: 1, marks: 1, operatingModel: 5, pictures: 2, viewNames: ['Board one', 'Board two'],
    })
    expect(isEmpty(holds)).toBe(false)
  })

  it('is not empty for one kind alone, and names at most a handful of views', () => {
    expect(isEmpty({ ...HOLDS_NOTHING, comments: 1 })).toBe(false)
    const many = { ...bare, diagrams: Array.from({ length: VIEW_NAMES_SAID + 3 }, (_, at) => board(String(at))) }
    const holds = holdsOf({ model: many })
    expect([holds.views, holds.viewNames.length]).toEqual([VIEW_NAMES_SAID + 3, VIEW_NAMES_SAID])
  })
})
