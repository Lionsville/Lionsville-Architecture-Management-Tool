import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useReactFlow } from '@xyflow/react';
import { GRID_SIZE } from '../canvas/DiagramCanvas';
import { serializeSelection, type ClipboardPayload } from '../model/clipboard';
import type {
  DesignConnection,
  DesignDiagram,
  DesignElement,
  DesignModel,
  ElementId,
  Point,
} from '../types';
import { isEditableTarget, isShortcutIgnoredTarget } from './isEditableTarget';
import { CANVAS_SHORTCUTS, detectPlatform, matchEvent } from './keymap';
import {
  EMPTY_SELECTION,
  isSelectionEmpty,
  selectAllContent,
  type EditorActions,
  type PlacementMove,
  type Selection,
} from './useEditorState';

/**
 * Everything the shortcut dispatch reads or drives. Mutating actions route
 * through the same batched `EditorActions` the pointer gestures use, so each
 * shortcut is one `commit` → one save round-trip. Undo/redo (U7, round-5
 * editor-features plan) re-emit the same cumulative batch off the in-memory
 * overlay-snapshot stack in `useEditorState`.
 */
export interface CanvasShortcutHandlers {
  readOnly: boolean;
  model: DesignModel;
  diagram?: DesignDiagram;
  selection: Selection;
  selectedElement?: DesignElement;
  selectedConnection?: DesignConnection;
  actions: EditorActions;
  /** In-memory undo/redo over content commits (U7). */
  undo(): void;
  redo(): void;
  setSelection(selection: Selection): void;
  /** Session clipboard (shared with U4a's copy/paste path). */
  clipboardRef: RefObject<ClipboardPayload | null>;
  /** Cmd+V cascade counter (shared with U4a); Mod+D must not touch it. */
  pasteCountRef: RefObject<number>;
  onForceSave?(): void;
  onShowHelp(): void;
  /** Opens the delete-confirm dialog for a single selected element. */
  onRequestDeleteElement(elementId: ElementId): void;
  /**
   * Confirmation for the two deletes Delete used to do in silence: one
   * connection, and a whole multi-selection. Optional, and each falls back to
   * the action itself — an editor that wires no dialog keeps the old behaviour.
   */
  onRequestDeleteConnection?(connectionId: string): void;
  onRequestDeleteSelection?(selection: Selection): void;
  /** Shift+F10 / Menu key: the context menu for the current selection (or the canvas). */
  onOpenContextMenu(): void;
  /** F2: rename whatever is selected (inspector Name field, group label, edge label). */
  onRequestRename(): void;
  /** ⌘F: the element finder. Absent = the chord is still swallowed, and inert. */
  onOpenSearch?(): void;
  /** Enter: the documentation page for the selected element. */
  onOpenDocumentation?(elementId: ElementId): void;
}

/** Browser-owned chords we always suppress, even when the action is inert. */
const ALWAYS_PREVENT = new Set([
  'select-all',
  'duplicate',
  'force-save',
  'undo',
  'redo',
  'redo-alt',
  // The browser's find bar over a canvas of SVG finds nothing; ⌘F is ours.
  'find',
]);

/**
 * Events the document listener has already dispatched, so the fallback listener
 * on the wrapper skips them.
 *
 * A `WeakSet` rather than `stopImmediatePropagation()`, which is what the
 * force-save listener used before 4B widened it to every chord. Stopping the
 * event outright would also take it away from React, whose own listeners sit on
 * the render root ABOVE the editor wrapper — and several of them are load-
 * bearing: Escape reverts the domain-group rename draft and closes the palette
 * tray on its way past. Marking the event keeps the "one keydown, one dispatch"
 * guarantee without silencing anybody else's handler.
 */
const handledEvents = new WeakSet<KeyboardEvent>();

