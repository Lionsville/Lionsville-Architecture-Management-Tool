import type {
  DesignConnection,
  DesignElement,
  DesignModel,
  DiagramLayoutConfig,
  DiagramPlacement,
  EdgeRoute,
  ElementId,
} from '../types';
import {
  connectionsEqual,
  edgeRoutesEqual,
  elementsEqual,
  layoutConfigsEqual,
  placementsEqual,
} from './equality';
import { EMPTY_OVERLAY, type ModelOverlay } from './overlay';
import { hasRouteContent } from './routes';

/**
 * EFFECTIVE-STATE SNAPSHOTS (U7 undo/redo, B-effective-state)
 * ----------------------------------------------------------
 * The overlay is a PATCH over `props.model`, and the host swaps `props.model`
 * on every ~800ms autosave, so the server base absorbs each saved change.
 * Snapshotting the raw patch therefore goes stale the moment a save lands
 * (an empty pre-add overlay re-merges over the now-element-containing base and
 * keeps the element). So the undo stack instead snapshots the EFFECTIVE state
 * (`effectiveOverlay`), and `diffToOverlay` synthesises the exact corrective
 * patch of that state against whatever base is current at undo time.
 *
 * `diffToOverlay` is the inverse of `mergeModel`: for a full-upsert `target`
 * overlay (a complete state, no deletes) and any `base`,
 *   mergeModel(base, diffToOverlay(base, target))   field-equals   target.
 * It is the one place in U7 that synthesises DELETES, so it is deliberately
 * conservative: a base row is deleted ONLY when it is genuinely absent from the
 * target, and an upsert is emitted whenever the row differs. `elementsEqual`/
 * `connectionsEqual` cover every persisted field, style included, so a no-op
 * upsert is skipped without ever dropping a post-save style undo.
 */

/**
 * Build the full-upsert overlay of a model: every element/connection/placement/
 * content-bearing route/layoutConfig as an upsert, no deletes. This is the undo
 * stack's snapshot form — it stays a `ModelOverlay` so `remapOverlayIds` can
 * rewrite its tempIds on reconcile, exactly like the live overlay.
 */
export function effectiveOverlay(model: DesignModel): ModelOverlay {
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const connections = new Map(model.connections.map((c) => [c.id, c]));
  const placements = new Map<string, ReadonlyMap<ElementId, DiagramPlacement>>();
  const edgeRoutes = new Map<string, ReadonlyMap<string, EdgeRoute>>();
  const layoutConfigs = new Map<string, DiagramLayoutConfig>();

  for (const d of model.diagrams) {
    if (d.placements.length > 0) {
      placements.set(d.id, new Map(d.placements.map((p) => [p.elementId, p])));
    }
    const routes = (d.edgeRoutes ?? []).filter(hasRouteContent);
    if (routes.length > 0) {
      edgeRoutes.set(d.id, new Map(routes.map((r) => [r.connectionId, r])));
    }
    if (d.layoutConfig) layoutConfigs.set(d.id, d.layoutConfig);
  }

  return {
    ...EMPTY_OVERLAY,
    elements,
    connections,
    placements,
    edgeRoutes,
    layoutConfigs,
  };
}

/**
 * Synthesise the overlay patch that turns `base` into `target` (a complete
 * full-upsert overlay). Mirrors `mergeModel`/`buildBatch` field-by-field so the
 * round-trip is exact and no persisted row is silently dropped.
 */
