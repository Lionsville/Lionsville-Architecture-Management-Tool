import { MarkerType, type Edge } from '@xyflow/react';
import type { DesignDiagram, DesignElement, DesignModel, EdgeRoute, ElementId, Rect } from '../model/types';
import type { ElementNode, ElementNodeData } from './nodes/nodeData';
import type { FloatingEdgeData } from './edges/FloatingEdge';
import type { EdgeAnchors } from '../model/floatingEdgeMath';
import { aspectConfigFor } from '../model/aspects';
import { resolveArrowheads, resolveEdgeStroke } from './edges/edgeStyle';
import { assignEdgeAnchors } from '../model/floatingEdgeMath';
import {
  expandRect,
  nodeMaxSize,
  nodeMinSize,
  placementRect,
  placementSize,
  unionRects,
} from '../model/placement';
import { isAutoRoute, routeSides, routeSource } from '../model/routes';

/**
 * Pure projection of (effective model + active diagram) onto React Flow
 * nodes/edges. The canvas re-derives this whenever the model changes; live
 * drag positions live in React Flow's local state until drag-stop commits
 * them into the overlay.
 */

export interface BuildGraphArgs {
  model: DesignModel;
  diagram: DesignDiagram;
  readOnly: boolean;
  selectedElementIds?: ReadonlySet<ElementId>;
  selectedConnectionIds?: ReadonlySet<string>;
  edgeColor: string;
  /**
   * Toolbar toggle (U5): propagated onto every node's data for the badge.
   * Node-only — `buildEdges` ignores it. Defaults to on (badges shown) when
   * omitted, so edge-only call sites need not supply it.
   */
  showLifecycle?: boolean;
  /**
   * Elements being dragged right now. Edges incident to one of them render as if
   * they had no stored route, so the line follows the cursor instead of hanging
   * off a bend measured against the position the node just left.
   *
   * `buildEdges` only — nodes are unaffected. Presentation state, never committed:
   * an aborted drag leaves the stored route exactly as it was.
   */
  draggingElementIds?: ReadonlySet<ElementId>;
  /**
   * Routes computed for the drag IN FLIGHT, keyed by connection id — geometry the
   * router produced for where the cards are right now, which the model does not yet
   * know about.
   *
   * Presentation state exactly like {@link draggingElementIds}: nothing here is
   * committed, so abandoning the drag leaves the stored route untouched. Where an
   * entry exists it WINS over the stored route and over the suppression above —
   * suppressing geometry we just computed would be the one outcome worse than either
   * half alone. Where it does not (over the preview ceiling, before the gesture's
   * first result lands, or on a `manual` route the pass deliberately preserved),
   * everything behaves exactly as it did before the preview existed.
   */
  previewRoutes?: ReadonlyMap<string, EdgeRoute>;
}

const BOUNDARY_PADDING = 56;
const BOUNDARY_MIN: Rect = { x: 0, y: 0, width: 520, height: 360 };

export function buildNodes(args: BuildGraphArgs, previous?: readonly ElementNode[]): ElementNode[] {
  const elementsById = new Map(args.model.elements.map((e) => [e.id, e]));
  const containerDiagramApps = new Set(
    args.model.diagrams
      .filter((d) => d.kind === 'container' && d.applicationElementId)
      .map((d) => d.applicationElementId as ElementId),
  );

  const aspectConfig = aspectConfigFor(args.diagram);
  const nodes: ElementNode[] = [];
  for (const placement of args.diagram.placements) {
    const element = elementsById.get(placement.elementId);
    if (!element) continue;
    const isBoundary =
      args.diagram.kind === 'container' && args.diagram.applicationElementId === element.id;
    const rect = isBoundary
      ? boundaryRect(args.diagram, elementsById)
      : placementRect(element.kind, placement);
    nodes.push({
      id: element.id,
      type: isBoundary ? 'applicationBoundary' : element.kind,
      position: { x: rect.x, y: rect.y },
      width: rect.width,
      height: rect.height,
      zIndex: isBoundary ? -10 : 0,
      draggable: !args.readOnly,
      selectable: true,
      selected: args.selectedElementIds?.has(element.id) ?? false,
      data: {
        element,
        placement,
        readOnly: args.readOnly,
        aspectConfig,
        hasContainerDiagram:
          element.kind === 'application' && containerDiagramApps.has(element.id),
        resizeLimits: {
          min: nodeMinSize(element.kind),
          max: nodeMaxSize(element.kind, placement.zone, args.diagram.layoutConfig),
        },
        showLifecycle: args.showLifecycle ?? true,
      },
    });
  }
  return keepingUnchanged(nodes, previous, sameNode);
}

