import { describe, expect, it } from 'vitest';
import { diffToOverlay, effectiveOverlay } from './diffToOverlay';
import { mergeModel } from './merge';
import { overlayIsEmpty } from './overlay';
import { connection, diagram, element, model, placement } from './testFixtures';
import type { DesignModel, EdgeRoute } from './types';

/**
 * diffToOverlay is the data-loss surface: it synthesises the deletes the
 * debounced autosave will PUT. The core contract is the round-trip
 *   mergeModel(base, diffToOverlay(base, effectiveOverlay(target)))  ==  target
 * (field-equal, order-insensitive) across every kind of change, PLUS the two
 * safety invariants: identical base==target yields an empty overlay, and a base
 * row present in the target is NEVER deleted.
 */

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : 1);
const byElementId = (a: { elementId: string }, b: { elementId: string }) =>
  a.elementId < b.elementId ? -1 : 1;
const byConnectionId = (a: { connectionId: string }, b: { connectionId: string }) =>
  a.connectionId < b.connectionId ? -1 : 1;

/** Order-insensitive view of a model's content for round-trip comparison. */
function norm(m: DesignModel) {
  return {
    elements: [...m.elements].sort(byId),
    connections: [...m.connections].sort(byId),
    diagrams: [...m.diagrams]
      .sort(byId)
      .map((d) => ({
        id: d.id,
        placements: [...d.placements].sort(byElementId),
        edgeRoutes: [...(d.edgeRoutes ?? [])].sort(byConnectionId),
        layoutConfig: d.layoutConfig,
      })),
  };
}

/** Assert the effective-state round-trip holds for base → target. */
function expectRoundTrip(base: DesignModel, target: DesignModel) {
  const merged = mergeModel(base, diffToOverlay(base, effectiveOverlay(target)));
  expect(norm(merged)).toEqual(norm(target));
}

const route = (connectionId: string, waypoints: { x: number; y: number }[]): EdgeRoute => ({
  connectionId,
  waypoints,
  labelPosition: undefined,
});

function baseModel(): DesignModel {
  return model({
    diagrams: [
      diagram('d1', {
        placements: [
          placement('e1', { x: 10, y: 10, zone: 'landscape' }),
          placement('e2', { x: 40, y: 40, zone: 'landscape' }),
        ],
        edgeRoutes: [route('c1', [{ x: 5, y: 5 }])],
      }),
    ],
    elements: [element('e1', { name: 'CRM' }), element('e2', { name: 'ERP' })],
    connections: [connection('c1', 'e1', 'e2', { label: 'syncs' })],
  });
}