const ARROW_DELTAS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/**
 * The single owner of canvas keyboard shortcuts (DK4). It matches keys against
 * the declarative `CANVAS_SHORTCUTS`, suppresses the browser-owned combos, and
 * dispatches to `EditorActions` / React Flow view actions.
 *
 * **Where it listens.** On `document`, in the capture phase, for EVERY chord —
 * one listener per mounted editor, registered for the life of the mount. It
 * started (QF2) as a force-save-only escape hatch because the container
 * listener cannot fire when focus sits outside the wrapper; 4B widened it to
 * every chord for the mirror-image bug, a key pressed inside one of the
 * editor's PORTALLED dialogs and menus, which React renders at the end of
 * `document.body` where nothing bubbles to the wrapper at all.
 *
 * Listening that widely is only safe because the listener then decides
 * narrowly. It stays out of the way unless all of the following hold:
 *
 * - the wrapper is connected and VISIBLE — an editor nobody can see, a second
 *   one in a hidden tab panel, owns no keys;
 * - the target is INSIDE this editor's root, or nowhere in particular
 *   (`document.body`, where focus lands after a pane click). A chord typed
 *   into a search box elsewhere on the host page is not ours;
 * - the target is not EDITABLE (`isEditableTarget`) — typing keeps its keys.
 *   Escape is the exception, because React Flow's own Escape never fires from
 *   an inspector field and something must still deselect;
 * - the target does not own the keys itself (`isShortcutIgnoredTarget`: a
 *   `role="separator"` seam, anything marked `data-shortcuts-ignore`). Those
 *   keep every chord, Escape included.
 *
 * Force-save is the one documented exception to the middle two: ⌘S must flush
 * a pending save with the caret still in a field, and from a seam.
 *
 * **The second listener.** The returned callback ref attaches a keydown
 * listener to the editor container as well. Binding off the resolved element
 * (not a stable ref object) means it re-attaches whenever the container mounts
 * late or remounts — the wrapper only renders once `activeDiagramId` resolves,
 * so a plain `useEffect(..., [ref])` would miss it and every shortcut would
 * silently die. In a real editor it is a fallback: it earns its keep exactly
 * where the visibility gate above deliberately declines (a headless test, a
 * hidden panel). It applies the same editable and ignored-target guards, minus
 * force-save's licence — an editor nobody can see has no pending save worth
 * flushing from a field.
 *
 * **One keydown, one dispatch.** The document listener marks what it handled in
 * a module-level `WeakSet` and the container listener skips those events —
 * rather than `stopImmediatePropagation`, which would also take the key away
 * from React's own load-bearing handlers (see `handledEvents`).
 */
