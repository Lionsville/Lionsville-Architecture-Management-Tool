import { describe, expect, it, vi } from 'vitest';
import type {
  DesignConnection,
  DesignDiagram,
  DesignElement,
  DesignModel,
  ElementKind,
  Point,
  Rect,
  ResizableZone,
} from '../model/types';
import { placementSize } from '../model/placement';
import { CANVAS_SIZE_LIMITS, LAYER7_CANVAS, zoneRect, zoneSizeLimits, zoneSizes } from '../model/zones';
import {
  bandTargets,
  DEFAULT_TIDY_OPTIONS,
  settleBoard,
  SETTLE_ROUNDS,
  tidyContainer,
  tidyGroup,
  tidyLayer7,
  type TidyOptions,
} from './tidy';
import { edgeLabelSize } from './edgeLabelSize';
import { pathHitsObstacles, rectIntersectsRect } from './geometry';
import { LABEL_MARGIN, ROUTE_CLEARANCE } from './routing';
import { diagonalSegments, pathClearance, routedPath } from './routeTestSupport';

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/**
 * Slack on a clearance assertion, in px. Small enough that a graze still fails (the
 * measured graze was 0.00000012 short of touching, i.e. 16 px short of clearing),
 * large enough to absorb the router rounding its output to 2 dp.
 */
const CLEARANCE_TOLERANCE = 0.02;

/** Total length over which two polylines run collinear and overlapping — how much
 *  one line hides the other (the "lines stacked on top of each other" signal). */
function collinearOverlap(a: Point[], b: Point[]): number {
  const segOverlap = (a1: Point, a2: Point, b1: Point, b2: Point): number => {
    const len = Math.hypot(a2.x - a1.x, a2.y - a1.y);
    if (len < 1e-6) return 0;
    const cross = (u: Point, v: Point, w: Point) =>
      (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
    if (Math.abs(cross(a1, a2, b1)) / len > 1) return 0;
    if (Math.abs(cross(a1, a2, b2)) / len > 1) return 0;
    const ux = (a2.x - a1.x) / len;
    const uy = (a2.y - a1.y) / len;
    const proj = (p: Point) => (p.x - a1.x) * ux + (p.y - a1.y) * uy;
    const bLo = Math.min(proj(b1), proj(b2));
    const bHi = Math.max(proj(b1), proj(b2));
    return Math.max(0, Math.min(len, bHi) - Math.max(0, bLo));
  };
  let total = 0;
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      total += segOverlap(a[i], a[i + 1], b[j], b[j + 1]);
    }
  }
  return total;
}

/** How many times two drawn paths properly cross (touching at a shared endpoint or
 *  running collinear does not count — only a transversal intersection). */
function segmentCrossings(a: Point[], b: Point[]): number {
  const side = (o: Point, p: Point, q: Point) =>
    (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const opposite = (d1: number, d2: number) => (d1 > 1e-6 && d2 < -1e-6) || (d1 < -1e-6 && d2 > 1e-6);
  let total = 0;
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      const [p1, p2, p3, p4] = [a[i], a[i + 1], b[j], b[j + 1]];
      if (
        opposite(side(p3, p4, p1), side(p3, p4, p2)) &&
        opposite(side(p1, p2, p3), side(p1, p2, p4))
      ) {
        total++;
      }
    }
  }
  return total;
}

/**
 * Tidy end to end: the real bundled ELK engine (no worker in node) placing, and the
 * real libavoid WASM router routing. So every assertion here is a geometric
 * invariant — group rects hug their members, a route clears what it must, a chip
 * clears a box — and never an exact coordinate. Bend coordinates in particular are
 * the router's business, and asserting them would turn a router upgrade into a test
 * rewrite.
 */

function elt(id: string, kind: ElementKind, extra: Partial<DesignElement> = {}): DesignElement {
  return {
    id,
    kind,
    name: id,
    lifecycle: 'live',
    isManaged: true,
    aspects: {},
    parameters: {},
    ...extra,
  };
}

describe('tidyLayer7 — domain-group rects follow the layout (QF4)', () => {
  it('returns a rect per laid-out group whose box contains its members', async () => {
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        elt('e1', 'application'),
        elt('e2', 'application'),
        elt('e3', 'application'),
      ],
      connections: [{ id: 'c1', sourceId: 'e1', targetId: 'e2', isBidirectional: false }],
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: [
            { elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 0, y: 0 },
            { elementId: 'e2', zone: 'landscape', domainGroup: 'Core', x: 0, y: 0 },
            { elementId: 'e3', zone: 'landscape', domainGroup: 'Edge', x: 0, y: 0 },
          ],
          layoutConfig: {
            domainGroups: [
              { name: 'Core', x: 5, y: 5, width: 10, height: 10 },
              { name: 'Edge', x: 5, y: 5, width: 10, height: 10 },
            ],
          },
        },
      ],
    };
    const diagram = model.diagrams[0];

    const result = await tidyLayer7(model, diagram);

    const core = result.domainGroups?.find((g) => g.name === 'Core');
    const edge = result.domainGroups?.find((g) => g.name === 'Edge');
    expect(core).toBeDefined();
    expect(edge).toBeDefined();

    // The old (5×10×10) rects have been re-sized to real boxes.
    expect(core!.width).toBeGreaterThan(10);
    expect(core!.height).toBeGreaterThan(10);

    // Every member sits inside its group's rect (ELK padding keeps them clear
    // of the border; the rect and members share the same centring offset).
    const kindById = new Map(model.elements.map((e) => [e.id, e.kind]));
    const rectByGroup = new Map(result.domainGroups!.map((g) => [g.name, g]));
    for (const placement of result.placements) {
      const groupName = diagram.placements.find((p) => p.elementId === placement.elementId)
        ?.domainGroup;
      if (!groupName) continue;
      const rect = rectByGroup.get(groupName)!;
      const size = placementSize(kindById.get(placement.elementId)!, placement);
      expect(placement.x).toBeGreaterThanOrEqual(rect.x - 0.5);
      expect(placement.y).toBeGreaterThanOrEqual(rect.y - 0.5);
      expect(placement.x + size.width).toBeLessThanOrEqual(rect.x + rect.width + 0.5);
      expect(placement.y + size.height).toBeLessThanOrEqual(rect.y + rect.height + 0.5);
    }
  });

  it('derives group rects from members even when cross-group edges disrupt ELK compound boxing (U2)', async () => {
    // Every element lives in a group AND is chained across groups. Cross-group
    // edges are what make ELK drop compound treatment for a group, leaving the
    // old ELK-box-derived rect stale/empty. Because U2 derives the rect from the
    // members' final positions, every group with members still gets a rect that
    // encloses them regardless of ELK's internal choice.
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        elt('a1', 'application'),
        elt('a2', 'application'),
        elt('b1', 'application'),
        elt('b2', 'application'),
      ],
      connections: [
        // Cross-group chain a1 → b1 → a2 → b2 weaves the two groups together.
        { id: 'c1', sourceId: 'a1', targetId: 'b1', isBidirectional: false },
        { id: 'c2', sourceId: 'b1', targetId: 'a2', isBidirectional: false },
        { id: 'c3', sourceId: 'a2', targetId: 'b2', isBidirectional: false },
      ],
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: [
            { elementId: 'a1', zone: 'landscape', domainGroup: 'Alpha', x: 0, y: 0 },
            { elementId: 'a2', zone: 'landscape', domainGroup: 'Alpha', x: 0, y: 0 },
            { elementId: 'b1', zone: 'landscape', domainGroup: 'Beta', x: 0, y: 0 },
            { elementId: 'b2', zone: 'landscape', domainGroup: 'Beta', x: 0, y: 0 },
          ],
          // No pre-existing rects at all — Tidy must still emit one per group.
          layoutConfig: {},
        },
      ],
    };
    const diagram = model.diagrams[0];

    const result = await tidyLayer7(model, diagram);

    // A rect exists for EVERY group with members, even with no seed rects.
    const rectByGroup = new Map((result.domainGroups ?? []).map((g) => [g.name, g]));
    expect(rectByGroup.has('Alpha')).toBe(true);
    expect(rectByGroup.has('Beta')).toBe(true);

    // Each member sits inside its group's rect (member-derived + padded bounds).
    const kindById = new Map(model.elements.map((e) => [e.id, e.kind]));
    for (const placement of result.placements) {
      const groupName = diagram.placements.find((p) => p.elementId === placement.elementId)
        ?.domainGroup;
      if (!groupName) continue;
      const rect = rectByGroup.get(groupName)!;
      const size = placementSize(kindById.get(placement.elementId)!, placement);
      expect(placement.x).toBeGreaterThanOrEqual(rect.x - 0.5);
      expect(placement.y).toBeGreaterThanOrEqual(rect.y - 0.5);
      expect(placement.x + size.width).toBeLessThanOrEqual(rect.x + rect.width + 0.5);
      expect(placement.y + size.height).toBeLessThanOrEqual(rect.y + rect.height + 0.5);
    }
  });

  it('reserves horizontal room between two nodes for a wide edge label (U-edge-1)', async () => {
    // Same two connected landscape nodes, laid out twice: once with a WIDE
    // labelled connection, once with the identical connection unlabelled. ELK
    // (direction RIGHT) puts the two apps in adjacent layers; a labelled edge
    // makes ELK insert a label dummy node between them, widening the gap.
    //
    // This is now also the guard on feeding edges and label sizes to ELK at all.
    // Tidy discards ELK's ROUTES, and it is tempting to conclude the edges are dead
    // input — they are not: they are what makes ELK leave the channel and label room
    // libavoid then routes through. Stop passing them and this test goes red.
    const twoNodes = (connection: DesignConnection): DesignModel => ({
      name: 'ACME',
      customerName: 'ACME',
      elements: [elt('e1', 'application'), elt('e2', 'application')],
      connections: [connection],
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: [
            { elementId: 'e1', zone: 'landscape', x: 0, y: 0 },
            { elementId: 'e2', zone: 'landscape', x: 0, y: 0 },
          ],
        },
      ],
    });
    // Horizontal gap between the two 200px-wide app rects.
    const horizontalGap = (result: Awaited<ReturnType<typeof tidyLayer7>>) => {
      const p1 = result.placements.find((p) => p.elementId === 'e1')!;
      const p2 = result.placements.find((p) => p.elementId === 'e2')!;
      return Math.abs(p2.x - p1.x) - 200;
    };

    const bareModel = twoNodes({ id: 'c', sourceId: 'e1', targetId: 'e2', isBidirectional: false });
    const wideModel = twoNodes({
      id: 'c',
      sourceId: 'e1',
      targetId: 'e2',
      isBidirectional: false,
      label: 'reads customer master data from the platform',
      protocol: 'HTTPS',
    });

    const bare = await tidyLayer7(bareModel, bareModel.diagrams[0]);
    const wide = await tidyLayer7(wideModel, wideModel.diagrams[0]);

    const bareGap = horizontalGap(bare);
    const wideGap = horizontalGap(wide);

    // The labelled layout must leave strictly more room than the unlabelled one.
    expect(wideGap).toBeGreaterThan(bareGap);
    // And enough room to actually hold the ~240px chip — a gap the old 90px
    // between-layer spacing (with no label awareness) could never have produced.
    expect(wideGap).toBeGreaterThanOrEqual(300);
  });

  it('returns no group rects when the landscape has no grouped members', async () => {
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [elt('e1', 'application')],
      connections: [],
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: [{ elementId: 'e1', zone: 'landscape', x: 0, y: 0 }],
        },
      ],
    };
    const result = await tidyLayer7(model, model.diagrams[0]);
    expect(result.domainGroups).toEqual([]);
  });
});

