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
import type { ModelOverlay } from './overlay';
import { hasRouteContent } from './routes';

/**
 * RECONCILIATION (the other half of the merge strategy — see overlay.ts)
 * ----------------------------------------------------------------------
 * Runs whenever the host hands us a new `model` prop (usually after a save
 * round-trip). Three jobs:
 *
 * 1. **Temp-id resolution.** The host replaced temp ids with real ids. When
 *    it supplies the authoritative maps from its save responses
 *    (`knownElementAliases`/`knownConnectionAliases`), those win outright.
 *    Otherwise we fall back to matching: an element that is *new* in the
 *    incoming model and equals the *last emitted snapshot* of a temp element
 *    (same kind + name, nearest placement) is that element. The overlay is
 *    re-keyed to the real id; any newer in-flight edits survive under the
 *    real id. Connections match on resolved endpoints + label.
 * 2. **Value-based clearing.** Overlay entries whose incoming model value is
 *    field-equal made the round trip and are dropped. Different values mean
 *    in-flight edits — they stay and keep winning (last-write-wins, v1).
 * 3. **Race repair.** A temp element deleted locally but persisted by an
 *    earlier save becomes a real-id delete; the caller must re-emit a batch
 *    (`mustEmit`).
 */

export interface EmittedElementSnapshot {
  tempId: ElementId;
  kind: DesignElement['kind'];
  name: string;
  placement?: { diagramId: string; x: number; y: number };
}

export interface EmittedConnectionSnapshot {
  tempId: string;
  sourceId: ElementId;
  targetId: ElementId;
  label?: string;
  protocol?: string;
  isBidirectional: boolean;
}

export interface ReconcileArgs {
  previous: DesignModel;
  incoming: DesignModel;
  overlay: ModelOverlay;
  emittedElements: EmittedElementSnapshot[];
  emittedConnections: EmittedConnectionSnapshot[];
  /**
   * Authoritative tempId → real-id maps from the host's save responses.
   * Consulted before heuristic matching — heuristics cannot tell identical
   * twins apart (two default-named elements, two identical parallel
   * connections) and would alias them by iteration order. Heuristics remain
   * as a fallback for ids the maps don't cover.
   */
  knownElementAliases?: ReadonlyMap<ElementId, ElementId>;
  knownConnectionAliases?: ReadonlyMap<string, string>;
}

export interface ReconcileResult {
  overlay: ModelOverlay;
  /** tempId → real id, for selection remapping and snapshot cleanup. */
  elementAliases: Map<ElementId, ElementId>;
  connectionAliases: Map<string, string>;
  /** True when a deletion materialised that must be persisted (re-emit). */
  mustEmit: boolean;
}

/**
 * Rewrite every tempId in an overlay to its reconciled server id, composing the
 * two alias rewriters in the SAME order `reconcileOverlay` uses (elements first
 * — so connection endpoints follow — then connection ids/routes). Pure; returns
 * the input untouched when both alias maps are empty.
 *
 * Used by the in-memory undo/redo stack (U7): on every reconcile the whole
 * history is remapped through this so a snapshot captured while it still held a
 * tempId can never re-emit that tempId as a duplicate create after the id has
 * reconciled to a real one.
 */
export function remapOverlayIds(
  overlay: ModelOverlay,
  elementAliases: Map<ElementId, ElementId>,
  connectionAliases: Map<string, string>,
): ModelOverlay {
  return rewriteConnectionAliases(
    rewriteElementAliases(overlay, elementAliases),
    connectionAliases,
  );
}

export function reconcileOverlay(args: ReconcileArgs): ReconcileResult {
  const elementAliases = matchTempElements(args);
  let overlay = rewriteElementAliases(args.overlay, elementAliases);
  const connectionAliases = matchTempConnections(args, elementAliases, overlay);
  overlay = rewriteConnectionAliases(overlay, connectionAliases);
  const { overlay: repaired, mustEmit } = materialiseRacedDeletes(
    overlay,
    elementAliases,
    connectionAliases,
  );
  overlay = clearReflectedEntries(repaired, args.incoming);
  return { overlay, elementAliases, connectionAliases, mustEmit };
}

