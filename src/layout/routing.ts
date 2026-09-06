import type { DesignConnection, Point, Rect } from '../model/types';
import { edgeLabelSize } from './edgeLabelSize';
import { closestSideToPoint, routeEndAnchor } from '../editor/edges/floatingEdgeMath';
import { rectIntersectsRect } from './geometry';

/**
 * LABEL placement for routed edges, plus the two clearance constants the routing
 * pipeline shares.
 *
 * There used to be a `detour` heuristic here — a single-channel bow-out around one
 * block of obstacles, the only router this package had. `libavoidRouter.ts` replaced
 * it wholesale (see
 * `docs/plans/2026-06-10-solution-design/edge-routing/2026-07-27-libavoid-adoption-plan.md`), so
 * what remains is the part libavoid cannot do: libavoid has no concept of a label,
 * and dropping ELK's bendpoints also dropped ELK's label dummy nodes, so **every
 * chip on the board is positioned by {@link labelSpotFor} and nothing else.**
 */

/** Centre point of a rect. */
export function rectCentre(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** True when `p` lies inside `r`. */
export function rectContainsPoint(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/** Clearance (px) a routed line must keep from an obstacle — `libavoidRouter`'s
 *  `shapeBufferDistance` and what the tests validate the final path against. */
export const ROUTE_CLEARANCE = 16;
/** Minimum gap (px) a routed edge's label keeps from any group box. */
export const LABEL_MARGIN = 12;

/**
 * A point on the drawn route for `conn`'s label that clears every rect in
 * `clearOf` (group boxes + node rects) by {@link LABEL_MARGIN}, chosen nearest the
 * route's natural midpoint (where the label would otherwise sit). `gapRefs` (the
 * group boxes) bias the choice toward a spot in open space between them. Returns
 * undefined when the edge has no label or no sampled point clears — then
 * FloatingEdge falls back to its own midpoint.
 *
 * `avoidChips` are the label rects ALREADY pinned on this board, and they exist to
 * solve a problem adopting libavoid's nudging creates rather than one it fixes.
 * `IDEAL_NUDGING_DISTANCE` is the gap between adjacent parallel channels, and at 32
 * it is just wide enough for two single-line chips (18 px tall, wanting
 * {@link LABEL_MARGIN} of clearance, so > 30 px) to miss each other. A chip with a
 * protocol line is 34 px tall and needs ~46 px, which no realistic nudge distance
 * gives without bloating every channel on the board. So that case is solved by
 * moving the chip, not the channel — which only works because the caller feeds the
 * chips back in as it goes, in canonical id order so the greedy result is stable.
 */
export function labelSpotFor(
  conn: DesignConnection,
  source: Rect,
  target: Rect,
  waypoints: Point[],
  clearOf: Rect[],
  gapRefs: Rect[],
  avoidChips: Rect[] = [],
): Point | undefined {
  const size = edgeLabelSize(conn);
  if (!size) return undefined;
  // Both branches mirror what FloatingEdge actually draws, so the chip lands ON the
  // line: a routed end attaches where its adjacent waypoint's leg arrives
  // (`routeEndAnchor`), a straight (waypoint-less) edge attaches to the side facing
  // the other node's centre.
  const routed = waypoints.length > 0;
  const start = routed
    ? routeEndAnchor(source, waypoints[0])
    : closestSideToPoint(source, rectCentre(target));
  const end = routed
    ? routeEndAnchor(target, waypoints[waypoints.length - 1])
    : closestSideToPoint(target, rectCentre(source));
  const path = [{ x: start.x, y: start.y }, ...waypoints, { x: end.x, y: end.y }];

  const cum = [0];
  for (let i = 0; i + 1 < path.length; i++) {
    cum.push(cum[i] + Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y));
  }
  const total = cum[cum.length - 1];
  if (total < 1) return undefined;
  const pointAt = (dist: number): Point => {
    let i = 0;
    while (i + 1 < cum.length - 1 && cum[i + 1] < dist) i++;
    const segLen = cum[i + 1] - cum[i] || 1;
    const t = Math.min(1, Math.max(0, (dist - cum[i]) / segLen));
    return { x: path[i].x + (path[i + 1].x - path[i].x) * t, y: path[i].y + (path[i + 1].y - path[i].y) * t };
  };
  const rectAt = (p: Point): Rect => ({
    x: p.x - size.width / 2,
    y: p.y - size.height / 2,
    width: size.width,
    height: size.height,
  });
  const clearsSet = (rect: Rect, set: Rect[]): boolean =>
    set.every((o) => !rectIntersectsRect(rect, o, LABEL_MARGIN));
  // A label sitting directly BELOW/ABOVE a group still reads as "against" it even
  // when it technically clears. Prefer a spot whose whole width also sits in a
  // horizontal gap between the groups (clear of every group's x-span), so the chip
  // lands in open space; fall back to any clearing spot if the route offers none.
  const inHorizontalGap = (p: Point): boolean => {
    const left = p.x - size.width / 2;
    const right = p.x + size.width / 2;
    return gapRefs.every((g) => right < g.x - LABEL_MARGIN || left > g.x + g.width + LABEL_MARGIN);
  };

  // Clearing the GROUP boxes is required (the reported "label touches the group");
  // clearing node rects too is preferred but not forced, so a short edge whose
  // label can't fully fit still gets it off the group rather than falling back to
  // the auto-centre spot inside it. Rank: clears-all > in-gap > nearest-midpoint.
  //
  // `avoidChips` is applied as a TWO-PASS filter (both passes run in this one
  // sweep) rather than as another score term, and the difference matters:
  //
  // - As a filter, the ranking WITHIN the chip-clearing candidates is exactly
  //   today's, so promoting label pinning to every edge cannot silently re-rank
  //   spots that have nothing to do with chips.
  // - As a filter with a fallback, a board that offers no chip-clearing spot at all
  //   still returns today's answer. Making chips a hard requirement would return
  //   `undefined` there, and FloatingEdge would auto-centre — trading an overlapping
  //   chip for a chip sitting on a group box, which is the worse of the two.
  const mid = total / 2;
  const SAMPLES = 64;
  let best: Point | undefined;
  let bestScore = -Infinity;
  let fallback: Point | undefined;
  let fallbackScore = -Infinity;
  for (let k = 0; k <= SAMPLES; k++) {
    const dist = (total * k) / SAMPLES;
    const p = pointAt(dist);
    const rect = rectAt(p);
    if (!clearsSet(rect, gapRefs)) continue; // must clear the group boxes
    const score =
      (clearsSet(rect, clearOf) ? 2e6 : 0) + (inHorizontalGap(p) ? 1e6 : 0) - Math.abs(dist - mid);
    if (score > fallbackScore) {
      fallback = p;
      fallbackScore = score;
    }
    if (!clearsSet(rect, avoidChips)) continue;
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best ?? fallback;
}
