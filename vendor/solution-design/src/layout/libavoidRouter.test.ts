import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Point, Rect } from '../types';
import { pathHitsObstacles } from './geometry';
import { diagonalSegments, pathClearance, routedPath } from './routeTestSupport';
import { closestSideToPoint, routeEndAnchor } from '../edges/floatingEdgeMath';
import { rectCentre, ROUTE_CLEARANCE } from './routing';
import {
  IDEAL_NUDGING_DISTANCE,
  MAX_CONNECTORS_PER_TIER,
  routeWithLibavoid,
  type RouterConnection,
  type RouterInput,
} from './libavoidRouter';

/**
 * The libavoid adapter. Assertions are geometric invariants on the RENDERED path
 * (waypoints put back through `routedPath`, the same anchor math FloatingEdge
 * draws with), never pixel positions — libavoid's exact channel offsets are its
 * business, ours is that the line clears what it must and that the same board
 * always routes the same way.
 */

const node = (id: string, rect: Rect, domainGroup?: string) => ({ id, rect, domainGroup });
const card = (x: number, y: number): Rect => ({ x, y, width: 200, height: 130 });
const chip = (x: number, y: number): Rect => ({ x, y, width: 160, height: 56 });
const actor = (x: number, y: number): Rect => ({ x, y, width: 150, height: 48 });

/**
 * The real tidied E-Commerce landscape (the fixture the adoption plan's numbers
 * were measured on): two domain groups with two members each, actors above, an
 * input channel left, an external system right, management row at the bottom.
 */
function eCommerceBoard(): RouterInput {
  return {
    nodes: [
      node('storeMgr', actor(433, 51)),
      node('shopper', actor(653, 51)),
      node('csa', actor(1142, 51)),
      node('grafana', chip(28, 932)),
      node('slack', chip(210, 932)),
      node('sonar', chip(392, 932)),
      node('gitlab', chip(574, 932)),
      node('marketplace', chip(45, 497)),
      node('dynamics', { x: 1730, y: 477, width: 180, height: 96 }),
      node('akeneo', card(408, 460), 'Customer Experience'),
      node('webshop', card(628, 460), 'Customer Experience'),
      node('order', card(1117, 460), 'Commerce Operations'),
      node('erp', card(1337, 460), 'Commerce Operations'),
    ],
    groups: [
      { name: 'Customer Experience', x: 380, y: 412, width: 476, height: 206 },
      { name: 'Commerce Operations', x: 1089, y: 412, width: 476, height: 206 },
    ],
    connections: [
      { id: 'order-erp', sourceId: 'order', targetId: 'erp' },
      { id: 'shopper-webshop', sourceId: 'shopper', targetId: 'webshop' },
      { id: 'akeneo-webshop', sourceId: 'akeneo', targetId: 'webshop' },
      { id: 'storemgr-akeneo', sourceId: 'storeMgr', targetId: 'akeneo' },
      { id: 'marketplace-order', sourceId: 'marketplace', targetId: 'order' },
      { id: 'csa-order', sourceId: 'csa', targetId: 'order' },
      { id: 'webshop-order', sourceId: 'webshop', targetId: 'order' },
      { id: 'erp-dynamics', sourceId: 'erp', targetId: 'dynamics' },
    ],
  };
}

/**
 * Solution design 1's layer-7 diagram, exactly as `GET /api/SolutionDesigns/1/content`
 * returns it — the board the diagonal ERP → Dynamics tail was reported on, and the
 * reason it is not the same fixture as {@link eCommerceBoard}: it has the SECOND
 * external system (Adyen) stacked above Dynamics, and it is that second edge into
 * the right-hand column that makes the channel below the domain groups crowded
 * enough for nudging to push the ERP → Dynamics leg 42 px off Dynamics' centre line.
 */
function reportedLandscape(): RouterInput {
  const external = (y: number): Rect => ({ x: 2001.105289495698, y, width: 180, height: 96 });
  const y = 460.85263523898476;
  return {
    nodes: [
      node('1', actor(769, 56)),
      node('2', actor(403, 56)),
      node('3', actor(1258, 56)),
      node('10', chip(30, 497.8526352389847)),
      node('11', chip(68.92857142857144, 927.8526352389847)),
      node('12', chip(388.75, 927.8526352389847)),
      node('13', chip(708.5714285714286, 927.8526352389847)),
      node('14', chip(1028.392857142857, 927.8526352389847)),
      node('9', external(477.8526352389847)),
      node('8', external(595.8526352389847)),
      node('4', card(744, y), 'Customer Experience'),
      node('6', card(378, y), 'Customer Experience'),
      node('5', card(1233, y), 'Commerce Operations'),
      node('7', card(1587, y), 'Commerce Operations'),
    ],
    groups: [
      { name: 'Customer Experience', x: 350, y: 412.85263523898476, width: 622, height: 206 },
      { name: 'Commerce Operations', x: 1205, y: 412.85263523898476, width: 610, height: 206 },
    ],
    connections: [
      { id: '1', sourceId: '1', targetId: '4' },
      { id: '2', sourceId: '2', targetId: '6' },
      { id: '3', sourceId: '3', targetId: '5' },
      { id: '4', sourceId: '6', targetId: '4' },
      { id: '5', sourceId: '4', targetId: '5' },
      { id: '6', sourceId: '5', targetId: '7' },
      { id: '7', sourceId: '7', targetId: '8' },
      { id: '8', sourceId: '4', targetId: '9' },
      { id: '9', sourceId: '10', targetId: '5' },
    ],
  };
}

/**
 * Four left→right edges whose straight runs all cross the same tall blocker, so
 * they compete for the channels beside it. This is the board that makes insertion
 * order VISIBLE: nudging hands out channels in connector insertion order.
 */
function parallelChannelBoard(): RouterInput {
  const nodes = [node('blocker', { x: 450, y: 250, width: 120, height: 400 })];
  const connections: RouterConnection[] = [];
  for (let i = 0; i < 4; i++) {
    nodes.push(node(`s${i}`, actor(0, 300 + i * 80)), node(`t${i}`, actor(1000, 300 + i * 80)));
    connections.push({ id: `e${i}`, sourceId: `s${i}`, targetId: `t${i}` });
  }
  return { nodes, groups: [], connections };
}

const nodeOf = (input: RouterInput, id: string) => input.nodes.find((n) => n.id === id)!;
const groupRect = (input: RouterInput, name: string): Rect => {
  const group = input.groups.find((g) => g.name === name)!;
  return { x: group.x, y: group.y, width: group.width, height: group.height };
};
const contains = (rect: Rect, p: Point): boolean =>
  p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;