function placementOf(
  model: DesignModel,
  elementId: ElementId,
  diagramId: string,
): DiagramPlacement | undefined {
  return model.diagrams
    .find((d) => d.id === diagramId)
    ?.placements.find((p) => p.elementId === elementId);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Match emitted temp elements against elements that newly appeared in the
 * incoming model. Hard requirements: same kind + the name as last emitted
 * (the server echoes the latest save, which is the latest emission).
 * Tie-break: nearest placement on the snapshot's diagram.
 */
function matchTempElements(args: ReconcileArgs): Map<ElementId, ElementId> {
  const aliases = new Map<ElementId, ElementId>();
  const previousIds = new Set(args.previous.elements.map((e) => e.id));
  const candidates = args.incoming.elements.filter((e) => !previousIds.has(e.id));
  const incomingIds = new Set(args.incoming.elements.map((e) => e.id));
  if (candidates.length === 0 && !args.knownElementAliases?.size) return aliases;

  const claimed = new Set<ElementId>();
  for (const snapshot of args.emittedElements) {
    const stillRelevant =
      args.overlay.elements.has(snapshot.tempId) ||
      args.overlay.deletedTempElementIds.has(snapshot.tempId) ||
      overlayReferences(args.overlay, snapshot.tempId);
    if (!stillRelevant) continue;

    // Authoritative alias from the host's save response wins outright. It may
    // point at an element that predates `previous` (a heuristic miss in an
    // earlier reconcile), so check against all incoming ids, not candidates.
    const known = args.knownElementAliases?.get(snapshot.tempId);
    if (known !== undefined && incomingIds.has(known) && !claimed.has(known)) {
      claimed.add(known);
      aliases.set(snapshot.tempId, known);
      continue;
    }

    let best: { id: ElementId; score: number } | undefined;
    for (const candidate of candidates) {
      if (claimed.has(candidate.id)) continue;
      if (candidate.kind !== snapshot.kind || candidate.name !== snapshot.name) continue;
      let score = 0;
      if (snapshot.placement) {
        const incomingPlacement = placementOf(
          args.incoming,
          candidate.id,
          snapshot.placement.diagramId,
        );
        score = incomingPlacement ? distance(incomingPlacement, snapshot.placement) : 10_000;
      }
      if (!best || score < best.score) best = { id: candidate.id, score };
    }
    if (best) {
      claimed.add(best.id);
      aliases.set(snapshot.tempId, best.id);
    }
  }
  return aliases;
}

function overlayReferences(overlay: ModelOverlay, tempId: ElementId): boolean {
  for (const element of overlay.elements.values()) {
    if (element.parentApplicationId === tempId) return true;
  }
  for (const connection of overlay.connections.values()) {
    if (connection.sourceId === tempId || connection.targetId === tempId) return true;
  }
  for (const forDiagram of overlay.placements.values()) {
    if (forDiagram.has(tempId)) return true;
  }
  return false;
}

function resolveId(id: ElementId, aliases: Map<ElementId, ElementId>): ElementId {
  return aliases.get(id) ?? id;
}

function rewriteElementAliases(
  overlay: ModelOverlay,
  aliases: Map<ElementId, ElementId>,
): ModelOverlay {
  if (aliases.size === 0) return overlay;

  const elements = new Map<ElementId, DesignElement>();
  for (const [id, element] of overlay.elements) {
    const realId = resolveId(id, aliases);
    elements.set(realId, {
      ...element,
      id: realId,
      parentApplicationId: element.parentApplicationId
        ? resolveId(element.parentApplicationId, aliases)
        : element.parentApplicationId,
    });
  }

  const connections = new Map<string, DesignConnection>();
  for (const [id, connection] of overlay.connections) {
    connections.set(id, {
      ...connection,
      sourceId: resolveId(connection.sourceId, aliases),
      targetId: resolveId(connection.targetId, aliases),
    });
  }

  const placements = new Map<string, ReadonlyMap<ElementId, DiagramPlacement>>();
  for (const [diagramId, forDiagram] of overlay.placements) {
    const rewritten = new Map<ElementId, DiagramPlacement>();
    for (const [elementId, placement] of forDiagram) {
      const realId = resolveId(elementId, aliases);
      rewritten.set(realId, { ...placement, elementId: realId });
    }
    placements.set(diagramId, rewritten);
  }

  return { ...overlay, elements, connections, placements };
}

function matchTempConnections(
  args: ReconcileArgs,
  elementAliases: Map<ElementId, ElementId>,
  overlay: ModelOverlay,
): Map<string, string> {
  const aliases = new Map<string, string>();
  const previousIds = new Set(args.previous.connections.map((c) => c.id));
  const candidates = args.incoming.connections.filter((c) => !previousIds.has(c.id));
  const incomingIds = new Set(args.incoming.connections.map((c) => c.id));
  if (candidates.length === 0 && !args.knownConnectionAliases?.size) return aliases;

  const claimed = new Set<string>();
  for (const snapshot of args.emittedConnections) {
    const stillRelevant =
      overlay.connections.has(snapshot.tempId) ||
      overlay.deletedTempConnectionIds.has(snapshot.tempId);
    if (!stillRelevant) continue;

    // Authoritative alias first — endpoints+label matching cannot tell two
    // identical parallel connections apart (routes would follow the wrong id).
    const known = args.knownConnectionAliases?.get(snapshot.tempId);
    if (known !== undefined && incomingIds.has(known) && !claimed.has(known)) {
      claimed.add(known);
      aliases.set(snapshot.tempId, known);
      continue;
    }

    const sourceId = resolveId(snapshot.sourceId, elementAliases);
    const targetId = resolveId(snapshot.targetId, elementAliases);
    const match = candidates.find(
      (c) =>
        !claimed.has(c.id) &&
        c.sourceId === sourceId &&
        c.targetId === targetId &&
        (c.label ?? undefined) === snapshot.label &&
        (c.protocol ?? undefined) === snapshot.protocol &&
        c.isBidirectional === snapshot.isBidirectional,
    );
    if (match) {
      claimed.add(match.id);
      aliases.set(snapshot.tempId, match.id);
    }
  }
  return aliases;
}

function rewriteConnectionAliases(
  overlay: ModelOverlay,
  aliases: Map<string, string>,
): ModelOverlay {
  if (aliases.size === 0) return overlay;
  const connections = new Map<string, DesignConnection>();
  for (const [id, connection] of overlay.connections) {
    const realId = resolveId(id, aliases);
    connections.set(realId, { ...connection, id: realId });
  }
  // Routes keyed by a resolved temp connection follow it to the real id.
  const edgeRoutes = new Map<string, ReadonlyMap<string, EdgeRoute>>();
  for (const [diagramId, forDiagram] of overlay.edgeRoutes) {
    const rewritten = new Map<string, EdgeRoute>();
    for (const [connectionId, route] of forDiagram) {
      const realId = resolveId(connectionId, aliases);
      rewritten.set(realId, { ...route, connectionId: realId });
    }
    edgeRoutes.set(diagramId, rewritten);
  }
  return { ...overlay, connections, edgeRoutes };
}

/** Local deletes of temp items the server persisted anyway become real deletes. */
function materialiseRacedDeletes(
  overlay: ModelOverlay,
  elementAliases: Map<ElementId, ElementId>,
  connectionAliases: Map<string, string>,
): { overlay: ModelOverlay; mustEmit: boolean } {
  let mustEmit = false;
  let next = overlay;

  for (const tempId of overlay.deletedTempElementIds) {
    const realId = elementAliases.get(tempId);
    if (!realId) continue;
    const deletedTempElementIds = new Set(next.deletedTempElementIds);
    deletedTempElementIds.delete(tempId);
    const deletedElementIds = new Set(next.deletedElementIds);
    deletedElementIds.add(realId);
    next = { ...next, deletedTempElementIds, deletedElementIds };
    mustEmit = true;
  }

  for (const tempId of overlay.deletedTempConnectionIds) {
    const realId = connectionAliases.get(tempId);
    if (!realId) continue;
    const deletedTempConnectionIds = new Set(next.deletedTempConnectionIds);
    deletedTempConnectionIds.delete(tempId);
    const deletedConnectionIds = new Set(next.deletedConnectionIds);
    deletedConnectionIds.add(realId);
    next = { ...next, deletedTempConnectionIds, deletedConnectionIds };
    mustEmit = true;
  }

  return { overlay: next, mustEmit };
}

/** Drop every overlay entry the incoming model already reflects. */
function clearReflectedEntries(overlay: ModelOverlay, incoming: DesignModel): ModelOverlay {
  const incomingElements = new Map(incoming.elements.map((e) => [e.id, e]));
  const incomingConnections = new Map(incoming.connections.map((c) => [c.id, c]));

  const elements = new Map(overlay.elements);
  for (const [id, element] of overlay.elements) {
    const reflected = incomingElements.get(id);
    if (reflected && elementsEqual(reflected, element)) elements.delete(id);
  }

  const deletedElementIds = new Set(overlay.deletedElementIds);
  for (const id of overlay.deletedElementIds) {
    if (!incomingElements.has(id)) deletedElementIds.delete(id);
  }

  const connections = new Map(overlay.connections);
  for (const [id, connection] of overlay.connections) {
    const reflected = incomingConnections.get(id);
    if (reflected && connectionsEqual(reflected, connection)) connections.delete(id);
  }

  const deletedConnectionIds = new Set(overlay.deletedConnectionIds);
  for (const id of overlay.deletedConnectionIds) {
    if (!incomingConnections.has(id)) deletedConnectionIds.delete(id);
  }

  const placements = new Map<string, ReadonlyMap<ElementId, DiagramPlacement>>();
  for (const [diagramId, forDiagram] of overlay.placements) {
    const remaining = new Map<ElementId, DiagramPlacement>();
    for (const [elementId, placement] of forDiagram) {
      const reflected = placementOf(incoming, elementId, diagramId);
      if (reflected && placementsEqual(reflected, placement)) continue;
      remaining.set(elementId, placement);
    }
    if (remaining.size > 0) placements.set(diagramId, remaining);
  }

  const removedPlacements = new Map<string, ReadonlySet<ElementId>>();
  for (const [diagramId, removed] of overlay.removedPlacements) {
    const remaining = new Set<ElementId>();
    for (const elementId of removed) {
      if (placementOf(incoming, elementId, diagramId)) remaining.add(elementId);
    }
    if (remaining.size > 0) removedPlacements.set(diagramId, remaining);
  }

  const edgeRoutes = new Map<string, ReadonlyMap<string, EdgeRoute>>();
  for (const [diagramId, forDiagram] of overlay.edgeRoutes) {
    const incomingDiagram = incoming.diagrams.find((d) => d.id === diagramId);
    const remaining = new Map<string, EdgeRoute>();
    for (const [connectionId, route] of forDiagram) {
      const reflected = incomingDiagram?.edgeRoutes?.find(
        (r) => r.connectionId === connectionId,
      );
      if (!hasRouteContent(route)) {
        // Delete marker: cleared once the incoming diagram has no route.
        if (!reflected) continue;
      } else if (reflected && edgeRoutesEqual(reflected, route)) {
        continue;
      }
      remaining.set(connectionId, route);
    }
    if (remaining.size > 0) edgeRoutes.set(diagramId, remaining);
  }

  const layoutConfigs = new Map<string, DiagramLayoutConfig>();
  for (const [diagramId, config] of overlay.layoutConfigs) {
    const incomingDiagram = incoming.diagrams.find((d) => d.id === diagramId);
    if (incomingDiagram && layoutConfigsEqual(incomingDiagram.layoutConfig, config)) continue;
    layoutConfigs.set(diagramId, config);
  }

  // The auto-route flag leaves the overlay the same way everything else does:
  // once the server reflects it back, the local value has made the round trip and
  // holding it any longer would keep re-applying a value that is already the base.
  const autoRoutes = new Map<string, boolean>();
  for (const [diagramId, autoRoute] of overlay.autoRoutes) {
    const incomingDiagram = incoming.diagrams.find((d) => d.id === diagramId);
    // `undefined` on the diagram means off, so it round-trips a `false` correctly.
    if (incomingDiagram && (incomingDiagram.autoRoute ?? false) === autoRoute) continue;
    autoRoutes.set(diagramId, autoRoute);
  }

  return {
    ...overlay,
    elements,
    deletedElementIds,
    connections,
    deletedConnectionIds,
    placements,
    removedPlacements,
    edgeRoutes,
    layoutConfigs,
    autoRoutes,
  };
}
