import { describe, expect, it } from 'vitest';
import type { DesignModel, EdgeRoute, Rect } from './types';
import {
  drawnPolyline,
  followNodeMove,
  hasFixedSide,
  hasPlacedContent,
  hasRouteContent,
  insertionIndexOnDrawnPolyline,
  manualRouteIds,
  routeSides,
  routeWithSides,
  sideFromHandleId,
  sidesFromHandles,
  withRouteRow,
} from './routes';
import { edgeRoutesEqual } from './equality';
import { apply } from './reducer';
import { fromArrays, toArrays } from './normalised';
import { diagonalSegments } from '../layout/routeTestSupport';

/**
 * Attach sides on a route row (Phase 2d): a constraint, not geometry. It counts
 * as content (the row survives), it does NOT count as a claim (a row with nothing
 * but sides stays the router's), and every place that carries a row carries it.
 */

const row = (over: Partial<EdgeRoute> = {}): EdgeRoute => ({ connectionId: 'c1', waypoints: [], ...over });

describe('hasRouteContent / hasPlacedContent / hasFixedSide', () => {
  it('a set side is content, but not something a person placed', () => {
    expect(hasRouteContent(row({ sourceSide: 'top' }))).toBe(true);
    expect(hasRouteContent(row({ targetSide: 'left' }))).toBe(true);
    expect(hasPlacedContent(row({ sourceSide: 'top' }))).toBe(false);
    expect(hasFixedSide(row({ sourceSide: 'top' }))).toBe(true);
    expect(hasFixedSide(row())).toBe(false);
    expect(hasFixedSide(undefined)).toBe(false);
    // The delete marker is still the delete marker.
    expect(hasRouteContent(row())).toBe(false);
  });

  it('routeSides hands back only the sides that are set, so a spread writes no undefined keys', () => {
    expect(routeSides(row({ sourceSide: 'right' }))).toEqual({ sourceSide: 'right' });
    expect(Object.keys(routeSides(row({ sourceSide: 'right' })))).toEqual(['sourceSide']);
    expect(routeSides(row())).toEqual({});
    expect(routeSides(undefined)).toEqual({});
  });
});

describe('routeWithSides — what a side change leaves behind', () => {
  it('with nothing stored, a bend-less AUTO row: the router still owns the line, under the side', () => {
    const next = routeWithSides(undefined, 'c1', { sourceSide: 'top' });
    expect(next).toEqual({ connectionId: 'c1', waypoints: [], source: 'auto', sourceSide: 'top' });
    expect(manualRouteIds({ edgeRoutes: [next] }).has('c1')).toBe(false);
  });

  it('merges into a stored row, keeping bends, chip, pin and provenance', () => {
    const stored = row({ waypoints: [{ x: 1, y: 2 }], labelPosition: { x: 3, y: 4 }, source: 'manual', pinned: true, sourceSide: 'top' });
    const next = routeWithSides(stored, 'c1', { targetSide: 'left' });
    expect(next).toEqual({ ...stored, targetSide: 'left' });
    // An absent key leaves that end alone; a present-but-undefined key frees it.
    expect(routeWithSides(stored, 'c1', { sourceSide: undefined })).toEqual({ ...stored, sourceSide: undefined });
    expect('sourceSide' in routeWithSides(stored, 'c1', { sourceSide: undefined })).toBe(false);
  });

  it('freeing the last thing the row had to say yields the delete marker', () => {
    const stored = row({ source: 'auto', sourceSide: 'top' });
    expect(routeWithSides(stored, 'c1', { sourceSide: undefined })).toEqual({ connectionId: 'c1', waypoints: [], labelPosition: undefined });
    expect(routeWithSides(undefined, 'c1', { sourceSide: undefined })).toEqual({ connectionId: 'c1', waypoints: [], labelPosition: undefined });
  });
});

