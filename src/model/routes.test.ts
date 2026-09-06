import { describe, expect, it } from 'vitest';
import {
  attachEnds,
  AUTO_ROUTE_RADIUS,
  dragSegment,
  dragStraight,
  drawnPolyline,
  followNodeMove,
  hasRouteContent,
  insertionIndexOnDrawnPolyline,
  insertWaypoint,
  insertWaypointOnDrawn,
  interiorOf,
  isAutoRoute,
  jogFromStraight,
  JOG_STUB,
  legAxis,
  MANUAL_ROUTE_RADIUS,
  manualRouteIds,
  moveSegment,
  moveWaypoint,
  removeWaypoint,
  roundedPolylinePath,
  routeFor,
  routeRadius,
  routeSource,
  snapOrthogonal,
  waypointInsertionIndex,
} from './routes';
import { routeEndAnchor } from './floatingEdgeMath';
import { LABEL_MARGIN, ROUTE_CLEARANCE } from '../layout/routing';
import type { EdgeRoute, Point, Rect } from './types';

const start: Point = { x: 0, y: 0 };
const end: Point = { x: 300, y: 0 };

describe('waypointInsertionIndex', () => {
  it('inserts on the only segment when there are no waypoints', () => {
    expect(waypointInsertionIndex(start, [], end, { x: 150, y: 40 })).toBe(0);
  });

  it('picks the nearest segment of the polyline', () => {
    const waypoints: Point[] = [{ x: 100, y: 100 }, { x: 200, y: 100 }];
    // Near the first leg (start → w0).
    expect(waypointInsertionIndex(start, waypoints, end, { x: 40, y: 50 })).toBe(0);
    // Near the middle leg (w0 → w1).
    expect(waypointInsertionIndex(start, waypoints, end, { x: 150, y: 110 })).toBe(1);
    // Near the last leg (w1 → end).
    expect(waypointInsertionIndex(start, waypoints, end, { x: 260, y: 40 })).toBe(2);
  });

  it('breaks ties deterministically on the earliest segment', () => {
    const waypoints: Point[] = [{ x: 150, y: 0 }];
    // Equidistant to both collinear segments → first one.
    expect(waypointInsertionIndex(start, waypoints, end, { x: 150, y: 50 })).toBe(0);
  });
});

describe('insert/move/remove waypoint', () => {
  it('insertWaypoint splices at the nearest segment and is non-mutating', () => {
    const waypoints: Point[] = [{ x: 100, y: 100 }];
    const result = insertWaypoint(waypoints, start, end, { x: 200, y: 60 });
    expect(result).toEqual([
      { x: 100, y: 100 },
      { x: 200, y: 60 },
    ]);
    expect(waypoints).toHaveLength(1);
  });

  it('moveWaypoint replaces the point at the index', () => {
    const waypoints: Point[] = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    expect(moveWaypoint(waypoints, 1, { x: 9, y: 9 })).toEqual([
      { x: 1, y: 1 },
      { x: 9, y: 9 },
    ]);
    // Out-of-range indices are a no-op (same reference).
    expect(moveWaypoint(waypoints, 5, { x: 0, y: 0 })).toBe(waypoints);
    expect(moveWaypoint(waypoints, -1, { x: 0, y: 0 })).toBe(waypoints);
  });

  it('removeWaypoint drops the point at the index', () => {
    const waypoints: Point[] = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    expect(removeWaypoint(waypoints, 0)).toEqual([{ x: 2, y: 2 }]);
    expect(removeWaypoint(waypoints, 9)).toBe(waypoints);
  });
});

describe('routeFor', () => {
  it('finds the route by connection id', () => {
    const diagram = {
      edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 1, y: 2 }] }],
    };
    expect(routeFor(diagram, 'c1')?.waypoints).toEqual([{ x: 1, y: 2 }]);
    expect(routeFor(diagram, 'c2')).toBeUndefined();
    expect(routeFor(undefined, 'c1')).toBeUndefined();
  });
});