/** The drawn path for a route: waypoints plus the anchors FloatingEdge derives. */
const drawnPath = (input: RouterInput, connection: RouterConnection, waypoints: Point[]): Point[] =>
  routedPath(nodeOf(input, connection.sourceId).rect, nodeOf(input, connection.targetId).rect, waypoints);

/**
 * The rects this connection is genuinely expected to dodge, mirroring what each
 * tier can actually see: group boxes that hold neither endpoint, plus the sibling
 * members (intra-group) or the ungrouped nodes (inter-group), minus the endpoints.
 */
function genuineObstacles(input: RouterInput, connection: RouterConnection): Rect[] {
  const source = nodeOf(input, connection.sourceId);
  const target = nodeOf(input, connection.targetId);
  const sameGroup = source.domainGroup !== undefined && source.domainGroup === target.domainGroup;
  const boxes = input.groups
    .map((g) => groupRect(input, g.name))
    .filter((box) => !contains(box, rectCentre(source.rect)) && !contains(box, rectCentre(target.rect)));
  const others = input.nodes.filter((n) => n.id !== source.id && n.id !== target.id);
  // An intra-group edge dodges its siblings AND everything outside its box (the
  // ungrouped nodes here; the other boxes are already in `boxes`), because nothing
  // confines it to the box and a nudged parallel channel can leave it. An
  // inter-group edge sees grouped members only through their box.
  const nodes = sameGroup
    ? others.filter(
        (n) => n.domainGroup === source.domainGroup || n.domainGroup === undefined,
      )
    : others.filter((n) => n.domainGroup === undefined);
  return [...boxes, ...nodes.map((n) => n.rect)];
}

/**
 * Just the routes. `routeWithLibavoid` also reports the tiers it REFUSED (see the
 * over-cap suite at the bottom), which almost every test here is uninterested in.
 */
const routedMap = async (input: Parameters<typeof routeWithLibavoid>[0]) =>
  (await routeWithLibavoid(input)).routes;

