import type {
  DesignConnection,
  DesignDiagram,
  DesignElement,
  DesignModel,
  DiagramPlacement,
} from './types';

/** Compact builders for model-layer tests. */

export function element(id: string, overrides: Partial<DesignElement> = {}): DesignElement {
  return {
    id,
    kind: 'application',
    name: `App ${id}`,
    lifecycle: 'live',
    isManaged: true,
    aspects: {},
    parameters: {},
    ...overrides,
  };
}

export function connection(
  id: string,
  sourceId: string,
  targetId: string,
  overrides: Partial<DesignConnection> = {},
): DesignConnection {
  return { id, sourceId, targetId, isBidirectional: false, ...overrides };
}

export function placement(
  elementId: string,
  overrides: Partial<DiagramPlacement> = {},
): DiagramPlacement {
  return { elementId, x: 0, y: 0, ...overrides };
}

export function diagram(id: string, overrides: Partial<DesignDiagram> = {}): DesignDiagram {
  return { id, kind: 'layer7', name: `Diagram ${id}`, placements: [], ...overrides };
}

export function model(overrides: Partial<DesignModel> = {}): DesignModel {
  return {
    name: 'Design',
    customerName: 'ACME',
    diagrams: [],
    elements: [],
    connections: [],
    ...overrides,
  };
}