describe('roundedPolylinePath', () => {
  it('renders a straight line for two points', () => {
    expect(roundedPolylinePath([start, end])).toBe('M 0,0 L 300,0');
  });

  it('rounds interior corners with quadratic curves', () => {
    const path = roundedPolylinePath([start, { x: 100, y: 0 }, { x: 100, y: 100 }], 8);
    expect(path).toContain('Q 100,0');
    expect(path.startsWith('M 0,0')).toBe(true);
    expect(path.endsWith('L 100,100')).toBe(true);
  });

  it('shrinks the radius on short segments instead of overshooting', () => {
    const path = roundedPolylinePath([start, { x: 4, y: 0 }, { x: 4, y: 4 }], 8);
    // Radius is limited to half the shortest adjacent segment (2px here).
    expect(path).toContain('L 2,0 Q 4,0 4,2');
  });
});

describe('route provenance', () => {
  it('treats an absent source as manual — the safe end of the guess', () => {
    // A row written before the column existed, and a connection with no stored
    // route at all, both land here. Reading `undefined` as "not manual" would
    // invert intent rule 10 and let an automatic pass overwrite hand-drawn work.
    expect(routeSource(undefined)).toBe('manual');
    expect(routeSource({ source: undefined })).toBe('manual');
    expect(routeSource({ source: 'manual' })).toBe('manual');
    expect(routeSource({ source: 'auto' })).toBe('auto');
    expect(isAutoRoute(undefined)).toBe(false);
    expect(isAutoRoute({ source: 'auto' })).toBe(true);
  });

  it('draws router output at the larger radius and hand-drawn bends tight', () => {
    expect(routeRadius({ source: 'auto' })).toBe(AUTO_ROUTE_RADIUS);
    expect(routeRadius({ source: 'manual' })).toBe(MANUAL_ROUTE_RADIUS);
    expect(routeRadius(undefined)).toBe(MANUAL_ROUTE_RADIUS);
  });
});

/**
 * The guard on the whole "smooth means a bigger radius" argument. If any of these
 * break, the case for AUTO_ROUTE_RADIUS breaks with them and the constant is no
 * longer safe to raise — which is the failure this file exists to catch.
 */
describe('roundedPolylinePath — corner drift and clearance', () => {
  /** Sample the drawn quadratic corner densely, in the same frame as the polyline. */
  const cornerArc = (corner: Point, legIn: Point, legOut: Point, radius: number): Point[] => {
    const r = Math.min(
      radius,
      Math.hypot(corner.x - legIn.x, corner.y - legIn.y) / 2,
      Math.hypot(legOut.x - corner.x, legOut.y - corner.y) / 2,
    );
    const inLen = Math.hypot(corner.x - legIn.x, corner.y - legIn.y);
    const outLen = Math.hypot(legOut.x - corner.x, legOut.y - corner.y);
    const p0 = {
      x: corner.x - ((corner.x - legIn.x) / inLen) * r,
      y: corner.y - ((corner.y - legIn.y) / inLen) * r,
    };
    const p2 = {
      x: corner.x + ((legOut.x - corner.x) / outLen) * r,
      y: corner.y + ((legOut.y - corner.y) / outLen) * r,
    };
    const points: Point[] = [];
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const u = 1 - t;
      points.push({
        x: u * u * p0.x + 2 * u * t * corner.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * corner.y + t * t * p2.y,
      });
    }
    return points;
  };

  const RADII = [8, 16, 24, 32, 48, 64];

  it('drifts exactly radius/4 from the corner at a right angle', () => {
    // The number every other claim here is measured against: a chip pinned to a
    // point ON THE POLYLINE sits this far off the DRAWN line near a corner.
    const corner = { x: 200, y: 0 };
    for (const radius of RADII) {
      const arc = cornerArc(corner, { x: 0, y: 0 }, { x: 200, y: 200 }, radius);
      const drift = Math.max(
        ...arc.map((p) => Math.min(Math.abs(p.y - corner.y), Math.abs(p.x - corner.x))),
      );
      // The apex of the quadratic sits radius/4 inside the corner on each axis.
      expect(drift).toBeCloseTo(radius / 4, 5);
    }
  });

  it('keeps a chip near a corner inside the label margin at the shipped radius', () => {
    // The ONLY bound that actually constrains AUTO_ROUTE_RADIUS: drift must stay
    // under LABEL_MARGIN, giving radius < 48. Anything at or above that is a
    // chip that can drift off its own line.
    expect(AUTO_ROUTE_RADIUS / 4).toBeLessThan(LABEL_MARGIN);
    expect(48 / 4).toBeGreaterThanOrEqual(LABEL_MARGIN);
  });

  it('never breaches ROUTE_CLEARANCE at any radius, because the arc stays inside its legs', () => {
    // Structural, not lucky: a quadratic lies inside the convex hull of its two
    // leg points and the corner, and both legs already sit at ROUTE_CLEARANCE.
    // The obstacle here is placed on the corner's diagonal, where the corridor is
    // thinnest — 16·√2 ≈ 22.63 px of slack, which rounding spends and no more.
    const corner = { x: 200, y: 0 };
    const obstacle = { x: corner.x + ROUTE_CLEARANCE, y: corner.y - ROUTE_CLEARANCE };
    for (const radius of RADII) {
      const arc = cornerArc(corner, { x: 0, y: 0 }, { x: 200, y: 200 }, radius);
      const nearest = Math.min(...arc.map((p) => Math.hypot(p.x - obstacle.x, p.y - obstacle.y)));
      expect(nearest).toBeGreaterThanOrEqual(ROUTE_CLEARANCE);
    }
  });

  it('clamps a large radius on a short leg rather than overshooting it', () => {
    // Why raising the constant buys less than it looks: a jog between two adjacent
    // 32px channels draws at 16 whatever the nominal value says.
    const jog = roundedPolylinePath([{ x: 0, y: 0 }, { x: 32, y: 0 }, { x: 32, y: 32 }], 64);
    expect(jog).toContain('L 16,0 Q 32,0 32,16');
  });
});

