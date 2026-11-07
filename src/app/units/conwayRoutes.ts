// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a Conway map's lines run: never over a name. A line leaves a card
 * sideways into the gutter beside its column, and two columns apart it climbs
 * to a lane of its own above them all, so it passes no card on the way. A lane
 * and a place in the gutter are shared only by lines that do not overlap.
 *
 * Plain arithmetic over boxes somebody measured: no words, no model.
 */

export type RouteBox = { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number }

/** One interface as a route wants it: which columns its ends sit in. */
export type RouteLine = { readonly key: string; readonly from: number; readonly to: number }

/** How far apart two lanes above the columns are, and two lines in a gutter. */
export const LANE_STEP = 7
export const GUTTER_STEP = 5

/**
 * A lane for each line that crosses more than one gutter, first come first
 * served: a lane is the first in which it overlaps nothing, by the columns it
 * spans. Those between neighbours need none.
 */
export function lanesOf(lines: readonly RouteLine[]): { lane: ReadonlyMap<string, number>; count: number } {
  const lane = new Map<string, number>()
  const taken: [number, number][][] = []
  const longFirst = [...lines].sort((x, y) => span(y) - span(x))
  for (const line of longFirst) {
    if (span(line) <= 1) continue
    const [low, high] = [Math.min(line.from, line.to), Math.max(line.from, line.to)]
    let at = taken.findIndex((held) => held.every(([a, b]) => high < a || low > b))
    if (at < 0) { at = taken.length; taken.push([]) }
    taken[at]?.push([low, high])
    lane.set(line.key, at)
  }
  return { lane, count: taken.length }
}

const span = (line: RouteLine) => Math.abs(line.from - line.to)

/** The path of one line: out of a card, along its gutter, over a lane where it has one, and into the other card. */
export function routeOf(
  line: RouteLine, source: RouteBox, target: RouteBox, columns: readonly RouteBox[],
  at: { lane: number | undefined; laneTop: number; track: number },
): string {
  const forward = line.to >= line.from
  const [from, to] = [columns[line.from], columns[line.to]]
  if (!from || !to) return ''
  const inGutter = (column: RouteBox, right: boolean) => (right ? column.right + 8 + at.track * GUTTER_STEP : column.left - 8 - at.track * GUTTER_STEP)
  const [y1, y2] = [(source.top + source.bottom) / 2, (target.top + target.bottom) / 2]
  const x1 = forward ? source.right : source.left
  const x2 = forward ? target.left : target.right
  const out = inGutter(from, forward)
  const into = inGutter(to, !forward)
  if (at.lane === undefined) return `M${x1},${y1} H${out} V${y2} H${x2}`
  const lane = at.laneTop + at.lane * LANE_STEP
  return `M${x1},${y1} H${out} V${lane} H${into} V${y2} H${x2}`
}
