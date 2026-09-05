import type { AttachSide, DesignDiagram, EdgeRoute, EdgeRouteSource, Point, Rect } from '../types';
import { routeEndAnchor, routeEndLeg } from '../edges/floatingEdgeMath';

/**
 * Pure waypoint/route operations. Routes are per (diagram, connection) and
 * hold an ordered waypoint list; a row with no content (see
 * {@link hasRouteContent}) means "no manual route" and — in a batch upsert —
 * "delete the stored route".
 */

export function routeFor(
  diagram: Pick<DesignDiagram, 'edgeRoutes'> | undefined,
  connectionId: string,
): EdgeRoute | undefined {
  return diagram?.edgeRoutes?.find((r) => r.connectionId === connectionId);
}

/** The two attach sides of a row — see `EdgeRoute.sourceSide`. */
export type RouteSides = Pick<EdgeRoute, 'sourceSide' | 'targetSide'>;

/** Whether either end of this row is told which side to attach to. */
export function hasFixedSide(route: Partial<RouteSides> | undefined): boolean {
  return route?.sourceSide !== undefined || route?.targetSide !== undefined;
}

/**
 * Whether a row carries something a PERSON placed: bend points, a label anchor,
 * or an explicit pin. This is what a hand edit claims a route with (`manual`).
 * Attach sides are deliberately NOT in it — they are constraints on where the
 * line meets its nodes, not geometry, so a row left with nothing but a side goes
 * back to the router (`auto`), which honours the side.
 */
export function hasPlacedContent(
  route: Pick<EdgeRoute, 'waypoints' | 'labelPosition' | 'pinned'>,
): boolean {
  return route.waypoints.length > 0 || route.labelPosition !== undefined || route.pinned === true;
}

/**
 * Whether a route row carries anything worth storing: bend points, a label
 * anchor, an explicit pin, or a fixed attach side. A row with none of them is
 * the DELETE MARKER of the batch contract, and every place that has to tell the
 * two apart — the merge, the undo diff, reconciliation, the tidy apply step, the
 * host's `applyBatch` — asks this one function rather than re-deriving the rule.
 * The label-only gap that survived for months was exactly two copies of it
 * drifting.
 */
export function hasRouteContent(
  route: Pick<EdgeRoute, 'waypoints' | 'labelPosition' | 'pinned'> & Partial<RouteSides>,
): boolean {
  return hasPlacedContent(route) || hasFixedSide(route);
}

/**
 * The sides of a row as a spreadable object holding only the ones that are SET,
 * so `{ ...routeSides(stored) }` never writes an `undefined` key into a row.
 */
export function routeSides(route: Partial<RouteSides> | undefined): RouteSides {
  const sides: RouteSides = {};
  if (route?.sourceSide !== undefined) sides.sourceSide = route.sourceSide;
  if (route?.targetSide !== undefined) sides.targetSide = route.targetSide;
  return sides;
}

/**
 * What "Attach at" changes. A key that is PRESENT with `undefined` sets that end
 * back to Automatic; an absent key leaves the end as it is — so one call can
 * change one end without knowing the other.
 */
export interface AttachSidesPatch {
  sourceSide?: AttachSide | undefined;
  targetSide?: AttachSide | undefined;
}

/**
 * The row a side change leaves behind: `patch` merged into `stored`, or into a
 * fresh bend-less `auto` row when nothing is stored — sides are constraints, so a
 * row that exists only for them stays routable and the next pass honours them.
 * Provenance, bends, label and pin ride along untouched. Clearing the last thing
 * the row had to say yields the delete marker.
 */
export function routeWithSides(
  stored: EdgeRoute | undefined,
  connectionId: string,
  patch: AttachSidesPatch,
): EdgeRoute {
  const next: EdgeRoute = { ...(stored ?? { connectionId, waypoints: [], source: 'auto' }) };
  if ('sourceSide' in patch) {
    if (patch.sourceSide === undefined) delete next.sourceSide;
    else next.sourceSide = patch.sourceSide;
  }
  if ('targetSide' in patch) {
    if (patch.targetSide === undefined) delete next.targetSide;
    else next.targetSide = patch.targetSide;
  }
  return hasRouteContent(next) ? next : { connectionId, waypoints: [], labelPosition: undefined };
}

