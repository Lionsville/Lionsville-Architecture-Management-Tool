// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A place and its address (ADR-0033): every place written is read back the
 * same, a fragment that is not a place reads as nothing, a screen is the
 * place it shows, what a move does to the history, and where a place that
 * is not there any more lands.
 */
import { describe, expect, it } from 'vitest'
import {
  PLACE_PREFIX, PLACE_STATE_KEY, linkTo, nearestPlace, placeInState, placeOf, readPlace, samePlace, stepBetween, writePlace,
} from './place'
import type { Place, PlaceFacts } from './place'
import { PAGES } from './screen'

const SCOPES = [
  '', 'acme', 'acme/rail', 'acme/rail/rolling-stock',
  'Zoë & Søn', 'a=b&c=d', 'hash#in/the name', 'per%cent/plus+sign', 'spaces in a name/and ? marks', '日本/東京',
]
const IDS = [undefined, 'landscape', 'ADR-0003', 'id with spaces', 'a&b=c#d', '', 'ünïcode']

describe('the place function pair', () => {
  it('reads back every place it writes, for every scope, page and id', () => {
    let n = 0
    for (const scope of SCOPES) {
      for (const page of [undefined, ...PAGES]) {
        for (const id of IDS) {
          const place: Place = { scope, ...(page !== undefined ? { page } : {}), ...(id !== undefined ? { id } : {}) }
          const written = writePlace(place)
          expect(written.startsWith(`#${PLACE_PREFIX}`)).toBe(true)
          expect(readPlace(written)).toEqual(place)
          // As `location.hash` hands it back, and as a fragment without its `#`.
          expect(readPlace(new URL(`app://local/index.html?x=1${written}`).hash)).toEqual(place)
          expect(readPlace(written.slice(1))).toEqual(place)
          n += 1
        }
      }
    }
    expect(n).toBe(SCOPES.length * (PAGES.length + 1) * IDS.length)
  })

  it('writes the organisation as the empty scope, said out loud', () => {
    expect(writePlace({ scope: '', page: 'home' })).toBe('#place?scope=&page=home')
    expect(writePlace({ scope: 'acme/rail', page: 'board', id: 'r7' })).toBe('#place?scope=acme%2Frail&page=board&id=r7')
  })

  it('reads a fragment that is not a place as nothing, and leaves it to whoever wrote it', () => {
    for (const hash of [
      '', '#', '#/acme', '#section-2', '#access_token=abc&state=xyz', '#place', '#place?', '#place?page=home',
      '#place?scope=a&page=nowhere', '#place?scope=a&scope=b', '#place?scope=a&extra=1', '#Place?scope=a',
      '#xplace?scope=a', 'place=scope',
    ]) {
      expect(readPlace(hash), hash).toBeUndefined()
    }
  })
})

describe('a place in a history entry', () => {
  it('is read beside whatever else the entry holds', () => {
    const place: Place = { scope: 'acme', page: 'decisions', id: 'ADR-0001' }
    expect(placeInState({ other: 1, [PLACE_STATE_KEY]: place })).toEqual(place)
    expect(placeInState({ [PLACE_STATE_KEY]: { scope: '' } })).toEqual({ scope: '' })
  })

  it('is nothing where the entry holds none, or something that is not one', () => {
    for (const state of [
      null, undefined, 'a string', 3, {}, { [PLACE_STATE_KEY]: 'acme' }, { [PLACE_STATE_KEY]: { page: 'home' } },
      { [PLACE_STATE_KEY]: { scope: 'a', page: 'nowhere' } }, { [PLACE_STATE_KEY]: { scope: 'a', id: 4 } },
    ]) {
      expect(placeInState(state)).toBeUndefined()
    }
  })
})

