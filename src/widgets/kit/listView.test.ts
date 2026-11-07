// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a list shows, read from an address and written back without touching
 * what the page keeps there, and the rows a view keeps.
 */
import { describe, expect, it } from 'vitest'
import { didYouMean, FRESH_VIEW, listed, readListView, writeListView } from './listView'
import type { ListHow, ListView } from './listView'

type Thing = { name: string; life: string; day: string | null; kept: string }

const THINGS: Thing[] = [
  { name: 'Tariff engine', life: 'live', day: '2027-01-01', kept: 'Finance' },
  { name: 'Yard system', life: 'retiring', day: null, kept: 'Depot' },
  { name: 'Zürich portal', life: 'retiring', day: '2026-12-01', kept: 'Finance' },
]

const HOW: ListHow<Thing> = {
  words: (thing) => [thing.name, thing.kept],
  filterBy: { life: (thing) => thing.life },
  sortBy: { day: (thing) => thing.day, name: (thing) => thing.name },
  groupBy: { kept: (thing) => ({ id: thing.kept, label: thing.kept }) },
}

const names = (view: ListView) => listed(THINGS, view, HOW).flatMap((group) => group.rows.map((thing) => thing.name))

describe('a list view in the address', () => {
  it('comes back as it was written', () => {
    const view: ListView = {
      find: 'a, b & c',
      filters: { life: ['live', 'retiring, soon'] },
      group: 'kept',
      sort: { column: 'day', descending: true },
      columns: ['kept', 'day'],
      select: 'ob-1',
    }
    expect(readListView(new URLSearchParams(writeListView(view).toString()))).toEqual(view)
  })

  it('leaves what the page keeps there alone, and clears what is no longer on', () => {
    const over = new URLSearchParams('tab=services&q=old&f.life=live&select=x')
    expect(writeListView({ ...FRESH_VIEW, group: 'kept' }, over).toString()).toBe('tab=services&group=kept')
  })

  it('tells no columns chosen from none on', () => {
    expect(readListView(new URLSearchParams('')).columns).toBeNull()
    expect(readListView(new URLSearchParams('cols=')).columns).toEqual([])
  })
})

describe('the rows a view keeps', () => {
  it('finds across every word, whatever the case or the accents', () => {
    expect(names({ ...FRESH_VIEW, find: 'ZURICH' })).toEqual(['Zürich portal'])
    expect(names({ ...FRESH_VIEW, find: 'finance tariff' })).toEqual(['Tariff engine'])
  })

  it('filters by what the field says', () => {
    expect(names({ ...FRESH_VIEW, filters: { life: ['retiring'] } })).toEqual(['Yard system', 'Zürich portal'])
  })

  it('sorts what has no value last, in either direction', () => {
    expect(names({ ...FRESH_VIEW, sort: { column: 'day', descending: false } })).toEqual(['Zürich portal', 'Tariff engine', 'Yard system'])
    expect(names({ ...FRESH_VIEW, sort: { column: 'day', descending: true } })).toEqual(['Tariff engine', 'Zürich portal', 'Yard system'])
  })

  it('groups in the order they are met, and no group is one with no label', () => {
    expect(listed(THINGS, { ...FRESH_VIEW, group: 'kept' }, HOW).map((group) => [group.label, group.rows.length]))
      .toEqual([['Finance', 2], ['Depot', 1]])
    expect(listed(THINGS, FRESH_VIEW, HOW).map((group) => group.label)).toEqual([''])
  })

  it('draws no group at all where nothing matched', () => {
    expect(listed(THINGS, { ...FRESH_VIEW, find: 'nothing here' }, HOW)).toEqual([])
  })
})

describe('did you mean', () => {
  it('offers a near word with its own spelling', () => {
    expect(didYouMean('tarif', ['Tariff engine'])).toBe('Tariff')
    expect(didYouMean('zurch', ['Zürich portal'])).toBe('Zürich')
  })

  it('does not guess', () => {
    expect(didYouMean('xy', ['xz'])).toBeNull()
    expect(didYouMean('platform', ['Tariff engine'])).toBeNull()
    expect(didYouMean('tariff', ['Tariff engine'])).toBeNull()
  })
})
