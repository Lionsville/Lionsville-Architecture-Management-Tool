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

/** How far round a card a line keeps where the gap allows it, and what a turn costs against a straight run. */
const CLEAR = 12
const TURN = 40
/** Leaving or reaching a card by another side than the plain route's costs this much more, so the plain side wins where it can. */
const OTHER_SIDE = 60

/** Does a straight stretch of line run through a box's inside? Along its edge is not through it. */
function crosses(from: Point, to: Point, box: Rect): boolean {
  const left = Math.min(from.x, to.x)
  const right = Math.max(from.x, to.x)
  const top = Math.min(from.y, to.y)
  const bottom = Math.max(from.y, to.y)
  return left < box.right - 1 && right > box.left + 1 && top < box.bottom - 1 && bottom > box.top + 1
}

const clearOf = (points: readonly Point[], boxes: readonly Rect[]) =>
  points.every((point, at) => at === 0 || boxes.every((box) => !crosses(points[at - 1]!, point, box)))

type Step = { readonly dx: number; readonly dy: number }
const STEPS: readonly Step[] = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]

/** The four places a line may leave or reach a card: a side's middle, or level with the name in it; and the way out of the card there. */
function sidesOf(end: LineEnd): { point: Point; out: number }[] {
  const x = end.at?.x ?? middleX(end)
  const y = end.at?.y ?? middleY(end)
  return [
    { point: { x: end.right, y }, out: 0 }, { point: { x: end.left, y }, out: 1 },
    { point: { x, y: end.bottom }, out: 2 }, { point: { x, y: end.top }, out: 3 },
  ]
}

/** Points that turn nowhere are dropped: a straight run is one stretch. */
function straightened(points: readonly Point[]): Point[] {
  const kept: Point[] = []
  const level = (p: number, q: number) => Math.abs(p - q) < 0.01
  for (const point of points) {
    const last = kept[kept.length - 1]
    if (last && level(last.x, point.x) && level(last.y, point.y)) continue
    const before = kept[kept.length - 2]
    if (before && last && ((level(before.x, last.x) && level(last.x, point.x)) || (level(before.y, last.y) && level(last.y, point.y)))) kept.pop()
    kept.push(point)
  }
  return kept
}

/**
 * Where lines may run: along each card's edges at a clearance, down the middle
 * of every gap between two cards' edges, and through the points the ends offer.
 */
function lanesOf(edges: readonly number[], ends: readonly number[]): number[] {
  const sorted = [...new Set(edges.map(round))].sort((p, q) => p - q)
  const middles = sorted.slice(1).map((value, at) => (value + sorted[at]!) / 2)
  return [...new Set([...ends, ...middles, ...edges.flatMap((edge) => [edge - CLEAR, edge + CLEAR])].map(round))].sort((p, q) => p - q)
}

/**
 * A reporting line that keeps off every other card: the plain route where it
 * crosses none, and otherwise the shortest right-angled way along the gutters
 * round the cards, turning as little as it can, out of whichever side of its
 * card is clear. Across a card it ran over the names in it, which the chart is
 * there to show.
 */
export function routeAround(a: LineEnd, b: LineEnd, within: boolean, cards: readonly Rect[]): Point[] {
  const plain = routeBetween(a, b, within)
  const holds = (box: Rect, end: Rect) => box.left <= end.left + 1 && box.top <= end.top + 1 && box.right >= end.right - 1 && box.bottom >= end.bottom - 1
  const others = cards.filter((box) => !holds(box, a) && !holds(box, b))
  if (within || clearOf(plain, others)) return plain
  // Only the cards near the two ends make the gutters; the walls are every card, the two ends included.
  const reach = 240
  const near = (box: Rect) => box.right > Math.min(a.left, b.left) - reach && box.left < Math.max(a.right, b.right) + reach
    && box.bottom > Math.min(a.top, b.top) - reach && box.top < Math.max(a.bottom, b.bottom) + reach
  const walls = [a, b, ...others.filter(near)]
  const found = gutterRoute(sidesOf(a), sidesOf(b), plain[0]!, plain[plain.length - 1]!, walls)
  return found ? straightened(found) : plain
}