describe('tidyLayer7 — canvas grows/shrinks to fit the landscape (STAP-1)', () => {
  /**
   * A chained landscape spread across `groupCount` domain groups of `perGroup`
   * apps each. The chain runs a→b→c→… across groups, so ELK spreads it wide
   * (direction RIGHT) — the shape that used to spill the block past the fixed
   * landscape zone into the neighbour bands.
   */
  function chainedLandscape(
    groupCount: number,
    perGroup: number,
    layoutConfig?: DesignDiagram['layoutConfig'],
  ): DesignModel {
    const ids: string[] = [];
    const placements: DesignDiagram['placements'] = [];
    for (let g = 0; g < groupCount; g++) {
      for (let m = 0; m < perGroup; m++) {
        const id = `g${g}m${m}`;
        ids.push(id);
        placements.push({ elementId: id, zone: 'landscape', domainGroup: `G${g}`, x: 0, y: 0 });
      }
    }
    const connections: DesignConnection[] = [];
    for (let i = 0; i < ids.length - 1; i++) {
      connections.push({ id: `c${i}`, sourceId: ids[i], targetId: ids[i + 1], isBidirectional: false });
    }
    return {
      name: 'ACME',
      customerName: 'ACME',
      elements: ids.map((id) => elt(id, 'application')),
      connections,
      diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements, layoutConfig }],
    };
  }

  it('grows the zone to enclose every domain-group rect (the STAP-1 repro)', async () => {
    const model = chainedLandscape(3, 2);
    const result = await tidyLayer7(model, model.diagrams[0]);

    expect(result.canvas).toBeDefined();
    const zone = zoneRect('landscape', { ...model.diagrams[0].layoutConfig, canvas: result.canvas });
    for (const rect of result.domainGroups ?? []) {
      expect(rect.x).toBeGreaterThanOrEqual(zone.x - 0.5);
      expect(rect.y).toBeGreaterThanOrEqual(zone.y - 0.5);
      expect(rect.x + rect.width).toBeLessThanOrEqual(zone.x + zone.width + 0.5);
      expect(rect.y + rect.height).toBeLessThanOrEqual(zone.y + zone.height + 0.5);
    }
  });

  it('grows the canvas wider than the default for a wide landscape', async () => {
    const model = chainedLandscape(3, 2);
    const result = await tidyLayer7(model, model.diagrams[0]);
    expect(result.canvas!.width).toBeGreaterThan(LAYER7_CANVAS.width);
  });

  it('shrinks a previously-inflated canvas back toward the default for a small landscape', async () => {
    const model = chainedLandscape(1, 2, { canvas: { width: 4000, height: 3000 } });
    const result = await tidyLayer7(model, model.diagrams[0]);
    expect(result.canvas!.width).toBeLessThanOrEqual(LAYER7_CANVAS.width);
    expect(result.canvas!.height).toBeLessThanOrEqual(LAYER7_CANVAS.height);
  });

  it('shrink-back floors at the DEFAULT, not the flexible-board minimum', async () => {
    // The board minimum dropped below the default so users can shrink small
    // landscapes by hand — Tidy must keep settling inflated boards on the
    // default, exactly as before.
    const model = chainedLandscape(1, 2, { canvas: { width: 4000, height: 3000 } });
    const result = await tidyLayer7(model, model.diagrams[0]);
    expect(result.canvas).toEqual({ width: LAYER7_CANVAS.width, height: LAYER7_CANVAS.height });
  });

  it('keeps a board the user deliberately shrank below the default (flexible board)', async () => {
    // One LOOSE application (a domain group's padding would outgrow the small
    // board) and narrow side bands, so the content genuinely fits — Tidy's
    // floor is then the user's board, not the default.
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [elt('e1', 'application')],
      connections: [],
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: [{ elementId: 'e1', zone: 'landscape', x: 0, y: 0 }],
          layoutConfig: {
            canvas: { width: 840, height: 520 },
            zones: { inputChannels: { size: 120 }, externalSystems: { size: 120 } },
          },
        },
      ],
    };
    const result = await tidyLayer7(model, model.diagrams[0]);
    expect(result.canvas).toEqual({ width: 840, height: 520 });
  });

  it('settles in ONE press when a band is deeper than the settled board allows', async () => {
    // Band maxima are fractions of the board, so measuring the content against
    // the pre-Tidy board settled somewhere else every press: this board used to
    // walk 1741.5 → 1120 → 1040 over three presses.
    const model = chainedLandscape(1, 2, {
      canvas: { width: 4800, height: 3200 },
      zones: { management: { size: 1100 } },
    });
    const first = await tidyLayer7(model, model.diagrams[0]);
    expect(first.canvas).toEqual({ width: LAYER7_CANVAS.width, height: LAYER7_CANVAS.height });

    // And pressing Tidy again is a no-op, on any board it settles on.
    const settled: DesignModel = {
      ...model,
      diagrams: [
        {
          ...model.diagrams[0],
          placements: first.placements,
          layoutConfig: { ...model.diagrams[0].layoutConfig, canvas: first.canvas },
        },
      ],
    };
    const second = await tidyLayer7(settled, settled.diagrams[0]);
    expect(second.canvas).toEqual(first.canvas);
  });

  it('clamps to the ceiling for a very large landscape (never exceeds the limits)', async () => {
    const model = chainedLandscape(1, 24);
    const result = await tidyLayer7(model, model.diagrams[0]);
    expect(result.canvas!.width).toBeLessThanOrEqual(4800);
    expect(result.canvas!.height).toBeLessThanOrEqual(3200);
  });

  it('keeps the landscape flush between the side bands after growth (no overlap)', async () => {
    const model = chainedLandscape(3, 2);
    const result = await tidyLayer7(model, model.diagrams[0]);
    const grown = { ...model.diagrams[0].layoutConfig, canvas: result.canvas };
    const landscape = zoneRect('landscape', grown);
    const inputChannels = zoneRect('inputChannels', grown);
    const externalSystems = zoneRect('externalSystems', grown);
    // landscape sits to the right of inputChannels and left of externalSystems.
    expect(inputChannels.x + inputChannels.width).toBeLessThanOrEqual(landscape.x + 0.5);
    expect(landscape.x + landscape.width).toBeLessThanOrEqual(externalSystems.x + 0.5);
  });

  it('keeps a grouped box inside the landscape zone on a TALL landscape (top clear of the actors band)', async () => {
    // A hub fanning out to many targets, all in one group: ELK (RIGHT) stacks the
    // targets vertically in a single layer, producing a TALL block — the growth
    // regime (canvas grows in height, not floored). Group boxes reach GROUP_PAD.top
    // above their members, so without padding the centred block the box top would
    // land 16px up in the actors band. This guards that it does not.
    const targets = Array.from({ length: 12 }, (_, i) => `t${i}`);
    const ids = ['hub', ...targets];
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: ids.map((id) => elt(id, 'application')),
      connections: targets.map((id, i) => ({
        id: `c${i}`,
        sourceId: 'hub',
        targetId: id,
        isBidirectional: false,
      })),
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: ids.map((id) => ({
            elementId: id,
            zone: 'landscape' as const,
            domainGroup: 'Core',
            x: 0,
            y: 0,
          })),
        },
      ],
    };
    const result = await tidyLayer7(model, model.diagrams[0]);
    const zone = zoneRect('landscape', { ...model.diagrams[0].layoutConfig, canvas: result.canvas });
    // Genuinely in the growth regime: the landscape grew taller than the default.
    expect(result.canvas!.height).toBeGreaterThan(LAYER7_CANVAS.height);
    // The group box stays inside the landscape zone on every side — crucially its
    // TOP does not cross up into the actors band.
    const core = result.domainGroups!.find((g) => g.name === 'Core')!;
    expect(core.y).toBeGreaterThanOrEqual(zone.y - 0.5);
    expect(core.x).toBeGreaterThanOrEqual(zone.x - 0.5);
    expect(core.x + core.width).toBeLessThanOrEqual(zone.x + zone.width + 0.5);
    expect(core.y + core.height).toBeLessThanOrEqual(zone.y + zone.height + 0.5);
  });
});

describe('tidyLayer7 — routes every landscape edge around the nodes (U-edge-2)', () => {
  /**
   * Rewritten for libavoid. This used to assert that ELK's bendpoints came back
   * shifted by the landscape centring offset — a claim about plumbing that libavoid
   * makes vacuous, because it routes in final board coordinates and there is no
   * offset to apply. What the test was really protecting is that a landscape edge
   * with a node in its way comes back BENT AROUND it, so that is what it asserts
   * now, on the rendered path and with a clearance rather than a coordinate.
   */
  const model: DesignModel = {
    name: 'ACME',
    customerName: 'ACME',
    elements: [elt('a', 'application'), elt('b', 'application'), elt('c', 'application')],
    connections: [
      { id: 'ab', sourceId: 'a', targetId: 'b', isBidirectional: false },
      { id: 'bc', sourceId: 'b', targetId: 'c', isBidirectional: false },
      // a → b → c chains, so ELK (direction RIGHT) places b in the layer between a
      // and c; this skip-a-layer edge then has b squarely in its way.
      { id: 'ac', sourceId: 'a', targetId: 'c', isBidirectional: false },
    ],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'a', zone: 'landscape', x: 0, y: 0 },
          { elementId: 'b', zone: 'landscape', x: 0, y: 0 },
          { elementId: 'c', zone: 'landscape', x: 0, y: 0 },
        ],
      },
    ],
  };
  const rectOf = (result: Awaited<ReturnType<typeof tidyLayer7>>, id: string): Rect => {
    const p = result.placements.find((pp) => pp.elementId === id)!;
    const size = placementSize(model.elements.find((e) => e.id === id)!.kind, p);
    return { x: p.x, y: p.y, width: size.width, height: size.height };
  };

  it('returns a route for every connection on the diagram', async () => {
    const result = await tidyLayer7(model, model.diagrams[0]);
    const ids = (result.edgeRoutes ?? []).map((r) => r.connectionId).sort();
    expect(ids).toEqual(['ab', 'ac', 'bc']);
  });

  it('CLEARS a declined edge rather than reinstating its stored route', async () => {
    // Tidy repositions every node, so a stored route is waypoints measured against
    // positions that no longer exist — reinstating one would draw a bend around empty
    // space, or through a node that moved into it. A self-connection is the reliable
    // way to make the router decline an edge whose endpoints are both on the board
    // (there is no orthogonal route from a point to itself).
    //
    // The opposite choice is correct for route-only, which moves nothing; that
    // asymmetry is `DeclinedPolicy` and it is tested from the other side in
    // `routeOnly.test.ts`. Do not "unify" the two.
    const selfConnected: DesignModel = {
      ...model,
      connections: [
        ...model.connections,
        { id: 'a-a', sourceId: 'a', targetId: 'a', isBidirectional: false },
      ],
      diagrams: [
        {
          ...model.diagrams[0],
          // A route the user had stored for it, in coordinates from the old layout.
          edgeRoutes: [{ connectionId: 'a-a', waypoints: [{ x: 4000, y: 4000 }] }],
        },
      ],
    };
    // Pins OFF explicitly: this test is about the declined-connection policy, and
    // with `pinAnchorPoints` (now on by default) the user's route would be
    // preserved before the policy is ever consulted.
    const result = await tidyLayer7(selfConnected, selfConnected.diagrams[0], {
      ...DEFAULT_TIDY_OPTIONS,
      pinAnchorPoints: false,
    });

    const declined = result.edgeRoutes!.find((r) => r.connectionId === 'a-a');
    expect(declined).toBeDefined(); // an entry, so `applyTidyResult` acts on it
    expect(declined!.waypoints).toEqual([]); // …and the stale waypoint is gone
  });

  it('bends the skip-a-layer edge clear of the node ELK placed in its way', async () => {
    const result = await tidyLayer7(model, model.diagrams[0]);
    const a = rectOf(result, 'a');
    const b = rectOf(result, 'b');
    const c = rectOf(result, 'c');
    // Sanity: b really is on the straight run, so "clears it" is not free.
    expect(pathHitsObstacles(routedPath(a, c, []), [b], ROUTE_CLEARANCE)).toBeGreaterThan(0);

    const route = result.edgeRoutes!.find((r) => r.connectionId === 'ac')!;
    expect(route.waypoints.length).toBeGreaterThan(0);
    // A DISTANCE, not a hit count: a route grazing b's edge would still pass
    // `pathHitsObstacles` at this margin (see `pathClearance`).
    expect(pathClearance(routedPath(a, c, route.waypoints), [b])).toBeGreaterThanOrEqual(
      ROUTE_CLEARANCE - CLEARANCE_TOLERANCE,
    );
  });
});

