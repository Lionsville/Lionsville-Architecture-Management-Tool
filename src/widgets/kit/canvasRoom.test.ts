// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { insetsFor, roomsFor } from './canvasRoom'
import { FIT_GAP, frameInRoom, frameInRooms } from './zoom'

const pane = { left: 0, top: 0, right: 1000, bottom: 800 }

describe('the room floating controls leave', () => {
  it('is the whole pane less a gap where nothing floats', () => {
    expect(insetsFor(pane, [])).toEqual({ top: FIT_GAP, right: FIT_GAP, bottom: FIT_GAP, left: FIT_GAP })
  })

  it('loses a row along the bottom to a wide dock there', () => {
    const dock = { left: 16, top: 740, right: 360, bottom: 784 }
    expect(insetsFor(pane, [dock]).bottom).toBe(800 - 740 + FIT_GAP)
  })

  it('loses a column to a tall key at the side, where that costs less than a row', () => {
    const key = { left: 800, top: 300, right: 984, bottom: 784 }
    const insets = insetsFor(pane, [key])
    expect(insets.right).toBe(1000 - 800 + FIT_GAP)
    expect(insets.bottom).toBe(FIT_GAP)
  })

  it('keeps the larger of two floats on one edge, and ignores one off the pane', () => {
    const dock = { left: 16, top: 740, right: 360, bottom: 784 }
    const key = { left: 600, top: 700, right: 984, bottom: 784 }
    const away = { left: 1200, top: 0, right: 1300, bottom: 50 }
    expect(insetsFor(pane, [dock, key, away])).toEqual({ top: FIT_GAP, right: FIT_GAP, bottom: 100 + FIT_GAP, left: FIT_GAP })
  })
})

describe('the rooms a fit tries', () => {
  const key = { left: 600, top: 700, right: 984, bottom: 784 }

  it('lets each float take either strip, the cheapest room first', () => {
    const rooms = roomsFor(pane, [key])
    expect(rooms[0]).toEqual(insetsFor(pane, [key]))
    expect(rooms).toHaveLength(2)
    expect(rooms[1]).toMatchObject({ right: 1000 - 600 + FIT_GAP, bottom: FIT_GAP })
  })

  it('frames a tall drawing larger beside a key in a corner than over it', () => {
    const tall = { x: 0, y: 0, width: 300, height: 1200 }
    const rooms = roomsFor(pane, [key])
    const over = frameInRoom(tall, { width: 1000, height: 800 }, rooms[0], { floor: 0.1, ceiling: 1 })!
    const best = frameInRooms(tall, { width: 1000, height: 800 }, rooms, { floor: 0.1, ceiling: 1 })!
    expect(best.zoom).toBeGreaterThan(over.zoom)
  })
})

describe('a frame in that room', () => {
  const room = { top: 10, right: 10, bottom: 110, left: 10 }

  it('centres what fits inside the room, not the pane, so the controls stay off it', () => {
    const view = frameInRoom({ x: 0, y: 0, width: 400, height: 200 }, { width: 1000, height: 800 }, room)!
    expect(view.zoom).toBe(1)
    expect(view.x).toBe(10 + (980 - 400) / 2)
    expect(view.y).toBe(10 + (680 - 200) / 2)
    expect(view.y + 200).toBeLessThanOrEqual(800 - 110)
  })

  it('shrinks to the room, never past its ceiling', () => {
    const view = frameInRoom({ x: 100, y: 50, width: 1960, height: 680 }, { width: 1000, height: 800 }, room, { floor: 0.2, ceiling: 1 })!
    expect(view.zoom).toBe(0.5)
    // The drawing's own origin is taken off.
    expect(view.x).toBe(10 - 100 * 0.5)
  })

  it('starts at the room\'s start where even the floor does not fit, and goes no lower', () => {
    const view = frameInRoom({ x: 0, y: 0, width: 1000, height: 2000 }, { width: 1000, height: 800 }, room, { floor: 0.6, ceiling: 1 })!
    expect(view.zoom).toBe(0.6)
    expect(view.y).toBe(10)
    expect(view.x).toBe(10 + (980 - 600) / 2)
  })

  it('frames nothing where there is nothing to frame or no room', () => {
    expect(frameInRoom({ x: 0, y: 0, width: 0, height: 10 }, { width: 100, height: 100 })).toBeUndefined()
    expect(frameInRoom({ x: 0, y: 0, width: 10, height: 10 }, { width: 20, height: 20 }, { top: 10, right: 10, bottom: 10, left: 10 })).toBeUndefined()
  })
})