/**
 * The application boundary always contains its components: its rect is the
 * union of the stored placement rect and the components' bounding box plus
 * padding. Dragging a component outside grows the boundary on the next derive.
 */
export function boundaryRect(
  diagram: DesignDiagram,
  elementsById: Map<ElementId, DesignElement>,
): Rect {
  const appId = diagram.applicationElementId;
  const appPlacement = diagram.placements.find((p) => p.elementId === appId);
  const stored: Rect = {
    x: appPlacement?.x ?? 0,
    y: appPlacement?.y ?? 0,
    width: appPlacement?.width ?? BOUNDARY_MIN.width,
    height: appPlacement?.height ?? BOUNDARY_MIN.height,
  };
  const componentRects = diagram.placements
    .filter((p) => {
      const element = elementsById.get(p.elementId);
      return element?.kind === 'component' && element.parentApplicationId === appId;
    })
    .map((p) => placementRect('component', p));
  if (componentRects.length === 0) return stored;
  const componentsBox = expandRect(unionRects(componentRects) as Rect, BOUNDARY_PADDING);
  return unionRects([stored, componentsBox]) as Rect;
}

export type FloatingEdgeModel = Edge<FloatingEdgeData>;

export function buildEdges(
  args: BuildGraphArgs, previous?: readonly FloatingEdgeModel[],
): FloatingEdgeModel[] {
  const placed = new Set(args.diagram.placements.map((p) => p.elementId));
  const routes = new Map(
    (args.diagram.edgeRoutes ?? []).map((route) => [route.connectionId, route]),
  );
  // Live rects for every placed node, using the SAME geometry as buildNodes
  // (boundary union → boundaryRect, otherwise the placement rect). Feeds the
  // anchor slotter so edges sharing a node side fan out; re-derived on every
  // commit — including drags — so the slots stay live.
  const elementsById = new Map(args.model.elements.map((e) => [e.id, e]));
  const rectById = new Map<ElementId, Rect>();
  for (const placement of args.diagram.placements) {
    const element = elementsById.get(placement.elementId);
    if (!element) continue;
    const isBoundary =
      args.diagram.kind === 'container' && args.diagram.applicationElementId === element.id;
    rectById.set(
      element.id,
      isBoundary ? boundaryRect(args.diagram, elementsById) : placementRect(element.kind, placement),
    );
  }
  // Resolve what each edge DRAWS first, because the slot fan below must only see
  // the edges that will use it.
  const drawn: { connection: (typeof args.model.connections)[number]; route: EdgeRoute | undefined; stored: EdgeRoute | undefined }[] = [];
  for (const connection of args.model.connections) {
    if (!placed.has(connection.sourceId) || !placed.has(connection.targetId)) continue;
    const stored = routes.get(connection.id);
    // Suppressed only for router output, and only while its node moves.
    //
    // A MANUAL route keeps its waypoints AND its chip through the drag. Dropping
    // them would fight the never-replace-a-human's-geometry rule at the one moment
    // the user is watching it, on exactly the edges where they placed the bends
    // deliberately — and throwing a hand-positioned chip to the path midpoint for
    // the duration of a drag is a louder flicker than the shape change this avoids.
    // The cost is that a manual route kinks in mid-air while the node travels.
    // That is stored geometry visibly going stale, which is honest: the drop
    // reroute is not going to touch it either.
    //
    // A PREVIEWED route pre-empts all of that: it is geometry for where the card
    // actually is, so there is nothing stale to hide.
    const preview = args.previewRoutes?.get(connection.id);
    const suppressed =
      preview === undefined &&
      isAutoRoute(stored) &&
      (args.draggingElementIds?.has(connection.sourceId) ||
        args.draggingElementIds?.has(connection.targetId));
    drawn.push({ connection, stored, route: preview ?? (suppressed ? undefined : stored) });
  }
  // Only the edges that draw WITHOUT bends take a slot. A routed edge attaches
  // where its first leg arrives (`routeEndAnchor`) and never reads `anchors`, so
  // counting it in the fan pushed the straight edges next to it off the side's
  // centre for a neighbour that was not there.
  //
  // The attach sides come from the STORED row: they are constraints the user set,
  // which a preview carries verbatim and a suppression must not hide.
  const anchorInputs = drawn
    .filter(({ route }) => (route?.waypoints.length ?? 0) === 0)
    .map(({ connection, stored, route }) => ({
      id: connection.id,
      sourceId: connection.sourceId,
      targetId: connection.targetId,
      ...routeSides(stored ?? route),
    }));
  const anchorsById = assignEdgeAnchors(anchorInputs, rectById);

  const edges: FloatingEdgeModel[] = [];
  for (const { connection, route, stored } of drawn) {
    // Resolve the stroke once and reuse it for the arrowheads, so a custom edge
    // colour tints the line and its markers together (plan D1). NULL falls back
    // to the theme token exactly as before.
    const stroke = resolveEdgeStroke(connection.color, args.edgeColor);
    const marker = { type: MarkerType.ArrowClosed, width: 16, height: 16, color: stroke };
    const heads = resolveArrowheads(connection);
    edges.push({
      id: connection.id,
      type: 'floating',
      source: connection.sourceId,
      target: connection.targetId,
      selected: args.selectedConnectionIds?.has(connection.id) ?? false,
      reconnectable: !args.readOnly,
      markerEnd: heads.end ? marker : undefined,
      markerStart: heads.start ? marker : undefined,
      data: {
        label: connection.label,
        protocol: connection.protocol,
        isBidirectional: connection.isBidirectional,
        color: connection.color,
        lineStyle: connection.lineStyle,
        routing: connection.routing,
        waypoints: route?.waypoints ?? [],
        labelPosition: route?.labelPosition,
        // No stored route resolves to `manual` too, which is right: an edge with
        // no bends has no handles to hide and no corners to round either way.
        // Reads from the STORED route, not the suppressed one: a suppressed edge
        // is still an auto route, it is just not drawing its bends this instant.
        // A previewed route is router output and therefore `auto`, which is what
        // makes the preview draw at the SAME corner radius the drop will — the
        // radius changing at the drop would be the snap in miniature.
        routeSource: routeSource(route ?? stored),
        anchors: anchorsById.get(connection.id),
        // The same stored constraints the slot fan above was given, for the
        // routed branch (anchor on the side) and the side marker.
        ...routeSides(stored ?? route),
      },
    });
  }
  return keepingUnchanged(edges, previous, sameEdge);
}