describe('tidyLayer7 — bands positioned above connected-landscape nodes (U-align)', () => {
  const posOf = (result: Awaited<ReturnType<typeof tidyLayer7>>, id: string) =>
    result.placements.find((p) => p.elementId === id)!;
  const centreX = (p: DesignDiagram['placements'][number], kind: ElementKind) =>
    p.x + placementSize(kind, p).width / 2;
  const centreY = (p: DesignDiagram['placements'][number], kind: ElementKind) =>
    p.y + placementSize(kind, p).height / 2;

  it('positions a band node above the app it connects to (not bunched at the left inset)', async () => {
    // Landscape appL → appR (ELK direction RIGHT puts appL left, appR right).
    // A single actor connects to appR — its CENTRE must land above appR's centre,
    // way over on the right, NOT packed at the band's left inset.
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        elt('appL', 'application'),
        elt('appR', 'application'),
        elt('actorA', 'actor'),
      ],
      connections: [
        { id: 'lr', sourceId: 'appL', targetId: 'appR', isBidirectional: false },
        { id: 'a', sourceId: 'actorA', targetId: 'appR', isBidirectional: false },
      ],
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: [
            { elementId: 'appL', zone: 'landscape', x: 0, y: 0 },
            { elementId: 'appR', zone: 'landscape', x: 0, y: 0 },
            // Actor starts bunched at the far left (x=0).
            { elementId: 'actorA', zone: 'actors', x: 0, y: 0 },
          ],
        },
      ],
    };
    const result = await tidyLayer7(model, model.diagrams[0]);

    const appRCentre = centreX(posOf(result, 'appR'), 'application');
    const actorCentre = centreX(posOf(result, 'actorA'), 'actor');
    // The actor sits roughly above appR — within half a node width + tolerance.
    expect(Math.abs(actorCentre - appRCentre)).toBeLessThanOrEqual(75 + 30);
    // appR is genuinely on the right half of the board, so the claim is meaningful…
    const canvasMid = result.canvas!.width / 2;
    expect(appRCentre).toBeGreaterThan(canvasMid);
    // …and the actor is far clear of the band's left inset (x≈28), not bunched there.
    expect(actorCentre).toBeGreaterThan(canvasMid - 100);
  });

  it('declumps two band nodes that share the same app target (no overlap)', async () => {
    // actorX and actorY both connect to appR: identical target centre. The declump
    // sweep must separate them by at least a full node width, both still in-band.
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        elt('appL', 'application'),
        elt('appR', 'application'),
        elt('actorX', 'actor'),
        elt('actorY', 'actor'),
      ],
      connections: [
        { id: 'lr', sourceId: 'appL', targetId: 'appR', isBidirectional: false },
        { id: 'x', sourceId: 'actorX', targetId: 'appR', isBidirectional: false },
        { id: 'y', sourceId: 'actorY', targetId: 'appR', isBidirectional: false },
      ],
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: [
            { elementId: 'appL', zone: 'landscape', x: 0, y: 0 },
            { elementId: 'appR', zone: 'landscape', x: 0, y: 0 },
            { elementId: 'actorX', zone: 'actors', x: 0, y: 0 },
            { elementId: 'actorY', zone: 'actors', x: 0, y: 0 },
          ],
        },
      ],
    };
    const result = await tidyLayer7(model, model.diagrams[0]);

    const x = posOf(result, 'actorX');
    const y = posOf(result, 'actorY');
    // Separated by at least a full node width (150) — they don't overlap.
    expect(Math.abs(x.x - y.x)).toBeGreaterThanOrEqual(150);
    // Both stay inside the actors band.
    const zone = zoneRect('actors', { ...model.diagrams[0].layoutConfig, canvas: result.canvas });
    for (const p of [x, y]) {
      const size = placementSize('actor', p);
      expect(p.x).toBeGreaterThanOrEqual(zone.x - 0.5);
      expect(p.x + size.width).toBeLessThanOrEqual(zone.x + zone.width + 0.5);
    }
  });

  it('places a multi-connected actor between the two apps it connects to', async () => {
    // actorL → appL, actorR → appR, actorM → BOTH. Barycentre(M) is the mean of
    // the two app centres, so M's centre must land between the two app centres.
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        elt('appL', 'application'),
        elt('appR', 'application'),
        elt('actorL', 'actor'),
        elt('actorR', 'actor'),
        elt('actorM', 'actor'),
      ],
      connections: [
        { id: 'lr', sourceId: 'appL', targetId: 'appR', isBidirectional: false },
        { id: 'l', sourceId: 'actorL', targetId: 'appL', isBidirectional: false },
        { id: 'r', sourceId: 'actorR', targetId: 'appR', isBidirectional: false },
        { id: 'm1', sourceId: 'actorM', targetId: 'appL', isBidirectional: false },
        { id: 'm2', sourceId: 'actorM', targetId: 'appR', isBidirectional: false },
      ],
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: [
            { elementId: 'appL', zone: 'landscape', x: 0, y: 0 },
            { elementId: 'appR', zone: 'landscape', x: 0, y: 0 },
            // Listed M, R, L to prove position is not input order.
            { elementId: 'actorM', zone: 'actors', x: 0, y: 0 },
            { elementId: 'actorR', zone: 'actors', x: 200, y: 0 },
            { elementId: 'actorL', zone: 'actors', x: 400, y: 0 },
          ],
        },
      ],
    };
    const result = await tidyLayer7(model, model.diagrams[0]);

    const appLCentre = centreX(posOf(result, 'appL'), 'application');
    const appRCentre = centreX(posOf(result, 'appR'), 'application');
    const mCentre = centreX(posOf(result, 'actorM'), 'actor');
    // M's centre sits strictly between the two app centres.
    expect(mCentre).toBeGreaterThan(Math.min(appLCentre, appRCentre));
    expect(mCentre).toBeLessThan(Math.max(appLCentre, appRCentre));
  });

  it('keeps an unconnected band node inside its zone without breaking the pass', async () => {
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        elt('appL', 'application'),
        elt('appR', 'application'),
        elt('actorC', 'actor'),
        elt('lonely', 'actor'),
      ],
      connections: [
        { id: 'lr', sourceId: 'appL', targetId: 'appR', isBidirectional: false },
        { id: 'c', sourceId: 'actorC', targetId: 'appL', isBidirectional: false },
        // `lonely` has no cross-zone connection at all.
      ],
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: [
            { elementId: 'appL', zone: 'landscape', x: 0, y: 0 },
            { elementId: 'appR', zone: 'landscape', x: 0, y: 0 },
            { elementId: 'actorC', zone: 'actors', x: 0, y: 0 },
            { elementId: 'lonely', zone: 'actors', x: 200, y: 0 },
          ],
        },
      ],
    };
    const result = await tidyLayer7(model, model.diagrams[0]);

    const lonely = posOf(result, 'lonely');
    const size = placementSize('actor', lonely);
    const zone = zoneRect('actors', { ...model.diagrams[0].layoutConfig, canvas: result.canvas });
    // Sits fully within the actors band.
    expect(lonely.x).toBeGreaterThanOrEqual(zone.x - 0.5);
    expect(lonely.x + size.width).toBeLessThanOrEqual(zone.x + zone.width + 0.5);
    expect(lonely.y).toBeGreaterThanOrEqual(zone.y - 0.5);
    expect(lonely.y + size.height).toBeLessThanOrEqual(zone.y + zone.height + 0.5);
  });

  it('positions a column band node by its connected app centre Y, cross-axis centred', async () => {
    // app0 fans out to app1 and app2 — both land in the same ELK layer, stacked
    // vertically (different Y). Two input channels each connect to one of them.
    // The channel of the TOP app must sit near that app's centre Y (declump can
    // only push the lower one down), inside the left band, x centred in the band.
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        elt('app0', 'application'),
        elt('app1', 'application'),
        elt('app2', 'application'),
        elt('inA', 'inputChannel'),
        elt('inB', 'inputChannel'),
      ],
      connections: [
        { id: 'e1', sourceId: 'app0', targetId: 'app1', isBidirectional: false },
        { id: 'e2', sourceId: 'app0', targetId: 'app2', isBidirectional: false },
        { id: 'ia', sourceId: 'inA', targetId: 'app1', isBidirectional: false },
        { id: 'ib', sourceId: 'inB', targetId: 'app2', isBidirectional: false },
      ],
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: [
            { elementId: 'app0', zone: 'landscape', x: 0, y: 0 },
            { elementId: 'app1', zone: 'landscape', x: 0, y: 0 },
            { elementId: 'app2', zone: 'landscape', x: 0, y: 0 },
            { elementId: 'inA', zone: 'inputChannels', x: 0, y: 0 },
            { elementId: 'inB', zone: 'inputChannels', x: 0, y: 400 },
          ],
        },
      ],
    };
    const result = await tidyLayer7(model, model.diagrams[0]);

    const app1 = posOf(result, 'app1');
    const app2 = posOf(result, 'app2');
    // The channel of the higher (smaller-y) app is the first in the sweep, so it
    // is NOT displaced by declump — its centre y should track the top app's.
    const topApp = app1.y <= app2.y ? app1 : app2;
    const topChannelId = app1.y <= app2.y ? 'inA' : 'inB';
    const topChannel = posOf(result, topChannelId);
    const appCentreY = centreY(topApp, 'application');
    const chanCentreY = centreY(topChannel, 'inputChannel');
    // Positioned by the app's centre Y — within half a node height + tolerance.
    expect(Math.abs(chanCentreY - appCentreY)).toBeLessThanOrEqual(28 + 30);
    // Also still ordered top→bottom: the top app's channel sits above the other.
    const bottomChannel = posOf(result, topChannelId === 'inA' ? 'inB' : 'inA');
    expect(topChannel.y).toBeLessThan(bottomChannel.y);
    // Inside the left band, with x centred cross-axis.
    const zone = zoneRect('inputChannels', { ...model.diagrams[0].layoutConfig, canvas: result.canvas });
    const size = placementSize('inputChannel', topChannel);
    expect(topChannel.y).toBeGreaterThanOrEqual(zone.y - 0.5);
    expect(topChannel.y + size.height).toBeLessThanOrEqual(zone.y + zone.height + 0.5);
    expect(topChannel.x).toBeCloseTo(zone.x + (zone.width - size.width) / 2, 5);
  });
});

