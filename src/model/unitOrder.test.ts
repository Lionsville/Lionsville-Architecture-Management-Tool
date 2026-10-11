// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where each unit type stands, and the order units are listed in: lanes by
 * the longest path from the organisation, a loop cut the same way whatever
 * order the lists were read in, the types that sit nowhere apart, one rank
 * over all of them, and units by their type's rank, their own order and
 * their name. Acme Logistics' structure, fictional.
 */
import { describe, expect, it } from 'vitest'
import type { UnitType } from './operatingModel'
import type { DesignElement } from './types'
import { compareUnits, renumbered, unitMovedTo, unitTypeLanes, unitTypeRank } from './unitOrder'

const type = (id: string, name: string, over: Partial<UnitType> = {}): UnitType => ({ id, name, within: [], slots: [], ...over })

const division = type('ut-division', 'Division', { top: true })
const train = type('ut-train', 'Train', { top: true, within: ['ut-division'] })
const team = type('ut-team', 'Team', { within: ['ut-train'] })
const platform = type('ut-platform', 'Platform team', { top: true })
const guild = type('ut-guild', 'Guild')
const chapter = type('ut-chapter', 'Chapter', { within: ['ut-guild'] })

const names = (types: readonly UnitType[]) => types.map((one) => one.name)

describe('the lanes of the unit types', () => {
  it('puts a type at the top in lane 1, and a type by the longest path from the organisation', () => {
    const { lanes, laneOf } = unitTypeLanes([team, train, platform, division])
    expect(lanes.map((lane) => [lane.lane, names(lane.types)])).toEqual([
      [1, ['Division', 'Platform team']],
      // At the top and in a Division: below the Division, not beside it.
      [2, ['Train']],
      [3, ['Team']],
    ])
    expect(laneOf.get('ut-train')).toBe(2)
  })

  it('lists a lane by its order, then by name, and a type with no order after those with one', () => {
    const lanes = unitTypeLanes([
      type('a', 'Alpha', { top: true }), type('b', 'Beta', { top: true, order: 2 }), type('c', 'Gamma', { top: true, order: 1 }),
      type('d', 'Delta', { top: true }),
    ]).lanes
    expect(names(lanes[0].types)).toEqual(['Gamma', 'Beta', 'Alpha', 'Delta'])
  })

  it('says every place a type may sit, a type the model does not hold being none', () => {
    const { sitsIn } = unitTypeLanes([division, train, team, type('ut-lost', 'Lost', { top: true, within: ['ut-gone', 'ut-train', 'ut-train'] })])
    expect(sitsIn).toEqual([
      { type: 'ut-division' },
      { type: 'ut-lost' },
      { type: 'ut-lost', sitsIn: 'ut-train' },
      { type: 'ut-team', sitsIn: 'ut-train' },
      { type: 'ut-train' },
      { type: 'ut-train', sitsIn: 'ut-division' },
    ])
  })

  it('keeps the types that sit nowhere apart: in no lane, and in nothing that is in one', () => {
    const { lanes, nowhere, laneOf } = unitTypeLanes([division, chapter, guild, type('ut-ghost', 'Ghost', { within: ['ut-gone'] })])
    expect(lanes.flatMap((lane) => names(lane.types))).toEqual(['Division'])
    expect(names(nowhere)).toEqual(['Chapter', 'Ghost', 'Guild'])
    expect(laneOf.has('ut-guild')).toBe(false)
  })

  it('cuts a loop rather than following it, and says which line it cut', () => {
    const a = type('ut-a', 'Area', { top: true, within: ['ut-b'] })
    const b = type('ut-b', 'Branch', { within: ['ut-a'] })
    const self = type('ut-dept', 'Department', { top: true, within: ['ut-dept'] })
    const { lanes, sitsIn } = unitTypeLanes([a, b, self])
    expect(lanes.map((lane) => names(lane.types))).toEqual([['Area', 'Department'], ['Branch']])
    expect(sitsIn.filter((one) => one.loop)).toEqual([
      { type: 'ut-a', sitsIn: 'ut-b', loop: true },
      { type: 'ut-dept', sitsIn: 'ut-dept', loop: true },
    ])
  })

  it('leaves a loop nothing at the top reaches sitting nowhere', () => {
    const { lanes, nowhere } = unitTypeLanes([type('ut-x', 'X', { within: ['ut-y'] }), type('ut-y', 'Y', { within: ['ut-x'] })])
    expect(lanes).toEqual([])
    expect(names(nowhere)).toEqual(['X', 'Y'])
  })

  it('is the same whatever order the types were read in', () => {
    const types = [
      division, train, team, platform, guild, chapter,
      type('ut-a', 'Area', { top: true, within: ['ut-b'] }), type('ut-b', 'Branch', { within: ['ut-a', 'ut-team'] }),
    ]
    const once = unitTypeLanes(types)
    for (const shuffled of [[...types].reverse(), [...types.slice(3), ...types.slice(0, 3)]]) {
      const again = unitTypeLanes(shuffled)
      expect(again.lanes).toEqual(once.lanes)
      expect(again.nowhere).toEqual(once.nowhere)
      expect(again.sitsIn).toEqual(once.sitsIn)
    }
  })

  it('has nothing to say of no types', () => {
    expect(unitTypeLanes([])).toEqual({ lanes: [], laneOf: new Map(), nowhere: [], sitsIn: [] })
  })
})