describe('withRouteRow', () => {
  const a = row({ connectionId: 'a', sourceSide: 'top' });
  const b = row({ connectionId: 'b', waypoints: [{ x: 1, y: 1 }] });
  it('replaces in place, appends when new, removes on the delete marker', () => {
    expect(withRouteRow([a, b], { ...a, sourceSide: 'left' })).toEqual([{ ...a, sourceSide: 'left' }, b]);
    expect(withRouteRow([a], b)).toEqual([a, b]);
    expect(withRouteRow(undefined, b)).toEqual([b]);
    expect(withRouteRow([a, b], row({ connectionId: 'a' }))).toEqual([b]);
  });
});

describe('sideFromHandleId / sidesFromHandles', () => {
  it('reads the side off a NodeHandles id and nothing else', () => {
    expect(sideFromHandleId('right-s')).toBe('right');
    expect(sideFromHandleId('top-t')).toBe('top');
    expect(sideFromHandleId('bottom-s')).toBe('bottom');
    expect(sideFromHandleId('left-t')).toBe('left');
    expect(sideFromHandleId(null)).toBeUndefined();
    expect(sideFromHandleId(undefined)).toBeUndefined();
    expect(sideFromHandleId('middle')).toBeUndefined();
  });

  it('records one side per end that names one — a reconnect leaves the unmoved null end alone', () => {
    expect(sidesFromHandles({ sourceHandle: 'right-s', targetHandle: 'top-t' })).toEqual({ sourceSide: 'right', targetSide: 'top' });
    expect(sidesFromHandles({ sourceHandle: null, targetHandle: 'left-t' })).toEqual({ targetSide: 'left' });
    expect(sidesFromHandles({ sourceHandle: null, targetHandle: null })).toBeUndefined();
  });
});

describe('drawnPolyline with fixed sides', () => {
  // a: 100..300 × 100..230; b: 900..1100 × 400..530.
  const a: Rect = { x: 100, y: 100, width: 200, height: 130 };
  const b: Rect = { x: 900, y: 400, width: 200, height: 130 };

  it('adds the stub bends of a side the leg cannot meet square, and every leg stays orthogonal', () => {
    // A route that runs right at y = 165; told to leave from the TOP.
    const waypoints = [{ x: 500, y: 165 }, { x: 500, y: 465 }];
    const drawn = drawnPolyline(waypoints, a, b, { sourceSide: 'top' });
    expect(drawn[0]).toEqual({ x: 200, y: 100 }); // top midpoint
    expect(drawn[1]).toEqual({ x: 200, y: 76 }); // out by SIDE_STUB
    expect(drawn[2]).toEqual({ x: 500, y: 76 }); // across to the waypoint's column
    expect(drawn[3]).toEqual(waypoints[0]);
    expect(diagonalSegments(drawn)).toEqual([]);
  });

  it('draws no zero-length leg for a waypoint sitting on its anchor (a pinned router end)', () => {
    const waypoints = [{ x: 300, y: 165 }, { x: 500, y: 165 }, { x: 500, y: 465 }];
    const drawn = drawnPolyline(waypoints, a, b, { sourceSide: 'right' });
    expect(drawn[0]).toEqual({ x: 300, y: 165 });
    expect(drawn[1]).toEqual({ x: 500, y: 165 });
    expect(drawn).toHaveLength(4);
  });

  it('is unchanged for a route without sides', () => {
    const waypoints = [{ x: 500, y: 165 }, { x: 500, y: 465 }];
    expect(drawnPolyline(waypoints, a, b)).toEqual([{ x: 300, y: 165 }, ...waypoints, { x: 900, y: 465 }]);
  });

  it('insertion indexes against the anchors, never the stub bends', () => {
    const waypoints = [{ x: 500, y: 165 }, { x: 500, y: 465 }];
    // A click beside the (stubbed) first leg lands before waypoint 0 either way.
    expect(insertionIndexOnDrawnPolyline(waypoints, a, b, { x: 400, y: 150 }, { sourceSide: 'top' })).toBe(0);
    expect(insertionIndexOnDrawnPolyline(waypoints, a, b, { x: 700, y: 470 }, { sourceSide: 'top' })).toBe(2);
  });
});