describe('tidyLayer7 — domain-group boxes hug their laid-out members', () => {
  const kindById = (model: DesignModel) => new Map(model.elements.map((e) => [e.id, e.kind]));
  // Every member of `group` sits fully inside that group's returned rect.
  const membersInside = (
    result: Awaited<ReturnType<typeof tidyLayer7>>,
    diagram: DesignDiagram,
    kinds: Map<string, ElementKind>,
  ) => {
    const rectByGroup = new Map((result.domainGroups ?? []).map((g) => [g.name, g]));
    for (const placement of result.placements) {
      const groupName = diagram.placements.find((p) => p.elementId === placement.elementId)?.domainGroup;
      if (!groupName) continue;
      const rect = rectByGroup.get(groupName)!;
      const size = placementSize(kinds.get(placement.elementId)!, placement);
      expect(placement.x).toBeGreaterThanOrEqual(rect.x - 0.5);
      expect(placement.y).toBeGreaterThanOrEqual(rect.y - 0.5);
      expect(placement.x + size.width).toBeLessThanOrEqual(rect.x + rect.width + 0.5);
      expect(placement.y + size.height).toBeLessThanOrEqual(rect.y + rect.height + 0.5);
    }
  };

  it('replaces a stale seed box with a member-derived box containing its members', async () => {
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [elt('e1', 'application'), elt('e2', 'application')],
      connections: [{ id: 'c1', sourceId: 'e1', targetId: 'e2', isBidirectional: false }],
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: [
            { elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 0, y: 0 },
            { elementId: 'e2', zone: 'landscape', domainGroup: 'Core', x: 0, y: 0 },
          ],
          // A stale seed box: Tidy no longer honours its position — the box is
          // derived from where the members land in the single ELK pass.
          layoutConfig: {
            domainGroups: [{ name: 'Core', x: 1000, y: 600, width: 600, height: 400 }],
          },
        },
      ],
    };
    const diagram = model.diagrams[0];
    const result = await tidyLayer7(model, diagram);

    const core = result.domainGroups!.find((g) => g.name === 'Core')!;
    // A real box hugging both 200-wide apps (bigger than the seed would allow if
    // it were still constraining), with the members inside it.
    expect(core.width).toBeGreaterThan(200);
    expect(core.height).toBeGreaterThan(0);
    membersInside(result, diagram, kindById(model));
  });

  it('sizes the box to enclose its members regardless of the seed box size', async () => {
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [elt('e1', 'application'), elt('e2', 'application'), elt('e3', 'application')],
      connections: [
        { id: 'c1', sourceId: 'e1', targetId: 'e2', isBidirectional: false },
        { id: 'c2', sourceId: 'e2', targetId: 'e3', isBidirectional: false },
      ],
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: [
            { elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 0, y: 0 },
            { elementId: 'e2', zone: 'landscape', domainGroup: 'Core', x: 0, y: 0 },
            { elementId: 'e3', zone: 'landscape', domainGroup: 'Core', x: 0, y: 0 },
          ],
          // An absurd 20x20 seed: ignored — the box grows to hold three chained apps.
          layoutConfig: {
            domainGroups: [{ name: 'Core', x: 800, y: 500, width: 20, height: 20 }],
          },
        },
      ],
    };
    const diagram = model.diagrams[0];
    const result = await tidyLayer7(model, diagram);

    const core = result.domainGroups!.find((g) => g.name === 'Core')!;
    expect(core.width).toBeGreaterThan(20);
    expect(core.height).toBeGreaterThan(20);
    membersInside(result, diagram, kindById(model));
  });

  it('gives two groups distinct non-overlapping boxes, each containing its members', async () => {
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        elt('a1', 'application'),
        elt('a2', 'application'),
        elt('b1', 'application'),
        elt('b2', 'application'),
      ],
      connections: [
        { id: 'ca', sourceId: 'a1', targetId: 'a2', isBidirectional: false },
        { id: 'cb', sourceId: 'b1', targetId: 'b2', isBidirectional: false },
      ],
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: [
            { elementId: 'a1', zone: 'landscape', domainGroup: 'Alpha', x: 0, y: 0 },
            { elementId: 'a2', zone: 'landscape', domainGroup: 'Alpha', x: 0, y: 0 },
            { elementId: 'b1', zone: 'landscape', domainGroup: 'Beta', x: 0, y: 0 },
            { elementId: 'b2', zone: 'landscape', domainGroup: 'Beta', x: 0, y: 0 },
          ],
          // Seed positions are ignored; ELK lays the two groups out itself.
          layoutConfig: {
            domainGroups: [
              { name: 'Alpha', x: 400, y: 300, width: 600, height: 400 },
              { name: 'Beta', x: 1800, y: 1100, width: 600, height: 400 },
            ],
          },
        },
      ],
    };
    const diagram = model.diagrams[0];
    const result = await tidyLayer7(model, diagram);

    const alpha = result.domainGroups!.find((g) => g.name === 'Alpha')!;
    const beta = result.domainGroups!.find((g) => g.name === 'Beta')!;
    // Two real boxes, each holding its members, laid out clear of one another.
    const overlaps =
      alpha.x < beta.x + beta.width &&
      alpha.x + alpha.width > beta.x &&
      alpha.y < beta.y + beta.height &&
      alpha.y + alpha.height > beta.y;
    expect(overlaps).toBe(false);

    membersInside(result, diagram, kindById(model));
  });

  it('still auto-arranges loose (ungrouped) elements as before — no pinned boxes', async () => {
    // Parity check: a landscape with NO group boxes lays out the members spread
    // across the landscape and grows the canvas beyond the default — same as today.
    // Enough nodes that the chain is genuinely wider than the default canvas.
    const ids = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6'];
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: ids.map((id) => elt(id, 'application')),
      connections: ids.slice(1).map((id, i) => ({
        id: `c${i}`,
        sourceId: ids[i],
        targetId: id,
        isBidirectional: false,
      })),
      diagrams: [
        {
          id: 'd1',
          kind: 'layer7',
          name: 'L7',
          placements: ids.map((id) => ({ elementId: id, zone: 'landscape' as const, x: 0, y: 0 })),
        },
      ],
    };
    const result = await tidyLayer7(model, model.diagrams[0]);

    // No groups → no boxes.
    expect(result.domainGroups).toEqual([]);
    // The chained loose block spread the nodes: distinct x positions, canvas grown.
    const xs = ids.map((id) => result.placements.find((p) => p.elementId === id)!.x);
    expect(new Set(xs).size).toBe(ids.length);
    expect(result.canvas!.width).toBeGreaterThan(LAYER7_CANVAS.width);
    // Loose nodes land inside the landscape zone of the grown canvas.
    const zone = zoneRect('landscape', { ...model.diagrams[0].layoutConfig, canvas: result.canvas });
    for (const id of ids) {
      const p = result.placements.find((pp) => pp.elementId === id)!;
      const size = placementSize('application', p);
      expect(p.x).toBeGreaterThanOrEqual(zone.x - 0.5);
      expect(p.x + size.width).toBeLessThanOrEqual(zone.x + zone.width + 0.5);
    }
  });
});