/** Routes as a plain object with sorted keys, so comparisons ignore Map order. */
const snapshot = (routes: Map<string, Point[]>): Record<string, Point[]> =>
  Object.fromEntries([...routes].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

describe('routeWithLibavoid — determinism', () => {
  it('gives identical routes for the same input twice', async () => {
    const board = eCommerceBoard();
    expect(snapshot(await routedMap(board))).toEqual(snapshot(await routedMap(board)));
  });

  /**
   * The adoption gate: libavoid is deterministic per INSERTION order but
   * order-SENSITIVE, so the adapter derives its insertion order from ids rather
   * than trusting the caller's arrays (the model's array order shifts when an
   * element is added). These are the regression guard on that sort — fixed
   * permutations, never `Math.random`, so a failure is reproducible.
   *
   * `parallelChannelBoard` is the fixture that gives this test teeth. Measured:
   * with the sort removed, it produces 3 distinct results over 12 random
   * connection shuffles, while the real E-Commerce board produces 1 — the plan's
   * "3 of 8 routes moved" was measured on a single-pass router with shape-pin
   * endpoints, and does not reproduce in this two-tier/point-endpoint adapter.
   */
  const permutations: { name: string; apply: <T>(items: T[]) => T[] }[] = [
    { name: 'reversed', apply: (items) => [...items].reverse() },
    { name: 'rotated by three', apply: (items) => [...items.slice(3), ...items.slice(0, 3)] },
    {
      name: 'evens before odds',
      apply: (items) => [
        ...items.filter((_, i) => i % 2 === 0),
        ...items.filter((_, i) => i % 2 === 1),
      ],
    },
  ];
  const boards: { name: string; build: () => RouterInput }[] = [
    { name: 'four edges competing for one channel', build: parallelChannelBoard },
    { name: 'the real E-Commerce landscape', build: eCommerceBoard },
  ];

  for (const { name: boardName, build } of boards) {
    for (const { name, apply } of permutations) {
      it(`routes ${boardName} the same with its arrays ${name}`, async () => {
        const board = build();
        const expected = snapshot(await routedMap(board));

        // Each array on its own, then all three together: any one of them leaking
        // into insertion order would show up here.
        const shuffles: RouterInput[] = [
          { ...board, nodes: apply(board.nodes) },
          { ...board, connections: apply(board.connections) },
          { ...board, groups: apply(board.groups) },
          {
            nodes: apply(board.nodes),
            connections: apply(board.connections),
            groups: apply(board.groups),
          },
        ];
        for (const shuffled of shuffles) {
          expect(snapshot(await routedMap(shuffled))).toEqual(expected);
        }
      });
    }
  }

  /**
   * Named for what it actually checks: routing the same board 40 times keeps giving
   * the same answer, so no state accumulates across passes in a way that changes
   * geometry. It is NOT a leak detector and must not be read as one — verified by
   * deleting every `avoid.destroy` call, which leaves it green. The C++ side really
   * is freed correctly (4000 runs, flat WASM heap, a `_malloc(8)` probe returning the
   * identical address every time), but that evidence lives in the spike, not here.
   */
  it('keeps routing identically over many runs', async () => {
    const board = eCommerceBoard();
    const expected = snapshot(await routedMap(board));
    for (let run = 0; run < 40; run++) {
      expect(snapshot(await routedMap(board))).toEqual(expected);
    }
  });
});

describe('routeWithLibavoid — clearance', () => {
  it('clears every genuine obstacle on the real board', async () => {
    const board = eCommerceBoard();
    const routes = await routedMap(board);
    expect(routes.size).toBe(board.connections.length);

    for (const connection of board.connections) {
      const drawn = drawnPath(board, connection, routes.get(connection.id)!);
      expect(
        pathHitsObstacles(drawn, genuineObstacles(board, connection), ROUTE_CLEARANCE),
        `${connection.id} does not clear its obstacles`,
      ).toBe(0);
    }
  });

  it('keeps marketplace→order clear of the Customer Experience box', async () => {
    // The originally-reported bug, on the real board: the straight run cuts through
    // a group box neither endpoint belongs to.
    const board = eCommerceBoard();
    const connection = board.connections.find((c) => c.id === 'marketplace-order')!;
    const cx = groupRect(board, 'Customer Experience');
    expect(pathHitsObstacles(drawnPath(board, connection, []), [cx], ROUTE_CLEARANCE)).toBeGreaterThan(0);

    const waypoints = (await routedMap(board)).get('marketplace-order')!;
    expect(waypoints.length).toBeGreaterThan(0);
    expect(pathHitsObstacles(drawnPath(board, connection, waypoints), [cx], ROUTE_CLEARANCE)).toBe(0);
    // It runs BELOW the box rather than grazing its edge (the old single-pass
    // attempt cleared it by 0.00000012 px).
    expect(waypoints[0].y).toBeGreaterThan(cx.y + cx.height + ROUTE_CLEARANCE - 1);
  });

  it('bends an edge around a node parked on the straight run', async () => {
    const board: RouterInput = {
      nodes: [node('a', card(100, 400)), node('b', card(1200, 400)), node('c', actor(650, 440))],
      groups: [],
      connections: [{ id: 'a-b', sourceId: 'a', targetId: 'b' }],
    };
    const routes = await routedMap(board);
    const waypoints = routes.get('a-b')!;
    expect(waypoints.length).toBeGreaterThan(0);

    const blocker = nodeOf(board, 'c').rect;
    // Sanity: straight really is blocked, so the assertion below has teeth.
    expect(pathHitsObstacles(drawnPath(board, board.connections[0], []), [blocker], ROUTE_CLEARANCE))
      .toBeGreaterThan(0);
    expect(pathHitsObstacles(drawnPath(board, board.connections[0], waypoints), [blocker], ROUTE_CLEARANCE))
      .toBe(0);
  });

  it('leaves a clear edge straight — an empty waypoint list', async () => {
    const board: RouterInput = {
      nodes: [node('a', card(100, 400)), node('b', card(1200, 400))],
      groups: [],
      connections: [{ id: 'a-b', sourceId: 'a', targetId: 'b' }],
    };
    expect((await routedMap(board)).get('a-b')).toEqual([]);
  });
});

describe('routeWithLibavoid — every drawn segment is axis-aligned', () => {
  it('draws the reported ERP → Dynamics tail square, not diagonal', async () => {
    // The reported defect, from the real board: the route leaves ERP downwards and
    // comes into Dynamics horizontally at a y that nudging moved 42 px off the
    // card's centre line. Attaching at the side MIDPOINT turned that last leg into
    // a diagonal; attaching where the leg arrives does not.
    const board = reportedLandscape();
    const connection = board.connections.find((c) => c.id === '7')!;
    const waypoints = (await routedMap(board)).get('7')!;
    const dynamics = nodeOf(board, '8').rect;
    // The premise: the approach really is off the centre line, so this has teeth.
    const approach = waypoints[waypoints.length - 1].y;
    expect(approach).not.toBeCloseTo(rectCentre(dynamics).y, 1);
    expect(approach).toBeGreaterThan(dynamics.y);
    expect(approach).toBeLessThan(dynamics.y + dynamics.height);

    const drawn = drawnPath(board, connection, waypoints);
    expect(diagonalSegments(drawn)).toEqual([]);
    // And it meets the card on that line, so the tail is one horizontal leg.
    expect(drawn[drawn.length - 1]).toEqual({ x: dynamics.x, y: approach });
  });

  it('meets the SOURCE where its nudged first leg leaves, not the side midpoint', async () => {
    // The defect is symmetric and this is the half the real board does NOT show:
    // nudging moves the FIRST polyline point off the source centre exactly as it
    // moves the last off the target centre, and the first point is stripped too.
    // Four edges competing for one channel is the board that nudges both ends.
    const board = parallelChannelBoard();
    const routes = await routedMap(board);
    // Exercised = the old midpoint anchor shares NEITHER coordinate with the first
    // waypoint, i.e. the source leg really was diagonal before this fix. Selecting
    // by that rather than by edge id keeps the test from passing incidentally.
    const exercised = board.connections.filter((connection) => {
      const waypoints = routes.get(connection.id)!;
      if (waypoints.length === 0) return false;
      const midpoint = closestSideToPoint(nodeOf(board, connection.sourceId).rect, waypoints[0]);
      return diagonalSegments([midpoint, waypoints[0]]).length > 0;
    });
    expect(exercised.length).toBeGreaterThan(0);

    for (const connection of exercised) {
      const waypoints = routes.get(connection.id)!;
      const drawn = drawnPath(board, connection, waypoints);
      expect(diagonalSegments([drawn[0], waypoints[0]]), `${connection.id} source leg`).toEqual([]);
      // It moved ALONG its side: same side as before, a different point on it, and
      // still on the rect's boundary.
      const source = nodeOf(board, connection.sourceId).rect;
      const midpoint = closestSideToPoint(source, waypoints[0]);
      expect(routeEndAnchor(source, waypoints[0]).position).toBe(midpoint.position);
      expect([drawn[0].x, drawn[0].y]).not.toEqual([midpoint.x, midpoint.y]);
      expect(pathClearance([drawn[0], drawn[0]], [source])).toBe(0); // touching the rect
    }
  });

  const boards: { name: string; build: () => RouterInput }[] = [
    { name: 'the reported layer-7 landscape', build: reportedLandscape },
    { name: 'the real E-Commerce landscape', build: eCommerceBoard },
    { name: 'four edges competing for one channel', build: parallelChannelBoard },
  ];
  for (const { name, build } of boards) {
    it(`draws every routed edge of ${name} with axis-aligned segments only`, async () => {
      const board = build();
      const routes = await routedMap(board);
      // WAYPOINTED edges only: an empty route is drawn by `getSmoothStepPath`,
      // which is orthogonal by construction, and `routedPath` models it as the
      // two anchors joined directly — a straight line that is diagonal on purpose.
      const routed = board.connections.filter((c) => routes.get(c.id)!.length > 0);
      expect(routed.length).toBeGreaterThan(0);
      for (const connection of routed) {
        expect(
          diagonalSegments(drawnPath(board, connection, routes.get(connection.id)!)),
          `${connection.id} has a diagonal segment`,
        ).toEqual([]);
      }
    });
  }
});

describe('routeWithLibavoid — nudging', () => {
  it('separates four parallel edges past one blocker into four distinct channels', async () => {
    // Without nudging all four would share one channel and draw on top of each other.
    const board = parallelChannelBoard();
    const routes = await routedMap(board);
    // Each edge steps out to a horizontal channel, runs past the blocker in it and
    // steps back: two waypoints sharing one y.
    const channels = board.connections.map((connection) => {
      const waypoints = routes.get(connection.id)!;
      expect(waypoints).toHaveLength(2);
      expect(waypoints[0].y).toBeCloseTo(waypoints[1].y, 6);
      return waypoints[0].y;
    });

    expect(new Set(channels)).toHaveLength(4);
    // …and they are separated enough for a label chip, not merely unequal.
    const sorted = [...channels].sort((a, b) => a - b);
    for (let i = 0; i + 1 < sorted.length; i++) {
      expect(sorted[i + 1] - sorted[i]).toBeGreaterThanOrEqual(IDEAL_NUDGING_DISTANCE - 1);
    }
  });
});

describe('routeWithLibavoid — the two tiers', () => {
  /**
   * Three groups in a row. `a` lives in the left one, `b` in the right one, and
   * the middle group sits squarely on the straight run with two members of its own.
   */
  function threeGroupBoard(): RouterInput {
    return {
      nodes: [
        node('a', card(100, 430), 'Left'),
        node('b', card(1200, 430), 'Right'),
        node('m1', card(600, 430), 'Middle'),
        node('m2', card(600, 620), 'Middle'),
        node('m3', card(600, 810), 'Middle'),
      ],
      groups: [
        { name: 'Left', x: 60, y: 390, width: 280, height: 210 },
        { name: 'Right', x: 1160, y: 390, width: 280, height: 210 },
        { name: 'Middle', x: 560, y: 390, width: 280, height: 590 },
      ],
      connections: [
        { id: 'a-b', sourceId: 'a', targetId: 'b' },
        { id: 'm1-m3', sourceId: 'm1', targetId: 'm3' },
      ],
    };
  }

  it('routes an inter-group edge clear of a third group’s box', async () => {
    const board = threeGroupBoard();
    const connection = board.connections[0];
    const middle = groupRect(board, 'Middle');
    // Sanity: the straight line really does cut the middle box.
    expect(pathHitsObstacles(drawnPath(board, connection, []), [middle], ROUTE_CLEARANCE)).toBeGreaterThan(0);

    const waypoints = (await routedMap(board)).get('a-b')!;
    expect(waypoints.length).toBeGreaterThan(0);
    expect(pathHitsObstacles(drawnPath(board, connection, waypoints), [middle], ROUTE_CLEARANCE)).toBe(0);
  });

  it('routes an intra-group edge clear of its siblings', async () => {
    const board = threeGroupBoard();
    const connection = board.connections[1];
    const sibling = nodeOf(board, 'm2').rect;
    expect(pathHitsObstacles(drawnPath(board, connection, []), [sibling], ROUTE_CLEARANCE)).toBeGreaterThan(0);

    const waypoints = (await routedMap(board)).get('m1-m3')!;
    expect(waypoints.length).toBeGreaterThan(0);
    expect(pathHitsObstacles(drawnPath(board, connection, waypoints), [sibling], ROUTE_CLEARANCE)).toBe(0);
  });

  /**
   * A group whose middle member spans nearly the full inner width, so the only way
   * from `m1` to `m2` is out past one side of the box. `outsider` is an ungrouped
   * card parked against the left side, and the left channel is the narrower one, so
   * a tier that could only see the group's own members would route straight through
   * it. Nothing confines an intra-group route to its box, which is why the tier has
   * to be given what lies beyond it.
   */
  function narrowGroupBoard(): RouterInput {
    return {
      nodes: [
        node('m1', card(100, 40), 'A'),
        node('m3', { x: 20, y: 235, width: 360, height: 130 }, 'A'),
        node('m2', card(100, 430), 'A'),
        node('outsider', { x: -140, y: 180, width: 140, height: 240 }),
      ],
      groups: [{ name: 'A', x: 0, y: 0, width: 400, height: 600 }],
      connections: [{ id: 'm1-m2', sourceId: 'm1', targetId: 'm2' }],
    };
  }

  it('routes an intra-group edge clear of an ungrouped node just outside the box', async () => {
    const board = narrowGroupBoard();
    const outsider = nodeOf(board, 'outsider').rect;

    const waypoints = (await routedMap(board)).get('m1-m2')!;
    const drawn = drawnPath(board, board.connections[0], waypoints);
    // It really did have to leave the box; the point is WHICH way it left.
    expect(waypoints.length).toBeGreaterThan(0);
    expect(pathHitsObstacles(drawn, [outsider], ROUTE_CLEARANCE)).toBe(0);
  });

  it('routes an intra-group edge clear of a NEIGHBOURING group’s box', async () => {
    const board = narrowGroupBoard();
    // Same geometry, but the thing beside the box is another group rather than a
    // loose card. Tier 2 sees it as one opaque rect, exactly as tier 1 would.
    board.nodes = board.nodes.filter((n) => n.id !== 'outsider');
    board.nodes.push(node('n1', { x: -120, y: 220, width: 100, height: 160 }, 'B'));
    board.groups.push({ name: 'B', x: -140, y: 180, width: 140, height: 240 });
    const neighbour = groupRect(board, 'B');

    const waypoints = (await routedMap(board)).get('m1-m2')!;
    expect(waypoints.length).toBeGreaterThan(0);
    expect(
      pathHitsObstacles(drawnPath(board, board.connections[0], waypoints), [neighbour], ROUTE_CLEARANCE),
    ).toBe(0);
  });

  it('does not treat a group box CONTAINING an endpoint as that edge’s obstacle', async () => {
    // `a`'s own box straddles the straight run to `b`, but bowing around it would
    // be absurd — the edge starts inside it.
    const board: RouterInput = {
      nodes: [node('a', card(100, 400), 'Home'), node('b', card(1200, 400))],
      groups: [{ name: 'Home', x: 60, y: 360, width: 300, height: 220 }],
      connections: [{ id: 'a-b', sourceId: 'a', targetId: 'b' }],
    };
    expect((await routedMap(board)).get('a-b')).toEqual([]);
  });

  it('treats a node whose domain group has no box on the diagram as its own obstacle', async () => {
    // Tier 1 hides grouped members behind their box; a `domainGroup` with no box
    // has nothing to hide behind, so the member must still block on its own.
    const board: RouterInput = {
      nodes: [node('a', card(100, 400)), node('b', card(1200, 400)), node('ghost', actor(650, 440), 'Nowhere')],
      groups: [],
      connections: [{ id: 'a-b', sourceId: 'a', targetId: 'b' }],
    };
    const waypoints = (await routedMap(board)).get('a-b')!;
    const ghost = nodeOf(board, 'ghost').rect;
    expect(pathHitsObstacles(drawnPath(board, board.connections[0], waypoints), [ghost], ROUTE_CLEARANCE)).toBe(0);
    expect(waypoints.length).toBeGreaterThan(0);
  });

  it('routes the inter-group edges of a group that has no internal edges', async () => {
    const board = threeGroupBoard();
    board.connections = [board.connections[0]]; // no group has an internal edge now
    const routes = await routedMap(board);
    expect(routes.size).toBe(1);
    expect(routes.get('a-b')!.length).toBeGreaterThan(0);
  });
});

describe('routeWithLibavoid — degenerate input', () => {
  it('returns an empty map for an empty board', async () => {
    expect(await routedMap({ nodes: [], groups: [], connections: [] })).toEqual(new Map());
  });

  it('returns an empty map when no connection is routable', async () => {
    const board: RouterInput = {
      nodes: [node('a', card(100, 400))],
      groups: [],
      connections: [{ id: 'a-gone', sourceId: 'a', targetId: 'gone' }],
    };
    expect(await routedMap(board)).toEqual(new Map());
  });

  /**
   * No entry, deliberately — an entry with an empty array would read as "routed,
   * and straight" and let the caller clear a stored route it cannot improve on.
   */
  it('omits a connection with an unknown endpoint and a self-connection, and routes the rest', async () => {
    const board: RouterInput = {
      nodes: [node('a', card(100, 400)), node('b', card(1200, 400))],
      groups: [],
      connections: [
        { id: 'a-b', sourceId: 'a', targetId: 'b' },
        { id: 'a-gone', sourceId: 'a', targetId: 'gone' },
        { id: 'gone-b', sourceId: 'gone', targetId: 'b' },
        { id: 'a-a', sourceId: 'a', targetId: 'a' },
      ],
    };
    const routes = await routedMap(board);
    expect([...routes.keys()]).toEqual(['a-b']);
  });
});

/**
 * These are not politeness checks. libavoid's C++ `assert`s become emscripten
 * `abort()`, and an abort kills the WASM instance for the whole page: every later
 * call throws "program has already aborted!", `AvoidLib.load()` refuses to
 * re-initialise, and there is no way to obtain a fresh instance. Measured directly.
 * So one NaN reaching the router would disable edge routing until the user reloads,
 * and these tests are what stop that from being reintroduced.
 *
 * `Infinity` is covered separately from `NaN` because it does NOT abort — it
 * survives and returns `Infinity` inside the route, which would be persisted into
 * the saved model as a waypoint. Silent data corruption rather than a crash.
 *
 * Each case asserts BOTH that we survive and that the good edge still routes, which
 * is what proves the module is still alive rather than merely that we threw early.
 */
describe('routeWithLibavoid — unsafe geometry never reaches the WASM module', () => {
  const unsafe: [string, Rect][] = [
    ['NaN x', { x: NaN, y: 400, width: 200, height: 130 }],
    ['NaN y', { x: 700, y: NaN, width: 200, height: 130 }],
    ['NaN width', { x: 700, y: 400, width: NaN, height: 130 }],
    ['NaN height', { x: 700, y: 400, width: 200, height: NaN }],
    ['Infinity x', { x: Infinity, y: 400, width: 200, height: 130 }],
    ['-Infinity y', { x: 700, y: -Infinity, width: 200, height: 130 }],
    ['1e308 overflow', { x: 1e308, y: 1e308, width: 200, height: 130 }],
  ];

  for (const [label, rect] of unsafe) {
    it(`drops a node with ${label} and still routes the rest`, async () => {
      const routes = await routedMap({
        nodes: [node('a', card(100, 400)), node('b', card(1200, 400)), node('bad', rect)],
        groups: [],
        connections: [
          { id: 'a-b', sourceId: 'a', targetId: 'b' },
          { id: 'a-bad', sourceId: 'a', targetId: 'bad' },
        ],
      });
      // The bad node is dropped whole, so its edge is unroutable and absent — the
      // caller then keeps whatever route it had stored (never-degrade).
      expect([...routes.keys()]).toEqual(['a-b']);
      // Still alive, and the surviving route is finite.
      for (const point of routes.get('a-b') ?? []) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      }
    });

    it(`drops a group box with ${label} and still routes the rest`, async () => {
      const routes = await routedMap({
        nodes: [node('a', card(100, 400)), node('b', card(1200, 400))],
        groups: [{ name: 'Bad', ...rect }],
        connections: [{ id: 'a-b', sourceId: 'a', targetId: 'b' }],
      });
      expect([...routes.keys()]).toEqual(['a-b']);
    });
  }

  it('keeps routing after an unsafe board, proving the module was never aborted', async () => {
    const board: RouterInput = {
      nodes: [node('a', card(100, 400)), node('b', card(1200, 400))],
      groups: [],
      connections: [{ id: 'a-b', sourceId: 'a', targetId: 'b' }],
    };
    const before = await routedMap(board);
    await routedMap({
      ...board,
      nodes: [...board.nodes, node('bad', { x: NaN, y: NaN, width: NaN, height: NaN })],
    });
    // Byte-identical to before: a real abort would make this throw instead.
    expect(await routedMap(board)).toEqual(before);
  });
});

