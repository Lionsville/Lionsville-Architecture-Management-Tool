import { describe, expect, it } from 'vitest';
import { buildBatch } from './batch';
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
import { mergeModel } from './merge';
import { connection, diagram, element, model, placement } from './testFixtures';
import type { DiagramLayoutConfig } from '../types';

const base = model({
  diagrams: [
    diagram('d1', {
      placements: [
        placement('10', { zone: 'landscape', x: 300, y: 300 }),
        placement('11', { zone: 'actors', x: 40, y: 30 }),
      ],
    }),
    diagram('d2', { kind: 'container', applicationElementId: '10', placements: [placement('10')] }),
  ],
  elements: [element('10'), element('11', { kind: 'actor', name: 'Buyer' })],
  connections: [connection('20', '11', '10', { label: 'uses' })],
});

describe('buildBatch', () => {
  it('emits an empty batch shape for an untouched overlay', () => {
    const batch = buildBatch('d1', base, EMPTY_OVERLAY);
    expect(batch.diagramId).toBe('d1');
    expect(batch.elements).toEqual([]);
    expect(batch.deletedElementIds).toEqual([]);
    expect(batch.connections).toEqual([]);
    expect(batch.deletedConnectionIds).toEqual([]);
    expect(batch.removedPlacementElementIds).toEqual([]);
    // Placements are always the FULL set for the diagram.
    expect(batch.placements).toHaveLength(2);
    // Routes/layout only appear when touched this session.
    expect(batch.edgeRoutes).toEqual([]);
    expect(batch.layoutConfig).toBeUndefined();
  });

  it('carries created elements with temp ids, parent refs and their placements', () => {
    const app = element('tmp-app', { name: 'Webshop' });
    const comp = element('tmp-comp', {
      kind: 'component',
      name: 'API',
      parentApplicationId: 'tmp-app',
    });
    let overlay = overlayWithElement(EMPTY_OVERLAY, app);
    overlay = overlayWithElement(overlay, comp);
    overlay = overlayWithPlacement(overlay, 'd1', placement('tmp-app', { zone: 'landscape', x: 500, y: 400 }));

    const batch = buildBatch('d1', base, overlay);
    expect(batch.elements.map((e) => e.id).sort()).toEqual(['tmp-app', 'tmp-comp']);
    expect(batch.elements.find((e) => e.id === 'tmp-comp')?.parentApplicationId).toBe('tmp-app');
    expect(batch.placements.map((p) => p.elementId)).toContain('tmp-app');
    expect(batch.placements).toHaveLength(3);
  });

  it('carries connections with temp source/target refs', () => {
    const overlay = overlayWithConnection(
      EMPTY_OVERLAY,
      connection('tmp-c', 'tmp-app', '10', { label: 'calls', protocol: 'REST' }),
    );
    const batch = buildBatch('d1', base, overlay);
    expect(batch.connections).toEqual([
      {
        id: 'tmp-c',
        sourceId: 'tmp-app',
        targetId: '10',
        label: 'calls',
        protocol: 'REST',
        isBidirectional: false,
      },
    ]);
  });

  it('reflects edits in the full placement set (moved positions win)', () => {
    const overlay = overlayWithPlacement(
      EMPTY_OVERLAY,
      'd1',
      placement('10', { zone: 'landscape', x: 777, y: 888 }),
    );
    const batch = buildBatch('d1', base, overlay);
    const moved = batch.placements.find((p) => p.elementId === '10');
    expect(moved).toMatchObject({ x: 777, y: 888 });
  });

  it('lists real-id placement removals and excludes them from the set', () => {
    const overlay = overlayWithPlacementRemoved(EMPTY_OVERLAY, 'd1', '11');
    const batch = buildBatch('d1', base, overlay);
    expect(batch.removedPlacementElementIds).toEqual(['11']);
    expect(batch.placements.map((p) => p.elementId)).toEqual(['10']);
  });

  it('does not list temp placement removals (the server never saw them)', () => {
    let overlay = overlayWithElement(EMPTY_OVERLAY, element('tmp-x'));
    overlay = overlayWithPlacement(overlay, 'd1', placement('tmp-x'));
    overlay = overlayWithPlacementRemoved(overlay, 'd1', 'tmp-x');
    const batch = buildBatch('d1', base, overlay);
    expect(batch.removedPlacementElementIds).toEqual([]);
    expect(batch.placements.map((p) => p.elementId)).not.toContain('tmp-x');
    // The element itself still upserts (it exists in the model, unplaced).
    expect(batch.elements.map((e) => e.id)).toContain('tmp-x');
  });

  it('deleting a real element also deletes its connections explicitly', () => {
    const effective = mergeModel(base, EMPTY_OVERLAY);
    const overlay = overlayWithElementDeleted(EMPTY_OVERLAY, effective, '11');
    const batch = buildBatch('d1', base, overlay);
    expect(batch.deletedElementIds).toEqual(['11']);
    expect(batch.deletedConnectionIds).toEqual(['20']);
    expect(batch.placements.map((p) => p.elementId)).toEqual(['10']);
  });

  it('deleting a never-saved temp element produces no delete ids at all', () => {
    let overlay = overlayWithElement(EMPTY_OVERLAY, element('tmp-y'));
    overlay = overlayWithPlacement(overlay, 'd1', placement('tmp-y'));
    overlay = overlayWithElementDeleted(overlay, mergeModel(base, overlay), 'tmp-y');
    const batch = buildBatch('d1', base, overlay);
    expect(batch.deletedElementIds).toEqual([]);
    expect(batch.elements).toEqual([]);
    expect(batch.placements.map((p) => p.elementId)).not.toContain('tmp-y');
  });

  it('scopes placements and removals to the requested diagram', () => {
    let overlay = overlayWithPlacement(EMPTY_OVERLAY, 'd2', placement('10', { x: 50, y: 60 }));
    overlay = overlayWithPlacementRemoved(overlay, 'd1', '11');
    const batchD2 = buildBatch('d2', base, overlay);
    expect(batchD2.placements.map((p) => p.elementId)).toEqual(['10']);
    expect(batchD2.removedPlacementElementIds).toEqual([]);
  });

  it('deleted connections stay deleted in the batch after an edit attempt', () => {
    const overlay = overlayWithConnectionDeleted(EMPTY_OVERLAY, '20');
    const batch = buildBatch('d1', base, overlay);
    expect(batch.deletedConnectionIds).toEqual(['20']);
    expect(batch.connections).toEqual([]);
  });
});

