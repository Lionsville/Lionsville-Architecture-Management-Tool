import { describe, expect, it } from 'vitest';
import { buildEdges } from './graph';
import type { DesignModel, EdgeRoute } from '../model/types';

/**
 * The slot fan (`assignEdgeAnchors`) must only count the edges that USE it.
 *
 * A routed edge attaches where its first leg arrives (`routeEndAnchor`) and never
 * reads `data.anchors`; counting it in the fan pushed the straight edge next to
 * it off the side's centre for a neighbour that was not there.
 */
function model(routes: EdgeRoute[] = []): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: ['s', 't1', 't2'].map((id) => ({
      id,
      kind: 'application' as const,
      name: id,
      lifecycle: 'live' as const,
      isManaged: true,
      aspects: {},
      parameters: {},
    })),
    connections: [
      { id: 'c1', sourceId: 's', targetId: 't1', isBidirectional: false },
      { id: 'c2', sourceId: 's', targetId: 't2', isBidirectional: false },
    ],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          // s: 100..300 × 100..230, right-side centre y = 165.
          { elementId: 's', zone: 'landscape', x: 100, y: 100 },
          { elementId: 't1', zone: 'landscape', x: 600, y: 100 },
          { elementId: 't2', zone: 'landscape', x: 600, y: 400 },
        ],
        edgeRoutes: routes,
      },
    ],
  };
}

const anchorsOf = (m: DesignModel) =>
  new Map(
    buildEdges({ model: m, diagram: m.diagrams[0], readOnly: false, edgeColor: '#000' }).map((e) => [
      e.id,
      e.data!.anchors,
    ]),
  );

describe('buildEdges — the slot fan sees waypoint-less edges only', () => {
  it('fans two straight edges sharing a side off the centre (the baseline)', () => {
    const anchors = anchorsOf(model());
    expect(anchors.get('c1')!.sourceY).not.toBe(165);
    expect(anchors.get('c2')!.sourceY).not.toBe(165);
  });

  it('leaves a straight edge on the side centre when its neighbour is routed', () => {
    const anchors = anchorsOf(model([{ connectionId: 'c2', waypoints: [{ x: 450, y: 465 }], source: 'auto' }]));
    expect(anchors.get('c1')!.sourceY).toBe(165);
    // The routed edge gets no slot at all — it would never read one.
    expect(anchors.get('c2')).toBeUndefined();
  });

  it('counts a suppressed auto route as straight while its node drags', () => {
    // Suppression draws the edge bend-less for the duration, so it is back in the
    // fan for exactly that long — the same rule, applied to what is DRAWN.
    const m = model([{ connectionId: 'c2', waypoints: [{ x: 450, y: 465 }], source: 'auto' }]);
    const anchors = new Map(
      buildEdges({
        model: m,
        diagram: m.diagrams[0],
        readOnly: false,
        edgeColor: '#000',
        draggingElementIds: new Set(['t2']),
      }).map((e) => [e.id, e.data!.anchors]),
    );
    expect(anchors.get('c2')).toBeDefined();
    expect(anchors.get('c1')!.sourceY).not.toBe(165);
  });
});
