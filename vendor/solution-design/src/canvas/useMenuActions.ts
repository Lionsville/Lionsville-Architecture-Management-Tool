import type { RefObject } from 'react';
import type { DesignDiagram, DesignModel, ElementId, ElementKind, Layer7Zone, Point, Rect } from '../types';
import {
  selectDomainGroup,
  selectAllContent,
  type EditorActions,
  type PlacementMove,
  type Selection,
} from '../editor/useEditorState';
import { pasteOffsetFor, serializeSelection, type ClipboardPayload } from '../model/clipboard';
import {
  domainGroupRectMap,
  freeSlotIn,
  freeZonePosition,
  placementRect,
  placementSize,
  rectContains,
} from '../model/placement';
import {
  insertWaypointOnDrawn,
  isAutoRoute,
  removeWaypoint,
  routeFor,
  routeSides,
  type AttachSidesPatch,
} from '../model/routes';
import { defaultGroupName, groupRectAround, uniqueGroupName } from './domainGroupPlacement';
import type { Translate } from '../i18n/strings';
import type { AlignAxis, DistributeAxis, NodeBounds } from './alignDistribute';
import type { MenuItem, MenuTarget } from './menuItems';
import type { ContextMenuState } from './useContextMenu';
import { GRID_SIZE } from './gridSize';

/**
 * Everything a menu action may reach for. The canvas fills this in from its own
 * props and React Flow; `dispatchMenuAction` never touches anything else, which
 * is what keeps this file a thin table from `MenuActionId` to one call each.
 */
export interface MenuActionHost {
  model: DesignModel;
  diagram: DesignDiagram;
  actions: EditorActions;
  selection: Selection;
  setSelection(selection: Selection): void;
  /** Live, measured node rects — the only place real sizes exist (see alignDistribute). */
  nodeBounds(): NodeBounds[];
  fitView(): void;
  /** Session clipboard shared with the keyboard shortcuts. */
  clipboardRef?: RefObject<ClipboardPayload | null>;
  pasteCountRef?: RefObject<number>;
  /** The palette-drop seed path: kind + flow position, zone resolved by the canvas. */
  addElementAt(kind: ElementKind, position: Point): void;
  addDomainGroupAt?(position: Point): void;
  /** What a drop at `center` would assign (layer7 zone + group); mirrors the drag rules. */
  resolveDrop?(elementId: ElementId, center: Point): Pick<PlacementMove, 'zone' | 'domainGroup'>;
  /** The double-click path: open or create the application's container diagram. */
  openApplication?(elementId: ElementId): void;
  /** "Open documentation": the editor shows the element's page. */
  openDocumentation?(elementId: ElementId): void;
  requestRename?(elementId: ElementId): void;
  /** Opens the delete dialog (remove from diagram / delete from model). */
  requestDelete?(elementId: ElementId): void;
  /**
   * Opens the confirmation for a delete that would otherwise happen in silence.
   * Both are OPTIONAL and both fall back to the action itself, so a canvas that
   * wires no dialog behaves exactly as it did before the confirmation existed.
   */
  requestDeleteConnection?(connectionId: string): void;
  requestDeleteSelection?(selection: Selection): void;
  tidy?(): void;
  /** "Route connections": honours pinned and hand-drawn routes. */
  routeConnections?(): void;
  /** "Re-route everything (ignore pins)": the same pass with nothing preserved. */
  routeConnectionsAll?(): void;
  /** "Reset to automatic route" — deletes the stored row and re-routes (the editor owns the pass). */
  resetRoute?(connectionId: string): void;
  /** "Attach at ▸ Source / Target ▸ side" — fixes an end's side and re-routes (the editor owns the pass). */
  setRouteSides?(connectionId: string, sides: AttachSidesPatch): void;
  toggleGrid(): void;
  toggleSnap(): void;
  align(axis: AlignAxis): void;
  distribute(axis: DistributeAxis): void;
  /** Enter connect mode from this element; the next node click completes it. */
  startConnection(elementId: ElementId): void;
  /** Start the inline label editor on this connection. */
  editLabel(connectionId: string): void;
  /** Open the icon grid for this element, anchored at the click point. */
  pickIcon?(elementId: ElementId, screen: Point): void;
  /**
   * First refusal for the canvas wrapper — Layer 7 owns the group popovers and
   * the inline group rename. Return true when the item was handled.
   */
  intercept?(item: MenuItem, state: ContextMenuState): boolean;
  /**
   * The UI language's lookup, for the handful of actions that write a NAME
   * into the model ("Group selection" invents one). Optional and English by
   * default, so the pure dispatch stays testable without a React tree.
   */
  translate?: Translate;
}

