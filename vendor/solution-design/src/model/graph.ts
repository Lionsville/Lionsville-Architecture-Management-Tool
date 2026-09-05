import { MarkerType, type Edge } from '@xyflow/react';
import type {
  DesignDiagram,
  DesignElement,
  DesignModel,
  EdgeRoute,
  ElementDecoration,
  ElementId,
  Rect,
} from '../types';
import type { ElementNode } from '../nodes/nodeData';
import type { FloatingEdgeData } from '../edges/FloatingEdge';
import { aspectConfigFor } from './aspects';
import { resolveArrowheads, resolveEdgeStroke } from '../edges/edgeStyle';
import { assignEdgeAnchors } from '../edges/floatingEdgeMath';
import {
  expandRect,
  nodeMaxSize,
  nodeMinSize,
  placementRect,
  placementSize,
  unionRects,
} from './placement';
import { isAutoRoute, routeSides, routeSource } from './routes';

/**
 * Pure projection of (effective model + active diagram) onto React Flow
 * nodes/edges. The canvas re-derives this whenever the model changes; live
 * drag positions live in React Flow's local state until drag-stop commits
 * them into the overlay.
 */

export interface BuildGraphArgs {
  model: DesignModel;
  diagram: DesignDiagram;
  decorations?: Record<ElementId, ElementDecoration>;
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

export function buildNodes(args: BuildGraphArgs): ElementNode[] {
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
        decoration: args.decorations?.[element.id],
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
  return nodes;
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

export function buildEdges(args: BuildGraphArgs): FloatingEdgeModel[] {
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
  return edges;
}

/** Sizes used by ELK and the boundary: explicit placement size or kind default. */
export function nodeSizeOf(element: DesignElement, diagram: DesignDiagram): {
  width: number;
  height: number;
} {
  const placement = diagram.placements.find((p) => p.elementId === element.id);
  return placementSize(element.kind, placement);
}