/**
 * A rect fully covered by another rect makes its CONTAINER stop blocking — the same
 * failure the two tiers exist to prevent, reappearing inside one tier. Every case
 * below is reachable by dragging shapes on a real board, and every one of them
 * asserts the same thing: the container still blocks.
 *
 * These use an edge crossing the container well away from the contained rect, so
 * only the container can be doing the work — dodging the inner rect alone would land
 * the path inside the outer one, which is exactly the measured bug.
 */
describe('routeWithLibavoid — a contained obstacle must not blind its container', () => {
  /** Centred on (x, y) so the endpoint geometry reads directly. */
  const actorAt = (x: number, y: number): Rect => ({ x: x - 75, y: y - 24, width: 150, height: 48 });
  const box = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

  /** The blocker every case below reuses, and the edge that must clear it. */
  const outer = box(400, 300, 300, 400);
  const nested = box(480, 420, 100, 100);
  const endpoints = [node('a', actorAt(100, 500)), node('b', actorAt(1200, 500))];
  const edge: RouterConnection = { id: 'a-b', sourceId: 'a', targetId: 'b' };

  const clearsOuter = async (board: RouterInput): Promise<number> => {
    const waypoints = (await routedMap(board)).get('a-b')!;
    return pathHitsObstacles(drawnPath(board, edge, waypoints), [outer], ROUTE_CLEARANCE);
  };

  it('clears a group box that has another group box nested inside it', async () => {
    // 'Inner' sorts BEFORE 'Outer', so the container is not the earlier rect in the
    // obstacle list — a containment filter that only looks backwards misses this.
    const board: RouterInput = {
      nodes: endpoints,
      groups: [
        { name: 'Inner', ...nested },
        { name: 'Outer', ...outer },
      ],
      connections: [edge],
    };
    expect(await clearsOuter(board)).toBe(0);
  });

  it('clears a group box with a nested box that sorts after it', async () => {
    // The mirror image, so neither list order can be the thing that happens to work.
    const board: RouterInput = {
      nodes: endpoints,
      groups: [
        { name: 'Alpha', ...outer },
        { name: 'Zulu', ...nested },
      ],
      connections: [edge],
    };
    expect(await clearsOuter(board)).toBe(0);
  });

  it('clears an ungrouped node rect that fully contains a smaller node rect', async () => {
    // Two ungrouped shapes in tier 1: a card dragged over a chip.
    const board: RouterInput = {
      nodes: [...endpoints, node('big', outer), node('small', nested)],
      groups: [],
      connections: [edge],
    };
    expect(await clearsOuter(board)).toBe(0);
  });

  it('clears a group member that fully contains a sibling, inside tier 2', async () => {
    // Tier 2 has its own obstacle list and needs the same filtering.
    const board: RouterInput = {
      nodes: [
        node('m1', actorAt(100, 500), 'Team'),
        node('m2', actorAt(1200, 500), 'Team'),
        node('big', outer, 'Team'),
        node('small', nested, 'Team'),
      ],
      groups: [{ name: 'Team', x: 0, y: 250, width: 1300, height: 500 }],
      connections: [{ id: 'm1-m2', sourceId: 'm1', targetId: 'm2' }],
    };
    const waypoints = (await routedMap(board)).get('m1-m2')!;
    const drawn = routedPath(actorAt(100, 500), actorAt(1200, 500), waypoints);
    expect(pathHitsObstacles(drawn, [outer], ROUTE_CLEARANCE)).toBe(0);
  });

  it('still blocks when two obstacles are identical — one copy is kept, not both dropped', async () => {
    // The dangerous direction of the fix. Duplicates cover each other, so a filter
    // without a tie-break drops both and opens a hole where an obstacle was.
    const board: RouterInput = {
      nodes: [...endpoints, node('one', outer), node('two', outer)],
      groups: [],
      connections: [edge],
    };
    expect(await clearsOuter(board)).toBe(0);
  });

  it('leaves a partly overlapping pair alone — both keep blocking', async () => {
    // Containment is the only trigger; partial overlaps were swept and all block.
    // Here the second rect hangs out of the first, so neither may be dropped, and
    // the union of the two is what the edge has to clear.
    const overhang = box(650, 600, 300, 200);
    const board: RouterInput = {
      nodes: [...endpoints, node('big', outer), node('over', overhang)],
      groups: [],
      connections: [edge],
    };
    const waypoints = (await routedMap(board)).get('a-b')!;
    const drawn = drawnPath(board, edge, waypoints);
    expect(pathHitsObstacles(drawn, [outer], ROUTE_CLEARANCE)).toBe(0);
    expect(pathHitsObstacles(drawn, [overhang], ROUTE_CLEARANCE)).toBe(0);
  });
});

