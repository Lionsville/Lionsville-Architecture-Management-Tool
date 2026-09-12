import { describe, expect, it } from 'vitest';
import { memberOf, nodeGeometryOf } from '../model/placement';
import { nodeFigure } from '../model/kinds';
import type { NodeFigure } from '../model/kinds';
import type { EdgeRoute } from '../model/types';
import { laidOut } from '../model/testFixtures';
import type {
  DesignConnection,
  Relation,
  DesignDiagram,
  DesignElement,
  DesignModel,
  Rect,
} from '../model/types';
import { placedNodes, placementSize } from '../model/placement';
import { routeDiagramEdges } from './routeOnly';
import type { TidyResult } from './tidy';
import { tidyLayer7 } from './tidy';
import { LABEL_MARGIN, ROUTE_CLEARANCE, rectContainsPoint } from './routing';
import { edgeLabelSize } from './edgeLabelSize';
import { pathHitsObstacles, rectIntersectsRect } from './geometry';
import { pathClearance, routedPath } from './routeTestSupport';

/**
 * Route-only: re-route edges around obstacles WITHOUT moving nodes. The
 * assertions are geometric invariants on the RENDERED path (via `routedPath`),
 * not pixel positions — libavoid's exact coordinates are its business, and
 * hardcoding them would turn every router upgrade into a test rewrite.
 */

/** A landscape box, named by what the board draws it as (see tidy.test.ts). */
function elt(id: string, figure: NodeFigure): DesignElement {
  return {
    id,
    kind: figure === 'actor' || figure === 'component' ? figure : 'application',
    ...(figure === 'externalSystem' ? { outside: true as const } : {}),
    name: id,
    lifecycle: 'live',
    isManaged: true,
    aspects: {},
  };
}

const rectFor = (model: DesignModel, diagram: DesignDiagram, id: string): Rect => {
  const p = placedNodes(diagram).find((pp) => pp.id === id)!;
  const el = model.elements.find((e) => e.id === id)!;
  const size = placementSize(nodeFigure(el, p.zone), p);
  return { x: p.x, y: p.y, width: size.width, height: size.height };
};

const labelRectAt = (conn: DesignConnection, at: { x: number; y: number }): Rect => {
  const size = edgeLabelSize(conn)!;
  return {
    x: at.x - size.width / 2,
    y: at.y - size.height / 2,
    width: size.width,
    height: size.height,
  };
};

/**
 * Two applications far apart on the landscape, plus whatever obstacle the test
 * needs between them. `a` sits left, `b` sits right, both on the same row.
 */
function twoNodeModel(options: {
  connection?: Partial<DesignConnection>;
  groups?: { id: string; x: number; y: number; width: number; height: number }[];
  extraNodes?: { id: string; x: number; y: number }[];
  extraConnections?: Relation[];
  edgeRoutes?: EdgeRoute[];
}): { model: DesignModel; diagram: DesignDiagram } {
  const extras = options.extraNodes ?? [];
  const diagram: DesignDiagram = laidOut({
    id: 'd1',
    kind: 'layer7',
    name: 'L7',
    placements: [
      { id: 'a', zone: 'landscape', x: 100, y: 400 },
      { id: 'b', zone: 'landscape', x: 1200, y: 400 },
      ...extras.map((n) => ({ id: n.id, zone: 'landscape' as const, x: n.x, y: n.y })),
    ],
    edgeRoutes: (options.edgeRoutes ?? []),
    layoutConfig: options.groups ? { domainGroups: options.groups } : undefined,
  });
  const model: DesignModel = {
    name: 'ACME',
    customerName: 'ACME',
    elements: [elt('a', 'application'), elt('b', 'application'), ...extras.map((n) => elt(n.id, 'application'))],
    relations: [
      { type: 'flow', id: 'a-b', sourceId: 'a', targetId: 'b', isBidirectional: false, ...options.connection },
      ...(options.extraConnections ?? []),
    ],
    diagrams: [diagram],
  };
  return { model, diagram };
}

const routeOf = (result: TidyResult, relationId: string) =>
  (result.edgeRoutes ?? [])!.find((r) => r.relationId === relationId);