// --- Phase 2: content, segments, jogs, following ------------------------------------

describe('hasRouteContent', () => {
  it('is false for the delete marker and true for bends, a label anchor or a pin', () => {
    expect(hasRouteContent({ waypoints: [] })).toBe(false);
    expect(hasRouteContent({ waypoints: [], labelPosition: undefined, pinned: false })).toBe(false);
    expect(hasRouteContent({ waypoints: [{ x: 1, y: 1 }] })).toBe(true);
    expect(hasRouteContent({ waypoints: [], labelPosition: { x: 1, y: 1 } })).toBe(true);
    // The pin IS content: a straight, pinned line has a row and nothing else in it.
    expect(hasRouteContent({ waypoints: [], pinned: true })).toBe(true);
  });
});

describe('manualRouteIds — pins', () => {
  it('protects a pinned row, whatever its source says', () => {
    const diagram = {
      edgeRoutes: [
        { connectionId: 'pinned', waypoints: [], source: 'manual' as const, pinned: true },
        { connectionId: 'odd', waypoints: [], source: 'auto' as const, pinned: true },
        { connectionId: 'router', waypoints: [{ x: 1, y: 1 }], source: 'auto' as const },
      ],
    };
    expect(manualRouteIds(diagram)).toEqual(new Set(['pinned', 'odd']));
  });
});

