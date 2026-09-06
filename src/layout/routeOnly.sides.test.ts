import { describe, expect, it } from 'vitest';
import type { DesignDiagram, DesignModel, EdgeRoute } from '../model/types';
import { manualRouteIds } from '../model/routes';
import { routeDiagramEdges } from './routeOnly';

/**
 * Attach sides through the route-only pass (Phase 2d): the stored row's sides go
 * into the router as pinned ends and come back on every row the pass emits —
 * routed, preserved or cleared — because a constraint outlives the geometry.
 */
function fixture(routes: EdgeRoute[] = [], extraConnection?: DesignModel['connections'][number]) {
  const diagram: DesignDiagram = {
    id: 'd1',
    kind: 'layer7',
    name: 'L7',
    placements: [
      // a: 100..300 × 400..530 (application 200×130); b: 1200..1400 × 400..530.
      { elementId: 'a', zone: 'landscape', x: 100, y: 400 },
      { elementId: 'b', zone: 'landscape', x: 1200, y: 400 },
    ],
    edgeRoutes: routes,
  };
  const model: DesignModel = {
    name: 'ACME',
    customerName: 'ACME',
    elements: ['a', 'b'].map((id) => ({ id, kind: 'application' as const, name: id, lifecycle: 'live' as const, isManaged: true, aspects: {}, parameters: {} })),
    connections: [{ id: 'a-b', sourceId: 'a', targetId: 'b', isBidirectional: false }, ...(extraConnection ? [extraConnection] : [])],
    diagrams: [diagram],
  };
  return { model, diagram };
}

const rowOf = (routes: EdgeRoute[] | undefined, id: string) => routes?.find((r) => r.connectionId === id);

describe('routeDiagramEdges — attach sides', () => {
  it('routes a side-only row out of its side, and hands the side back on the routed row', async () => {
    const sideOnly: EdgeRoute = { connectionId: 'a-b', waypoints: [], source: 'auto', sourceSide: 'top' };
    const { model, diagram } = fixture([sideOnly]);
    // A side is not a claim: the row is the router's, so the live pass re-routes it.
    expect(manualRouteIds(diagram).has('a-b')).toBe(false);

    const result = await routeDiagramEdges(model, diagram, 'keep-stored', undefined, manualRouteIds(diagram));
    const route = rowOf(result.edgeRoutes, 'a-b')!;
    expect(route).toMatchObject({ source: 'auto', sourceSide: 'top' });
    expect('targetSide' in route).toBe(false);
    // Pinned to a's top: the kept endpoint is the top midpoint, and the line goes UP first.
    expect(route.waypoints[0]).toEqual({ x: 200, y: 400 });
    expect(route.waypoints[1].x).toBe(200);
    expect(route.waypoints[1].y).toBeLessThan(400);
  });

  it('re-emits a preserved hand-drawn route with its sides', async () => {
    const manual: EdgeRoute = { connectionId: 'a-b', waypoints: [{ x: 700, y: 465 }], source: 'manual', targetSide: 'bottom' };
    const { model, diagram } = fixture([manual]);
    const result = await routeDiagramEdges(model, diagram, 'keep-stored', undefined, manualRouteIds(diagram));
    expect(rowOf(result.edgeRoutes, 'a-b')).toEqual(manual);
  });

  it('keeps the sides, and only the sides, of a declined connection under the clear policy', async () => {
    // A self-connection is the one shape the router declines. Its stored bends are
    // measured against nothing valid after a Tidy; its sides were never measured.
    const self: EdgeRoute = { connectionId: 'a-a', waypoints: [{ x: 1, y: 1 }], source: 'manual', sourceSide: 'left', targetSide: 'right' };
    const { model, diagram } = fixture([self], { id: 'a-a', sourceId: 'a', targetId: 'a', isBidirectional: false });
    const cleared = await routeDiagramEdges(model, diagram, 'clear');
    expect(rowOf(cleared.edgeRoutes, 'a-a')).toEqual({ connectionId: 'a-a', waypoints: [], source: 'auto', sourceSide: 'left', targetSide: 'right' });
  });

  it('emits no side keys for a connection whose row has none', async () => {
    const { model, diagram } = fixture();
    const route = rowOf((await routeDiagramEdges(model, diagram)).edgeRoutes, 'a-b')!;
    expect(Object.keys(route).sort()).toEqual(['connectionId', 'labelPosition', 'source', 'waypoints']);
  });
});