type Side = { point: Point; out: number }

/** The cheapest right-angled way from a side of one card to a side of the other through the gaps between the walls, or none. */
function gutterRoute(starts: readonly Side[], goals: readonly Side[], plainStart: Point, plainEnd: Point, walls: readonly Rect[]): Point[] | undefined {
  const all = [...starts, ...goals].map((one) => one.point)
  const xs = lanesOf(walls.flatMap((box) => [box.left, box.right]), all.map((point) => point.x))
  const ys = lanesOf(walls.flatMap((box) => [box.top, box.bottom]), all.map((point) => point.y))
  const width = xs.length
  const node = (point: Point) => xs.indexOf(round(point.x)) + ys.indexOf(round(point.y)) * width
  const inside = (point: Point) => walls.some((box) => point.x > box.left + 0.5 && point.x < box.right - 0.5 && point.y > box.top + 0.5 && point.y < box.bottom - 0.5)
  const near = (p: Point, q: Point) => Math.abs(p.x - q.x) < 1 && Math.abs(p.y - q.y) < 1
  // A goal is reached moving into its card: the arrowhead points at the side it ends on.
  const goalAt = new Map(goals.map((goal) => [node(goal.point), { into: goal.out ^ 1, extra: near(goal.point, plainEnd) ? 0 : OTHER_SIDE }]))
  const cost = new Map<number, number>()
  const back = new Map<number, number>()
  const heap = new Heap()
  for (const start of starts) {
    const state = node(start.point) * 4 + start.out
    const value = near(start.point, plainStart) ? 0 : OTHER_SIDE
    if (value < (cost.get(state) ?? Infinity)) { cost.set(state, value); heap.push(state, value) }
  }
  let best: { state: number; value: number } | undefined
  for (let next = heap.pop(); next; next = heap.pop()) {
    const [spent, state] = next
    if (spent > (cost.get(state) ?? Infinity) || (best && spent >= best.value)) continue
    const at = state >> 2
    const facing = state & 3
    const goal = goalAt.get(at)
    if (goal && goal.into === facing && back.has(state)) {
      if (!best || spent + goal.extra < best.value) best = { state, value: spent + goal.extra }
      continue
    }
    for (const { key, value } of movesFrom({ xs, ys, walls, inside }, at, facing, spent, !back.has(state))) {
      if (value < (cost.get(key) ?? Infinity)) { cost.set(key, value); back.set(key, state); heap.push(key, value) }
    }
  }
  if (!best) return undefined
  const points: Point[] = []
  for (let at: number | undefined = best.state; at !== undefined; at = back.get(at)) points.unshift({ x: xs[(at >> 2) % width]!, y: ys[Math.floor((at >> 2) / width)]! })
  return points
}

/** The moves on from a crossing of two lanes: straight on or a turn, never back, never through a wall; out of a card's side straight. */
function movesFrom(grid: { xs: readonly number[]; ys: readonly number[]; walls: readonly Rect[]; inside: (point: Point) => boolean }, at: number, facing: number, spent: number, leaving: boolean) {
  const { xs, ys, walls, inside } = grid
  const width = xs.length
  const ix = at % width
  const iy = Math.floor(at / width)
  const here = { x: xs[ix]!, y: ys[iy]! }
  const moves: { key: number; value: number }[] = []
  for (const [turn, step] of STEPS.entries()) {
    const nx = ix + step.dx
    const ny = iy + step.dy
    const back = STEPS[facing]!.dx === -step.dx && STEPS[facing]!.dy === -step.dy
    if ((leaving && turn !== facing) || back || nx < 0 || ny < 0 || nx >= width || ny >= ys.length) continue
    const there = { x: xs[nx]!, y: ys[ny]! }
    if (inside(there) || walls.some((box) => crosses(here, there, box))) continue
    moves.push({ key: (nx + ny * width) * 4 + turn, value: spent + Math.abs(there.x - here.x) + Math.abs(there.y - here.y) + (turn === facing ? 0 : TURN) })
  }
  return moves
}