describe('legAxis', () => {
  it('reads horizontal, vertical and diagonal legs, with a 1px tolerance', () => {
    expect(legAxis({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe('horizontal');
    expect(legAxis({ x: 0, y: 0 }, { x: 10, y: 0.6 })).toBe('horizontal');
    expect(legAxis({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe('vertical');
    expect(legAxis({ x: 0, y: 0 }, { x: 10, y: 10 })).toBe('diagonal');
    // A zero-length leg has no axis.
    expect(legAxis({ x: 0, y: 0 }, { x: 0.5, y: 0.5 })).toBe('diagonal');
  });
});

describe('moveSegment', () => {
  // [start anchor, bend, bend, end anchor]: horizontal, vertical, horizontal.
  const polyline: Point[] = [
    { x: 300, y: 150 },
    { x: 500, y: 150 },
    { x: 500, y: 400 },
    { x: 700, y: 400 },
  ];

  it('moves a vertical leg in x only, both bounding points together', () => {
    expect(moveSegment(polyline, 1, { x: 40, y: 30 })).toEqual([
      { x: 300, y: 150 },
      { x: 540, y: 150 },
      { x: 540, y: 400 },
      { x: 700, y: 400 },
    ]);
  });

  it('moves a horizontal leg in y only — the anchor point moves with it', () => {
    expect(moveSegment(polyline, 0, { x: 10, y: 25 })).toEqual([
      { x: 300, y: 175 },
      { x: 500, y: 175 },
      { x: 500, y: 400 },
      { x: 700, y: 400 },
    ]);
  });

  it('keeps the legs either side orthogonal: they grow or shrink, never tilt', () => {
    const moved = moveSegment(polyline, 1, { x: 40, y: 0 });
    expect(legAxis(moved[0], moved[1])).toBe('horizontal');
    expect(legAxis(moved[1], moved[2])).toBe('vertical');
    expect(legAxis(moved[2], moved[3])).toBe('horizontal');
  });

  it('returns the same reference when the delta has no component along the free axis', () => {
    expect(moveSegment(polyline, 0, { x: 10, y: 0 })).toBe(polyline);
    expect(moveSegment(polyline, 1, { x: 0, y: 10 })).toBe(polyline);
    expect(moveSegment(polyline, 9, { x: 10, y: 10 })).toBe(polyline);
    expect(moveSegment(polyline, -1, { x: 10, y: 10 })).toBe(polyline);
  });

  it('takes the whole delta on a diagonal leg', () => {
    const diagonal: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 }];
    expect(moveSegment(diagonal, 0, { x: 5, y: 7 })).toEqual([
      { x: 5, y: 7 },
      { x: 105, y: 107 },
      { x: 200, y: 100 },
    ]);
  });

  it('carries collinear neighbours along, so they cannot turn diagonal', () => {
    // Two horizontal legs in a row are one leg the user sees two handles on.
    const collinear: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }];
    expect(moveSegment(collinear, 1, { x: 0, y: 30 })).toEqual([
      { x: 0, y: 30 },
      { x: 100, y: 30 },
      { x: 200, y: 30 },
      { x: 200, y: 100 },
    ]);
  });
});

describe('snapOrthogonal / interiorOf', () => {
  it('nudges a point within 1px of its predecessor onto the axis, and leaves a real offset alone', () => {
    expect(snapOrthogonal([{ x: 0, y: 0 }, { x: 100, y: 0.6 }, { x: 100.4, y: 50 }])).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ]);
    expect(snapOrthogonal([{ x: 0, y: 0 }, { x: 100, y: 3 }])).toEqual([{ x: 0, y: 0 }, { x: 100, y: 3 }]);
  });

  it('interiorOf strips the two anchors', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 1 };
    const c = { x: 2, y: 2 };
    const d = { x: 3, y: 3 };
    expect(interiorOf([a, b, c, d])).toEqual([b, c]);
    expect(interiorOf([a, d])).toEqual([]);
    expect(interiorOf([])).toEqual([]);
  });
});

describe('jogFromStraight', () => {
  it('shifts an aligned horizontal line perpendicular, a stub in from each end', () => {
    expect(jogFromStraight({ x: 300, y: 150 }, { x: 700, y: 150 }, { x: 0, y: 60 }, 'horizontal')).toEqual([
      { x: 300 + JOG_STUB, y: 210 },
      { x: 700 - JOG_STUB, y: 210 },
    ]);
  });

  it('makes a Z out of an offset step: the middle leg moves along the drag', () => {
    expect(jogFromStraight({ x: 300, y: 150 }, { x: 700, y: 250 }, { x: 30, y: 0 }, 'horizontal')).toEqual([
      { x: 530, y: 150 },
      { x: 530, y: 250 },
    ]);
    expect(jogFromStraight({ x: 200, y: 200 }, { x: 300, y: 600 }, { x: 0, y: -20 }, 'vertical')).toEqual([
      { x: 200, y: 380 },
      { x: 300, y: 380 },
    ]);
  });

  it('mirrors for a vertical exit', () => {
    expect(jogFromStraight({ x: 200, y: 200 }, { x: 200, y: 600 }, { x: 40, y: 0 }, 'vertical')).toEqual([
      { x: 240, y: 200 + JOG_STUB },
      { x: 240, y: 600 - JOG_STUB },
    ]);
  });

  it('clamps the stub to a quarter of a short line', () => {
    expect(jogFromStraight({ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 10 }, 'horizontal')).toEqual([
      { x: 10, y: 10 },
      { x: 30, y: 10 },
    ]);
  });

  it('is empty when the drag has no component the leg can follow', () => {
    expect(jogFromStraight({ x: 300, y: 150 }, { x: 700, y: 150 }, { x: 50, y: 0 }, 'horizontal')).toEqual([]);
    expect(jogFromStraight({ x: 300, y: 150 }, { x: 700, y: 250 }, { x: 0, y: 50 }, 'horizontal')).toEqual([]);
    expect(jogFromStraight({ x: 200, y: 200 }, { x: 200, y: 600 }, { x: 0, y: 9 }, 'vertical')).toEqual([]);
  });
});