/** Sizes used by ELK and the boundary: explicit placement size or kind default. */
export function nodeSizeOf(element: DesignElement, diagram: DesignDiagram): {
  width: number;
  height: number;
} {
  const placement = diagram.placements.find((p) => p.elementId === element.id);
  return placementSize(element.kind, placement);
}

// --- keeping the objects that did not change ---------------------------------

/**
 * The derive is a projection, so it naturally builds a fresh object for every
 * node and every edge on every commit — and a fresh `data` literal is what
 * `React.memo` on the seven node components and on the edge compares against.
 * The result was that typing one character into an inspector re-rendered every
 * box on the board, because every box was handed a new object saying exactly
 * what the old one said.
 *
 * So the projection is built as before and then reconciled against what the
 * canvas last drew: a row that says the same thing keeps the object it already
 * had, and a list in which nothing moved comes back as the list itself, so the
 * push into React Flow does not happen either.
 *
 * The comparisons below are by IDENTITY wherever the model supplies the value —
 * the element, the placement, the aspect columns, a stored route's waypoints —
 * because the reducer keeps those stable (ADR-0002) and `fromDiagram` carries
 * that across the array boundary. Only the values this file computes fresh each
 * time, the rects and the slotted anchors, are compared by value.
 */
function keepingUnchanged<T extends { id: string }>(
  built: T[], previous: readonly T[] | undefined, same: (held: T, next: T) => boolean,
): T[] {
  if (!previous || previous.length === 0) return built;
  const held = new Map(previous.map((row) => [row.id, row]));
  for (let n = 0; n < built.length; n++) {
    const before = held.get(built[n].id);
    if (before && same(before, built[n])) built[n] = before;
  }
  const unmoved =
    built.length === previous.length && built.every((row, n) => row === previous[n]);
  return unmoved ? (previous as T[]) : built;
}

