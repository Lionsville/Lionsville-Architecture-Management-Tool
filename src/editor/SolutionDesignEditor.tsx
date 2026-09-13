import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type RefObject } from 'react';
import { placedNodes } from '../model/placement';
import { getNodesBounds, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import type {
  AspectStatus, DesignDiagram, ElementId, ElementKind, Lifecycle, Rect, UploadedLogo,
} from '../model/types';
import type { Theme } from '@mui/material/styles';
import type { StringKey, Translate } from '../i18n';
import type { ExportLegend } from './props';
import { EditorRefused } from './props';
import type { EditorHandle, EditorRequests, SolutionDesignEditorProps } from './props';
import type { StandInNote } from './nodes/nodeData';
import { ContainerCanvas } from './canvas/ContainerCanvas';
import { Layer7Canvas } from './canvas/Layer7Canvas';
import { ElementPalette, type DomainGroupSeed, type PaletteSeed } from './canvas/ElementPalette';
import { newDomainGroup } from './canvas/domainGroupPlacement';
import { CONTAINER_PALETTE, LAYER7_PALETTE } from './canvas/paletteItems';
import { LogoLibraryProvider } from './nodes/logoRegistry';
import { type ClipboardPayload } from '../model/clipboard';
import { exportBitmapSize, exportDiagramPng, exportFooterHeight } from './export/exportPng';
import { ExportDialog, type ExportOptions } from './export/ExportDialog';
import { c4PanelFor } from './export/c4Panel';
import { getExportTokens, getNodeTokens } from './theme/tokens';
import {
  tidyContainer,
  tidyGroup,
  tidyLayer7,
  type TidyOptions,
} from '../layout/tidy';
import { routeDiagramEdges } from '../layout/routeOnly';
import { diagramWithRoutes, edgeRoutesOf,
  manualRouteIds,
  routeFor,
  routeSource,
  routeWithSides,
  withRouteRow,
  type AttachSidesPatch,
} from '../model/routes';
import { MAX_CONNECTORS_PER_TIER, type SkippedTier } from '../layout/libavoidRouter';
import {
  cancelElkLayout, canCancelElkLayout, isLayoutRefusal, MAX_TIDY_NODES,
} from '../layout/elkLayout';
import { aspectConfigFor } from '../model/aspects';
import {
  deletionSummary,
  needsDeleteConfirmation,
  type DeletionSummary,
} from '../model/deletion';
import {
  mergePreferences,
  preferencesEqual,
  type EditorPreferences,
} from './preferences';
import { canvasRect } from '../model/zones';
import { unionRects } from '../model/placement';
import { LanguageProvider, useStrings } from '../i18n/LanguageContext';
import { ElementSearchDialog } from '../search/ui/ElementSearchDialog';
import { PanelResizer } from './PanelResizer';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { DeleteElementDialog } from './DeleteElementDialog';
import { EditorToolbar, type LayoutAction } from './EditorToolbar';
import { DiagramSettingsDialog } from './DiagramSettingsDialog';
import { RenameDiagramDialog } from './RenameDiagramDialog';
import { ConnectionInspector } from './ConnectionInspector';
import { DomainGroupInspector } from './DomainGroupInspector';
import { ElementInspector } from './ElementInspector';
import { InspectorEmptyState, InspectorPanel } from './InspectorPanel';
import { MultiSelectionInspector } from './MultiSelectionInspector';
import { ShortcutsHelpDialog } from './ShortcutsHelpDialog';
import { DocumentationPage } from '../documentation/ui/DocumentationPage';
import { FIELDS_COLUMN } from '../documentation/ui/DocumentationPage';
import {
  defaultElementNames,
  selectElement,
  selectionCount,
  useEditorState,
  type CommitToken,
  type Selection,
} from './useEditorState';
import { useCanvasShortcuts } from './use-canvas-shortcuts';
import { useFocusElement } from './useFocusElement';
import { useAutoLayout } from './useAutoLayout';
import { useLiveRouting } from './useLiveRouting';

/**
 * The @lionsville/solution-design editor: toolbar (diagram tabs/breadcrumb,
 * tidy, export), canvas (Layer 7 zones or C4 container view), and inspector.
 * Pure component over the host-owned model — see README.md for the host
 * contract (debounced saves, tempId reconciliation, merge strategy).
 *
 * The host must render it inside a sized container (it fills 100%/100%).
 */
export function SolutionDesignEditor(props: SolutionDesignEditorProps): JSX.Element {
  return (
    <ReactFlowProvider>
      {/* The UI language, like the logo library below it, reaches every label
          through context rather than through a prop on every component. The
          default is English (see `LanguageContext`), so a host that passes no
          `language` keeps the editor it had. */}
      <LanguageProvider language={props.language?.value ?? 'en'}>
        {/* The uploaded logo library reaches nodes through context rather than
            through every node's props: a mark is decoration on an element that
            otherwise knows nothing about where marks come from. */}
        <LogoLibraryProvider value={props.logos?.library ?? EMPTY_LOGO_LIBRARY}>
          <EditorBody {...props} />
        </LogoLibraryProvider>
      </LanguageProvider>
    </ReactFlowProvider>
  );
}

/** Stable empty default — a fresh `[]` per render would re-run every consumer. */
const EMPTY_LOGO_LIBRARY: UploadedLogo[] = [];

/**
 * A pending confirmed delete: what it takes away, what to call it, and the one
 * thunk that performs it. The thunk is what keeps the dialog generic — it knows
 * nothing about connections or selections, only that something is about to go.
 */
interface ConfirmDeleteState {
  summary: DeletionSummary;
  subject?: string;
  run(): void;
}

function EditorBody(props: SolutionDesignEditorProps) {
  const theme = useTheme();
  const { t, language } = useStrings();
  // What the palette's name field shows when you leave it blank — and exactly
  // what `addElement` will then write into the model, in the same language.
  const defaultNames = useMemo(() => defaultElementNames(t), [t]);
  const state = useEditorState(props);
  const { fitView, getNodes } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  // One flag for BOTH layout actions: Tidy and route-only each commit a single
  // undo step over the whole diagram, so running them concurrently would let the
  // slower one overwrite the faster one's result. Whichever is running disables
  // the other and shows the spinner on its own button.
  const [busy, setBusy] = useState<LayoutAction | undefined>(undefined);
  // The PNG export gets its own flag rather than joining `busy`: it neither
  // commits nor conflicts with a layout pass, and `busy` is the interlock
  // between the two passes that do. All it owes the user is a spinner on the
  // button they pressed, and no second export while the first rasterises.
  const [exporting, setExporting] = useState(false);
  /**
   * The whole board is mounted for a capture a host asked for (ADR-0007).
   * Separate from {@link exporting}, which is only a spinner; the dialog's
   * own capture mounts the board through {@link exportOptions} instead.
   */
  const [capturing, setCapturing] = useState(false);
  /**
   * The export dialog is open, with these choices. While it is, the board is
   * drawn the way the picture will be — under the chosen theme, with or without
   * every label, every element mounted — so the capture, the preview and what
   * shows behind the dialog are one thing.
   */
  const [exportOptions, setExportOptions] = useState<ExportOptions | undefined>(undefined);
  /** An object URL of the last preview drawn, revoked when the next replaces it. */
  const [exportPreview, setExportPreview] = useState<string | undefined>(undefined);
  const [previewBusy, setPreviewBusy] = useState(false);
  /**
   * The view settings, seeded from the host and reported back on every change.
   *
   * Read ONCE, in the state initialiser: these are preferences, not a controlled
   * value. A host that persists them writes on `onPreferencesChange` and hands
   * the same object back on the next mount, and re-reading the prop would make
   * that round trip fight whatever the user just clicked.
   */
  const initialPreferences = useState(() => mergePreferences(props.preferences?.initial))[0];
  // Tidy settings (direction / density / keep-manual-routes). Nothing lands on
  // the model — they are the editor's, like the snap and lifecycle toggles.
  const [tidyOptions, setTidyOptions] = useState<TidyOptions>(initialPreferences.tidyOptions);
  // Per-group tidy settings, deliberately SEPARATE from the board settings
  // above: a group often wants a different direction or density from the board
  // it sits on.
  const [groupTidyOptions, setGroupTidyOptions] = useState<TidyOptions>(
    initialPreferences.groupTidyOptions,
  );
  const [deleteTarget, setDeleteTarget] = useState<ElementId | undefined>(undefined);
  const [helpOpen, setHelpOpen] = useState(false);
  // "Rename diagram…" from a tab: the dialog lives here, the rename lands on the host.
  const [settingsDiagramId, setSettingsDiagramId] = useState<string | undefined>(undefined);
  const [renameDiagramTarget, setRenameDiagramTarget] = useState<{ id: string; name: string } | undefined>(
    undefined,
  );
  // Keyboard-driven menu requests, forwarded to the canvas as a nonce (Shift+F10
  // opens the menu for the selection, F2 renames it). The canvas handles each once.
  const [menuRequest, setMenuRequest] = useState<{ kind: 'open' | 'rename'; nonce: number } | undefined>(
    undefined,
  );
  const menuNonce = useRef(0);
  // "Rename" on an element: select it, make sure the inspector is open, and ask
  // the inspector to focus its Name field. Cleared once the selection moves on,
  // so a request never outlives the element it was about.
  const [renameRequest, setRenameRequest] = useState<{ id: ElementId; nonce: number } | undefined>(
    undefined,
  );
  // Grid-snap toggle (U4a): editor-level so it survives diagram switches.
  const [snapToGrid, setSnapToGrid] = useState(initialPreferences.snapToGrid);
  // Visible dot-grid toggle (QF3): default on (matches the always-on dots
  // today), independent of snapping.
  const [showGrid, setShowGrid] = useState(initialPreferences.showGrid);
  // Lifecycle-badge toggle (U5): default on (informational).
  const [showLifecycle, setShowLifecycle] = useState(initialPreferences.showLifecycle);
  // Panel collapse toggles (U7b): default expanded.
  const [paletteCollapsed, setPaletteCollapsed] = useState(initialPreferences.paletteCollapsed);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(initialPreferences.inspectorCollapsed);
  // Panel widths (4B): dragged on the seam beside each panel, clamped by
  // `model/panels`, remembered with the rest of the view settings.
  const [paletteWidth, setPaletteWidth] = useState(initialPreferences.paletteWidth);
  const [inspectorWidth, setInspectorWidth] = useState(initialPreferences.inspectorWidth);
  // The minimap (4B): off by default — it costs board area on a landscape that
  // already fills the window.
  const [showMinimap, setShowMinimap] = useState(initialPreferences.showMinimap);
  // Line labels: on by default; off, a label shows only on hover or selection.
  const [showEdgeLabels, setShowEdgeLabels] = useState(initialPreferences.showEdgeLabels);
  // ⌘F. The dialog owns its own query; this is only whether it is up.
  const [searchOpen, setSearchOpen] = useState(false);
  /** The element whose documentation page is open; session state, never saved. */
  const [documentationId, setDocumentationId] = useState<ElementId | undefined>(undefined);
  /** The view the page lists the neighbours of, when a host named one; absent = the active board. */
  const [documentationDiagramId, setDocumentationDiagramId] = useState<string | undefined>(undefined);
  // The page's fields column, kept here because the page is remounted per
  // element: a width dragged once should hold while a reader moves on.
  const [documentationFieldsWidth, setDocumentationFieldsWidth] = useState<number>(FIELDS_COLUMN.default);
  /**
   * ONE focus request, fed by two sources: the host's `focusElement` prop and
   * the editor's own ⌘F finder.
   *
   * ⌘F must do exactly what a host's click-to-focus does — select, switch
   * diagram when the element lives on another one, pan and zoom — so it goes
   * through the same `useFocusElement` hook rather than a second, nearly-right
   * implementation.
   *
   * Both are re-stamped with a nonce from ONE counter here, rather than passing
   * whichever is "newer": the two nonce spaces are unrelated (the host counts
   * its own requests, we count ours), so comparing them would be meaningless and
   * an accidental collision would make `useFocusElement` skip a request as
   * already handled. Re-stamping makes the ordering real: last request wins,
   * whoever made it.
   */
  const [focusRequest, setFocusRequest] = useState<{ id: ElementId; nonce: number } | undefined>(
    undefined,
  );
  const focusNonce = useRef(0);
  /**
   * The host request already adopted. It starts EMPTY, not at `props.requests?.focus`:
   * an editor mounted with a focus request already on the prop (a host that opens
   * the editor straight onto an element from its coverage drawer) would otherwise
   * see `seen === hostFocus` on the very first effect run and drop the request in
   * silence — the one case the pre-4B code, which passed the prop through to
   * `useFocusElement`, handled without thinking about it.
   */
  const hostFocusRef = useRef<EditorRequests['focus']>(undefined);
  /**
   * A delete that has to be confirmed first — one connection, or a whole
   * multi-selection. Held here beside `deleteTarget` (the single-element
   * dialog's) because the same three entry points feed both: the keymap, the
   * context menu and the inspector.
   */
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | undefined>(undefined);
  // In-memory clipboard scoped to this editor session (cross-diagram, same tab).
  const clipboardRef = useRef<ClipboardPayload | null>(null);
  // How many times the current clipboard has been pasted. Each paste offsets
  // one grid step further so repeated Cmd+V cascades instead of stacking
  // (draw.io behaviour); a fresh copy resets the cascade.
  const pasteCountRef = useRef(0);

  const readOnly = props.editing.readOnly ?? false;
  const activeDiagram = state.model.diagrams.find((d) => d.id === props.document.activeDiagramId);

  const { setSelection } = state;
  const requestRename = useCallback(
    (elementId: ElementId) => {
      setSelection(selectElement(elementId));
      setInspectorCollapsed(false);
      menuNonce.current += 1;
      setRenameRequest({ id: elementId, nonce: menuNonce.current });
    },
    [setSelection],
  );
  const selectedElementId = state.selectedElement?.id;
  useEffect(() => {
    if (renameRequest && renameRequest.id !== selectedElementId) setRenameRequest(undefined);
  }, [renameRequest, selectedElementId]);
  // Selecting the element as well means closing the page lands the reader on
  // the thing they were just reading about, with its inspector open.
  const openDocumentation = useCallback(
    (elementId: ElementId) => {
      setSelection(selectElement(elementId));
      setDocumentationId(elementId);
    },
    [setSelection],
  );
  const requestMenu = useCallback((kind: 'open' | 'rename') => {
    menuNonce.current += 1;
    setMenuRequest({ kind, nonce: menuNonce.current });
  }, []);

  const requestFocus = useCallback((elementId: ElementId) => {
    focusNonce.current += 1;
    setFocusRequest({ id: elementId, nonce: focusNonce.current });
  }, []);

  // Adopt the host's request whenever it is a new one. Comparing id AND nonce
  // because a host may re-request the same element (a second click on the same
  // row in its coverage drawer), which it signals by bumping only the nonce.
  const hostFocus = props.requests?.focus;
  useEffect(() => {
    const seen = hostFocusRef.current;
    if (!hostFocus) return;
    if (seen && seen.id === hostFocus.id && seen.nonce === hostFocus.nonce) return;
    hostFocusRef.current = hostFocus;
    focusNonce.current += 1;
    setFocusRequest({ id: hostFocus.id, nonce: focusNonce.current });
  }, [hostFocus]);

  // The host's "open the documentation" — same nonce discipline as focus above.
  // Resolving WHICH element happens here rather than in the host, because the
  // selection is the editor's and a host cannot see it.
  const hostDoc = props.requests?.documentation;
  const hostDocRef = useRef<EditorRequests['documentation']>(undefined);
  const selectedForDoc = state.selectedElement?.id;
  const firstPlaced = activeDiagram && placedNodes(activeDiagram)[0]?.id;
  const firstInModel = state.model.elements[0]?.id;
  useEffect(() => {
    if (!hostDoc) return;
    if (hostDocRef.current && hostDocRef.current.nonce === hostDoc.nonce) return;
    hostDocRef.current = hostDoc;
    const id = hostDoc.elementId ?? selectedForDoc ?? firstPlaced ?? firstInModel;
    if (!id) return;
    setDocumentationDiagramId(hostDoc.diagramId);
    openDocumentation(id);
  }, [hostDoc, selectedForDoc, firstPlaced, firstInModel, openDocumentation]);

  useFocusElement({
    focusElement: focusRequest,
    model: state.model,
    activeDiagramId: props.document.activeDiagramId,
    setSelection: state.setSelection,
    onActiveDiagramChange: props.document.onActiveDiagramChange,
  });

  // --- preferences out ------------------------------------------------------

  /**
   * Report the view settings whenever one of them actually changes.
   *
   * One effect over all seven rather than a callback per toggle: the toggles are
   * plain `setState` calls in a dozen places (toolbar, canvas menu, panel
   * chevrons, the group popover) and threading a report through each of them
   * would be seven chances to forget one. The equality check is what makes that
   * affordable — a host writing to storage on every call must not be called on
   * every render.
   */
  const onPreferencesChange = props.preferences?.onChange;
  const lastPreferencesRef = useRef<EditorPreferences>(initialPreferences);
  useEffect(() => {
    if (!onPreferencesChange) return;
    const next: EditorPreferences = {
      snapToGrid,
      showGrid,
      showLifecycle,
      paletteCollapsed,
      inspectorCollapsed,
      paletteWidth,
      inspectorWidth,
      showMinimap,
      showEdgeLabels,
      tidyOptions,
      groupTidyOptions,
    };
    if (preferencesEqual(lastPreferencesRef.current, next)) return;
    lastPreferencesRef.current = next;
    onPreferencesChange(next);
  }, [
    onPreferencesChange,
    snapToGrid,
    showGrid,
    showLifecycle,
    paletteCollapsed,
    inspectorCollapsed,
    paletteWidth,
    inspectorWidth,
    showMinimap,
    showEdgeLabels,
    tidyOptions,
    groupTidyOptions,
  ]);

  // --- deletes that are worth stopping for ---------------------------------

  /**
   * A connection delete: confirmed, unless the diagram is gone from under it.
   * `needsDeleteConfirmation` is asked rather than assumed so the rule lives in
   * one place — `model/deletion.ts` — and both entry points obey the same one.
   */
  const requestDeleteConnection = useCallback(
    (connectionId: string) => {
      if (readOnly) return;
      const connection = state.model.relations.find((c) => c.id === connectionId);
      const summary = deletionSummary(state.model, {
        elementIds: [],
        connectionIds: [connectionId],
        domainGroups: [],
      });
      if (!needsDeleteConfirmation(summary)) {
        state.actions.deleteConnection(connectionId);
        return;
      }
      setConfirmDelete({
        summary,
        subject: connection?.label || undefined,
        run: () => state.actions.deleteConnection(connectionId),
      });
    },
    [readOnly, state.model, state.actions],
  );

  const requestDeleteSelection = useCallback(
    (selection: Selection) => {
      if (readOnly) return;
      const summary = deletionSummary(state.model, selection);
      if (!needsDeleteConfirmation(summary)) {
        state.actions.deleteSelection(selection);
        return;
      }
      setConfirmDelete({ summary, run: () => state.actions.deleteSelection(selection) });
    },
    [readOnly, state.model, state.actions],
  );

  // --- palette (docked left panel, D1) -------------------------------------

  const handlePaletteAdd = useCallback(
    (kind: ElementKind, seed?: PaletteSeed) => {
      // Unchanged semantics: no position → `seedPlacement` lands it in the
      // kind's home zone, exactly as the floating palette did.
      state.actions.addElement({ kind, ...seed });
    },
    [state.actions],
  );

  // Moved up from `Layer7Canvas` when the palette left the canvas: it only ever
  // needed the diagram's layoutConfig and one action, both of which live here.
  // The rect itself comes from the shared helper, because a group dropped on the
  // board has to end up identical to one placed from the tray apart from where.
  const addDomainGroup = useCallback(
    (seed?: DomainGroupSeed) => {
      const { group, box } = newDomainGroup({ diagram: activeDiagram, translate: t, ...seed });
      state.actions.addDomainGroup(group, box);
    },
    [activeDiagram, state.actions],
  );

  // Layout failures are REPORTED, not swallowed. The router is WASM fetched at
  // runtime, so "it never loaded" is a real deployment state, and `finally` alone
  // only frees the button again: the user clicks, the spinner blinks, nothing
  // happens, and the one message that would tell them to reload the page goes to
  // the console. Both layout actions funnel their failures through here.
  const reportLayoutError = useCallback(
    (message: string, cause: unknown) => {
      console.error(message, cause);
      props.layout?.onError?.(message);
    },
    [props.layout?.onError],
  );

  /**
   * Report a board the router REFUSED, and say why in terms of the board rather
   * than of our internals.
   *
   * This is a message where there was none. A tier over the connector cap is
   * dropped whole and its connections come back absent, which is byte-identical
   * to "nothing needed routing" — measured on a 120-app board as 0 of 200
   * connections routed, in 0.3 ms, reported as success. The user pressed a
   * button; they get an answer.
   *
   * It deliberately does NOT send them to "Route connections". That button cannot
   * route an over-cap board either — it now says so instead of returning quietly,
   * which is an improvement and still not a way out. Pointing at it would be
   * pointing at a second failure.
   */
  const reportSkippedTiers = useCallback(
    (skipped: SkippedTier[] | undefined): boolean => {
      if (!skipped || skipped.length === 0) return false;
      const total = skipped.reduce((sum, tier) => sum + tier.connectorCount, 0);
      reportLayoutError(t('error.overCap', { total, max: MAX_CONNECTORS_PER_TIER }), skipped);
      return true;
    },
    [reportLayoutError, t],
  );

  /**
   * `override` exists so the settling pass can force the pin options off — see
   * `settlingOptions`. The button keeps calling this with nothing and behaves
   * exactly as it did; without the parameter the pin rule would be undeliverable,
   * because this reads `tidyOptions` straight out of its own closure.
   *
   * One optional argument and one `??`: deliberately NOT a second code path, so a
   * board laid out by the effect and one laid out by the button go through the
   * same code and cannot drift apart.
   */
  const handleTidy = useCallback(async (override?: TidyOptions, unattended = false) => {
    if (!activeDiagram || busy) return;
    const options = override ?? tidyOptions;
    setBusy('tidy');
    try {
      const result =
        activeDiagram.kind === 'layer7'
          ? await tidyLayer7(state.model, activeDiagram, options)
          : await tidyContainer(state.model, activeDiagram, options);
      // Applied FIRST, and applied even when routing failed: `routingError` means
      // the placements are good and only the routes are missing (see
      // `routeOrDegrade`), so throwing the layout away would be the worse outcome.
      state.actions.applyTidyResult(result);
      if (result.routingError !== undefined) {
        // The unattended wording says what happened and stops. "Reload the page
        // and try again" is advice for someone who pressed a button and is
        // waiting for it; for a pass that ran by itself on open it reads as an
        // alarm about something the user did not do and cannot repeat.
        reportLayoutError(
          t(unattended ? 'error.tidyRoutingUnattended' : 'error.tidyRouting'),
          result.routingError,
        );
      } else {
        // Only when routing did not outright fail — one message per press, and
        // the failure above is the more useful of the two.
        reportSkippedTiers(result.skipped);
      }
      requestAnimationFrame(() => fitView({ padding: 0.1, duration: 300 }));
    } catch (error) {
      // A cancel is the answer to a question the user asked; a toast saying the
      // thing they stopped did not finish is noise. A board past the cap gets
      // its own words, because "reload the page and try again" is advice that
      // will not help and the real advice — fewer boxes on this diagram — is
      // something only this message can give.
      if (isLayoutRefusal(error, 'cancelled')) throw error;
      if (isLayoutRefusal(error, 'tooLarge')) {
        reportLayoutError(
          t('error.tidyTooLarge', { count: error.count ?? 0, limit: error.limit ?? MAX_TIDY_NODES }),
          error,
        );
        throw error;
      }
      reportLayoutError(t(unattended ? 'error.tidyUnattended' : 'error.tidy'), error);
      // Rethrown so an UNATTENDED caller can tell "laid out" from "did not":
      // `useAutoLayout` must not clear the persisted flag for a pass that
      // produced nothing. The button's call site has already been told by the
      // toast above, so it attaches a no-op `.catch` — `void` alone would leave
      // the rejection unhandled.
      throw error;
    } finally {
      setBusy(undefined);
    }
  }, [
    activeDiagram,
    busy,
    state.model,
    state.actions,
    fitView,
    tidyOptions,
    reportLayoutError,
    reportSkippedTiers,
    t,
  ]);

  /**
   * Lay this diagram out once if a machine wrote its geometry (intent rule 12).
   *
   * `run` is `handleTidy` itself, not a copy of its body, so the settling pass
   * inherits everything the button already does: it applies the result through
   * `applyTidyResult` as ONE commit and therefore one undo step, keeps the
   * placements when only routing failed, reports a routing failure through the
   * editor's single message channel, and calls `fitView` — which on a first open
   * is required rather than a liberty, since the canvas has already framed the
   * machine grid on mount and the layout then changes the board's extent.
   */
  useAutoLayout({
    diagram: activeDiagram,
    readOnly,
    busy,
    options: tidyOptions,
    run: (override) => handleTidy(override, true),
    onSettled: props.layout?.onSettled,
  });

  // Per-group tidy (right-click a group label). Deliberately does NOT fitView:
  // the change is local to one box, so yanking the viewport would lose the
  // user's place.
  const handleTidyGroup = useCallback(
    async (name: string) => {
      if (!activeDiagram || activeDiagram.kind !== 'layer7' || busy) return;
      setBusy('tidy');
      try {
        const result = await tidyGroup(
          state.model,
          activeDiagram,
          name,
          groupTidyOptions,
        );
        state.actions.applyTidyResult(result);
        if (result.routingError !== undefined) {
          reportLayoutError(t('error.tidyGroup'), result.routingError);
        } else {
          reportSkippedTiers(result.skipped);
        }
      } catch (error) {
        // Same two answers as the whole-board pass above: a cancel says nothing,
        // and a group past the cap says what the cap is.
        if (isLayoutRefusal(error, 'cancelled')) return;
        if (isLayoutRefusal(error, 'tooLarge')) {
          reportLayoutError(
            t('error.tidyTooLarge', { count: error.count ?? 0, limit: error.limit ?? MAX_TIDY_NODES }),
            error,
          );
          return;
        }
        reportLayoutError(t('error.tidyGroupFailed'), error);
      } finally {
        setBusy(undefined);
      }
    },
    [
      activeDiagram,
      busy,
      state.model,
      state.actions,
      groupTidyOptions,
      reportLayoutError,
      reportSkippedTiers,
      t,
    ],
  );

  // "Route connections only": re-route the edges around the CURRENT node
  // positions without moving anything. The pass a user reaches for after nudging
  // nodes by hand, when a full Tidy would throw that layout away. Async because
  // the router is WASM, and it commits through the same one-undo-step action as
  // Tidy — the result carries routes only, so placements and layoutConfig stay
  // untouched. Unlike Tidy there is no half-result worth keeping here (routes are
  // all this pass produces), so a failure commits nothing and is only reported.
  //
  // `preserve` is the ONE difference between the two menu entries: "Route
  // connections" leaves every hand-drawn and pinned route where it is, "Re-route
  // everything (ignore pins)" hands the whole board to the router. The button
  // in the toolbar is the first of the two — the destructive pass is a deliberate
  // extra click away.
  const routeEdges = useCallback(
    async (preserve: ReadonlySet<string> | undefined) => {
      if (!activeDiagram || busy) return;
      setBusy('route');
      try {
        const result = await routeDiagramEdges(
          state.model,
          activeDiagram,
          'keep-stored',
          undefined,
          preserve,
        );
        state.actions.applyTidyResult(result);
        reportSkippedTiers(result.skipped);
      } catch (error) {
        reportLayoutError(t('error.route'), error);
      } finally {
        setBusy(undefined);
      }
    },
    [
      activeDiagram,
      busy,
      state.model,
      state.actions,
      reportLayoutError,
      reportSkippedTiers,
      t,
    ],
  );
  const handleRouteEdges = useCallback(
    () => routeEdges(activeDiagram ? manualRouteIds(activeDiagram) : undefined),
    [routeEdges, activeDiagram],
  );
  const handleRouteEdgesAll = useCallback(() => routeEdges(undefined), [routeEdges]);

  // --- live auto-routing (items 3 and 6) -----------------------------------

  const autoRoute = activeDiagram?.autoRoute ?? false;
  const { geometryVersion } = state;

  /**
   * "Reset to automatic route": forget the stored row, then bring the line back
   * ROUTED rather than merely straight — a reset that left a bare floating line
   * on a routed board would look like a regression, not a reset.
   *
   * Two ways to the same one undo step. With live routing on, the reset is a
   * geometry commit and the live pass that follows amends into it by itself.
   * With it off, this runs the route-only pass explicitly and amends through the
   * token the reset returned — the same shape as the live effect, minus the
   * debounce. The diagram handed to the router is the one AFTER the reset (the
   * row filtered out), because `state.model` is still the render before
   * the commit: routing against it would find the old row in the preserve set
   * and hand it straight back.
   */
  const rerouteAfterRouteEdit = useCallback(
    async (token: CommitToken, diagram: DesignDiagram) => {
      setBusy('route');
      try {
        const result = await routeDiagramEdges(
          state.model,
          diagram,
          'keep-stored',
          undefined,
          manualRouteIds(diagram),
        );
        state.actions.applyTidyResult(result, token);
        reportSkippedTiers(result.skipped);
      } catch (error) {
        reportLayoutError(t('error.routeOne'), error);
      } finally {
        setBusy(undefined);
      }
    },
    [state.actions, state.model, reportLayoutError, reportSkippedTiers, t],
  );
  const handleResetRoute = useCallback(
    async (connectionId: string) => {
      if (!activeDiagram || readOnly || busy) return;
      const token = state.actions.resetEdgeRoute(connectionId);
      if (autoRoute) return;
      await rerouteAfterRouteEdit(token, diagramWithRoutes(
        activeDiagram,
        edgeRoutesOf(activeDiagram).filter((r) => r.relationId !== connectionId),
      ));
    },
    [activeDiagram, readOnly, busy, autoRoute, state.actions, rerouteAfterRouteEdit],
  );
  /**
   * "Attach at" (inspector selects, line menu, Alt-reconnect): the same shape as
   * the reset. The side lands in the row; live routing follows a geometry bump
   * by itself, otherwise the pass runs here against the board AFTER the edit —
   * with the merged row in place of the stored one — and amends into the edit's
   * token. A no-op (the side it already had) commits nothing and routes nothing.
   */
  const handleSetRouteSides = useCallback(
    async (connectionId: string, sides: AttachSidesPatch) => {
      if (!activeDiagram || readOnly || busy) return;
      const token = state.actions.setRouteSides(connectionId, sides);
      if (token === undefined || autoRoute) return;
      const row = routeWithSides(routeFor(activeDiagram, connectionId), connectionId, sides);
      await rerouteAfterRouteEdit(
        token,
        diagramWithRoutes(activeDiagram, withRouteRow(edgeRoutesOf(activeDiagram), row)),
      );
    },
    [activeDiagram, readOnly, busy, autoRoute, state.actions, rerouteAfterRouteEdit],
  );
  /**
   * Diagrams that have already been told they are over the connector cap, so the
   * message is said ONCE rather than on every drag.
   *
   * A live mode that emitted a toast per drag would turn the failure-reporting
   * work into noise, which is the failure it exists to avoid. Keyed by diagram id
   * and cleared when the user re-enables the toggle by hand — the two
   * button-driven paths keep answering every press, because the user asked.
   */
  const overCapReportedRef = useRef<Set<string>>(new Set());

  const handleToggleAutoRoute = useCallback(() => {
    if (!activeDiagram) return;
    const next = !autoRoute;
    // Turning it back on by hand is the user overriding the self-disable, so the
    // latch resets and the board may say its piece again.
    if (next) overCapReportedRef.current.delete(activeDiagram.id);
    state.actions.setAutoRoute(next);
  }, [activeDiagram, autoRoute, state.actions]);

  /**
   * The whole diagram's stored routes still predate provenance, so live mode has
   * nothing it is allowed to move — every one of them backfilled to `manual`.
   * Worth saying out loud: otherwise the first person to try the toggle on a real
   * board drags a node, watches nothing happen, and concludes it is broken.
   */
  const needsReclassifying =
    autoRoute &&
    edgeRoutesOf(activeDiagram).length > 0 &&
    edgeRoutesOf(activeDiagram).every((r) => routeSource(r) === 'manual');

  const autoRouteNote = overCapReportedRef.current.has(activeDiagram?.id ?? '')
    ? t('note.overCap')
    : needsReclassifying
      ? t('note.reclassify')
      : undefined;

  // Re-route the WHOLE board shortly after anything moved, folded into the undo
  // step that moved it — see `useLiveRouting` for the rules and the reasons.
  useLiveRouting({
    autoRoute,
    readOnly,
    geometryVersion,
    activeDiagram,
    state,
    busy: busy !== undefined,
    reportSkippedTiers,
    overCapReportedRef,
  });

  /**
   * The theme the picture is made in. The board is rendered under it for as
   * long as the dialog is open, which is what lets a dark window export a
   * light sheet: every token the nodes and lines draw with comes off the theme
   * they are rendered in, so there is nothing to translate afterwards. The
   * same shape as the host's own (`createTheme({ palette: { mode } })`).
   */
  const exportMode = exportOptions?.theme;
  const exportTheme = useMemo(
    () => (exportMode && exportMode !== theme.palette.mode
      ? createTheme({ palette: { mode: exportMode } })
      : theme),
    [exportMode, theme],
  );

  /** The region the export captures: the whole board, and on a landscape the sheet itself. */
  const exportBounds = useCallback((): Rect => {
    const nodesBounds = getNodesBounds(getNodes());
    return activeDiagram?.kind === 'layer7'
      ? (unionRects([canvasRect(activeDiagram.geometry), nodesBounds]) as Rect)
      : nodesBounds;
  }, [activeDiagram, getNodes]);

  /** The strip along the bottom, or nothing when the picture goes without one. */
  const titleBlockFor = useCallback((options: ExportOptions) => {
    if (!activeDiagram || !options.titleBlock) return undefined;
    return {
      // The title block follows the UI language: it is a caption on a picture
      // for a reader, not a field name in a file format.
      labels: {
        client: t('export.client'),
        title: t('export.title'),
        author: t('export.author'),
        date: t('export.date'),
        legend: t('export.aspects'),
      },
      // The diagram's own answer wins over the host's. The host supplies a
      // default — what it knows about the project as a whole — and somebody
      // who opened this diagram's settings and typed a client was correcting
      // exactly that default.
      client:
        activeDiagram.client
        ?? props.exportTitleBlock?.client
        ?? state.model.name,
      // A board dated for a day that is not today says so on the picture. An
      // exported PNG travels without the app around it, and a future landscape
      // that does not announce itself is read as the present one (ADR-0009).
      title: activeDiagram.asOf
        ? `${state.model.name} — ${activeDiagram.name} · ${t('export.asOf', { date: activeDiagram.asOf })}`
        : `${state.model.name} — ${activeDiagram.name}`,
      author: activeDiagram.author ?? props.exportTitleBlock?.author,
      // Absent = the day of export, which is the exporter's own default.
      date: activeDiagram.documentDate || undefined,
      legend: options.legend ? exportLegendFor(activeDiagram, exportTheme, showLifecycle, t) : undefined,
      // A container diagram's corner, which takes the title's place.
      c4: c4PanelFor(state.model, activeDiagram, t, language),
    };
  }, [activeDiagram, props.exportTitleBlock, state.model, t, language, exportTheme, showLifecycle]);

  /**
   * The picture, at a ratio: the export's own when none is named, a small one
   * for the preview. One function for both, so the preview cannot show a
   * picture the export would not make.
   */
  const renderExport = useCallback(async (options: ExportOptions, pixelRatio?: number) => {
    const container = wrapperRef.current;
    if (!container || !activeDiagram) return undefined;
    return exportDiagramPng({
      container,
      bounds: exportBounds(),
      pixelRatio,
      background: exportTheme.palette.background.default,
      palette: getExportTokens(exportTheme),
      onImagesMissing: props.logos?.onExportImagesMissing,
      titleBlock: titleBlockFor(options),
    });
  }, [activeDiagram, exportBounds, exportTheme, props.logos?.onExportImagesMissing, titleBlockFor]);
  // Read through a ref by the preview effect, so the preview is drawn again
  // when a CHOICE changes and not whenever a parent happens to render: the
  // host hands over a fresh `exportTitleBlock` object every time it does.
  const renderExportRef = useRef(renderExport);
  renderExportRef.current = renderExport;

  /** What the bitmap will measure, told to the dialog before it is made. */
  const exportSize = useMemo(
    () => (exportOptions
      ? exportBitmapSize(exportBounds(), 48, undefined, exportFooterHeight(titleBlockFor(exportOptions)))
      : undefined),
    [exportOptions, exportBounds, titleBlockFor],
  );

  const openExport = useCallback(() => {
    if (!activeDiagram || exporting) return;
    setExportOptions({
      theme: theme.palette.mode,
      showLabels: showEdgeLabels,
      titleBlock: activeDiagram.showTitleBlock !== false,
      legend: true,
    });
  }, [activeDiagram, exporting, theme.palette.mode, showEdgeLabels]);

  const closeExport = useCallback(() => {
    setExportOptions(undefined);
    setExportPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return undefined;
    });
  }, []);

  /**
   * The preview, drawn again whenever a choice changes. It waits a beat for
   * the board to be rendered under the new choice — the theme is a re-render,
   * every element mounting is a bigger one — and then a paint, because the
   * capture reads the DOM. A choice made while one is drawing cancels it: the
   * picture arriving late would be of the wrong choice.
   */
  useEffect(() => {
    if (!exportOptions) return;
    // No object URLs is a test runtime; the dialog then shows its waiting line
    // and everything else about it still works.
    if (typeof URL.createObjectURL !== 'function') return;
    let live = true;
    setPreviewBusy(true);
    const timer = setTimeout(() => {
      void (async () => {
        await painted();
        if (!live) return;
        const bounds = exportBounds();
        const longEdge = Math.max(bounds.width, bounds.height, 1);
        const blob = await renderExportRef.current(exportOptions, Math.min(1, PREVIEW_LONG_EDGE / longEdge));
        if (!live || !blob) return;
        setExportPreview((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
      })().catch((error: unknown) => {
        reportLayoutError(t('error.export'), error);
      }).finally(() => {
        if (live) setPreviewBusy(false);
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [exportOptions, exportBounds, reportLayoutError, t]);

  /**
   * The export itself, from the dialog. Rasterising a large board takes
   * seconds; the dialog's button spins and its options hold still meanwhile.
   * `finally` frees it either way — a failed export that left the dialog
   * locked would be worse than the failure.
   */
  const confirmExport = useCallback(() => {
    if (!exportOptions || !activeDiagram) return;
    const diagram = activeDiagram;
    setExporting(true);
    void (async () => {
      await painted();
      const blob = await renderExportRef.current(exportOptions);
      // The editor can be gone by the time that frame arrives — a diagram
      // switched, a project closed, a window shut. Nothing to hand over.
      if (!blob) return;
      downloadBlob(blob, pngFilename(props.exportTitleBlock?.client ?? state.model.name, diagram));
      closeExport();
    })().catch((error: unknown) => {
      reportLayoutError(t('error.export'), error);
    }).finally(() => {
      setExporting(false);
    });
  }, [exportOptions, activeDiagram, state.model.name, props.exportTitleBlock, closeExport, reportLayoutError, t]);

  /**
   * The board as pixels for a host — an agent asking through the shell
   * (ADR-0007). The export's capture without its download, its title block
   * or its size question: the host chose the region and the ratio, and the
   * budget is its. A hidden window cannot paint, and `html-to-image` waits on
   * a frame that never comes; saying so is the difference between a refusal
   * and a hang.
   */
  const captureBoard = useCallback(async (options: { bounds: Rect; pixelRatio: number; padding: number }) => {
    if (!wrapperRef.current || !activeDiagram) throw new EditorRefused('gone');
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') throw new EditorRefused('hidden');
    setCapturing(true);
    try {
      await painted();
      const container = wrapperRef.current;
      if (!container) throw new EditorRefused('gone');
      return await exportDiagramPng({
        container,
        bounds: options.bounds,
        pixelRatio: options.pixelRatio,
        padding: options.padding,
        background: theme.palette.background.default,
        onImagesMissing: props.logos?.onExportImagesMissing,
      });
    } finally {
      setCapturing(false);
    }
  }, [activeDiagram, theme, props.logos?.onExportImagesMissing]);

  /**
   * The handle, handed out whenever what it closes over changes and withdrawn
   * on unmount. `busy` is read at call time through the closure, so a pass
   * asked for while another runs is refused rather than silently dropped the
   * way the button's second press is.
   */
  const onHandle = props.onHandle;
  useEffect(() => {
    if (!onHandle) return;
    const handle: EditorHandle = {
      activeDiagramId: activeDiagram?.id,
      busy: busy !== undefined,
      tidy: () => (busy ? Promise.reject(new EditorRefused('busy')) : handleTidy(undefined, true)),
      routeEdges: () => (busy ? Promise.reject(new EditorRefused('busy')) : handleRouteEdges()),
      capture: captureBoard,
    };
    onHandle(handle);
    return () => onHandle(undefined);
  }, [onHandle, activeDiagram?.id, busy, handleTidy, handleRouteEdges, captureBoard]);

  const handleDoubleClick = useCallback(
    (elementId: ElementId) => {
      const element = state.model.elements.find((e) => e.id === elementId);
      if (!element) return;
      // Double-click opens what is inside: an application's container diagram,
      // and for everything else its documentation.
      if (element.kind !== 'application') {
        openDocumentation(elementId);
        return;
      }
      const existing = state.model.diagrams.find(
        (d) => d.kind === 'container' && d.applicationElementId === elementId,
      );
      if (existing) props.document.onActiveDiagramChange(existing.id);
      else props.diagrams.onCreateContainer(elementId);
    },
    [state.model, props, openDocumentation],
  );

  // ONE owner of canvas keys (DK4): the declarative keymap-driven hook replaces
  // the former ad-hoc handler (Escape / Cmd-C·V / Delete). It bails inside text
  // inputs, drives copy/paste/cut/duplicate/nudge/select-all through the same
  // batched actions, and calls the view actions from useReactFlow(). Delete
  // still routes through the confirm dialog via onRequestDeleteElement, and
  // React Flow's own Delete stays off (deleteKeyCode={null} on DiagramCanvas).
  const setShortcutContainer = useCanvasShortcuts({
    readOnly,
    model: state.model,
    diagram: activeDiagram,
    selection: state.selection,
    selectedElement: state.selectedElement,
    selectedConnection: state.selectedConnection,
    actions: state.actions,
    undo: state.undo,
    redo: state.redo,
    setSelection: state.setSelection,
    clipboardRef,
    pasteCountRef,
    onForceSave: props.onForceSave,
    onShowHelp: () => setHelpOpen(true),
    onRequestDeleteElement: setDeleteTarget,
    onRequestDeleteConnection: requestDeleteConnection,
    onRequestDeleteSelection: requestDeleteSelection,
    onOpenContextMenu: () => requestMenu('open'),
    onRequestRename: () => requestMenu('rename'),
    onOpenSearch: () => setSearchOpen(true),
    onOpenDocumentation: openDocumentation,
  });

  // Attach both the wrapper ref (used by the PNG export) and the shortcut hook's
  // callback ref to the same node, so the listener (re)binds whenever the
  // wrapper mounts — it only renders once activeDiagram resolves.
  const setWrapperNode = useCallback(
    (node: HTMLDivElement | null) => {
      wrapperRef.current = node;
      setShortcutContainer(node);
    },
    [setShortcutContainer],
  );

  // An element deleted (or undone out of existence) while its page is open
  // simply has no page any more.
  const documentationDiagram = (documentationDiagramId !== undefined
    ? state.model.diagrams.find((d) => d.id === documentationDiagramId)
    : undefined) ?? activeDiagram;
  const documentationElement = documentationId
    ? state.model.elements.find((e) => e.id === documentationId)
    : undefined;

  /**
   * The page, built before the early return below: a scope with no board —
   * an organisation, whose views are a sheet and a map — has no canvas to
   * draw, but its capabilities and stakeholders have pages, and the sheet's
   * *Details ›* is the way to them. The view the page lists neighbours of is
   * the one the host named, failing that the board.
   */
  const documentationPage = documentationElement && documentationDiagram && (
        <DocumentationPage
          key={documentationElement.id}
          element={documentationElement}
          model={state.model}
          scopeLabel={props.exportTitleBlock?.client}
          diagram={documentationDiagram}
          readOnly={readOnly}
          actions={state.actions}
          renderMarkdown={props.renderMarkdown}
          onAddImage={readOnly ? undefined : props.onAddImage}
          images={readOnly ? undefined : props.images}
          renderInspector={(element, { readOnly: inspectorReadOnly }) => (
            <ElementInspector
              element={element}
              model={state.model}
              diagram={documentationDiagram}
              readOnly={inspectorReadOnly}
              actions={state.actions}
              onRequestDelete={() => {
                setDocumentationId(undefined);
                setDeleteTarget(element.id);
              }}
              renderMarkdown={props.renderMarkdown}
              onRequestLogoUpload={readOnly ? undefined : props.logos?.onRequestUpload}
              onReplace={readOnly ? undefined : props.plans?.onReplace}
              owned={props.ownership?.ownerOf(element.id)}
              move={moveFor(props.ownership, element.id)}
              layout="stacked"
              hideDescription
            />
          )}
          plans={props.plans ? { list: props.plans.list, onOpen: props.plans.onOpen } : undefined}
          fieldsWidth={{ value: documentationFieldsWidth, onChange: setDocumentationFieldsWidth }}
          onNavigate={openDocumentation}
          onClose={() => { setDocumentationId(undefined); setDocumentationDiagramId(undefined); }}
          onRequestDelete={() => {
            setDocumentationId(undefined);
            setDocumentationDiagramId(undefined);
            setDeleteTarget(documentationElement.id);
          }}
          onRequestLogoUpload={props.logos?.onRequestUpload}
          onOpenHistory={props.history?.onDescription
            ? () => props.history?.onDescription?.(documentationElement.id)
            : undefined}
          windowChrome={props.windowChrome}
        />
  );

  if (!activeDiagram) {
    return (
      <>
        <Box sx={{ p: 3 }}>
          <Typography color="text.secondary">{t('error.diagramNotFound')}</Typography>
        </Box>
        {documentationPage}
      </>
    );
  }

  const deleteElement = deleteTarget
    ? state.model.elements.find((e) => e.id === deleteTarget)
    : undefined;

  return (
    <Box
      ref={setWrapperNode}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <EditorToolbar
        model={state.model}
        activeDiagram={activeDiagram}
        readOnly={readOnly}
        busy={busy}
        onActiveDiagramChange={props.document.onActiveDiagramChange}
        onCreateLayer7Diagram={props.diagrams.onCreateLayer7}
        onOpenSheet={props.diagrams.onOpenSheet}
        onCreateSheet={props.diagrams.onCreateSheet}
        onOpenMap={props.diagrams.onOpenMap}
        onCreateMap={props.diagrams.onCreateMap}
        // Caught, not `void`ed: `handleTidy` rethrows so the unattended caller in
        // `useAutoLayout` can tell "laid out" from "did not", and `void` discards the
        // value without attaching a rejection handler — so a failed Tidy reported its
        // toast AND went to the console as an unhandled rejection. The button has
        // already been told; there is nothing further to do with the error here.
        onTidy={() => void handleTidy().catch(() => {})}
        onCancelTidy={canCancelElkLayout() ? cancelElkLayout : undefined}
        tidyOptions={tidyOptions}
        onTidyOptionsChange={setTidyOptions}
        onRouteEdges={() => void handleRouteEdges()}
        autoRoute={autoRoute}
        onToggleAutoRoute={handleToggleAutoRoute}
        autoRouteNote={autoRouteNote}
        onFitView={() => fitView({ padding: 0.1, duration: 300 })}
        onExport={openExport}
        exportBusy={exporting}
        onOpenHelp={() => setHelpOpen(true)}
        showLifecycle={showLifecycle}
        onToggleLifecycle={() => setShowLifecycle((on) => !on)}
        asOf={activeDiagram.asOf}
        onAsOfChange={state.actions.setAsOf}
        onUndo={state.undo}
        onRedo={state.redo}
        canUndo={state.canUndo}
        canRedo={state.canRedo}
        onRenameDiagram={
          props.diagrams.onRename ? (id, name) => setRenameDiagramTarget({ id, name }) : undefined
        }
        onOpenDiagramSettings={
          props.diagrams.onSettingsChange ? (id) => setSettingsDiagramId(id) : undefined
        }
        onDuplicateDiagram={props.diagrams.onDuplicate}
        onDeleteDiagram={props.diagrams.onDelete}
        onDiagramHistory={props.history?.onDiagram}
        onOpenSearch={() => setSearchOpen(true)}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap((on) => !on)}
        showEdgeLabels={showEdgeLabels}
        onToggleEdgeLabels={() => setShowEdgeLabels((on) => !on)}
        onLanguageChange={props.language?.onChange}
      />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {!readOnly && (
          <ElementPalette
            kinds={activeDiagram.kind === 'layer7' ? LAYER7_PALETTE : CONTAINER_PALETTE}
            onAdd={handlePaletteAdd}
            onAddDomainGroup={activeDiagram.kind === 'layer7' ? addDomainGroup : undefined}
            logoLibrary={props.logos?.library}
            onRequestLogoUpload={props.logos?.onRequestUpload}
            defaultNames={defaultNames}
            collapsed={paletteCollapsed}
            onToggleCollapsed={() => setPaletteCollapsed((on) => !on)}
            width={paletteWidth}
          />
        )}
        {/* The seam only exists while the panel is open: a rail is a fixed
            48 px of chevron, and a resize handle on it would promise a width
            you cannot have. */}
        {!readOnly && !paletteCollapsed && (
          <PanelResizer
            kind="palette"
            side="left"
            width={paletteWidth}
            onWidth={setPaletteWidth}
            label={t('palette.resize')}
          />
        )}
        {/* The board under the export's theme while the dialog is open, and
            its own the rest of the time. Nested on purpose: the palette and
            the inspector stay in the window's theme, the picture does not. */}
        <ThemeProvider theme={exportTheme}>
        <CanvasForDiagram
          diagram={activeDiagram}
          state={state}
          readOnly={readOnly}
          autoRoute={autoRoute}
          snapToGrid={snapToGrid}
          onToggleSnapToGrid={() => setSnapToGrid((on) => !on)}
          showGrid={showGrid}
          onToggleShowGrid={() => setShowGrid((on) => !on)}
          showLifecycle={showLifecycle}
          noteFor={props.ownership?.noteFor}
          showMinimap={showMinimap}
          showEdgeLabels={exportOptions ? exportOptions.showLabels : showEdgeLabels}
          mountEveryElement={capturing || exportOptions !== undefined}
          onElementDoubleClick={handleDoubleClick}
          onOpenDocumentation={openDocumentation}
          onTidyGroup={readOnly ? undefined : (name) => void handleTidyGroup(name)}
          groupTidyOptions={groupTidyOptions}
          onGroupTidyOptionsChange={readOnly ? undefined : setGroupTidyOptions}
          onTidy={readOnly ? undefined : () => void handleTidy().catch(() => {})}
          onRouteConnections={readOnly ? undefined : () => void handleRouteEdges()}
          onRouteConnectionsAll={readOnly ? undefined : () => void handleRouteEdgesAll()}
          onResetRoute={readOnly ? undefined : (id) => void handleResetRoute(id)}
          onSetRouteSides={readOnly ? undefined : (id, sides) => void handleSetRouteSides(id, sides)}
          layoutBusy={busy !== undefined}
          clipboardRef={clipboardRef}
          pasteCountRef={pasteCountRef}
          onRequestRename={requestRename}
          onRequestDeleteElement={setDeleteTarget}
          onRequestDeleteConnection={requestDeleteConnection}
          onRequestDeleteSelection={requestDeleteSelection}
          menuRequest={menuRequest}
        />
        </ThemeProvider>
        {!inspectorCollapsed && (
          <PanelResizer
            kind="inspector"
            side="right"
            width={inspectorWidth}
            onWidth={setInspectorWidth}
            label={t('inspector.resize')}
          />
        )}
        <InspectorPanel
          collapsed={inspectorCollapsed}
          onToggleCollapsed={() => setInspectorCollapsed((on) => !on)}
          width={inspectorWidth}
        >
          {state.selectedElement ? (
            <ElementInspector
              element={state.selectedElement}
              model={state.model}
              diagram={activeDiagram}
              readOnly={readOnly}
              actions={state.actions}
              onRequestDelete={() => setDeleteTarget(state.selectedElement?.id)}
              renderMarkdown={props.renderMarkdown}
              renameRequest={renameRequest}
              onRequestLogoUpload={readOnly ? undefined : props.logos?.onRequestUpload}
              onOpenDocumentation={openDocumentation}
              onReplace={readOnly ? undefined : props.plans?.onReplace}
              owned={props.ownership?.ownerOf(state.selectedElement.id)}
              move={moveFor(props.ownership, state.selectedElement.id)}
            />
          ) : state.selectedConnection ? (
            <ConnectionInspector
              connection={state.selectedConnection}
              model={state.model}
              diagram={activeDiagram}
              readOnly={readOnly}
              actions={state.actions}
              onResetRoute={readOnly ? undefined : (id) => void handleResetRoute(id)}
              onSetRouteSides={readOnly ? undefined : (id, sides) => void handleSetRouteSides(id, sides)}
              onRequestDelete={readOnly ? undefined : requestDeleteConnection}
            />
          ) : state.selectedDomainGroup ? (
            <DomainGroupInspector
              name={state.selectedDomainGroup}
              diagram={activeDiagram}
              readOnly={readOnly}
              actions={state.actions}
              onTidy={readOnly ? undefined : (name) => void handleTidyGroup(name)}
              // The same state the canvas's right-click popover edits, so both
              // entry points offer — and remember — one set of group settings.
              tidyOptions={groupTidyOptions}
              onTidyOptionsChange={readOnly ? undefined : setGroupTidyOptions}
            />
          ) : selectionCount(state.selection) > 0 ? (
            <MultiSelectionInspector
              selection={state.selection}
              diagram={activeDiagram}
              readOnly={readOnly}
              actions={state.actions}
              onRequestLogoUpload={readOnly ? undefined : props.logos?.onRequestUpload}
            />
          ) : (
            <InspectorEmptyState />
          )}
        </InspectorPanel>
      </Box>
      {deleteElement && (
        <DeleteElementDialog
          element={deleteElement}
          isBoundaryApplication={
            activeDiagram.kind === 'container' &&
            activeDiagram.applicationElementId === deleteElement.id
          }
          hasComponents={state.model.elements.some(
            (e) => e.parentId === deleteElement.id,
          )}
          onRemoveFromDiagram={() => {
            state.actions.removeFromDiagram(deleteElement.id);
            setDeleteTarget(undefined);
          }}
          onDeleteFromModel={() => {
            state.actions.deleteFromModel(deleteElement.id);
            setDeleteTarget(undefined);
          }}
          onClose={() => setDeleteTarget(undefined)}
        />
      )}
      {confirmDelete && (
        <ConfirmDeleteDialog
          summary={confirmDelete.summary}
          subject={confirmDelete.subject}
          onConfirm={() => {
            confirmDelete.run();
            setConfirmDelete(undefined);
          }}
          onClose={() => setConfirmDelete(undefined)}
        />
      )}
      <ShortcutsHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      {exportOptions && exportSize && (
        <ExportDialog
          open
          options={exportOptions}
          onChange={setExportOptions}
          preview={exportPreview}
          previewBusy={previewBusy}
          size={exportSize}
          exporting={exporting}
          onExport={confirmExport}
          onClose={closeExport}
        />
      )}
      {documentationPage}
      <ElementSearchDialog
        open={searchOpen}
        model={state.model}
        activeDiagramId={props.document.activeDiagramId}
        onClose={() => setSearchOpen(false)}
        onFocus={requestFocus}
      />
      {props.diagrams.onRename && (
        <RenameDiagramDialog
          target={renameDiagramTarget}
          onRename={props.diagrams.onRename}
          onClose={() => setRenameDiagramTarget(undefined)}
        />
      )}
      {props.diagrams.onSettingsChange && (
        <DiagramSettingsDialog
          target={state.model.diagrams.find((d) => d.id === settingsDiagramId)}
          defaultClient={props.exportTitleBlock?.client ?? state.model.name}
          onSave={props.diagrams.onSettingsChange}
          onClose={() => setSettingsDiagramId(undefined)}
        />
      )}
    </Box>
  );
}

/**
 * Resolves once the browser has laid out and painted whatever render is
 * pending.
 *
 * Two frames rather than one: the first fires before the pending render has
 * been committed to the screen, the second after. Anything that reads the DOM
 * expecting to see a state change it just requested has to wait for the second
 * one. Falls back to a task where there are no frames at all, which is a test
 * environment rather than a browser.
 */
/**
 * The key under the strip, in the export's own colours: the maturity columns
 * and what the badge colours mean on a landscape, the lifecycle colours on
 * any board that draws them. A board with nothing to explain gets no key.
 */
/**
 * The *Move…* button for one record, or nothing (ADR-0012 §10).
 *
 * Asked per element rather than handed down as a prop, because whether there
 * is anywhere to move a record to is a question about the tree and the tree
 * changes under a live session. The words are the host's; the editor only
 * decides where the button goes.
 */
function moveFor(
  ownership: SolutionDesignEditorProps['ownership'],
  elementId: ElementId,
): { label: string; tip: string; onMove(): void } | undefined {
  const gestures = ownership?.gestures
  if (!gestures?.offered(elementId)) return undefined
  return {
    label: gestures.label,
    tip: gestures.tip,
    onMove: () => gestures.onMove(elementId),
  }
}

function exportLegendFor(
  diagram: DesignDiagram,
  theme: Theme,
  showLifecycle: boolean,
  t: Translate,
): ExportLegend | undefined {
  const tokens = getNodeTokens(theme);
  const legend: ExportLegend = {
    labels: { aspects: t('export.aspects'), lifecycle: t('export.lifecycle') },
  };
  if (diagram.kind === 'layer7' && diagram.showAspects !== false && aspectConfigFor(diagram).length > 0) {
    legend.aspects = aspectConfigFor(diagram).map((entry) => entry.label).join(' · ');
    legend.statuses = ASPECT_LEGEND.map(([status, key]) => ({ label: t(key), token: tokens.aspects[status] }));
  }
  if (showLifecycle) {
    legend.lifecycle = LIFECYCLE_LEGEND.map(([stage, key]) => ({ label: t(key), token: tokens.lifecycle[stage] }));
  }
  return legend.statuses || legend.lifecycle ? legend : undefined;
}

const ASPECT_LEGEND: [AspectStatus, StringKey][] = [
  ['managed', 'aspect.managed'], ['partial', 'aspect.partial'], ['atRisk', 'aspect.atRisk'], ['none', 'aspect.none'],
];
const LIFECYCLE_LEGEND: [Lifecycle, StringKey][] = [
  ['planned', 'lifecycle.planned'], ['live', 'lifecycle.live'],
  ['retiring', 'lifecycle.retiring'], ['retired', 'lifecycle.retired'],
];

/**
 * The preview's long edge, in image pixels. Enough to judge a sheet, and a
 * fraction of the export's cost: the ratio is what every dimension multiplies
 * by, so a thousand-pixel preview of a six-thousand-pixel sheet is one
 * thirty-sixth of the work.
 */
const PREVIEW_LONG_EDGE = 1000;
/** How long a choice has to hold before the preview is drawn again. */
const PREVIEW_DEBOUNCE_MS = 150;

function painted(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function CanvasForDiagram({
  diagram,
  state,
  readOnly,
  autoRoute,
  snapToGrid,
  onToggleSnapToGrid,
  showGrid,
  onToggleShowGrid,
  showLifecycle,
  noteFor,
  showMinimap,
  showEdgeLabels,
  mountEveryElement,
  onElementDoubleClick,
  onOpenDocumentation,
  onTidyGroup,
  groupTidyOptions,
  onGroupTidyOptionsChange,
  onTidy,
  onRouteConnections,
  onRouteConnectionsAll,
  onResetRoute,
  onSetRouteSides,
  layoutBusy,
  clipboardRef,
  pasteCountRef,
  onRequestRename,
  onRequestDeleteElement,
  onRequestDeleteConnection,
  onRequestDeleteSelection,
  menuRequest,
}: {
  diagram: DesignDiagram;
  state: ReturnType<typeof useEditorState>;
  readOnly: boolean;
  /** Live auto-routing — drives the canvas's waypoint-free drag preview only. */
  autoRoute: boolean;
  snapToGrid: boolean;
  onToggleSnapToGrid(): void;
  showGrid: boolean;
  onToggleShowGrid(): void;
  showLifecycle: boolean;
  /** See `EditorOwnership.noteFor` (ADR-0012 §3). Absent = no scope tree. */
  noteFor?(elementId: ElementId): StandInNote | undefined;
  showMinimap: boolean;
  showEdgeLabels: boolean;
  /** See `DiagramCanvasProps.mountEveryElement`: true while a PNG is captured. */
  mountEveryElement: boolean;
  onElementDoubleClick(elementId: ElementId): void;
  onOpenDocumentation(elementId: ElementId): void;
  /** Layer 7 only — undefined in read-only mode. */
  onTidyGroup?(name: string): void;
  groupTidyOptions: TidyOptions;
  onGroupTidyOptionsChange?(options: TidyOptions): void;
  /** Context-menu plumbing (see DiagramCanvasProps); all undefined in read-only mode. */
  onTidy?(): void;
  onRouteConnections?(): void;
  onRouteConnectionsAll?(): void;
  onResetRoute?(connectionId: string): void;
  onSetRouteSides?(connectionId: string, sides: AttachSidesPatch): void;
  layoutBusy: boolean;
  clipboardRef: RefObject<ClipboardPayload | null>;
  pasteCountRef: RefObject<number>;
  onRequestRename(elementId: ElementId): void;
  onRequestDeleteElement(elementId: ElementId): void;
  onRequestDeleteConnection(connectionId: string): void;
  onRequestDeleteSelection(selection: Selection): void;
  menuRequest?: { kind: 'open' | 'rename'; nonce: number };
}) {
  const shared = {
    model: state.model,
    diagram,
    readOnly,
    autoRoute,
    selection: state.selection,
    onSelectionChange: state.setSelection,
    actions: state.actions,
    snapToGrid,
    onToggleSnapToGrid,
    showGrid,
    onToggleShowGrid,
    showLifecycle,
    noteFor,
    showMinimap,
    showEdgeLabels,
    mountEveryElement,
    onElementDoubleClick,
    onOpenDocumentation,
    onTidy,
    onRouteConnections,
    onRouteConnectionsAll,
    onResetRoute,
    onSetRouteSides,
    layoutBusy,
    clipboardRef,
    pasteCountRef,
    onRequestRename,
    onRequestDeleteElement,
    onRequestDeleteConnection,
    onRequestDeleteSelection,
    menuRequest,
  };
  return diagram.kind === 'layer7' ? (
    <Layer7Canvas
      {...shared}
      onTidyGroup={onTidyGroup}
      groupTidyOptions={groupTidyOptions}
      onGroupTidyOptionsChange={onGroupTidyOptionsChange}
    />
  ) : (
    <ContainerCanvas {...shared} />
  );
}

function pngFilename(client: string, diagram: DesignDiagram): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `${slug(client) || 'design'}-${slug(diagram.name) || 'diagram'}.png`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