/**
 * `routes` with `row` standing in for its connection's row: replaced in place,
 * appended when new, REMOVED when `row` is the delete marker. What the effective
 * diagram will hold once a commit of `row` lands — for a caller that must route
 * against the board after its own edit before React has re-rendered it.
 */
export function withRouteRow(routes: EdgeRoute[] | undefined, row: EdgeRoute): EdgeRoute[] {
  const current = routes ?? [];
  if (!hasRouteContent(row)) return current.filter((r) => r.connectionId !== row.connectionId);
  if (!current.some((r) => r.connectionId === row.connectionId)) return [...current, row];
  return current.map((r) => (r.connectionId === row.connectionId ? row : r));
}

/**
 * The side a React Flow handle id names — `right-s`, `top-t`, one source and one
 * target handle per side (see `NodeHandles`). `undefined` for anything else,
 * including the `null` React Flow reports for an edge that never chose a handle.
 */
export function sideFromHandleId(handleId: string | null | undefined): AttachSide | undefined {
  const side = handleId?.replace(/-[st]$/u, '');
  return side === 'top' || side === 'right' || side === 'bottom' || side === 'left' ? side : undefined;
}

/**
 * The sides an Alt-connect records: one per end whose handle names a side, so a
 * reconnect that moved only the target end (the source keeps its `null` handle)
 * fixes only the target. `undefined` when neither end names one.
 */
