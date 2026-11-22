// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Screen } from '../../agent/screen'
import { lastViewOf, lastViewsFrom, newestView, renamedView, wayBack, withLastView } from './lastView'
import type { LastView } from './lastView'

const board: LastView = { scope: 'freight', in: 'Freight', page: 'board', id: 'landscape', name: 'Application landscape' }
const onBoard: Screen = { open: { path: 'freight', name: 'Freight', view: { id: 'landscape', name: 'Application landscape', kind: 'layer7' } } }
const anywhere = { scopeIs: () => true }

describe('the view under a screen', () => {
  it('is the open scope’s, whichever page stands over it', () => {
    expect(lastViewOf(onBoard)).toEqual(board)
    expect(lastViewOf({ ...onBoard, page: { page: 'decisions' } })).toEqual(board)
  })

  it('says the page that opens its kind', () => {
    const sheet: Screen = { open: { path: '', name: 'Acme', view: { id: 'sh', name: 'Business', kind: 'sheet' } } }
    expect(lastViewOf(sheet)?.page).toBe('sheet')
  })

  it('is nothing on a home, or in a scope with no view', () => {
    expect(lastViewOf({ home: { path: '', name: 'Acme' } })).toBeUndefined()
    expect(lastViewOf({ open: { path: 'freight', name: 'Freight', noView: true } })).toBeUndefined()
  })
})

describe('what the frame keeps', () => {
  it('is the last view of each scope, and the scope worked in last', () => {
    const other: LastView = { scope: 'rail', in: 'Rail', page: 'sheet', id: 'sh', name: 'Business' }
    const held = withLastView(withLastView({}, board), other)
    expect(newestView(held)).toEqual(other)
    expect(held.lastViews?.freight).toEqual(board)
    expect(newestView(withLastView(held, board))).toEqual(board)
  })

  it('is the same object where a look found nothing new', () => {
    const held = withLastView({}, board)
    expect(withLastView(held, { ...board })).toBe(held)
  })

  it('follows a view renamed from its row on a home', () => {
    const held = withLastView({}, board)
    expect(newestView(renamedView(held, 'freight', 'landscape', 'Landscape'))?.name).toBe('Landscape')
    expect(renamedView(held, 'freight', 'other', 'Landscape')).toBe(held)
  })

  it('starts from the places last worked in: the newest view of each scope, a page passed over', () => {
    const at = '2026-11-22T10:00:00.000Z'
    const held = lastViewsFrom([
      { scope: 'freight', page: 'decisions', in: 'Freight', at },
      { scope: 'freight', page: 'board', id: 'landscape', name: 'Application landscape', in: 'Freight', at },
      { scope: 'rail', page: 'sheet', id: 'sh', name: 'Business', in: 'Rail', at },
      { scope: 'freight', page: 'board', id: 'older', name: 'Older', in: 'Freight', at },
    ])
    expect(newestView(held)).toEqual(board)
    expect(Object.keys(held.lastViews ?? {})).toEqual(['freight', 'rail'])
    expect(lastViewsFrom([])).toEqual({})
  })
})

describe('the way back row two offers', () => {
  const held = withLastView({}, board)

  it('is none while that view is the one up, and there again with a page over it', () => {
    expect(wayBack(held, onBoard, 'freight', anywhere)).toBeUndefined()
    expect(wayBack(held, { ...onBoard, page: { page: 'roadmap' } }, 'freight', anywhere)).toEqual({ to: { scope: 'freight', page: 'board', id: 'landscape' }, name: 'Application landscape' })
  })

  it('names the scope where that is not the one in the trail', () => {
    const home: Screen = { home: { path: '', name: 'Acme' }, page: { page: 'register' } }
    expect(wayBack(held, home, '', anywhere)?.in).toBe('Freight')
    expect(wayBack(held, { home: { path: 'freight', name: 'Freight' } }, 'freight', anywhere)?.in).toBeUndefined()
  })

  it('is none before any view was worked on, or once its scope is gone', () => {
    expect(wayBack({}, { home: { path: '', name: 'Acme' } }, '', anywhere)).toBeUndefined()
    expect(wayBack(held, { home: { path: '', name: 'Acme' } }, '', { scopeIs: () => false })).toBeUndefined()
  })

  it('reads the view off the home that lists it: its name now, and none where it was removed', () => {
    const home: Screen = { home: { path: 'freight', name: 'Freight' } }
    const listing = (views: { id: string; name: string }[]) => ({ ...anywhere, homeViews: { scope: 'freight', views } })
    expect(wayBack(held, home, 'freight', listing([{ id: 'landscape', name: 'Renamed' }]))?.name).toBe('Renamed')
    expect(wayBack(held, home, 'freight', listing([]))).toBeUndefined()
  })
})
