// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { conwayMap } from './conway'
import type { ConwayInput } from './conway'
import { applicationOnMap, conwayPairs, conwaySum, groupingRollsUp, linesOfPair, pairId, pairsUnder, readPairId, unitOnMap } from './conwayReading'
import type { UnitType } from './operatingModel'

const DAY = '2026-11-07'
const cluster: UnitType = { id: 'ut-c', name: 'Cluster', top: true, within: [], slots: [] }
const team: UnitType = { id: 'ut-t', name: 'Team', within: ['ut-c'], slots: [] }
const unit = (id: string, unitTypeId: string, parentId?: string) => ({ id, name: id, kind: 'actor' as const, lifecycle: 'live' as const, unitTypeId, ...(parentId ? { parentId } : {}) })
const flow = (id: string, sourceId: string, targetId: string) => ({ id, sourceId, targetId })

const INPUT: ConwayInput = {
  units: [unit('north', 'ut-c'), unit('south', 'ut-c'), unit('a', 'ut-t', 'north'), unit('b', 'ut-t', 'south'), unit('c', 'ut-t', 'south')],
  unitTypes: [cluster, team],
  applications: [
    { id: 'one', name: 'One', partyId: 'a' }, { id: 'two', name: 'Two', partyId: 'b' }, { id: 'three', name: 'Three', partyId: 'c' },
    { id: 'loose', name: 'Loose' }, { id: 'lost', name: 'Lost' },
  ],
  flows: [flow('f1', 'one', 'two'), flow('f2', 'one', 'two'), flow('f3', 'one', 'three'), flow('f4', 'two', 'loose'), flow('f5', 'loose', 'lost'), flow('f6', 'two', 'three')],
  interactions: [{ id: 'i1', sourceId: 'a', targetId: 'c', mode: 'service' }],
}

describe('the Conway reading', () => {
  const map = conwayMap(INPUT, DAY)
  const pairs = conwayPairs(map, map.findings)

  it('writes a pair into an address and reads it back, an end nobody owns as empty', () => {
    expect(readPairId(pairId('a', 'b'))).toEqual({ a: 'a', b: 'b' })
    expect(readPairId(pairId('a', undefined))).toEqual({ a: 'a' })
    expect(readPairId('nonsense')).toBeUndefined()
    expect(readPairId(',')).toBeUndefined()
    expect(readPairId(undefined)).toBeUndefined()
  })

  it('says one sum that reconciles: judged and not judged add up to every interface that crosses', () => {
    const sum = conwaySum(map, pairs)
    expect(sum).toMatchObject({ applications: 5, noOwner: 2, interfaces: 6, judged: 4, unjudged: 2, bothEnds: 1, judgedUnsaid: 3, lowCoverage: false })
    expect(sum.judged + sum.unjudged).toBe(sum.interfaces)
    expect(sum).toMatchObject({ attention: 2, agree: 1 })
  })

  it('has the map say it cannot answer once half the applications have no owner', () => {
    const few = conwayMap({ ...INPUT, applications: INPUT.applications.map(({ partyId: _unused, ...app }, at) => (at === 0 ? { ...app, partyId: 'a' } : app)) }, DAY)
    expect(conwaySum(few, conwayPairs(few, few.findings)).lowCoverage).toBe(true)
    expect(conwaySum(conwayMap({ ...INPUT, applications: [] }, DAY), []).lowCoverage).toBe(false)
  })

  it('counts in a cell the interfaces with nothing said, and a pair wholly marked as intended asks for nothing', () => {
    const ab = pairs.find((pair) => pair.a === 'a' && pair.b === 'b')
    expect(ab).toMatchObject({ standing: 'attention' })
    expect(ab?.open.map((line) => line.flow.id)).toEqual(['f1', 'f2'])
    const marked = conwayPairs(map, map.findings.filter((one) => one.kind !== 'undeclared'))
    expect(marked.find((pair) => pair.a === 'a' && pair.b === 'b')).toMatchObject({ standing: 'accepted', open: [] })
    expect(conwaySum(map, marked)).toMatchObject({ attention: 0, accepted: 2 })
  })

  it('reads a pair said with no system between them apart, and back to accepted once its note is marked', () => {
    const said = conwayMap({ ...INPUT, flows: [] }, DAY)
    const reading = conwayPairs(said, said.findings).find((pair) => pair.interactions.length > 0)
    expect(reading).toMatchObject({ standing: 'unused' })
    expect(conwayPairs(said, []).find((pair) => pair.interactions.length > 0)).toMatchObject({ standing: 'accepted' })
  })

  it('lists the owning units beneath a rolled-up pair, those with something unsaid first, and nothing where the columns are the owners', () => {
    const grouped = conwayMap(INPUT, DAY, { groupBy: 'ut-c' })
    const top = conwayPairs(grouped, grouped.findings).find((pair) => pair.a === 'north' && pair.b === 'south')
    expect(top).toBeDefined()
    expect(pairsUnder(grouped, top!.lines, top!.open).map(({ a, b, lines, open }) => [a, b, lines.length, open.length]))
      .toEqual([['a', 'b', 2, 2], ['a', 'c', 1, 0]])
    const ab = pairs.find((pair) => pair.a === 'a' && pair.b === 'b')!
    expect(pairsUnder(map, ab.lines, ab.open)).toEqual([])
    expect(linesOfPair(grouped, 'a', 'b').map((line) => line.flow.id)).toEqual(['f1', 'f2'])
    expect(linesOfPair(grouped, 'north', 'south').map((line) => line.flow.id)).toEqual(['f1', 'f2', 'f3'])
  })

  it('reads one unit and one application off the map', () => {
    expect(unitOnMap(map, pairs, 'a')).toMatchObject({ owns: [{ id: 'one' }], worksWith: [{ id: 'i1' }] })
    expect(unitOnMap(map, pairs, 'a').openPairs.map((pair) => pair.b)).toEqual(['b'])
    expect(applicationOnMap(map, 'loose')?.lines.map((line) => line.flow.id)).toEqual(['f4', 'f5'])
    expect(applicationOnMap(map, 'nowhere')).toBeUndefined()
  })

  it('knows when a grouping rolls nothing up, so the verdict can say so', () => {
    expect(groupingRollsUp(map, INPUT.units, undefined)).toBe(true)
    expect(groupingRollsUp(conwayMap(INPUT, DAY, { groupBy: 'ut-c' }), INPUT.units, 'ut-c')).toBe(true)
    const none = { ...INPUT, units: [unit('a', 'ut-t'), unit('b', 'ut-t'), unit('c', 'ut-t')] }
    expect(groupingRollsUp(conwayMap(none, DAY, { groupBy: 'ut-c' }), none.units, 'ut-c')).toBe(false)
  })
})
