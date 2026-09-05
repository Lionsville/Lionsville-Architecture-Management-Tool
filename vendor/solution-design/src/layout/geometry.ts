import type { Point, Rect } from '../types';

/**
 * Geometry kernel for edge routing — the "check". Pure, deterministic functions
 * that answer one question: does a segment (or a whole polyline) pass through a box
 * it should have steered around?
 *
 * It used to grade the output of this package's own `detour` heuristic. libavoid
 * routes the edges now, and this module became the INDEPENDENT check on the
 * router's output — {@link pathHitsObstacles} is how the test suites assert that a
 * libavoid route really clears what it claims to, without trusting the router's
 * word for it.
 *
 * Everything here is side-effect free and free of `Math.random`/time, because the
 * routes it grades are persisted in the one-undo Tidy commit and asserted in tests
 * — identical input must always yield identical output.
 */

/** Numerical slack: lengths/overlaps below this are treated as zero. */
const EPS = 1e-6;

/** Grow a rect by `margin` on every side (negative shrinks). */
export function inflate(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + 2 * margin,
    height: rect.height + 2 * margin,
  };
}

/** True when the two rects overlap after inflating `r1` by `margin` on each side. */
export function rectIntersectsRect(r1: Rect, r2: Rect, margin = 0): boolean {
  const a = inflate(r1, margin);
  return (
    a.x < r2.x + r2.width &&
    a.x + a.width > r2.x &&
    a.y < r2.y + r2.height &&
    a.y + a.height > r2.y
  );
}

/**
 * Liang–Barsky clip of segment a→b against `rect`. Returns the parametric
 * interval [t0, t1] (t along a→b, 0..1) that lies inside the rect, or null when
 * the segment misses it entirely. Handles axis-parallel segments (a zero
 * direction component that starts outside a slab → miss).
 */
function segmentRectClip(a: Point, b: Point, rect: Rect): [number, number] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - rect.x, rect.x + rect.width - a.x, a.y - rect.y, rect.y + rect.height - a.y];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null; // parallel to this edge and outside the slab
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [t0, t1];
}

/**
 * True when segment a→b penetrates the INTERIOR of `rect` (inflated by
 * `margin`). "Interior" (not the closed rect) is deliberate: a line running
 * flush along an obstacle's boundary traces the outline rather than cutting
 * through, so it is not a crossing. It also makes `margin` behave as a
 * clearance — a line flush with the ORIGINAL edge lands strictly inside the
 * inflated rect, so it correctly reads as "too close".
 */
export function segmentIntersectsRect(a: Point, b: Point, rect: Rect, margin = 0): boolean {
  const box = inflate(rect, margin);
  const clip = segmentRectClip(a, b, box);
  if (!clip) return false;
  const [t0, t1] = clip;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if ((t1 - t0) * len <= EPS) return false;
  // The clipped portion must contain a strictly-interior point; test its
  // midpoint (a segment lying on an edge has its midpoint on the boundary).
  const tm = (t0 + t1) / 2;
  const mx = a.x + (b.x - a.x) * tm;
  const my = a.y + (b.y - a.y) * tm;
  return (
    mx > box.x + EPS &&
    mx < box.x + box.width - EPS &&
    my > box.y + EPS &&
    my < box.y + box.height - EPS
  );
}

/**
 * Count how many (segment, obstacle) pairs of a polyline pass through an
 * obstacle. `points` is the full ordered path INCLUDING its endpoints, so the
 * caller passes source-anchor → …waypoints… → target-anchor. 0 means clean.
 */
export function pathHitsObstacles(points: Point[], obstacles: Rect[], margin = 0): number {
  let hits = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    for (const obstacle of obstacles) {
      if (segmentIntersectsRect(points[i], points[i + 1], obstacle, margin)) hits++;
    }
  }
  return hits;
}