describe('tidyLayer7 — real E-Commerce landscape does not stack cross-zone lines', () => {
  // Faithful fixture of design 5 / diagram 12 (the reported case): the two
  // pinned groups, all nine landscape/band nodes, and the eight connections.
  const model: DesignModel = {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      elt('storeMgr', 'actor'),
      elt('shopper', 'actor'),
      elt('csa', 'actor'),
      elt('marketplace', 'inputChannel'),
      elt('akeneo', 'application'),
      elt('webshop', 'application'),
      elt('order', 'application'),
      elt('erp', 'application'),
      elt('dynamics', 'externalSystem'),
      elt('grafana', 'managementTool'),
      elt('slack', 'managementTool'),
      elt('sonar', 'managementTool'),
      elt('gitlab', 'managementTool'),
    ],
    connections: [
      { id: 'order-erp', sourceId: 'order', targetId: 'erp', isBidirectional: false },
      { id: 'shopper-webshop', sourceId: 'shopper', targetId: 'webshop', isBidirectional: false },
      { id: 'akeneo-webshop', sourceId: 'akeneo', targetId: 'webshop', isBidirectional: false },
      { id: 'storemgr-akeneo', sourceId: 'storeMgr', targetId: 'akeneo', isBidirectional: false },
      { id: 'marketplace-order', sourceId: 'marketplace', targetId: 'order', label: 'imports marketplace orders', isBidirectional: false },
      { id: 'csa-order', sourceId: 'csa', targetId: 'order', isBidirectional: false },
      { id: 'webshop-order', sourceId: 'webshop', targetId: 'order', label: 'places orders', isBidirectional: false },
      { id: 'erp-dynamics', sourceId: 'erp', targetId: 'dynamics', label: 'syncs orders & stock', isBidirectional: false },
    ],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'storeMgr', zone: 'actors', x: 0, y: 0 },
          { elementId: 'shopper', zone: 'actors', x: 0, y: 0 },
          { elementId: 'csa', zone: 'actors', x: 0, y: 0 },
          { elementId: 'marketplace', zone: 'inputChannels', x: 0, y: 0 },
          { elementId: 'akeneo', zone: 'landscape', domainGroup: 'Customer Experience', x: 0, y: 0 },
          { elementId: 'webshop', zone: 'landscape', domainGroup: 'Customer Experience', x: 0, y: 0 },
          { elementId: 'order', zone: 'landscape', domainGroup: 'Commerce Operations', x: 0, y: 0 },
          { elementId: 'erp', zone: 'landscape', domainGroup: 'Commerce Operations', x: 0, y: 0 },
          { elementId: 'dynamics', zone: 'externalSystems', x: 0, y: 0 },
          { elementId: 'grafana', zone: 'management', x: 0, y: 0 },
          { elementId: 'slack', zone: 'management', x: 0, y: 0 },
          { elementId: 'sonar', zone: 'management', x: 0, y: 0 },
          { elementId: 'gitlab', zone: 'management', x: 0, y: 0 },
        ],
        layoutConfig: {
          // Current persisted group dimensions from diagram 12.
          domainGroups: [
            { name: 'Customer Experience', x: 241, y: 223, width: 686, height: 215 },
            { name: 'Commerce Operations', x: 1061, y: 229, width: 267, height: 474 },
          ],
        },
      },
    ],
  };

  const rectFor = (result: Awaited<ReturnType<typeof tidyLayer7>>, id: string) => {
    const p = result.placements.find((pp) => pp.elementId === id)!;
    const el = model.elements.find((e) => e.id === id)!;
    const size = placementSize(el.kind, p);
    return { x: p.x, y: p.y, width: size.width, height: size.height };
  };
  const pathFor = (result: Awaited<ReturnType<typeof tidyLayer7>>, connId: string, sourceId: string, targetId: string) => {
    const route = result.edgeRoutes!.find((r) => r.connectionId === connId)!;
    return routedPath(rectFor(result, sourceId), rectFor(result, targetId), route.waypoints);
  };

  it('draws every routed edge with axis-aligned segments only', async () => {
    // The invariant no clearance check can see: a diagonal segment clears obstacles
    // as happily as a square route, so a 42 px diagonal tail into Dynamics 365 passed
    // this entire suite. Waypointed edges only — an empty route renders through
    // `getSmoothStepPath`, which bends for itself, and `routedPath` models it as the
    // two anchors joined directly.
    const result = await tidyLayer7(model, model.diagrams[0]);
    const routed = model.connections.filter(
      (conn) => result.edgeRoutes!.find((r) => r.connectionId === conn.id)!.waypoints.length > 0,
    );
    expect(routed.length).toBeGreaterThan(0);
    for (const conn of routed) {
      const drawn = pathFor(result, conn.id, conn.sourceId, conn.targetId);
      expect(diagonalSegments(drawn), `${conn.id} has a diagonal segment`).toEqual([]);
    }
  });

  it('marketplace→order does not stack on the order→erp vertical', async () => {
    const result = await tidyLayer7(model, model.diagrams[0]);
    const mpOrder = pathFor(result, 'marketplace-order', 'marketplace', 'order');
    const orderErp = pathFor(result, 'order-erp', 'order', 'erp');
    expect(collinearOverlap(mpOrder, orderErp)).toBeLessThan(20);

    // The two lines attach to Order Service on different lines — marketplace→order
    // does NOT enter on the same vertical/horizontal centre the Order→ERP edge
    // uses, so they don't merge into one line through the node.
  });

  it('draws the aligned cross-group webshop→order edge dead straight with no waypoint', async () => {
    // Webshop (Customer Experience) and Order (Commerce Operations) land on the same
    // ELK row with nothing between them, so the router answers "straight". Tidy emits
    // EMPTY waypoints — the edge carries no injected handle — and FloatingEdge draws
    // it dead straight through both side centres (axis-aligned rects bypass the slot
    // fan). The rendered path is a single horizontal line.
    const result = await tidyLayer7(model, model.diagrams[0]);
    const route = result.edgeRoutes!.find((r) => r.connectionId === 'webshop-order')!;
    expect(route.waypoints).toEqual([]); // no injected waypoint → no draggable handle
    const path = pathFor(result, 'webshop-order', 'webshop', 'order');
    const ys = path.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1); // perfectly horizontal
  });

  it('pins EVERY labelled edge, landscape-internal ones included', async () => {
    // Promoted in Phase 4 of the libavoid adoption. Tidy used to emit a
    // `labelPosition` only for the cross-zone edges it routed itself; a
    // landscape-internal chip like `webshop-order`'s auto-centred onto ELK's polyline
    // instead, with nothing checking where that landed. Now that we own all the
    // routing every labelled edge is pinned, so `labelSpotFor`'s hard guarantee — the
    // chip clears every group box by LABEL_MARGIN — applies to all of them.
    //
    // Honest about which half bites: for `webshop-order` it is being pinned AT ALL
    // (drop the pin and this fails), since its spot on this board clears both boxes
    // comfortably either way. The clearance loop earns its keep on the cross-zone
    // chips, which sit against a box unpinned.
    const result = await tidyLayer7(model, model.diagrams[0]);
    const labelled = model.connections.filter((c) => edgeLabelSize(c) !== undefined);
    expect(labelled.map((c) => c.id)).toContain('webshop-order');

    for (const conn of labelled) {
      const route = result.edgeRoutes!.find((r) => r.connectionId === conn.id)!;
      expect(route.labelPosition, `${conn.id} was not pinned`).toBeDefined();
      const label = edgeLabelSize(conn)!;
      const lp = route.labelPosition!;
      const labelRect = {
        x: lp.x - label.width / 2,
        y: lp.y - label.height / 2,
        width: label.width,
        height: label.height,
      };
      for (const g of result.domainGroups ?? []) {
        expect(
          rectIntersectsRect(labelRect, g, LABEL_MARGIN),
          `${conn.id} overlaps ${g.name}`,
        ).toBe(false);
      }
    }
  });

  it('keeps every routed edge a full ROUTE_CLEARANCE from the group boxes it does not belong to', async () => {
    // The whole-board invariant the two mechanisms could never state together: one
    // router now sees every node and box, so EVERY route can be graded the same way.
    // A box containing an endpoint is that endpoint's own container, never an
    // obstacle for it.
    //
    // Graded as a minimum DISTANCE, deliberately. Counting hits at this margin also
    // passes a line that TOUCHES the box, which is the precise failure the old
    // heuristic shipped on this very board (y=617.99999988 against a bottom of 618).
    const result = await tidyLayer7(model, model.diagrams[0]);
    const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    const holds = (g: Rect, r: Rect) => {
      const c = centre(r);
      return c.x >= g.x && c.x <= g.x + g.width && c.y >= g.y && c.y <= g.y + g.height;
    };
    for (const conn of model.connections) {
      const source = rectFor(result, conn.sourceId);
      const target = rectFor(result, conn.targetId);
      const boxes = (result.domainGroups ?? []).filter(
        (g) => !holds(g, source) && !holds(g, target),
      );
      if (boxes.length === 0) continue;
      const drawn = pathFor(result, conn.id, conn.sourceId, conn.targetId);
      expect(
        pathClearance(drawn, boxes),
        `${conn.id} runs too close to a group box`,
      ).toBeGreaterThanOrEqual(ROUTE_CLEARANCE - CLEARANCE_TOLERANCE);
    }
  });

  it('places the erp→dynamics label clear of both its group box and the external node', async () => {
    // A short landscape→external edge with a wide label: the label auto-centres into
    // the source group box, and the gap is narrow. Tidy must pin the label clear of
    // BOTH the Commerce Operations box and the Dynamics node (the reported case).
    const result = await tidyLayer7(model, model.diagrams[0]);
    const route = result.edgeRoutes!.find((r) => r.connectionId === 'erp-dynamics')!;
    // Straight cross-zone edge: EMPTY waypoints (no handle), but the label is still
    // pinned clear — the pin survives on a waypoint-less route.
    expect(route.waypoints).toEqual([]);
    expect(route.labelPosition).toBeDefined();

    const label = edgeLabelSize(model.connections.find((c) => c.id === 'erp-dynamics')!)!;
    const lp = route.labelPosition!;
    const labelRect = {
      x: lp.x - label.width / 2,
      y: lp.y - label.height / 2,
      width: label.width,
      height: label.height,
    };
    const ops = result.domainGroups!.find((g) => g.name === 'Commerce Operations')!;
    expect(rectIntersectsRect(labelRect, ops, 8)).toBe(false);
    const dynRect = rectFor(result, 'dynamics');
    expect(rectIntersectsRect(labelRect, dynRect, 8)).toBe(false);
  });

  it('places the marketplace→order label clear of the Customer Experience group box', async () => {
    // The route runs around the groups; its label must not sit against a group box.
    const result = await tidyLayer7(model, model.diagrams[0]);
    const route = result.edgeRoutes!.find((r) => r.connectionId === 'marketplace-order')!;
    expect(route.waypoints.length).toBeGreaterThan(0); // it went around
    expect(route.labelPosition).toBeDefined();

    const label = edgeLabelSize(model.connections.find((c) => c.id === 'marketplace-order')!)!;
    const lp = route.labelPosition!;
    const labelRect = {
      x: lp.x - label.width / 2,
      y: lp.y - label.height / 2,
      width: label.width,
      height: label.height,
    };
    for (const g of result.domainGroups ?? []) {
      expect(rectIntersectsRect(labelRect, g, 8)).toBe(false);
    }
  });
});

describe('tidyContainer — boundary sizing (QF4 result shape)', () => {
  it('returns placements only and sizes the application boundary to its components', async () => {
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        elt('app', 'application'),
        elt('c1', 'component', { parentApplicationId: 'app' }),
        elt('c2', 'component', { parentApplicationId: 'app' }),
      ],
      connections: [],
      diagrams: [
        {
          id: 'd2',
          kind: 'container',
          name: 'Container',
          applicationElementId: 'app',
          placements: [
            { elementId: 'app', x: 0, y: 0 },
            { elementId: 'c1', x: 0, y: 0 },
            { elementId: 'c2', x: 0, y: 0 },
          ],
        },
      ],
    };
    const diagram: DesignDiagram = model.diagrams[0];

    const result = await tidyContainer(model, diagram);

    expect(result.domainGroups).toBeUndefined();
    const boundary = result.placements.find((p) => p.elementId === 'app');
    expect(boundary?.width).toBeGreaterThan(0);
    expect(boundary?.height).toBeGreaterThan(0);
  });

  it('routes its connections through the same router, clear of the non-endpoint components', async () => {
    // Container Tidy used to persist ELK's bendpoints; it now finishes on
    // `routeDiagramEdges` like layer7 does. The entry-per-connection assertion is the
    // one that would catch that wiring being dropped (the boundary/tier behaviour
    // itself is covered against a forced blocker in `routeOnly.test.ts`).
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        elt('app', 'application'),
        elt('c1', 'component', { parentApplicationId: 'app' }),
        elt('c2', 'component', { parentApplicationId: 'app' }),
        elt('c3', 'component', { parentApplicationId: 'app' }),
        elt('ext', 'externalSystem'),
      ],
      connections: [
        { id: 'c1-c3', sourceId: 'c1', targetId: 'c3', isBidirectional: false },
        { id: 'c1-c2', sourceId: 'c1', targetId: 'c2', isBidirectional: false },
        { id: 'c2-ext', sourceId: 'c2', targetId: 'ext', isBidirectional: false },
      ],
      diagrams: [
        {
          id: 'd2',
          kind: 'container',
          name: 'Container',
          applicationElementId: 'app',
          placements: [
            { elementId: 'app', x: 0, y: 0 },
            { elementId: 'c1', x: 0, y: 0 },
            { elementId: 'c2', x: 0, y: 0 },
            { elementId: 'c3', x: 0, y: 0 },
            { elementId: 'ext', x: 0, y: 0 },
          ],
        },
      ],
    };
    const result = await tidyContainer(model, model.diagrams[0]);

    expect((result.edgeRoutes ?? []).map((r) => r.connectionId).sort()).toEqual([
      'c1-c2',
      'c1-c3',
      'c2-ext',
    ]);

    const rectOf = (id: string): Rect => {
      const p = result.placements.find((pp) => pp.elementId === id)!;
      const size = placementSize(model.elements.find((e) => e.id === id)!.kind, p);
      return { x: p.x, y: p.y, width: size.width, height: size.height };
    };
    for (const conn of model.connections) {
      const others = ['c1', 'c2', 'c3']
        .filter((id) => id !== conn.sourceId && id !== conn.targetId)
        .map(rectOf);
      const route = result.edgeRoutes!.find((r) => r.connectionId === conn.id)!;
      const drawn = routedPath(rectOf(conn.sourceId), rectOf(conn.targetId), route.waypoints);
      expect(
        pathClearance(drawn, others),
        `${conn.id} runs too close to a component`,
      ).toBeGreaterThanOrEqual(ROUTE_CLEARANCE - CLEARANCE_TOLERANCE);
      // Clearing an obstacle is not enough: the segments must be square too.
      if (route.waypoints.length > 0) {
        expect(diagonalSegments(drawn), `${conn.id} has a diagonal segment`).toEqual([]);
      }
    }
  });
});

