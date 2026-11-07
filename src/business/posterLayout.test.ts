// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { bandRowsFor, bandStepRoomy, contentHeight, firstLayout, freePlace, minWidth, nameLikelyCut, overlapsOf, POSTER_COLUMN_ID, POSTER_GAP, POSTER_WIDTH, readingOrder, tileCells, tileColumns, contentHeightAt, flowColumns, paperLayout } from './posterLayout'
import type { PosterAreaSize, PosterBlock } from './posterLayout'

const plain = (id: string, tiles: number, span?: number): PosterAreaSize => ({ id, groupings: [], loose: tiles, ...(span !== undefined ? { span } : {}) })
const overlap = (a: PosterBlock, b: PosterBlock) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

describe('a block pulled to another width', () => {
  const plain = { id: 'a', groupings: [], loose: 12 }
  it('comes to as many rows as its tiles take at that width, by the grid the browser draws', () => {
    expect(flowColumns(104 * 4 - 6)).toBe(4)
    expect(contentHeightAt(plain, 104 * 4 - 6 + 18)).toBe(3 * 52 - 6 + 46)
    expect(contentHeightAt(plain, 104 * 2 - 6 + 18)).toBe(6 * 52 - 6 + 46)
  })
  it('wraps its groupings when they no longer fit side by side', () => {
    const grouped = { id: 'b', groupings: [4, 4], loose: 0 }
    const wide = contentHeightAt(grouped, 1000)
    expect(contentHeightAt(grouped, 400)).toBeGreaterThan(wide)
  })
  it('says a line under its title in its height', () => {
    expect(contentHeight({ ...plain, line: true })).toBe(contentHeight(plain) + 16)
    expect(contentHeightAt({ ...plain, line: true }, 600)).toBe(contentHeightAt(plain, 600) + 16)
  })
})

describe('the first layout for paper', () => {
  const areas = (count: number) => Array.from({ length: count }, (_, at) => ({ id: `a${at}`, groupings: [], loose: 16 }))
  it('pulls a page with few tiles taller, to paper\'s shape', () => {
    const page = paperLayout({ areas: areas(2) })
    expect(page.width).toBe(1860)
    expect(page.height).toBe(Math.round(1860 / 1.41))
    expect(Math.max(...page.blocks.map((block) => block.y + block.height))).toBeLessThanOrEqual(page.height)
  })
  it('makes a page with many wider, never smaller in what is read', () => {
    const page = paperLayout({ areas: areas(60) })
    expect(page.width).toBeGreaterThan(1860)
    expect(page.width / page.height).toBeCloseTo(1.41, 1)
    expect(overlapsOf(page.blocks)).toEqual([])
  })
})

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

describe('a tile size', () => {
  it('changes a block\'s height and width by the arithmetic of its rows and columns', () => {
    const area = plain('a', 8)
    expect(contentHeight(area, 's')).toBe(2 * (40 + 6) - 6 + 46)
    expect(contentHeight(area, 'l')).toBe(2 * (54 + 6) - 6 + 46)
    expect(contentHeight(area)).toBe(contentHeight(area, 'm'))
    expect(minWidth(area, 's')).toBeLessThan(minWidth(area))
    expect(minWidth(area, 'l')).toBeGreaterThan(minWidth(area))
  })

  it('reaches the whole page', () => {
    const small = firstLayout({ areas: [plain('a', 12)], tile: 's' })
    const large = firstLayout({ areas: [plain('a', 12)], tile: 'l' })
    expect(small.height).toBeLessThan(large.height)
  })
})

describe('overlaps', () => {
  const at = (id: string, x: number, y: number): PosterBlock => ({ id, x, y, width: 100, height: 100 })
  it('names the pairs, and blocks that only touch are no overlap', () => {
    expect(overlapsOf([at('a', 0, 0), at('b', 50, 50), at('c', 100, 0), at('d', 400, 400)])).toEqual([{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }])
  })
  it('finds none in a first layout', () => {
    const laid = firstLayout({ areas: [plain('a', 30), plain('b', 12), plain('c', 3), plain('d', 40)], band: { id: 'j', steps: 34, lanes: 2 }, column: { groups: 4, rows: 25 } })
    expect(overlapsOf(laid.blocks)).toEqual([])
  })
})

describe('a free place', () => {
  const page = { width: 1860, height: 1000 }
  const block = (x: number, y: number, width: number, height: number): PosterBlock => ({ id: `${x}`, x, y, width, height })

  it('is the top left of an empty page', () => {
    expect(freePlace([], { width: 200, height: 100 }, page)).toEqual({ x: 0, y: 0 })
  })

  it('is a gap clear of what is there, on the grid, top then left', () => {
    const free = freePlace([block(0, 0, 300, 100)], { width: 200, height: 100 }, page)
    expect(free).toEqual({ x: 312, y: 0 })
    expect((free?.x ?? 1) % 8).toBe(0)
  })

  it('goes down a row when the row is full', () => {
    expect(freePlace([block(0, 0, 1800, 100)], { width: 200, height: 100 }, page)).toEqual({ x: 0, y: 112 })
  })

  it('is nothing when the page has no room', () => {
    expect(freePlace([block(0, 0, 1860, 1000)], { width: 200, height: 100 }, page)).toBeUndefined()
  })
})

describe('tiles in cells', () => {
  it('flow in their order when nobody placed any', () => {
    expect(tileCells(['a', 'b', 'c'], 2, {})).toEqual([
      { id: 'a', col: 0, row: 0, span: 1 }, { id: 'b', col: 1, row: 0, span: 1 }, { id: 'c', col: 0, row: 1, span: 1 },
    ])
  })

  it('flow round the exceptions, which stay where they were put', () => {
    const cells = tileCells(['a', 'b', 'c'], 2, { b: { col: 0, row: 0, span: 2 } })
    expect(cells).toEqual([
      { id: 'b', col: 0, row: 0, span: 2 }, { id: 'a', col: 0, row: 1, span: 1 }, { id: 'c', col: 1, row: 1, span: 1 },
    ])
  })

  it('come back to the edge of a block that got narrower', () => {
    expect(tileCells(['a'], 2, { a: { col: 5, row: 1 } })).toEqual([{ id: 'a', col: 1, row: 1, span: 1 }])
    expect(tileCells(['a'], 2, { a: { col: 1, row: 0, span: 4 } })).toEqual([{ id: 'a', col: 0, row: 0, span: 2 }])
  })
})

describe('a name\'s clamp, as near as arithmetic knows', () => {
  it('says a long name is cut and a short one is not', () => {
    expect(nameLikelyCut('Invoicing', 110)).toBe(false)
    expect(nameLikelyCut('Cross-border customs documentation and declarations handling', 110)).toBe(true)
  })
  it('counts two lines where a tile carries a label', () => {
    expect(nameLikelyCut('Customs documentation and handling', 110, 2)).toBe(true)
    expect(nameLikelyCut('Customs documentation and handling', 110, 3)).toBe(false)
  })
})
