import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DesignDiagram, DesignModel, ElementKind } from '../types';
import { routeDiagramEdges } from './routeOnly';
import { tidyContainer, tidyGroup, tidyLayer7 } from './tidy';

/**
 * What every Tidy does when the ROUTER fails.
 *
 * Routing is the last step of all three passes, so before `routeOrDegrade` a WASM
 * failure rejected the whole promise and the caller never applied a thing. The nodes
 * are the expensive half and they were already computed; throwing them away turned
 * an edge-routing outage into a total layout outage. Now the placements come back,
 * `edgeRoutes` is absent (which makes `applyTidyResult` skip its route branch and
 * leave stored routes alone), and `routingError` carries the reason up for the
 * editor to show.
 *
 * ELK is real here — only the router is mocked, since its own failure modes are
 * covered in `libavoidRouter.test.ts`.
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

/** Two grouped applications on a layer7 board, plus a container view of one. */
function board(): { model: DesignModel; layer7: DesignDiagram; container: DesignDiagram } {
  const layer7: DesignDiagram = {
    id: 'd1',
    kind: 'layer7',
    name: 'L7',
    placements: [
      { elementId: 'a', zone: 'landscape', x: 100, y: 400, domainGroup: 'Ops' },
      { elementId: 'b', zone: 'landscape', x: 1200, y: 400, domainGroup: 'Ops' },
    ],
  };
  const container: DesignDiagram = {
    id: 'd2',
    kind: 'container',
    name: 'A',
    applicationElementId: 'a',
    placements: [
      { elementId: 'a', zone: 'landscape', x: 80, y: 80 },
      { elementId: 'c', zone: 'landscape', x: 140, y: 160 },
    ],
  };
  return {
    model: {
      name: 'ACME',
      customerName: 'ACME',
      elements: [
        elt('a', 'application'),
        elt('b', 'application'),
        { ...elt('c', 'component'), parentApplicationId: 'a' },
      ],
      connections: [{ id: 'a-b', sourceId: 'a', targetId: 'b', isBidirectional: false }],
      diagrams: [layer7, container],
    },
    layer7,
    container,
  };
}

const wasmDown = () => new Error('Edge routing is unavailable. Reload the page.');

describe('tidy — a router failure keeps the placements', () => {
  it('tidyLayer7 returns the laid-out nodes, no routes, and the reason', async () => {
    const error = wasmDown();
    mockRoute.mockRejectedValue(error);
    const { model, layer7 } = board();

    const result = await tidyLayer7(model, layer7);

    expect(result.placements.length).toBe(2);
    expect(result.domainGroups).toBeDefined();
    // Absent, not empty: `applyTidyResult` skips its whole edge-route branch on
    // undefined, so nothing stored gets cleared on the way past.
    expect(result.edgeRoutes).toBeUndefined();
    expect(result.routingError).toBe(error);
  });

  it('tidyContainer does the same', async () => {
    mockRoute.mockRejectedValue(wasmDown());
    const { model, container } = board();

    const result = await tidyContainer(model, container);

    expect(result.placements.length).toBeGreaterThan(0);
    expect(result.edgeRoutes).toBeUndefined();
    expect(result.routingError).toBeInstanceOf(Error);
  });

  it('tidyGroup does the same, and stays partial', async () => {
    mockRoute.mockRejectedValue(wasmDown());
    const { model, layer7 } = board();
    layer7.layoutConfig = { domainGroups: [{ name: 'Ops', x: 60, y: 350, width: 1400, height: 300 }] };

    const result = await tidyGroup(model, layer7, 'Ops');

    expect(result.placements.length).toBe(2);
    expect(result.partial).toBe(true);
    expect(result.edgeRoutes).toBeUndefined();
    expect(result.routingError).toBeInstanceOf(Error);
  });

  it('carries no routingError when the router succeeds', async () => {
    mockRoute.mockResolvedValue({
      placements: [],
      edgeRoutes: [{ connectionId: 'a-b', waypoints: [] }],
    });
    const { model, layer7 } = board();

    const result = await tidyLayer7(model, layer7);

    expect(result.routingError).toBeUndefined();
    expect(result.edgeRoutes).toEqual([{ connectionId: 'a-b', waypoints: [] }]);
  });
});