/** The cheapest first: a binary heap of states by what reaching them cost. */
class Heap {
  private readonly items: [number, number][] = []
  push(state: number, value: number) {
    const items = this.items
    items.push([value, state])
    for (let at = items.length - 1; at > 0;) {
      const up = (at - 1) >> 1
      if (items[up]![0] <= items[at]![0]) break
      ;[items[up], items[at]] = [items[at]!, items[up]!]
      at = up
    }
  }
  pop(): [number, number] | undefined {
    const items = this.items
    const top = items[0]
    const last = items.pop()
    if (items.length > 0 && last) {
      items[0] = last
      for (let at = 0; ;) {
        const left = at * 2 + 1
        const right = left + 1
        let least = at
        if (left < items.length && items[left]![0] < items[least]![0]) least = left
        if (right < items.length && items[right]![0] < items[least]![0]) least = right
        if (least === at) break
        ;[items[least], items[at]] = [items[at]!, items[least]!]
        at = least
      }
    }
    return top
  }
}

/** A tag's box, centred on where it sits. */
export type TagBox = Point & { width: number; height: number }

const hits = (tag: TagBox, box: Rect) =>
  tag.x - tag.width / 2 < box.right && tag.x + tag.width / 2 > box.left && tag.y - tag.height / 2 < box.bottom && tag.y + tag.height / 2 > box.top

/**
 * Where a line's tag sits: on its line, in a gutter, clear of every card and of
 * the tags already placed; the line's middle first, then the places nearest it.
 * A tag on a card's title hid the name the card is for. Where nowhere on the
 * line is clear, the middle.
 */
export function placeTags(lines: readonly { points: readonly Point[]; width: number; height: number; above: number }[], cards: readonly Rect[]): Point[] {
  const placed: TagBox[] = []
  return lines.map(({ points, width, height, above }) => {
    const middle = middleOf(points)
    const onLine = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88].map((share) => along(points, share))
    // Then the nearest clear place beside it, where a gap is too narrow to hold the words on the line.
    const beside = onLine.slice(0, 3).flatMap((point) => NEARBY.map((step) => ({ x: point.x + step.x, y: point.y + step.y })))
    const tries = [...onLine, ...beside]
    const clear = tries.find((point) => {
      const tag = { x: point.x, y: point.y - above, width, height }
      return cards.every((box) => !hits(tag, box)) && placed.every((other) => !hits(tag, { left: other.x - other.width / 2, right: other.x + other.width / 2, top: other.y - other.height / 2, bottom: other.y + other.height / 2 }))
    })
    const at = clear ?? middle
    placed.push({ x: at.x, y: at.y - above, width, height })
    return at
  })
}

/** Places round a point a tag may move to, nearest first, out to where it would no longer read as its line's. */
const NEARBY: readonly Point[] = (() => {
  const steps: Point[] = []
  for (let x = -160; x <= 160; x += 16) for (let y = -96; y <= 96; y += 8) if (x !== 0 || y !== 0) steps.push({ x, y })
  return steps.sort((p, q) => Math.hypot(p.x, p.y * 2) - Math.hypot(q.x, q.y * 2))
})()

/** A share of the way along a route by its length. */
function along(points: readonly Point[], share: number): Point {
  const lengths = points.slice(1).map((point, at) => Math.abs(point.x - points[at]!.x) + Math.abs(point.y - points[at]!.y))
  let left = lengths.reduce((sum, one) => sum + one, 0) * share
  for (const [at, length] of lengths.entries()) {
    if (left <= length && length > 0) {
      const from = points[at]!
      const to = points[at + 1]!
      return { x: from.x + ((to.x - from.x) * left) / length, y: from.y + ((to.y - from.y) * left) / length }
    }
    left -= length
  }
  return points[points.length - 1] ?? { x: 0, y: 0 }
}
