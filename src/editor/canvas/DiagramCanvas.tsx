import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodePositionChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { getNodeTokens } from '../theme/tokens';
import { buildEdges, buildNodes, type FloatingEdgeModel } from '../graph';
import { domainGroupRectMap } from '../../model/placement';
import {
  insertWaypointOnDrawn,
  routeFor,
  routeSides,
  routeSource,
  sidesFromHandles,
  type AttachSidesPatch,
} from '../../model/routes';
import { nodeTypes } from '../nodes/nodeTypes';
import { LogoMark, useResolvedLogo } from '../nodes/logoRegistry';
import { LogoPickerPopover } from './LogoPickerPopover';
import { FloatingEdge } from '../edges/FloatingEdge';
import type { ElementNode } from '../nodes/nodeData';
import type { DesignDiagram, DesignModel, ElementId, ElementKind, Point, Rect } from '../../model/types';
import {
  EMPTY_SELECTION,
  mirrorGraphSelection,
  selectConnection,
  selectElement,
  selectionEquals,
  type EditorActions,
  type ElementSeedPatch,
  type PlacementMove,
  type Selection,
} from '../useEditorState';
import { detectPlatform } from '../keymap';
import { PALETTE_DRAG_MIME, type DomainGroupSeed } from './ElementPalette';
import { CONTAINER_PALETTE, LAYER7_PALETTE } from './paletteItems';
import { CanvasMenuContext, type CanvasMenuApi } from './CanvasMenuContext';
import { ContextMenu } from './ContextMenu';
import { menuItemsFor, type MenuContext, type MenuItem as MenuItemModel, type MenuTarget } from './menuItems';
import { useStrings } from '../../i18n/LanguageContext';
import { allowedKindsOn, canChangeKind, changeableKinds } from '../../model/kindChange';
import type { StringKey } from '../../i18n/strings';
import { useContextMenu, type ContextMenuState, type MenuOpenEvent } from './useContextMenu';
import { dispatchMenuAction, type MenuActionHost } from './useMenuActions';
import { GRID_SIZE } from './gridSize';
import { isRectFullyVisible, toRect } from './viewportFit';
import { useDragRoutePreview } from './useDragRoutePreview';
import { NodeResizeContext, type NodeResizeApi } from './NodeResizeContext';
import { RouteEditingContext, type RouteEditingApi } from './RouteEditingContext';
import {
  alignNodes,
  distributeNodes,
  type AlignAxis,
  type DistributeAxis,
  type NodeBounds,
} from './alignDistribute';
import { getHelperLines, HelperLines, type HelperLineResult } from './HelperLines';
import { PlacementToolbar } from './PlacementToolbar';
import { serializeSelection, type ClipboardPayload } from '../../model/clipboard';

const edgeTypes = { floating: FloatingEdge };

/** Re-exported for the keymap and tests that always imported it from here. */
export { GRID_SIZE } from './gridSize';

const NO_HELPER_LINES: HelperLineResult = {};

/**
 * How long after a pointerdown a focus still counts as mouse-initiated. Long
 * enough to cover the browser's own click→focus sequencing, short enough that a
 * Tab a moment later is read as the keyboard it is.
 */
const POINTER_FOCUS_MS = 300;

/**
 * Whether this browser understands `:focus-visible` at all. jsdom does not, and
 * `matches()` THROWS on a selector it cannot parse rather than returning false —
 * so the answer is cached from one probe instead of a try/catch on every focus.
 */
let focusVisibleSupport: boolean | undefined;
function supportsFocusVisible(): boolean {
  if (focusVisibleSupport === undefined) {
    try {
      document.body.matches(':focus-visible');
      focusVisibleSupport = true;
    } catch {
      focusVisibleSupport = false;
    }
  }
  return focusVisibleSupport;
}

/** Stable empty default — a fresh Set per render would re-derive every edge. */
const NO_DRAG: ReadonlySet<ElementId> = new Set<ElementId>();

const sameIds = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
  a.size === b.size && [...a].every((id) => b.has(id));

function nodeBoundsOf(node: Node): NodeBounds {
  return {
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? node.width ?? 0,
    height: node.measured?.height ?? node.height ?? 0,
  };
}

/**
 * A menu item's `icon` key drawn as its mark. The Icon… item shows the element's
 * CURRENT choice, so an uploaded (`lib:`) mark has to resolve here exactly as it
 * does on the node: through the library the editor provides, not the built-ins
 * alone.
 */
function MenuLogoIcon({ iconKey }: { iconKey: string }): ReactNode {
  const resolved = useResolvedLogo(iconKey);
  return resolved ? <LogoMark resolved={resolved} size={14} decorative /> : null;
}

function renderLogoIcon(key: string): ReactNode {
  return <MenuLogoIcon key={key} iconKey={key} />;
}

/** The ids whose `selected` flags the canvas last pushed into React Flow. */
interface PushedSelection {
  elementIds: ReadonlySet<string>;
  connectionIds: ReadonlySet<string>;
}

function sameIdSet(reported: readonly string[], pushed: ReadonlySet<string>): boolean {
  return reported.length === pushed.size && reported.every((id) => pushed.has(id));
}

/**
 * True when React Flow's reported selection is exactly the one we last pushed
 * — i.e. it is telling us about our own nodes, not about a click or a marquee.
 */
export function isEchoOfPush(
  params: { nodes: readonly { id: string }[]; edges: readonly { id: string }[] },
  pushed: PushedSelection,
): boolean {
  return (
    sameIdSet(params.nodes.map((n) => n.id), pushed.elementIds) &&
    sameIdSet(params.edges.map((e) => e.id), pushed.connectionIds)
  );
}

/**
 * The reason "Change kind" is unavailable, for the disabled item's tooltip.
 *
 * The first REAL refusal, not the first refusal: every element refuses its own
 * kind ("it is already this kind"), which is true and useless. Taking the first
 * non-trivial one gives the answer people are actually asking for — the
 * container diagram, or the parent application.
 */
function firstKindRefusal(
  model: DesignModel,
  diagram: DesignDiagram,
  elementId: ElementId,
): StringKey | undefined {
  for (const kind of allowedKindsOn(diagram)) {
    const check = canChangeKind(model, diagram, elementId, kind);
    if (!check.ok && check.reason !== 'kindChange.sameKind') return check.reason;
  }
  return undefined;
}

const MENU_LABEL_KEYS: Record<MenuTarget['kind'], StringKey> = {
  node: 'menu.nodeLabel',
  edge: 'menu.edgeLabel',
  edgeHandle: 'menu.edgeLabel',
  pane: 'menu.paneLabel',
  selection: 'menu.selectionLabel',
  group: 'menu.groupLabel',
  tab: 'menu.tabLabel',
};

