import type {
  DesignConnection,
  DesignElement,
  DesignModel,
  DiagramLayoutConfig,
  DiagramPlacement,
  EdgeRoute,
  ElementId,
} from '../types';
import { isTempId } from './ids';

/**
 * MERGE STRATEGY (the package side of the host contract)
 * ------------------------------------------------------
 * The `model` prop is the source of truth; the overlay holds every local edit
 * that the host has not yet reflected back. Local uncommitted changes win:
 * `mergeModel(model, overlay)` overlays them on top of whatever the host
 * supplies. Entries leave the overlay only via reconciliation (reconcile.ts),
 * when an incoming model value-matches them — i.e. the change made the round
 * trip through a batch, the API, and the host's refreshed model.
 *
 * All structures are immutable; mutators return a new overlay sharing
 * untouched maps.
 */
export interface ModelOverlay {
  /** Created or edited elements, keyed by (possibly temp) id. Full values. */
  elements: ReadonlyMap<ElementId, DesignElement>;
  /** Real ids the user deleted from the model. */
  deletedElementIds: ReadonlySet<ElementId>;
  /**
   * Temp ids created and then deleted locally. If a save raced ahead and the
   * element got persisted anyway, reconciliation converts the alias into a
   * real deletedElementIds entry (and asks for a re-emit).
   */
  deletedTempElementIds: ReadonlySet<ElementId>;
  connections: ReadonlyMap<string, DesignConnection>;
  deletedConnectionIds: ReadonlySet<string>;
  deletedTempConnectionIds: ReadonlySet<string>;
  /** Placement upserts per diagram id, keyed by element id. */
  placements: ReadonlyMap<string, ReadonlyMap<ElementId, DiagramPlacement>>;
  /** Real element ids removed from a diagram, per diagram id. */
  removedPlacements: ReadonlyMap<string, ReadonlySet<ElementId>>;
  /**
   * Edge-route upserts per diagram id, keyed by connection id. An entry with
   * empty waypoints is the delete marker (and is emitted as such).
   */
  edgeRoutes: ReadonlyMap<string, ReadonlyMap<string, EdgeRoute>>;
  /** Layout config upserts per diagram id (always the whole config). */
  layoutConfigs: ReadonlyMap<string, DiagramLayoutConfig>;
  /**
   * Auto-route flag per diagram id, present only while the toggle's new value is
   * still travelling to the server. Its own lane rather than a `layoutConfig`
   * field, for the same two reasons the column exists — see `DesignDiagram.autoRoute`.
   */
  autoRoutes: ReadonlyMap<string, boolean>;
}

export const EMPTY_OVERLAY: ModelOverlay = {
  elements: new Map(),
  deletedElementIds: new Set(),
  deletedTempElementIds: new Set(),
  connections: new Map(),
  deletedConnectionIds: new Set(),
  deletedTempConnectionIds: new Set(),
  placements: new Map(),
  removedPlacements: new Map(),
  edgeRoutes: new Map(),
  layoutConfigs: new Map(),
  autoRoutes: new Map(),
};

export function overlayIsEmpty(overlay: ModelOverlay): boolean {
  return (
    overlay.elements.size === 0 &&
    overlay.deletedElementIds.size === 0 &&
    overlay.deletedTempElementIds.size === 0 &&
    overlay.connections.size === 0 &&
    overlay.deletedConnectionIds.size === 0 &&
    overlay.deletedTempConnectionIds.size === 0 &&
    overlay.placements.size === 0 &&
    overlay.removedPlacements.size === 0 &&
    overlay.edgeRoutes.size === 0 &&
    overlay.layoutConfigs.size === 0 &&
    overlay.autoRoutes.size === 0
  );
}

export function overlayWithElement(overlay: ModelOverlay, element: DesignElement): ModelOverlay {
  const elements = new Map(overlay.elements);
  elements.set(element.id, element);
  return { ...overlay, elements };
}

export function overlayWithConnection(
  overlay: ModelOverlay,
  connection: DesignConnection,
): ModelOverlay {
  const connections = new Map(overlay.connections);
  connections.set(connection.id, connection);
  return { ...overlay, connections };
}

export function overlayWithPlacement(
  overlay: ModelOverlay,
  diagramId: string,
  placement: DiagramPlacement,
): ModelOverlay {
  const placements = new Map(overlay.placements);
  const forDiagram = new Map(placements.get(diagramId) ?? []);
  forDiagram.set(placement.elementId, placement);
  placements.set(diagramId, forDiagram);
  // Re-placing an element cancels a pending removal on the same diagram.
  const removedForDiagram = overlay.removedPlacements.get(diagramId);
  if (removedForDiagram?.has(placement.elementId)) {
    const removedPlacements = new Map(overlay.removedPlacements);
    const removed = new Set(removedForDiagram);
    removed.delete(placement.elementId);
    if (removed.size === 0) removedPlacements.delete(diagramId);
    else removedPlacements.set(diagramId, removed);
    return { ...overlay, placements, removedPlacements };
  }
  return { ...overlay, placements };
}

export function overlayWithPlacements(
  overlay: ModelOverlay,
  diagramId: string,
  list: DiagramPlacement[],
): ModelOverlay {
  return list.reduce((acc, placement) => overlayWithPlacement(acc, diagramId, placement), overlay);
}