describe('the rank of the unit types', () => {
  it('orders every type by lane, then order, then name, the ones that sit nowhere last', () => {
    const rank = unitTypeRank([guild, team, { ...platform, order: 1 }, train, division])
    expect([...rank].sort((x, y) => x[1] - y[1]).map(([id]) => id)).toEqual(['ut-platform', 'ut-division', 'ut-train', 'ut-team', 'ut-guild'])
  })
})

function unit(id: string, name: string, unitTypeId?: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...(unitTypeId ? { unitTypeId } : {}), ...over }
}

describe('the order of units', () => {
  const rank = unitTypeRank([division, train, team])

  it('lists units by their type\'s rank, then their own order, then name — an untyped or unknown one last', () => {
    const units = [
      unit('u-1', 'Zebra team', 'ut-team'),
      unit('u-2', 'Alpha team', 'ut-team'),
      unit('u-3', 'Middle team', 'ut-team', { order: 1 }),
      unit('u-4', 'Yonder train', 'ut-train'),
      unit('u-5', 'Anything', 'ut-gone'),
      unit('u-6', 'Aardvark', undefined),
      unit('u-7', 'North', 'ut-division'),
    ]
    expect([...units].sort(compareUnits(rank)).map((one) => one.name)).toEqual([
      'North', 'Yonder train', 'Middle team', 'Alpha team', 'Zebra team', 'Aardvark', 'Anything',
    ])
  })

  it('breaks a tie of names by id, so a list reads the same whatever order it came in', () => {
    const a = unit('u-b', 'Same', 'ut-team')
    const b = unit('u-a', 'Same', 'ut-team')
    expect([a, b].sort(compareUnits(rank)).map((one) => one.id)).toEqual(['u-a', 'u-b'])
    expect([b, a].sort(compareUnits(rank)).map((one) => one.id)).toEqual(['u-a', 'u-b'])
  })
})

describe('moving a unit among its siblings', () => {
  const units = [
    unit('art', 'Train', 'ut-train'),
    unit('t-c', 'Cargo', 'ut-team', { parentId: 'art' }),
    unit('t-a', 'Air', 'ut-team', { parentId: 'art' }),
    unit('t-b', 'Bulk', 'ut-team', { parentId: 'art' }),
    unit('p-1', 'Platform', 'ut-platform', { parentId: 'art' }),
    unit('t-x', 'Elsewhere', 'ut-team'),
    unit('g-1', 'A group', undefined, { parentId: 'art' }),
  ]

  it('renumbers its siblings of the same type from 1, in their new order', () => {
    // Air, Bulk, Cargo by name; Cargo to the front.
    expect(unitMovedTo(units, 't-c', 0)).toEqual([{ id: 't-c', order: 1 }, { id: 't-a', order: 2 }, { id: 't-b', order: 3 }])
  })

  it('writes only the numbers that change', () => {
    const ordered = units.map((one) => ({ ...one, ...({ 't-a': { order: 1 }, 't-b': { order: 2 }, 't-c': { order: 3 } } as Record<string, object>)[one.id] }))
    expect(unitMovedTo(ordered, 't-c', 1)).toEqual([{ id: 't-c', order: 2 }, { id: 't-b', order: 3 }])
  })

  it('holds a place past either end to that end, and writes nothing for the place it has or a unit it does not know', () => {
    expect(unitMovedTo(units, 't-a', 99).map((row) => row.id)).toEqual(['t-b', 't-c', 't-a'])
    expect(unitMovedTo(units, 't-a', -3)).toEqual([])
    expect(unitMovedTo(units, 'nobody', 0)).toEqual([])
    expect(unitMovedTo(units, 'g-1', 0)).toEqual([])
  })

  it('renumbers any list by a move, and nothing for a place that is not in it', () => {
    const list = [{ id: 'a' }, { id: 'b', order: 2 }]
    expect(renumbered(list, 1, 0)).toEqual([{ id: 'b', order: 1 }, { id: 'a', order: 2 }])
    expect(renumbered(list, 5, 0)).toEqual([])
  })
})
