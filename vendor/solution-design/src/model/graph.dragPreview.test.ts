import { describe, expect, it } from 'vitest';
import { buildEdges } from './graph';
import type { DesignModel, EdgeRoute, EdgeRouteSource } from '../types';

/**
 * The during-drag preview (feedback item 6, the half that needs no router).
 *
 * While a node moves, an edge with stored bends keeps them where they were, so
 * the line detaches from the card and kinks in mid-air. Suppressing the stored
 * route makes it a plain floating edge, which recomputes its anchors from live
 * rects on every render and follows the cursor for nothing. That is why live
 * routing needs no per-frame router pass: the only edges that looked broken were
 * the ones carrying geometry, and the fix is to stop drawing that geometry rather
 * than to recompute it sixty times a second.
 */
function model(source: EdgeRouteSource): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: ['e1', 'e2', 'e3'].map((id) => ({
      id,
      kind: 'application' as const,
      name: id,
      lifecycle: 'live' as const,
      isManaged: true,
      aspects: {},
      parameters: {},
    })),
    connections: [
      { id: 'moving', sourceId: 'e1', targetId: 'e2', isBidirectional: false },
      { id: 'still', sourceId: 'e2', targetId: 'e3', isBidirectional: false },
    ],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'e1', zone: 'landscape', x: 100, y: 400 },
          { elementId: 'e2', zone: 'landscape', x: 900, y: 400 },
          { elementId: 'e3', zone: 'landscape', x: 1500, y: 400 },
        ],
        edgeRoutes: [
          { connectionId: 'moving', waypoints: [{ x: 500, y: 250 }], labelPosition: { x: 500, y: 230 }, source },
          { connectionId: 'still', waypoints: [{ x: 1200, y: 250 }], source },
        ],
      },
    ],
  };
}

const edgesWhileDragging = (
  source: EdgeRouteSource,
  dragging?: ReadonlySet<string>,
  previewRoutes?: ReadonlyMap<string, EdgeRoute>,
) =>
  new Map(
    buildEdges({
      model: model(source),
      diagram: model(source).diagrams[0],
      readOnly: false,
      edgeColor: '#000',
      draggingElementIds: dragging,
      previewRoutes,
    }).map((e) => [e.id, e]),
  );

/** What a preview pass produces for `moving`: router output, therefore `auto`. */
const previewed: EdgeRoute = {
  connectionId: 'moving',
  waypoints: [{ x: 700, y: 610 }],
  labelPosition: { x: 700, y: 590 },
  source: 'auto',
};

describe('buildEdges — the during-drag preview', () => {
  it('suppresses an auto route on an edge incident to the dragging node', () => {
    const edges = edgesWhileDragging('auto', new Set(['e1']));
    expect(edges.get('moving')!.data!.waypoints).toEqual([]);
    expect(edges.get('moving')!.data!.labelPosition).toBeUndefined();
  });

  it('leaves auto routes elsewhere on the board alone', () => {
    // Only the edges actually attached to something that is moving. The rest of
    // the board is not in motion and must not flicker.
    const edges = edgesWhileDragging('auto', new Set(['e1']));
    expect(edges.get('still')!.data!.waypoints).toEqual([{ x: 1200, y: 250 }]);
  });

  it('keeps a MANUAL route’s waypoints and its chip through the drag', () => {
    // The deliberate asymmetry. Suppressing here would fight the
    // never-replace-a-human's-geometry rule at the one moment the user is
    // watching it, on exactly the edges where they placed the bends on purpose —
    // and throwing a chip they positioned by hand to the path midpoint for the
    // duration of the drag is a louder flicker than the shape change it avoids.
    const edges = edgesWhileDragging('manual', new Set(['e1']));
    expect(edges.get('moving')!.data!.waypoints).toEqual([{ x: 500, y: 250 }]);
    expect(edges.get('moving')!.data!.labelPosition).toEqual({ x: 500, y: 230 });
  });

  it('still reports the edge as an auto route while suppressed', () => {
    // Suppression is about what is DRAWN this instant, not about ownership. A
    // suppressed edge that came back as `manual` would grow handles mid-drag and
    // become un-reroutable on the drop.
    const edges = edgesWhileDragging('auto', new Set(['e1']));
    expect(edges.get('moving')!.data!.routeSource).toBe('auto');
  });

  it('draws everything normally when nothing is dragging', () => {
    const edges = edgesWhileDragging('auto', undefined);
    expect(edges.get('moving')!.data!.waypoints).toEqual([{ x: 500, y: 250 }]);
    expect(edges.get('moving')!.data!.labelPosition).toEqual({ x: 500, y: 230 });
  });
});

describe('buildEdges — a previewed route', () => {
  it('draws instead of the stored route, and is NOT suppressed', () => {
    // Suppression exists to hide bends measured against a position the card has
    // left. A previewed route is geometry for where the card actually is, so there
    // is nothing stale to hide — suppressing it would mean computing it sixty times
    // a second and then throwing it away.
    const edges = edgesWhileDragging(
      'auto',
      new Set(['e1']),
      new Map([['moving', previewed]]),
    );
    expect(edges.get('moving')!.data!.waypoints).toEqual(previewed.waypoints);
    expect(edges.get('moving')!.data!.labelPosition).toEqual(previewed.labelPosition);
  });

  it('draws at the auto radius, so the corner shape does not change at the drop', () => {
    const edges = edgesWhileDragging(
      'manual',
      new Set(['e1']),
      new Map([['moving', previewed]]),
    );
    // Even over a MANUAL stored route: if the preview ever produced one (it does
    // not — manual routes are preserved rather than recomputed), what is drawn is
    // router output and must draw like router output. A radius that changed at the
    // drop would be the snap in miniature.
    expect(edges.get('moving')!.data!.routeSource).toBe('auto');
  });

  it('leaves an edge with no preview entry exactly as it was', () => {
    // The three real cases: over the ceiling, before the first result lands, and a
    // manual route the pass deliberately preserved.
    const edges = edgesWhileDragging(
      'auto',
      new Set(['e1']),
      new Map([['moving', previewed]]),
    );
    expect(edges.get('still')!.data!.waypoints).toEqual([{ x: 1200, y: 250 }]);
  });

  it('survives the drop: the preview still draws once nothing is dragging', () => {
    // The handover. At the moment of release the model still holds the pre-drag
    // routes, and drawing those until the drag-end pass lands — measured at up to
    // 409 ms — would put the snap straight back, one step to the left.
    const edges = edgesWhileDragging('auto', undefined, new Map([['moving', previewed]]));
    expect(edges.get('moving')!.data!.waypoints).toEqual(previewed.waypoints);
  });
});