/**
 * Every leg of the DRAWN line — anchors from `routeEndAnchor`, the renderer's
 * own rule — is axis-aligned. The property the whole segment-drag design exists
 * to keep.
 */
function expectOrthogonal(waypoints: Point[], source: Rect, target: Rect): void {
  const drawn = drawnPolyline(waypoints, source, target);
  for (let i = 0; i < drawn.length - 1; i += 1) {
    expect(legAxis(drawn[i], drawn[i + 1]), `leg ${i} of ${JSON.stringify(drawn)}`).not.toBe('diagonal');
  }
}

describe('dragSegment — end legs stay orthogonal and attached', () => {
  const A: Rect = { x: 100, y: 100, width: 200, height: 100 }; // centre (200,150)
  const B: Rect = { x: 700, y: 100, width: 200, height: 100 }; // centre (800,150)
  // A right (300,150) → (500,150) → (500,400) → (800,400) → B bottom (800,200).
  const waypoints: Point[] = [{ x: 500, y: 150 }, { x: 500, y: 400 }, { x: 800, y: 400 }];
  const drawn = drawnPolyline(waypoints, A, B);

  it('draws the fixture the way the test assumes', () => {
    expect(drawn[0]).toEqual({ x: 300, y: 150 });
    expect(drawn[drawn.length - 1]).toEqual({ x: 800, y: 200 });
    expectOrthogonal(waypoints, A, B);
  });

  it('slides the exit along the side while the leg stays inside the node’s span', () => {
    const result = dragSegment(drawn, 0, { x: 0, y: 30 }, A, B);
    expect(result).toEqual([{ x: 500, y: 180 }, { x: 500, y: 400 }, { x: 800, y: 400 }]);
    const anchor = routeEndAnchor(A, result![0]);
    expect(anchor).toMatchObject({ x: 300, y: 180 });
    expectOrthogonal(result!, A, B);
  });

  it('inserts a connector bend when the exit leg leaves the node’s span', () => {
    // y = 250 is below A (100..200): no horizontal leg can reach it, so without a
    // new bend the renderer would clamp to the corner and draw a diagonal tail.
    const result = dragSegment(drawn, 0, { x: 0, y: 100 }, A, B);
    expect(result).toEqual([
      { x: 200, y: 250 }, // the new bend, under A's centre
      { x: 500, y: 250 },
      { x: 500, y: 400 },
      { x: 800, y: 400 },
    ]);
    // Attached through A's bottom, vertically — routeEndAnchor's own answer.
    expect(routeEndAnchor(A, result![0])).toMatchObject({ x: 200, y: 200 });
    expectOrthogonal(result!, A, B);
  });

  it('does the same at the target end for a vertical entry leg dragged out of span', () => {
    const result = dragSegment(drawn, 3, { x: 150, y: 0 }, A, B);
    expect(result).toEqual([
      { x: 500, y: 150 },
      { x: 500, y: 400 },
      { x: 950, y: 400 },
      { x: 950, y: 150 }, // the new bend, level with B's centre
    ]);
    expect(routeEndAnchor(B, result![result!.length - 1])).toMatchObject({ x: 900, y: 150 });
    expectOrthogonal(result!, A, B);
  });

  it('moves an interior leg without touching the ends', () => {
    expect(dragSegment(drawn, 1, { x: -60, y: 999 }, A, B)).toEqual([
      { x: 440, y: 150 },
      { x: 440, y: 400 },
      { x: 800, y: 400 },
    ]);
  });

  it('is undefined when the drag has nothing for the leg to follow', () => {
    expect(dragSegment(drawn, 1, { x: 0, y: 50 }, A, B)).toBeUndefined();
  });

  it('attachEnds leaves a route alone whose ends already attach', () => {
    expect(attachEnds(waypoints, A, B)).toBe(waypoints);
    expect(attachEnds([], A, B)).toEqual([]);
  });
});

