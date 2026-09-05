import { describe, expect, it } from 'vitest';
import { Position } from '@xyflow/react';
import {
  assignEdgeAnchors,
  closestSides,
  closestSideToPoint,
  routeEndAnchor,
  sideAnchors,
} from './floatingEdgeMath';
import type { Rect } from '../types';
import { diagonalSegments } from '../layout/routeTestSupport';

const rect = (x: number, y: number, width = 100, height = 50): Rect => ({ x, y, width, height });

describe('sideAnchors', () => {
  it('places anchors at the side midpoints', () => {
    const anchors = sideAnchors(rect(0, 0, 100, 50));
    expect(anchors[Position.Top]).toEqual({ x: 50, y: 0 });
    expect(anchors[Position.Right]).toEqual({ x: 100, y: 25 });
    expect(anchors[Position.Bottom]).toEqual({ x: 50, y: 50 });
    expect(anchors[Position.Left]).toEqual({ x: 0, y: 25 });
  });
});

describe('closestSides', () => {
  it('connects right→left when the target sits to the right', () => {
    const result = closestSides(rect(0, 0), rect(300, 0));
    expect(result.sourcePosition).toBe(Position.Right);
    expect(result.targetPosition).toBe(Position.Left);
    expect(result.sourceX).toBe(100);
    expect(result.targetX).toBe(300);
    expect(result.sourceY).toBe(25);
  });

  it('connects bottom→top when the target sits below', () => {
    const result = closestSides(rect(0, 0), rect(0, 200));
    expect(result.sourcePosition).toBe(Position.Bottom);
    expect(result.targetPosition).toBe(Position.Top);
  });

  it('is direction-aware: swapping nodes mirrors the sides', () => {
    const forward = closestSides(rect(0, 0), rect(300, 0));
    const backward = closestSides(rect(300, 0), rect(0, 0));
    expect(backward.sourcePosition).toBe(Position.Left);
    expect(backward.targetPosition).toBe(Position.Right);
    expect(backward.sourceX).toBe(forward.targetX);
  });

  it('penalises facing-away sides on diagonals (no out-and-back loops)', () => {
    // Target down-right: top/left sides of the source face away and must lose,
    // even though e.g. source-top → target-top might be geometrically close.
    const result = closestSides(rect(0, 0), rect(160, 120));
    expect([Position.Right, Position.Bottom]).toContain(result.sourcePosition);
    expect([Position.Left, Position.Top]).toContain(result.targetPosition);
  });

  it('falls back to plain shortest for enclosed nodes (penalties additive)', () => {
    // Small node fully inside a big one: every pairing carries penalties, so
    // the shortest raw distance wins instead of nothing being selected.
    const result = closestSides(rect(0, 0, 400, 400), rect(150, 150, 100, 50));
    expect(result.sourcePosition).toBeDefined();
    expect(result.targetPosition).toBeDefined();
    expect(Number.isFinite(result.sourceX)).toBe(true);
  });

  it('prefers vertical sides when the vertical gap dominates', () => {
    const result = closestSides(rect(0, 0), rect(30, 300));
    expect(result.sourcePosition).toBe(Position.Bottom);
    expect(result.targetPosition).toBe(Position.Top);
  });
});

