import { memo, useEffect, useRef, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
  useInternalNode,
  useViewport,
  type Edge,
  type EdgeProps,
  type InternalNode,
} from '@xyflow/react';
import { useTheme } from '@mui/material/styles';
import { getNodeTokens } from '../theme/tokens';
import { useStrings } from '../../i18n/LanguageContext';
import type { AttachSide, EdgeLineStyle, EdgeRouteSource, EdgeRouting, Point, Rect } from '../../model/types';
import {
  dragSegment,
  dragStraight,
  drawnPolyline,
  legAxis,
  moveWaypoint,
  roundedPolylinePath,
  routeRadius,
  routeSides,
  type LegAxis,
} from '../../model/routes';
import { useRouteEditing } from '../canvas/RouteEditingContext';
import { usePointerDrag } from '../canvas/usePointerDrag';
import { closestSides, type EdgeAnchors } from '../../model/floatingEdgeMath';

/**
 * A side becomes a React Flow `Position` here and nowhere else.
 *
 * The geometry that picks the side is pure and says `AttachSide` — the same
 * four strings this enum holds, which is why the mapping is an identity and why
 * it is worth having anyway: it is the one line that stops React Flow's enum
 * being imported by thirteen files in `model/` and `layout/` that draw nothing.
 */
const POSITION_OF_SIDE: Record<AttachSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};
const positionOfSide = (side: AttachSide): Position => POSITION_OF_SIDE[side];
import { edgeDashArray, edgePathKind, resolveEdgeStroke } from './edgeStyle';

export interface FloatingEdgeData extends Record<string, unknown> {
  label?: string;
  protocol?: string;
  isBidirectional?: boolean;
  /** Custom stroke colour (U4b); absent = theme edge token. Tints the markers too. */
  color?: string;
  /** Line dash style (U4b); absent = solid. */
  lineStyle?: EdgeLineStyle;
  /** Path shape (U4b); absent = smooth step. Manual waypoints still win. */
  routing?: EdgeRouting;
  /** Manual routing points for this connection on the active diagram. */
  waypoints?: Point[];
  /** Custom label anchor on the active diagram; absent = path midpoint. */
  labelPosition?: Point;
  /**
   * Who produced {@link waypoints} — see `EdgeRoute.source`. Absent = `manual`,
   * which is what an edge with no stored route resolves to as well.
   *
   * It drives ONE thing here: the corner radius. Router output draws at the
   * larger {@link AUTO_ROUTE_RADIUS}, a hand-drawn route at the tight one. It no
   * longer decides whether handles show — selection does (Phase 2a), so a routed
   * line can be grabbed and reshaped like any other, and the first grab claims it.
   */
  routeSource?: EdgeRouteSource;
  /**
   * Pre-computed slotted attach points (U-edge-anchors) so edges sharing a node
   * side fan out instead of stacking. Render-time only, re-derived per commit.
   * Absent = fall back to live-rect `closestSides` (waypoint-less edges only).
   */
  anchors?: EdgeAnchors;
  /**
   * The side each end is told to attach to (`EdgeRoute.sourceSide`). Absent =
   * automatic. Both branches honour it: the waypoint-less one through the slot
   * fan / `closestSides`, the routed one through `routeEndLeg`, which adds a stub
   * when the adjacent leg cannot meet the side square. A fixed side also gets a
   * small marker while the line is selected.
   */
  sourceSide?: AttachSide;
  targetSide?: AttachSide;
}

export type FloatingEdgeType = Edge<FloatingEdgeData, 'floating'>;

/**
 * A pointer has to travel this many CLIENT pixels before a press on a handle or
 * a chip counts as a drag. Below it the pointer-up is a click: the chip selects
 * the edge, a handle does nothing — and, crucially, nothing is committed, so a
 * stray click on a routed line's handle does not claim the route.
 */
const DRAG_THRESHOLD_PX = 3;

/**
 * A segment handle this close to the label chip's anchor would sit on top of the
 * chip; it moves a quarter of the way along its leg instead.
 */
const CHIP_CLEARANCE_PX = 24;

/**
 * Handle sizes in SCREEN pixels. The handles live in the viewport layer, so they
 * would zoom with the board — a segment pill measured 4×11 px at 55 % zoom — and
 * are counter-scaled by `1 / zoom` instead. Each visible handle sits inside a
 * transparent hit box of at least {@link HANDLE_HIT_PX}, so a small handle is
 * still easy to grab.
 */
