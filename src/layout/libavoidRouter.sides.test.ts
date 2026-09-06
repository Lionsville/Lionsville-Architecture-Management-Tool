import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Point, Rect } from '../model/types';
import { drawnPolyline } from '../model/routes';
import { diagonalSegments } from './routeTestSupport';
import { routeWithLibavoid, type RouterInput } from './libavoidRouter';

/**
 * Attach sides through the router (Phase 2d): a `sourceSide` / `targetSide` on a
 * connection becomes a libavoid shape pin, so the line leaves the node out of that
 * side as a hard constraint. The fixture is the one `docs/spike-libavoid-sides.md`
 * verified the binding on — two 100×100 squares on one row — so the numbers here
 * are the numbers the spike printed.
 */

const A: Rect = { x: 100, y: 100, width: 100, height: 100 };
const B: Rect = { x: 400, y: 100, width: 100, height: 100 };

function board(connection: Partial<RouterInput['connections'][number]> = {}): RouterInput {
  return {
    nodes: [
      { id: 'a', rect: A },
      { id: 'b', rect: B },
    ],
    groups: [],
    connections: [{ id: 'a-b', sourceId: 'a', targetId: 'b', ...connection }],
  };
}

const routeOf = async (input: RouterInput, id = 'a-b'): Promise<Point[]> => {
  const route = (await routeWithLibavoid(input)).routes.get(id);
  if (!route) throw new Error(`no route for ${id}`);
  return route;
};

