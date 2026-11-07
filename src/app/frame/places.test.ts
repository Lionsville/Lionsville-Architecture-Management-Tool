// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { placeOf, readPlace, writePlace } from '../../agent/place'
import { FOUND_PLACES, MORE_PLACES, ORGANISATION_PLACES, placeShows } from './places'

describe('Guidance as a place', () => {
  const guidance = ORGANISATION_PLACES.find((one) => one.page === 'principles')!

  it('is one entry that shows on any of its three pages, each of which ⌘K still finds by name', () => {
    expect(guidance.label).toBe('frame.place.guidance')
    for (const page of ['principles', 'topics', 'blocks'] as const) expect(placeShows(guidance, page)).toBe(true)
    expect(placeShows(guidance, 'people')).toBe(false)
    expect(MORE_PLACES.map((one) => one.page)).not.toContain('topics')
    expect(FOUND_PLACES.map((one) => one.page)).toEqual(['topics', 'blocks'])
  })

  it('keeps each page its address, and a block with its tab', () => {
    for (const page of ['principles', 'topics', 'blocks'] as const) expect(readPlace(`#/-/${page}`)).toEqual({ scope: '', page })
    const place = { scope: '', page: 'blocks', id: 'blk-1', tab: 'requirements' } as const
    expect(readPlace(writePlace(place))).toEqual(place)
    expect(placeOf({ home: { path: '', name: 'Acme' }, page: { page: 'blocks', id: 'blk-1', tab: 'requirements' } })).toEqual(place)
  })
})
