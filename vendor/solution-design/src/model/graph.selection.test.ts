import { describe, expect, it } from 'vitest';
import { buildEdges, buildNodes } from './graph';
import type { DesignDiagram, DesignModel } from '../types';

/**
 * U2 selection foundation: the canvas projects a *set* of selected ids onto
 * React Flow's `selected` flags. These pure projections are what keep our
 * controlled selection and RF's internal selection from drifting.
 */

function model(): DesignModel {
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
    connections: [{ id: 'c1', sourceId: 'a1', targetId: 'b1', isBidirectional: false }],
  };
}

const diagram = () => model().diagrams[0] as DesignDiagram;
const base = { model: model(), diagram: diagram(), readOnly: false, edgeColor: '#000' };

describe('buildNodes — selection flag', () => {
  it('marks only the ids present in selectedElementIds', () => {
    const nodes = buildNodes({ ...base, selectedElementIds: new Set(['a1']) });
    expect(nodes.find((n) => n.id === 'a1')?.selected).toBe(true);
    expect(nodes.find((n) => n.id === 'b1')?.selected).toBe(false);
  });

  it('supports a multi-selection (more than one node selected)', () => {
    const nodes = buildNodes({ ...base, selectedElementIds: new Set(['a1', 'b1']) });
    expect(nodes.every((n) => n.selected)).toBe(true);
  });

  it('defaults to unselected when no set is supplied', () => {
    const nodes = buildNodes(base);
    expect(nodes.some((n) => n.selected)).toBe(false);
  });
});

describe('buildNodes — showLifecycle propagation (U5)', () => {
  it('writes the toggle onto every node data payload', () => {
    expect(buildNodes({ ...base, showLifecycle: true }).every((n) => n.data.showLifecycle)).toBe(true);
    expect(buildNodes({ ...base, showLifecycle: false }).some((n) => n.data.showLifecycle)).toBe(false);
  });

  it('defaults to on (badges shown) when the flag is omitted', () => {
    expect(buildNodes(base).every((n) => n.data.showLifecycle)).toBe(true);
  });
});

describe('buildEdges — selection flag', () => {
  it('marks the edge selected when its connection id is in the set', () => {
    const edges = buildEdges({ ...base, selectedConnectionIds: new Set(['c1']) });
    expect(edges.find((e) => e.id === 'c1')?.selected).toBe(true);
  });

  it('defaults to unselected when no set is supplied', () => {
    const edges = buildEdges(base);
    expect(edges.some((e) => e.selected)).toBe(false);
  });
});
