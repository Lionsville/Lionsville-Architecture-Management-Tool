import { describe, expect, it } from 'vitest';
import { diffToOverlay, effectiveOverlay } from './diffToOverlay';
import { edgeRoutesEqual } from './equality';
import { mergeModel } from './merge';
import { EMPTY_OVERLAY } from './overlay';
import { reconcileOverlay } from './reconcile';
import type { DesignModel, EdgeRoute } from './types';

/**
 * `pinned` rides through every place that has to tell a stored row from the
 * delete marker. Each of them asks `hasRouteContent`; these tests pin the fact
 * that a bend-less, label-less row with `pinned: true` is CONTENT everywhere.
 */
const PIN: EdgeRoute = { connectionId: 'c1', waypoints: [], source: 'manual', pinned: true };
const MARKER: EdgeRoute = { connectionId: 'c1', waypoints: [], labelPosition: undefined };

function model(routes?: EdgeRoute[]): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: ['e1', 'e2'].map((id) => ({
      id,
      kind: 'application' as const,
      name: id,
      lifecycle: 'live' as const,
      isManaged: true,
      aspects: {},
      parameters: {},
    })),
    connections: [{ id: 'c1', sourceId: 'e1', targetId: 'e2', isBidirectional: false }],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'e1', zone: 'landscape', x: 100, y: 100 },
          { elementId: 'e2', zone: 'landscape', x: 900, y: 100 },
        ],
        edgeRoutes: routes,
      },
    ],
  };
}

const withRoute = (route: EdgeRoute) => ({
  ...EMPTY_OVERLAY,
  edgeRoutes: new Map([['d1', new Map([[route.connectionId, route]])]]),
});

describe('pinned rows — merge', () => {
  it('keeps a pinned row in the effective diagram and drops the marker', () => {
    expect(mergeModel(model(), withRoute(PIN)).diagrams[0].edgeRoutes).toEqual([PIN]);
    expect(mergeModel(model([PIN]), withRoute(MARKER)).diagrams[0].edgeRoutes).toEqual([]);
  });
});

describe('pinned rows — equality and the undo diff', () => {
  it('edgeRoutesEqual tells a pinned row from an unpinned one with the same geometry', () => {
    expect(edgeRoutesEqual(PIN, { ...PIN, pinned: undefined })).toBe(false);
    expect(edgeRoutesEqual(PIN, { ...PIN })).toBe(true);
    expect(edgeRoutesEqual({ ...PIN, pinned: false }, { ...PIN, pinned: undefined })).toBe(true);
  });

  it('snapshots a pinned row as content and synthesises a marker when the target drops it', () => {
    const base = model([PIN]);
    // A snapshot of a state that still has the pin carries it.
    expect(effectiveOverlay(base).edgeRoutes.get('d1')?.get('c1')).toEqual(PIN);
    // Undoing to a state WITHOUT the pin must emit the delete marker against a base that has it.
    const marker = diffToOverlay(base, effectiveOverlay(model())).edgeRoutes.get('d1')?.get('c1');
    expect(marker).toEqual(MARKER);
    // And the other way round: pinning is an upsert.
    expect(diffToOverlay(model(), effectiveOverlay(base)).edgeRoutes.get('d1')?.get('c1')).toEqual(PIN);
  });
});

describe('pinned rows — reconciliation', () => {
  const reconcile = (overlay: ReturnType<typeof withRoute>, incoming: DesignModel) =>
    reconcileOverlay({
      previous: model(),
      incoming,
      overlay,
      emittedElements: [],
      emittedConnections: [],
    }).overlay.edgeRoutes.get('d1')?.get('c1');

  it('keeps a pinned upsert until the host reflects it, then drops it', () => {
    expect(reconcile(withRoute(PIN), model())).toEqual(PIN);
    expect(reconcile(withRoute(PIN), model([PIN]))).toBeUndefined();
    // Reflected WITHOUT the pin is not reflected: the upsert stays in flight.
    expect(reconcile(withRoute(PIN), model([{ ...PIN, pinned: undefined }]))).toEqual(PIN);
  });

  it('treats a bend-less, unpinned row as the delete marker it is', () => {
    expect(reconcile(withRoute(MARKER), model([PIN]))).toEqual(MARKER);
    expect(reconcile(withRoute(MARKER), model())).toBeUndefined();
  });
});
