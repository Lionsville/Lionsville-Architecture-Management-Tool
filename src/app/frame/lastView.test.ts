// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Screen } from '../../agent/screen'
import { lastViewOf, lastViewsFrom, newestView, noteLastView, renamedView, wayBack, withLastView } from './lastView'
import type { LastView } from './lastView'

const board: LastView = { scope: 'freight', in: 'Freight', page: 'board', id: 'landscape', name: 'Application landscape' }
const onBoard: Screen = { open: { path: 'freight', name: 'Freight', view: { id: 'landscape', name: 'Application landscape', kind: 'layer7' } } }
const anywhere = { scopeIs: () => true }

describe('the view that is up', () => {
  it('is the open scope’s, and none while a page stands over it: a scope opened on a page has a tab nobody was on', () => {
    expect(lastViewOf(onBoard)).toEqual(board)
    expect(lastViewOf({ ...onBoard, page: { page: 'decisions' } })).toBeUndefined()
    expect(lastViewOf({ ...onBoard, home: { path: '', name: 'Acme' }, page: { page: 'register' } })).toBeUndefined()
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

  it('notes a settled screen with a view up, and nothing for a page or a home', () => {
    let held = {}
    const frame = { get: () => held, set: (patch: object) => { held = { ...held, ...patch } } }
    noteLastView(frame, { home: { path: '', name: 'Acme' } })
    noteLastView(frame, { ...onBoard, page: { page: 'principles' } })
    expect(newestView(held)).toBeUndefined()
    noteLastView(frame, onBoard)
    expect(newestView(held)).toEqual(board)
    noteLastView(undefined, onBoard)
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

  it('is none while that view is the one up, and none under a page where its tab stands in the row', () => {
    expect(wayBack(held, onBoard, 'freight', anywhere)).toBeUndefined()
    expect(wayBack(held, { ...onBoard, page: { page: 'roadmap' } }, 'freight', anywhere)).toBeUndefined()
    expect(wayBack(held, { ...onBoard, home: { path: '', name: 'Acme' }, page: { page: 'register' } }, 'freight', anywhere)).toBeUndefined()
  })

  it('is none while any view is up with nothing over it: the one just left is not offered between two tabs', () => {
    const another: Screen = { open: { path: 'freight', name: 'Freight', view: { id: 'in-2027', name: 'Landscape in 2027', kind: 'layer7' } } }
    expect(wayBack(held, another, 'freight', anywhere)).toBeUndefined()
    const elsewhere: Screen = { open: { path: 'rail', name: 'Rail', view: { id: 'tracks', name: 'Tracks', kind: 'layer7' } } }
    expect(wayBack(held, elsewhere, 'rail', anywhere)).toBeUndefined()
  })

  it('is none under a page of the same scope that stands over another of its views', () => {
    const over: Screen = { open: { path: 'freight', name: 'Freight', view: { id: 'in-2027', name: 'Landscape in 2027', kind: 'layer7' } }, page: { page: 'decisions' } }
    expect(wayBack(held, over, 'freight', anywhere)).toBeUndefined()
  })

  it('is there under a page of another scope, and names the scope it leads to', () => {
    const over: Screen = { open: { path: 'rail', name: 'Rail', view: { id: 'tracks', name: 'Tracks', kind: 'layer7' } }, page: { page: 'decisions' } }
    expect(wayBack(held, over, 'rail', anywhere)).toEqual({ to: { scope: 'freight', page: 'board', id: 'landscape' }, name: 'Application landscape', in: 'Freight' })
  })

  it('is there under a page for a view that has no tab of its own', () => {
    const containers: LastView = { scope: 'freight', in: 'Freight', page: 'board', id: 'wms', name: 'Warehouse Management' }
    const onContainers: Screen = { open: { path: 'freight', name: 'Freight', view: { id: 'wms', name: 'Warehouse Management', kind: 'container' } }, page: { page: 'roadmap' } }
    expect(wayBack(withLastView({}, containers), onContainers, 'freight', anywhere)).toEqual({ to: { scope: 'freight', page: 'board', id: 'wms' }, name: 'Warehouse Management' })
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