/**
 * `processTransaction()` is synchronous WASM with no timeout, no cancellation and
 * no progress, so an expensive board is a frozen tab rather than a slow spinner.
 * The cap trades away the routing of some crowded boards to make that impossible.
 * See {@link MAX_CONNECTORS_PER_TIER} for the measurements it rests on.
 */
describe('routeWithLibavoid — the per-tier connector cap', () => {
  /**
   * `count` edges on their own rows, 300 px apart, with nothing between any pair:
   * cheap for libavoid (measured: 150 connectors in 8 ms) yet still counted by the
   * cap, which is exactly the crudeness the cap admits to. Ids are zero-padded so
   * the adapter's id sort is this build order.
   */
  function spreadOutBoard(count: number): RouterInput {
    const nodes: RouterInput['nodes'] = [];
    const connections: RouterConnection[] = [];
    for (let i = 0; i < count; i++) {
      const key = String(i).padStart(4, '0');
      nodes.push(node(`s${key}`, actor(0, i * 300)), node(`t${key}`, actor(600, i * 300)));
      connections.push({ id: `e${key}`, sourceId: `s${key}`, targetId: `t${key}` });
    }
    return { nodes, groups: [], connections };
  }

  /** `parallelChannelBoard` scaled up: every edge crosses ONE tall blocker, so all
   *  of them compete for the channels beside it. libavoid's worst case — 200 of
   *  these took 18.6 s, 300 took 91 s. */
  function competingBoard(count: number): RouterInput {
    const nodes = [node('blocker', { x: 450, y: 200, width: 120, height: count * 80 + 200 })];
    const connections: RouterConnection[] = [];
    for (let i = 0; i < count; i++) {
      const key = String(i).padStart(4, '0');
      nodes.push(node(`s${key}`, actor(0, 300 + i * 80)), node(`t${key}`, actor(1000, 300 + i * 80)));
      connections.push({ id: `e${key}`, sourceId: `s${key}`, targetId: `t${key}` });
    }
    return { nodes, groups: [], connections };
  }

  it('routes a tier sitting exactly on the cap', async () => {
    const routes = await routedMap(spreadOutBoard(MAX_CONNECTORS_PER_TIER));
    expect(routes.size).toBe(MAX_CONNECTORS_PER_TIER);
  });

  it('skips a tier one connector over the cap, leaving every route stored', async () => {
    // Not "routes them badly" and not "routes the first 150" — absent, so the
    // caller keeps what it had. One over, so the boundary is the thing being read.
    expect(await routedMap(spreadOutBoard(MAX_CONNECTORS_PER_TIER + 1))).toEqual(new Map());
  });

  it('returns promptly on an over-cap board that would take minutes to route', async () => {
    // The whole point of the cap. Without it this board freezes the main thread for
    // ~19 s (and a 300-edge one for ~91 s), which no timeout can interrupt.
    const started = performance.now();
    expect(await routedMap(competingBoard(200))).toEqual(new Map());
    expect(performance.now() - started).toBeLessThan(1000);
  }, 5000);

  it('still routes a group’s internal edges when tier 1 is over the cap', async () => {
    // Per-tier, not per-board: a crowded inter-group tier must not cost the groups
    // their own internal routing.
    const board = spreadOutBoard(MAX_CONNECTORS_PER_TIER + 1);
    board.nodes.push(
      node('m1', card(2000, 0), 'Middle'),
      node('m2', card(2000, 190), 'Middle'),
      node('m3', card(2000, 380), 'Middle'),
    );
    board.groups.push({ name: 'Middle', x: 1960, y: -40, width: 280, height: 590 });
    board.connections.push({ id: 'm1-m3', sourceId: 'm1', targetId: 'm3' });

    const routes = await routedMap(board);
    expect([...routes.keys()]).toEqual(['m1-m3']);
    expect(routes.get('m1-m3')!.length).toBeGreaterThan(0);
  });

  /**
   * The half that used to be invisible. An over-cap tier is dropped whole and its
   * connections come back absent — which is byte-identical to "nothing needed
   * routing". Measured on a 120-app board: 0 of 200 connections routed, in 0.3 ms,
   * reported as success. Declining is legitimate; reporting it as success is not.
   */
  it('reports the tier it refused, and which connections were in it', async () => {
    const over = MAX_CONNECTORS_PER_TIER + 1;
    const { routes, skipped } = await routeWithLibavoid(spreadOutBoard(over));

    expect(routes.size).toBe(0);
    const tier = skipped[0];
    expect(skipped).toHaveLength(1);
    expect(tier.connectorCount).toBe(over);
    // The ids matter: a caller that wants to name the affected edges can.
    expect(tier.connectionIds).toHaveLength(over);
    expect(new Set(tier.connectionIds).size).toBe(over);
  });

  it('reports nothing when every tier fits, so silence stays meaningful', async () => {
    const { routes, skipped } = await routeWithLibavoid(
      spreadOutBoard(MAX_CONNECTORS_PER_TIER),
    );
    expect(routes.size).toBe(MAX_CONNECTORS_PER_TIER);
    expect(skipped).toEqual([]);
  });

  it('reports the refused tier while still routing the ones that fit', async () => {
    // The per-tier rule, seen from the reporting side: a partial answer must say
    // it is partial rather than presenting its successes as the whole board.
    const board = spreadOutBoard(MAX_CONNECTORS_PER_TIER + 1);
    board.nodes.push(
      node('m1', card(2000, 0), 'Middle'),
      node('m2', card(2000, 190), 'Middle'),
      node('m3', card(2000, 380), 'Middle'),
    );
    board.groups.push({ name: 'Middle', x: 1960, y: -40, width: 280, height: 590 });
    board.connections.push({ id: 'm1-m3', sourceId: 'm1', targetId: 'm3' });

    const { routes, skipped } = await routeWithLibavoid(board);
    expect([...routes.keys()]).toEqual(['m1-m3']);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].connectorCount).toBe(MAX_CONNECTORS_PER_TIER + 1);
  });

  it('reports nothing for a board with nothing to route', async () => {
    // The genuine no-op, which must stay distinguishable from a refusal.
    const { routes, skipped } = await routeWithLibavoid({
      nodes: [],
      groups: [],
      connections: [],
    });
    expect(routes.size).toBe(0);
    expect(skipped).toEqual([]);
  });
});

