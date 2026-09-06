import { Position } from '@xyflow/react';
import type { AttachSide, Point, Rect } from '../../model/types';

/**
 * Closest-side selection for floating edges (ported from the POC).
 *
 * An edge ignores stored handles and attaches to the pair of side anchors
 * (one per node) with the shortest distance between them. Handles stay fixed
 * per side, so without this an edge pinned to e.g. a right-side handle exits
 * rightwards and has to loop back whenever the other node sits to the left.
 * Recomputing the nearest sides on every render keeps the path shortest while
 * nodes are dragged around.
 */

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left] as const;

const NORMALS: Record<Position, { x: number; y: number }> = {
  [Position.Top]: { x: 0, y: -1 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Bottom]: { x: 0, y: 1 },
  [Position.Left]: { x: -1, y: 0 },
};

/** Penalty for a side whose outward normal points away from the other anchor. */
const FACING_AWAY_PENALTY = 1e6;

const SIDE_POSITION: Record<AttachSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

/** The React Flow side an {@link AttachSide} names (the two share their string values, but not their types). */
export function positionOfSide(side: AttachSide): Position {
  return SIDE_POSITION[side];
}

/** The sides a line's two ends are told to attach to; absent = free (see `EdgeRoute.sourceSide`). */
export interface FixedSides {
  sourceSide?: AttachSide;
  targetSide?: AttachSide;
}

export interface SideAnchor {
  x: number;
  y: number;
}