describe('the place a screen is', () => {
  it('is the open scope on its view, with the page the view is', () => {
    expect(placeOf({ open: { path: 'acme', name: 'Acme', view: { id: 'l7', name: 'Board', kind: 'layer7' } } }))
      .toEqual({ scope: 'acme', page: 'board', id: 'l7' })
    expect(placeOf({ open: { path: 'acme', name: 'Acme', view: { id: 'c1', name: 'Containers', kind: 'container' } } }))
      .toEqual({ scope: 'acme', page: 'board', id: 'c1' })
    expect(placeOf({ open: { path: '', name: 'Acme', view: { id: 's1', name: 'Sheet', kind: 'sheet' } } }))
      .toEqual({ scope: '', page: 'sheet', id: 's1' })
  })

  it('is the page over the view where one is up, on its record', () => {
    const open = { path: 'acme', name: 'Acme', view: { id: 'l7', name: 'Board', kind: 'layer7' } }
    expect(placeOf({ open, page: { page: 'decisions', id: 'ADR-0002' } })).toEqual({ scope: 'acme', page: 'decisions', id: 'ADR-0002' })
    expect(placeOf({ open, page: { page: 'observations' } })).toEqual({ scope: 'acme', page: 'observations' })
    expect(placeOf({ open, page: { page: 'roadmap' } })).toEqual({ scope: 'acme', page: 'roadmap' })
    expect(placeOf({ open: { path: 'acme', name: 'Acme' }, page: { page: 'plan', id: 'TR-1' } })).toEqual({ scope: 'acme', page: 'plan', id: 'TR-1' })
  })

  it('is whose home is up, and its page, with nothing open', () => {
    expect(placeOf({ home: { path: '', name: 'Acme' } })).toEqual({ scope: '', page: 'home' })
    expect(placeOf({ home: { path: 'acme', name: 'Acme' }, page: { page: 'register' } })).toEqual({ scope: 'acme', page: 'register' })
  })

  it('is not a place yet while the workspace has said nothing about what is on it', () => {
    expect(placeOf({ open: { path: 'acme', name: 'Acme' } })).toBeUndefined()
    expect(placeOf({})).toBeUndefined()
  })

  it('round-trips through the address', () => {
    const place = placeOf({ open: { path: 'a/b', name: 'B' }, page: { page: 'observations', id: 'CA-0001' } })!
    expect(readPlace(writePlace(place))).toEqual(place)
  })
})

describe('what a move does to the history', () => {
  const board: Place = { scope: 'acme', page: 'board', id: 'l7' }
  it('replaces the entry for the first place, and does nothing for the same one', () => {
    expect(stepBetween(undefined, board)).toBe('replace')
    expect(stepBetween(board, { ...board })).toBe('none')
    expect(samePlace(board, { scope: 'acme', page: 'board', id: 'l7' })).toBe(true)
  })

  it('pushes a move to another place, opening a record page on a record included', () => {
    expect(stepBetween(board, { scope: 'acme', page: 'board', id: 'other' })).toBe('push')
    expect(stepBetween(board, { scope: 'acme', page: 'decisions', id: 'ADR-0001' })).toBe('push')
    expect(stepBetween({ scope: 'acme', page: 'home' }, { scope: 'acme', page: 'register' })).toBe('push')
    expect(stepBetween({ scope: 'acme', page: 'decisions', id: 'ADR-1' }, { scope: 'other', page: 'decisions', id: 'ADR-2' })).toBe('push')
    expect(stepBetween({ scope: 'acme', page: 'plan', id: 'TR-1' }, { scope: 'acme', page: 'plan', id: 'TR-2' })).toBe('push')
  })

  it('replaces for another record on the same record page', () => {
    expect(stepBetween({ scope: 'acme', page: 'decisions', id: 'ADR-1' }, { scope: 'acme', page: 'decisions', id: 'ADR-2' })).toBe('replace')
    expect(stepBetween({ scope: 'acme', page: 'decisions' }, { scope: 'acme', page: 'decisions', id: 'ADR-2' })).toBe('replace')
    expect(stepBetween({ scope: 'acme', page: 'observations', id: 'OB-1' }, { scope: 'acme', page: 'observations' })).toBe('replace')
  })
})