describe('tidyLayer7 — side-band order when the flow-axis barycentre ties', () => {
  /**
   * Faithful fixture of design 1 / diagram 1 as the engineer reviewed it: two
   * external systems in the right-hand band, one wired to the landscape node
   * NEAREST the band (ERP Integration Hub) and one to a node far away on the other
   * side of the board (Webshop Storefront).
   *
   * ELK lays the four applications out in a single left-to-right row, so every
   * landscape node shares one y centre (525.85 on this board) — which makes the
   * COLUMN band's barycentre identical for both members. That tie used to be settled
   * by the placements array, i.e. by the database, and it came out the wrong way:
   * Adyen (far partner) took the row-aligned top slot and its 1360 px line crossed
   * the short ERP→Dynamics line three times.
   */
  const model: DesignModel = {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      elt('akeneo', 'application'),
      elt('webshop', 'application'),
      elt('order', 'application'),
      elt('erp', 'application'),
      // Array order deliberately puts the FAR partner's system first — the order the
      // API returns, and the order the old tie-break simply passed through.
      elt('adyen', 'externalSystem'),
      elt('dynamics', 'externalSystem'),
    ],
    connections: [
      { id: 'akeneo-webshop', sourceId: 'akeneo', targetId: 'webshop', isBidirectional: false },
      { id: 'webshop-order', sourceId: 'webshop', targetId: 'order', isBidirectional: false },
      { id: 'order-erp', sourceId: 'order', targetId: 'erp', isBidirectional: false },
      { id: 'webshop-adyen', sourceId: 'webshop', targetId: 'adyen', label: 'authorizes payments', isBidirectional: false },
      { id: 'erp-dynamics', sourceId: 'erp', targetId: 'dynamics', label: 'syncs orders & stock', isBidirectional: false },
    ],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'akeneo', zone: 'landscape', domainGroup: 'Customer Experience', x: 0, y: 0 },
          { elementId: 'webshop', zone: 'landscape', domainGroup: 'Customer Experience', x: 0, y: 0 },
          { elementId: 'order', zone: 'landscape', domainGroup: 'Commerce Operations', x: 0, y: 0 },
          { elementId: 'erp', zone: 'landscape', domainGroup: 'Commerce Operations', x: 0, y: 0 },
          { elementId: 'adyen', zone: 'externalSystems', x: 0, y: 0 },
          { elementId: 'dynamics', zone: 'externalSystems', x: 0, y: 0 },
        ],
      },
    ],
  };

  it('orders the band by partner distance: the nearest partner takes the row-aligned slot', async () => {
    const result = await tidyLayer7(model, model.diagrams[0]);
    const yOf = (id: string) => result.placements.find((p) => p.elementId === id)!.y;

    // The premise: the flow-axis (y) barycentre really is a TIE, so the cross-axis
    // tie-break is what decides. Recomputed exactly as tidyLayer7 does. If ELK ever
    // stops laying the landscape out in one row this assertion is what tells us the
    // test has stopped exercising the tie.
    const landscapePos = new Map(
      ['akeneo', 'webshop', 'order', 'erp'].map((id) => {
        const p = result.placements.find((pp) => pp.elementId === id)!;
        return [id, { x: p.x, y: p.y, ...placementSize('application', p) }] as const;
      }),
    );
    const targets = bandTargets(
      model,
      model.diagrams[0].placements.filter((p) => p.zone === 'externalSystems'),
      landscapePos,
      'column',
    );
    expect(targets.get('adyen')!.centre).toBeCloseTo(targets.get('dynamics')!.centre, 6);
    // …and they are distinguished only by how far out their partners sit.
    expect(targets.get('dynamics')!.crossCentre).toBeGreaterThan(
      targets.get('adyen')!.crossCentre,
    );

    // ORDER, not pixels: Dynamics (partner = ERP Hub, right against the band) sits
    // ABOVE Adyen (partner = Webshop, at the far left of the landscape).
    expect(yOf('dynamics')).toBeLessThan(yOf('adyen'));
  });

  it('routes the near partner edge dead straight and stops the far one crossing it', async () => {
    // The payoff the ordering buys, and the reason it is worth a tie-break at all.
    // Wrong way round, ERP→Dynamics needed a bend and webshop→adyen crossed it three
    // times; with Dynamics on the landscape row the short edge is one horizontal line
    // and the long one passes below everything without touching it.
    const result = await tidyLayer7(model, model.diagrams[0]);
    const rectOf = (id: string): Rect => {
      const p = result.placements.find((pp) => pp.elementId === id)!;
      const size = placementSize(model.elements.find((e) => e.id === id)!.kind, p);
      return { x: p.x, y: p.y, width: size.width, height: size.height };
    };
    const pathOf = (connId: string) => {
      const conn = model.connections.find((c) => c.id === connId)!;
      const route = result.edgeRoutes!.find((r) => r.connectionId === connId)!;
      return routedPath(rectOf(conn.sourceId), rectOf(conn.targetId), route.waypoints);
    };

    const erpDynamics = pathOf('erp-dynamics');
    const ys = erpDynamics.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1); // one horizontal line

    expect(segmentCrossings(pathOf('webshop-adyen'), erpDynamics)).toBe(0);
  });

  it('mirrors the order for the LEFT column band, without a per-zone sign', async () => {
    // The tie-break is load-bearing for BOTH side bands, and a left band is where a
    // sign error would hide: design 1 ships exactly one input channel, so its own
    // geometry can never express an order. Hence the same landscape with a SECOND
    // channel added — `feedNear` talks to Akeneo (leftmost app, nearest this band),
    // `feedFar` to ERP (rightmost app, right across the board).
    //
    // Nothing in the ordering rule names a zone or carries a direction: it measures
    // the distance from the band's OWN cross-axis centre, which for a left band makes
    // the LEFTMOST partner the nearest one and flips the sign for free. Getting that
    // wrong here would push the short 0-bend feedNear→akeneo line into a 2-bend
    // detour that crosses feedFar's long run — measured, both ways.
    const leftModel: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        ...model.elements,
        elt('feedFar', 'inputChannel'),
        elt('feedNear', 'inputChannel'),
      ],
      connections: [
        ...model.connections,
        { id: 'feedFar-erp', sourceId: 'feedFar', targetId: 'erp', isBidirectional: false },
        { id: 'feedNear-akeneo', sourceId: 'feedNear', targetId: 'akeneo', isBidirectional: false },
      ],
      diagrams: [
        {
          ...model.diagrams[0],
          placements: [
            ...model.diagrams[0].placements,
            // Far partner FIRST again — the order the old stable sort passed through.
            { elementId: 'feedFar', zone: 'inputChannels', x: 0, y: 0 },
            { elementId: 'feedNear', zone: 'inputChannels', x: 0, y: 0 },
          ],
        },
      ],
    };
    const result = await tidyLayer7(leftModel, leftModel.diagrams[0]);
    const yOf = (id: string) => result.placements.find((p) => p.elementId === id)!.y;
    expect(yOf('feedNear')).toBeLessThan(yOf('feedFar'));
  });
});

/**
 * Phase 2 — per-group tidy. Scoped by construction: only the members whose
 * centre sits in the group box move, the box keeps its top-left and hugs them,
 * and the result is marked `partial` so `applyTidyResult` leaves the rest of
 * the board alone.
 */
describe('tidyGroup — one group in place', () => {
  const groupModel = (): DesignModel => ({
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      elt('a1', 'application'),
      elt('a2', 'application'),
      elt('outside', 'application'),
      elt('actor', 'actor'),
    ],
    connections: [
      { id: 'internal', sourceId: 'a1', targetId: 'a2', isBidirectional: false },
      { id: 'crossing', sourceId: 'a1', targetId: 'outside', isBidirectional: false },
      { id: 'elsewhere', sourceId: 'outside', targetId: 'actor', isBidirectional: false },
    ],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          // Both inside the Core box (stacked on top of each other — the mess
          // a per-group tidy is meant to sort out).
          { elementId: 'a1', zone: 'landscape', domainGroup: 'Core', x: 220, y: 220 },
          { elementId: 'a2', zone: 'landscape', domainGroup: 'Core', x: 230, y: 230 },
          // Outside every box, and a band node — neither may be touched.
          { elementId: 'outside', zone: 'landscape', x: 900, y: 900 },
          { elementId: 'actor', zone: 'actors', x: 100, y: 20 },
        ],
        layoutConfig: {
          domainGroups: [
            { name: 'Core', x: 200, y: 200, width: 400, height: 300 },
            { name: 'Other', x: 1200, y: 200, width: 200, height: 200 },
          ],
        },
      },
    ],
  });

  it('lays out only the group members, keeps the box top-left, and hugs them', async () => {
    const model = groupModel();
    const result = await tidyGroup(model, model.diagrams[0], 'Core');

    expect(result.partial).toBe(true);
    expect(result.canvas).toBeUndefined(); // a local tidy never resizes the board
    expect(result.placements.map((p) => p.elementId).sort()).toEqual(['a1', 'a2']);
    expect(result.domainGroups).toHaveLength(1);

    const box = result.domainGroups![0];
    expect(box.name).toBe('Core');
    // Anchored: the box keeps the top-left the user placed it at.
    expect(box.x).toBe(200);
    expect(box.y).toBe(200);

    // Members no longer overlap and every one sits inside the resized box.
    const kindById = new Map(model.elements.map((e) => [e.id, e.kind]));
    const rects = result.placements.map((p) => {
      const size = placementSize(kindById.get(p.elementId)!, p);
      return rect(p.x, p.y, size.width, size.height);
    });
    expect(rectIntersectsRect(rects[0], rects[1], 0)).toBe(false);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(box.x - 0.5);
      expect(r.y).toBeGreaterThanOrEqual(box.y - 0.5);
      expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
      expect(r.y + r.height).toBeLessThanOrEqual(box.y + box.height + 0.5);
    }
  });

  it('routes only the edges inside the group and touches nothing outside it', async () => {
    const model = groupModel();
    const result = await tidyGroup(model, model.diagrams[0], 'Core');

    const byId = new Map((result.edgeRoutes ?? []).map((r) => [r.connectionId, r]));
    expect(byId.has('internal')).toBe(true);
    // An edge crossing the box keeps whatever route it had — a group tidy must
    // not reach outside, and `partial` means anything unlisted is left alone.
    expect(byId.has('crossing')).toBe(false);
    // An edge with neither endpoint in the group is not this tidy's business.
    expect(byId.has('elsewhere')).toBe(false);
  });

  it('is a no-op for an unknown group name or an empty box', async () => {
    const model = groupModel();
    const diagram = model.diagrams[0];

    const missing = await tidyGroup(model, diagram, 'Nope');
    expect(missing).toEqual({ placements: [], partial: true });

    // 'Other' has a rect but no members inside it.
    const empty = await tidyGroup(model, diagram, 'Other');
    expect(empty).toEqual({ placements: [], partial: true });
  });

  it('takes membership from containment, not the stored domainGroup', async () => {
    const model = groupModel();
    const diagram = model.diagrams[0];
    // Sits in the Core box but was never tagged (e.g. dropped before the group
    // existed) — the user sees it inside, so Tidy must lay it out and tag it.
    diagram.placements.push({ elementId: 'outside', zone: 'landscape', x: 300, y: 300 });
    diagram.placements.splice(
      diagram.placements.findIndex((p) => p.elementId === 'outside' && p.x === 900),
      1,
    );

    const result = await tidyGroup(model, diagram, 'Core');

    expect(result.placements.map((p) => p.elementId).sort()).toEqual(['a1', 'a2', 'outside']);
    expect(result.placements.every((p) => p.domainGroup === 'Core')).toBe(true);
  });
});