/** Remove an element from one diagram; the element stays in the model. */
export function overlayWithPlacementRemoved(
  overlay: ModelOverlay,
  diagramId: string,
  elementId: ElementId,
): ModelOverlay {
  let next = overlay;
  const forDiagram = overlay.placements.get(diagramId);
  if (forDiagram?.has(elementId)) {
    const placements = new Map(overlay.placements);
    const remaining = new Map(forDiagram);
    remaining.delete(elementId);
    if (remaining.size === 0) placements.delete(diagramId);
    else placements.set(diagramId, remaining);
    next = { ...next, placements };
  }
  if (!isTempId(elementId)) {
    const removedPlacements = new Map(next.removedPlacements);
    const removed = new Set(removedPlacements.get(diagramId) ?? []);
    removed.add(elementId);
    removedPlacements.set(diagramId, removed);
    next = { ...next, removedPlacements };
  }
  return next;
}

function withoutKey<V>(map: ReadonlyMap<string, V>, key: string): Map<string, V> {
  const next = new Map(map);
  next.delete(key);
  return next;
}

/**
 * Delete an element from the model. Connections of the effective model that
 * touch it are deleted explicitly too (explicit beats implicit in the batch),
 * and its placement overlays are dropped on every diagram.
 */
export function overlayWithElementDeleted(
  overlay: ModelOverlay,
  effectiveModel: DesignModel,
  elementId: ElementId,
): ModelOverlay {
  let next: ModelOverlay = { ...overlay, elements: withoutKey(overlay.elements, elementId) };

  if (isTempId(elementId)) {
    const deletedTempElementIds = new Set(next.deletedTempElementIds);
    deletedTempElementIds.add(elementId);
    next = { ...next, deletedTempElementIds };
  } else {
    const deletedElementIds = new Set(next.deletedElementIds);
    deletedElementIds.add(elementId);
    next = { ...next, deletedElementIds };
  }

  for (const connection of effectiveModel.connections) {
    if (connection.sourceId !== elementId && connection.targetId !== elementId) continue;
    next = overlayWithConnectionDeleted(next, connection.id);
  }

  // Drop local placement upserts of the element everywhere; server-side
  // placement cleanup cascades from the element delete.
  let placements: Map<string, ReadonlyMap<ElementId, DiagramPlacement>> | undefined;
  for (const [diagramId, forDiagram] of next.placements) {
    if (!forDiagram.has(elementId)) continue;
    placements ??= new Map(next.placements);
    const remaining = new Map(forDiagram);
    remaining.delete(elementId);
    if (remaining.size === 0) placements.delete(diagramId);
    else placements.set(diagramId, remaining);
  }
  if (placements) next = { ...next, placements };
  return next;
}

export function overlayWithConnectionDeleted(
  overlay: ModelOverlay,
  connectionId: string,
): ModelOverlay {
  let next: ModelOverlay = {
    ...overlay,
    connections: withoutKey(overlay.connections, connectionId),
  };
  if (isTempId(connectionId)) {
    const deletedTempConnectionIds = new Set(next.deletedTempConnectionIds);
    deletedTempConnectionIds.add(connectionId);
    next = { ...next, deletedTempConnectionIds };
  } else {
    const deletedConnectionIds = new Set(next.deletedConnectionIds);
    deletedConnectionIds.add(connectionId);
    next = { ...next, deletedConnectionIds };
  }
  // Local route upserts for the connection are moot on every diagram
  // (server-side route cleanup cascades from the connection delete).
  let edgeRoutes: Map<string, ReadonlyMap<string, EdgeRoute>> | undefined;
  for (const [diagramId, forDiagram] of next.edgeRoutes) {
    if (!forDiagram.has(connectionId)) continue;
    edgeRoutes ??= new Map(next.edgeRoutes);
    const remaining = new Map(forDiagram);
    remaining.delete(connectionId);
    if (remaining.size === 0) edgeRoutes.delete(diagramId);
    else edgeRoutes.set(diagramId, remaining);
  }
  if (edgeRoutes) next = { ...next, edgeRoutes };
  return next;
}

/** Upsert one connection's manual route on one diagram ([] = delete route). */
export function overlayWithEdgeRoute(
  overlay: ModelOverlay,
  diagramId: string,
  route: EdgeRoute,
): ModelOverlay {
  const edgeRoutes = new Map(overlay.edgeRoutes);
  const forDiagram = new Map(edgeRoutes.get(diagramId) ?? []);
  forDiagram.set(route.connectionId, route);
  edgeRoutes.set(diagramId, forDiagram);
  return { ...overlay, edgeRoutes };
}

/** Set a diagram's live auto-routing flag. */
export function overlayWithAutoRoute(
  overlay: ModelOverlay,
  diagramId: string,
  autoRoute: boolean,
): ModelOverlay {
  const autoRoutes = new Map(overlay.autoRoutes);
  autoRoutes.set(diagramId, autoRoute);
  return { ...overlay, autoRoutes };
}

/** Replace a diagram's layout config (always upserted whole). */
export function overlayWithLayoutConfig(
  overlay: ModelOverlay,
  diagramId: string,
  config: DiagramLayoutConfig,
): ModelOverlay {
  const layoutConfigs = new Map(overlay.layoutConfigs);
  layoutConfigs.set(diagramId, config);
  return { ...overlay, layoutConfigs };
}
