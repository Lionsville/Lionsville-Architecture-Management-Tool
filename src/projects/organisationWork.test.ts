// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { blank, holdsWorkBeyondItsName, namedBySomebody, organisationHoldsWork } from './organisationWork'
import type { ScopeSummary } from './scope'
import { emptyContent } from './scopeState'
import type { ScopeState } from './scopeState'

const listed = (over: Partial<ScopeSummary> = {}): ScopeSummary => ({ path: '', name: '', diagrams: 0, children: [], ...over })
const state = (name: string, over: Partial<ScopeState> = {}): ScopeState => ({ ...emptyContent(name), id: 'root' as ScopeState['id'], address: '', revision: 'r' as ScopeState['revision'], ...over })

describe('whose a name is', () => {
  it('is somebody\'s where it was written, and nobody\'s where it is the place\'s own or none', () => {
    expect(namedBySomebody(listed({ name: 'Globex' }))).toBe(true)
    expect(namedBySomebody(listed({ name: 'work1', unnamed: true }))).toBe(false)
    expect(namedBySomebody(listed({ name: '  ' }))).toBe(false)
  })
})

describe('whether the organisation holds work', () => {
  it('holds none where nobody named it and nothing is in it: an empty folder, listed under its own name', () => {
    expect(organisationHoldsWork(listed({ name: 'work1', unnamed: true }), state('work1'))).toBe(false)
    expect(organisationHoldsWork(listed())).toBe(false)
    expect(organisationHoldsWork(listed(), state(''))).toBe(false)
  })

  it('holds work for a name somebody wrote, a scope under it, a view of its own, or what could not be read', () => {
    expect(organisationHoldsWork(listed({ name: 'Globex' }))).toBe(true)
    expect(organisationHoldsWork(listed({ name: 'work1', unnamed: true, children: [listed({ path: 'a', name: 'A' })] }))).toBe(true)
    expect(organisationHoldsWork(listed({ name: 'work1', unnamed: true, diagrams: 1 }))).toBe(true)
    expect(organisationHoldsWork(listed({ unreadable: ['x'] }))).toBe(true)
  })

  it('holds work for a record in the root, which a listing cannot see, whatever the root is called', () => {
    const held = state('work1', { model: { ...emptyContent('work1').model, decisions: [{ id: 'd' } as never] } })
    expect(organisationHoldsWork(listed({ name: 'work1', unnamed: true }), held)).toBe(true)
  })

  it('holds work for a root that could not be read whole, or that a later version wrote', () => {
    const tree = listed({ name: 'work1', unnamed: true })
    expect(organisationHoldsWork(tree, state('work1', { unreadable: ['model.json'] }))).toBe(true)
    expect(organisationHoldsWork(tree, state('work1', { later: true }))).toBe(true)
  })
})

describe('a scope beyond its name', () => {
  it('passes over a name nobody chose, and nothing else', () => {
    expect(holdsWorkBeyondItsName(state('work1'), listed({ name: 'work1', unnamed: true }))).toBe(false)
    expect(holdsWorkBeyondItsName(state('work1'), listed({ name: 'work1' }))).toBe(true)
    expect(holdsWorkBeyondItsName(state('work1', { kind: 'organisation' }), listed({ name: 'work1', unnamed: true }))).toBe(true)
  })

  it('is blank only with no name and nothing said', () => {
    expect(blank(state(''))).toBe(true)
    expect(blank(state('Globex'))).toBe(false)
    expect(blank(state('', { client: 'Somebody' }))).toBe(false)
  })
})