describe('assignEdgeAnchors', () => {
  it('fans three edges out across one node side into distinct, ordered slots', () => {
    // Source at origin; three targets far to the right stacked vertically, so
    // every edge exits the source's Right side. Ids are scrambled vs. target
    // order to prove ordering follows target position, not id.
    const rectById = new Map<string, Rect>([
      ['s', rect(0, 0, 100, 50)],
      ['top', rect(500, -40, 100, 50)],
      ['mid', rect(500, 0, 100, 50)],
      ['bot', rect(500, 40, 100, 50)],
    ]);
    const anchors = assignEdgeAnchors(
      [
        { id: 'e-c', sourceId: 's', targetId: 'top' },
        { id: 'e-a', sourceId: 's', targetId: 'mid' },
        { id: 'e-b', sourceId: 's', targetId: 'bot' },
      ],
      rectById,
    );
    const top = anchors.get('e-c')!;
    const mid = anchors.get('e-a')!;
    const bot = anchors.get('e-b')!;
    // All three exit the Right side (x pinned to x + w = 100).
    for (const a of [top, mid, bot]) {
      expect(a.sourcePosition).toBe(Position.Right);
      expect(a.sourceX).toBe(100);
      // Within the side span (0..50), clear of the exact corners.
      expect(a.sourceY).toBeGreaterThan(0);
      expect(a.sourceY).toBeLessThan(50);
    }
    // Distinct slots.
    expect(new Set([top.sourceY, mid.sourceY, bot.sourceY]).size).toBe(3);
    // Ordered by target position: topmost target → smallest sourceY.
    expect(top.sourceY).toBeLessThan(mid.sourceY);
    expect(mid.sourceY).toBeLessThan(bot.sourceY);
  });

  it('leaves a lone edge on the side midpoint (parity with closestSides)', () => {
    const source = rect(0, 0, 100, 50);
    const target = rect(300, 0, 100, 50);
    const rectById = new Map<string, Rect>([
      ['s', source],
      ['t', target],
    ]);
    const anchors = assignEdgeAnchors([{ id: 'e', sourceId: 's', targetId: 't' }], rectById);
    const only = anchors.get('e')!;
    const sides = closestSides(source, target);
    expect(only.sourceX).toBeCloseTo(sides.sourceX);
    expect(only.sourceY).toBeCloseTo(sides.sourceY);
    expect(only.targetX).toBeCloseTo(sides.targetX);
    expect(only.targetY).toBeCloseTo(sides.targetY);
    // Right-side / left-side midpoints, matching today's un-slotted anchors.
    expect(only.sourceY).toBeCloseTo(25);
    expect(only.targetY).toBeCloseTo(25);
  });

  it('keeps the sides chosen by closestSides', () => {
    const source = rect(0, 0, 100, 50);
    const target = rect(0, 300, 100, 50);
    const rectById = new Map<string, Rect>([
      ['s', source],
      ['t', target],
    ]);
    const sides = closestSides(source, target);
    const anchors = assignEdgeAnchors([{ id: 'e', sourceId: 's', targetId: 't' }], rectById);
    const only = anchors.get('e')!;
    expect(only.sourcePosition).toBe(sides.sourcePosition);
    expect(only.targetPosition).toBe(sides.targetPosition);
    // Slots sit on the chosen side line: Bottom → y + h, Top → y.
    expect(only.sourceY).toBe(50);
    expect(only.targetY).toBe(300);
  });

  it('is deterministic and tie-breaks equal positions by edge id', () => {
    // Two edges from one source to targets at the SAME coordinate: the ordering
    // key ties, so id decides — "a" gets the first (smaller-Y) slot.
    const rectById = new Map<string, Rect>([
      ['s', rect(0, 0, 100, 50)],
      ['t', rect(500, 0, 100, 50)],
    ]);
    const inputs = [
      { id: 'b', sourceId: 's', targetId: 't' },
      { id: 'a', sourceId: 's', targetId: 't' },
    ];
    const first = assignEdgeAnchors(inputs, rectById);
    const second = assignEdgeAnchors(inputs, rectById);
    expect(first.get('a')).toEqual(second.get('a'));
    expect(first.get('b')).toEqual(second.get('b'));
    expect(first.get('a')!.sourceY).toBeLessThan(first.get('b')!.sourceY);
  });

  it('skips edges whose endpoints are not both placed', () => {
    const rectById = new Map<string, Rect>([['s', rect(0, 0, 100, 50)]]);
    const anchors = assignEdgeAnchors([{ id: 'e', sourceId: 's', targetId: 'missing' }], rectById);
    expect(anchors.has('e')).toBe(false);
  });
});

