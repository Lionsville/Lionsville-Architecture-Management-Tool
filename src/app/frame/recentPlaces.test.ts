// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Screen } from '../../agent/screen'
import { recentFrom, recentOf, remembered, stillThere } from './recentPlaces'
import type { RecentPlace } from './recentPlaces'

const AT = '2026-11-07T10:00:00.000Z'
const place = (scope: string, id: string): RecentPlace => ({ scope, page: 'board', id, name: id, in: scope, at: AT })

describe('recentOf', () => {
  it('keeps a view by its name and a page a person works in', () => {
    const view: Screen = { open: { path: 'road', name: 'Road', view: { id: 'v', name: 'Linehaul', kind: 'layer7' } } }
    expect(recentOf(view, AT)).toEqual({ scope: 'road', page: 'board', id: 'v', name: 'Linehaul', in: 'Road', at: AT })
    const page: Screen = { home: { path: 'road', name: 'Road' }, page: { page: 'decisions' } }
    expect(recentOf(page, AT)).toEqual({ scope: 'road', page: 'decisions', in: 'Road', at: AT })
  })

  it('has nothing to say of a bare home or a place of the organisation', () => {
    expect(recentOf({ home: { path: '', name: 'Org' } }, AT)).toBeUndefined()
    expect(recentOf({ home: { path: '', name: 'Org' }, page: { page: 'people' } }, AT)).toBeUndefined()
  })
})

describe('the list', () => {
  it('moves a place up rather than listing it twice, and stops at twelve', () => {
    const list = Array.from({ length: 12 }, (_, at) => place('s', `v${at}`))
    const again = remembered(list, place('s', 'v3'))
    expect(again[0]?.id).toBe('v3')
    expect(again).toHaveLength(12)
    expect(remembered(list, place('s', 'new'))).toHaveLength(12)
  })

  it('keeps the records of one page as one place, landing on the newest', () => {
    const record = (id: string): RecentPlace => ({ scope: 'road', page: 'observations', id, in: 'Road', at: AT })
    const list = remembered([record('a'), record('b')], record('c'))
    expect(list.map((one) => one.id)).toEqual(['c'])
  })

  it('counts a plan as the roadmap and an element page as the documentation, which is what their rows say', () => {
    const on = (page: RecentPlace['page'], id?: string): RecentPlace => ({ scope: 'road', page, ...(id ? { id } : {}), in: 'Road', at: AT })
    expect(remembered([on('roadmap')], on('plan', 'p'))).toHaveLength(1)
    expect(remembered([on('documentation')], on('element', 'e'))).toHaveLength(1)
    expect(remembered([on('observations')], on('decisions'))).toHaveLength(2)
    expect(remembered([{ ...on('observations'), scope: 'rail' }], on('observations'))).toHaveLength(2)
  })

  it('keeps two views apart, for they have names', () => {
    expect(remembered([place('s', 'one')], place('s', 'two'))).toHaveLength(2)
  })

  it('reads a stored value warily, by source', () => {
    expect(recentFrom({ a: [place('s', 'v'), { scope: 1 }, null] }, 'a')).toHaveLength(1)
    expect(recentFrom({ a: 'no' }, 'a')).toEqual([])
    expect(recentFrom(undefined, 'a')).toEqual([])
    expect(recentFrom({ a: [place('s', 'v')] }, 'b')).toEqual([])
  })

  it('offers only what is still there', () => {
    const list = [place('gone', 'a'), place('here', 'b'), place('here', 'c'), place('here', 'd'), place('here', 'e')]
    expect(stillThere(list, (path) => path === 'here').map((one) => one.id)).toEqual(['b', 'c', 'd'])
  })

  it('shows a page once though an earlier build kept it three times, and fills up with the next place', () => {
    const record = (id: string): RecentPlace => ({ scope: 'road', page: 'observations', id, in: 'Road', at: AT })
    const kept = [record('a'), record('b'), record('c'), place('road', 'v')]
    expect(stillThere(kept, () => true).map((one) => one.id)).toEqual(['a', 'v'])
  })
})
