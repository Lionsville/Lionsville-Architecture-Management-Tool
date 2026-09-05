import { describe, expect, it } from 'vitest';
import { MarkerType } from '@xyflow/react';
import { buildEdges } from './graph';
import type { DesignConnection, DesignDiagram, DesignModel } from '../types';

/**
 * U4b: buildEdges resolves the stored edge style with the D1 NULL-inherit
 * fallbacks, and — the load-bearing coupling — feeds the resolved stroke into
 * the marker colour so a custom-coloured line never keeps a theme-coloured
 * arrowhead.
 */

function model(connection: DesignConnection): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'Layer 7',
        placements: [
          { elementId: 'a1', zone: 'landscape', x: 100, y: 100 },
          { elementId: 'b1', zone: 'externalSystems', x: 400, y: 100 },
        ],
      },
    ],
    elements: [
      { id: 'a1', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'b1', kind: 'externalSystem', name: 'Carrier', lifecycle: 'live', isManaged: false, aspects: {}, parameters: {} },
    ],
    connections: [connection],
  };
}

const conn = (overrides: Partial<DesignConnection> = {}): DesignConnection => ({
  id: 'c1',
  sourceId: 'a1',
  targetId: 'b1',
  isBidirectional: false,
  ...overrides,
});

function edgeFor(connection: DesignConnection, edgeColor = '#theme') {
  const m = model(connection);
  const [edge] = buildEdges({
    model: m,
    diagram: m.diagrams[0] as DesignDiagram,
    readOnly: false,
    edgeColor,
  });
  return edge;
}

describe('buildEdges — edge style (U4b)', () => {
  it('a NULL-style connection renders exactly as before: theme markers, arrow at target only', () => {
    const edge = edgeFor(conn());
    expect(edge.markerEnd).toEqual({ type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#theme' });
    expect(edge.markerStart).toBeUndefined();
    expect(edge.data?.color).toBeUndefined();
    expect(edge.data?.lineStyle).toBeUndefined();
    expect(edge.data?.routing).toBeUndefined();
  });

  it('bidirectional NULL-style still gets both arrowheads in the theme colour', () => {
    const edge = edgeFor(conn({ isBidirectional: true }));
    expect(edge.markerStart).toMatchObject({ color: '#theme' });
    expect(edge.markerEnd).toMatchObject({ color: '#theme' });
  });

  it('a custom colour tints BOTH the marker and the carried stroke, not just the line', () => {
    const edge = edgeFor(conn({ color: '#2f6fdb', isBidirectional: true }));
    expect(edge.markerEnd).toMatchObject({ color: '#2f6fdb' });
    expect(edge.markerStart).toMatchObject({ color: '#2f6fdb' });
    expect(edge.data?.color).toBe('#2f6fdb');
  });

  it('explicit arrowheads override the isBidirectional-derived default', () => {
    const edge = edgeFor(conn({ sourceArrowhead: 'arrow', targetArrowhead: 'none' }));
    expect(edge.markerStart).toBeDefined();
    expect(edge.markerEnd).toBeUndefined();
  });

  it('carries lineStyle and routing through to the edge data for the renderer', () => {
    const edge = edgeFor(conn({ lineStyle: 'dashed', routing: 'orthogonal' }));
    expect(edge.data?.lineStyle).toBe('dashed');
    expect(edge.data?.routing).toBe('orthogonal');
  });

  it('marks the edge reconnectable when not read-only', () => {
    const m = model(conn());
    const [rw] = buildEdges({ model: m, diagram: m.diagrams[0] as DesignDiagram, readOnly: false, edgeColor: '#t' });
    const [ro] = buildEdges({ model: m, diagram: m.diagrams[0] as DesignDiagram, readOnly: true, edgeColor: '#t' });
    expect(rw.reconnectable).toBe(true);
    expect(ro.reconnectable).toBe(false);
  });

  it('attaches slotted anchors (U-edge-anchors) for a placed edge', () => {
    const edge = edgeFor(conn());
    expect(edge.data?.anchors).toBeDefined();
    const anchors = edge.data?.anchors;
    expect(Number.isFinite(anchors?.sourceX)).toBe(true);
    expect(Number.isFinite(anchors?.targetY)).toBe(true);
    expect(anchors?.sourcePosition).toBeDefined();
    expect(anchors?.targetPosition).toBeDefined();
  });
});
