// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The app as a screen and a destination (ADR-0019, amended): whether the app
 * has arrived, now with the observations page's tab; whether a move has
 * landed, which is how a provider's move is told from the next one; and which
 * view a destination with no id opens.
 */
import { describe, expect, it } from 'vitest'
import { arrived, landed, viewFor, viewPage } from './screen'
import type { Screen } from './screen'

const onBoard: Screen = { open: { path: 'acme/retail', name: 'Retail', view: { id: 'r7', name: 'Board', kind: 'layer7' } } }
const onTab = (tab: 'register' | 'analysis' | 'solutions', id?: string): Screen => ({
  ...onBoard, page: { page: 'observations', ...(id !== undefined ? { id } : {}), tab },
})
const home = (path: string): Screen => ({ home: { path, name: path } })

describe('arrived, with a tab', () => {
  it('is on the observations page with the tab asked for, and not on another tab', () => {
    expect(arrived(onTab('analysis'), { page: 'observations', tab: 'analysis' }, 'acme/retail')).toBe(true)
    expect(arrived(onTab('register'), { page: 'observations', tab: 'analysis' }, 'acme/retail')).toBe(false)
    // No tab asked for: any tab will do, as before.
    expect(arrived(onTab('solutions'), { page: 'observations' }, 'acme/retail')).toBe(true)
    // A record and a tab: both.
    expect(arrived(onTab('register', 'o1'), { page: 'observations', id: 'o1', tab: 'register' }, 'acme/retail')).toBe(true)
    expect(arrived(onTab('analysis', 'o1'), { page: 'observations', id: 'o1', tab: 'register' }, 'acme/retail')).toBe(false)
  })
})

describe('landed', () => {
  it('is never in another scope', () => {
    expect(landed(home('acme'), { scope: 'acme/retail', page: 'home' })).toBe(false)
    expect(landed(onBoard, { scope: 'acme', page: 'roadmap' })).toBe(false)
  })

  it('is on the kind of page asked for, whichever record or tab it then shows', () => {
    expect(landed(onTab('analysis', 'o2'), { scope: 'acme/retail', page: 'observations', id: 'o1', tab: 'register' })).toBe(true)
    expect(landed(onBoard, { scope: 'acme/retail', page: 'observations' })).toBe(false)
    expect(landed({ ...onBoard, page: { page: 'decisions', id: 'adr-9' } }, { scope: 'acme/retail', page: 'decisions', id: 'adr-1' })).toBe(true)
  })

  it('is on a view, or on the home where the scope had no view of that kind', () => {
    expect(landed(onBoard, { scope: 'acme/retail', page: 'sheet' })).toBe(true)
    expect(landed(home('acme/retail'), { scope: 'acme/retail', page: 'sheet' })).toBe(true)
    expect(landed(onTab('register'), { scope: 'acme/retail', page: 'board', id: 'r7' })).toBe(false)
  })

  it('is on the scope for an element or a record’s page, which the screen does not show', () => {
    expect(landed(onBoard, { scope: 'acme/retail', page: 'element', id: 'wms' })).toBe(true)
    expect(landed(onBoard, { scope: 'acme/retail', page: 'document', id: 'wms' })).toBe(true)
    expect(landed(home('acme/retail'), { scope: 'acme/retail', page: 'element', id: 'wms' })).toBe(false)
  })

  it('is on the home, or its page, for the home’s destinations; and on the open scope with nothing over it for none', () => {
    expect(landed(home(''), { scope: '', page: 'home' })).toBe(true)
    expect(landed({ ...home(''), page: { page: 'register' } }, { scope: '', page: 'register' })).toBe(true)
    expect(landed(home(''), { scope: '', page: 'register' })).toBe(false)
    expect(landed(onBoard, { scope: 'acme/retail' })).toBe(true)
    expect(landed(onTab('register'), { scope: 'acme/retail' })).toBe(false)
  })
})

describe('the view a destination opens', () => {
  const views = [
    { id: 'b1', kind: 'layer7' }, { id: 's1', kind: 'sheet' }, { id: 'c1', kind: 'container' }, { id: 's2', kind: 'sheet' },
  ]

  it('is the one named', () => {
    expect(viewFor('sheet', 's2', views, undefined)).toBe('s2')
  })

  it('is the one on the tab where it is of that kind, else the first of that kind', () => {
    expect(viewFor('sheet', undefined, views, 's2')).toBe('s2')
    expect(viewFor('sheet', undefined, views, 'b1')).toBe('s1')
    expect(viewFor('board', undefined, views, 'c1')).toBe('c1')
    expect(viewFor('board', undefined, views, 's1')).toBe('b1')
  })

  it('is nothing where the scope has none of that kind, or the page is not a view’s', () => {
    expect(viewFor('map', undefined, views, 'b1')).toBeUndefined()
    expect(viewFor('decisions', undefined, views, 'b1')).toBeUndefined()
  })

  it('is a board for the two drawn kinds, and its own kind for the laid-out ones', () => {
    expect(viewPage('layer7')).toBe('board')
    expect(viewPage('container')).toBe('board')
    expect(viewPage('technology')).toBe('technology')
  })
})
