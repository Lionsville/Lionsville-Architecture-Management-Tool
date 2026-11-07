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
})