describe('routeWithLibavoid — pinned ends leave from the requested side', () => {
  it('A.right → B.top: out of the right side, in through the top, endpoints kept', async () => {
    const route = await routeOf(board({ sourceSide: 'right', targetSide: 'top' }));
    // The spike's polyline: (200,150) → (300,150) → (300,84) → (450,84) → (450,100).
    expect(route[0]).toEqual({ x: 200, y: 150 }); // A's right-side midpoint IS the first waypoint
    expect(route[1].y).toBe(150);
    expect(route[1].x).toBeGreaterThan(200); // leaves rightward
    expect(route[route.length - 1]).toEqual({ x: 450, y: 100 }); // B's top midpoint
    const beforeLast = route[route.length - 2];
    expect(beforeLast.x).toBe(450);
    expect(beforeLast.y).toBeLessThan(100); // arrives downward into the top
    expect(route).toEqual([
      { x: 200, y: 150 },
      { x: 300, y: 150 },
      { x: 300, y: 84 },
      { x: 450, y: 84 },
      { x: 450, y: 100 },
    ]);
  });

  it('A.left → B.right (deliberately awkward): a real detour around both shapes, sides obeyed not preferred', async () => {
    const route = await routeOf(board({ sourceSide: 'left', targetSide: 'right' }));
    expect(route[0]).toEqual({ x: 100, y: 150 });
    expect(route[1].x).toBeLessThan(100); // leaves LEFT, away from B
    expect(route[route.length - 1]).toEqual({ x: 500, y: 150 });
    expect(route[route.length - 2].x).toBeGreaterThan(500); // arrives from the far side
    // No unpinned route between two side-by-side squares ever looks like this.
    expect(route.length).toBeGreaterThanOrEqual(6);
  });

  it('mixed ends: a pinned source and a free target', async () => {
    const route = await routeOf(board({ sourceSide: 'bottom' }));
    expect(route[0]).toEqual({ x: 150, y: 200 }); // A's bottom midpoint, kept
    expect(route[1].x).toBe(150);
    expect(route[1].y).toBeGreaterThan(200); // leaves downward
    // The free end is still a node centre and still stripped: the last waypoint is
    // the router's last bend, not B's centre.
    expect(route[route.length - 1]).not.toEqual({ x: 450, y: 150 });
  });

  it('draws square through the renderer’s own anchor math, with no stub needed', async () => {
    const sides = { sourceSide: 'right' as const, targetSide: 'top' as const };
    const route = await routeOf(board(sides));
    const drawn = drawnPolyline(route, A, B, sides);
    expect(diagonalSegments(drawn)).toEqual([]);
    // The kept endpoints coincide with the anchors, so they draw no zero-length leg.
    expect(drawn[0]).toEqual({ x: 200, y: 150 });
    expect(drawn[drawn.length - 1]).toEqual({ x: 450, y: 100 });
    expect(drawn).toHaveLength(route.length);
  });

  it('two lines on one side share the pin — neither degrades to the centre', async () => {
    // A fresh pin is exclusive; the second connector asking for it would silently
    // fall back to A's centre (150,150). Both must start on the right side.
    const input: RouterInput = {
      nodes: [
        { id: 'a', rect: A },
        { id: 'b', rect: B },
        { id: 'c', rect: { x: 400, y: 300, width: 100, height: 100 } },
      ],
      groups: [],
      connections: [
        { id: 'a-b', sourceId: 'a', targetId: 'b', sourceSide: 'right' },
        { id: 'a-c', sourceId: 'a', targetId: 'c', sourceSide: 'right' },
      ],
    };
    const { routes } = await routeWithLibavoid(input);
    // Both on A's right side (x = 200, y within the side). libavoid nudges shared
    // endpoints apart ALONG the side (measured: 149.97 and 181.97, one nudging
    // distance apart), which is the fan a shared pin should give — and neither
    // is anywhere near the centre x = 150 a silent fallback would produce.
    for (const id of ['a-b', 'a-c']) {
      const first = routes.get(id)![0];
      expect(first.x, id).toBe(200);
      expect(first.y, id).toBeGreaterThanOrEqual(100);
      expect(first.y, id).toBeLessThanOrEqual(200);
    }
    // And they still part ways after the pin: distinct second points.
    expect(routes.get('a-b')![1]).not.toEqual(routes.get('a-c')![1]);
  });

  it('a grouped node in tier 1 gets a free end ON the requested side, endpoint kept', async () => {
    // A sits in a group box; tier 1 routes a→b against the BOX, so there is no
    // shape of A to pin. The end lands on A's top midpoint all the same.
    const input: RouterInput = {
      nodes: [
        { id: 'a', rect: A, domainGroup: 'G' },
        { id: 'b', rect: B },
      ],
      groups: [{ name: 'G', x: 60, y: 60, width: 180, height: 180 }],
      connections: [{ id: 'a-b', sourceId: 'a', targetId: 'b', sourceSide: 'top' }],
    };
    const route = await routeOf(input);
    expect(route[0]).toEqual({ x: 150, y: 100 });
  });

  it('routes a board without sides exactly as before — an absent side and an undefined one alike', async () => {
    const plain = await routeOf(board());
    const explicit = await routeOf(board({ sourceSide: undefined, targetSide: undefined }));
    expect(explicit).toEqual(plain);
    // The unpinned contract: node centres stripped, a clear line is straight.
    expect(plain).toEqual([]);
  });

  it('is deterministic with pins, whatever order the connections arrive in', async () => {
    const input = (): RouterInput => ({
      nodes: [
        { id: 'a', rect: A },
        { id: 'b', rect: B },
        { id: 'c', rect: { x: 400, y: 300, width: 100, height: 100 } },
      ],
      groups: [],
      connections: [
        { id: 'a-b', sourceId: 'a', targetId: 'b', sourceSide: 'right', targetSide: 'left' },
        { id: 'a-c', sourceId: 'a', targetId: 'c', sourceSide: 'right' },
      ],
    });
    const forward = await routeWithLibavoid(input());
    const reversed = input();
    reversed.connections.reverse();
    reversed.nodes.reverse();
    const backward = await routeWithLibavoid(reversed);
    expect([...backward.routes]).toEqual([...forward.routes].sort(([a], [b]) => (a < b ? -1 : 1)));
  });
});