describe('followNodeMove — a bend glued to the node', () => {
  const before: Rect = { x: 100, y: 100, width: 200, height: 130 };
  it('takes the whole delta itself and moves its leg’s run perpendicular, so the route stays square', () => {
    // First waypoint ON the right side (a pinned router end), then right, then down.
    const route = row({ waypoints: [{ x: 300, y: 165 }, { x: 500, y: 165 }, { x: 500, y: 465 }], source: 'manual', sourceSide: 'right' });
    const moved = followNodeMove(route, before, { ...before, x: 130, y: 150 }, true);
    expect(moved.waypoints).toEqual([{ x: 330, y: 215 }, { x: 500, y: 215 }, { x: 500, y: 465 }]);
    expect(diagonalSegments(moved.waypoints)).toEqual([]);
  });

  it('with no next bend, the glued bend simply travels with the node', () => {
    const route = row({ waypoints: [{ x: 300, y: 165 }], source: 'manual' });
    expect(followNodeMove(route, before, { ...before, x: 110, y: 120 }, true).waypoints).toEqual([{ x: 310, y: 185 }]);
  });
});

describe('sides travel with the row through the model layer', () => {
  function model(routes: EdgeRoute[]): DesignModel {
    return {
      name: 'ACME',
      customerName: 'ACME',
      elements: ['a', 'b'].map((id) => ({ id, kind: 'application' as const, name: id, lifecycle: 'live' as const, isManaged: true, aspects: {}, parameters: {} })),
      connections: [{ id: 'c1', sourceId: 'a', targetId: 'b', isBidirectional: false }],
      diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [{ elementId: 'a', x: 0, y: 0 }, { elementId: 'b', x: 500, y: 0 }], edgeRoutes: routes }],
    };
  }

  it('edgeRoutesEqual tells rows apart by their sides', () => {
    expect(edgeRoutesEqual(row({ sourceSide: 'top' }), row({ sourceSide: 'top' }))).toBe(true);
    expect(edgeRoutesEqual(row({ sourceSide: 'top' }), row({ sourceSide: 'left' }))).toBe(false);
    expect(edgeRoutesEqual(row({ sourceSide: 'top' }), row())).toBe(false);
    expect(edgeRoutesEqual(row(), row({ targetSide: 'bottom' }))).toBe(false);
  });

  it('the reducer stores a side-only row and forgets it when the side is freed', () => {
    const sideOnly = row({ source: 'auto', sourceSide: 'top' });
    const stored = apply(fromArrays(model([])), {
      type: 'route.set', diagramId: 'd1', routes: [sideOnly],
    });
    expect(stored.ok && toArrays(stored.model).diagrams[0].edgeRoutes).toEqual([sideOnly]);

    // Freeing the last side leaves a row with nothing to say, which is what
    // `hasRouteContent` recognises and `route.clear` acts on.
    const freed = routeWithSides(sideOnly, 'c1', { sourceSide: undefined });
    expect(hasRouteContent(freed)).toBe(false);
    const gone = apply(fromArrays(model([sideOnly])), {
      type: 'route.clear', diagramId: 'd1', connectionIds: ['c1'],
    });
    expect(gone.ok && toArrays(gone.model).diagrams[0].edgeRoutes).toBeUndefined();
  });

  it('a side change is one step, and its inverse puts the old side back', () => {
    const before = fromArrays(model([row({ source: 'auto', sourceSide: 'top' })]));
    const changed = apply(before, {
      type: 'route.set', diagramId: 'd1', routes: [row({ source: 'auto', sourceSide: 'left' })],
    });
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(toArrays(changed.model).diagrams[0].edgeRoutes?.[0].sourceSide).toBe('left');
    const back = apply(changed.model, changed.inverse);
    expect(back.ok && toArrays(back.model)).toEqual(toArrays(before));
  });
});