export function useCanvasShortcuts(
  handlers: CanvasShortcutHandlers,
): (node: HTMLElement | null) => void {
  const { fitView, zoomIn, zoomOut, zoomTo } = useReactFlow();

  // Latest closures reach the stable listener through refs, so the callback ref
  // stays stable and only re-binds when the DOM node itself changes.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const viewRef = useRef({ fitView, zoomIn, zoomOut, zoomTo });
  viewRef.current = { fitView, zoomIn, zoomOut, zoomTo };
  const platformRef = useRef(detectPlatform());
  const detachRef = useRef<(() => void) | null>(null);
  // The currently-attached wrapper node, read by the document force-save
  // listener to gate on "this editor is the active/visible surface".
  const nodeRef = useRef<HTMLElement | null>(null);

  /**
   * The document-level, capture-phase listener. Registered once per mount and
   * torn down on unmount; it no-ops unless this editor's wrapper is connected and
   * visible, so a background or hidden editor never hijacks the page's keys.
   *
   * It started as QF2's force-save-only escape hatch: the container listener
   * cannot fire when focus sits OUTSIDE the wrapper (on `document.body` after a
   * pane click), so ⌘S leaked to the browser's save-page dialog.
   *
   * **4B widens it to every chord, for the mirror-image bug.** Focus INSIDE the
   * editor but outside the canvas — an inspector button, a toolbar icon, the
   * panel seam — does reach the wrapper by bubbling, so the container listener
   * fires... except that React renders the editor's dialogs and menus into
   * portals at the end of `document.body`, and a chord pressed with focus in one
   * of those never reaches the wrapper at all. ⌘Z from an inspector button was
   * the reported symptom (review follow-up), and the fix has to be a listener
   * that sees the key wherever it was pressed and then decides.
   *
   * The decision is the important half, and it is deliberately narrow:
   * - the wrapper must be connected and visible (an editor nobody can see owns
   *   no keys);
   * - the event's target must be inside this editor's root, OR nowhere in
   *   particular (`document.body`, which is where focus lands after a pane
   *   click) — a chord typed into a search box somewhere else on the page is
   *   not ours, with the one documented exception of force-save;
   * - editable targets bail exactly as before, so typing keeps its keys.
   *
   * Force-save keeps its extra licence: it fires from an editable target too,
   * because flushing a pending save must work while the caret sits in a field.
   */
  useEffect(() => {
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      const node = nodeRef.current;
      // offsetParent alone misses a visible position:fixed wrapper (it reports
      // null there), so a non-empty client rect also counts as visible.
      const visible =
        node != null &&
        node.isConnected &&
        (node.offsetParent !== null || node.getClientRects().length > 0);
      if (!visible || !node) return;

      const h = handlersRef.current;
      if (!h.diagram) return;
      const target = event.target as globalThis.Node | null;
      // `document.body` (post-pane-click focus) counts as "ours"; so does
      // anything inside the wrapper. Everything else on the page does not.
      const inEditor =
        target == null || target === document.body || target === document || node.contains(target);
      const editable = isEditableTarget(event.target);
      const ignored = isShortcutIgnoredTarget(event.target);
      const ctx = { readOnly: h.readOnly, hasSelection: !isSelectionEmpty(h.selection) };

      for (const def of CANVAS_SHORTCUTS) {
        if (!matchEvent(event, def, platformRef.current)) continue;
        const forceSave = def.id === 'force-save';
        if (!inEditor && !forceSave) return;
        // A control that declared the keys its own gets ALL of them, Escape
        // included — that is what makes "Escape clears the palette filter
        // instead of deselecting" true rather than merely intended.
        if (ignored && !forceSave) return;
        // Bail inside text inputs so native typing keeps its keys — except for
        // Escape/deselect (React Flow's own Escape never fires from the
        // inspector, so the editor must still deselect) and force-save.
        if (editable && def.id !== 'deselect' && !forceSave) return;
        if (ALWAYS_PREVENT.has(def.id)) event.preventDefault();
        if (def.when && !def.when(ctx)) return;
        event.preventDefault();
        // One keydown, one dispatch: the fallback listener skips what this set
        // marks (see `handledEvents` for why it is not stopPropagation).
        handledEvents.add(event);
        dispatch(def.id, event, h, viewRef.current, h.diagram);
        return;
      }
    };
    document.addEventListener('keydown', onDocumentKeyDown, true);
    return () => document.removeEventListener('keydown', onDocumentKeyDown, true);
  }, []);

  return useCallback((node: HTMLElement | null) => {
    // Detach from the previous node first, so a remount never leaves a listener
    // clinging to an orphaned, detached element.
    detachRef.current?.();
    detachRef.current = null;
    nodeRef.current = node;
    if (!node) return;

    // The fallback listener. In a real editor the document listener above has
    // already handled (and stopped) the event; this one earns its keep when the
    // wrapper reports itself invisible — an editor inside a hidden tab panel, a
    // headless test — where the visibility gate above deliberately declines.
    const onKeyDown = (event: KeyboardEvent) => {
      if (handledEvents.has(event)) return;
      const h = handlersRef.current;
      if (!h.diagram) return;
      const editable = isEditableTarget(event.target);
      // Same "not ours" verdict as the document listener — a seam or a
      // `data-shortcuts-ignore` control keeps its keys on both paths, or the
      // fallback would quietly reintroduce the double-dispatch.
      if (isShortcutIgnoredTarget(event.target)) return;
      const ctx = { readOnly: h.readOnly, hasSelection: !isSelectionEmpty(h.selection) };

      for (const def of CANVAS_SHORTCUTS) {
        if (!matchEvent(event, def, platformRef.current)) continue;
        // Bail inside text inputs so native typing keeps its keys — except for
        // Escape/deselect: React Flow's own Escape never fires from the
        // inspector, so the editor must still deselect (and close the panel)
        // when Escape arrives from an input.
        if (editable && def.id !== 'deselect') return;
        if (ALWAYS_PREVENT.has(def.id)) event.preventDefault();
        if (def.when && !def.when(ctx)) return;
        event.preventDefault();
        dispatch(def.id, event, h, viewRef.current, h.diagram);
        return;
      }
    };

    node.addEventListener('keydown', onKeyDown);
    detachRef.current = () => node.removeEventListener('keydown', onKeyDown);
  }, []);
}

type ViewActions = Pick<
  ReturnType<typeof useReactFlow>,
  'fitView' | 'zoomIn' | 'zoomOut' | 'zoomTo'
>;