export interface DiagramCanvasProps {
  model: DesignModel;
  diagram: DesignDiagram;
  readOnly: boolean;
  selection: Selection;
  onSelectionChange(selection: Selection): void;
  actions: EditorActions;
  /** Grid-snap toggle state (editor-level, persists across diagram switches). */
  snapToGrid: boolean;
  onToggleSnapToGrid(): void;
  /** Visible dot-grid toggle (editor-level); independent of snapping (QF3). */
  showGrid: boolean;
  onToggleShowGrid(): void;
  /** The minimap (4B): off by default, remembered in the editor's preferences. */
  showMinimap?: boolean;
  /** Lifecycle-badge toggle (U5, editor-level): shows badges + the retired dim. */
  showLifecycle: boolean;
  /**
   * Live auto-routing is on for this diagram. The canvas uses it for ONE thing:
   * while it is on, an edge incident to a dragging node renders waypoint-free so
   * it follows the cursor. With it off the user's routes must not visibly
   * dissolve and reappear on every drag, so nobody who has not opted in ever
   * sees the preview.
   */
  autoRoute?: boolean;
  /** Maps a drag-stop/drop position to zone/domain-group assignment (layer7). */
  resolveDrop?(
    elementId: ElementId,
    position: { x: number; y: number },
  ): Pick<PlacementMove, 'zone' | 'domainGroup'>;
  onAddByDrop(kind: ElementKind, position: { x: number; y: number }, seed?: ElementSeedPatch): void;
  /**
   * A domain group was dropped on the board, at `position` (flow coords).
   * Layer 7 only — the container canvas has no groups, so it leaves this unset
   * and a group payload dropped there is ignored rather than half-created.
   */
  onAddDomainGroupByDrop?(position: Point, seed?: DomainGroupSeed): void;
  /**
   * A palette drag is hovering the board, in FLOW coordinates, or has left it
   * (`null`). Layer 7 uses it to outline the zone the drop would land in; the
   * container canvas has no zones and leaves it unset.
   */
  onPaletteDragOver?(position: Point | null): void;
  onElementDoubleClick?(elementId: ElementId): void;
  /** "Open documentation" on an element: the editor shows its page. */
  onOpenDocumentation?(elementId: ElementId): void;
  /**
   * What a right-click on the pane at `point` (FLOW coordinates) is about, when
   * it is not the pane itself. Layer 7 answers with the domain-group box under
   * the cursor: the boxes are drawn `pointer-events: none` (so the pane keeps
   * panning/selection and the nodes on top stay clickable), so their right-click
   * lands on the pane and is resolved by the same containment hit-test as their
   * selection. Undefined = the canvas menu.
   */
  resolvePaneMenuTarget?(point: Point): MenuTarget | undefined;
  /**
   * First refusal on a picked menu item, for actions the wrapper canvas owns
   * (Layer 7: the group popovers and the inline group rename). Return true when
   * handled; everything else goes to the shared dispatcher.
   */
  onMenuAction?(item: MenuItemModel, state: ContextMenuState): boolean;
  /** Whether the group menu may offer "Tidy this group" (Layer 7 wires the handler). */
  canTidyGroup?: boolean;
  /** Board-level layout actions for the canvas menu; absent hides the entries. */
  onTidy?(): void;
  /** "Route connections" — leaves hand-drawn and pinned routes alone. */
  onRouteConnections?(): void;
  /** "Re-route everything (ignore pins)" — the same pass with nothing preserved. */
  onRouteConnectionsAll?(): void;
  /**
   * "Reset to automatic route" on one line: the editor forgets the stored row
   * and runs (or lets live routing run) the pass that routes it again, as one
   * undo step. Absent in read-only mode.
   */
  onResetRoute?(connectionId: string): void;
  /**
   * "Attach at" on one line end (menu, and an Alt-reconnect onto a side handle):
   * the editor merges the side into the stored row and, like the reset, runs or
   * lets live routing run the pass that routes the line out of it, as one undo
   * step. Absent in read-only mode.
   */
  onSetRouteSides?(connectionId: string, sides: AttachSidesPatch): void;
  /** A layout pass is running: the layout entries stay visible but disabled. */
  layoutBusy?: boolean;
  /** Session clipboard shared with the keyboard shortcuts (Copy / Cut / Paste here). */
  clipboardRef?: RefObject<ClipboardPayload | null>;
  pasteCountRef?: RefObject<number>;
  /** "Rename" on an element: the editor focuses the inspector's Name field. */
  onRequestRename?(elementId: ElementId): void;
  /** "Delete from model…": the editor opens its delete dialog. */
  onRequestDeleteElement?(elementId: ElementId): void;
  /**
   * "Delete connection" / "Delete" on a multi-selection: the editor confirms
   * first. Absent, both delete straight away as they always did.
   */
  onRequestDeleteConnection?(connectionId: string): void;
  onRequestDeleteSelection?(selection: Selection): void;
  /**
   * Keyboard-driven menu requests from the keymap — Shift+F10 / Menu key opens
   * the menu for the current selection, F2 renames it. Handled once per nonce.
   */
  menuRequest?: { kind: 'open' | 'rename'; nonce: number };
  /**
   * What a left-click on the pane selects, with the click point in FLOW
   * coordinates. Default (and the fallback when this returns nothing) is "clear
   * the selection". Layer 7 uses it to select the domain-group box under the
   * cursor — the boxes are `pointer-events: none`, so their click lands on the
   * pane and is resolved by the same containment hit-test as their menu.
   */
  resolvePaneClick?(point: Point): Selection | undefined;
  /** Zone bands / domain groups, rendered into the flow viewport. */
  children?: ReactNode;
}

/**
 * What a palette drag is asking the canvas to create. A discriminated union
 * because the palette now drags two different THINGS, not two flavours of one:
 * an element (goes through `addElement`, carries a logo) and a domain group
 * (goes through `upsertDomainGroup`, carries a colour, has no kind of its own).
 * Keeping them apart in the type is what stops a group seed reaching `addElement`.
 */
export type DragPayload =
  | { target: 'element'; kind: ElementKind; seed?: ElementSeedPatch }
  | { target: 'domainGroup'; seed?: DomainGroupSeed }
  | { target: 'none' };

/**
 * Parse a palette drag payload: JSON `{ kind, iconKey?, name? }` for an element,
 * `{ kind: 'domainGroup', name?, color? }` for a group. Anything else is
 * `'none'` rather than a guess — the palette is the only thing that produces
 * these, and it lives four files away.
 *
 * The `try` is not a shim: `getData` can hand back anything, and a malformed
 * payload must end a drag, never throw out of an event handler.
 */
export function parseDragPayload(raw: string): DragPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { target: 'none' };
  }
  if (!parsed || typeof parsed !== 'object') return { target: 'none' };
  const p = parsed as { kind?: unknown; iconKey?: string; name?: string; color?: string };
  if (typeof p.kind !== 'string') return { target: 'none' };
  if (p.kind === 'domainGroup') {
    return { target: 'domainGroup', seed: { name: p.name, color: p.color } };
  }
  return {
    target: 'element',
    kind: p.kind as ElementKind,
    seed: { iconKey: p.iconKey, name: p.name },
  };
}