describe('routeWithLibavoid — how the pins are built (against a fake module)', () => {
  interface Call {
    kind: 'pin' | 'end-point' | 'end-shape';
    args: unknown[];
  }

  function fakeAvoid() {
    const calls: Call[] = [];
    const exclusive: boolean[] = [];
    class Router {
      setRoutingParameter(): void {}
      setRoutingOption(): void {}
      processTransaction(): void {}
    }
    class FakePoint {
      constructor(
        readonly x: number,
        readonly y: number,
      ) {}
    }
    class Handle {}
    class ShapeRef extends Handle {}
    class ConnEnd {
      constructor(...args: unknown[]) {
        calls.push({ kind: args[0] instanceof FakePoint ? 'end-point' : 'end-shape', args });
      }
    }
    class ShapeConnectionPin {
      constructor(...args: unknown[]) {
        calls.push({ kind: 'pin', args });
      }
      setExclusive(value: boolean): void {
        exclusive.push(value);
      }
    }
    class ConnRef {
      displayRoute() {
        const points = [
          { x: 200, y: 150 },
          { x: 300, y: 150 },
          { x: 300, y: 84 },
          { x: 450, y: 84 },
          { x: 450, y: 100 },
        ];
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
      ConnDirUp: 1,
      ConnDirDown: 2,
      ConnDirLeft: 4,
      ConnDirRight: 8,
      Router,
      Point: FakePoint,
      Rectangle: Handle,
      ShapeRef,
      ConnEnd,
      ConnRef,
      ShapeConnectionPin,
      destroy(): void {},
    };
    return {
      calls,
      exclusive,
      module: { AvoidLib: { load: () => Promise.resolve(), getInstance: () => api } },
    };
  }

  async function adapterOver(fake: ReturnType<typeof fakeAvoid>) {
    vi.resetModules();
    vi.doMock('libavoid-js', () => fake.module);
    return import('./libavoidRouter');
  }

  afterEach(() => {
    vi.doUnmock('libavoid-js');
    vi.resetModules();
  });

  it('makes one non-exclusive pin per (shape, side), lazily, with the spike’s class ids and directions', async () => {
    const fake = fakeAvoid();
    const adapter = await adapterOver(fake);
    await adapter.routeWithLibavoidInProcess({
      nodes: [
        { id: 'a', rect: A },
        { id: 'b', rect: B },
        { id: 'c', rect: { x: 400, y: 300, width: 100, height: 100 } },
      ],
      groups: [],
      connections: [
        { id: 'a-b', sourceId: 'a', targetId: 'b', sourceSide: 'right', targetSide: 'top' },
        { id: 'a-c', sourceId: 'a', targetId: 'c', sourceSide: 'right' }, // shares A.right
      ],
    });
    const pins = fake.calls.filter((c) => c.kind === 'pin');
    // Two distinct (shape, side) pairs were asked for: A.right (twice) and B.top.
    expect(pins).toHaveLength(2);
    // (shape, classId, xOffset, yOffset, proportional, insideOffset, visDirs)
    expect(pins[0].args.slice(1)).toEqual([2, 1, 0.5, true, 0, 8]); // right: class 2, ConnDirRight
    expect(pins[1].args.slice(1)).toEqual([1, 0.5, 0, true, 0, 1]); // top: class 1, ConnDirUp
    expect(fake.exclusive).toEqual([false, false]);
    // Pinned ends name the shape and its class id; free ends are points — and no
    // call ever passes a point with a second argument (the form that aborts).
    const ends = fake.calls.filter((c) => c.kind !== 'pin');
    expect(ends.map((c) => c.kind)).toEqual(['end-shape', 'end-shape', 'end-shape', 'end-point']);
    for (const end of ends) {
      if (end.kind === 'end-point') expect(end.args).toHaveLength(1);
      else expect(end.args[1]).toBeGreaterThanOrEqual(1);
    }
    expect(ends[0].args[1]).toBe(2); // a-b source: A.right
    expect(ends[1].args[1]).toBe(1); // a-b target: B.top
    expect(ends[2].args[1]).toBe(2); // a-c source: A.right, the shared pin
  });

  it('keeps a pinned endpoint and strips a free one', async () => {
    const fake = fakeAvoid();
    const adapter = await adapterOver(fake);
    const { routes } = await adapter.routeWithLibavoidInProcess({
      nodes: [
        { id: 'a', rect: A },
        { id: 'b', rect: B },
      ],
      groups: [],
      connections: [
        { id: 'both', sourceId: 'a', targetId: 'b', sourceSide: 'right', targetSide: 'top' },
        { id: 'source-only', sourceId: 'a', targetId: 'b', sourceSide: 'right' },
        { id: 'none', sourceId: 'a', targetId: 'b' },
      ],
    });
    expect(routes.get('both')).toHaveLength(5);
    expect(routes.get('source-only')).toHaveLength(4);
    expect(routes.get('source-only')![0]).toEqual({ x: 200, y: 150 });
    expect(routes.get('none')).toHaveLength(3);
    expect(routes.get('none')![0]).toEqual({ x: 300, y: 150 });
  });
});
