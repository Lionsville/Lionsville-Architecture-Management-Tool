import { describe, expect, it } from 'vitest';
import { routeDiagramEdges } from './routeOnly';
import { preservedRouteIds } from './tidy';
import type { DesignModel } from '../types';

/**
 * `preserveRoutesFor` — the invariant with teeth.
 *
 * The easy version of this test ("a preserved route comes back unchanged") passes
 * against three different implementations, two of which are wrong. What separates
 * them is what happens to the OTHER edges, so every test here checks both halves:
 *
 * - Built on `keep-stored`, a preserved route would be overwritten the moment the
 *   router actually routes it, which is the normal case.
 * - Built on `routeOnlyBetween`, the preserved connector would be kept out of the
 *   router entirely, so it would stop pushing the other routes off itself and they
 *   would land on top of it.
 *
 * So the pass has to hand the connector to the router and discard only its result.
 */
function boardModel(): DesignModel {
  // Four parallel edges between two columns: they compete for one channel, so
  // libavoid nudges them apart. That competition is what makes "is the preserved
  // connector still influencing the others" observable at all.
  const elements = ['s1', 's2', 's3', 's4', 't1', 't2', 't3', 't4'].map((id) => ({
    id,
    kind: 'application' as const,
    name: id,
    lifecycle: 'live' as const,
    isManaged: true,
    aspects: {},
    parameters: {},
  }));
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements,
    connections: [1, 2, 3, 4].map((n) => ({
      id: `c${n}`,
      sourceId: `s${n}`,
      targetId: `t${n}`,
      isBidirectional: false,
    })),
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          ...[1, 2, 3, 4].map((n) => ({
            elementId: `s${n}`,
            zone: 'landscape' as const,
            x: 100,
            y: 100 + n * 160,
          })),
          ...[1, 2, 3, 4].map((n) => ({
            elementId: `t${n}`,
            zone: 'landscape' as const,
            x: 1200,
            y: 100 + n * 160,
          })),
          // An obstacle squarely between the columns, so every edge has to detour
          // around it and they genuinely share a channel rather than running straight.
          { elementId: 's1', zone: 'landscape' as const, x: 100, y: 260 },
        ].filter((p, i, all) => all.findIndex((q) => q.elementId === p.elementId) === i),
        layoutConfig: {
          domainGroups: [{ name: 'Wall', x: 600, y: 120, width: 120, height: 700 }],
        },
        edgeRoutes: [
          {
            connectionId: 'c2',
            waypoints: [{ x: 640, y: 60 }],
            labelPosition: { x: 640, y: 40 },
            source: 'manual' as const,
          },
        ],
      },
    ],
  };
}

const routeOf = (result: Awaited<ReturnType<typeof routeDiagramEdges>>, id: string) =>
  result.edgeRoutes?.find((r) => r.connectionId === id);

describe('routeDiagramEdges — preserveRoutesFor', () => {
  it('keeps a preserved route even on a pass that DOES route its connection', async () => {
    const model = boardModel();
    const diagram = model.diagrams[0];
    const stored = diagram.edgeRoutes![0];

    // 'clear' is the policy a Tidy uses — it replaces everything it routes. The
    // preserved connection must survive it, which is what proves the exclusion is
    // not just `keep-stored` under another name.
    const preserved = await routeDiagramEdges(
      model,
      diagram,
      'clear',
      undefined,
      new Set(['c2']),
    );

    const c2 = routeOf(preserved, 'c2');
    expect(c2?.waypoints).toEqual(stored.waypoints);
    expect(c2?.labelPosition).toEqual(stored.labelPosition);
    // Provenance rides along: a preserved route is still the user's afterwards.
    expect(c2?.source).toBe('manual');

    // And the same pass without the exclusion DOES replace it — otherwise the
    // assertion above would pass for the wrong reason.
    const unprotected = await routeDiagramEdges(model, diagram, 'clear');
    expect(routeOf(unprotected, 'c2')?.waypoints).not.toEqual(stored.waypoints);
    expect(routeOf(unprotected, 'c2')?.source).toBe('auto');
  });

  it('still routes the other edges clear of the preserved connector', async () => {
    // The failure mode of a `routeOnlyBetween`-based implementation: excluding the
    // connector from the ROUTER would stop it nudging its neighbours, so they
    // would collapse onto the channel it occupies.
    const model = boardModel();
    const diagram = model.diagrams[0];

    const withPreserve = await routeDiagramEdges(model, diagram, 'clear', undefined, new Set(['c2']));
    const withoutPreserve = await routeDiagramEdges(model, diagram, 'clear');

    // Every other edge routes identically whether or not c2's RESULT was kept,
    // because c2 went into the router either way.
    for (const id of ['c1', 'c3', 'c4']) {
      expect(routeOf(withPreserve, id)?.waypoints).toEqual(routeOf(withoutPreserve, id)?.waypoints);
    }
  });

  it('reserves the preserved chip so a later edge does not land its label on it', async () => {
    const model = boardModel();
    const diagram = model.diagrams[0];
    // Give every connection a label, so each one competes for chip space.
    for (const c of model.connections) c.label = 'Sends orders';

    const result = await routeDiagramEdges(model, diagram, 'clear', undefined, new Set(['c2']));

    const pinned = routeOf(result, 'c2')?.labelPosition;
    expect(pinned).toEqual({ x: 640, y: 40 });
    // No other chip is placed on top of the preserved one. This is why the
    // exclusion has to live in the routing pass: applyTidyResult could not move a
    // label the router had already put there.
    for (const id of ['c1', 'c3', 'c4']) {
      const other = routeOf(result, id)?.labelPosition;
      if (!other || !pinned) continue;
      expect(Math.hypot(other.x - pinned.x, other.y - pinned.y)).toBeGreaterThan(1);
    }
  });

  it('falls through to normal routing for a preserved id with nothing stored', async () => {
    // "Protect this connection" and "this connection has geometry worth
    // protecting" are different facts, and the set carries only the first.
    const model = boardModel();
    const result = await routeDiagramEdges(
      model,
      model.diagrams[0],
      'clear',
      undefined,
      new Set(['c3']),
    );
    expect(routeOf(result, 'c3')).toBeDefined();
    expect(routeOf(result, 'c3')?.source).toBe('auto');
  });
});

describe('preservedRouteIds', () => {
  const diagram = {
    edgeRoutes: [
      { connectionId: 'bends', waypoints: [{ x: 1, y: 2 }], source: 'manual' as const },
      // The case the old waypoint-presence heuristic was blind to.
      { connectionId: 'chip', waypoints: [], labelPosition: { x: 9, y: 9 }, source: 'manual' as const },
      { connectionId: 'router', waypoints: [{ x: 3, y: 4 }], source: 'auto' as const },
      // Pre-provenance row: absent source reads as manual.
      { connectionId: 'legacy', waypoints: [{ x: 5, y: 6 }] },
    ],
  };

  it('protects every route a person placed, waypoints or not', () => {
    expect(preservedRouteIds(diagram, true)).toEqual(new Set(['bends', 'chip', 'legacy']));
  });

  it('protects nothing when the option is off', () => {
    expect(preservedRouteIds(diagram, false).size).toBe(0);
  });

  it('does not protect an earlier Tidy’s own output', () => {
    // The concrete bug in the old heuristic: it saw waypoints, could not see who
    // made them, and so a second Tidy with the box ticked preserved the FIRST
    // Tidy's routes.
    expect(preservedRouteIds(diagram, true).has('router')).toBe(false);
  });
});