export function sidesFromHandles(handles: {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): RouteSides | undefined {
  const sides = routeSides({
    sourceSide: sideFromHandleId(handles.sourceHandle),
    targetSide: sideFromHandleId(handles.targetHandle),
  });
  return hasFixedSide(sides) ? sides : undefined;
}

/**
 * A route's provenance, with the absent case resolved.
 *
 * `EdgeRoute.source` is optional so a row written before the column existed — and
 * any caller that does not care — still type-checks, and **absent means
 * `'manual'`**. That default is the safe end of the guess: it keeps handles that
 * are already on screen rather than silently stripping them off geometry somebody
 * drew. Go through this helper instead of `r.source === 'manual'`, which reads
 * `undefined` as "not manual" and inverts the rule.
 */
export function routeSource(route: Pick<EdgeRoute, 'source'> | undefined): EdgeRouteSource {
  return route?.source === 'auto' ? 'auto' : 'manual';
}

/** Whether an automatic pass is allowed to replace this route (intent rule 10). */
export function isAutoRoute(route: Pick<EdgeRoute, 'source'> | undefined): boolean {
  return routeSource(route) === 'auto';
}

/**
 * Every route on this diagram a person placed — the set an unasked-for pass must
 * hand to `routeDiagramEdges` as `preserveRoutesFor` (intent rule 10).
 *
 * A helper rather than two inline filters, and the reason is the drag preview. The
 * preview and the drag-end pass must protect **the same** connections: a manual
 * route preserved on drop but visibly rerouted mid-drag would snap back on release,
 * which is the bug the preview exists to remove, wearing a different hat. Two
 * expressions of one rule drift; one expression cannot.
 */
export function manualRouteIds(diagram: Pick<DesignDiagram, 'edgeRoutes'>): Set<string> {
  // A pinned row is always written `manual`, so the second clause is belt and
  // braces: a pin must protect the line even if a row somehow lost its source.
  return new Set(
    (diagram.edgeRoutes ?? [])
      .filter((r) => !isAutoRoute(r) || r.pinned === true)
      .map((r) => r.connectionId),
  );
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  const t =
    lengthSq === 0
      ? 0
      : Math.min(Math.max(((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq, 0), 1);
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

/**
 * Index (into the waypoints array) at which a new point belongs: the segment
 * of the polyline [start, ...waypoints, end] nearest to the point. Ties pick
 * the earliest segment, keeping insertion deterministic.
 */
export function waypointInsertionIndex(
  start: Point,
  waypoints: Point[],
  end: Point,
  point: Point,
): number {
  const polyline = [start, ...waypoints, end];
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const distance = distanceToSegment(point, polyline[i], polyline[i + 1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/** Insert a waypoint on the nearest segment of the current route. */
export function insertWaypoint(
  waypoints: Point[],
  start: Point,
  end: Point,
  point: Point,
): Point[] {
  const index = waypointInsertionIndex(start, waypoints, end, point);
  const next = [...waypoints];
  next.splice(index, 0, point);
  return next;
}

export function moveWaypoint(waypoints: Point[], index: number, point: Point): Point[] {
  if (index < 0 || index >= waypoints.length) return waypoints;
  const next = [...waypoints];
  next[index] = point;
  return next;
}

export function removeWaypoint(waypoints: Point[], index: number): Point[] {
  if (index < 0 || index >= waypoints.length) return waypoints;
  return waypoints.filter((_, i) => i !== index);
}

/**
 * Corner radius for a route a PERSON drew. Small on purpose: a bend somebody
 * placed by hand should still read as a bend.
 */
export const MANUAL_ROUTE_RADIUS = 8;

/**
 * Corner radius for router output — feedback item 4's "smooth route".
 *
 * **Smooth here means a bigger radius, not a spline fit.** Measured on real routed
 * geometry: rounding never breaches `ROUTE_CLEARANCE` at any radius, while a
 * Catmull-Rom fit through the same points drifts 109.6 px and reaches 0.00 px
 * clearance — straight through obstacles. The reason rounding is safe is
 * structural rather than lucky: a quadratic Bézier stays inside the convex hull of
 * its two leg points and the corner, and both legs already sit at
 * `ROUTE_CLEARANCE`. Drift is exactly `radius / 4` at a right angle.
 *
 * **24 IS A PLACEHOLDER awaiting a look at a real board — 16 vs 24 vs 32.** Nothing
 * geometric picks it. Clearance permits any radius (above), and two parallel
 * channels cannot merge at any radius either, because both corners drift by the
 * same vector toward the inside of the same turn — so `IDEAL_NUDGING_DISTANCE` is
 * NOT the ceiling it looks like. The only bound that holds is {@link LABEL_MARGIN}:
 * a chip is pinned to a point sampled on the polyline, so a chip near a corner sits
 * `radius / 4` off the drawn line and must stay inside the 12 px budget, giving
 * `radius < 48`. 24 spends half of that.
 *
 * Note also that the leg clamp in {@link roundedPolylinePath} makes a large nominal
 * value mean less than it looks: a jog between two adjacent channels is a 32 px
 * leg, so it draws at 16 whatever this says. Raising it only changes long legs.
 *
 * See `docs/decisions/2026-08-07-routing-auto-route-radius-24.md`.
 */
export const AUTO_ROUTE_RADIUS = 24;

/** The corner radius a route draws at, from its provenance. */
export function routeRadius(route: Pick<EdgeRoute, 'source'> | undefined): number {
  return isAutoRoute(route) ? AUTO_ROUTE_RADIUS : MANUAL_ROUTE_RADIUS;
}

/**
 * SVG path: polyline through the points with small rounded corners at each
 * interior waypoint (radius shrinks on short segments).
 *
 * The clamp to `min(radius, inLen/2, outLen/2)` is what keeps a large radius safe
 * on a short leg — it can never round past the midpoint of either segment, so the
 * arc stays inside the polyline's own corridor.
 */
export function roundedPolylinePath(points: Point[], radius = MANUAL_ROUTE_RADIUS): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];
    const inLen = Math.hypot(corner.x - prev.x, corner.y - prev.y);
    const outLen = Math.hypot(next.x - corner.x, next.y - corner.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r < 0.5 || inLen === 0 || outLen === 0) {
      path += ` L ${corner.x},${corner.y}`;
      continue;
    }
    const inX = corner.x - ((corner.x - prev.x) / inLen) * r;
    const inY = corner.y - ((corner.y - prev.y) / inLen) * r;
    const outX = corner.x + ((next.x - corner.x) / outLen) * r;
    const outY = corner.y + ((next.y - corner.y) / outLen) * r;
    path += ` L ${inX},${inY} Q ${corner.x},${corner.y} ${outX},${outY}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last.x},${last.y}`;
  return path;
}

// --- segment editing (Phase 2b) -------------------------------------------------

/** Two coordinates this close are treated as the same axis line. */
const AXIS_EPSILON = 1;

export type LegAxis = 'horizontal' | 'vertical' | 'diagonal';

/**
 * The axis a leg runs along. A leg shorter than the tolerance in BOTH directions
 * has no axis and reads as `diagonal`, so nothing tries to extend along it.
 */
export function legAxis(a: Point, b: Point, tolerance = AXIS_EPSILON): LegAxis {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (dy <= tolerance && dx > tolerance) return 'horizontal';
  if (dx <= tolerance && dy > tolerance) return 'vertical';
  return 'diagonal';
}

/**
 * Shift leg `segmentIndex` of the FULL polyline `[start, ...waypoints, end]`
 * perpendicular to itself: a horizontal leg moves in y, a vertical one in x, a
 * diagonal one takes the whole delta. Both points bounding the leg move, so the
 * legs either side keep their axis and merely grow or shrink — the property that
 * keeps an orthogonal route orthogonal under a segment drag.
 *
 * Neighbouring legs that CONTINUE the dragged one on the same axis move with it.
 * Two collinear legs are one leg the user happens to see two handles on; moving
 * only the inner pair would turn the outer legs diagonal, which is precisely the
 * shape this operation exists to avoid.
 *
 * Returns the input unchanged (same reference) when the perpendicular component
 * of `delta` is zero, so a caller can tell "nothing to commit" apart from a move.
 * The end points are the DRAWN anchors and may move too; the caller strips them
 * back off with {@link interiorOf} (or {@link attachEnds}) — an anchor is derived
 * at render time, never stored.
 */
export function moveSegment(polyline: Point[], segmentIndex: number, delta: Point): Point[] {
  if (segmentIndex < 0 || segmentIndex >= polyline.length - 1) return polyline;
  const axis = legAxis(polyline[segmentIndex], polyline[segmentIndex + 1]);
  const shift: Point =
    axis === 'horizontal'
      ? { x: 0, y: delta.y }
      : axis === 'vertical'
        ? { x: delta.x, y: 0 }
        : delta;
  if (shift.x === 0 && shift.y === 0) return polyline;
  let first = segmentIndex;
  let last = segmentIndex + 1;
  if (axis !== 'diagonal') {
    while (first > 0 && legAxis(polyline[first - 1], polyline[first]) === axis) first -= 1;
    while (last < polyline.length - 1 && legAxis(polyline[last], polyline[last + 1]) === axis) {
      last += 1;
    }
  }
  return polyline.map((p, i) =>
    i >= first && i <= last ? { x: p.x + shift.x, y: p.y + shift.y } : p,
  );
}

/**
 * Nudge every point that is within `tolerance` of its predecessor on one axis
 * onto that axis exactly, so a leg that is 0.4 px off horizontal draws — and
 * later reads (`legAxis`) — as horizontal. Walks from the start, so the later
 * point of each pair is the one that moves.
 */
export function snapOrthogonal(points: Point[], tolerance = AXIS_EPSILON): Point[] {
  if (points.length < 2) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[i - 1];
    const p = points[i];
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    out.push({
      x: dx !== 0 && Math.abs(dx) <= tolerance ? prev.x : p.x,
      y: dy !== 0 && Math.abs(dy) <= tolerance ? prev.y : p.y,
    });
  }
  return out;
}

/** The stored waypoints of a full polyline: everything but the two drawn anchors. */
export function interiorOf(polyline: Point[]): Point[] {
  return polyline.length <= 2 ? [] : polyline.slice(1, -1);
}

/**
 * How far off the node the two bends of a "shift" jog sit, so their handles are
 * not glued to the node border. Clamped to a quarter of the line on short lines.
 */
export const JOG_STUB = 24;

/**
 * The two bends a segment drag makes out of a line that has none.
 *
 * `axis` is the axis of the line's EXIT leg — horizontal when it leaves the node
 * through its left or right side — because that, not the slope between the two
 * anchors, is what the drawn shape follows: a smooth-step between horizontally
 * separated nodes has a vertical middle leg whichever way its anchors lean.
 *
 * - Aligned ends (a straight line): the whole line shifts perpendicular; the two
 *   bends sit a stub in from each anchor. If the shift leaves the nodes' span,
 *   {@link attachEnds} adds the connector bends that bring the line back in.
 * - Offset ends (a step): the step's middle leg moves along the drag; the two
 *   bends are its corners — a Z, exactly where the smooth-step already turned.
 *
 * Empty when the drag has no component the leg can follow (a purely horizontal
 * drag of a horizontal line changes nothing), so the caller commits nothing.
 */
export function jogFromStraight(
  start: Point,
  end: Point,
  delta: Point,
  axis: 'horizontal' | 'vertical',
): Point[] {
  if (axis === 'horizontal') {
    if (Math.abs(start.y - end.y) <= AXIS_EPSILON) {
      if (delta.y === 0) return [];
      const dir = Math.sign(end.x - start.x) || 1;
      const stub = Math.min(JOG_STUB, Math.abs(end.x - start.x) / 4);
      return [
        { x: start.x + dir * stub, y: start.y + delta.y },
        { x: end.x - dir * stub, y: end.y + delta.y },
      ];
    }
    if (delta.x === 0) return [];
    const midX = (start.x + end.x) / 2 + delta.x;
    return [
      { x: midX, y: start.y },
      { x: midX, y: end.y },
    ];
  }
  if (Math.abs(start.x - end.x) <= AXIS_EPSILON) {
    if (delta.x === 0) return [];
    const dir = Math.sign(end.y - start.y) || 1;
    const stub = Math.min(JOG_STUB, Math.abs(end.y - start.y) / 4);
    return [
      { x: start.x + delta.x, y: start.y + dir * stub },
      { x: end.x + delta.x, y: end.y - dir * stub },
    ];
  }
  if (delta.y === 0) return [];
  const midY = (start.y + end.y) / 2 + delta.y;
  return [
    { x: start.x, y: midY },
    { x: end.x, y: midY },
  ];
}

function rectContains(rect: Rect, p: Point): boolean {
  return p.x > rect.x && p.x < rect.x + rect.width && p.y > rect.y && p.y < rect.y + rect.height;
}

/**
 * Whether the end leg from `rect` into `bend` draws orthogonal and attached under
 * {@link routeEndAnchor}'s rules — the same test the renderer will apply.
 */
function endLegAttaches(rect: Rect, bend: Point): boolean {
  if (rectContains(rect, bend)) return false;
  const anchor = routeEndAnchor(rect, bend);
  return Math.abs(anchor.x - bend.x) <= AXIS_EPSILON || Math.abs(anchor.y - bend.y) <= AXIS_EPSILON;
}

/**
 * The bend that has to go between `rect` and `first` so that both the leg out of
 * the node and the leg into `first` are orthogonal; `undefined` when `first`
 * already attaches, or when nothing orthogonal can be made (a diagonal leg, or a
 * bend inside the node).
 *
 * `first → second` is horizontal ⇒ the connector drops vertically onto it from
 * the node's centre row, so the line leaves through a left/right side; vertical
 * ⇒ the mirror image. This is `routeEndAnchor`'s residual case (a bend level
 * with the rect on neither axis) resolved by adding the bend the docblock there
 * says the renderer must not invent — a segment drag is a hand edit, so here the
 * bend is the user's and may be stored.
 */
function connectorBend(rect: Rect, first: Point, second: Point): Point | undefined {
  if (endLegAttaches(rect, first) || rectContains(rect, first)) return undefined;
  const axis = legAxis(first, second);
  if (axis === 'horizontal') return { x: first.x, y: rect.y + rect.height / 2 };
  if (axis === 'vertical') return { x: rect.x + rect.width / 2, y: first.y };
  return undefined;
}

/**
 * Re-attach a route's two end legs after a segment drag moved them: where the
 * bend adjacent to a node has left the span its leg could reach, insert the
 * connector bend ({@link connectorBend}) that keeps the line orthogonal AND on
 * the node. Everything else is returned as it came.
 */
export function attachEnds(interior: Point[], sourceRect: Rect, targetRect: Rect): Point[] {
  if (interior.length === 0) return interior;
  let next = interior;
  const startFix = connectorBend(
    sourceRect,
    next[0],
    next[1] ?? routeEndAnchor(targetRect, next[0]),
  );
  if (startFix) next = [startFix, ...next];
  const last = next[next.length - 1];
  const endFix = connectorBend(
    targetRect,
    last,
    next[next.length - 2] ?? routeEndAnchor(sourceRect, last),
  );
  if (endFix) next = [...next, endFix];
  return next;
}

/**
 * One segment drag on a routed line, start to finish: shift the leg, square the
 * result, drop the drawn anchors, re-attach the ends. Returns the waypoints to
 * store, or `undefined` when the drag moved nothing along the leg's free axis.
 */
export function dragSegment(
  polyline: Point[],
  segmentIndex: number,
  delta: Point,
  sourceRect: Rect,
  targetRect: Rect,
): Point[] | undefined {
  const moved = moveSegment(polyline, segmentIndex, delta);
  if (moved === polyline) return undefined;
  return attachEnds(interiorOf(snapOrthogonal(moved)), sourceRect, targetRect);
}

/** {@link dragSegment} for a line with no bends — see {@link jogFromStraight}. */
export function dragStraight(
  start: Point,
  end: Point,
  axis: 'horizontal' | 'vertical',
  delta: Point,
  sourceRect: Rect,
  targetRect: Rect,
): Point[] | undefined {
  const bends = jogFromStraight(start, end, delta, axis);
  if (bends.length === 0) return undefined;
  return attachEnds(snapOrthogonal(bends), sourceRect, targetRect);
}

/**
 * The polyline the board actually DRAWS for a routed line: each end where
 * {@link routeEndAnchor} puts it, not the node centre. The centre-to-centre
 * version put the first leg through the middle of the node, so a double-click
 * next to the real first leg could land its new bend on a different segment.
 *
 * An end with a fixed side (`sides`) contributes its stub bends too (see
 * `routeEndLeg`), and a waypoint that sits ON its anchor — the attachment point a
 * pinned router end keeps — draws no zero-length leg ({@link dedupePolyline}).
 */
export function drawnPolyline(
  waypoints: Point[],
  sourceRect: Rect,
  targetRect: Rect,
  sides?: RouteSides,
): Point[] {
  if (waypoints.length === 0) return [];
  const start = routeEndLeg(sourceRect, waypoints[0], sides?.sourceSide);
  const end = routeEndLeg(targetRect, waypoints[waypoints.length - 1], sides?.targetSide);
  return dedupePolyline([
    { x: start.anchor.x, y: start.anchor.y },
    ...start.stubs,
    ...waypoints,
    ...[...end.stubs].reverse(),
    { x: end.anchor.x, y: end.anchor.y },
  ]);
}

/** The polyline without its zero-length legs: consecutive points within the axis tolerance collapse to the first. */
export function dedupePolyline(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x - p.x) <= AXIS_EPSILON && Math.abs(prev.y - p.y) <= AXIS_EPSILON) continue;
    out.push(p);
  }
  return out;
}

/**
 * {@link waypointInsertionIndex} against the DRAWN anchors. A line with no
 * bends has one segment whatever its anchors are, so it needs none. Stub bends
 * of a fixed side are left out on purpose: the index has to be an index into the
 * STORED waypoints, and a click beside a stub still lands on the end leg.
 */
export function insertionIndexOnDrawnPolyline(
  waypoints: Point[],
  sourceRect: Rect,
  targetRect: Rect,
  point: Point,
  sides?: RouteSides,
): number {
  if (waypoints.length === 0) return 0;
  const start = routeEndAnchor(sourceRect, waypoints[0], sides?.sourceSide);
  const end = routeEndAnchor(targetRect, waypoints[waypoints.length - 1], sides?.targetSide);
  return waypointInsertionIndex(start, waypoints, end, point);
}

/** {@link insertWaypoint} on the drawn polyline. */
export function insertWaypointOnDrawn(
  waypoints: Point[],
  sourceRect: Rect,
  targetRect: Rect,
  point: Point,
  sides?: RouteSides,
): Point[] {
  const index = insertionIndexOnDrawnPolyline(waypoints, sourceRect, targetRect, point, sides);
  const next = [...waypoints];
  next.splice(index, 0, point);
  return next;
}

// --- following a moved node (Phase 2e) -----------------------------------------

/** A chip within this distance of the end leg sits ON it and travels with it. */
const LABEL_FOLLOW_DISTANCE = 24;

/**
 * Keep a hand-drawn route attached to a node that moved from `before` to `after`.
 *
 * Only the end leg is touched, and only along the axis it cannot absorb: a
 * horizontal end leg slides freely in x (the anchor moves along the node's side,
 * the leg grows or shrinks) but its y is the node's, so the adjacent bend takes
 * the node's dy; a vertical end leg takes dx. Bends that continue the end leg on
 * the same axis move with it, for the reason {@link moveSegment} gives. A
 * diagonal end leg — the renderer's residual case — is left exactly as it was.
 *
 * The label follows when it sits on the leg that moved, so a chip placed on a
 * node's stub does not stay behind in empty space. Returns the input unchanged
 * (same reference) when nothing needed to move.
 *
 * A bend sitting ON the node — the attachment point a router-pinned end keeps as
 * its first waypoint — has no leg to read an axis from. It is glued: it takes the
 * node's whole delta, and the leg it STARTS (into the next bend) is the end leg
 * whose collinear run moves perpendicular, exactly as above.
 */
export function followNodeMove(
  route: EdgeRoute,
  before: Rect,
  after: Rect,
  isSource: boolean,
): EdgeRoute {
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const { waypoints } = route;
  if ((dx === 0 && dy === 0) || waypoints.length === 0) return route;
  const endIndex = isSource ? 0 : waypoints.length - 1;
  const step = isSource ? 1 : -1;
  const bend = waypoints[endIndex];
  const anchor = routeEndAnchor(before, bend);
  const glued = Math.abs(anchor.x - bend.x) <= AXIS_EPSILON && Math.abs(anchor.y - bend.y) <= AXIS_EPSILON;
  const next: Point | undefined = waypoints[endIndex + step];
  const legStart = glued ? bend : anchor;
  const legEnd = glued ? next : bend;
  const axis: LegAxis = legEnd ? legAxis(legStart, legEnd) : 'diagonal';
  const shift: Point | undefined =
    axis === 'horizontal'
      ? { x: 0, y: dy }
      : axis === 'vertical'
        ? { x: dx, y: 0 }
        : glued
          ? { x: dx, y: dy }
          : undefined;
  if (!shift || (shift.x === 0 && shift.y === 0)) return route;

  // The run of bends collinear with the end leg, from the node inward.
  let inner = endIndex;
  while (
    axis !== 'diagonal' &&
    inner + step >= 0 &&
    inner + step < waypoints.length &&
    legAxis(waypoints[inner], waypoints[inner + step]) === axis
  ) {
    inner += step;
  }
  const lo = Math.min(endIndex, inner);
  const hi = Math.max(endIndex, inner);
  const moved = waypoints.map((p, i) => {
    if (i < lo || i > hi) return p;
    if (glued && i === endIndex) return { x: p.x + dx, y: p.y + dy };
    return { x: p.x + shift.x, y: p.y + shift.y };
  });
  let labelPosition = route.labelPosition;
  if (
    labelPosition &&
    distanceToSegment(labelPosition, legStart, legEnd ?? legStart) <= LABEL_FOLLOW_DISTANCE
  ) {
    labelPosition = { x: labelPosition.x + shift.x, y: labelPosition.y + shift.y };
  }
  return { ...route, waypoints: moved, labelPosition };
}
