// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The structure's lines, from cards placed where a test says: across to the
 * next lane, along a rail of its own over a lane skipped, back up where a
 * loop was cut, and none to a type that sits nowhere.
 */
import { describe, expect, it } from 'vitest'
import type { UnitType } from '../../model/operatingModel'
import { unitTypeLanes } from '../../model/unitOrder'
import { laneLines, LINE_ANCHOR, railBand, railCount, RAIL_STEP, RAIL_TOP } from './laneLines'
import type { CardBox } from './laneLines'

function type(id: string, over: Partial<UnitType> = {}): UnitType {
  return { id, name: id, within: [], slots: [], ...over }
}

/** Lane by lane, 300 pixels apart, cards 200 wide and 80 tall, one under the other. */
function placed(types: readonly UnitType[]) {
  const structure = unitTypeLanes(types)
  const boxes = new Map<string | undefined, CardBox>([[undefined, { left: 0, top: 20, right: 200, bottom: 100 }]])
  for (const lane of structure.lanes) {
    lane.types.forEach((one, at) => {
      boxes.set(one.id, { left: lane.lane * 300, top: 20 + at * 100, right: lane.lane * 300 + 200, bottom: 100 + at * 100 })
    })
  }
  return { structure, boxOf: (id: string | undefined) => boxes.get(id) }
}

describe('the lines between the lanes', () => {
  it('runs a line across to the next lane, from the place\'s right to the type\'s left', () => {
    const { structure, boxOf } = placed([type('domain', { top: true }), type('team', { within: ['domain'] })])
    const lines = laneLines(structure, boxOf)
    expect(lines.map((one) => [one.key, one.shape])).toEqual([['>domain', 'next'], ['domain>team', 'next']])
    expect(lines[1].d).toBe(`M500,${20 + LINE_ANCHOR} C550,${20 + LINE_ANCHOR} 550,${20 + LINE_ANCHOR} 600,${20 + LINE_ANCHOR}`)
    expect(railCount(structure)).toBe(0)
    expect(railBand(structure)).toBe(12)
  })

  it('runs a line that skips a lane along a rail of its own, above the cards', () => {
    // A cluster may sit at the top or in a domain: it is in lane 2, and its line from the organisation passes lane 1.
    const types = [
      type('domain', { top: true }), type('cluster', { top: true, within: ['domain'] }), type('team', { top: true, within: ['cluster'] }),
    ]
    const { structure, boxOf } = placed(types)
    const lines = laneLines(structure, boxOf)
    expect(lines.map((one) => [one.key, one.shape])).toEqual([
      ['>cluster', 'rail'], ['domain>cluster', 'next'], ['>domain', 'next'], ['>team', 'rail'], ['cluster>team', 'next'],
    ])
    const [first, , , second] = lines
    expect(first.d).toContain(` L${600 - 36},${RAIL_TOP} `)
    expect(second.d).toContain(` L${900 - 36},${RAIL_TOP + RAIL_STEP} `)
    expect(railCount(structure)).toBe(2)
    expect(railBand(structure)).toBe(RAIL_TOP + 2 * RAIL_STEP + 6)
  })

  it('runs a line cut at a loop back up the lanes, dashed by the screen, and a type in itself round its own side', () => {
    const types = [type('a', { top: true, within: ['b'] }), type('b', { within: ['a', 'b'] })]
    const { structure, boxOf } = placed(types)
    const lines = laneLines(structure, boxOf)
    expect(lines.map((one) => [one.key, one.shape])).toEqual([['>a', 'next'], ['b>a', 'loop'], ['a>b', 'next'], ['b>b', 'loop']])
    // Back from b's right, along the one rail, into a's right.
    expect(lines[1].d.startsWith(`M800,${20 + LINE_ANCHOR} `)).toBe(true)
    expect(lines[1].d.endsWith(` 500,${20 + LINE_ANCHOR}`)).toBe(true)
    expect(lines[1].d).toContain(`,${RAIL_TOP} L536,${RAIL_TOP} `)
    expect(lines[3].d.startsWith(`M800,${20 + LINE_ANCHOR - 6} `)).toBe(true)
    expect(railCount(structure)).toBe(1)
  })

  it('draws no line to or from a type that sits nowhere, nor one whose card was not measured', () => {
    const types = [type('team', { top: true, within: ['guild'] }), type('guild', { within: ['nothing'] }), type('chapter', { within: ['guild'] })]
    const { structure, boxOf } = placed(types)
    expect(laneLines(structure, boxOf).map((one) => one.key)).toEqual(['>team'])
    expect(laneLines(structure, () => undefined)).toEqual([])
  })
})