function sameNode(held: ElementNode, next: ElementNode): boolean {
  return (
    held.type === next.type &&
    held.position.x === next.position.x &&
    held.position.y === next.position.y &&
    held.width === next.width &&
    held.height === next.height &&
    held.zIndex === next.zIndex &&
    held.draggable === next.draggable &&
    held.selectable === next.selectable &&
    held.selected === next.selected &&
    sameNodeData(held.data, next.data)
  );
}

function sameNodeData(held: ElementNodeData, next: ElementNodeData): boolean {
  return (
    held.element === next.element &&
    held.placement === next.placement &&
    held.readOnly === next.readOnly &&
    held.aspectConfig === next.aspectConfig &&
    held.hasContainerDiagram === next.hasContainerDiagram &&
    held.showLifecycle === next.showLifecycle &&
    held.resizeLimits.min.width === next.resizeLimits.min.width &&
    held.resizeLimits.min.height === next.resizeLimits.min.height &&
    held.resizeLimits.max.width === next.resizeLimits.max.width &&
    held.resizeLimits.max.height === next.resizeLimits.max.height
  );
}

function sameEdge(held: FloatingEdgeModel, next: FloatingEdgeModel): boolean {
  return (
    held.type === next.type &&
    held.source === next.source &&
    held.target === next.target &&
    held.selected === next.selected &&
    held.reconnectable === next.reconnectable &&
    sameMarker(held.markerEnd, next.markerEnd) &&
    sameMarker(held.markerStart, next.markerStart) &&
    sameEdgeData(held.data, next.data)
  );
}

function sameEdgeData(held?: FloatingEdgeData, next?: FloatingEdgeData): boolean {
  if (!held || !next) return held === next;
  return (
    held.label === next.label &&
    held.protocol === next.protocol &&
    held.isBidirectional === next.isBidirectional &&
    held.color === next.color &&
    held.lineStyle === next.lineStyle &&
    held.routing === next.routing &&
    held.routeSource === next.routeSource &&
    held.sourceSide === next.sourceSide &&
    held.targetSide === next.targetSide &&
    // The stored route's own array where there is one, and a fresh empty array
    // where there is not — so identity answers the first case and the length
    // answers the second.
    (held.waypoints === next.waypoints ||
      ((held.waypoints?.length ?? 0) === 0 && (next.waypoints?.length ?? 0) === 0)) &&
    held.labelPosition === next.labelPosition &&
    sameAnchors(held.anchors, next.anchors)
  );
}

function sameAnchors(held?: EdgeAnchors, next?: EdgeAnchors): boolean {
  if (!held || !next) return held === next;
  return (
    held.sourceX === next.sourceX &&
    held.sourceY === next.sourceY &&
    held.sourcePosition === next.sourcePosition &&
    held.targetX === next.targetX &&
    held.targetY === next.targetY &&
    held.targetPosition === next.targetPosition
  );
}

/** React Flow's marker: our own literal, so four fields rather than a reference. */
function sameMarker(held: FloatingEdgeModel['markerEnd'], next: FloatingEdgeModel['markerEnd']): boolean {
  if (!held || !next) return held === next;
  if (typeof held === 'string' || typeof next === 'string') return held === next;
  return (
    held.type === next.type &&
    held.width === next.width &&
    held.height === next.height &&
    held.color === next.color
  );
}
