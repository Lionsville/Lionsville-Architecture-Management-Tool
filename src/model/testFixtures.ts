import type {
  DesignDiagram,
  DesignElement,
  DesignModel,
  DomainGroupRect,
  EdgeRoute,
  Geometry,
  NodeGeometry,
  PlacedNode,
  Relation,
} from './types';
import { memberOf, nodeGeometryOf } from './placement';
import { splitRoutes } from './routes';

/** Compact builders for model-layer tests. */

export function element(id: string, overrides: Partial<DesignElement> = {}): DesignElement {
  return {
    id,
    kind: 'application',
    name: `App ${id}`,
    lifecycle: 'live',
    isManaged: true,
    aspects: {},
    ...overrides,
  };
}

/** A flow, which is what every line in these fixtures is unless it says otherwise. */
export function connection(
  id: string,
  sourceId: string,
  targetId: string,
  overrides: Partial<Relation> = {},
): Relation {
  return { id, type: 'flow', sourceId, targetId, isBidirectional: false, ...overrides };
}

export function placement(
  elementId: string,
  overrides: Partial<PlacedNode> = {},
): PlacedNode {
  return { id: elementId, x: 0, y: 0, ...overrides };
}

/**
 * A diagram, written the way a test thinks about one: what is on it, WITH where
 * it sits, in one list.
 *
 * The document keeps those apart (ADR-0012 §6) and a test should not have to
 * write the same id twice to say one thing. `placements` is split into members
 * and node geometry here; anything else about the geometry is spread over it.
 */
export function diagram(id: string, overrides: Partial<V3Diagram> = {}): DesignDiagram {
  return laidOut({ id, kind: 'layer7', name: `Diagram ${id}`, ...overrides });
}

export function model(overrides: Partial<DesignModel> = {}): DesignModel {
  return {
    name: 'Design',
    diagrams: [],
    elements: [],
    relations: [],
    ...overrides,
  };
}

/**
 * A diagram said the way the model said one before ADR-0012 §6 — placements,
 * routes and a layout config in one object — as the two halves it keeps apart.
 *
 * For a test whose subject is not the split: a fixture should be one object
 * that says "here is a board", and writing every id twice to say one thing
 * would make every such test about the format. Tests that ARE about the split
 * write `members` and `geometry` out.
 */
export function laidOut(v3: V3Diagram): DesignDiagram {
  const { placements, edgeRoutes, layoutConfig, needsLayout, ...definition } = v3;
  // A fixture built by spreading a view and overriding one v3 key keeps what
  // the spread carried: `{ ...diagram, edgeRoutes: [...] }` is a routing
  // fixture, not a request to empty the board.
  const placed = placements
    ?? (definition.members ?? []).map((member) => ({
      ...member,
      ...nodeOf(definition.geometry, member.id),
    }));
  // A box is about a group the view holds, and the reader drops one that is
  // not (`toDiagram`). Format 3 guarantees the pairing by minting a group per
  // rectangle; a fixture that writes only boxes gets the same courtesy.
  if (definition.groups === undefined && layoutConfig?.domainGroups?.length) {
    definition.groups = layoutConfig.domainGroups.map((box) => ({ id: box.id, name: box.id }));
  }
  const geometry: Geometry = { ...definition.geometry, nodes: placed.map(nodeGeometryOf) };
  if (needsLayout !== undefined) geometry.needsLayout = needsLayout;
  if (layoutConfig?.canvas !== undefined) geometry.canvas = layoutConfig.canvas;
  if (layoutConfig?.zones !== undefined) geometry.zones = layoutConfig.zones;
  if (layoutConfig?.domainGroups !== undefined) geometry.groups = layoutConfig.domainGroups;
  const split = edgeRoutes ? splitRoutes(edgeRoutes) : undefined;
  // The same rule `fromDiagram` follows, so a fixture and a round trip of it
  // are the same document: geometry where there is geometry, and an empty list
  // only where the key was there and holds nothing.
  if (split?.routes) geometry.routes = split.routes;
  else if (edgeRoutes && !split?.lines) geometry.routes = [];
  const out: DesignDiagram = { ...definition, members: placed.map(memberOf) } as DesignDiagram;
  if (split?.lines) out.lines = split.lines;
  out.geometry = geometry;
  return out;
}

function nodeOf(geometry: Geometry | undefined, id: string): Omit<NodeGeometry, 'id'> {
  const held = (geometry?.nodes ?? []).find((node) => node.id === id);
  return { x: held?.x ?? 0, y: held?.y ?? 0, ...(held?.width !== undefined ? { width: held.width } : {}), ...(held?.height !== undefined ? { height: held.height } : {}) };
}

/** The shape {@link laidOut} takes: a view and its geometry in one object. */
export type V3Diagram = Omit<DesignDiagram, 'members' | 'geometry'> & Partial<Pick<DesignDiagram, 'members' | 'geometry'>> & {
  placements?: PlacedNode[];
  edgeRoutes?: EdgeRoute[];
  layoutConfig?: {
    zones?: Geometry['zones'];
    canvas?: Geometry['canvas'];
    domainGroups?: DomainGroupRect[];
  };
  needsLayout?: boolean;
};
