// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the chart's lines run, from rectangles measured on the page: the
 * connectors that show where a unit sits, and the reporting lines over them.
 * Right angles only, along the gaps the tree leaves, because a curve across
 * the boxes is what made the old lines hard to follow. Pure, so a route is
 * tested without a browser to measure in.
 */
import type { ChartShape } from '../../model/orgChart'

export type Rect = { left: number; top: number; right: number; bottom: number }
export type Point = { x: number; y: number }
/** A box a line leaves, and the name in it the line is about: the line starts at the box's edge, level with the name, so it crosses none of its words. */
export type LineEnd = Rect & { at?: Point }

/** How far under a parent the bus of an across row runs, as a share of the gap, and how far in a hanging rail is. */
const RAIL_IN = 10
const HOOK = 14

const middleX = (rect: Rect) => (rect.left + rect.right) / 2
const middleY = (rect: Rect) => (rect.top + rect.bottom) / 2

/** A route as an SVG path. */
export function pathOf(points: readonly Point[]): string {
  return points.map((point, at) => `${at === 0 ? 'M' : 'L'}${round(point.x)},${round(point.y)}`).join(' ')
}

const round = (value: number) => Math.round(value * 100) / 100

/** The connectors from a unit to the units under it, as one path each. */
export function connectorsOf(parent: Rect, children: readonly Rect[], shape: ChartShape): string[] {
  if (children.length === 0) return []
  if (shape === 'hanging') {
    const rail = parent.left + RAIL_IN
    const last = Math.max(...children.map(middleY))
    return [
      pathOf([{ x: rail, y: parent.bottom }, { x: rail, y: last }]),
      ...children.map((child) => pathOf([{ x: rail, y: middleY(child) }, { x: child.left, y: middleY(child) }])),
    ]
  }
  // A grid's lower rows read as the same row carried on: only the first is joined.
  const firstTop = Math.min(...children.map((child) => child.top))
  const joined = shape === 'grid' ? children.filter((child) => child.top - firstTop < 1) : children
  const from = middleX(parent)
  const bus = (parent.bottom + firstTop) / 2
  const xs = joined.map(middleX)
  return [
    pathOf([{ x: from, y: parent.bottom }, { x: from, y: bus }]),
    pathOf([{ x: Math.min(from, ...xs), y: bus }, { x: Math.max(from, ...xs), y: bus }]),
    ...joined.map((child) => pathOf([{ x: middleX(child), y: bus }, { x: middleX(child), y: child.top }])),
  ]
}

/**
 * A reporting line from one box to another, ending at the far box's edge:
 * straight out of the side that faces it, along the middle of the gap, and in.
 * Two boxes that overlap on neither axis go out and up, and within one box the
 * line hooks out of the left of the two rows.
 */
export function routeBetween(a: LineEnd, b: LineEnd, within: boolean): Point[] {
  const xOf = (end: LineEnd) => end.at?.x ?? middleX(end)
  const yOf = (end: LineEnd) => end.at?.y ?? middleY(end)
  if (within) {
    const bend = Math.min(a.left, b.left) - HOOK
    return [{ x: a.left, y: yOf(a) }, { x: bend, y: yOf(a) }, { x: bend, y: yOf(b) }, { x: b.left, y: yOf(b) }]
  }
  if (b.bottom <= a.top || a.bottom <= b.top) {
    const down = b.top >= a.bottom
    const start = { x: xOf(a), y: down ? a.bottom : a.top }
    const end = { x: xOf(b), y: down ? b.top : b.bottom }
    if (Math.abs(start.x - end.x) < 1) return [start, { x: start.x, y: end.y }]
    const middle = (start.y + end.y) / 2
    return [start, { x: start.x, y: middle }, { x: end.x, y: middle }, end]
  }
  const rightwards = b.left >= a.left
  const start = { x: rightwards ? a.right : a.left, y: yOf(a) }
  const end = { x: rightwards ? b.left : b.right, y: yOf(b) }
  if (Math.abs(start.y - end.y) < 1) return [start, { x: end.x, y: start.y }]
  const middle = (start.x + end.x) / 2
  return [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end]
}

/** Halfway along a route by its length: where its tag sits. */
export function middleOf(points: readonly Point[]): Point {
  const lengths = points.slice(1).map((point, at) => Math.abs(point.x - points[at]!.x) + Math.abs(point.y - points[at]!.y))
  let left = lengths.reduce((sum, one) => sum + one, 0) / 2
  for (const [at, length] of lengths.entries()) {
    if (left <= length && length > 0) {
      const from = points[at]!
      const to = points[at + 1]!
      const share = left / length
      return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share }
    }
    left -= length
  }
  return points[0] ?? { x: 0, y: 0 }
}