describe('dragStraight — the first two bends of a straight line', () => {
  const A: Rect = { x: 100, y: 100, width: 200, height: 100 };
  const B: Rect = { x: 700, y: 100, width: 200, height: 100 };

  it('shifts an aligned line within the nodes’ span: two bends, still one straight run', () => {
    const result = dragStraight({ x: 300, y: 150 }, { x: 700, y: 150 }, 'horizontal', { x: 0, y: 30 }, A, B);
    expect(result).toEqual([{ x: 324, y: 180 }, { x: 676, y: 180 }]);
    expectOrthogonal(result!, A, B);
  });

  it('jogs an aligned line out of both spans and re-attaches both ends', () => {
    const result = dragStraight({ x: 300, y: 150 }, { x: 700, y: 150 }, 'horizontal', { x: 0, y: 120 }, A, B);
    expect(result).toEqual([
      { x: 324, y: 150 },
      { x: 324, y: 270 },
      { x: 676, y: 270 },
      { x: 676, y: 150 },
    ]);
    expectOrthogonal(result!, A, B);
  });

  it('turns an offset step into a Z whose middle leg is where the user dragged it', () => {
    const lower: Rect = { x: 700, y: 300, width: 200, height: 100 };
    const result = dragStraight({ x: 300, y: 150 }, { x: 700, y: 350 }, 'horizontal', { x: -60, y: 0 }, A, lower);
    expect(result).toEqual([{ x: 440, y: 150 }, { x: 440, y: 350 }]);
    expectOrthogonal(result!, A, lower);
  });

  it('is undefined for a drag along the line', () => {
    expect(dragStraight({ x: 300, y: 150 }, { x: 700, y: 150 }, 'horizontal', { x: 40, y: 0 }, A, B)).toBeUndefined();
  });
});

describe('insertionIndexOnDrawnPolyline', () => {
  const A: Rect = { x: 100, y: 100, width: 200, height: 100 };
  const B: Rect = { x: 100, y: 300, width: 200, height: 100 };
  // A right (300,190) → (500,190) → (500,260) → (250,260) → B top (250,300).
  const waypoints: Point[] = [{ x: 500, y: 190 }, { x: 500, y: 260 }, { x: 250, y: 260 }];
  const centre = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

  it('measures against the drawn anchors, not the node centres', () => {
    // Left of A's bottom-left corner. The drawn first leg starts at A's RIGHT
    // side, far away, so the nearest drawn leg is the one running back under A.
    // Measured centre-to-centre, the virtual first leg reaches into A and wins.
    const click = { x: 150, y: 230 };
    expect(insertionIndexOnDrawnPolyline(waypoints, A, B, click)).toBe(2);
    expect(waypointInsertionIndex(centre(A), waypoints, centre(B), click)).toBe(0);
  });

  it('agrees with waypointInsertionIndex over routeEndAnchor’s anchors everywhere', () => {
    const drawn = drawnPolyline(waypoints, A, B);
    for (let x = 100; x <= 600; x += 50) {
      for (let y = 100; y <= 400; y += 50) {
        expect(insertionIndexOnDrawnPolyline(waypoints, A, B, { x, y })).toBe(
          waypointInsertionIndex(drawn[0], waypoints, drawn[drawn.length - 1], { x, y }),
        );
      }
    }
  });

  it('is 0 for a line with no bends, and insertWaypointOnDrawn splices there', () => {
    expect(insertionIndexOnDrawnPolyline([], A, B, { x: 999, y: 999 })).toBe(0);
    expect(insertWaypointOnDrawn([], A, B, { x: 5, y: 6 })).toEqual([{ x: 5, y: 6 }]);
    expect(insertWaypointOnDrawn(waypoints, A, B, { x: 150, y: 230 })).toEqual([
      { x: 500, y: 190 },
      { x: 500, y: 260 },
      { x: 150, y: 230 },
      { x: 250, y: 260 },
    ]);
    expect(drawnPolyline([], A, B)).toEqual([]);
  });
});

