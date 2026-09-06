import { describe, expect, it } from 'vitest';
import { Position } from '@xyflow/react';
import { buildEdges } from './graph';
import type { DesignModel, EdgeRoute } from '../model/types';

/**
 * Attach sides reach the edges (Phase 2d): the stored row's sides ride on the edge
 * data, and the slot fan is given them so two lines fixed to one side fan out
 * along it instead of the sides the fan would have picked.
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
          // s: 100..300 × 100..230, bottom at y = 230.
          { elementId: 's', zone: 'landscape', x: 100, y: 100 },
          { elementId: 't1', zone: 'landscape', x: 600, y: 100 },
          { elementId: 't2', zone: 'landscape', x: 600, y: 400 },
        ],
        edgeRoutes: routes,
      },
    ],
  };
}

const edgesOf = (m: DesignModel, extra: Partial<Parameters<typeof buildEdges>[0]> = {}) =>
  new Map(
    buildEdges({ model: m, diagram: m.diagrams[0], readOnly: false, edgeColor: '#000', ...extra }).map((e) => [
      e.id,
      e.data!,
    ]),
  );

describe('buildEdges — attach sides', () => {
  it('puts the stored sides on the edge data, and nothing when none are stored', () => {
    const data = edgesOf(model([{ connectionId: 'c1', waypoints: [], source: 'auto', sourceSide: 'bottom', targetSide: 'left' }]));
    expect(data.get('c1')).toMatchObject({ sourceSide: 'bottom', targetSide: 'left' });
    expect('sourceSide' in data.get('c2')!).toBe(false);
  });

  it('fans two straight lines fixed to the same side out along that side', () => {
    const data = edgesOf(
      model([
        { connectionId: 'c1', waypoints: [], source: 'auto', sourceSide: 'bottom' },
        { connectionId: 'c2', waypoints: [], source: 'auto', sourceSide: 'bottom' },
      ]),
    );
    const c1 = data.get('c1')!.anchors!;
    const c2 = data.get('c2')!.anchors!;
    expect(c1.sourcePosition).toBe(Position.Bottom);
    expect(c2.sourcePosition).toBe(Position.Bottom);
    expect(c1.sourceY).toBe(230);
    expect(c2.sourceY).toBe(230);
    expect(c1.sourceX).not.toBe(c2.sourceX);
    // Without the sides the fan would have sent c1 out of the right side.
    expect(edgesOf(model()).get('c1')!.anchors!.sourcePosition).toBe(Position.Right);
  });

  it('keeps the stored sides while a preview route stands in for the stored one', () => {
    const stored: EdgeRoute = { connectionId: 'c1', waypoints: [{ x: 450, y: 165 }], source: 'auto', sourceSide: 'top' };
    const preview: EdgeRoute = { connectionId: 'c1', waypoints: [{ x: 450, y: 180 }], source: 'auto' };
    const data = edgesOf(model([stored]), { previewRoutes: new Map([['c1', preview]]) });
    expect(data.get('c1')).toMatchObject({ waypoints: preview.waypoints, sourceSide: 'top' });
  });
});