/**
 * The failure paths that the real module cannot demonstrate in-process: an abort
 * kills the WASM instance for the rest of the worker, and a non-finite route is
 * unreachable once `isSafeRect` filters the input. Both are reached here through a
 * stand-in for libavoid-js, loaded into a private copy of the adapter so the
 * poisoned flag does not leak into the tests above.
 */
describe('routeWithLibavoid — when the WASM module misbehaves', () => {
  interface FakeConfig {
    /** Polyline the i-th connector created reports, as [x, y] pairs. */
    route?: (index: number) => [number, number][];
    /** Value `processTransaction` throws — a raw string, the way an abort does. */
    failTransaction?: unknown;
    /** Value `destroy(router)` throws — which is what really happens after an abort. */
    failRouterDestroy?: unknown;
    /** Drop a constructor from the API, the way a libavoid-js version bump would. */
    omit?: 'Rectangle' | 'ConnEnd' | 'ConnRef';
  }

  function fakeAvoid(config: FakeConfig = {}) {
    /** Counted so a test can prove whether the module was re-entered. */
    const calls = { transactions: 0, routers: 0 };
    const routeAt =
      config.route ??
      ((): [number, number][] => [
        [0, 0],
        [50, 0],
        [50, 50],
        [100, 50],
      ]);
    let connectors = 0;

    class Router {
      constructor() {
        calls.routers++;
      }
      setRoutingParameter(): void {}
      setRoutingOption(): void {}
      processTransaction(): void {
        calls.transactions++;
        if (config.failTransaction !== undefined) throw config.failTransaction;
      }
    }
    class FakePoint {
      constructor(
        readonly x: number,
        readonly y: number,
      ) {}
    }
    /** Rectangle, ShapeRef and ConnEnd are opaque handles to the adapter. */
    class Handle {}
    class ConnRef {
      private readonly index = connectors++;
      displayRoute() {
        const points = routeAt(this.index).map(([x, y]) => ({ x, y }));
        return { size: () => points.length, get_ps: (i: number) => points[i] };
      }
    }

    const api = {
      OrthogonalRouting: 0,
      shapeBufferDistance: 1,
      idealNudgingDistance: 2,
      nudgeOrthogonalSegmentsConnectedToShapes: 3,
      nudgeSharedPathsWithCommonEndPoint: 4,
      performUnifyingNudgingPreprocessingStep: 5,
      Router,
      Point: FakePoint,
      Rectangle: Handle,
      ShapeRef: Handle,
      ConnEnd: Handle,
      ConnRef,
      destroy(obj: object): void {
        if (obj instanceof Router && config.failRouterDestroy !== undefined) {
          throw config.failRouterDestroy;
        }
      },
    };
    if (config.omit !== undefined) delete (api as Partial<typeof api>)[config.omit];
    return {
      calls,
      module: { AvoidLib: { load: () => Promise.resolve(), getInstance: () => api } },
    };
  }

  /** A private copy of the adapter — its own poisoned flag, its own load cache. */
  async function adapterOver(fake: ReturnType<typeof fakeAvoid>) {
    vi.resetModules();
    vi.doMock('libavoid-js', () => fake.module);
    return import('./libavoidRouter');
  }

  afterEach(() => {
    vi.doUnmock('libavoid-js');
    vi.resetModules();
  });

  const oneEdge: RouterInput = {
    nodes: [node('a', card(100, 400)), node('b', card(1200, 400))],
    groups: [],
    connections: [{ id: 'a-b', sourceId: 'a', targetId: 'b' }],
  };
  const twoEdges: RouterInput = {
    nodes: [node('a', card(100, 400)), node('b', card(1200, 400)), node('c', card(1200, 700))],
    groups: [],
    connections: [
      { id: 'a-b', sourceId: 'a', targetId: 'b' },
      { id: 'a-c', sourceId: 'a', targetId: 'c' },
    ],
  };

  it('omits a route with a non-finite interior point, and keeps its neighbour', async () => {
    // Not a repaired route with the bad point removed: a polyline with a hole in it
    // would be drawn as a plausible path and then saved.
    const fake = fakeAvoid({
      route: (i) =>
        i === 0
          ? [
              [0, 0],
              [Infinity, 0],
              [100, 50],
            ]
          : [
              [0, 0],
              [50, 0],
              [100, 50],
            ],
    });
    const { routeWithLibavoid: route } = await adapterOver(fake);
    expect([...(await route(twoEdges)).routes.keys()]).toEqual(['a-c']);
  });

  it('omits a route whose ENDPOINT is Infinity instead of calling it straight', async () => {
    // The measured shape is [[Infinity, 120], [400, 120]] — its interior is empty,
    // so stripping the endpoints without checking them yields `[]`, which reads as
    // "routed, and straight" and lets the caller clear a perfectly good route.
    const fake = fakeAvoid({
      route: () => [
        [Infinity, 120],
        [400, 120],
      ],
    });
    const { routeWithLibavoid: route } = await adapterOver(fake);
    expect((await route(oneEdge)).routes).toEqual(new Map());
  });

  it.each([
    ['an empty polyline', [] as [number, number][]],
    ['a single-point polyline', [[120, 120]] as [number, number][]],
  ])('omits a route from %s rather than calling it straight', async (_name, route) => {
    // Same trap as the Infinity endpoint above: too few points to have an interior,
    // so stripping the endpoints yields `[]`, which reads as "routed, and straight".
    // Under Tidy's 'clear' policy that answer throws away the stored route.
    const fake = fakeAvoid({ route: () => route });
    const { routeWithLibavoid: routeIt } = await adapterOver(fake);
    expect((await routeIt(oneEdge)).routes).toEqual(new Map());
  });

  it('rejects with an actionable error once a tier throws, and never re-enters the module', async () => {
    const fake = fakeAvoid({ failTransaction: 'program has already aborted!' });
    const { routeWithLibavoid: route } = await adapterOver(fake);

    const first = (await route(oneEdge).catch((error: unknown) => error)) as Error;
    expect(first).toBeInstanceOf(Error);
    expect(first.message).toMatch(/reload the page/i);
    // The abort throws a raw STRING; normalising it is what keeps this readable
    // instead of "undefined" for anything downstream reading `.message`.
    expect(first.message).toContain('program has already aborted!');
    expect(first.cause).toBe('program has already aborted!');
    expect(fake.calls.transactions).toBe(1);

    const second = (await route(oneEdge).catch((error: unknown) => error)) as Error;
    expect(second.message).toMatch(/reload the page/i);
    // Still 1: the corpse was never touched again. That is the flag's whole job.
    expect(fake.calls.transactions).toBe(1);
  });

  it('reports the routing failure, not the failure to free the router afterwards', async () => {
    const fake = fakeAvoid({
      failTransaction: 'program has already aborted!',
      failRouterDestroy: new Error('Cannot destroy: module is gone'),
    });
    const { routeWithLibavoid: route } = await adapterOver(fake);
    const error = (await route(oneEdge).catch((e: unknown) => e)) as Error;
    expect(error.message).toContain('program has already aborted!');
    expect(error.message).not.toContain('Cannot destroy');
  });

  it('poisons on an Aborted(...) Error as well as on the raw string', async () => {
    // Belt and braces for a build that throws emscripten's descriptive text rather
    // than logging it. Not reachable in libavoid-js 0.4.5 under node — both abort
    // paths there throw the bare string — so this pins the intent of the second
    // branch of the gate, not an observed environment.
    const fake = fakeAvoid({
      failTransaction: new Error(
        'Aborted(Assertion failed: begin < finish, at: ./adaptagrams/cola/libavoid/orthogonal.cpp,665,LineSegment)',
      ),
    });
    const { routeWithLibavoid: route } = await adapterOver(fake);
    await expect(route(oneEdge)).rejects.toThrow(/reload the page/i);
    await expect(route(oneEdge)).rejects.toThrow(/reload the page/i);
    expect(fake.calls.transactions).toBe(1);
  });

  /**
   * The other half of the latch, and the half that is easy to get wrong: only an
   * actual abort is terminal. Latching on any thrown value costs the session its
   * edge routing and blames a crash that never happened.
   */
  it('propagates a version-bump failure as itself, and does not poison the session', async () => {
    // What a libavoid-js major bump looks like from here: a constructor is gone.
    // Nothing reached libavoid's router, so the module is entirely healthy.
    const fake = fakeAvoid({ omit: 'Rectangle' });
    const { routeWithLibavoid: route } = await adapterOver(fake);

    const first = (await route(oneEdge).catch((e: unknown) => e)) as Error;
    expect(first).toBeInstanceOf(TypeError);
    expect(first.message).not.toMatch(/reload the page/i);
    expect(fake.calls.routers).toBe(1);

    // Re-entered rather than short-circuited: same honest TypeError, second router.
    const second = (await route(oneEdge).catch((e: unknown) => e)) as Error;
    expect(second).toBeInstanceOf(TypeError);
    expect(second.message).not.toMatch(/reload the page/i);
    expect(fake.calls.routers).toBe(2);
  });

  it('surfaces a failed router free without poisoning, when the route had succeeded', async () => {
    // Two things at once: a leak after a successful route is a real defect and must
    // be heard (not swallowed), AND the module is fine, so the session must survive.
    const fake = fakeAvoid({ failRouterDestroy: 'router was already freed' });
    const { routeWithLibavoid: route } = await adapterOver(fake);

    // Rethrown exactly as libavoid-js threw it — not wrapped, not relabelled.
    await expect(route(oneEdge)).rejects.toBe('router was already freed');
    expect(fake.calls.transactions).toBe(1);
    await expect(route(oneEdge)).rejects.toBe('router was already freed');
    expect(fake.calls.transactions).toBe(2);
  });
});