describe('where a place that is not there any more lands', () => {
  const everything: PlaceFacts = { scopeIs: () => true }
  const views = [{ id: 'first', kind: 'sheet' }, { id: 'second', kind: 'layer7' }]

  it('is the place itself where it is still there, or where nothing says otherwise', () => {
    const place: Place = { scope: 'acme', page: 'board', id: 'second' }
    expect(nearestPlace(place, everything)).toBe(place)
    expect(nearestPlace(place, { ...everything, views })).toBe(place)
    expect(nearestPlace({ scope: 'acme', page: 'decisions', id: 'ADR-1' }, { ...everything, holds: () => true }))
      .toEqual({ scope: 'acme', page: 'decisions', id: 'ADR-1' })
  })

  it('lands a removed scope on the home of the nearest scope above it that is there', () => {
    const there = (paths: string[]): PlaceFacts => ({ scopeIs: (path) => paths.includes(path) })
    expect(nearestPlace({ scope: 'acme/rail/stock', page: 'board', id: 'x' }, there(['', 'acme'])))
      .toEqual({ scope: 'acme', page: 'home' })
    expect(nearestPlace({ scope: 'acme/rail/stock', page: 'register' }, there(['', 'acme', 'acme/rail'])))
      .toEqual({ scope: 'acme/rail', page: 'home' })
    expect(nearestPlace({ scope: 'gone', page: 'decisions' }, there([]))).toEqual({ scope: '', page: 'home' })
  })

  it('never takes the organisation for removed', () => {
    expect(nearestPlace({ scope: '', page: 'home' }, { scopeIs: () => false })).toEqual({ scope: '', page: 'home' })
  })

  it('lands a removed view on its scope\'s first view, or its home where none is left', () => {
    expect(nearestPlace({ scope: 'acme', page: 'board', id: 'gone' }, { ...everything, views }))
      .toEqual({ scope: 'acme', page: 'sheet', id: 'first' })
    expect(nearestPlace({ scope: 'acme', page: 'board', id: 'gone' }, { ...everything, views: [] }))
      .toEqual({ scope: 'acme', page: 'home' })
    expect(nearestPlace({ scope: 'acme' }, { ...everything, views: [] })).toEqual({ scope: 'acme', page: 'home' })
  })

  it('lands a removed record on its page without one', () => {
    const facts: PlaceFacts = { ...everything, views, holds: () => false }
    expect(nearestPlace({ scope: 'acme', page: 'decisions', id: 'ADR-9' }, facts)).toEqual({ scope: 'acme', page: 'decisions' })
    expect(nearestPlace({ scope: 'acme', page: 'observations', id: 'OB-9' }, facts)).toEqual({ scope: 'acme', page: 'observations' })
    expect(nearestPlace({ scope: 'acme', page: 'plan', id: 'TR-9' }, facts)).toEqual({ scope: 'acme', page: 'roadmap' })
    expect(nearestPlace({ scope: 'acme', page: 'platform', id: 'p' }, facts)).toEqual({ scope: 'acme', page: 'sheet', id: 'first' })
  })
})

/**
 * The observations page's tab, which the screen says (ADR-0019, amended): a
 * place on that page carries it, a reload stays on it, and a change of tab
 * replaces the entry as another record on the same page does.
 */