/** The elements an item is about: the clicked node, or the whole selection. */
function targetElementIds(target: MenuTarget, selection: Selection): ElementId[] {
  if (target.kind === 'node') return [target.elementId];
  if (target.kind === 'selection') return target.elementIds;
  return selection.elementIds;
}

function connectionIdOf(target: MenuTarget): string | undefined {
  return target.kind === 'edge' || target.kind === 'edgeHandle' ? target.connectionId : undefined;
}

/**
 * Map a picked menu item onto the editor. Logic lives in `EditorActions` and the
 * pure helpers; this only decides which one to call with what. Every branch is a
 * few lines on purpose — when one grows, the growth belongs in `model/`.
 */
export function dispatchMenuAction(item: MenuItem, state: ContextMenuState, host: MenuActionHost): void {
  if (!item.action || item.disabled) return;
  if (host.intercept?.(item, state)) return;
  const { target, flowPosition } = state;
  const { actions, model, diagram } = host;
  const args = item.args ?? {};
  const elementIds = targetElementIds(target, host.selection);
  const elementId = elementIds[0];
  const connectionId = connectionIdOf(target);

  switch (item.action) {
    // --- node -----------------------------------------------------------------
    case 'open-container':
      if (elementId) host.openApplication?.(elementId);
      return;
    case 'open-documentation':
      if (elementId) host.openDocumentation?.(elementId);
      return;
    case 'rename':
      if (target.kind === 'node') host.requestRename?.(target.elementId);
      else if (connectionId) host.editLabel(connectionId);
      return;
    case 'start-connection':
      if (elementId) host.startConnection(elementId);
      return;
    case 'pick-icon':
      // The item opens the picker; the picker writes the key. A hundred marks
      // is a grid with a search field, not a nested menu, so this action ends
      // here and `LogoPickerPopover` calls `updateElement` itself.
      if (elementId) host.pickIcon?.(elementId, state.screen);
      return;
    case 'set-lifecycle':
      if (!args.lifecycle) return;
      if (elementIds.length === 1) actions.updateElement(elementIds[0], { lifecycle: args.lifecycle });
      else actions.updateElements(elementIds, { lifecycle: args.lifecycle });
      return;
    case 'move-to-zone':
      if (elementId && args.zone) moveToZone(host, elementId, args.zone);
      return;
    case 'change-kind':
      if (elementId && args.newKind) actions.changeElementKind(elementId, args.newKind);
      return;
    case 'set-domain-group':
      if (elementId) setDomainGroup(host, elementId, args.domainGroup);
      return;
    case 'duplicate': {
      const payload = serializeSelection(model, diagram, elementIds);
      if (payload) actions.pasteClipboard(payload, { x: GRID_SIZE, y: GRID_SIZE });
      return;
    }
    case 'copy':
      copy(host, elementIds);
      return;
    case 'cut':
      if (copy(host, elementIds)) {
        actions.deleteSelection({ elementIds, connectionIds: [], domainGroups: [] });
      }
      return;
    case 'remove-from-diagram':
      if (elementId) actions.removeFromDiagram(elementId);
      return;
    case 'delete-from-model':
      if (elementId) host.requestDelete?.(elementId);
      return;

    // --- line -----------------------------------------------------------------
    case 'add-bend': {
      if (!connectionId) return;
      const connection = model.connections.find((c) => c.id === connectionId);
      if (!connection) return;
      const route = routeFor(diagram, connectionId);
      const waypoints = route?.waypoints ?? [];
      // Against the DRAWN line — each end where `routeEndAnchor` attaches it, a
      // fixed side included — so the new bend lands on the leg the user clicked
      // next to.
      const source = rectOf(host, connection.sourceId);
      const target = rectOf(host, connection.targetId);
      if (!source || !target) return;
      actions.setEdgeRoute(
        connectionId,
        insertWaypointOnDrawn(waypoints, source, target, flowPosition, routeSides(route)),
      );
      return;
    }
    case 'remove-bend': {
      if (target.kind !== 'edgeHandle') return;
      const waypoints = routeFor(diagram, target.connectionId)?.waypoints ?? [];
      actions.setEdgeRoute(target.connectionId, removeWaypoint(waypoints, target.index));
      return;
    }
    case 'remove-all-bends':
      if (connectionId) actions.setEdgeRoute(connectionId, []);
      return;
    case 'pin-route': {
      if (!connectionId) return;
      // The same test `menuItems` used for the label, so a click does what it said.
      const route = routeFor(diagram, connectionId);
      actions.setRouteSource(connectionId, route && !isAutoRoute(route) ? 'auto' : 'manual');
      return;
    }
    case 'reset-route':
      if (connectionId) host.resetRoute?.(connectionId);
      return;
    case 'attach-at':
      if (!connectionId || !args.attachEnd) return;
      host.setRouteSides?.(
        connectionId,
        args.attachEnd === 'source' ? { sourceSide: args.attachSide } : { targetSide: args.attachSide },
      );
      return;
    case 'set-line-shape':
      if (connectionId) actions.updateConnection(connectionId, { routing: args.routing });
      return;
    case 'set-direction': {
      if (!connectionId) return;
      if (args.direction === 'one-way') actions.updateConnection(connectionId, { isBidirectional: false });
      else if (args.direction === 'two-way') actions.updateConnection(connectionId, { isBidirectional: true });
      else if (args.direction === 'reverse') {
        const connection = model.connections.find((c) => c.id === connectionId);
        if (connection) {
          actions.updateConnection(connectionId, {
            sourceId: connection.targetId,
            targetId: connection.sourceId,
          });
        }
      }
      return;
    }
    case 'edit-label':
      if (connectionId) host.editLabel(connectionId);
      return;
    case 'reset-label-position':
      if (connectionId) actions.setEdgeLabelPosition(connectionId, undefined);
      return;
    case 'delete-connection':
      if (!connectionId) return;
      if (host.requestDeleteConnection) host.requestDeleteConnection(connectionId);
      else actions.deleteConnection(connectionId);
      return;

    // --- pane -----------------------------------------------------------------
    case 'paste-here': {
      const payload = host.clipboardRef?.current;
      if (payload) actions.pasteClipboard(payload, pasteOffsetFor(payload, flowPosition));
      return;
    }
    case 'add-here':
      if (args.kind) host.addElementAt(args.kind, flowPosition);
      return;
    case 'add-domain-group-here':
      host.addDomainGroupAt?.(flowPosition);
      return;
    case 'select-all':
      host.setSelection(selectAllContent(model, diagram));
      return;
    case 'tidy':
      host.tidy?.();
      return;
    case 'route-connections':
      host.routeConnections?.();
      return;
    case 'route-connections-all':
      host.routeConnectionsAll?.();
      return;
    case 'fit-view':
      host.fitView();
      return;
    case 'toggle-grid':
      host.toggleGrid();
      return;
    case 'toggle-snap':
      host.toggleSnap();
      return;

    // --- selection ------------------------------------------------------------
    case 'align':
      if (args.alignAxis) host.align(args.alignAxis);
      return;
    case 'distribute':
      if (args.distributeAxis) host.distribute(args.distributeAxis);
      return;
    case 'group-into-domain-group':
      groupIntoNewDomainGroup(host, elementIds);
      return;
    case 'delete-selection':
      if (host.requestDeleteSelection) host.requestDeleteSelection(host.selection);
      else actions.deleteSelection(host.selection);
      return;

    // --- group ----------------------------------------------------------------
    case 'select-members': {
      if (target.kind !== 'group') return;
      const members = diagram.placements
        .filter((p) => p.domainGroup === target.name)
        .map((p) => p.elementId);
      host.setSelection({ elementIds: members, connectionIds: [], domainGroups: [] });
      return;
    }
    case 'remove-group':
      if (target.kind === 'group') actions.removeDomainGroup(target.name);
      return;
    case 'rename-group':
    case 'tidy-group':
    case 'group-color':
      return; // Layer 7 owns these through `intercept`.

    // --- tab (the toolbar dispatches these itself) -----------------------------
    case 'rename-diagram':
    case 'duplicate-diagram':
    case 'delete-diagram':
      return;
  }
}

