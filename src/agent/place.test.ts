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
  PLACE_PATH_PREFIX, PLACE_STATE_KEY, linkTo, oldPlaceForm, nearestPlace, placeInState, placeOf, readFinding, readPlace, samePlace, stepBetween, viewFacetsOf, writeFinding, writePlace, unknownPlace } from './place'
import type { Place, PlaceFacts } from './place'
import { PAGES } from './screen'

const SCOPES = [
  '', 'acme', 'acme/rail', 'acme/rail/rolling-stock', 'board', 'acme/document/home', '-', 'a/-/b', '%2D',
  'Zoë & Søn', 'a=b&c=d', 'hash#in/the name', 'per%cent/plus+sign', 'spaces in a name/and ? marks', '日本/東京',
]
const IDS = [undefined, 'landscape', 'ADR-0003', 'id with spaces', 'a&b=c#d', '', 'ünïcode', 'a/b', '-', '?x=1']

describe('the place function pair', () => {
  it('keeps a Conway map\'s reading, grouping and pair in its address, and says so on the place a screen is', () => {
    const place = { scope: 'acme', page: 'conway' as const, id: 'cw', tab: 'lines', group: 'ut-team', pair: 'a,b' }
    expect(writePlace(place)).toBe('#/acme/-/conway/cw?tab=lines&group=ut-team&pair=a%2Cb')
    expect(readPlace(writePlace(place))).toEqual(place)
    expect(placeOf({ open: { path: 'acme', name: 'Acme', view: { id: 'cw', name: 'Teams', kind: 'conway', tab: 'lines', pair: 'a,b' } } }))
      .toEqual({ scope: 'acme', page: 'conway', id: 'cw', tab: 'lines', pair: 'a,b' })
    expect(samePlace(place, { ...place, pair: 'a,c' })).toBe(false)
    expect(stepBetween(place, { ...place, pair: 'a,c' })).toBe('replace')
    expect(readPlace('#/acme/-/conway/cw?tab=nonsense')).toBeUndefined()
    expect(viewFacetsOf(place, 'cw')).toEqual({ of: 'cw', tab: 'lines', group: 'ut-team', pair: 'a,b' })
    expect(viewFacetsOf({ scope: 'acme', page: 'conway' }, 'cw')).toBeUndefined()
  })

  it('reads back every place it writes, for every scope, page and id', () => {
    let n = 0
    for (const scope of SCOPES) {
      for (const page of [undefined, ...PAGES]) {
        for (const id of IDS) {
          const place: Place = { scope, ...(page !== undefined ? { page } : {}), ...(id !== undefined ? { id } : {}) }
          const written = writePlace(place)
          expect(written.startsWith(`#${PLACE_PATH_PREFIX}`)).toBe(true)
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
    expect(writePlace({ scope: '', page: 'home' })).toBe('#/-/home')
    expect(writePlace({ scope: 'acme/rail', page: 'board', id: 'r7' })).toBe('#/acme/rail/-/board/r7')
    expect(writePlace({ scope: 'freight', page: 'document', id: 'freight-division' })).toBe('#/freight/-/document/freight-division')
    expect(writePlace({ scope: 'acme', page: 'observations', id: 'OB-1', tab: 'analysis' })).toBe('#/acme/-/observations/OB-1?tab=analysis')
    expect(writePlace({ scope: 'acme' })).toBe('#/acme/-')
  })

  it('writes a scope path as it is said everywhere else, and ends it so a scope named like a page is still a scope', () => {
    expect(writePlace({ scope: 'acme/board', page: 'home' })).toBe('#/acme/board/-/home')
    expect(readPlace('#/acme/board/-/home')).toEqual({ scope: 'acme/board', page: 'home' })
    expect(readPlace('#/acme/-/board/home')).toEqual({ scope: 'acme', page: 'board', id: 'home' })
    // A scope's own segment that is the end is escaped, so it reads back as a scope.
    expect(writePlace({ scope: 'a/-', page: 'home' })).toBe('#/a/%2D/-/home')
    expect(readPlace('#/a/%2D/-/home')).toEqual({ scope: 'a/-', page: 'home' })
  })

  it('reads every link written before 3.7.0, in the form it was written in, as the same place', () => {
    for (const [old, place] of [
      ['#place?scope=&page=home', { scope: '', page: 'home' }],
      ['#place?scope=acme%2Frail&page=board&id=landscape', { scope: 'acme/rail', page: 'board', id: 'landscape' }],
      ['#place?scope=freight&page=document&id=freight-division', { scope: 'freight', page: 'document', id: 'freight-division' }],
      ['#place?scope=acme&page=observations&tab=analysis', { scope: 'acme', page: 'observations', tab: 'analysis' }],
      ['#place?scope=acme%2Frail&page=board&id=landscape&select=app+%26+co+%231', { scope: 'acme/rail', page: 'board', id: 'landscape', select: 'app & co #1' }],
      ['place?scope=acme', { scope: 'acme' }],
    ] as const) {
      expect(readPlace(old), old).toEqual(place)
      expect(oldPlaceForm(old), old).toBe(true)
      // And it is written again in the new form, which reads back the same.
      expect(readPlace(writePlace(place)), old).toEqual(place)
      expect(oldPlaceForm(writePlace(place))).toBe(false)
    }
    expect(oldPlaceForm('#place?scope=a&page=nowhere')).toBe(false)
  })

  it('reads a fragment that is not a place as nothing, and leaves it to whoever wrote it', () => {
    for (const hash of [
      '', '#', '#/acme', '#section-2', '#access_token=abc&state=xyz', '#place', '#place?', '#place?page=home',
      '#place?scope=a&page=nowhere', '#place?scope=a&scope=b', '#place?scope=a&extra=1', '#Place?scope=a',
      '#xplace?scope=a', 'place=scope',
      '#/', '#/-/nowhere', '#/acme/-/board/l7/extra', '#//-/home', '#/a//b/-/home', '#/acme/-/board?tab=nope',
      '#/acme/-/board/l7?id=l8', '#/acme/-/home?scope=a', '#/acme/-/home?extra=1', '#/acme/-/home?tab=analysis&tab=register',
      '#/acme/%E0%A4%A/-/home', '#/acme/-/home?select=a&select=b',
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
    // The documentation page is a place of its own, on the element whose page it is.
    expect(placeOf({ open, page: { page: 'document', id: 'wms' } })).toEqual({ scope: 'acme', page: 'document', id: 'wms' })
    expect(readPlace(writePlace({ scope: 'acme', page: 'document', id: 'wms' }))).toEqual({ scope: 'acme', page: 'document', id: 'wms' })
  })

  it('tells an address that meant to be a place and is not from one that was never meant to be', () => {
    expect(unknownPlace('#place?scope=acme&page=chart-of-units')).toBe(true)
    expect(unknownPlace('#place?scope=acme&page=technology')).toBe(false)
    expect(unknownPlace('#place?scope=acme&page=board&id=l7')).toBe(false)
    expect(unknownPlace('#/acme/-/chart-of-units')).toBe(true)
    expect(unknownPlace('#/acme/-/board/l7')).toBe(false)
    expect(unknownPlace('#somebody-elses')).toBe(false)
    expect(unknownPlace('')).toBe(false)
  })

  it('is whose home is up, and its page, with nothing open', () => {
    expect(placeOf({ home: { path: '', name: 'Acme' } })).toEqual({ scope: '', page: 'home' })
    expect(placeOf({ home: { path: 'acme', name: 'Acme' }, page: { page: 'register' } })).toEqual({ scope: 'acme', page: 'register' })
    expect(placeOf({ home: { path: '', name: 'Acme' }, page: { page: 'checks' } })).toEqual({ scope: '', page: 'checks' })
    expect(readPlace(writePlace({ scope: '', page: 'checks' }))).toEqual({ scope: '', page: 'checks' })
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

describe('a link to a place', () => {
  const place: Place = { scope: 'acme/rail', page: 'decisions', id: 'adr-2' }

  it('is the address with the place as its fragment, read back as the same place', () => {
    const link = linkTo('https://work.example/', place)
    expect(link).toBe('https://work.example/#/acme/rail/-/decisions/adr-2')
    expect(readPlace(new URL(link).hash)).toEqual(place)
  })

  it('keeps the address’s path and query, and drops a fragment it had', () => {
    expect(linkTo('https://work.example/app/?tenant=t1#somebody-else', { scope: '', page: 'home' }))
      .toBe('https://work.example/app/?tenant=t1#/-/home')
  })

  it('carries the tab of the observations page', () => {
    const link = linkTo('https://work.example/', { scope: 'acme', page: 'observations', id: 'OB-1', tab: 'analysis' })
    expect(readPlace(new URL(link).hash)).toEqual({ scope: 'acme', page: 'observations', id: 'OB-1', tab: 'analysis' })
  })
})

/** ADR-0033, amended 11 October 2026: an element to select rides in a link, and is no part of a place. */
describe('an element selected, in a link', () => {
  const withSelect: Place = { scope: 'acme/rail', page: 'board', id: 'landscape', select: 'app & co #1' }

  it('is written and read back with the place it is selected on', () => {
    const link = linkTo('https://work.example/', withSelect)
    expect(link).toBe('https://work.example/#/acme/rail/-/board/landscape?select=app+%26+co+%231')
    expect(readPlace(new URL(link).hash)).toEqual(withSelect)
  })

  it('is nothing where it is said empty, and no place where it is said twice', () => {
    expect(readPlace('#place?scope=acme&page=board&select=')).toEqual({ scope: 'acme', page: 'board' })
    expect(readPlace('#place?scope=acme&page=board&select=a&select=b')).toBeUndefined()
    expect(readPlace('#/acme/-/board?select=')).toEqual({ scope: 'acme', page: 'board' })
  })

  it('is no part of the place: the same place, no step, and never kept in a history entry', () => {
    const plain: Place = { scope: 'acme/rail', page: 'board', id: 'landscape' }
    expect(samePlace(withSelect, plain)).toBe(true)
    expect(stepBetween(plain, withSelect)).toBe('none')
    expect(placeInState({ [PLACE_STATE_KEY]: withSelect })).toEqual(plain)
  })
})

describe('the frame in a place (4.0.0)', () => {
  it('reads a panel over a home by its short address, and writes it back', () => {
    expect(readPlace('#/-/work')).toEqual({ scope: '', page: 'work' })
    expect(writePlace({ scope: '', page: 'work' })).toBe('#/-/work')
    expect(readPlace('#/acme/-/activity')).toEqual({ scope: 'acme', page: 'activity' })
    expect(readPlace('#/-/preferences')).toEqual({ scope: '', page: 'preferences' })
    expect(readPlace('#/acme/-/settings')).toEqual({ scope: 'acme', page: 'settings' })
  })

  it('carries a panel beside a view, and it is another place, so Back shuts it', () => {
    const place = { scope: 'acme', page: 'board', id: 'l7', panel: 'work' } as const
    expect(readPlace(writePlace(place))).toEqual(place)
    expect(stepBetween({ scope: 'acme', page: 'board', id: 'l7' }, place)).toBe('push')
    expect(placeOf({ open: { path: 'acme', name: 'Acme', view: { id: 'l7', name: 'L7', kind: 'layer7' } }, panel: 'work' })).toEqual(place)
    expect(placeOf({ home: { path: '', name: 'Org' }, panel: 'activity' })).toEqual({ scope: '', page: 'activity' })
  })

  it('takes a tab on any page that has that tab, and no other', () => {
    expect(readPlace('#/-/people?tab=privacy')).toEqual({ scope: '', page: 'people', tab: 'privacy' })
    expect(readPlace('#/-/people/pe-f2c6')).toEqual({ scope: '', page: 'people', id: 'pe-f2c6' })
    expect(placeOf({ home: { path: '', name: 'Acme' }, page: { page: 'people', id: 'pe-f2c6' } })).toEqual({ scope: '', page: 'people', id: 'pe-f2c6' })
    // Another person is a step: Back walks between people, as it does not between a page's own records.
    expect(stepBetween({ scope: '', page: 'people', id: 'pe-1' }, { scope: '', page: 'people', id: 'pe-2' })).toBe('push')
    expect(readPlace('#/-/register?tab=services')).toEqual({ scope: '', page: 'register', tab: 'services' })
    expect(readPlace('#/-/people?tab=analysis')).toBeUndefined()
    expect(readPlace('#/-/board/x?tab=privacy')).toBeUndefined()
  })

  it('replaces the entry for another tab: choosing, not going somewhere', () => {
    expect(stepBetween({ scope: '', page: 'people', tab: 'review' }, { scope: '', page: 'people', tab: 'privacy' })).toBe('replace')
  })
})

describe('what a list keeps in the address', () => {
  it('carries a list whole, a filter said twice included, and reads it back', () => {
    const place = { scope: '', page: 'register' as const, id: 'billing', tab: 'services', list: 'q=rating&group=master&sort=-owner&f.lifecycle=live&f.lifecycle=retiring&cols=master%2Cowner' }
    expect(readPlace(writePlace(place))).toEqual(place)
  })

  it('is another place, and choosing one replaces the entry rather than adding a Back', () => {
    const on = { scope: '', page: 'register' as const }
    expect(samePlace(on, { ...on, list: 'q=x' })).toBe(false)
    expect(stepBetween(on, { ...on, list: 'q=x' })).toBe('replace')
    expect(stepBetween(on, { ...on, id: 'billing' })).toBe('replace')
    expect(stepBetween({ scope: '', page: 'checks', id: 'check.conflict' }, { scope: '', page: 'checks', id: 'check.drift' })).toBe('replace')
  })

  it('keeps it through the window\'s history', () => {
    expect(placeInState({ [PLACE_STATE_KEY]: { scope: '', page: 'register', list: 'q=x', finding: 'a b c' } })).toEqual({ scope: '', page: 'register', list: 'q=x', finding: 'a b c' })
  })
})

describe('a finding carried in the address', () => {
  it('reads back whatever the finding\'s id holds', () => {
    const carried = { check: 'check.lineOutlivesEnd', home: 'a/b', id: 'lineOutlivesEnd|a/b|c 48' }
    expect(readFinding(writeFinding(carried))).toEqual(carried)
    expect(readFinding('nothing')).toBeUndefined()
    const place = { scope: 'a', page: 'board' as const, id: 'v', finding: writeFinding(carried) }
    expect(readPlace(writePlace(place))).toEqual(place)
  })

  it('reads the organisation\'s home, whose path is empty', () => {
    const carried = { check: 'check.conflict', home: '', id: 'x y' }
    expect(readFinding(writeFinding(carried))).toEqual(carried)
  })
})

describe('a look in the address (ADR-0027, amended)', () => {
  it('is written and read back on a view, a date or today', () => {
    for (const day of ['2027-06-01', 'today']) {
      const place = { scope: 'acme', page: 'board', id: 'd1', day } as const
      expect(writePlace(place)).toBe(`#/acme/-/board/d1?day=${day}`)
      expect(readPlace(writePlace(place))).toEqual(place)
    }
  })

  it('is refused anywhere but a view, and in any other shape', () => {
    expect(readPlace('#/acme/-/decisions?day=2027-06-01')).toBeUndefined()
    expect(readPlace('#/acme/-/board/d1?day=soon')).toBeUndefined()
  })

  it('tells two places apart, and moving it replaces the entry: Back does not walk through every day looked at', () => {
    const on = { scope: 'acme', page: 'board', id: 'd1' } as const
    const looked = { ...on, day: '2027-06-01' }
    expect(samePlace(on, looked)).toBe(false)
    expect(stepBetween(on, looked)).toBe('replace')
    expect(stepBetween(looked, { ...on, day: '2028-01-01' })).toBe('replace')
  })

  it('comes off the screen a view says', () => {
    expect(placeOf({ open: { path: 'acme', name: 'Acme', view: { id: 'd1', name: 'B', kind: 'layer7', day: '2027-06-01' } } }))
      .toEqual({ scope: 'acme', page: 'board', id: 'd1', day: '2027-06-01' })
  })
})
