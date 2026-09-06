import type {
  DesignConnection,
  DesignDiagram,
  DesignElement,
  DiagramPlacement,
  ElementId,
  ElementKind,
  Point,
} from './types';

/** In-memory paste snapshot: copied elements, their fully-internal
 * connections, and their placements on the source diagram. */
export interface ClipboardPayload {
  elements: DesignElement[];
  connections: DesignConnection[];
  placements: DiagramPlacement[];
}

/**
 * COPY / PASTE (U4a)
 * ------------------
 * An in-memory, diagram-agnostic snapshot of a selection plus its placements
 * and fully-internal connections. Paste reuses the tempId → reconcile path
 * (see reconcile.ts): every copied id is minted a fresh temp id, and every
 * reference (`parentApplicationId`, connection endpoints, placement elementId)
 * is remapped through the old→new map. The save round-trip assigns real ids
 * and reconciliation re-keys via the host's alias maps — paste introduces no
 * new persistence concept, and always creates NEW elements (it never silently
 * re-places an existing one), so semantics stay predictable across diagrams.
 */

/**
 * Serialize the given elements — plus their placements on `diagram` and any
 * connection whose *both* endpoints are among them — into a paste payload.
 * Only elements actually placed on `diagram` are captured (you copy what is
 * on the canvas). Returns undefined when none of the ids are placed here.
 */
export function serializeSelection(
  model: { elements: DesignElement[]; connections: DesignConnection[] },
  diagram: DesignDiagram,
  elementIds: readonly ElementId[],
): ClipboardPayload | undefined {
  const requested = new Set(elementIds);
  const placements = diagram.placements.filter((p) => requested.has(p.elementId));
  const placedIds = new Set(placements.map((p) => p.elementId));
  if (placedIds.size === 0) return undefined;

  const elements = model.elements.filter((e) => placedIds.has(e.id));
  const connections = model.connections.filter(
    (c) => placedIds.has(c.sourceId) && placedIds.has(c.targetId),
  );
  return {
    elements: elements.map((e) => structuredClone(e)),
    connections: connections.map((c) => ({ ...c })),
    placements: placements.map((p) => ({ ...p })),
  };
}

export interface PasteTarget {
  kind: DesignDiagram['kind'];
  /** Container boundary application; the parent for pasted components. */
  applicationElementId?: ElementId;
  /** Group names that exist on the target diagram (layer7). */
  domainGroupNames?: ReadonlySet<string>;
}

export interface RemapOptions {
  mintElementId(): ElementId;
  mintConnectionId(): string;
  /** Flow-coordinate shift applied to every pasted placement. */
  offset: Point;
  target: PasteTarget;
}

/**
 * Produce a fresh, remapped payload ready to commit onto the target diagram:
 * new temp ids for every element/connection, references rewired through the
 * old→new map, placements offset and scoped to the target diagram kind.
 */
export function remapClipboard(
  payload: ClipboardPayload,
  options: RemapOptions,
): ClipboardPayload {
  const idMap = new Map<ElementId, ElementId>();
  for (const element of payload.elements) idMap.set(element.id, options.mintElementId());

  const elements: DesignElement[] = payload.elements.map((element) => ({
    ...structuredClone(element),
    id: idMap.get(element.id) as ElementId,
    parentApplicationId: remapParent(element.parentApplicationId, element.kind, idMap, options.target),
  }));

  const connections: DesignConnection[] = payload.connections.map((connection) => ({
    ...connection,
    id: options.mintConnectionId(),
    // Serialize kept only connections whose both endpoints were copied, so
    // both ids are always in the map.
    sourceId: idMap.get(connection.sourceId) as ElementId,
    targetId: idMap.get(connection.targetId) as ElementId,
  }));

  const placements = payload.placements.map((placement) =>
    remapPlacement(placement, idMap, options),
  );

  return { elements, connections, placements };
}

/**
 * A pasted reference keeps pointing at the copied parent when that parent is
 * in the paste set; otherwise a component pasted into a container adopts the
 * target's boundary application (mirrors addElement's parent logic), and
 * everything else drops the parent.
 */
function remapParent(
  parentId: ElementId | undefined,
  kind: ElementKind,
  idMap: ReadonlyMap<ElementId, ElementId>,
  target: PasteTarget,
): ElementId | undefined {
  if (parentId && idMap.has(parentId)) return idMap.get(parentId);
  if (kind === 'component' && target.kind === 'container') return target.applicationElementId;
  return undefined;
}

function remapPlacement(
  placement: DiagramPlacement,
  idMap: ReadonlyMap<ElementId, ElementId>,
  options: RemapOptions,
): DiagramPlacement {
  const base: DiagramPlacement = {
    ...placement,
    elementId: idMap.get(placement.elementId) as ElementId,
    x: placement.x + options.offset.x,
    y: placement.y + options.offset.y,
  };
  // zone / domainGroup only mean something on a layer7 diagram; drop them when
  // pasting into a container, and drop a group tag the target doesn't define.
  if (options.target.kind !== 'layer7') {
    return { ...base, zone: undefined, domainGroup: undefined };
  }
  return {
    ...base,
    domainGroup:
      placement.domainGroup && options.target.domainGroupNames?.has(placement.domainGroup)
        ? placement.domainGroup
        : undefined,
  };
}

/**
 * The offset that lands a payload's top-left corner on `point` — "Paste here".
 * `pasteClipboard` shifts every placement by one offset, so the pasted set keeps
 * its shape and its own top-left goes where the user clicked.
 */
export function pasteOffsetFor(payload: ClipboardPayload, point: Point): Point {
  if (payload.placements.length === 0) return { x: 0, y: 0 };
  const minX = Math.min(...payload.placements.map((p) => p.x));
  const minY = Math.min(...payload.placements.map((p) => p.y));
  return { x: point.x - minX, y: point.y - minY };
}