/**
 * libavoid emits accumulated float noise. Against 16 px of clearance those digits
 * mean nothing, but they get persisted, bloat the stored JSON, and make any
 * value-based dirty check see a change on every re-route — which drives autosave.
 *
 * `parallelChannelBoard` is the fixture with teeth here, and it had to be measured
 * rather than assumed: nudging is what accumulates the error, so the four competing
 * edges emit values like `202.00000031999997` and `697.9999996800001`, while the
 * real E-Commerce board lands on exact integers and would pass either way.
 */
describe('routeWithLibavoid — stored precision', () => {
  it('rounds every emitted waypoint to two decimals', async () => {
    const values = [...(await routedMap(parallelChannelBoard())).values()]
      .flat()
      .flatMap((point) => [point.x, point.y]);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value, `${value} carries more than two decimals`).toBe(Math.round(value * 100) / 100);
    }
  });

  it('keeps the rounded routes clear of the blocker they were nudged around', async () => {
    // Rounding moves a point by at most 0.005 px against 16 px of clearance, but
    // asserting it on the board that actually gets rounded costs nothing.
    const board = parallelChannelBoard();
    const routes = await routedMap(board);
    const blocker = nodeOf(board, 'blocker').rect;
    for (const connection of board.connections) {
      expect(
        pathHitsObstacles(
          drawnPath(board, connection, routes.get(connection.id)!),
          [blocker],
          ROUTE_CLEARANCE,
        ),
        `${connection.id} does not clear the blocker`,
      ).toBe(0);
    }
  });
});
