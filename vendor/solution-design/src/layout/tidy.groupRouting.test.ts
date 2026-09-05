import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DesignDiagram, DesignModel, ElementKind } from '../types';
import { routeDiagramEdges } from './routeOnly';
import { tidyGroup } from './tidy';

/**
 * What a per-group Tidy hands the router.
 *
 * The two lists it passes are easy to conflate and mean different things: the
 * placements are the OBSTACLE set (the whole board — a loose landscape card is an
 * obstacle whether or not this tidy may move it), while the owned-endpoint set is
 * what decides which edges get re-routed. Narrowing the placements to the group's
 * members narrows both at once, and tier 2 in `libavoidRouter` does not confine an
 * intra-group route to its box — so an edge nudged out of a tight box would be drawn
 * straight through a card the router never knew about.
 *
 * ELK is real here; only the router is mocked, because the assertion is about the
 * inputs it receives, and the routing itself is covered in `libavoidRouter.test.ts`
 * and `routeOnly.test.ts`.
 */
vi.mock('./routeOnly', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./routeOnly')>()),
  routeDiagramEdges: vi.fn(),
}));

const mockRoute = vi.mocked(routeDiagramEdges);

afterEach(() => {
  mockRoute.mockReset();
});

const elt = (id: string, kind: ElementKind) => ({
  id,
  kind,
  name: id,
  lifecycle: 'live' as const,
  isManaged: true,
  aspects: {},
  parameters: {},
});

/** Two stacked members in the Core box, a loose card outside it, and a band node. */
function board(): { model: DesignModel; layer7: DesignDiagram } {
  const layer7: DesignDiagram = {
    id: 'd1',
    kind: 'layer7',
    name: 'L7',
    placements: [
      { elementId: 'a1', zone: 'landscape', domainGroup: 'Core', x: 220, y: 220 },
      { elementId: 'a2', zone: 'landscape', domainGroup: 'Core', x: 230, y: 230 },
      { elementId: 'outside', zone: 'landscape', x: 700, y: 240 },
      { elementId: 'actor', zone: 'actors', x: 100, y: 20 },
    ],
    layoutConfig: {
      domainGroups: [
        { name: 'Core', x: 200, y: 200, width: 400, height: 300 },
        { name: 'Other', x: 1200, y: 200, width: 200, height: 200 },
      ],
    },
  };
  return {
    model: {
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
      diagrams: [layer7],
    },
    layer7,
  };
}

describe('tidyGroup — the board the router is routing against', () => {
  it('routes against every placement but owns only the members', async () => {
    mockRoute.mockResolvedValue({ placements: [], edgeRoutes: [] });
    const { model, layer7 } = board();

    const result = await tidyGroup(model, layer7, 'Core');

    expect(mockRoute).toHaveBeenCalledTimes(1);
    const [, routed, whenDeclined, owned] = mockRoute.mock.calls[0];
    // The whole board reaches the router as obstacles — the loose card just outside
    // the box included, which is the one this tidy must not move but must dodge.
    expect(routed.placements.map((p) => p.elementId).sort()).toEqual([
      'a1',
      'a2',
      'actor',
      'outside',
    ]);
    // Only the members are re-routed, so a box-crossing edge keeps its stored route
    // even though `'clear'` would otherwise wipe it.
    expect(whenDeclined).toBe('clear');
    expect([...owned!].sort()).toEqual(['a1', 'a2']);
    expect(result.partial).toBe(true);
  });

  it('passes the members at their NEW positions and everything else verbatim', async () => {
    mockRoute.mockResolvedValue({ placements: [], edgeRoutes: [] });
    const { model, layer7 } = board();

    const result = await tidyGroup(model, layer7, 'Core');

    const [, routed] = mockRoute.mock.calls[0];
    const routedById = new Map(routed.placements.map((p) => [p.elementId, p]));
    for (const laid of result.placements) {
      expect(routedById.get(laid.elementId)).toEqual(laid);
    }
    // Untouched placements are the originals, not reflowed copies.
    for (const id of ['outside', 'actor']) {
      expect(routedById.get(id)).toEqual(layer7.placements.find((p) => p.elementId === id));
    }
    // And the resized box, not the stale one still in `layoutConfig`.
    expect(routed.layoutConfig!.domainGroups).toEqual([
      result.domainGroups![0],
      { name: 'Other', x: 1200, y: 200, width: 200, height: 200 },
    ]);
  });
});