export function diffToOverlay(base: DesignModel, target: ModelOverlay): ModelOverlay {
  const baseElements = new Map(base.elements.map((e) => [e.id, e]));
  const baseConnections = new Map(base.connections.map((c) => [c.id, c]));

  // Elements: upsert every changed/new target element; delete base ids the
  // target no longer has. A base id PRESENT in the target is never deleted.
  const elements = new Map<ElementId, DesignElement>();
  for (const [id, element] of target.elements) {
    const b = baseElements.get(id);
    if (!b || !elementsEqual(b, element)) elements.set(id, element);
  }
  const deletedElementIds = new Set<ElementId>();
  for (const b of base.elements) {
    if (!target.elements.has(b.id)) deletedElementIds.add(b.id);
  }

  // Connections: symmetric.
  const connections = new Map<string, DesignConnection>();
  for (const [id, connection] of target.connections) {
    const b = baseConnections.get(id);
    if (!b || !connectionsEqual(b, connection)) connections.set(id, connection);
  }
  const deletedConnectionIds = new Set<string>();
  for (const b of base.connections) {
    if (!target.connections.has(b.id)) deletedConnectionIds.add(b.id);
  }

  const placements = new Map<string, ReadonlyMap<ElementId, DiagramPlacement>>();
  const removedPlacements = new Map<string, ReadonlySet<ElementId>>();
  const edgeRoutes = new Map<string, ReadonlyMap<string, EdgeRoute>>();
  const layoutConfigs = new Map<string, DiagramLayoutConfig>();

  for (const d of base.diagrams) {
    const targetPlacements = target.placements.get(d.id);

    // Placement upserts: target placements that differ from base.
    const basePlacements = new Map(d.placements.map((p) => [p.elementId, p]));
    const placementUpserts = new Map<ElementId, DiagramPlacement>();
    if (targetPlacements) {
      for (const [elementId, placement] of targetPlacements) {
        const bp = basePlacements.get(elementId);
        if (!bp || !placementsEqual(bp, placement)) placementUpserts.set(elementId, placement);
      }
    }
    if (placementUpserts.size > 0) placements.set(d.id, placementUpserts);

    // Removed placements: a base-placed element the target unplaced from this
    // diagram — but only when the element still EXISTS in the target (a fully
    // deleted element is excluded by visibility via `deletedElementIds`, so it
    // must not also appear as a placement removal).
    const removed = new Set<ElementId>();
    for (const bp of d.placements) {
      if (!targetPlacements?.has(bp.elementId) && target.elements.has(bp.elementId)) {
        removed.add(bp.elementId);
      }
    }
    if (removed.size > 0) removedPlacements.set(d.id, removed);

    // Edge routes: upsert changed target routes; add the content-less delete
    // marker for a base route the target dropped (connection still present).
    const targetRoutes = target.edgeRoutes.get(d.id);
    const baseRoutes = new Map((d.edgeRoutes ?? []).map((r) => [r.connectionId, r]));
    const routeUpserts = new Map<string, EdgeRoute>();
    if (targetRoutes) {
      for (const [connectionId, route] of targetRoutes) {
        const br = baseRoutes.get(connectionId);
        if (!br || !edgeRoutesEqual(br, route)) routeUpserts.set(connectionId, route);
      }
    }
    for (const [connectionId, br] of baseRoutes) {
      if (!hasRouteContent(br)) continue;
      if (!targetRoutes?.has(connectionId) && target.connections.has(connectionId)) {
        routeUpserts.set(connectionId, { connectionId, waypoints: [], labelPosition: undefined });
      }
    }
    if (routeUpserts.size > 0) edgeRoutes.set(d.id, routeUpserts);

    // Layout config: upsert when the target's differs. (A layoutConfig is only
    // ever set/grown, never cleared to undefined, and the overlay has no clear
    // marker — so a target without one leaves the base config untouched.)
    const targetLayout = target.layoutConfigs.get(d.id);
    if (targetLayout && !layoutConfigsEqual(d.layoutConfig, targetLayout)) {
      layoutConfigs.set(d.id, targetLayout);
    }
  }

  return {
    ...EMPTY_OVERLAY,
    elements,
    deletedElementIds,
    connections,
    deletedConnectionIds,
    placements,
    removedPlacements,
    edgeRoutes,
    layoutConfigs,
  };
}