/** Copy the elements to the session clipboard; false when none of them is placed here. */
function copy(host: MenuActionHost, elementIds: ElementId[]): boolean {
  const payload = serializeSelection(host.model, host.diagram, elementIds);
  if (!payload || !host.clipboardRef) return false;
  host.clipboardRef.current = payload;
  if (host.pasteCountRef) host.pasteCountRef.current = 0;
  return true;
}

/** Measured rect of a node when React Flow has one, else the placement's. */
function rectOf(host: MenuActionHost, elementId: ElementId): Rect | undefined {
  const measured = host.nodeBounds().find((n) => n.id === elementId);
  if (measured && measured.width > 0 && measured.height > 0) return measured;
  const placement = host.diagram.placements.find((p) => p.elementId === elementId);
  const element = host.model.elements.find((e) => e.id === elementId);
  return placement && element ? placementRect(element.kind, placement) : undefined;
}

/** Placement rects of every OTHER element whose placement satisfies `where`. */
function occupiedRects(
  host: MenuActionHost,
  except: ElementId,
  where: (placement: DesignDiagram['placements'][number]) => boolean,
): Rect[] {
  const elementsById = new Map(host.model.elements.map((e) => [e.id, e]));
  return host.diagram.placements
    .filter((p) => p.elementId !== except && where(p))
    .flatMap((p) => {
      const element = elementsById.get(p.elementId);
      return element ? [placementRect(element.kind, p)] : [];
    });
}