/**
 * Phase 3 — Tidy settings. Direction and density reach ELK, `auto` resolves
 * from the shape of the box being filled, and "route connections only" redraws
 * the lines without moving a single node.
 */
describe('tidy settings (direction / density)', () => {
  const chain = (): DesignModel => ({
    name: 'ACME',
    customerName: 'ACME',
    elements: [elt('a', 'application'), elt('b', 'application'), elt('c', 'application')],
    connections: [
      { id: 'ab', sourceId: 'a', targetId: 'b', isBidirectional: false },
      { id: 'bc', sourceId: 'b', targetId: 'c', isBidirectional: false },
    ],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'a', zone: 'landscape', x: 0, y: 0 },
          { elementId: 'b', zone: 'landscape', x: 0, y: 0 },
          { elementId: 'c', zone: 'landscape', x: 0, y: 0 },
        ],
        layoutConfig: {},
      },
    ],
  });

  /** Spread of the laid-out chain along each axis. */
  async function spread(direction: TidyOptions['direction']) {
    const model = chain();
    const result = await tidyLayer7(model, model.diagrams[0], {
      ...DEFAULT_TIDY_OPTIONS,
      direction,
    });
    const xs = result.placements.map((p) => p.x);
    const ys = result.placements.map((p) => p.y);
    return { x: Math.max(...xs) - Math.min(...xs), y: Math.max(...ys) - Math.min(...ys) };
  }

  it('flows across for horizontal and down for vertical', async () => {
    const across = await spread('horizontal');
    expect(across.x).toBeGreaterThan(across.y);

    const down = await spread('vertical');
    expect(down.y).toBeGreaterThan(down.x);
  });

  it('spaces nodes further apart on spacious than on compact', async () => {
    const gapFor = async (density: TidyOptions['density']) => {
      const model = chain();
      const result = await tidyLayer7(model, model.diagrams[0], {
        ...DEFAULT_TIDY_OPTIONS,
        direction: 'horizontal',
        density,
      });
      const xs = result.placements.map((p) => p.x).sort((l, r) => l - r);
      return xs[xs.length - 1] - xs[0];
    };

    expect(await gapFor('spacious')).toBeGreaterThan(await gapFor('compact'));
  });

  it('auto follows the landscape zone: a tall board flows down, a wide one across', async () => {
    const runWith = async (canvas: { width: number; height: number }) => {
      const model = chain();
      const diagram = model.diagrams[0];
      diagram.layoutConfig = { canvas };
      const result = await tidyLayer7(model, diagram, DEFAULT_TIDY_OPTIONS);
      const xs = result.placements.map((p) => p.x);
      const ys = result.placements.map((p) => p.y);
      return { x: Math.max(...xs) - Math.min(...xs), y: Math.max(...ys) - Math.min(...ys) };
    };

    const wide = await runWith({ width: 2400, height: 900 });
    expect(wide.x).toBeGreaterThan(wide.y);

    const tall = await runWith({ width: 900, height: 2400 });
    expect(tall.y).toBeGreaterThan(tall.x);
  });
});

/**
 * Feedback round: the density setting has to mean the same thing wherever it is
 * applied. Layered spacing set on the root graph does NOT reach inside a
 * compound node, so a group's members used to be laid out at ELK's built-in
 * 20px default during a full tidy while the same group tidied on its own (a
 * flat graph) used the configured value.
 */
describe('density reaches inside a domain group', () => {
  const grouped = (): DesignModel => ({
    name: 'ACME',
    customerName: 'ACME',
    elements: ['a1', 'a2', 'a3'].map((id) => elt(id, 'application')),
    connections: [
      { id: 'a12', sourceId: 'a1', targetId: 'a2', isBidirectional: false },
      { id: 'a23', sourceId: 'a2', targetId: 'a3', isBidirectional: false },
    ],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: ['a1', 'a2', 'a3'].map((id) => ({
          elementId: id,
          zone: 'landscape' as const,
          domainGroup: 'Alpha',
          x: 300,
          y: 300,
        })),
        layoutConfig: { domainGroups: [{ name: 'Alpha', x: 250, y: 250, width: 900, height: 300 }] },
      },
    ],
  });

  /** Gap between the two left-most members along the flow axis. */
  const firstGap = (placements: { elementId: string; x: number }[]) => {
    const width = placementSize('application', {} as never).width;
    const xs = placements.map((p) => p.x).sort((l, r) => l - r);
    return xs[1] - xs[0] - width;
  };

  it('spaces group members the same in a full tidy as in a per-group tidy', async () => {
    const options: TidyOptions = { ...DEFAULT_TIDY_OPTIONS, direction: 'horizontal' };

    const model = grouped();
    const full = await tidyLayer7(model, model.diagrams[0], options);

    const solo = grouped();
    const group = await tidyGroup(solo, solo.diagrams[0], 'Alpha', options);

    expect(firstGap(group.placements)).toBeCloseTo(firstGap(full.placements), 0);
  });

  it('still honours compact vs spacious inside the group during a full tidy', async () => {
    const gapAt = async (density: TidyOptions['density']) => {
      const model = grouped();
      const result = await tidyLayer7(model, model.diagrams[0], {
        ...DEFAULT_TIDY_OPTIONS,
        direction: 'horizontal',
        density,
      });
      return firstGap(result.placements);
    };

    expect(await gapAt('spacious')).toBeGreaterThan(await gapAt('compact'));
  });
});

/**
 * Feedback round: "pin group placements". Groups keep the top-left the user
 * gave them; only their contents are re-laid-out and the box resizes to fit.
 */
describe('tidyLayer7 — pinGroups', () => {
  const pinned = (): DesignModel => ({
    name: 'ACME',
    customerName: 'ACME',
    elements: ['a1', 'a2', 'b1', 'b2', 'loose'].map((id) => elt(id, 'application')),
    connections: [
      { id: 'a12', sourceId: 'a1', targetId: 'a2', isBidirectional: false },
      { id: 'b12', sourceId: 'b1', targetId: 'b2', isBidirectional: false },
    ],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'a1', zone: 'landscape', domainGroup: 'Alpha', x: 320, y: 320 },
          { elementId: 'a2', zone: 'landscape', domainGroup: 'Alpha', x: 330, y: 330 },
          { elementId: 'b1', zone: 'landscape', domainGroup: 'Beta', x: 1220, y: 620 },
          { elementId: 'b2', zone: 'landscape', domainGroup: 'Beta', x: 1230, y: 630 },
          { elementId: 'loose', zone: 'landscape', x: 800, y: 900 },
        ],
        layoutConfig: {
          domainGroups: [
            { name: 'Alpha', x: 300, y: 300, width: 400, height: 300 },
            { name: 'Beta', x: 1200, y: 600, width: 400, height: 300 },
          ],
        },
      },
    ],
  });

  const options: TidyOptions = { ...DEFAULT_TIDY_OPTIONS, pinGroups: true };

  it('keeps every group box top-left and leaves loose nodes alone', async () => {
    const model = pinned();
    const result = await tidyLayer7(model, model.diagrams[0], options);

    const byName = new Map((result.domainGroups ?? []).map((g) => [g.name, g]));
    expect(byName.get('Alpha')).toMatchObject({ x: 300, y: 300 });
    expect(byName.get('Beta')).toMatchObject({ x: 1200, y: 600 });

    const loose = result.placements.find((p) => p.elementId === 'loose');
    expect(loose).toMatchObject({ x: 800, y: 900 });
  });

  it('lays the members out inside their own pinned box', async () => {
    const model = pinned();
    const result = await tidyLayer7(model, model.diagrams[0], options);

    const byName = new Map((result.domainGroups ?? []).map((g) => [g.name, g]));
    const kindById = new Map(model.elements.map((e) => [e.id, e.kind]));
    for (const placement of result.placements) {
      const groupName = model.diagrams[0].placements.find(
        (p) => p.elementId === placement.elementId,
      )?.domainGroup;
      if (!groupName) continue;
      const box = byName.get(groupName)!;
      const size = placementSize(kindById.get(placement.elementId)!, placement);
      expect(placement.x).toBeGreaterThanOrEqual(box.x - 0.5);
      expect(placement.y).toBeGreaterThanOrEqual(box.y - 0.5);
      expect(placement.x + size.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
      expect(placement.y + size.height).toBeLessThanOrEqual(box.y + box.height + 0.5);
    }
  });

  it('resizes the box to hug its members (a stacked pair no longer overlaps)', async () => {
    const model = pinned();
    const result = await tidyLayer7(model, model.diagrams[0], options);

    const kindById = new Map(model.elements.map((e) => [e.id, e.kind]));
    const rects = ['a1', 'a2'].map((id) => {
      const p = result.placements.find((pl) => pl.elementId === id)!;
      const size = placementSize(kindById.get(id)!, p);
      return rect(p.x, p.y, size.width, size.height);
    });
    expect(rectIntersectsRect(rects[0], rects[1], 0)).toBe(false);
  });

  it('moves the groups when the pin is off (the unpinned tidy still re-places them)', async () => {
    const model = pinned();
    const result = await tidyLayer7(model, model.diagrams[0], DEFAULT_TIDY_OPTIONS);

    const alpha = (result.domainGroups ?? []).find((g) => g.name === 'Alpha')!;
    expect([alpha.x, alpha.y]).not.toEqual([300, 300]);
  });

  /**
   * `settleBoard` solves for the fixed point of "the board the bands allow, the
   * bands the board allows", so pressing Tidy on what Tidy just returned must
   * hand back the same board. The pinned path has its OWN settleBoard call with
   * a different `neededFor` — it measures the boxes where the user left them
   * instead of re-centring a block — so it can settle where the unpinned path
   * does not, and the unpinned test at "settles in ONE press" does not cover it.
   */
  it('settles the board in ONE press with the groups pinned', async () => {
    const model = pinned();
    const deep: DesignModel = {
      ...model,
      diagrams: [
        {
          ...model.diagrams[0],
          layoutConfig: {
            ...model.diagrams[0].layoutConfig,
            canvas: { width: 4800, height: 3200 },
            zones: { management: { size: 1100 } },
          },
        },
      ],
    };

    const first = await tidyLayer7(deep, deep.diagrams[0], options);
    // The board genuinely had to settle — on a board that already fits, the
    // second pass would match for free and pin nothing.
    expect(first.canvas).not.toEqual({ width: 4800, height: 3200 });

    const settled: DesignModel = {
      ...deep,
      diagrams: [
        {
          ...deep.diagrams[0],
          placements: first.placements,
          layoutConfig: {
            ...deep.diagrams[0].layoutConfig,
            canvas: first.canvas,
            domainGroups: first.domainGroups,
          },
        },
      ],
    };
    const second = await tidyLayer7(settled, settled.diagrams[0], options);
    expect(second.canvas).toEqual(first.canvas);
  });
});