describe('followNodeMove', () => {
  const A: Rect = { x: 100, y: 100, width: 200, height: 100 };
  const moved = (r: Rect, dx: number, dy: number): Rect => ({ ...r, x: r.x + dx, y: r.y + dy });
  const route = (waypoints: Point[], labelPosition?: Point): EdgeRoute => ({
    connectionId: 'c1',
    waypoints,
    labelPosition,
    source: 'manual',
  });

  it('takes the node’s dy on a horizontal end leg, leaving x alone', () => {
    const before = route([{ x: 500, y: 150 }, { x: 500, y: 400 }]);
    const after = followNodeMove(before, A, moved(A, 20, 30), true);
    expect(after.waypoints).toEqual([{ x: 500, y: 180 }, { x: 500, y: 400 }]);
    // Still attached horizontally through the moved node's right side.
    expect(routeEndAnchor(moved(A, 20, 30), after.waypoints[0])).toMatchObject({ x: 320, y: 180 });
  });

  it('takes the node’s dx on a vertical end leg at the target end', () => {
    const B: Rect = { x: 700, y: 400, width: 200, height: 100 };
    const before = route([{ x: 500, y: 150 }, { x: 800, y: 300 }]);
    const after = followNodeMove(before, B, moved(B, 25, -10), false);
    expect(after.waypoints).toEqual([{ x: 500, y: 150 }, { x: 825, y: 300 }]);
  });

  it('carries the label along when it sits on the moved leg, and not otherwise', () => {
    const onLeg = followNodeMove(route([{ x: 500, y: 150 }, { x: 500, y: 400 }], { x: 400, y: 150 }), A, moved(A, 0, 30), true);
    expect(onLeg.labelPosition).toEqual({ x: 400, y: 180 });
    const elsewhere = followNodeMove(route([{ x: 500, y: 150 }, { x: 500, y: 400 }], { x: 500, y: 300 }), A, moved(A, 0, 30), true);
    expect(elsewhere.labelPosition).toEqual({ x: 500, y: 300 });
  });

  it('moves the whole collinear run at the end, not just the first bend', () => {
    const before = route([{ x: 400, y: 150 }, { x: 500, y: 150 }, { x: 500, y: 400 }]);
    expect(followNodeMove(before, A, moved(A, 0, 30), true).waypoints).toEqual([
      { x: 400, y: 180 },
      { x: 500, y: 180 },
      { x: 500, y: 400 },
    ]);
  });

  it('leaves a diagonal end leg, an empty route and a non-move exactly as they were', () => {
    const diagonal = route([{ x: 500, y: 300 }]);
    expect(followNodeMove(diagonal, A, moved(A, 10, 10), true)).toBe(diagonal);
    const empty = route([]);
    expect(followNodeMove(empty, A, moved(A, 10, 10), true)).toBe(empty);
    const still = route([{ x: 500, y: 150 }]);
    expect(followNodeMove(still, A, A, true)).toBe(still);
    // A move purely along the leg's own axis needs no bend to move either.
    expect(followNodeMove(still, A, moved(A, 40, 0), true)).toBe(still);
  });

  it('composes when both ends of a one-bend route move', () => {
    const B: Rect = { x: 400, y: 300, width: 200, height: 100 };
    let r = route([{ x: 500, y: 150 }]);
    r = followNodeMove(r, A, moved(A, 0, 20), true);
    r = followNodeMove(r, B, moved(B, 15, 0), false);
    expect(r.waypoints).toEqual([{ x: 515, y: 170 }]);
  });
});
