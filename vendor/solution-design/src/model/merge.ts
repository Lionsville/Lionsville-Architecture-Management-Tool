import type {
  DesignConnection,
  DesignDiagram,
  DesignElement,
  DesignModel,
  DiagramPlacement,
  EdgeRoute,
  ElementId,
} from '../types';
import type { ModelOverlay } from './overlay';
import { hasRouteContent } from './routes';

/**
 * Effective model = host model with the local overlay applied on top.
 * Local uncommitted changes win until reconciliation drops them (see
 * overlay.ts for the full strategy).
 */
export function mergeModel(base: DesignModel, overlay: ModelOverlay): DesignModel {
  const elements = mergeElements(base.elements, overlay);
  const visibleIds = new Set(elements.map((e) => e.id));
  const connections = mergeConnections(base.connections, overlay, visibleIds);
  const diagrams = base.diagrams.map((d) => mergeDiagram(d, overlay, visibleIds, connections));
  return { ...base, elements, connections, diagrams };
}

function isElementHidden(overlay: ModelOverlay, id: ElementId): boolean {
  return overlay.deletedElementIds.has(id) || overlay.deletedTempElementIds.has(id);
}

function mergeElements(base: DesignElement[], overlay: ModelOverlay): DesignElement[] {
  const seen = new Set<ElementId>();
  const merged: DesignElement[] = [];
  for (const element of base) {
    seen.add(element.id);
    if (isElementHidden(overlay, element.id)) continue;
    merged.push(overlay.elements.get(element.id) ?? element);
  }
  for (const [id, element] of overlay.elements) {
    if (seen.has(id) || isElementHidden(overlay, id)) continue;
    merged.push(element);
  }
  return merged;
}

function mergeConnections(
  base: DesignConnection[],
  overlay: ModelOverlay,
  visibleElementIds: ReadonlySet<ElementId>,
): DesignConnection[] {
  const isHidden = (id: string) =>
    overlay.deletedConnectionIds.has(id) || overlay.deletedTempConnectionIds.has(id);
  const endpointsVisible = (c: DesignConnection) =>
    visibleElementIds.has(c.sourceId) && visibleElementIds.has(c.targetId);

  const seen = new Set<string>();
  const merged: DesignConnection[] = [];
  for (const connection of base) {
    seen.add(connection.id);
    if (isHidden(connection.id)) continue;
    const effective = overlay.connections.get(connection.id) ?? connection;
    if (endpointsVisible(effective)) merged.push(effective);
  }
  for (const [id, connection] of overlay.connections) {
    if (seen.has(id) || isHidden(id)) continue;
    if (endpointsVisible(connection)) merged.push(connection);
  }
  return merged;
}

function mergeDiagram(
  diagram: DesignDiagram,
  overlay: ModelOverlay,
  visibleElementIds: ReadonlySet<ElementId>,
  visibleConnections: DesignConnection[],
): DesignDiagram {
  const upserts = overlay.placements.get(diagram.id);
  const removed = overlay.removedPlacements.get(diagram.id);
  const visibleConnectionIds = new Set(visibleConnections.map((c) => c.id));
  const edgeRoutes = mergeEdgeRoutes(diagram, overlay, visibleConnectionIds);
  const layoutConfig = overlay.layoutConfigs.get(diagram.id) ?? diagram.layoutConfig;
  const autoRoute = overlay.autoRoutes.get(diagram.id) ?? diagram.autoRoute;

  const seen = new Set<ElementId>();
  const placements: DiagramPlacement[] = [];
  for (const placement of diagram.placements) {
    seen.add(placement.elementId);
    if (removed?.has(placement.elementId)) continue;
    if (!visibleElementIds.has(placement.elementId)) continue;
    placements.push(upserts?.get(placement.elementId) ?? placement);
  }
  if (upserts) {
    for (const [elementId, placement] of upserts) {
      if (seen.has(elementId)) continue;
      if (removed?.has(elementId)) continue;
      if (!visibleElementIds.has(elementId)) continue;
      placements.push(placement);
    }
  }
  return { ...diagram, placements, edgeRoutes, layoutConfig, autoRoute };
}

/**
 * Effective manual routes: base routes with overlay upserts applied; an
 * overlay entry without content (`hasRouteContent`: no waypoints, no label
 * position, no pin) removes the route from the effective view (it stays in the
 * overlay as the delete marker for the batch). Routes of hidden connections are
 * dropped.
 */
function mergeEdgeRoutes(
  diagram: DesignDiagram,
  overlay: ModelOverlay,
  visibleConnectionIds: ReadonlySet<string>,
): EdgeRoute[] {
  const upserts = overlay.edgeRoutes.get(diagram.id);
  const seen = new Set<string>();
  const merged: EdgeRoute[] = [];
  for (const route of diagram.edgeRoutes ?? []) {
    seen.add(route.connectionId);
    if (!visibleConnectionIds.has(route.connectionId)) continue;
    const effective = upserts?.get(route.connectionId) ?? route;
    if (hasRouteContent(effective)) merged.push(effective);
  }
  if (upserts) {
    for (const [connectionId, route] of upserts) {
      if (seen.has(connectionId)) continue;
      if (!visibleConnectionIds.has(connectionId)) continue;
      if (hasRouteContent(route)) merged.push(route);
    }
  }
  return merged;
}
