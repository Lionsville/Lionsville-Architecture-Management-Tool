// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the structure's lines run (ADR-0036, amended 11 October 2026): one
 * from every place a unit type may sit to the type, from the cards as they
 * ended up — measured by the screen, never stored.
 *
 * - **To the next lane** a line runs straight across the gap between the two
 *   lanes, from the right of the place to the left of the type.
 * - **A line that skips a lane** — a type that may sit at the top and also in
 *   a type of lane 1 is in lane 2, so its line from the organisation passes
 *   lane 1 — runs along a rail above the cards, where the cards in between
 *   cannot hide it. Each has a rail of its own, one above the other, so two
 *   are never drawn as one.
 * - **A line a loop was cut at** (`model/unitOrder.ts`) runs back up the
 *   lanes along a rail of its own, or from a type to itself, a small loop at
 *   its own side. The screen draws both dashed.
 *
 * A line to or from a type that sits nowhere is not drawn: those wait in a
 * tray under the lanes, and a line down to them would cross everything.
 *
 * Pure, and no words.
 */
import type { SitsIn, UnitTypeLanes } from '../../model/unitOrder'

/** A card's box on the stage, measured from the stage's own top-left corner. */
export type CardBox = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

/** How a line runs: across to the next lane, along the rail over a lane it skips, or back where a loop was cut. */
export type LineShape = 'next' | 'rail' | 'loop'

export type LaneLine = {
  readonly key: string
  readonly edge: SitsIn
  readonly shape: LineShape
  /** The SVG path, in the stage's coordinates. */
  readonly d: string
}

/** How far down a card a line meets it: beside its name. */
export const LINE_ANCHOR = 16
/** The first rail's height in the band above the cards, and the room between two rails. */
export const RAIL_TOP = 4
export const RAIL_STEP = 5

/** How the stage finds a card: a type's by its id, the organisation's with none. */
export type BoxOf = (type: string | undefined) => CardBox | undefined

/** The lane each end of a line is in — the organisation's is 0 — or nothing where either sits nowhere. */
function lanesOf(structure: UnitTypeLanes, edge: SitsIn): { from: number; to: number } | undefined {
  const to = structure.laneOf.get(edge.type)
  const from = edge.sitsIn === undefined ? 0 : structure.laneOf.get(edge.sitsIn)
  return to === undefined || from === undefined ? undefined : { from, to }
}

/** How each drawn line runs, by the lanes alone: what the band above the cards is sized from, before anything is measured. */
function shapes(structure: UnitTypeLanes): { edge: SitsIn; shape: LineShape; rail?: number }[] {
  let rails = 0
  const drawn: { edge: SitsIn; shape: LineShape; rail?: number }[] = []
  for (const edge of structure.sitsIn) {
    const lanes = lanesOf(structure, edge)
    if (!lanes) continue
    if (edge.loop) drawn.push(edge.sitsIn === edge.type ? { edge, shape: 'loop' } : { edge, shape: 'loop', rail: rails++ })
    else if (lanes.to - lanes.from > 1) drawn.push({ edge, shape: 'rail', rail: rails++ })
    else drawn.push({ edge, shape: 'next' })
  }
  return drawn
}

/** How many lines run along the rail: the band above the cards holds one rail for each. */
export function railCount(structure: UnitTypeLanes): number {
  return shapes(structure).filter((one) => one.rail !== undefined).length
}

/** The height of the band above the cards that holds the rails, in pixels. */
export function railBand(structure: UnitTypeLanes): number {
  return Math.max(12, RAIL_TOP + railCount(structure) * RAIL_STEP + 6)
}

export function laneLines(structure: UnitTypeLanes, boxOf: BoxOf): LaneLine[] {
  const lines: LaneLine[] = []
  for (const { edge, shape, rail } of shapes(structure)) {
    const from = boxOf(edge.sitsIn)
    const to = boxOf(edge.type)
    if (!from || !to) continue
    const y = rail === undefined ? 0 : RAIL_TOP + rail * RAIL_STEP
    const d = shape === 'next' ? across(from, to) : shape === 'rail' ? alongRail(from, to, y) : rail === undefined ? toItself(to) : backUp(from, to, y)
    lines.push({ key: `${edge.sitsIn ?? ''}>${edge.type}`, edge, shape, d })
  }
  return lines
}

function across(from: CardBox, to: CardBox): string {
  const x1 = from.right
  const y1 = from.top + LINE_ANCHOR
  const x2 = to.left
  const y2 = to.top + LINE_ANCHOR
  const mid = x1 + Math.max(24, (x2 - x1) / 2)
  return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`
}

function alongRail(from: CardBox, to: CardBox, rail: number): string {
  const x1 = from.right
  const y1 = from.top + LINE_ANCHOR
  const x2 = to.left
  const y2 = to.top + LINE_ANCHOR
  return `M${x1},${y1} C${x1 + 18},${y1} ${x1 + 18},${rail} ${x1 + 36},${rail} L${x2 - 36},${rail} C${x2 - 18},${rail} ${x2 - 18},${y2} ${x2},${y2}`
}

/**
 * Back up the lanes: out of the place's right side into the gap beside it, up
 * to the rail, back along it, and down into the type's right side — through
 * the gaps between lanes, so no card of either lane hides it. The type of a
 * line cut at a loop is always in an earlier lane than the place.
 */
function backUp(from: CardBox, to: CardBox, rail: number): string {
  const x1 = from.right
  const y1 = from.top + LINE_ANCHOR
  const x2 = to.right
  const y2 = to.top + LINE_ANCHOR
  return `M${x1},${y1} C${x1 + 18},${y1} ${x1 + 18},${rail} ${x1},${rail} L${x2 + 36},${rail} C${x2 + 18},${rail} ${x2 + 18},${y2} ${x2},${y2}`
}

function toItself(box: CardBox): string {
  const x = box.right
  const y = box.top + LINE_ANCHOR
  return `M${x},${y - 6} C${x + 22},${y - 16} ${x + 22},${y + 16} ${x},${y + 6}`
}