describe('a place on the observations page, on a tab', () => {
  it('is written and read back with its tab, and a tab that is none is no place', () => {
    for (const tab of ['register', 'analysis', 'solutions'] as const) {
      const place: Place = { scope: 'acme', page: 'observations', id: 'OB-1', tab }
      expect(readPlace(writePlace(place))).toEqual(place)
    }
    expect(readPlace('#place?scope=acme&page=observations&tab=picture')).toBeUndefined()
    expect(readPlace('#place?scope=acme&page=observations&tab=analysis&tab=register')).toBeUndefined()
    expect(placeInState({ [PLACE_STATE_KEY]: { scope: 'acme', page: 'observations', tab: 'solutions' } }))
      .toEqual({ scope: 'acme', page: 'observations', tab: 'solutions' })
    expect(placeInState({ [PLACE_STATE_KEY]: { scope: 'acme', page: 'observations', tab: 'picture' } })).toBeUndefined()
  })

  it('is the place a screen with a tab up is', () => {
    const open = { path: 'acme', name: 'Acme', view: { id: 'l7', name: 'Board', kind: 'layer7' } }
    expect(placeOf({ open, page: { page: 'observations', id: 'OB-1', tab: 'analysis' } }))
      .toEqual({ scope: 'acme', page: 'observations', id: 'OB-1', tab: 'analysis' })
  })

  it('is another place on another tab, and a change of tab replaces the entry', () => {
    const register: Place = { scope: 'acme', page: 'observations', tab: 'register' }
    const analysis: Place = { scope: 'acme', page: 'observations', tab: 'analysis' }
    expect(samePlace(register, analysis)).toBe(false)
    expect(stepBetween(register, analysis)).toBe('replace')
    expect(stepBetween({ scope: 'acme', page: 'board', id: 'l7' }, analysis)).toBe('push')
  })

  it('keeps its tab where its record was removed', () => {
    const facts: PlaceFacts = { scopeIs: () => true, views: [], holds: () => false }
    expect(nearestPlace({ scope: 'acme', page: 'observations', id: 'OB-9', tab: 'solutions' }, facts))
      .toEqual({ scope: 'acme', page: 'observations', tab: 'solutions' })
  })
})

/**
 * A selection may ride in the address on arrival (ADR-0033, amended 10
 * October 2026). It is read then, and it is not part of the place: writing
 * a place drops it, two places that differ only by it are the same place,
 * and a history entry ignores it.
 */
describe('a selection on the way in', () => {
  const place: Place = { scope: 'acme', page: 'board', id: 'l7' }
  const arriving: Place = { ...place, select: 'billing' }

  it('reads an address that names an element, and yields the selection with the place', () => {
    expect(readPlace('#place?scope=acme&page=board&id=l7&select=billing')).toEqual(arriving)
    expect(readPlace('#place?scope=acme&page=sheet&id=s1&select=invoicing')).toEqual({
      scope: 'acme', page: 'sheet', id: 's1', select: 'invoicing',
    })
  })

  it('writes a place without the selection, so a link and the address after landing do not keep it', () => {
    expect(writePlace(arriving)).toBe('#place?scope=acme&page=board&id=l7')
    expect(readPlace(writePlace(arriving))).toEqual(place)
    const link = linkTo('https://work.example/work?x=1#old', arriving)
    expect(link).toBe('https://work.example/work?x=1#place?scope=acme&page=board&id=l7')
    expect(link.includes('select=')).toBe(false)
  })

  it('is the same place where only the selection differs, and a history entry drops it', () => {
    expect(samePlace(place, arriving)).toBe(true)
    expect(samePlace(arriving, { ...place, select: 'wms' })).toBe(true)
    expect(stepBetween(place, arriving)).toBe('none')
    expect(stepBetween(arriving, { ...place, select: 'wms' })).toBe('none')
    expect(placeInState({ [PLACE_STATE_KEY]: { ...arriving } })).toEqual(place)
  })
})

describe('a link to a place', () => {
  const place: Place = { scope: 'acme/rail', page: 'decisions', id: 'adr-2' }

  it('is the address with the place as its fragment, read back as the same place', () => {
    const link = linkTo('https://work.example/', place)
    expect(link).toBe('https://work.example/#place?scope=acme%2Frail&page=decisions&id=adr-2')
    expect(readPlace(new URL(link).hash)).toEqual(place)
  })

  it('keeps the address’s path and query, and drops a fragment it had', () => {
    expect(linkTo('https://work.example/app/?tenant=t1#somebody-else', { scope: '', page: 'home' }))
      .toBe('https://work.example/app/?tenant=t1#place?scope=&page=home')
  })

  it('carries the tab of the observations page', () => {
    const link = linkTo('https://work.example/', { scope: 'acme', page: 'observations', id: 'OB-1', tab: 'analysis' })
    expect(readPlace(new URL(link).hash)).toEqual({ scope: 'acme', page: 'observations', id: 'OB-1', tab: 'analysis' })
  })
})