describe('routeDiagramEdges — route-only pass', () => {
  it('leaves a clear edge straight and commits no placements or layout config', async () => {
    const { model, diagram } = twoNodeModel({});
    const result = await routeDiagramEdges(model, diagram);

    expect(routeOf(result, 'a-b')!.waypoints).toEqual([]);
    // Routes ONLY: nothing that would move a node or resize the board.
    expect(result.placements).toEqual([]);
    expect(result.canvas).toBeUndefined();
    expect(result.domainGroups).toBeUndefined();
  });

  it('detours around a domain-group box sitting between the endpoints', async () => {
    const group = { id: 'Ops', x: 600, y: 350, width: 300, height: 260 };
    const { model, diagram } = twoNodeModel({ groups: [group] });
    const a = rectFor(model, diagram, 'a');
    const b = rectFor(model, diagram, 'b');
    // Sanity: the straight line really does cut through the box.
    expect(pathHitsObstacles(routedPath(a, b, []), [group], ROUTE_CLEARANCE)).toBeGreaterThan(0);

    const route = routeOf(await routeDiagramEdges(model, diagram), 'a-b')!;
    expect(route.waypoints.length).toBeGreaterThan(0);
    expect(pathHitsObstacles(routedPath(a, b, route.waypoints), [group], ROUTE_CLEARANCE)).toBe(0);
  });

  it('detours around a NODE that sits in the way — the obstacle class Tidy ignores', async () => {
    // No groups at all: the only thing between a and b is a third node, which the
    // cross-zone pass would happily draw straight through.
    const { model, diagram } = twoNodeModel({ extraNodes: [{ id: 'c', x: 650, y: 380 }] });
    const result = await routeDiagramEdges(model, diagram);

    const route = routeOf(result, 'a-b')!;
    expect(route.waypoints.length).toBeGreaterThan(0);
    const cRect = rectFor(model, diagram, 'c');
    const drawn = routedPath(rectFor(model, diagram, 'a'), rectFor(model, diagram, 'b'), route.waypoints);
    expect(pathHitsObstacles(drawn, [cRect], ROUTE_CLEARANCE)).toBe(0);
  });

  it('does not treat a group box CONTAINING an endpoint as an obstacle', async () => {
    // A box wrapping node `a`: it straddles the straight line, but it is `a`'s own
    // container (geometrically — `a` has no group field at all), so the edge
    // must stay straight rather than bow around it.
    const own = { id: 'Home', x: 60, y: 360, width: 300, height: 220 };
    const { model, diagram } = twoNodeModel({ groups: [own] });
    const result = await routeDiagramEdges(model, diagram);

    expect(routeOf(result, 'a-b')!.waypoints).toEqual([]);
  });

  it('keeps the stored route of an edge the router cannot route at all', async () => {
    // A self-connection has no orthogonal route between a point and itself, so the
    // router returns no entry for it — the one shape "unroutable" still takes now
    // that a global router answers every other case. Route-only must never make the
    // diagram worse than the user left it, so the stored route survives verbatim.
    //
    // This is the `keep-stored` half of `DeclinedPolicy`, and it is right ONLY because
    // this pass moves no node. Tidy moves them all and must therefore CLEAR the same
    // edge — asserted from the other side in `tidy.test.ts`. Do not unify them.
    const stored = [{ relationId: 'a-a', waypoints: [{ x: 700, y: 900 }] }];
    const { model, diagram } = twoNodeModel({
      extraConnections: [{ type: 'flow', id: 'a-a', sourceId: 'a', targetId: 'a', isBidirectional: false }],
      edgeRoutes: stored,
    });

    const result = await routeDiagramEdges(model, diagram);
    expect(routeOf(result, 'a-a')).toEqual({
      relationId: 'a-a',
      waypoints: [{ x: 700, y: 900 }],
      labelPosition: undefined,
    });
  });

  it('omits an entry for an unroutable edge that has no stored route', async () => {
    const { model, diagram } = twoNodeModel({
      extraConnections: [{ type: 'flow', id: 'a-a', sourceId: 'a', targetId: 'a', isBidirectional: false }],
    });
    expect(routeOf(await routeDiagramEdges(model, diagram), 'a-a')).toBeUndefined();
  });

  it('pins the label clear of every group box', async () => {
    const group = { id: 'Ops', x: 600, y: 350, width: 300, height: 260 };
    const { model, diagram } = twoNodeModel({
      groups: [group],
      connection: { label: 'syncs orders & stock' },
    });
    const result = await routeDiagramEdges(model, diagram);

    const route = routeOf(result, 'a-b')!;
    expect(route.labelPosition).toBeDefined();
    const labelRect = labelRectAt(model.relations[0], route.labelPosition!);
    expect(rectIntersectsRect(labelRect, group, LABEL_MARGIN)).toBe(false);
  });

  it('still pins the label of an edge that lives INSIDE a group box', async () => {
    // Clearing the group boxes is a hard requirement in `labelSpotFor`, so counting
    // the box an edge sits inside would reject every spot on it and leave the chip
    // unpinned: free to auto-centre onto a member card, and invisible to the
    // chip-vs-chip pass that keeps neighbouring labels apart. On a grouped layer7
    // board most edges are intra-group, so that is the common case, not the corner.
    const group = { id: 'Ops', x: 60, y: 350, width: 1400, height: 300 };
    const { model, diagram } = twoNodeModel({
      groups: [group],
      connection: { label: 'syncs orders & stock' },
    });
    const result = await routeDiagramEdges(model, diagram);

    const route = routeOf(result, 'a-b')!;
    expect(route.labelPosition).toBeDefined();
    // Its own box is excused, but the members it runs between are not.
    const labelRect = labelRectAt(model.relations[0], route.labelPosition!);
    for (const id of ['a', 'b']) {
      expect(rectIntersectsRect(labelRect, rectFor(model, diagram, id), LABEL_MARGIN)).toBe(false);
    }
  });

  it('keeps pinning an intra-group label clear of OTHER group boxes', async () => {
    const home = { id: 'Home', x: 60, y: 350, width: 1400, height: 300 };
    // A second box overlapping the run between `a` and `b`, holding neither of them.
    const other = { id: 'Other', x: 600, y: 360, width: 300, height: 280 };
    const { model, diagram } = twoNodeModel({
      groups: [home, other],
      connection: { label: 'syncs orders & stock' },
    });

    const route = routeOf(await routeDiagramEdges(model, diagram), 'a-b')!;
    expect(route.labelPosition).toBeDefined();
    const labelRect = labelRectAt(model.relations[0], route.labelPosition!);
    expect(rectIntersectsRect(labelRect, other, LABEL_MARGIN)).toBe(false);
  });

  it('is deterministic — two runs on identical input give identical routes', async () => {
    const { model, diagram } = twoNodeModel({
      groups: [{ id: 'Ops', x: 600, y: 350, width: 300, height: 260 }],
      connection: { label: 'places orders' },
      extraNodes: [{ id: 'c', x: 650, y: 700 }],
    });
    expect(await routeDiagramEdges(model, diagram)).toEqual(await routeDiagramEdges(model, diagram));
  });

  it('groups a node by its POSITION, not by its stale group field', async () => {
    // The board a hand-nudge leaves behind: `a` still claims to be in Ops (group
    // boxes are only recomputed by a full Tidy) but sits well outside it. Treating
    // the field as truth would make Ops stand in for `a`, hiding the box, and the
    // edge would be drawn straight through it.
    const group = { id: 'Ops', x: 600, y: 350, width: 300, height: 260 };
    const { model, diagram } = twoNodeModel({ groups: [group] });
    diagram.geometry.nodes = placedNodes(diagram).map((p) =>
      p.id === 'a' ? { ...p, domainGroup: 'Ops' } : p,
    );

    const route = routeOf(await routeDiagramEdges(model, diagram), 'a-b')!;
    const drawn = routedPath(rectFor(model, diagram, 'a'), rectFor(model, diagram, 'b'), route.waypoints);
    expect(pathHitsObstacles(drawn, [group], ROUTE_CLEARANCE)).toBe(0);
  });

  it('resolves overlapping group boxes by NAME, so array order cannot change a route', async () => {
    // `a`'s centre sits in both boxes, `b`'s only in Wide, and `c` — squarely on the
    // straight run — in neither. Picking by name puts `a` in Narrow and `b` in Wide:
    // different groups, so the edge is inter-group and must dodge the ungrouped `c`.
    // Picking by ARRAY ORDER would put both in Wide for one of these two orderings,
    // making the edge intra-group, and `c` — not a member — would stop being an
    // obstacle at all: the edge would be drawn straight through it.
    const wide = { id: 'Wide', x: 50, y: 440, width: 1400, height: 50 };
    const narrow = { id: 'Narrow', x: 60, y: 450, width: 400, height: 30 };
    const blocker = [{ id: 'c', x: 650, y: 455 }];
    const forward = twoNodeModel({ groups: [wide, narrow], extraNodes: blocker });
    const reversed = twoNodeModel({ groups: [narrow, wide], extraNodes: blocker });

    const first = await routeDiagramEdges(forward.model, forward.diagram);
    expect((first.edgeRoutes ?? [])).toEqual(
      (await routeDiagramEdges(reversed.model, reversed.diagram)).edgeRoutes,
    );

    const a = rectFor(forward.model, forward.diagram, 'a');
    const b = rectFor(forward.model, forward.diagram, 'b');
    const c = rectFor(forward.model, forward.diagram, 'c');
    // Sanity: `c` really is on the straight run, so "clears it" is not free.
    expect(pathHitsObstacles(routedPath(a, b, []), [c], ROUTE_CLEARANCE)).toBeGreaterThan(0);
    const drawn = routedPath(a, b, routeOf(first, 'a-b')!.waypoints);
    expect(pathHitsObstacles(drawn, [c], ROUTE_CLEARANCE)).toBe(0);
  });

  it('routes only the owned connections while every placement still blocks', async () => {
    // `routeOnlyBetween` narrows what the pass OWNS, never the obstacle set — the
    // seam a per-group Tidy routes through. `c` is not an owned endpoint, so its edge
    // gets no entry (not even a cleared one, despite `'clear'`), but it is still on
    // the board and must still push `a-b` aside.
    const { model, diagram } = twoNodeModel({
      extraNodes: [{ id: 'c', x: 650, y: 380 }],
      extraConnections: [{ type: 'flow', id: 'b-c', sourceId: 'b', targetId: 'c', isBidirectional: false }],
    });
    const a = rectFor(model, diagram, 'a');
    const b = rectFor(model, diagram, 'b');
    const c = rectFor(model, diagram, 'c');
    // Sanity: `c` really is on the straight run, so "clears it" is not free.
    expect(pathHitsObstacles(routedPath(a, b, []), [c], ROUTE_CLEARANCE)).toBeGreaterThan(0);

    const result = await routeDiagramEdges(model, diagram, 'clear', new Set(['a', 'b']));

    expect(routeOf(result, 'b-c')).toBeUndefined();
    const route = routeOf(result, 'a-b')!;
    expect(route.waypoints.length).toBeGreaterThan(0);
    expect(pathHitsObstacles(routedPath(a, b, route.waypoints), [c], ROUTE_CLEARANCE)).toBe(0);
  });

  it('skips a connection whose endpoint is not on this diagram', async () => {
    const { model, diagram } = twoNodeModel({});
    model.elements.push(elt('elsewhere', 'application'));
    model.relations.push({
      type: 'flow',
      id: 'a-elsewhere',
      sourceId: 'a',
      targetId: 'elsewhere',
      isBidirectional: false,
    });
    const result = await routeDiagramEdges(model, diagram);
    expect(routeOf(result, 'a-elsewhere')).toBeUndefined();
  });

  it('routes a container diagram: the application boundary is not an obstacle for its own components', async () => {
    // The boundary CONTAINS the component endpoint, so it must not be detoured
    // around; the loose context node between them must be.
    const diagram: DesignDiagram = laidOut({
      id: 'c1',
      kind: 'container',
      name: 'App',
      applicationElementId: 'app',
      placements: [
        { id: 'app', x: 500, y: 300, width: 400, height: 300 },
        { id: 'svc', x: 600, y: 400 },
        { id: 'ext', x: 1200, y: 420 },
        { id: 'blocker', x: 1000, y: 410 },
      ],
    });
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        elt('app', 'application'),
        elt('svc', 'component'),
        elt('ext', 'externalSystem'),
        elt('blocker', 'application'),
      ],
      relations: [{ type: 'flow', id: 'svc-ext', sourceId: 'svc', targetId: 'ext', isBidirectional: false }],
      diagrams: [diagram],
    };

    const svc = rectFor(model, diagram, 'svc');
    const ext = rectFor(model, diagram, 'ext');
    const blocker = rectFor(model, diagram, 'blocker');
    // Sanity: the straight line really does cut through the blocker.
    expect(pathHitsObstacles(routedPath(svc, ext, []), [blocker], ROUTE_CLEARANCE)).toBeGreaterThan(0);

    const route = routeOf(await routeDiagramEdges(model, diagram), 'svc-ext')!;
    expect(route.waypoints.length).toBeGreaterThan(0);
    const drawn = routedPath(svc, ext, route.waypoints);
    expect(pathHitsObstacles(drawn, [blocker], ROUTE_CLEARANCE)).toBe(0);
    // …and it did NOT bow around the boundary its own source lives inside: the
    // path still leaves through the boundary rect rather than circling it.
    expect(pathHitsObstacles(drawn, [rectFor(model, diagram, 'app')], 0)).toBeGreaterThan(0);
  });

  it('treats the container boundary as a synthetic group: opaque outside, routable inside', async () => {
    // Both halves of the synthetic-group trick in one board. `west`/`east` sit
    // outside the boundary, so their edge is an inter-group edge that must go
    // AROUND the whole box; `c1`/`c2` sit inside it, so their edge is an
    // intra-group edge that must dodge their sibling `mid` and nothing else.
    const diagram: DesignDiagram = laidOut({
      id: 'c1',
      kind: 'container',
      name: 'App',
      applicationElementId: 'app',
      placements: [
        { id: 'app', x: 400, y: 200, width: 700, height: 500 },
        { id: 'c1', x: 450, y: 250 },
        { id: 'mid', x: 650, y: 400 },
        { id: 'c2', x: 850, y: 550 },
        { id: 'west', x: 100, y: 420 },
        { id: 'east', x: 1300, y: 420 },
      ],
    });
    const model: DesignModel = {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        elt('app', 'application'),
        elt('c1', 'component'),
        elt('mid', 'component'),
        elt('c2', 'component'),
        elt('west', 'application'),
        elt('east', 'application'),
      ],
      relations: [
        { type: 'flow', id: 'c1-c2', sourceId: 'c1', targetId: 'c2', isBidirectional: false },
        { type: 'flow', id: 'west-east', sourceId: 'west', targetId: 'east', isBidirectional: false },
      ],
      diagrams: [diagram],
    };
    const rect = (id: string) => rectFor(model, diagram, id);
    const app = rect('app');
    // Sanity: straight, the outside edge cuts the boundary and the inside edge
    // cuts its sibling — both are genuinely blocked before we assert they clear.
    expect(
      pathHitsObstacles(routedPath(rect('west'), rect('east'), []), [app], ROUTE_CLEARANCE),
    ).toBeGreaterThan(0);
    expect(
      pathHitsObstacles(routedPath(rect('c1'), rect('c2'), []), [rect('mid')], ROUTE_CLEARANCE),
    ).toBeGreaterThan(0);

    const result = await routeDiagramEdges(model, diagram);

    // Tier 1: the boundary is ONE opaque box, so the outside edge clears it whole.
    const outside = routeOf(result, 'west-east')!;
    expect(outside.waypoints.length).toBeGreaterThan(0);
    const outsideDrawn = routedPath(rect('west'), rect('east'), outside.waypoints);
    expect(pathHitsObstacles(outsideDrawn, [app], ROUTE_CLEARANCE)).toBe(0);

    // Tier 2: inside, the boundary is not an obstacle at all — the edge dodges its
    // sibling and still crosses the boundary rect rather than leaving it.
    const inside = routeOf(result, 'c1-c2')!;
    expect(inside.waypoints.length).toBeGreaterThan(0);
    const insideDrawn = routedPath(rect('c1'), rect('c2'), inside.waypoints);
    expect(pathHitsObstacles(insideDrawn, [rect('mid')], ROUTE_CLEARANCE)).toBe(0);
    expect(insideDrawn.every((p) => rectContainsPoint(app, p))).toBe(true);
  });
});