/**
 * A group's colour must survive Tidy.
 *
 * Every path through Tidy REBUILDS the group rects from their members' bounds, so
 * the rect that comes back is a fresh object. Before `keepGroupColors`, the first
 * Tidy after colouring a group silently reverted it to neutral — the colour
 * survived saving, reloading and dragging, and died on the button people press
 * most. All three paths are covered because all three rebuild.
 */
describe('tidy — a domain group keeps its colour', () => {
  const coloured = (): DesignModel => ({
    name: 'ACME',
    customerName: 'ACME',
    elements: ['a1', 'a2'].map((id) => elt(id, 'application')),
    connections: [{ id: 'a12', sourceId: 'a1', targetId: 'a2', isBidirectional: false }],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'a1', zone: 'landscape', domainGroup: 'Alpha', x: 320, y: 320 },
          { elementId: 'a2', zone: 'landscape', domainGroup: 'Alpha', x: 420, y: 330 },
        ],
        layoutConfig: {
          domainGroups: [
            { name: 'Alpha', x: 300, y: 300, width: 400, height: 300, color: '#2f6fdb' },
          ],
        },
      },
    ],
  });

  const colorOf = (result: { domainGroups?: { name: string; color?: string }[] }) =>
    (result.domainGroups ?? []).find((g) => g.name === 'Alpha')?.color;

  it('through the full board tidy', async () => {
    const model = coloured();
    expect(colorOf(await tidyLayer7(model, model.diagrams[0], DEFAULT_TIDY_OPTIONS))).toBe(
      '#2f6fdb',
    );
  });

  it('through a pinned-groups tidy', async () => {
    const model = coloured();
    const options: TidyOptions = { ...DEFAULT_TIDY_OPTIONS, pinGroups: true };
    expect(colorOf(await tidyLayer7(model, model.diagrams[0], options))).toBe('#2f6fdb');
  });

  it('through a single-group tidy', async () => {
    const model = coloured();
    expect(colorOf(await tidyGroup(model, model.diagrams[0], 'Alpha', DEFAULT_TIDY_OPTIONS))).toBe(
      '#2f6fdb',
    );
  });

  it('and an uncoloured group stays uncoloured rather than gaining a key', async () => {
    const model = coloured();
    delete model.diagrams[0].layoutConfig!.domainGroups![0].color;
    const result = await tidyLayer7(model, model.diagrams[0], DEFAULT_TIDY_OPTIONS);
    const alpha = (result.domainGroups ?? []).find((g) => g.name === 'Alpha')!;
    expect('color' in alpha).toBe(false);
  });
});

/**
 * `settleBoard` iterates to a fixed point under a round cap, so it has two
 * exits: the board stopped moving, or the loop ran out with it still moving.
 * They return the same shape, and telling them apart is the whole point —
 * a board one round short of settling looks exactly like a settled one and
 * only gives itself away as movement on the NEXT press. That is how a
 * six-round cap survived a fix, a review and a hand reproduction.
 */
describe('settleBoard — convergence is reported, not assumed', () => {
  /** Bands stored deeper than any board allows, so each one tracks its fraction. */
  const fractionLimited = { actors: { size: 9000 }, management: { size: 9000 } };

  it('reports a settled board, and the board it returns really is a fixed point', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const neededFor = (sizes: Record<string, number>) => ({
      width: 560 + sizes.inputChannels + sizes.externalSystems,
      height: 340 + sizes.actors + sizes.management,
    });
    const config = { canvas: { width: 4800, height: 3200 }, zones: fractionLimited };

    const first = settleBoard(neededFor, config, 'test/fixed-point');
    expect(first.settled).toBe(true);
    expect(warn).not.toHaveBeenCalled();

    // The real assertion behind the flag: re-entering on what it returned is a
    // no-op. This is also the worst descent the cap has to clear — the ceiling
    // down to a fixed point that sits just above the floor, so it never short-
    // cuts by clamping. Drop SETTLE_ROUNDS back to 6 and this fails.
    const again = settleBoard(neededFor, { ...config, canvas: first.canvas }, 'test/re-entry');
    expect(again.canvas).toEqual(first.canvas);
    warn.mockRestore();
  });

  /**
   * The cap is a budget for MOVES, and the round that reaches the fixed point is
   * not the round that can prove it: each iterate is only ever compared with the
   * one before it, so a board that lands on its fixed point with the last round
   * of the budget leaves the loop looking unsettled. That warning is false — it
   * promises movement on the next press from a board that will not move — and a
   * flag that cries wolf on a settled board is worth as little as one that stays
   * quiet on a moving one.
   */
  it('a board that settles on the last round the cap allows is not reported as exhausted', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Walk the board down 1px a round for exactly SETTLE_ROUNDS rounds and then
    // stand still: the board the last round hands back IS the fixed point, and
    // only one more application of the map can say so.
    let rounds = 0;
    const neededFor = () => {
      rounds++;
      return { width: 4000 - Math.min(rounds, SETTLE_ROUNDS), height: 3000 };
    };

    const result = settleBoard(neededFor, undefined, 'test/last-round');

    expect(result.canvas).toEqual({ width: 4000 - SETTLE_ROUNDS, height: 3000 });
    expect(result.settled).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reports an exhausted settle instead of a mis-sized board that looks settled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Non-monotone on purpose: demand a small board once the bands are deep and
    // a large one once they are shallow, and the two chase each other forever.
    // No cap bounds a cycle, so the cap cannot be the guarantee — the flag is.
    const result = settleBoard(
      (sizes) =>
        sizes.management > 400 ? { width: 900, height: 600 } : { width: 4000, height: 3000 },
      { zones: { management: { size: 9000 } } },
      'test/cycle',
    );

    expect(result.settled).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('did not settle'));
    warn.mockRestore();
  });

  /**
   * The warning is the only trace an exhausted settle leaves in a browser, and
   * the four call sites are not equally serious — the pinned and unpinned boards
   * staircase on the next press, the centring estimate only misplaces the block,
   * the empty-landscape call cannot exhaust. An anonymous message cannot tell an
   * engineer which one they are looking at, which is how the pinned path came to
   * be fixed second: the symptom did not name the path.
   *
   * The label is deliberately one that appears nowhere else in the source: pass
   * a real path like `tidyLandscapePinned` and a warning that hardcodes one of
   * the four still satisfies this, leaving the other three warning under the
   * wrong name.
   */
  it('names the call site in the warning, so the four are not one symptom', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    settleBoard(
      (sizes) =>
        sizes.management > 400 ? { width: 900, height: 600 } : { width: 4000, height: 3000 },
      { zones: { management: { size: 9000 } } },
      'test/pinned',
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('test/pinned'));
    warn.mockRestore();
  });

  it('still returns bands that hold on the board it gives back, even when exhausted', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = settleBoard(
      (sizes) =>
        sizes.management > 400 ? { width: 900, height: 600 } : { width: 4000, height: 3000 },
      { zones: { management: { size: 9000 } } },
      'test/cycle',
    );

    // The canvas is not a fixed point, but sizes must still describe THAT canvas
    // rather than some earlier round's — an exhausted settle must not also hand
    // back bands from a board it already left.
    expect(result.sizes).toEqual(zoneSizes({ zones: { management: { size: 9000 } }, canvas: result.canvas }));
    warn.mockRestore();
  });
});

/**
 * The round cap is derived from the canvas limits and the band fractions (see
 * SETTLE_ROUNDS). Derived in a comment is documentary: change
 * `CANVAS_SIZE_LIMITS` or a band fraction and 32 quietly stops being enough,
 * with nothing to fail — the symptom is a board that comes back a few pixels
 * off and moves again on the next press, which is the bug this whole mechanism
 * exists to stop and the one that already slipped through once.
 *
 * So re-derive the worst case here, from the same constants the code uses, and
 * require the cap to clear it.
 */
describe('the round cap clears the worst descent the limits allow', () => {
  /**
   * Recover a band's max fraction from the public limit rather than restating
   * the number: `zoneSizeLimits` is what applies it, so this keeps following the
   * constant wherever it lives and whatever shape it takes.
   */
  const fractionOf = (zone: ResizableZone, basis: 'width' | 'height'): number => {
    const canvas = {
      width: CANVAS_SIZE_LIMITS.maxWidth,
      height: CANVAS_SIZE_LIMITS.maxHeight,
    };
    return zoneSizeLimits(zone, { canvas }).max / canvas[basis];
  };

  /** The two bands that share an axis, and the largest descent that axis allows. */
  const AXES = [
    {
      name: 'height',
      basis: 'height' as const,
      zones: ['actors', 'management'] as ResizableZone[],
      gap: CANVAS_SIZE_LIMITS.maxHeight - CANVAS_SIZE_LIMITS.minHeight,
    },
    {
      name: 'width',
      basis: 'width' as const,
      zones: ['inputChannels', 'externalSystems'] as ResizableZone[],
      gap: CANVAS_SIZE_LIMITS.maxWidth - CANVAS_SIZE_LIMITS.minWidth,
    },
  ];

  const roundsFor = (fraction: number, gap: number) => {
    // Geometric phase: a round closes the gap to the fixed point by `fraction`,
    // so it takes this many to come within 1px.
    const geometric = Math.ceil(Math.log(gap) / Math.log(1 / fraction));
    // Then rounding each band injects up to 1px a round and contraction stalls
    // at e = fraction·e + 1. Past there the sequence is monotone and
    // integer-stepped, losing at least 1px a round.
    const tail = Math.ceil(1 / (1 - fraction));
    return geometric + tail;
  };

  it.each(AXES)('$name: the bands leave the landscape a positive share', ({ zones, basis }) => {
    // The precondition of the whole fixed-point argument, not a formality: at a
    // combined fraction of 1 the bands eat the axis, the recurrence stops
    // contracting and no cap converges. It is also the invariant that keeps the
    // landscape rect positive.
    const fraction = zones.reduce((sum, zone) => sum + fractionOf(zone, basis), 0);
    expect(fraction).toBeLessThan(1);
  });

  it('SETTLE_ROUNDS exceeds the worst case both axes allow', () => {
    const worst = Math.max(
      ...AXES.map(({ zones, basis, gap }) =>
        roundsFor(
          zones.reduce((sum, zone) => sum + fractionOf(zone, basis), 0),
          gap,
        ),
      ),
    );

    expect(SETTLE_ROUNDS).toBeGreaterThan(worst);
  });

  it('and would go red on a change that outgrows it, rather than staircasing', () => {
    // Guards the guard: the assertion above only means something if the formula
    // can fail.
    //
    // The two constants pull with very different force, which is worth knowing
    // before reading a green tick as "any change is safe". Rounds grow with the
    // LOG of the board, so doubling the ceiling costs about two (3200 → 27,
    // 6400 → 29, 12800 → 31) and the cap only runs out past a ~22000px board.
    // They blow up as the combined fraction nears 1, where the tail 1/(1 − f)
    // diverges: 0.70 → 27, 0.75 → 32, 0.80 → 42, 0.90 → 86. So the live risk is
    // a band grab, not a bigger board — deepening each band from 0.35 to 0.375
    // is enough to trip this.
    const gap = CANVAS_SIZE_LIMITS.maxHeight - CANVAS_SIZE_LIMITS.minHeight;
    expect(roundsFor(0.9, gap)).toBeGreaterThan(SETTLE_ROUNDS);
  });
});