describe('routeEndAnchor', () => {
  // The reported diagonal, from solution design 1: ERP Integration Hub → Dynamics
  // 365 ERP. libavoid's route leaves the source downwards and comes in horizontally
  // at y = 686.05, nudged 42 px off the target's centre line by the two edges
  // sharing the channel below the domain groups.
  const erp: Rect = { x: 1587, y: 460.85263523898476, width: 200, height: 130 };
  const dynamics: Rect = { x: 2001.105289495698, y: 595.8526352389847, width: 180, height: 96 };
  const waypoint = { x: 1687, y: 686.05 };

  it('meets the target on the line the route arrives on, not the side midpoint', () => {
    const anchor = routeEndAnchor(dynamics, waypoint);
    expect(anchor.position).toBe(Position.Left);
    expect(anchor.x).toBe(dynamics.x);
    // The whole bug: closestSideToPoint answers the side's midpoint, 42 px away.
    expect(closestSideToPoint(dynamics, waypoint).y).toBeCloseTo(643.85, 2);
    expect(anchor.y).toBe(waypoint.y);
  });

  it('leaves the source leg vertical', () => {
    const anchor = routeEndAnchor(erp, waypoint);
    expect(anchor.position).toBe(Position.Bottom);
    expect(anchor.x).toBe(waypoint.x);
    expect(anchor.y).toBe(erp.y + erp.height);
  });

  it('keeps a centred approach on the midpoint, exactly as before', () => {
    const centred = { x: 1908.05, y: 525.8526352389847 };
    const adyen: Rect = { x: 2001.105289495698, y: 477.8526352389847, width: 180, height: 96 };
    expect(routeEndAnchor(adyen, centred)).toEqual(closestSideToPoint(adyen, centred));
  });

  it('slides along a horizontal side for a vertical approach', () => {
    const target = rect(0, 300, 100, 50);
    const anchor = routeEndAnchor(target, { x: 20, y: 500 });
    expect(anchor.position).toBe(Position.Bottom);
    expect(anchor).toMatchObject({ x: 20, y: 350 });
  });

  it('prefers a side that can accommodate the projection over one that would clamp', () => {
    // A waypoint level with the rect but way past its right edge. Bottom is the
    // nearest side by raw distance to a MIDPOINT, and choosing it would clamp x to
    // the corner and leave a diagonal; Right takes the leg horizontally.
    const target = rect(0, 300, 400, 50);
    const anchor = routeEndAnchor(target, { x: 900, y: 349 });
    expect(anchor.position).toBe(Position.Right);
    expect(anchor).toMatchObject({ x: 400, y: 349 });
  });

  it('clamps to the nearest corner — and stays diagonal — when NO side can take the leg', () => {
    // The documented residual: a waypoint level with the rect on neither axis has no
    // orthogonal leg into it, because a single segment to any boundary point must
    // share the waypoint's x or y. Only reachable by hand-dragging a waypoint (a
    // routed leg ends INSIDE the rect, so its last waypoint is always level on one
    // axis), and that case drew a diagonal before this function existed too.
    const target = rect(0, 300, 100, 50);
    const anchor = routeEndAnchor(target, { x: -400, y: 5000 });
    expect(anchor).toMatchObject({ position: Position.Bottom, x: 0, y: 350 });
    // Stated, not hidden: this end is still diagonal, and the assertion says so.
    expect(diagonalSegments([anchor, { x: -400, y: 5000 }])).toHaveLength(1);
  });

  it('drops a perpendicular for a waypoint inside the rect', () => {
    // Every side "faces away", so all four are scored; the nearest wins and the leg
    // out to it is still square.
    const target = rect(0, 300, 100, 50);
    const anchor = routeEndAnchor(target, { x: 40, y: 345 });
    expect(anchor).toMatchObject({ position: Position.Bottom, x: 40, y: 350 });
    expect(diagonalSegments([{ x: 40, y: 345 }, anchor])).toEqual([]);
  });
});
