import { describe, expect, it } from 'vitest';
import { mergeModel } from './merge';
import {
  EMPTY_OVERLAY,
  overlayWithConnection,
  overlayWithConnectionDeleted,
  overlayWithEdgeRoute,
  overlayWithElement,
  overlayWithElementDeleted,
  overlayWithLayoutConfig,
  overlayWithPlacement,
  overlayWithPlacementRemoved,
} from './overlay';
import { connection, diagram, element, model, placement } from './testFixtures';

const base = model({
  diagrams: [diagram('d1', { placements: [placement('1', { x: 10, y: 10 })] })],
  elements: [element('1', { name: 'CRM' }), element('2', { kind: 'actor', name: 'Agent' })],
  connections: [connection('c1', '2', '1')],
});

describe('mergeModel', () => {
  it('returns the base model untouched for an empty overlay', () => {
    const merged = mergeModel(base, EMPTY_OVERLAY);
    expect(merged.elements).toEqual(base.elements);
    expect(merged.connections).toEqual(base.connections);
    expect(merged.diagrams[0].placements).toEqual(base.diagrams[0].placements);
  });

  it('local element edits win over base values', () => {
    const overlay = overlayWithElement(EMPTY_OVERLAY, element('1', { name: 'CRM v2' }));
    const merged = mergeModel(base, overlay);
    expect(merged.elements.find((e) => e.id === '1')?.name).toBe('CRM v2');
  });

  it('appends locally created elements and their placements', () => {
    let overlay = overlayWithElement(EMPTY_OVERLAY, element('tmp-1', { name: 'New' }));
    overlay = overlayWithPlacement(overlay, 'd1', placement('tmp-1', { x: 5, y: 5 }));
    const merged = mergeModel(base, overlay);
    expect(merged.elements.map((e) => e.id)).toContain('tmp-1');
    expect(merged.diagrams[0].placements.map((p) => p.elementId)).toContain('tmp-1');
  });

  it('hides deleted elements, their placements and their connections', () => {
    const overlay = overlayWithElementDeleted(EMPTY_OVERLAY, base, '1');
    const merged = mergeModel(base, overlay);
    expect(merged.elements.map((e) => e.id)).toEqual(['2']);
    expect(merged.connections).toEqual([]);
    expect(merged.diagrams[0].placements).toEqual([]);
  });

  it('hides removed placements but keeps the element in the model', () => {
    const overlay = overlayWithPlacementRemoved(EMPTY_OVERLAY, 'd1', '1');
    const merged = mergeModel(base, overlay);
    expect(merged.diagrams[0].placements).toEqual([]);
    expect(merged.elements.map((e) => e.id)).toContain('1');
  });

  it('hides connections whose endpoint is not visible', () => {
    const overlay = overlayWithConnection(
      EMPTY_OVERLAY,
      connection('tmp-c', '2', 'tmp-ghost'),
    );
    const merged = mergeModel(base, overlay);
    expect(merged.connections.map((c) => c.id)).toEqual(['c1']);
  });

  it('re-placing an element cancels its pending removal', () => {
    let overlay = overlayWithPlacementRemoved(EMPTY_OVERLAY, 'd1', '1');
    overlay = overlayWithPlacement(overlay, 'd1', placement('1', { x: 99, y: 99 }));
    const merged = mergeModel(base, overlay);
    expect(merged.diagrams[0].placements).toEqual([placement('1', { x: 99, y: 99 })]);
  });
});

describe('mergeModel — edge routes & layoutConfig', () => {
  const routedBase = model({
    ...base,
    diagrams: [
      diagram('d1', {
        placements: [placement('1', { x: 10, y: 10 })],
        edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 5, y: 5 }] }],
        layoutConfig: { zones: { actors: { size: 150 } } },
      }),
    ],
  });

  it('overlay route upserts replace base routes', () => {
    const overlay = overlayWithEdgeRoute(EMPTY_OVERLAY, 'd1', {
      connectionId: 'c1',
      waypoints: [{ x: 77, y: 88 }],
    });
    const merged = mergeModel(routedBase, overlay);
    expect(merged.diagrams[0].edgeRoutes).toEqual([
      { connectionId: 'c1', waypoints: [{ x: 77, y: 88 }] },
    ]);
  });

  it('an empty-waypoint upsert removes the route from the effective view', () => {
    const overlay = overlayWithEdgeRoute(EMPTY_OVERLAY, 'd1', {
      connectionId: 'c1',
      waypoints: [],
    });
    expect(mergeModel(routedBase, overlay).diagrams[0].edgeRoutes).toEqual([]);
  });

  it('a label-position-only route survives with empty waypoints (label anchor iteration)', () => {
    // Removing all waypoints keeps the custom label anchor…
    const keepLabel = overlayWithEdgeRoute(EMPTY_OVERLAY, 'd1', {
      connectionId: 'c1',
      waypoints: [],
      labelPosition: { x: 30, y: 40 },
    });
    expect(mergeModel(routedBase, keepLabel).diagrams[0].edgeRoutes).toEqual([
      { connectionId: 'c1', waypoints: [], labelPosition: { x: 30, y: 40 } },
    ]);
    // …and a brand-new label drag creates an effective route on its own.
    const labelOnly = overlayWithEdgeRoute(EMPTY_OVERLAY, 'd1', {
      connectionId: 'c2',
      waypoints: [],
      labelPosition: { x: 1, y: 2 },
    });
    const withSecondConnection = model({
      ...base,
      connections: [connection('c1', '2', '1'), connection('c2', '1', '2')],
    });
    expect(mergeModel(withSecondConnection, labelOnly).diagrams[0].edgeRoutes).toEqual([
      { connectionId: 'c2', waypoints: [], labelPosition: { x: 1, y: 2 } },
    ]);
  });

  it('hides routes of hidden connections', () => {
    const overlay = overlayWithConnectionDeleted(EMPTY_OVERLAY, 'c1');
    expect(mergeModel(routedBase, overlay).diagrams[0].edgeRoutes).toEqual([]);
  });

  it('overlay layoutConfig wins over the base config', () => {
    const overlay = overlayWithLayoutConfig(EMPTY_OVERLAY, 'd1', {
      zones: { actors: { size: 240 } },
    });
    expect(mergeModel(routedBase, overlay).diagrams[0].layoutConfig).toEqual({
      zones: { actors: { size: 240 } },
    });
    expect(mergeModel(routedBase, EMPTY_OVERLAY).diagrams[0].layoutConfig).toEqual({
      zones: { actors: { size: 150 } },
    });
  });
});
