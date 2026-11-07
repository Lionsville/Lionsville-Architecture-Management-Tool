// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { placeOf, readPlace, writePlace } from '../../agent/place'
import { FOUND_PLACES, MORE_PLACES, ORGANISATION_PLACES, placeShows } from './places'

describe('the five places', () => {
  it('are the ones at the foot of the tree, and every organisation-wide page is one of them or under one', () => {
    expect(ORGANISATION_PLACES.map((one) => one.page)).toEqual(['register', 'people', 'operating', 'principles', 'checks'])
    const reached = ORGANISATION_PLACES.flatMap((one) => [one.page, ...(one.within ?? []).map((inside) => inside.page)])
    for (const page of ['technologyRegister', 'topics', 'blocks'] as const) expect(reached).toContain(page)
  })

  it('send the technology words to the register, on their tab', () => {
    const register = ORGANISATION_PLACES.find((one) => one.page === 'register')!
    expect(register.within?.map((one) => one.tab)).toEqual(['applications', 'services', 'platforms'])
  })
})

describe('Guidance as a place', () => {
  const guidance = ORGANISATION_PLACES.find((one) => one.page === 'principles')!

  it('is one entry that shows on any of its three pages, each of which ⌘K still finds by name', () => {
    expect(guidance.label).toBe('frame.place.guidance')
    for (const page of ['principles', 'topics', 'blocks'] as const) expect(placeShows(guidance, page)).toBe(true)
    expect(placeShows(guidance, 'people')).toBe(false)
    expect(MORE_PLACES.map((one) => one.page)).not.toContain('topics')
    expect(FOUND_PLACES.map((one) => one.page)).toEqual(['technologyRegister', 'topics', 'blocks'])
  })

  it('says what it holds under its name, so a building block is found without knowing the word Guidance', () => {
    expect(guidance.within?.map((one) => one.page)).toEqual(['principles', 'topics', 'blocks'])
    expect(guidance.within?.map((one) => one.label)).toContain('frame.place.blocks')
  })

  it('keeps each page its address, and a block with its tab', () => {
    for (const page of ['principles', 'topics', 'blocks'] as const) expect(readPlace(`#/-/${page}`)).toEqual({ scope: '', page })
    const place = { scope: '', page: 'blocks', id: 'blk-1', tab: 'requirements' } as const
    expect(readPlace(writePlace(place))).toEqual(place)
    expect(placeOf({ home: { path: '', name: 'Acme' }, page: { page: 'blocks', id: 'blk-1', tab: 'requirements' } })).toEqual(place)
  })
})