/**
 * Shared React Flow wiring for both diagram kinds. Nodes/edges derive from
 * the effective model; live drag positions stay in local React Flow state and
 * are committed into the overlay on drag-stop (single batch per gesture).
 */
export function DiagramCanvas(props: DiagramCanvasProps) {
  const theme = useTheme();
  const tokens = getNodeTokens(theme);
  const { screenToFlowPosition, flowToScreenPosition, getNodes, getNodesBounds, fitView, getZoom } =
    useReactFlow();

  // Which nodes are mid-drag, for the waypoint-free preview. React Flow reports
  // drag state on every position change, so this is read from the changes rather
  // than tracked separately in the drag-start/stop handlers — a multi-select drag
  // and an alt-drag duplicate both come through here without special-casing.
  const [draggingElementIds, setDraggingElementIds] = useState<ReadonlySet<ElementId>>(NO_DRAG);

  // Routes for the drag in flight, computed from the live rects and drawn instead
  // of the stored ones — so the drop changes nothing on screen. Gated on the same
  // `autoRoute` as the suppression above: nobody who has not opted in sees either.
  const preview = useDragRoutePreview({
    model: props.model,
    diagram: props.diagram,
    enabled: (props.autoRoute ?? false) && !props.readOnly,
  });

  const selectedElementIds = useMemo(
    () => new Set(props.selection.elementIds),
    [props.selection],
  );
  const selectedConnectionIds = useMemo(
    () => new Set(props.selection.connectionIds),
    [props.selection],
  );

  const derivedNodes = useMemo(
    () =>
      buildNodes({
        model: props.model,
        diagram: props.diagram,
        readOnly: props.readOnly,
        selectedElementIds,
        selectedConnectionIds,
        edgeColor: tokens.edge.stroke,
        showLifecycle: props.showLifecycle,
      }),
    [props.model, props.diagram, props.readOnly, selectedElementIds, selectedConnectionIds, tokens, props.showLifecycle],
  );
  const derivedEdges = useMemo(
    () =>
      buildEdges({
        model: props.model,
        diagram: props.diagram,
        readOnly: props.readOnly,
        selectedElementIds,
        selectedConnectionIds,
        edgeColor: tokens.edge.stroke,
        // Only while the mode is on — see `autoRoute` on the props.
        draggingElementIds: props.autoRoute ? draggingElementIds : undefined,
        previewRoutes: props.autoRoute ? preview.previewRoutes : undefined,
      }),
    [
      props.model,
      props.diagram,
      props.readOnly,
      selectedElementIds,
      selectedConnectionIds,
      tokens,
      props.autoRoute,
      draggingElementIds,
      preview.previewRoutes,
    ],
  );

  const [nodes, setNodes] = useState<ElementNode[]>(derivedNodes);
  const [edges, setEdges] = useState<FloatingEdgeModel[]>(derivedEdges);
  // The selection embedded in the nodes/edges we last handed React Flow. RF
  // echoes whatever it was given back through `onSelectionChange`, and a push
  // can be one render stale: a host model update landing while a click is in
  // flight renders the new model with the OLD selection first. Adopting that
  // echo as if the user had clicked flips the selection back, the next push
  // flips it again, and React gives up after fifty rounds with a blank page.
  // `handleSelectionChange` compares against this, not only the live selection.
  const pushedSelectionRef = useRef<PushedSelection>({ elementIds: new Set(), connectionIds: new Set() });
  useEffect(() => {
    // `selectedElementIds` / `selectedConnectionIds` are what `derivedNodes` was
    // built from in this same render, so they describe the push; a new
    // selection always means new derived nodes, so `derivedNodes` is the dep.
    pushedSelectionRef.current = { elementIds: selectedElementIds, connectionIds: selectedConnectionIds };
    setNodes(derivedNodes);
  }, [derivedNodes, selectedElementIds, selectedConnectionIds]);
  useEffect(() => setEdges(derivedEdges), [derivedEdges]);

  // Mirror the latest nodes for handlers that must read them synchronously
  // (helper-line math) without becoming a re-subscribing callback dependency.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const [helperLines, setHelperLines] = useState<HelperLineResult>(NO_HELPER_LINES);

  // Read through a ref so the change handler stays identity-stable: React Flow
  // re-subscribes when it changes, and this one runs on every mouse move.
  const previewRef = useRef(preview);
  previewRef.current = preview;

  const onNodesChange = useCallback((changes: NodeChange<ElementNode>[]) => {
    // Snap-to-object guides: only when a single node is dragging (multi-node
    // guide math has no clean definition — same gating as the U2 resizer).
    const positionChanges = changes.filter(
      (c): c is NodePositionChange => c.type === 'position',
    );
    const dragging = positionChanges.find((c) => c.dragging && c.position);
    let next = NO_HELPER_LINES;
    if (positionChanges.length === 1 && dragging?.position) {
      const lines = getHelperLines(dragging, nodesRef.current);
      if (lines.snapX !== undefined) dragging.position.x = lines.snapX;
      if (lines.snapY !== undefined) dragging.position.y = lines.snapY;
      next = { horizontal: lines.horizontal, vertical: lines.vertical };
    }
    setHelperLines((prev) =>
      prev.horizontal === next.horizontal && prev.vertical === next.vertical ? prev : next,
    );
    if (positionChanges.length > 0) {
      const nowDragging = new Set(
        positionChanges.filter((c) => c.dragging).map((c) => c.id),
      );
      // Fed AFTER the helper-line snap above has adjusted `position`, so the
      // preview routes against the position the drop will actually commit — the
      // whole point being that the drop then changes nothing.
      const settled = positionChanges
        .filter((c) => c.position)
        .map((c) => ({ elementId: c.id, x: c.position!.x, y: c.position!.y }));
      const moving = positionChanges
        .filter((c) => c.dragging && c.position)
        .map((c) => ({ elementId: c.id, x: c.position!.x, y: c.position!.y }));
      if (moving.length > 0) previewRef.current.onDragPositions(moving);
      // The changes that report `dragging: false` carry the FINAL positions, which
      // is exactly what the handover needs one last pass against.
      else if (nowDragging.size === 0) previewRef.current.endDrag(settled);
      // Identity is compared before setting: React Flow fires position changes
      // continuously during a drag, and a fresh Set each time would re-derive
      // every edge on every mouse move.
      setDraggingElementIds((prev) =>
        nowDragging.size === 0 && prev.size === 0
          ? prev
          : sameIds(prev, nowDragging)
            ? prev
            : nowDragging.size === 0
              ? NO_DRAG
              : nowDragging,
      );
    }
    setNodes((ns) => applyNodeChanges(changes, ns));
  }, []);
  const onEdgesChange = useCallback(
    (changes: EdgeChange<FloatingEdgeModel>[]) => setEdges((es) => applyEdgeChanges(changes, es)),
    [],
  );

  const { actions, resolveDrop, onSelectionChange } = props;

  // Read the latest selection without making it a callback dependency. React
  // Flow re-invokes its onSelectionChange subscription whenever the callback
  // identity changes, so a selection-dependent callback would ping-pong with
  // RF's internal selection on every change and loop the render cycle.
  const selectionRef = useRef(props.selection);
  selectionRef.current = props.selection;

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      // Mirror React Flow's full selection (marquee / shift-click) into our set;
      // no more collapsing to the first node/edge. Bail when nothing changed —
      // RF re-fires this with the same (often empty) selection, and emitting a
      // fresh object each time would loop the render cycle.
      const next = mirrorGraphSelection(
        selectionRef.current,
        params.nodes.map((n) => n.id),
        params.edges.map((e) => e.id),
      );
      if (selectionEquals(next, selectionRef.current)) return;
      // An echo of our own (stale) push is not the user changing the selection.
      if (isEchoOfPush(params, pushedSelectionRef.current)) return;
      onSelectionChange(next);
    },
    [onSelectionChange],
  );

  // "Start connection to…": the element the next node click connects from. A
  // mode, not a gesture — it survives until a node is clicked, the pane is
  // clicked, Escape is pressed or the diagram changes.
  const [connectFrom, setConnectFrom] = useState<ElementId | null>(null);

  const { resolvePaneClick } = props;
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      setConnectFrom(null);
      const next =
        resolvePaneClick?.(screenToFlowPosition({ x: event.clientX, y: event.clientY })) ??
        EMPTY_SELECTION;
      // React Flow clears its own selection immediately after this handler, which
      // re-fires `onSelectionChange` before our new selection has re-rendered.
      // Move the ref forward now so that fire compares against what we JUST
      // selected instead of the stale value, and stays a no-op.
      selectionRef.current = next;
      onSelectionChange(next);
    },
    [resolvePaneClick, screenToFlowPosition, onSelectionChange],
  );

  const toPlacementMove = useCallback(
    (node: Node): PlacementMove => {
      const width = node.measured?.width ?? node.width ?? 0;
      const height = node.measured?.height ?? node.height ?? 0;
      const center = { x: node.position.x + width / 2, y: node.position.y + height / 2 };
      return {
        elementId: node.id,
        x: node.position.x,
        y: node.position.y,
        ...(resolveDrop ? resolveDrop(node.id, center) : {}),
      };
    },
    [resolveDrop],
  );

  // Alt-drag duplicate: on drag start with Alt held, snapshot the dragged
  // selection; on drag stop, paste the clones at the drop offset and leave the
  // originals in place (they snap back when the paste re-derives the model).
  const altDragRef = useRef<{ payload: ClipboardPayload; startX: number; startY: number } | null>(
    null,
  );

  const handleNodeDragStart = useCallback(
    (event: MouseEvent | TouchEvent, node: Node, draggedNodes: Node[]) => {
      altDragRef.current = null;
      if (props.readOnly || !event.altKey) return;
      const payload = serializeSelection(
        props.model,
        props.diagram,
        draggedNodes.map((n) => n.id),
      );
      if (!payload) return;
      altDragRef.current = { payload, startX: node.position.x, startY: node.position.y };
    },
    [props.readOnly, props.model, props.diagram],
  );

  const handleDragStop = useCallback(
    (_event: unknown, node: Node, draggedNodes: Node[]) => {
      const altDrag = altDragRef.current;
      // Belt and braces with the position-change path above: React Flow reports a
      // drag ending through both, and a preview left running because one of them
      // did not fire would keep routing a board nobody is dragging.
      //
      // An alt-drag gets `false`: it pastes clones and leaves the ORIGINAL where it
      // started, so the geometry just previewed is for a position nothing is going
      // to commit, and holding it on screen would be a lie rather than a handover.
      previewRef.current.endDrag(
        draggedNodes.map((n) => ({ elementId: n.id, x: n.position.x, y: n.position.y })),
        altDrag === null,
      );
      if (altDrag) {
        altDragRef.current = null;
        actions.pasteClipboard(altDrag.payload, {
          x: node.position.x - altDrag.startX,
          y: node.position.y - altDrag.startY,
        });
        return;
      }
      actions.movePlacements(draggedNodes.map(toPlacementMove));
    },
    [actions, toPlacementMove],
  );

  // Alt-connect (Phase 2d): a link dragged from or to a specific side handle WITH
  // Alt held fixes that end to the side. React Flow hands `onConnect` no event, so
  // the modifier is read off the gesture instead: the connect-start pointer event
  // seeds it, and keydown/keyup keep it current while the drag runs — what counts
  // is whether Alt is down when the line is dropped. Without Alt nothing changes.
  const altConnectRef = useRef(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Alt') altConnectRef.current = event.type === 'keydown';
    };
    const onBlur = () => {
      altConnectRef.current = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
  const handleConnectStart = useCallback((event: MouseEvent | TouchEvent) => {
    altConnectRef.current = 'altKey' in event && event.altKey;
  }, []);
  const handleReconnectStart = useCallback((event: React.MouseEvent) => {
    altConnectRef.current = event.altKey;
  }, []);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      // The handle ids name the sides (`right-s`, `top-t`); with Alt held they
      // become the new line's attach sides, in the same commit as the line.
      const sides = altConnectRef.current ? sidesFromHandles(connection) : undefined;
      actions.connect(connection.source, connection.target, sides);
    },
    [actions],
  );

  // Drag an edge endpoint onto another node to repoint it. Reject self-loops;
  // the move persists through the same save path as any other connection edit,
  // and any manual waypoints ride along unchanged. With Alt held, the end that
  // was dropped on a side handle is fixed to that side (the other end keeps a
  // `null` handle and is left alone).
  const handleReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target) return;
      if (newConnection.source === newConnection.target) return;
      const sides = altConnectRef.current ? sidesFromHandles(newConnection) : undefined;
      actions.reconnect(
        oldEdge.id,
        { sourceId: newConnection.source, targetId: newConnection.target },
        sides,
      );
    },
    [actions],
  );

  const { onAddByDrop, onAddDomainGroupByDrop, onPaletteDragOver } = props;
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      const raw = event.dataTransfer.getData(PALETTE_DRAG_MIME);
      if (!raw) return;
      // The payload is JSON `{ kind, ... }`. Stay robust — a legacy bare-kind
      // string (or any parse failure) falls back to an unseeded add so nothing
      // regresses.
      const payload = parseDragPayload(raw);
      if (payload.target === 'none') return;
      // A group dropped on a canvas that has no groups: clear the hover state
      // and do nothing, rather than dropping an element in its place.
      if (payload.target === 'domainGroup' && !onAddDomainGroupByDrop) {
        onPaletteDragOver?.(null);
        return;
      }
      event.preventDefault();
      onPaletteDragOver?.(null);
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      if (payload.target === 'domainGroup') onAddDomainGroupByDrop?.(position, payload.seed);
      else onAddByDrop(payload.kind, position, payload.seed);
    },
    [onAddByDrop, onAddDomainGroupByDrop, onPaletteDragOver, screenToFlowPosition],
  );

  const { onElementDoubleClick } = props;
  const handleNodeDoubleClick = useCallback(
    (_event: unknown, node: Node) => onElementDoubleClick?.(node.id),
    [onElementDoubleClick],
  );

  // --- Manual edge routing (waypoints) ------------------------------------
  const { diagram, readOnly } = props;

  /**
   * Double-click an edge: add a waypoint at the cursor, on the nearest segment of
   * the line as DRAWN — each end where `routeEndAnchor` attaches it, not the node
   * centre. Measured against the centres, the first leg ran through the middle of
   * the node and a click beside the real first leg could land on another segment.
   */
  const handleEdgeDoubleClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (readOnly) return;
      event.preventDefault();
      event.stopPropagation();
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const route = routeFor(diagram, edge.id);
      const waypoints = route?.waypoints ?? [];
      const rectOf = (nodeId: string): Rect | undefined => {
        const node = getNodes().find((n) => n.id === nodeId);
        if (!node) return undefined;
        return {
          x: node.position.x,
          y: node.position.y,
          width: node.measured?.width ?? node.width ?? 0,
          height: node.measured?.height ?? node.height ?? 0,
        };
      };
      const source = rectOf(edge.source);
      const target = rectOf(edge.target);
      if (!source || !target) return;
      actions.setEdgeRoute(
        edge.id,
        insertWaypointOnDrawn(waypoints, source, target, point, routeSides(route)),
      );
    },
    [readOnly, diagram, actions, screenToFlowPosition, getNodes],
  );

  const singleSelection = selectedElementIds.size + selectedConnectionIds.size === 1;
  const nodeResize = useMemo<NodeResizeApi>(
    () => ({
      commitResize: (elementId, rect) => actions.resizePlacement(elementId, rect),
      singleSelection,
    }),
    [actions, singleSelection],
  );

  // Align / distribute: computed here (the canvas layer) from the RF nodes'
  // measured sizes — `DiagramPlacement.width/height` are only set for resized
  // nodes, so the overlay layer cannot do this geometry. The finished moves go
  // straight into `movePlacements` (one batched commit) with zone/group
  // re-resolved from the new centre exactly as a drag does.
  const selectedBounds = useCallback(
    (): NodeBounds[] =>
      getNodes()
        .filter((n) => selectedElementIds.has(n.id))
        .map(nodeBoundsOf),
    [getNodes, selectedElementIds],
  );

  const applyPositionUpdates = useCallback(
    (updates: { elementId: string; x: number; y: number }[], bounds: NodeBounds[]) => {
      if (updates.length === 0) return;
      const sizeById = new Map(bounds.map((b) => [b.id, b]));
      const moves: PlacementMove[] = updates.map((u) => {
        const size = sizeById.get(u.elementId);
        const center = {
          x: u.x + (size?.width ?? 0) / 2,
          y: u.y + (size?.height ?? 0) / 2,
        };
        return {
          elementId: u.elementId,
          x: u.x,
          y: u.y,
          ...(resolveDrop ? resolveDrop(u.elementId, center) : {}),
        };
      });
      actions.movePlacements(moves);
    },
    [actions, resolveDrop],
  );

  const handleAlign = useCallback(
    (axis: AlignAxis) => {
      const bounds = selectedBounds();
      applyPositionUpdates(alignNodes(bounds, axis), bounds);
    },
    [selectedBounds, applyPositionUpdates],
  );

  const handleDistribute = useCallback(
    (axis: DistributeAxis) => {
      const bounds = selectedBounds();
      applyPositionUpdates(distributeNodes(bounds, axis), bounds);
    },
    [selectedBounds, applyPositionUpdates],
  );

  // --- Context menus (see menuItems.ts for WHAT, useMenuActions.ts for HOW) ---
  const menu = useContextMenu();
  const { t } = useStrings();
  const platform = useMemo(() => detectPlatform(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  // When the pointer last went down inside the canvas — how the focus handler
  // tells a click apart from a Tab (see `handleContainerFocus`).
  const lastPointerDownRef = useRef(0);
  const [labelEditRequest, setLabelEditRequest] = useState<
    { connectionId: string; nonce: number } | undefined
  >(undefined);
  const labelEditNonce = useRef(0);
  // "Icon…" → the grid, anchored at the click. Held here rather than inside the
  // menu because the menu closes the moment the item is picked.
  const [iconPicker, setIconPicker] = useState<{ elementId: ElementId; screen: Point } | null>(
    null,
  );

  const {
    model,
    showGrid,
    snapToGrid,
    clipboardRef,
    pasteCountRef,
    onTidy,
    onRouteConnections,
    onRouteConnectionsAll,
    onResetRoute,
    onSetRouteSides,
    layoutBusy,
    canTidyGroup,
    onRequestRename,
    onOpenDocumentation,
    onRequestDeleteElement,
    onRequestDeleteConnection,
    onRequestDeleteSelection,
    onToggleShowGrid,
    onToggleSnapToGrid,
    resolvePaneMenuTarget,
    onMenuAction,
  } = props;

  // Leaving connect mode whenever it can no longer complete: another diagram, or
  // a canvas that just went read-only.
  useEffect(() => setConnectFrom(null), [diagram.id, readOnly]);
  useEffect(() => {
    if (connectFrom === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConnectFrom(null);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [connectFrom]);

  // The click that completes (or cancels) a connection is taken on the way UP,
  // before React's root listener dispatches it to React Flow: RF's own node click
  // would select the clicked node under the connection we just made, and the two
  // selections would then chase each other. Stopping the native event here means
  // RF never sees it, and the new connection stays selected — the same end state
  // as drawing the line by hand.
  useEffect(() => {
    if (connectFrom === null) return;
    const container = containerRef.current;
    if (!container) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const targetId = target?.closest<HTMLElement>('.react-flow__node')?.dataset.id;
      if (targetId) {
        event.stopPropagation();
        if (targetId !== connectFrom) actions.connect(connectFrom, targetId);
        setConnectFrom(null);
        return;
      }
      if (target?.classList.contains('react-flow__pane')) {
        event.stopPropagation();
        setConnectFrom(null);
      }
    };
    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [connectFrom, actions]);

  /** The facts the pure builder needs about `target`, read off the effective model. */
  const buildMenuContext = useCallback(
    (target: MenuTarget): MenuContext => {
      const ctx: MenuContext = {
        readOnly,
        platform,
        t,
        diagramKind: diagram.kind,
        domainGroups: (diagram.layoutConfig?.domainGroups ?? []).map((g) => g.name),
        clipboardHasContent: Boolean(clipboardRef?.current),
        allowedKinds: diagram.kind === 'layer7' ? LAYER7_PALETTE : CONTAINER_PALETTE,
        showGrid,
        snapToGrid,
        canTidy: Boolean(onTidy),
        canRouteConnections: Boolean(onRouteConnections),
        canRouteConnectionsAll: Boolean(onRouteConnectionsAll),
        canTidyGroup: Boolean(canTidyGroup),
        layoutBusy,
      };
      if (target.kind === 'node') {
        const element = model.elements.find((e) => e.id === target.elementId);
        const placement = diagram.placements.find((p) => p.elementId === target.elementId);
        if (element) {
          ctx.element = {
            kind: element.kind,
            lifecycle: element.lifecycle,
            iconKey: element.iconKey,
            zone: placement?.zone,
            domainGroup: placement?.domainGroup,
            hasContainerDiagram: model.diagrams.some(
              (d) => d.kind === 'container' && d.applicationElementId === element.id,
            ),
            isBoundaryApplication:
              diagram.kind === 'container' && diagram.applicationElementId === element.id,
            // "Change kind ▸": what it could become here, and — when it could
            // become nothing — why. Both come from the same pure rules the
            // action itself obeys, so the menu can never offer a change the
            // action would then refuse.
            changeableKinds: changeableKinds(model, diagram, element.id),
            kindChangeRefusal: firstKindRefusal(model, diagram, element.id),
          };
        }
      } else if (target.kind === 'edge' || target.kind === 'edgeHandle') {
        const connection = model.connections.find((c) => c.id === target.connectionId);
        const route = routeFor(diagram, target.connectionId);
        if (connection) {
          ctx.connection = {
            routing: connection.routing,
            isBidirectional: connection.isBidirectional,
            waypointCount: route?.waypoints.length ?? 0,
            hasLabelPosition: route?.labelPosition !== undefined,
            route: route ? routeSource(route) : 'none',
            ...routeSides(route),
          };
        }
      } else if (target.kind === 'selection') {
        const placementsById = new Map(diagram.placements.map((p) => [p.elementId, p]));
        ctx.selection = {
          elementCount: target.elementIds.length,
          landscapeCount:
            diagram.kind === 'layer7'
              ? target.elementIds.filter((id) => {
                  const p = placementsById.get(id);
                  return p !== undefined && (p.zone ?? 'landscape') === 'landscape';
                }).length
              : 0,
        };
      }
      return ctx;
    },
    [
      readOnly,
      platform,
      t,
      diagram,
      model,
      clipboardRef,
      showGrid,
      snapToGrid,
      onTidy,
      onRouteConnections,
      onRouteConnectionsAll,
      canTidyGroup,
      layoutBusy,
    ],
  );

  const menuItems = useMemo(
    () => (menu.state ? menuItemsFor(menu.state.target, buildMenuContext(menu.state.target)) : []),
    [menu.state, buildMenuContext],
  );

  /**
   * Open for `target` only when it has something to offer; otherwise leave the
   * event alone so the browser's own menu still appears (read-only lines, say).
   */
  const tryOpenMenu = useCallback(
    (target: MenuTarget, at: { event: MenuOpenEvent } | { screen: Point }): boolean => {
      if (menuItemsFor(target, buildMenuContext(target)).length === 0) return false;
      if ('event' in at) menu.open(target, at.event);
      else menu.openAt(target, at.screen);
      return true;
    },
    [menu, buildMenuContext],
  );
  // The route-editing API and the viewport-layer context must stay identity-stable
  // (every edge re-renders on a context change), so they reach the latest opener
  // through a ref instead of depending on it.
  const tryOpenMenuRef = useRef(tryOpenMenu);
  tryOpenMenuRef.current = tryOpenMenu;

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // A node inside a multi-selection gets the selection's menu, not its own.
      if (selectedElementIds.size >= 2 && selectedElementIds.has(node.id)) {
        tryOpenMenu({ kind: 'selection', elementIds: [...selectedElementIds] }, { event });
        return;
      }
      if (!(selectedElementIds.size === 1 && selectedElementIds.has(node.id))) {
        onSelectionChange(selectElement(node.id));
      }
      tryOpenMenu({ kind: 'node', elementId: node.id }, { event });
    },
    [selectedElementIds, onSelectionChange, tryOpenMenu],
  );

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (!(selectedConnectionIds.size === 1 && selectedConnectionIds.has(edge.id))) {
        onSelectionChange(selectConnection(edge.id));
      }
      tryOpenMenu({ kind: 'edge', connectionId: edge.id }, { event });
    },
    [selectedConnectionIds, onSelectionChange, tryOpenMenu],
  );

  const handleSelectionContextMenu = useCallback(
    (event: React.MouseEvent, selected: Node[]) => {
      tryOpenMenu({ kind: 'selection', elementIds: selected.map((n) => n.id) }, { event });
    },
    [tryOpenMenu],
  );

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      // ReactFlow hangs this on the pane CONTAINER, so a right-click on a node,
      // an edge or the selection box bubbles up here too — and those have their
      // own handlers. Only act on clicks whose target IS the pane (which includes
      // anything drawn `pointer-events: none` over it, e.g. the domain-group boxes).
      if (!(event.target as HTMLElement | null)?.classList.contains('react-flow__pane')) return;
      setConnectFrom(null);
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const target = resolvePaneMenuTarget?.(point) ?? { kind: 'pane' as const };
      // A group with nothing to offer (read-only) still gets the canvas menu.
      if (!tryOpenMenu(target, { event }) && target.kind !== 'pane') {
        tryOpenMenu({ kind: 'pane' }, { event });
      }
    },
    [resolvePaneMenuTarget, screenToFlowPosition, tryOpenMenu],
  );

  const canvasMenu = useMemo<CanvasMenuApi>(
    () => ({ open: (target, event) => void tryOpenMenuRef.current(target, { event }) }),
    [],
  );

  const routeEditing = useMemo<RouteEditingApi>(
    () => ({
      readOnly,
      setWaypoints: (connectionId, waypoints) => actions.setEdgeRoute(connectionId, waypoints),
      setLabelPosition: (connectionId, position) =>
        actions.setEdgeLabelPosition(connectionId, position),
      setLabelText: (connectionId, label) => actions.updateConnection(connectionId, { label }),
      selectConnection: (connectionId) => onSelectionChange(selectConnection(connectionId)),
      openWaypointMenu: (connectionId, index, position) =>
        void tryOpenMenuRef.current({ kind: 'edgeHandle', connectionId, index }, { screen: position }),
      openEdgeMenu: (connectionId, position) =>
        void tryOpenMenuRef.current({ kind: 'edge', connectionId }, { screen: position }),
      toFlowPosition: screenToFlowPosition,
      pinRoute: (connectionId) => actions.setRouteSource(connectionId, 'manual'),
      unpinRoute: (connectionId) => actions.setRouteSource(connectionId, 'auto'),
      resetRoute: (connectionId) => onResetRoute?.(connectionId),
      setSides: (connectionId, sides) => onSetRouteSides?.(connectionId, sides),
      labelEditRequest,
    }),
    [readOnly, actions, screenToFlowPosition, onSelectionChange, onResetRoute, onSetRouteSides, labelEditRequest],
  );

  const requestLabelEdit = useCallback((connectionId: string) => {
    labelEditNonce.current += 1;
    setLabelEditRequest({ connectionId, nonce: labelEditNonce.current });
  }, []);

  const menuHost = useMemo<MenuActionHost>(
    () => ({
      model,
      diagram,
      actions,
      selection: props.selection,
      setSelection: onSelectionChange,
      translate: t,
      nodeBounds: () => getNodes().map(nodeBoundsOf),
      fitView: () => void fitView({ padding: 0.1, duration: 300 }),
      clipboardRef,
      pasteCountRef,
      addElementAt: (kind, position) => onAddByDrop(kind, position),
      addDomainGroupAt: onAddDomainGroupByDrop ? (position) => onAddDomainGroupByDrop(position) : undefined,
      resolveDrop,
      openApplication: onElementDoubleClick,
      openDocumentation: onOpenDocumentation,
      requestRename: onRequestRename,
      requestDelete: onRequestDeleteElement,
      requestDeleteConnection: onRequestDeleteConnection,
      requestDeleteSelection: onRequestDeleteSelection,
      tidy: onTidy,
      routeConnections: onRouteConnections,
      routeConnectionsAll: onRouteConnectionsAll,
      resetRoute: onResetRoute,
      setRouteSides: onSetRouteSides,
      toggleGrid: onToggleShowGrid,
      toggleSnap: onToggleSnapToGrid,
      align: handleAlign,
      distribute: handleDistribute,
      startConnection: (elementId) => {
        onSelectionChange(selectElement(elementId));
        setConnectFrom(elementId);
      },
      editLabel: requestLabelEdit,
      pickIcon: (elementId, screen) => setIconPicker({ elementId, screen }),
      intercept: onMenuAction,
    }),
    [
      model,
      diagram,
      actions,
      props.selection,
      onSelectionChange,
      t,
      getNodes,
      fitView,
      clipboardRef,
      pasteCountRef,
      onAddByDrop,
      onAddDomainGroupByDrop,
      resolveDrop,
      onElementDoubleClick,
      onOpenDocumentation,
      onRequestRename,
      onRequestDeleteElement,
      onRequestDeleteConnection,
      onRequestDeleteSelection,
      onTidy,
      onRouteConnections,
      onRouteConnectionsAll,
      onResetRoute,
      onSetRouteSides,
      onToggleShowGrid,
      onToggleSnapToGrid,
      handleAlign,
      handleDistribute,
      requestLabelEdit,
      onMenuAction,
    ],
  );

  const handleMenuSelect = useCallback(
    (item: MenuItemModel) => {
      if (menu.state) dispatchMenuAction(item, menu.state, menuHost);
    },
    [menu.state, menuHost],
  );

  // --- keyboard: Shift+F10 / Menu key and F2 -------------------------------------

  /** What the keyboard is "pointing at": the sole selected thing, the selection, or the canvas. */
  const selectionMenuTarget = useCallback((): MenuTarget => {
    const sel = props.selection;
    if (sel.elementIds.length >= 2) return { kind: 'selection', elementIds: sel.elementIds };
    if (sel.elementIds.length === 1 && sel.connectionIds.length === 0) {
      return { kind: 'node', elementId: sel.elementIds[0] };
    }
    if (sel.connectionIds.length === 1 && sel.elementIds.length === 0) {
      return { kind: 'edge', connectionId: sel.connectionIds[0] };
    }
    if (sel.domainGroups.length === 1) return { kind: 'group', name: sel.domainGroups[0] };
    return { kind: 'pane' };
  }, [props.selection]);

  /** Where a keyboard-opened menu appears: the target's centre on screen, else the canvas's. */
  const anchorFor = useCallback(
    (target: MenuTarget): Point => {
      const centreOf = (rect: Rect) =>
        flowToScreenPosition({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
      if (target.kind === 'node' || target.kind === 'selection') {
        const ids = new Set(target.kind === 'node' ? [target.elementId] : target.elementIds);
        const nodes = getNodes().filter((n) => ids.has(n.id));
        if (nodes.length > 0) return centreOf(getNodesBounds(nodes));
      } else if (target.kind === 'edge' || target.kind === 'edgeHandle') {
        const connection = model.connections.find((c) => c.id === target.connectionId);
        const nodes = getNodes().filter(
          (n) => n.id === connection?.sourceId || n.id === connection?.targetId,
        );
        if (nodes.length > 0) return centreOf(getNodesBounds(nodes));
      } else if (target.kind === 'group') {
        const rect = domainGroupRectMap(diagram.layoutConfig).get(target.name);
        if (rect) return centreOf(rect);
      }
      const box = containerRef.current?.getBoundingClientRect();
      return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: 0, y: 0 };
    },
    [flowToScreenPosition, getNodes, getNodesBounds, model.connections, diagram.layoutConfig],
  );

  const { menuRequest } = props;
  // Whatever nonce is current on mount has been handled: a canvas mounted after a
  // keypress must not replay it.
  const handledMenuNonce = useRef(menuRequest?.nonce);
  useEffect(() => {
    if (!menuRequest || handledMenuNonce.current === menuRequest.nonce) return;
    handledMenuNonce.current = menuRequest.nonce;
    const target = selectionMenuTarget();
    const screen = anchorFor(target);
    if (menuRequest.kind === 'open') {
      tryOpenMenu(target, { screen });
      return;
    }
    // F2: the same "rename" the menu offers for this target, dispatched directly.
    const action =
      target.kind === 'node'
        ? ('rename' as const)
        : target.kind === 'edge'
          ? ('edit-label' as const)
          : target.kind === 'group'
            ? ('rename-group' as const)
            : undefined;
    if (!action) return;
    dispatchMenuAction(
      { id: 'rename', label: t('menu.rename'), action },
      { target, screen, flowPosition: screenToFlowPosition(screen) },
      menuHost,
    );
  }, [menuRequest, selectionMenuTarget, anchorFor, tryOpenMenu, menuHost, screenToFlowPosition, t]);

  /**
   * Enter / Space on a TAB-FOCUSED node selects it (4B).
   *
   * React Flow's own key handling is off (`disableKeyboardA11y`) because the
   * keymap owns the arrow keys — RF's arrow move is visual-only and never
   * committed, so leaving both on moved a node twice and persisted half of it.
   * What that also took away was Enter-to-select, and Tab-focus without it is a
   * ring you cannot do anything with. This puts back the one key, on the one
   * element, and leaves the arrows where they belong.
   */
  const handleContainerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const node = (event.target as HTMLElement | null)?.closest?.('.react-flow__node');
      const id = node?.getAttribute('data-id');
      if (!id) return;
      event.preventDefault();
      props.onSelectionChange(
        event.shiftKey
          ? {
              ...props.selection,
              elementIds: props.selection.elementIds.includes(id)
                ? props.selection.elementIds.filter((existing) => existing !== id)
                : [...props.selection.elementIds, id],
            }
          : { elementIds: [id], connectionIds: [], domainGroups: [] },
      );
    },
    [props],
  );

  /**
   * Tab to a node parked off-screen, and the board follows it (4B review).
   *
   * React Flow's own auto-pan-on-focus is part of the keyboard-a11y bundle we
   * had to switch off — `disableKeyboardA11y` also hands RF the arrow keys, and
   * those belong to the keymap, which actually commits the move. So focus put a
   * ring on a node the viewport had never heard of and the screen sat still.
   *
   * Two deliberate narrownesses. It pans only when the node is not ALREADY fully
   * in view (`isRectFullyVisible`), so tabbing across a board that fits does not
   * twitch the viewport at every stop. And it pins `minZoom === maxZoom` to the
   * zoom in force, because this is a pan: `fitView` would otherwise happily zoom
   * to 100% on one node and lose the reader the context they were reading.
   */
  const handleContainerFocus = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const nodeEl = (event.target as HTMLElement | null)?.closest?.('.react-flow__node') as
        | HTMLElement
        | null;
      const id = nodeEl?.getAttribute('data-id');
      if (!nodeEl || !id) return;
      // Mouse-initiated focus needs no help: the node you just clicked is
      // already where you were looking, and panning under the pointer is
      // exactly the jump nobody asked for. `:focus-visible` is the browser's
      // own answer to "was this the keyboard?"; jsdom does not know the
      // selector, hence the pointer-recency fallback underneath it.
      if (Date.now() - lastPointerDownRef.current < POINTER_FOCUS_MS) return;
      if (supportsFocusVisible() && !nodeEl.matches(':focus-visible')) return;
      const container = containerRef.current;
      if (!container) return;
      const box = container.getBoundingClientRect();
      // A zero-sized container means no layout to compare against (jsdom, or a
      // canvas mid-mount) — there is nothing to decide, so decide nothing.
      if (box.width === 0 || box.height === 0) return;
      if (isRectFullyVisible(toRect(nodeEl.getBoundingClientRect()), toRect(box))) return;
      const zoom = getZoom();
      void fitView({ nodes: [{ id }], duration: 150, maxZoom: zoom, minZoom: zoom });
    },
    [fitView, getZoom],
  );

  return (
    <Box
      ref={containerRef}
      onKeyDown={handleContainerKeyDown}
      onFocus={handleContainerFocus}
      onPointerDownCapture={() => {
        lastPointerDownRef.current = Date.now();
      }}
      sx={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        // The ring itself is drawn by `NodeShell` from a theme token; the
        // browser's own outline would sit outside the card's rounded corner and
        // read as a second, squarer box.
        '& .react-flow__node:focus-visible': { outline: 'none' },
        ...(connectFrom !== null
          ? { cursor: 'crosshair', '& .react-flow__pane, & .react-flow__node': { cursor: 'crosshair' } }
          : {}),
      }}
    >
      <CanvasMenuContext.Provider value={canvasMenu}>
      <RouteEditingContext.Provider value={routeEditing}>
        <NodeResizeContext.Provider value={nodeResize}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={theme.palette.mode}
          fitView
          minZoom={0.15}
          maxZoom={2.5}
          deleteKeyCode={null}
          // The keymap owns arrow keys (nudge → movePlacements, persisted). RF's
          // built-in arrow-key node move is visual-only (never committed), so we
          // suppress it here to avoid a double-move (U4c, OQ2).
          disableKeyboardA11y
          zoomOnDoubleClick={false}
          nodesDraggable={!props.readOnly}
          nodesConnectable={!props.readOnly}
          elementsSelectable
          elevateNodesOnSelect={false}
          multiSelectionKeyCode="Shift"
          snapToGrid={!props.readOnly && props.snapToGrid}
          snapGrid={[GRID_SIZE, GRID_SIZE]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={handleSelectionChange}
          onPaneClick={handlePaneClick}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleDragStop}
          onConnectStart={handleConnectStart}
          onConnect={handleConnect}
          onReconnectStart={props.readOnly ? undefined : handleReconnectStart}
          onReconnect={props.readOnly ? undefined : handleReconnect}
          onNodeDoubleClick={handleNodeDoubleClick}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeContextMenu={handleEdgeContextMenu}
          onPaneContextMenu={handlePaneContextMenu}
          onSelectionContextMenu={handleSelectionContextMenu}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(PALETTE_DRAG_MIME)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (props.readOnly) return;
            onPaletteDragOver?.(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
          }}
          onDragLeave={() => onPaletteDragOver?.(null)}
          onDrop={props.readOnly ? undefined : handleDrop}
        >
          {props.showGrid && (
            <Background variant={BackgroundVariant.Dots} gap={GRID_SIZE} size={1.4} color={tokens.canvas.dot} />
          )}
          {/* Off by default and toggled from the toolbar: on a landscape that
              already fills the window a minimap is 200×150 of board you cannot
              use, and on a big one it is the fastest way back to where you were.
              Colours come from the node tokens, so it follows the theme. */}
          {props.showMinimap && (
            <MiniMap
              pannable
              zoomable
              ariaLabel={t('canvas.minimap')}
              maskColor={tokens.minimap.mask}
              bgColor={tokens.minimap.bg}
              nodeColor={tokens.minimap.node}
              nodeStrokeColor={tokens.minimap.nodeBorder}
              style={{ border: `1px solid ${tokens.card.border}`, borderRadius: 4 }}
            />
          )}
          <Controls showInteractive={false} />
          {!props.readOnly && (
            <PlacementToolbar
              snapToGrid={props.snapToGrid}
              onToggleSnapToGrid={props.onToggleSnapToGrid}
              showGrid={props.showGrid}
              onToggleShowGrid={props.onToggleShowGrid}
              canAlign={selectedElementIds.size >= 2}
              canDistribute={selectedElementIds.size >= 3}
              onAlign={handleAlign}
              onDistribute={handleDistribute}
            />
          )}
          <HelperLines
            horizontal={helperLines.horizontal}
            vertical={helperLines.vertical}
            color={theme.palette.primary.main}
          />
          {props.children}
        </ReactFlow>
        </NodeResizeContext.Provider>
      </RouteEditingContext.Provider>
      </CanvasMenuContext.Provider>
      {connectFrom !== null && (
        <Paper
          role="status"
          data-testid="lv-connect-hint"
          elevation={3}
          sx={{
            position: 'absolute',
            top: 52,
            left: '50%',
            transform: 'translateX(-50%)',
            px: 1.5,
            py: 0.5,
            borderRadius: 2,
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
            {t('canvas.connectHint')}
          </Typography>
        </Paper>
      )}
      <ContextMenu
        open={menu.state !== null}
        position={menu.state?.screen ?? null}
        items={menuItems}
        onSelect={handleMenuSelect}
        onClose={menu.close}
        renderIcon={renderLogoIcon}
        ariaLabel={menu.state ? t(MENU_LABEL_KEYS[menu.state.target.kind]) : undefined}
      />
      {iconPicker && (
        <LogoPickerPopover
          anchorPosition={iconPicker.screen}
          value={model.elements.find((e) => e.id === iconPicker.elementId)?.iconKey}
          onChange={(iconKey) => actions.updateElement(iconPicker.elementId, { iconKey })}
          onClose={() => setIconPicker(null)}
        />
      )}
    </Box>
  );
}