describe('buildBatch — edge routes', () => {
  it('upserts touched routes for the requested diagram only', () => {
    let overlay = overlayWithEdgeRoute(EMPTY_OVERLAY, 'd1', {
      connectionId: '20',
      waypoints: [{ x: 10, y: 20 }],
    });
    overlay = overlayWithEdgeRoute(overlay, 'd2', {
      connectionId: '20',
      waypoints: [{ x: 99, y: 99 }],
    });
    const batch = buildBatch('d1', base, overlay);
    expect(batch.edgeRoutes).toEqual([{ connectionId: '20', waypoints: [{ x: 10, y: 20 }] }]);
  });

  it('empty waypoints stay in the batch as the delete marker', () => {
    const overlay = overlayWithEdgeRoute(EMPTY_OVERLAY, 'd1', {
      connectionId: '20',
      waypoints: [],
    });
    const batch = buildBatch('d1', base, overlay);
    expect(batch.edgeRoutes).toEqual([{ connectionId: '20', waypoints: [] }]);
  });

  it('the latest upsert per connection wins (add → move → remove point)', () => {
    let overlay = overlayWithEdgeRoute(EMPTY_OVERLAY, 'd1', {
      connectionId: '20',
      waypoints: [{ x: 10, y: 20 }],
    });
    overlay = overlayWithEdgeRoute(overlay, 'd1', {
      connectionId: '20',
      waypoints: [{ x: 50, y: 60 }],
    });
    expect(buildBatch('d1', base, overlay).edgeRoutes).toEqual([
      { connectionId: '20', waypoints: [{ x: 50, y: 60 }] },
    ]);
  });

  it('deleting the connection drops its pending route upserts', () => {
    let overlay = overlayWithEdgeRoute(EMPTY_OVERLAY, 'd1', {
      connectionId: '20',
      waypoints: [{ x: 10, y: 20 }],
    });
    overlay = overlayWithConnectionDeleted(overlay, '20');
    const batch = buildBatch('d1', base, overlay);
    expect(batch.edgeRoutes).toEqual([]);
    expect(batch.deletedConnectionIds).toEqual(['20']);
  });
});

describe('buildBatch — layoutConfig', () => {
  const config: DiagramLayoutConfig = {
    zones: { actors: { size: 200 } },
    domainGroups: [{ name: 'Commerce', x: 400, y: 300, width: 500, height: 320 }],
  };

  it('includes the layoutConfig whole when touched, scoped to the diagram', () => {
    const overlay = overlayWithLayoutConfig(EMPTY_OVERLAY, 'd1', config);
    expect(buildBatch('d1', base, overlay).layoutConfig).toEqual(config);
    expect(buildBatch('d2', base, overlay).layoutConfig).toBeUndefined();
  });
});
