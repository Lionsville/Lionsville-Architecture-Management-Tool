import type { Point, Rect } from '../model/types';
import { closestSides, routeEndAnchor } from '../model/floatingEdgeMath';

/**
 * Test-only helpers shared by the routing suites (`routing.test.ts`,
 * `routeOnly.test.ts`, `tidy.test.ts`, `libavoidRouter.test.ts`): build the path the
 * app really draws, and measure how close it comes to what it should have avoided.
 */

/**
 * The full drawn path for a set of interior waypoints — endpoints resolved with
 * the SAME anchor math FloatingEdge renders with, so this is exactly what the app
 * draws. Lets the geometric assertions grade the rendered geometry.
 */
export function routedPath(source: Rect, target: Rect, inner: Point[]): Point[] {
  if (inner.length === 0) {
    const s = closestSides(source, target);
    return [
      { x: s.sourceX, y: s.sourceY },
      { x: s.targetX, y: s.targetY },
    ];
  }
  const start = routeEndAnchor(source, inner[0]);
  const end = routeEndAnchor(target, inner[inner.length - 1]);
  return [{ x: start.x, y: start.y }, ...inner, { x: end.x, y: end.y }];
}

/**
 * Every segment of a drawn path that is neither horizontal nor vertical, formatted
 * for the failure message. Assert `toEqual([])` on a ROUTED edge's path.
 *
 * This is the grader the whole 527-test suite was missing: every existing geometric
 * check measures CLEARANCE from obstacles, which a diagonal passes as happily as a
 * square route. One diagonal segment on an otherwise orthogonal board is what the
 * engineer actually sees.
 *
 * The tolerance is 0.01 px because waypoints are stored rounded to two decimals
 * (`libavoidRouter`'s `rounded`), so a leg can be off true by half a rounding step
 * and still be right. It is NOT a licence for near-misses: the defect this catches
 * was 42 px.
 *
 * Only meaningful for a path built from waypoints. A waypoint-LESS edge renders via
 * `getSmoothStepPath` (orthogonal by construction, bends of its own); `routedPath`
 * models it as its two anchors joined directly, which is deliberately diagonal.
 */
export function diagonalSegments(points: Point[]): string[] {
  const diagonals: string[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]];
    if (Math.abs(a.x - b.x) > 0.01 && Math.abs(a.y - b.y) > 0.01) {
      diagonals.push(`(${a.x},${a.y})→(${b.x},${b.y})`);
    }
  }
  return diagonals;
}

/**
 * The SMALLEST distance between a drawn path and any of `obstacles` — 0 when it
 * touches or crosses one. Assert `>= ROUTE_CLEARANCE - tolerance` with it.
 *
 * Why this exists next to `pathHitsObstacles`: that function answers "does the path
 * penetrate the inflated rect", and its epsilon means a line running at
 * `617.99999988` against an edge at `618` reads as clear. It is touching. Counting
 * hits therefore cannot tell a comfortable route from a graze, and a graze is exactly
 * the failure the old single-channel heuristic produced on the real board. A distance
 * is direction-agnostic and has no epsilon to hide behind, so it grades the thing we
 * actually care about.
 *
 * Exact, not sampled: for two disjoint convex shapes the minimum distance is attained
 * at a vertex of one against the other, so it suffices to check each segment endpoint
 * against the rect and each rect corner against the segment.
 */
export function pathClearance(points: Point[], obstacles: Rect[]): number {
  let min = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    for (const obstacle of obstacles) {
      min = Math.min(min, segmentRectDistance(points[i], points[i + 1], obstacle));
    }
  }
  return min;
}

function segmentRectDistance(a: Point, b: Point, rect: Rect): number {
  // Touching at all — crossing, lying along an edge, or fully inside — is zero
  // clearance. This must be settled FIRST, because the vertex formula below is only
  // valid for disjoint shapes: a segment through the middle of a box is far from
  // every corner and would otherwise report a large, badly wrong clearance.
  if (segmentTouchesRect(a, b, rect)) return 0;
  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  let min = Math.min(pointRectDistance(a, rect), pointRectDistance(b, rect));
  for (const corner of corners) min = Math.min(min, pointSegmentDistance(corner, a, b));
  return min;
}

/**
 * Whether the segment shares ANY point with the CLOSED rect — a slab clip with no
 * epsilon at all, which is the whole point of it living here instead of reusing
 * `geometry.ts`'s `segmentIntersectsRect`. That function deliberately ignores contact
 * below 1e-6 so a line tracing a boundary does not count as a crossing; borrowing it
 * would make this clearance metric inherit the very blind spot it exists to close.
 */
function segmentTouchesRect(a: Point, b: Point, rect: Rect): boolean {
  let t0 = 0;
  let t1 = 1;
  const clip = (direction: number, distance: number): boolean => {
    if (direction === 0) return distance >= 0; // parallel: inside the slab or never
    const t = distance / direction;
    if (direction < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return (
    clip(-dx, a.x - rect.x) &&
    clip(dx, rect.x + rect.width - a.x) &&
    clip(-dy, a.y - rect.y) &&
    clip(dy, rect.y + rect.height - a.y) &&
    t0 <= t1
  );
}

function pointRectDistance(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height));
  return Math.hypot(dx, dy);
}

function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