describe('diffToOverlay — round-trips (mergeModel inverse)', () => {
  it('element added', () => {
    const base = baseModel();
    const target = model({
      ...base,
      elements: [...base.elements, element('e3', { name: 'New' })],
      diagrams: [
        { ...base.diagrams[0], placements: [...base.diagrams[0].placements, placement('e3', { x: 80, y: 80 })] },
      ],
    });
    expectRoundTrip(base, target);
  });

  it('element removed', () => {
    const base = baseModel();
    const target = model({
      ...base,
      elements: [element('e1', { name: 'CRM' })],
      connections: [],
      diagrams: [{ ...base.diagrams[0], placements: [placement('e1', { x: 10, y: 10, zone: 'landscape' })], edgeRoutes: [] }],
    });
    expectRoundTrip(base, target);
    const overlay = diffToOverlay(base, effectiveOverlay(target));
    expect(overlay.deletedElementIds.has('e2')).toBe(true);
  });

  it('connection added and removed', () => {
    const base = baseModel();
    const added = model({
      ...base,
      connections: [...base.connections, connection('c2', 'e2', 'e1', { label: 'acks' })],
    });
    expectRoundTrip(base, added);

    const removed = model({ ...base, connections: [], diagrams: [{ ...base.diagrams[0], edgeRoutes: [] }] });
    expectRoundTrip(base, removed);
    expect(diffToOverlay(base, effectiveOverlay(removed)).deletedConnectionIds.has('c1')).toBe(true);
  });

  it('placement moved / added / removed', () => {
    const base = baseModel();
    const moved = model({
      ...base,
      diagrams: [{ ...base.diagrams[0], placements: [placement('e1', { x: 999, y: 999, zone: 'landscape' }), placement('e2', { x: 40, y: 40, zone: 'landscape' })] }],
    });
    expectRoundTrip(base, moved);

    // e2 exists but is unplaced from d1.
    const unplaced = model({
      ...base,
      diagrams: [{ ...base.diagrams[0], placements: [placement('e1', { x: 10, y: 10, zone: 'landscape' })] }],
    });
    expectRoundTrip(base, unplaced);
    expect(diffToOverlay(base, effectiveOverlay(unplaced)).removedPlacements.get('d1')?.has('e2')).toBe(true);
  });

  it('edge-route added / removed / waypoints changed', () => {
    const base = baseModel();
    const changed = model({
      ...base,
      diagrams: [{ ...base.diagrams[0], edgeRoutes: [route('c1', [{ x: 1, y: 1 }, { x: 2, y: 2 }])] }],
    });
    expectRoundTrip(base, changed);

    const removed = model({ ...base, diagrams: [{ ...base.diagrams[0], edgeRoutes: [] }] });
    expectRoundTrip(base, removed);
    // The removed route becomes an empty-waypoint delete marker.
    const marker = diffToOverlay(base, effectiveOverlay(removed)).edgeRoutes.get('d1')?.get('c1');
    expect(marker?.waypoints).toEqual([]);
  });

  it('layoutConfig changed', () => {
    const base = baseModel();
    const target = model({
      ...base,
      diagrams: [{ ...base.diagrams[0], layoutConfig: { canvas: { width: 2000, height: 1500 } } }],
    });
    expectRoundTrip(base, target);
  });

  it('empty target vs full base → deletes everything', () => {
    const base = baseModel();
    const empty = model({ diagrams: [diagram('d1', { placements: [], edgeRoutes: [] })] });
    expectRoundTrip(base, empty);
    const overlay = diffToOverlay(base, effectiveOverlay(empty));
    expect([...overlay.deletedElementIds].sort()).toEqual(['e1', 'e2']);
    expect([...overlay.deletedConnectionIds]).toEqual(['c1']);
    // mergeModel yields an element/connection-free model.
    const merged = mergeModel(base, overlay);
    expect(merged.elements).toEqual([]);
    expect(merged.connections).toEqual([]);
  });
});

describe('diffToOverlay — safety invariants', () => {
  it('identical base==target → empty overlay (no spurious upserts or deletes)', () => {
    const base = baseModel();
    const overlay = diffToOverlay(base, effectiveOverlay(base));
    expect(overlayIsEmpty(overlay)).toBe(true);
  });

  it('NEVER deletes a base element/connection that is present in the target', () => {
    const base = baseModel();
    // Target keeps e1 + e2 + c1 (only moves e1) — nothing removed.
    const target = model({
      ...base,
      diagrams: [{ ...base.diagrams[0], placements: [placement('e1', { x: 77, y: 77, zone: 'landscape' }), placement('e2', { x: 40, y: 40, zone: 'landscape' })] }],
    });
    const overlay = diffToOverlay(base, effectiveOverlay(target));
    expect(overlay.deletedElementIds.size).toBe(0);
    expect(overlay.deletedConnectionIds.size).toBe(0);
    expect(overlay.removedPlacements.size).toBe(0);
  });

  it('a pure style change (ignored by reconcile equality) still round-trips', () => {
    const base = baseModel();
    // accentColor is NOT part of elementsEqual — diffToOverlay must still upsert.
    const target = model({
      ...base,
      elements: [element('e1', { name: 'CRM', accentColor: '#ff0000' }), element('e2', { name: 'ERP' })],
    });
    const overlay = diffToOverlay(base, effectiveOverlay(target));
    expect(overlay.elements.get('e1')?.accentColor).toBe('#ff0000');
    expectRoundTrip(base, target);
  });
});
