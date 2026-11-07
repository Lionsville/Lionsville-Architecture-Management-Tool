// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { bandRowsFor, bandStepRoomy, contentHeight, firstLayout, minWidth, POSTER_COLUMN_ID, POSTER_GAP, POSTER_WIDTH, readingOrder, tileColumns } from './posterLayout'
import type { PosterAreaSize, PosterBlock } from './posterLayout'

const plain = (id: string, tiles: number, span?: number): PosterAreaSize => ({ id, groupings: [], loose: tiles, ...(span !== undefined ? { span } : {}) })
const overlap = (a: PosterBlock, b: PosterBlock) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

describe('a block on the poster', () => {
  it('stands as tall as its rows of tiles, its title, its meter and its frame', () => {
    expect(contentHeight(plain('a', 9, 5))).toBe(2 * 52 - 6 + 46)
    expect(contentHeight(plain('a', 10, 5))).toBe(2 * 52 - 6 + 46)
    expect(contentHeight(plain('a', 11, 5))).toBe(3 * 52 - 6 + 46)
  })

  it('takes the height of its tallest grouping, the loose tiles among them without a head', () => {
    const grouped: PosterAreaSize = { id: 'a', groupings: [4, 8], loose: 1 }
    expect(tileColumns(8)).toBe(4)
    expect(contentHeight(grouped)).toBe(2 * 52 - 6 + 18 + 7 + 46)
  })

  it('is wide enough for its columns, or its groupings side by side', () => {
    expect(minWidth(plain('a', 9, 5))).toBe(5 * 116 - 6 + 16)
    const grouped: PosterAreaSize = { id: 'a', groupings: [4], loose: 0 }
    expect(minWidth(grouped)).toBe(tileColumns(4) * 116 + 12 + 16)
  })
})

describe('the first layout', () => {
  const areas = Array.from({ length: 15 }, (_, index) => plain(`area-${index}`, 3 + (index * 5) % 13))
  const laid = firstLayout({ areas, band: { id: 'journey', steps: 34, lanes: 1 }, column: { groups: 8, rows: 25 } })

  it('fills the width of the page on every shelf', () => {
    const rights = laid.blocks.filter((block) => block.id.startsWith('area-')).reduce((held, block) => {
      held.set(block.y, Math.max(held.get(block.y) ?? 0, block.x + block.width))
      return held
    }, new Map<number, number>())
    expect([...rights.values()].every((right) => right === POSTER_WIDTH)).toBe(true)
  })

  it('overlaps nothing, and keeps the gaps', () => {
    for (const a of laid.blocks) for (const b of laid.blocks) if (a !== b) expect(overlap(a, b)).toBe(false)
    const shelf = laid.blocks.filter((block) => block.y === laid.blocks.find((one) => one.id === 'area-0')?.y).sort((a, b) => a.x - b.x)
    expect((shelf[1]?.x ?? 0) - ((shelf[0]?.x ?? 0) + (shelf[0]?.width ?? 0))).toBe(POSTER_GAP)
  })

  it('runs the column the whole height of the page', () => {
    expect(laid.blocks.find((block) => block.id === POSTER_COLUMN_ID)).toMatchObject({ x: 0, y: 0, width: 176, height: laid.height })
  })

  it('leaves a band and a column out where the sheet has none, and the areas then take the page', () => {
    const bare = firstLayout({ areas: [plain('a', 4)] })
    expect(bare.blocks).toEqual([{ id: 'a', x: 0, y: 0, width: POSTER_WIDTH, height: contentHeight(plain('a', 4)) }])
  })

  it('is the same answer every time', () => {
    expect(firstLayout({ areas, band: { id: 'journey', steps: 34, lanes: 1 }, column: { groups: 8, rows: 25 } })).toEqual(laid)
  })

  it('does not let a block wider than the page push out of it', () => {
    const wide = firstLayout({ areas: [plain('a', 600)] })
    expect(wide.blocks[0]?.width).toBe(POSTER_WIDTH)
  })
})

describe('the journey band', () => {
  it('takes two rows where one would leave a step no room for whole words at a readable size', () => {
    expect(bandRowsFor(34, 1672)).toBe(2)
    expect(bandStepRoomy(34, 1672, 2)).toBe(true)
  })

  it('stays on one row where a step has the room', () => {
    expect(bandRowsFor(12, 1672)).toBe(1)
    expect(bandStepRoomy(12, 1672, 1)).toBe(true)
  })

  it('takes the rows a person set, and is then as small as it must be', () => {
    const laid = firstLayout({ areas: [], band: { id: 'j', steps: 34, lanes: 1, rows: 1 } })
    expect(laid.bandRows).toBe(1)
    expect(laid.blocks[0]?.height).toBe(112)
    expect(bandStepRoomy(34, 1860, 1)).toBe(false)
  })

  it('adds height for each lane, on each row', () => {
    const laid = firstLayout({ areas: [], band: { id: 'j', steps: 34, lanes: 2 } })
    expect(laid.blocks[0]?.height).toBe(2 * (112 + 40))
  })
})

describe('reading order', () => {
  it('runs top then left, whatever order the blocks were placed in', () => {
    expect(readingOrder([{ id: 'c', x: 0, y: 9 }, { id: 'b', x: 5, y: 0 }, { id: 'a', x: 0, y: 0 }]).map((block) => block.id)).toEqual(['a', 'b', 'c'])
  })
})