/**
 * "Move to zone": a free cascade slot inside the target band, zone and group
 * re-resolved from the new centre exactly as a drop would resolve them.
 */
function moveToZone(host: MenuActionHost, elementId: ElementId, zone: Layer7Zone): void {
  const { diagram, model, actions } = host;
  if (diagram.kind !== 'layer7') return;
  const placement = diagram.placements.find((p) => p.elementId === elementId);
  const element = model.elements.find((e) => e.id === elementId);
  if (!placement || !element || (placement.zone ?? 'landscape') === zone) return;
  const occupied = occupiedRects(host, elementId, (p) => (p.zone ?? 'landscape') === zone);
  const position = freeZonePosition(zone, element.kind, occupied, diagram.layoutConfig);
  const size = placementSize(element.kind, placement);
  const centre = { x: position.x + size.width / 2, y: position.y + size.height / 2 };
  actions.movePlacements([
    { elementId, ...position, ...(host.resolveDrop?.(elementId, centre) ?? { zone, domainGroup: undefined }) },
  ]);
}

/**
 * "Domain group ▸": join the group, and — like a drop — end up inside its box:
 * a node already inside keeps its spot, one outside moves to a free slot in it.
 */
function setDomainGroup(host: MenuActionHost, elementId: ElementId, name: string | undefined): void {
  const { diagram, model, actions } = host;
  if (diagram.kind !== 'layer7') return;
  if (name === undefined) {
    actions.setDomainGroup(elementId, undefined);
    return;
  }
  const rect = domainGroupRectMap(diagram.layoutConfig).get(name);
  const placement = diagram.placements.find((p) => p.elementId === elementId);
  const element = model.elements.find((e) => e.id === elementId);
  if (!rect || !placement || !element) return;
  const size = placementSize(element.kind, placement);
  const centre = { x: placement.x + size.width / 2, y: placement.y + size.height / 2 };
  if (rectContains(rect, centre)) {
    actions.setDomainGroup(elementId, name);
    return;
  }
  const occupied = occupiedRects(host, elementId, (p) => p.domainGroup === name);
  // Insets keep a moved-in card clear of the border and of the name pill on top.
  const position = freeSlotIn(rect, element.kind, occupied, { x: 24, y: 36 });
  actions.movePlacements([{ elementId, ...position, zone: 'landscape', domainGroup: name }]);
}

/**
 * "Group into new domain group": a box around the landscape members of the
 * selection, membership assigned in the same commit, the new group selected.
 */
function groupIntoNewDomainGroup(host: MenuActionHost, elementIds: ElementId[]): void {
  const { diagram, actions } = host;
  if (diagram.kind !== 'layer7') return;
  const placementsById = new Map(diagram.placements.map((p) => [p.elementId, p]));
  const members = elementIds.filter((id) => {
    const placement = placementsById.get(id);
    return placement !== undefined && (placement.zone ?? 'landscape') === 'landscape';
  });
  const rects = members.flatMap((id) => {
    const rect = rectOf(host, id);
    return rect ? [rect] : [];
  });
  const box = groupRectAround(rects);
  if (!box || members.length === 0) return;
  const existing = (diagram.layoutConfig?.domainGroups ?? []).map((g) => g.name);
  const name = uniqueGroupName(defaultGroupName(host.translate), existing, host.translate);
  actions.upsertDomainGroup({ name, ...box }, members);
  host.setSelection(selectDomainGroup(name));
}
