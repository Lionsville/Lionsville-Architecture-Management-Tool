import type { DesignModel, DiagramContentBatch } from './types';
import { mergeModel } from './merge';
import type { ModelOverlay } from './overlay';

/**
 * Build the change batch the host persists (mirrors PUT diagrams/{id}/content):
 * - elements/connections: the session's upserts (idempotent — they keep being
 *   included until reconciliation confirms the server reflects them),
 * - deleted ids: real ids only (temp ids the server never saw need no delete),
 * - placements: the FULL effective set for this diagram,
 * - removedPlacementElementIds: real element ids taken off this diagram,
 * - edgeRoutes: route upserts touched this session (empty waypoints = delete),
 * - layoutConfig: present only when touched this session, upserted whole,
 * - autoRoute: present only when the live-routing toggle moved this session.
 */
export function buildBatch(
  diagramId: string,
  base: DesignModel,
  overlay: ModelOverlay,
): DiagramContentBatch {
  const effective = mergeModel(base, overlay);
  const diagram = effective.diagrams.find((d) => d.id === diagramId);
  return {
    diagramId,
    elements: [...overlay.elements.values()],
    deletedElementIds: [...overlay.deletedElementIds],
    connections: [...overlay.connections.values()],
    deletedConnectionIds: [...overlay.deletedConnectionIds],
    placements: diagram ? [...diagram.placements] : [],
    removedPlacementElementIds: [...(overlay.removedPlacements.get(diagramId) ?? [])],
    edgeRoutes: [...(overlay.edgeRoutes.get(diagramId)?.values() ?? [])],
    layoutConfig: overlay.layoutConfigs.get(diagramId),
    // Present only when the toggle moved this session; absent = unchanged.
    autoRoute: overlay.autoRoutes.get(diagramId),
  };
}