export interface ClosestSidesResult {
  sourcePosition: Position;
  targetPosition: Position;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

/** Where the four handle anchors sit on a node rect, in flow coordinates. */
export function sideAnchors(rect: Rect): Record<Position, SideAnchor> {
  const { x, y, width: w, height: h } = rect;
  return {
    [Position.Top]: { x: x + w / 2, y },
    [Position.Right]: { x: x + w, y: y + h / 2 },
    [Position.Bottom]: { x: x + w / 2, y: y + h },
    [Position.Left]: { x, y: y + h / 2 },
  };
}

/**
 * Pick the side pair with the smallest anchor distance. A side whose outward
 * direction points away from the other anchor gets a heavy penalty: the
 * smooth-step path must leave/enter perpendicular to the side, so a
 * facing-away side forces a detour even when its anchor is nearby. Penalties
 * are additive, so fully enclosed nodes (every side "faces away") still fall
 * back to the plain shortest pair.
 *
 * An end with a FIXED side (`fixed`) is not scored at all — its one side is the
 * only candidate — and the free end is then chosen against that side, so telling a
 * line to leave from the top makes the other end meet it where the top leads.
 */
export function closestSides(
  sourceRect: Rect,
  targetRect: Rect,
  fixed?: FixedSides,
): ClosestSidesResult {
  const a = sideAnchors(sourceRect);
  const b = sideAnchors(targetRect);
  const sourceSides = fixed?.sourceSide ? [positionOfSide(fixed.sourceSide)] : SIDES;
  const targetSides = fixed?.targetSide ? [positionOfSide(fixed.targetSide)] : SIDES;
  let best: (ClosestSidesResult & { score: number }) | undefined;
  for (const sa of sourceSides) {
    for (const sb of targetSides) {
      const dx = b[sb].x - a[sa].x;
      const dy = b[sb].y - a[sa].y;
      let score = Math.hypot(dx, dy);
      if (NORMALS[sa].x * dx + NORMALS[sa].y * dy < 0) score += FACING_AWAY_PENALTY;
      if (NORMALS[sb].x * -dx + NORMALS[sb].y * -dy < 0) score += FACING_AWAY_PENALTY;
      if (!best || score < best.score) {
        best = {
          score,
          sourcePosition: sa,
          targetPosition: sb,
          sourceX: a[sa].x,
          sourceY: a[sa].y,
          targetX: b[sb].x,
          targetY: b[sb].y,
        };
      }
    }
  }
  // SIDES is non-empty, so best is always assigned.
  return best as ClosestSidesResult;
}

/** Slotted attach point for one edge: source + target anchor with their sides. */
export interface EdgeAnchors {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
}

/** Desired margin (flow px) kept clear at each end of a side before slotting. */
const SIDE_MARGIN = 16;

function isHorizontalSide(side: Position): boolean {
  return side === Position.Top || side === Position.Bottom;
}

/**
 * Attach point for edge `i` of `n` sharing one node side. Edges are spread at
 * evenly-spaced fractions `(i + 1) / (n + 1)` of the side's usable span (the
 * side length minus a margin at each end), so a lone edge (n = 1) lands exactly
 * on the side midpoint — parity with the un-slotted anchor. The cross-axis
 * coordinate is pinned to the side (Top = y, Bottom = y + h, Left = x,
 * Right = x + w).
 */
function slotAnchor(rect: Rect, side: Position, i: number, n: number): SideAnchor {
  const { x, y, width: w, height: h } = rect;
  const horizontal = isHorizontalSide(side);
  const sideLength = horizontal ? w : h;
  const margin = Math.min(SIDE_MARGIN, sideLength * 0.15);
  const usable = sideLength - 2 * margin;
  const along = margin + (usable * (i + 1)) / (n + 1);
  if (horizontal) {
    return { x: x + along, y: side === Position.Top ? y : y + h };
  }
  return { x: side === Position.Left ? x : x + w, y: y + along };
}

/**
 * Distribute every edge's attach points so no two edges leaving/entering the
 * same node side stack on one coordinate. For each edge both endpoints keep the
 * sides chosen by {@link closestSides} — or the side the edge FIXES for that end
 * (`sourceSide`/`targetSide`), so two lines told to leave from the same side still
 * fan out along it; within each `(node, side)` group the endpoints are ordered by
 * the coordinate of their OTHER endpoint along the side's axis (X for Top/Bottom,
 * Y for Left/Right — keeps the fan from crossing itself, tie-broken by edge id)
 * and slotted evenly along the side. Pure and deterministic. Edges whose
 * endpoints are not both in `rectById` are skipped.
 */
export function assignEdgeAnchors(
  edges: ({ id: string; sourceId: string; targetId: string } & FixedSides)[],
  rectById: Map<string, Rect>,
): Map<string, EdgeAnchors> {
  interface Endpoint {
    edgeId: string;
    end: 'source' | 'target';
    otherCoord: number;
  }
  interface Group {
    rect: Rect;
    side: Position;
    endpoints: Endpoint[];
  }

  const sidesByEdge = new Map<string, ClosestSidesResult>();
  const groups = new Map<string, Group>();
  const groupKey = (nodeId: string, side: Position) => `${nodeId} ${side}`;

  const addEndpoint = (nodeId: string, rect: Rect, side: Position, endpoint: Endpoint) => {
    const key = groupKey(nodeId, side);
    let group = groups.get(key);
    if (!group) {
      group = { rect, side, endpoints: [] };
      groups.set(key, group);
    }
    group.endpoints.push(endpoint);
  };

  for (const edge of edges) {
    const sourceRect = rectById.get(edge.sourceId);
    const targetRect = rectById.get(edge.targetId);
    if (!sourceRect || !targetRect) continue;
    const sides = closestSides(sourceRect, targetRect, edge);
    sidesByEdge.set(edge.id, sides);
    // Source end: ordered along its side by where the target midpoint sits.
    addEndpoint(edge.sourceId, sourceRect, sides.sourcePosition, {
      edgeId: edge.id,
      end: 'source',
      otherCoord: isHorizontalSide(sides.sourcePosition) ? sides.targetX : sides.targetY,
    });
    // Target end: ordered along its side by where the source midpoint sits.
    addEndpoint(edge.targetId, targetRect, sides.targetPosition, {
      edgeId: edge.id,
      end: 'target',
      otherCoord: isHorizontalSide(sides.targetPosition) ? sides.sourceX : sides.sourceY,
    });
  }

  const sourceSlot = new Map<string, SideAnchor>();
  const targetSlot = new Map<string, SideAnchor>();
  for (const group of groups.values()) {
    const ordered = [...group.endpoints].sort(
      (a, b) =>
        a.otherCoord - b.otherCoord ||
        (a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0),
    );
    const n = ordered.length;
    ordered.forEach((endpoint, i) => {
      const anchor = slotAnchor(group.rect, group.side, i, n);
      (endpoint.end === 'source' ? sourceSlot : targetSlot).set(endpoint.edgeId, anchor);
    });
  }

  const result = new Map<string, EdgeAnchors>();
  for (const edge of edges) {
    const sides = sidesByEdge.get(edge.id);
    const source = sourceSlot.get(edge.id);
    const target = targetSlot.get(edge.id);
    if (!sides || !source || !target) continue;
    result.set(edge.id, {
      sourceX: source.x,
      sourceY: source.y,
      sourcePosition: sides.sourcePosition,
      targetX: target.x,
      targetY: target.y,
      targetPosition: sides.targetPosition,
    });
  }
  return result;
}

export interface ClosestSideResult {
  position: Position;
  x: number;
  y: number;
}

/**
 * Side of a node rect to attach to when routing toward a free point (the
 * first/last waypoint of a manual route). Same facing-away penalty as
 * closestSides so the line leaves the node outward.
 */
export function closestSideToPoint(rect: Rect, point: { x: number; y: number }): ClosestSideResult {
  return nearestSideAmong(rect, point, SIDES);
}

/** {@link closestSideToPoint} restricted to `sides` — the shared scoring, so a
 *  narrowed candidate set cannot drift from the full one. */
function nearestSideAmong(
  rect: Rect,
  point: { x: number; y: number },
  sides: readonly Position[],
): ClosestSideResult {
  const anchors = sideAnchors(rect);
  let best: (ClosestSideResult & { score: number }) | undefined;
  for (const side of sides) {
    const dx = point.x - anchors[side].x;
    const dy = point.y - anchors[side].y;
    let score = Math.hypot(dx, dy);
    if (NORMALS[side].x * dx + NORMALS[side].y * dy < 0) score += FACING_AWAY_PENALTY;
    if (!best || score < best.score) {
      best = { score, position: side, x: anchors[side].x, y: anchors[side].y };
    }
  }
  return best as ClosestSideResult;
}

/**
 * Attach point for ONE end of a routed edge: the side {@link closestSideToPoint}
 * picks, but the anchor slid ALONG that side to face `waypoint` instead of pinned
 * to the side's midpoint. Use it for every end that has an adjacent waypoint;
 * waypoint-less edges keep {@link closestSides}/{@link assignEdgeAnchors}.
 *
 * The midpoint is what made routed edges draw a DIAGONAL tail. The router works
 * centre-to-centre and gives us the polyline's interior points only, so the last
 * leg — the one from the final waypoint into the node — is ours to draw, and the
 * only orthogonal way to draw it is to meet the node where that leg actually
 * arrives. Measured on solution design 1: libavoid's own route into Dynamics 365
 * runs horizontally at y = 686.05, while the left side's midpoint sits at
 * y = 643.85, so the rendered tail fell 42 px — plainly diagonal on a board where
 * nothing else is. The midpoint only ever agreed by luck, when the leg happened to
 * arrive on the centre line; nudging (`IDEAL_NUDGING_DISTANCE`) moves parallel
 * channels off it by design, so on any board with two edges sharing a channel the
 * luck runs out.
 *
 * There is no inset margin, deliberately: the correct anchor for that very edge
 * sits 5.8 px from the bottom-left corner, so a margin that kept anchors off the
 * corners would reintroduce the diagonal this exists to remove.
 *
 * Side selection is narrowed to the sides the leg can actually MEET, rather than
 * scoring all four and clamping whatever wins: a horizontal leg can only meet
 * Left/Right, and only when the waypoint is level with the rect. Clamping a
 * projection that fell outside its side would restore the diagonal — the very bug —
 * so it must not be reachable by a side we CHOSE. Narrowing removes exactly the
 * sides that would have clamped, and never the winner in the aligned case:
 * `FACING_AWAY_PENALTY` already rules out the three sides a straight leg cannot
 * reach, so on every routed end measured on the real board this picks what the
 * unrestricted scoring picked.
 *
 * **Residual, known and narrow:** a waypoint level with the rect on NEITHER axis
 * has no orthogonal leg into it at all — provably, since a single straight segment
 * to any boundary point is diagonal unless it shares the waypoint's x or y, which
 * requires an overlapping span. Drawing it square would need an extra bend, and a
 * bend we invent at render time is a waypoint the model does not have and the user
 * cannot see or drag. So that end clamps to the nearest corner of the chosen side
 * and stays diagonal. It is NOT reachable from routing (the router's final leg ends
 * inside the rect, so the last waypoint is always level with it on one axis); it
 * takes a hand-dragged waypoint, and that case drew a diagonal before this change
 * too. {@link closestSideToPoint} is left alone for the same reason: waypoint-less
 * edges draw with `getSmoothStepPath`, which bends for itself.
 *
 * With a FIXED side the choice is made already; see {@link routeEndLeg} for how the
 * anchor sits on it and what happens when the leg cannot meet it square.
 */
export function routeEndAnchor(
  rect: Rect,
  waypoint: { x: number; y: number },
  fixedSide?: AttachSide,
): ClosestSideResult {
  if (fixedSide !== undefined) return routeEndLeg(rect, waypoint, fixedSide).anchor;
  const horizontalLegReaches = waypoint.y >= rect.y && waypoint.y <= rect.y + rect.height;
  const verticalLegReaches = waypoint.x >= rect.x && waypoint.x <= rect.x + rect.width;
  // Equal means both (the waypoint is inside the rect, every side is reachable) or
  // neither (the residual above) — both fall back to scoring all four sides.
  const candidates =
    horizontalLegReaches === verticalLegReaches
      ? SIDES
      : horizontalLegReaches
        ? VERTICAL_SIDES
        : HORIZONTAL_SIDES;
  const side = nearestSideAmong(rect, waypoint, candidates);
  return isHorizontalSide(side.position)
    ? { ...side, x: clamp(waypoint.x, rect.x, rect.x + rect.width) }
    : { ...side, y: clamp(waypoint.y, rect.y, rect.y + rect.height) };
}

/** The sides a HORIZONTAL leg can meet (they run vertically), and vice versa. */
const VERTICAL_SIDES = [Position.Left, Position.Right] as const;
const HORIZONTAL_SIDES = [Position.Top, Position.Bottom] as const;

/**
 * How far a line leaves a FIXED side before it turns toward a waypoint it cannot
 * meet square — the stub of {@link routeEndLeg}. The same length as a segment
 * drag's jog stub, so a stub bend and a dragged bend sit the same distance off
 * the node.
 */
export const SIDE_STUB = 24;

/** One end of a routed line: where it attaches, and any bends the attachment costs. */
export interface RouteEndLeg {
  anchor: ClosestSideResult;
  /**
   * Extra bends between `anchor` and the adjacent waypoint, in drawing order
   * FROM the anchor. Empty when the leg meets the side square, which is the
   * normal case; at most two otherwise (out along the side's normal, then across).
   */
  stubs: Point[];
}

/**
 * The end leg of a routed line whose end may have a FIXED side (`EdgeRoute.sourceSide`).
 *
 * Free end: {@link routeEndAnchor} as before, no stubs. Fixed end: the anchor is on
 * that side whatever the waypoint says. It slides along the side to face the
 * waypoint when the leg can meet it square — the waypoint sits within the side's
 * span and on its outward side — and otherwise it stays on the side's midpoint and
 * the leg gets a STUB: out along the side's normal by {@link SIDE_STUB} (or as far
 * as the waypoint, when that is nearer), then across to the waypoint's line. So a
 * line told to leave from the top leaves upward even when its route runs off to the
 * right, at the price of two bends the model does not store. They are render-time
 * geometry, like the anchor itself; a segment drag that touches them writes them
 * into the route, which is the same claim a drag makes of any drawn leg.
 *
 * The router never needs the stub: a pinned end leaves perpendicular to its side,
 * so the first waypoint is level with the pin and the anchor slides onto it. Stubs
 * appear on hand-drawn routes after a side change, and on a routed line whose
 * side was changed but which has not been re-routed (routing off, route manual).
 */
export function routeEndLeg(
  rect: Rect,
  waypoint: { x: number; y: number },
  fixedSide?: AttachSide,
): RouteEndLeg {
  if (fixedSide === undefined) return { anchor: routeEndAnchor(rect, waypoint), stubs: [] };
  const side = positionOfSide(fixedSide);
  const mid = sideAnchors(rect)[side];
  const normal = NORMALS[side];
  if (isHorizontalSide(side)) {
    // A vertical leg meets a top/bottom side when the waypoint is within the
    // rect's x-span and out past the side (on the side's own line counts).
    const beyond = (waypoint.y - mid.y) * normal.y;
    const within = waypoint.x >= rect.x && waypoint.x <= rect.x + rect.width;
    if (within && beyond >= 0) return { anchor: { position: side, x: waypoint.x, y: mid.y }, stubs: [] };
    const stub = beyond > 0 ? Math.min(SIDE_STUB, beyond) : SIDE_STUB;
    const out = { x: mid.x, y: mid.y + normal.y * stub };
    const across = { x: waypoint.x, y: out.y };
    return { anchor: { position: side, x: mid.x, y: mid.y }, stubs: stubBends(out, across, waypoint) };
  }
  const beyond = (waypoint.x - mid.x) * normal.x;
  const within = waypoint.y >= rect.y && waypoint.y <= rect.y + rect.height;
  if (within && beyond >= 0) return { anchor: { position: side, x: mid.x, y: waypoint.y }, stubs: [] };
  const stub = beyond > 0 ? Math.min(SIDE_STUB, beyond) : SIDE_STUB;
  const out = { x: mid.x + normal.x * stub, y: mid.y };
  const across = { x: out.x, y: waypoint.y };
  return { anchor: { position: side, x: mid.x, y: mid.y }, stubs: stubBends(out, across, waypoint) };
}

/** `out → across → waypoint` with the zero-length legs left out. */
function stubBends(out: Point, across: Point, waypoint: Point): Point[] {
  const stubs = [out];
  if (!samePoint(across, out) && !samePoint(across, waypoint)) stubs.push(across);
  return stubs;
}

const samePoint = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