const BEND_HANDLE_PX = 10;
const SEGMENT_HANDLE_PX = { width: 18, height: 8 };
const HANDLE_HIT_PX = 16;
/** The bar drawn on a fixed side while the line is selected: along the side, across the leg. */
const SIDE_MARKER_PX = { along: 14, across: 3 };

function nodeRect(node: InternalNode): Rect {
  const { x, y } = node.internals.positionAbsolute;
  return {
    x,
    y,
    width: node.measured?.width ?? node.width ?? 0,
    height: node.measured?.height ?? node.height ?? 0,
  };
}

/** Point halfway along the polyline (by arc length) — label anchor. */
function polylineMidpoint(points: Point[]): Point {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  let remaining = total / 2;
  for (let i = 0; i < points.length - 1; i += 1) {
    const length = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    if (length >= remaining && length > 0) {
      const t = remaining / length;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    remaining -= length;
  }
  return points[Math.floor(points.length / 2)] ?? points[0];
}

/** Where a leg's handle sits: its midpoint, or a quarter along when the chip is in the way. */
function segmentHandleAt(a: Point, b: Point, chip: Point | undefined): Point {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (!chip || Math.hypot(mid.x - chip.x, mid.y - chip.y) >= CHIP_CLEARANCE_PX) return mid;
  const quarter = { x: a.x + (b.x - a.x) / 4, y: a.y + (b.y - a.y) / 4 };
  return Math.hypot(b.x - a.x, b.y - a.y) < 2 * CHIP_CLEARANCE_PX ? mid : quarter;
}

/** What a segment drag is about, captured at pointer-down. */
interface SegmentGesture {
  /** Leg index into `polyline`; ignored for a straight line. */
  index: number;
  /** The drawn polyline — `[start, ...waypoints, end]`, or `[start, end]` for a straight line. */
  polyline: Point[];
  /** Set for a line with no bends: the axis of its exit leg, for the jog. */
  straightAxis?: 'horizontal' | 'vertical';
  sourceRect: Rect;
  targetRect: Rect;
  /** Flow position of the pointer-down; deltas are measured from here in flow space. */
  origin: Point;
  moved: boolean;
  /** The latest preview, and what the drop commits. */
  result: Point[] | null;
}

/**
 * Floating edge with closest-side routing and optional manual waypoints:
 * without waypoints it is the smooth-step shortest-pair edge; with them it is
 * a rounded polyline through the ordered points, endpoints still floating
 * (each end attaches to the side nearest its adjacent waypoint).
 *
 * While the edge is SELECTED (and the board is editable) it shows its handles
 * whatever the route's provenance: a square bend handle on every waypoint and a
 * pill segment handle on every leg. Dragging a bend moves it; dragging a segment
 * shifts the leg perpendicular to itself (`dragSegment`), and on a line with no
 * bends yet makes the first two (`dragStraight`). Either edit claims the route as
 * `manual` through `setWaypoints`. An unselected line shows nothing, so router
 * output stays clean until somebody picks it up.
 *
 * The label is ONE stacked chip — interface description (multiline, newlines
 * honoured) with the technology line always below it. It is draggable (anchor
 * persists per diagram on the edge route) and double-click opens an inline
 * multiline editor (Enter = newline, blur commits, Esc cancels).
 */
export const FloatingEdge = memo(function FloatingEdge({
  id,
  source,
  target,
  selected,
  data,
  markerEnd,
  markerStart,
}: EdgeProps<FloatingEdgeType>) {
  const theme = useTheme();
  const { t } = useStrings();
  const tokens = getNodeTokens(theme);
  const routeEditing = useRouteEditing();
  // Handles and markers keep a constant SCREEN size — see `BEND_HANDLE_PX`.
  const { zoom } = useViewport();
  const handleScale = zoom > 0 ? 1 / zoom : 1;
  const [dragWaypoints, setDragWaypoints] = useState<Point[] | null>(null);
  const [dragLabel, setDragLabel] = useState<Point | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const editCancelledRef = useRef(false);
  // All three drags are declared here, above the "no nodes yet" bail-out, because
  // a hook cannot live behind an early return. What each gesture is ABOUT arrives
  // through a pending ref, since the geometry is only known further down.
  const labelGesture = useRef<{ moved: boolean; current: Point | null } | null>(null);
  const pendingWaypoint = useRef<{ index: number; waypoints: Point[] } | null>(null);
  const waypointGesture = useRef<{ index: number; waypoints: Point[]; moved: boolean } | null>(
    null,
  );
  const pendingSegment = useRef<Omit<SegmentGesture, 'origin' | 'moved' | 'result'> | null>(null);
  const segmentGesture = useRef<SegmentGesture | null>(null);

  const labelDrag = usePointerDrag({
    onStart: () => {
      labelGesture.current = { moved: false, current: null };
    },
    // A chip is a click target as well as a drag handle, so the first 3 client
    // pixels do not count as a drag — below that the pointer-up selects the
    // edge instead of moving its label.
    onMove: (delta, event) => {
      const live = labelGesture.current;
      if (!live) return;
      if (!live.moved && Math.hypot(delta.dx, delta.dy) < DRAG_THRESHOLD_PX) return;
      live.moved = true;
      live.current = routeEditing.toFlowPosition({ x: event.clientX, y: event.clientY });
      setDragLabel(live.current);
    },
    onEnd: () => {
      const live = labelGesture.current;
      labelGesture.current = null;
      setDragLabel(null);
      if (live?.moved && live.current) routeEditing.setLabelPosition(id, live.current);
      else routeEditing.selectConnection(id); // plain click = select the edge
    },
    onCancel: () => {
      labelGesture.current = null;
      setDragLabel(null);
    },
  });

  const waypointDrag = usePointerDrag({
    onStart: () => {
      const grabbed = pendingWaypoint.current;
      pendingWaypoint.current = null;
      waypointGesture.current = grabbed ? { ...grabbed, moved: false } : null;
    },
    onMove: (delta, event) => {
      const live = waypointGesture.current;
      if (!live) return;
      if (!live.moved && Math.hypot(delta.dx, delta.dy) < DRAG_THRESHOLD_PX) return;
      live.moved = true;
      live.waypoints = moveWaypoint(
        live.waypoints,
        live.index,
        routeEditing.toFlowPosition({ x: event.clientX, y: event.clientY }),
      );
      setDragWaypoints(live.waypoints);
    },
    onEnd: () => {
      const live = waypointGesture.current;
      waypointGesture.current = null;
      setDragWaypoints(null);
      // A press that never moved is a click, and a click must not commit — on a
      // routed line that would silently claim the route for the user.
      if (live?.moved) routeEditing.setWaypoints(id, live.waypoints);
    },
    onCancel: () => {
      waypointGesture.current = null;
      setDragWaypoints(null);
    },
  });

  const segmentDrag = usePointerDrag({
    onStart: (event) => {
      const grabbed = pendingSegment.current;
      pendingSegment.current = null;
      segmentGesture.current = grabbed
        ? {
            ...grabbed,
            origin: routeEditing.toFlowPosition({ x: event.clientX, y: event.clientY }),
            moved: false,
            result: null,
          }
        : null;
    },
    onMove: (delta, event) => {
      const live = segmentGesture.current;
      if (!live) return;
      if (!live.moved && Math.hypot(delta.dx, delta.dy) < DRAG_THRESHOLD_PX) return;
      live.moved = true;
      // Client → flow through the SAME mapping both ends, so the delta carries the
      // viewport zoom without this component knowing what the zoom is.
      const here = routeEditing.toFlowPosition({ x: event.clientX, y: event.clientY });
      const flowDelta = { x: here.x - live.origin.x, y: here.y - live.origin.y };
      const result = live.straightAxis
        ? dragStraight(
            live.polyline[0],
            live.polyline[1],
            live.straightAxis,
            flowDelta,
            live.sourceRect,
            live.targetRect,
          )
        : dragSegment(live.polyline, live.index, flowDelta, live.sourceRect, live.targetRect);
      live.result = result ?? null;
      setDragWaypoints(result ?? null);
    },
    onEnd: () => {
      const live = segmentGesture.current;
      segmentGesture.current = null;
      setDragWaypoints(null);
      // One commit for the whole gesture = one undo step.
      if (live?.moved && live.result) routeEditing.setWaypoints(id, live.result);
    },
    onCancel: () => {
      segmentGesture.current = null;
      setDragWaypoints(null);
    },
  });

  // "Edit label" from the line menu (or F2 on a selected line). Above the bail-out
  // below because a hook cannot live behind an early return; handled once per
  // nonce so an unrelated re-render never reopens the editor.
  const editRequest = routeEditing.labelEditRequest;
  const handledEditNonce = useRef<number | undefined>(undefined);
  const labelForEdit = data?.label;
  useEffect(() => {
    if (!editRequest || editRequest.connectionId !== id) return;
    if (handledEditNonce.current === editRequest.nonce) return;
    handledEditNonce.current = editRequest.nonce;
    if (routeEditing.readOnly) return;
    editCancelledRef.current = false;
    setDraft(labelForEdit ?? '');
    setEditing(true);
  }, [editRequest, id, routeEditing.readOnly, labelForEdit]);

  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const waypoints = dragWaypoints ?? data?.waypoints ?? [];
  const sourceRect = nodeRect(sourceNode);
  const targetRect = nodeRect(targetNode);
  // A drag in progress is a hand edit that has not committed yet, so it must
  // already look manual — corners tight — rather than snapping from one
  // treatment to the other on pointer-up.
  const route = { source: dragWaypoints ? ('manual' as const) : data?.routeSource };
  const kind = edgePathKind(data?.routing);
  // The sides each end is told to attach to — constraints, honoured by both branches.
  const fixedSides = routeSides(data);

  let path: string;
  let labelX: number;
  let labelY: number;
  // The line as drawn, for the handles: `[start, ...waypoints, end]` for a routed
  // line, `[start, end]` for one without bends (its exit axis alongside, so a
  // drag of its one segment knows which way the jog goes).
  let drawn: Point[];
  let straightAxis: 'horizontal' | 'vertical' | undefined;
  if (waypoints.length === 0) {
    // No manual waypoints: the path shape follows the stored routing token.
    // Slotted anchors (U-edge-anchors) fan edges out across a node side; when
    // absent, fall back to the live-rect closest-side midpoints.
    const slotted = data?.anchors ?? closestSides(sourceRect, targetRect, fixedSides);
    // Facing side CENTRES — used both to detect an axis-aligned pair and to draw
    // the straight line through both centres, bypassing the slot fan. A tidied
    // aligned edge (e.g. two apps on the same ELK row, or an app and its external
    // system) must render dead straight through the centres; the slot fan would
    // tilt it into a smooth-step S-curve entering off the side centre. This is how
    // such an edge draws straight WITHOUT an injected waypoint. An explicit curved
    // routing still arcs. A fixed side narrows the choice here too, so an aligned
    // pair told to leave from the top does not snap back to its facing sides.
    const centres = closestSides(sourceRect, targetRect, fixedSides);
    const axisAligned =
      Math.abs(centres.sourceX - centres.targetX) < 1 ||
      Math.abs(centres.sourceY - centres.targetY) < 1;
    const straight = kind === 'straight' || (kind !== 'curved' && axisAligned);
    const sides = straight && axisAligned ? centres : slotted;
    const common = {
      sourceX: sides.sourceX,
      sourceY: sides.sourceY,
      sourcePosition: positionOfSide(sides.sourcePosition),
      targetX: sides.targetX,
      targetY: sides.targetY,
      targetPosition: positionOfSide(sides.targetPosition),
    };
    if (straight) {
      [path, labelX, labelY] = getStraightPath({
        sourceX: common.sourceX,
        sourceY: common.sourceY,
        targetX: common.targetX,
        targetY: common.targetY,
      });
    } else if (kind === 'curved') {
      [path, labelX, labelY] = getBezierPath(common);
    } else {
      // 'smoothstep' (rounded, today's default) or 'orthogonal' (sharp corners).
      [path, labelX, labelY] = getSmoothStepPath({
        ...common,
        borderRadius: kind === 'orthogonal' ? 0 : 8,
      });
    }
    drawn = [
      { x: common.sourceX, y: common.sourceY },
      { x: common.targetX, y: common.targetY },
    ];
    straightAxis =
      common.sourcePosition === Position.Left || common.sourcePosition === Position.Right
        ? 'horizontal'
        : 'vertical';
  } else {
    // Each end attaches where its adjacent waypoint's leg actually arrives — see
    // `routeEndAnchor`. A side MIDPOINT here is what drew the diagonal tails. An
    // end with a fixed side attaches on that side, with a stub bend when the leg
    // cannot meet it square (`routeEndLeg`); the stubs are drawn — and grabbable
    // — like any other leg, so a drag that touches them writes them into the route.
    drawn = drawnPolyline(waypoints, sourceRect, targetRect, fixedSides);
    // "Orthogonal" means sharp corners on a routed line too — the token used to be
    // read only by the waypoint-less branch, so bends always drew rounded.
    path = roundedPolylinePath(drawn, kind === 'orthogonal' ? 0 : routeRadius(route));
    const mid = polylineMidpoint(drawn);
    labelX = mid.x;
    labelY = mid.y;
  }

  // Resolve the custom colour, then let selection override it (thicker, primary)
  // so a coloured edge stays legible while selected.
  const baseStroke = resolveEdgeStroke(data?.color, tokens.edge.stroke);
  const stroke = selected ? tokens.edge.strokeSelected : baseStroke;
  const dashArray = edgeDashArray(data?.lineStyle);
  const hasLabel = Boolean(data?.label || data?.protocol);
  // Handles belong to the SELECTED line, whoever drew it (Phase 2a). Unselected
  // lines — router output above all — show nothing, which is what keeps a
  // routed board clean; the moment somebody picks a line up it becomes theirs
  // to reshape, and the first edit claims it.
  const showHandles = Boolean(selected) && !routeEditing.readOnly;
  // Chip anchor: live drag position > stored per-diagram anchor > path midpoint.
  const anchor = dragLabel ?? data?.labelPosition ?? { x: labelX, y: labelY };
  // An empty selected edge still shows a ghost chip so the text is addable in place.
  const showChip = hasLabel || editing || (selected && !routeEditing.readOnly);
  // The chip's own segment handle collision check needs to know whether a chip is
  // actually drawn there.
  const chipAt = showChip ? anchor : undefined;

  const startEditing = () => {
    if (routeEditing.readOnly) return;
    editCancelledRef.current = false;
    setDraft(data?.label ?? '');
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    if (editCancelledRef.current) return;
    const value = draft.replace(/\s+$/u, '');
    if (value === (data?.label ?? '')) return;
    routeEditing.setLabelText(id, value === '' ? undefined : value);
  };

  const beginLabelDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || routeEditing.readOnly || editing) return;
    labelDrag.onPointerDown(event);
  };

  const beginWaypointDrag = (index: number) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || routeEditing.readOnly) return;
    pendingWaypoint.current = { index, waypoints };
    waypointDrag.onPointerDown(event);
  };

  const beginSegmentDrag = (index: number) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || routeEditing.readOnly) return;
    pendingSegment.current = {
      index,
      polyline: drawn,
      straightAxis: waypoints.length === 0 ? straightAxis : undefined,
      sourceRect,
      targetRect,
    };
    segmentDrag.onPointerDown(event);
  };

  /**
   * A bar on each FIXED side, at the point the line leaves it: the one visible
   * difference between a side the user chose and one the board picked. Shown with
   * the handles, so read-only and unselected lines show nothing.
   */
  const sideMarkers = showHandles
    ? (['source', 'target'] as const).flatMap((end) => {
        const side = end === 'source' ? fixedSides.sourceSide : fixedSides.targetSide;
        if (!side) return [];
        const at = end === 'source' ? drawn[0] : drawn[drawn.length - 1];
        return [{ end, at, vertical: side === 'left' || side === 'right' }];
      })
    : [];

  /** One leg's handle: where it sits, how it is turned, which way it drags. */
  const segmentHandles = showHandles
    ? drawn.slice(0, -1).map((a, i) => {
        const b = drawn[i + 1];
        let at: Point;
        let axis: LegAxis;
        if (waypoints.length === 0) {
          // A line with no bends draws a step (or a straight line) whose grabbable
          // middle is the path's own midpoint, not the chord between the anchors.
          // Its axis is the step's middle leg: the exit axis itself when the two
          // anchors are aligned, perpendicular to it when they are offset.
          at = { x: labelX, y: labelY };
          const aligned =
            straightAxis === 'horizontal' ? Math.abs(a.y - b.y) < 1 : Math.abs(a.x - b.x) < 1;
          const exit: LegAxis = straightAxis ?? 'horizontal';
          axis = aligned ? exit : exit === 'horizontal' ? 'vertical' : 'horizontal';
        } else {
          at = segmentHandleAt(a, b, chipAt);
          axis = legAxis(a, b);
        }
        // The pill lies ALONG the leg it moves.
        const angle =
          axis === 'horizontal'
            ? 0
            : axis === 'vertical'
              ? 90
              : (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        const cursor = axis === 'horizontal' ? 'ns-resize' : axis === 'vertical' ? 'ew-resize' : 'move';
        return { index: i, at, angle, cursor };
      })
    : [];

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{ stroke, strokeWidth: selected ? 2 : 1.5, strokeDasharray: dashArray }}
      />
      {showChip && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            data-testid={`edge-label-${id}`}
            onPointerDown={beginLabelDrag}
            onDoubleClick={(event) => {
              event.stopPropagation();
              startEditing();
            }}
            onContextMenu={(event) => {
              if (routeEditing.readOnly) return;
              // The line menu is worth opening on any label — edit label, line
              // shape, direction — not only when there is a position to reset.
              event.preventDefault();
              event.stopPropagation();
              routeEditing.openEdgeMenu(id, { x: event.clientX, y: event.clientY });
            }}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${anchor.x}px, ${anchor.y}px)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              background: tokens.edge.labelBg,
              border: `1px solid ${selected ? stroke : tokens.edge.labelBorder}`,
              borderRadius: 6,
              padding: '2px 7px',
              maxWidth: 240,
              textAlign: 'center',
              fontFamily: theme.typography.fontFamily,
              pointerEvents: routeEditing.readOnly ? 'none' : 'all',
              cursor: editing ? 'text' : 'grab',
              zIndex: 9,
            }}
          >
            {editing ? (
              <textarea
                autoFocus
                value={draft}
                rows={Math.min(Math.max(draft.split('\n').length, 1) + 1, 6)}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitEdit}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    editCancelledRef.current = true;
                    setEditing(false);
                  }
                }}
                onPointerDown={(event) => event.stopPropagation()}
                placeholder={t('edge.labelPlaceholder')}
                style={{
                  width: 150,
                  resize: 'none',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: tokens.edge.labelFg,
                  fontSize: 10,
                  lineHeight: 1.35,
                  fontFamily: theme.typography.fontFamily,
                  textAlign: 'center',
                }}
              />
            ) : (
              <>
                {data?.label ? (
                  <span
                    style={{
                      color: tokens.edge.labelFg,
                      fontSize: 10,
                      lineHeight: 1.35,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {data.label}
                  </span>
                ) : (
                  <span
                    style={{
                      color: tokens.edge.labelFg,
                      opacity: 0.55,
                      fontSize: 9,
                      fontStyle: 'italic',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    double-click to label…
                  </span>
                )}
                {data?.protocol && (
                  <span
                    style={{
                      color: tokens.edge.labelFg,
                      opacity: 0.8,
                      fontSize: 9,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {data.protocol}
                  </span>
                )}
              </>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
      {showHandles && (
        <EdgeLabelRenderer>
          {sideMarkers.map((marker) => (
            <div
              key={`side-${marker.end}`}
              aria-hidden
              data-testid={`side-marker-${id}-${marker.end}`}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${marker.at.x}px, ${marker.at.y}px) scale(${handleScale})`,
                width: marker.vertical ? SIDE_MARKER_PX.across : SIDE_MARKER_PX.along,
                height: marker.vertical ? SIDE_MARKER_PX.along : SIDE_MARKER_PX.across,
                borderRadius: 1.5,
                background: tokens.edge.strokeSelected,
                pointerEvents: 'none',
                zIndex: 9,
              }}
            />
          ))}
          {segmentHandles.map((handle) => (
            <div
              key={`segment-${handle.index}`}
              className="nodrag nopan"
              data-testid={`segment-${id}-${handle.index}`}
              onPointerDown={beginSegmentDrag(handle.index)}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                routeEditing.openEdgeMenu(id, { x: event.clientX, y: event.clientY });
              }}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${handle.at.x}px, ${handle.at.y}px) scale(${handleScale}) rotate(${handle.angle}deg)`,
                width: Math.max(HANDLE_HIT_PX, SEGMENT_HANDLE_PX.width + 6),
                height: HANDLE_HIT_PX,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: handle.cursor,
                pointerEvents: 'all',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  width: SEGMENT_HANDLE_PX.width,
                  height: SEGMENT_HANDLE_PX.height,
                  borderRadius: 4,
                  background: tokens.edge.strokeSelected,
                  border: `1px solid ${tokens.handle.border}`,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
          {waypoints.map((waypoint, index) => (
            <div
              key={`bend-${index}`}
              className="nodrag nopan"
              data-testid={`waypoint-${id}-${index}`}
              onPointerDown={beginWaypointDrag(index)}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                routeEditing.openWaypointMenu(id, index, {
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${waypoint.x}px, ${waypoint.y}px) scale(${handleScale})`,
                width: HANDLE_HIT_PX,
                height: HANDLE_HIT_PX,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                pointerEvents: 'all',
                zIndex: 11,
              }}
            >
              <div
                style={{
                  width: BEND_HANDLE_PX,
                  height: BEND_HANDLE_PX,
                  borderRadius: 2,
                  background: tokens.edge.strokeSelected,
                  border: `2px solid ${tokens.handle.border}`,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
        </EdgeLabelRenderer>
      )}
    </>
  );
});
