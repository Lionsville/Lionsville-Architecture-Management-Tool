import { describe, expect, it } from 'vitest';
import { edgeRoutesEqual } from './equality';
import { fromArrays, toArrays } from './normalised';
import { apply } from './reducer';
import { hasRouteContent } from './routes';
import type { DesignModel, EdgeRoute } from './types';

/**
 * `pinned` rides through every place that has to tell a row worth storing from
 * one with nothing left to say. Each of them asks `hasRouteContent`; these
 * tests pin the fact that a bend-less, label-less row carrying `pinned: true`
 * is content, and that an unpinned one just like it is not.
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

describe('a pin is content', () => {
  it('hasRouteContent says so, and says the opposite for the same row unpinned', () => {
    expect(hasRouteContent(PIN)).toBe(true);
    expect(hasRouteContent(MARKER)).toBe(false);
    expect(hasRouteContent({ ...PIN, pinned: undefined })).toBe(false);
  });

  it('edgeRoutesEqual tells a pinned row from an unpinned one with the same geometry', () => {
    expect(edgeRoutesEqual(PIN, { ...PIN, pinned: undefined })).toBe(false);
    expect(edgeRoutesEqual(PIN, { ...PIN })).toBe(true);
    expect(edgeRoutesEqual({ ...PIN, pinned: false }, { ...PIN, pinned: undefined })).toBe(true);
  });
});

describe('a pin through the one writer', () => {
  it('is stored as a row of its own, and one undo takes it away again', () => {
    const before = fromArrays(model());
    const pinned = apply(before, { type: 'route.set', diagramId: 'd1', routes: [PIN] });
    expect(pinned.ok).toBe(true);
    if (!pinned.ok) return;
    expect(toArrays(pinned.model).diagrams[0].edgeRoutes).toEqual([PIN]);

    const back = apply(pinned.model, pinned.inverse);
    expect(back.ok && toArrays(back.model)).toEqual(toArrays(before));
  });

  it('is forgotten rather than stored empty when the pin is the last thing on it', () => {
    const cleared = apply(fromArrays(model([PIN])), {
      type: 'route.clear', diagramId: 'd1', connectionIds: ['c1'],
    });
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    // Not an empty list: a saved file should look like a hand-written one.
    expect(toArrays(cleared.model).diagrams[0].edgeRoutes).toBeUndefined();
    const back = apply(cleared.model, cleared.inverse);
    expect(back.ok && toArrays(back.model).diagrams[0].edgeRoutes).toEqual([PIN]);
  });
});