describe('routeDiagramEdges — real E-Commerce landscape after a manual nudge', () => {
  // The fixture from `tidy.test.ts`: tidy it for real, then drag one node into
  // another edge's path and re-route without moving anything.
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
    ],
    relations: [
      { type: 'flow', id: 'order-erp', sourceId: 'order', targetId: 'erp', isBidirectional: false },
      { type: 'flow', id: 'shopper-webshop', sourceId: 'shopper', targetId: 'webshop', isBidirectional: false },
      { type: 'flow', id: 'akeneo-webshop', sourceId: 'akeneo', targetId: 'webshop', isBidirectional: false },
      { type: 'flow', id: 'storemgr-akeneo', sourceId: 'storeMgr', targetId: 'akeneo', isBidirectional: false },
      {
        type: 'flow',
        id: 'marketplace-order',
        sourceId: 'marketplace',
        targetId: 'order',
        label: 'imports marketplace orders',
        isBidirectional: false,
      },
      { type: 'flow', id: 'csa-order', sourceId: 'csa', targetId: 'order', isBidirectional: false },
      { type: 'flow', id: 'webshop-order', sourceId: 'webshop', targetId: 'order', label: 'places orders', isBidirectional: false },
      { type: 'flow', id: 'erp-dynamics', sourceId: 'erp', targetId: 'dynamics', label: 'syncs orders & stock', isBidirectional: false },
    ],
    diagrams: [
      laidOut({
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { id: 'storeMgr', zone: 'actors', x: 0, y: 0 },
          { id: 'shopper', zone: 'actors', x: 0, y: 0 },
          { id: 'csa', zone: 'actors', x: 0, y: 0 },
          { id: 'marketplace', zone: 'inputChannels', x: 0, y: 0 },
          { id: 'akeneo', zone: 'landscape', group: 'Customer Experience', x: 0, y: 0 },
          { id: 'webshop', zone: 'landscape', group: 'Customer Experience', x: 0, y: 0 },
          { id: 'order', zone: 'landscape', group: 'Commerce Operations', x: 0, y: 0 },
          { id: 'erp', zone: 'landscape', group: 'Commerce Operations', x: 0, y: 0 },
          { id: 'dynamics', zone: 'externalSystems', x: 0, y: 0 },
        ],
        layoutConfig: {
          domainGroups: [
            { id: 'Customer Experience', x: 241, y: 223, width: 686, height: 215 },
            { id: 'Commerce Operations', x: 1061, y: 229, width: 267, height: 474 },
          ],
        },
      }),
    ],
  };

  /** The tidied diagram, with `shopper` dragged onto the webshop→order run. */
  async function nudgedDiagram(): Promise<DesignDiagram> {
    const tidied = await tidyLayer7(model, model.diagrams[0]);
    const groups = tidied.domainGroups ?? [];
    const rect = (id: string): Rect => {
      const p = tidied.placements.find((pp) => pp.id === id)!;
      const el = model.elements.find((e) => e.id === id)!;
      const size = placementSize(nodeFigure(el, p.zone), p);
      return { x: p.x, y: p.y, width: size.width, height: size.height };
    };
    const webshop = rect('webshop');
    const order = rect('order');
    // Drop the shopper actor squarely on the midpoint of the webshop→order line.
    const midX = (webshop.x + webshop.width + order.x) / 2;
    const midY = (webshop.y + webshop.height / 2 + order.y + order.height / 2) / 2;
    const placed = tidied.placements.map((p) =>
      p.id === 'shopper' ? { ...p, x: midX - 75, y: midY - 24 } : p,
    );
    return {
      ...model.diagrams[0],
      members: placed.map(memberOf),
      geometry: {
        ...model.diagrams[0].geometry,
        nodes: placed.map(nodeGeometryOf),
        groups,
        canvas: tidied.canvas,
      },
    };
  }

  it('routes the nudged-over edge around the node and keeps marketplace→order clear of the CX box', async () => {
    const diagram = await nudgedDiagram();
    const result = await routeDiagramEdges(model, diagram);

    const shopper = rectFor(model, diagram, 'shopper');
    const webshop = rectFor(model, diagram, 'webshop');
    const order = rectFor(model, diagram, 'order');
    // Sanity: the nudge really did park the actor on the straight run.
    expect(pathHitsObstacles(routedPath(webshop, order, []), [shopper], ROUTE_CLEARANCE)).toBeGreaterThan(0);

    const webshopOrder = routeOf(result, 'webshop-order')!;
    expect(webshopOrder.waypoints.length).toBeGreaterThan(0);
    const drawn = routedPath(webshop, order, webshopOrder.waypoints);
    expect(pathHitsObstacles(drawn, [shopper], ROUTE_CLEARANCE)).toBe(0);

    // The originally-reported case still holds: marketplace→order clears the
    // Customer Experience box it would otherwise cut through.
    const cx = diagram.geometry.groups!.find((g) => g.id === 'Customer Experience')!;
    const mpOrder = routeOf(result, 'marketplace-order')!;
    const mpDrawn = routedPath(
      rectFor(model, diagram, 'marketplace'),
      rectFor(model, diagram, 'order'),
      mpOrder.waypoints,
    );
    // Deliberately a measured DISTANCE, not a coordinate and not a hit count. The old
    // single-channel heuristic grazed this same box at y=617.99999988 against a bottom
    // edge of 618 — and `pathHitsObstacles` calls that clear, because the overlap is
    // under its epsilon. Only a distance catches it. The two-tier router leaves a real
    // gap, so assert the real gap.
    expect(pathClearance(mpDrawn, [cx])).toBeGreaterThanOrEqual(ROUTE_CLEARANCE - 0.02);
  });

  it('moves no node — the pass returns placements only for nothing', async () => {
    const diagram = await nudgedDiagram();
    expect((await routeDiagramEdges(model, diagram)).placements).toEqual([]);
  });
});