function dispatch(
  id: string,
  event: KeyboardEvent,
  h: CanvasShortcutHandlers,
  view: ViewActions,
  diagram: DesignDiagram,
): void {
  switch (id) {
    case 'select-all':
      h.setSelection(selectAllContent(h.model, diagram));
      return;
    case 'deselect':
      h.setSelection(EMPTY_SELECTION);
      return;
    case 'delete':
      // Each of the three goes through the editor's dialogs: a single element to
      // the remove-or-delete question, a connection and a multi-selection to the
      // confirmation (which lets a group-box-only selection straight through —
      // removing a box is a layout edit, its elements survive). Cut is
      // deliberately NOT confirmed: the content is on the clipboard.
      if (h.selectedElement) h.onRequestDeleteElement(h.selectedElement.id);
      else if (h.selectedConnection) {
        if (h.onRequestDeleteConnection) h.onRequestDeleteConnection(h.selectedConnection.id);
        else h.actions.deleteConnection(h.selectedConnection.id);
      } else if (h.onRequestDeleteSelection) h.onRequestDeleteSelection(h.selection);
      else h.actions.deleteSelection(h.selection);
      return;
    case 'copy':
      copyToClipboard(h, diagram);
      return;
    case 'paste':
      if (h.clipboardRef.current) {
        const step = h.pasteCountRef.current + 1;
        h.actions.pasteClipboard(h.clipboardRef.current, { x: GRID_SIZE * step, y: GRID_SIZE * step });
        h.pasteCountRef.current = step;
      }
      return;
    case 'cut':
      copyToClipboard(h, diagram);
      h.actions.deleteSelection(h.selection);
      return;
    case 'duplicate': {
      // Serialize the CURRENT selection and paste at a fixed +grid offset,
      // independent of the Cmd+V cascade counter (never read/mutated here).
      const payload = serializeSelection(h.model, diagram, h.selection.elementIds);
      if (payload) h.actions.pasteClipboard(payload, { x: GRID_SIZE, y: GRID_SIZE });
      return;
    }
    case 'nudge':
    case 'nudge-fine': {
      const delta = ARROW_DELTAS[event.key];
      if (!delta) return;
      const step = id === 'nudge-fine' ? 1 : GRID_SIZE;
      const moves = nudgeMoves(diagram, h.selection, delta.x * step, delta.y * step);
      if (moves.length > 0) h.actions.movePlacements(moves);
      return;
    }
    case 'zoom-in':
      void view.zoomIn({ duration: 150 });
      return;
    case 'zoom-out':
      void view.zoomOut({ duration: 150 });
      return;
    case 'fit-view':
      void view.fitView({ padding: 0.1, duration: 300 });
      return;
    case 'zoom-100':
      void view.zoomTo(1, { duration: 300 });
      return;
    case 'force-save':
      h.onForceSave?.();
      return;
    case 'undo':
      h.undo();
      return;
    case 'redo':
    case 'redo-alt':
      h.redo();
      return;
    case 'help':
      h.onShowHelp();
      return;
    case 'context-menu':
    case 'context-menu-key':
      h.onOpenContextMenu();
      return;
    case 'open-documentation':
      if (h.selectedElement) h.onOpenDocumentation?.(h.selectedElement.id);
      return;
    case 'rename':
      h.onRequestRename();
      return;
    case 'find':
      h.onOpenSearch?.();
      return;
  }
}

function copyToClipboard(h: CanvasShortcutHandlers, diagram: DesignDiagram): void {
  const payload = serializeSelection(h.model, diagram, h.selection.elementIds);
  if (!payload) return;
  h.clipboardRef.current = payload;
  h.pasteCountRef.current = 0;
}

function nudgeMoves(
  diagram: DesignDiagram,
  selection: Selection,
  dx: number,
  dy: number,
): PlacementMove[] {
  const placementsById = new Map(diagram.placements.map((p) => [p.elementId, p]));
  const moves: PlacementMove[] = [];
  for (const elementId of selection.elementIds) {
    const placement = placementsById.get(elementId);
    if (!placement) continue;
    // Preserve zone/domainGroup: a keyboard nudge shifts position without
    // re-resolving the layer7 band (that geometry lives in the canvas).
    moves.push({
      elementId,
      x: placement.x + dx,
      y: placement.y + dy,
      zone: placement.zone,
      domainGroup: placement.domainGroup,
    });
  }
  return moves;
}
