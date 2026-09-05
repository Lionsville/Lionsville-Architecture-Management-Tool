import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type RefObject } from 'react';
import { getNodesBounds, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type {
  DesignDiagram,
  ElementId,
  ElementKind,
  Rect,
  SolutionDesignEditorProps,
  UploadedLogo,
} from '../types';
import { ContainerCanvas } from '../canvas/ContainerCanvas';
import { Layer7Canvas } from '../canvas/Layer7Canvas';
import { ElementPalette, type DomainGroupSeed, type PaletteSeed } from '../canvas/ElementPalette';
import { newDomainGroupRect } from '../canvas/domainGroupPlacement';
import { CONTAINER_PALETTE, LAYER7_PALETTE } from '../canvas/paletteItems';
import { LogoLibraryProvider } from '../nodes/logoRegistry';
import { type ClipboardPayload } from '../model/clipboard';
import { exportDiagramPng } from '../export/exportPng';
import {
  tidyContainer,
  tidyGroup,
  tidyLayer7,
  type TidyOptions,
} from '../layout/tidy';
import { routeDiagramEdges } from '../layout/routeOnly';
import {
  manualRouteIds,
  routeFor,
  routeSource,
  routeWithSides,
  withRouteRow,
  type AttachSidesPatch,
} from '../model/routes';
import { MAX_CONNECTORS_PER_TIER, type SkippedTier } from '../layout/libavoidRouter';
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
} from '../model/preferences';
import { canvasRect } from '../model/zones';
import { unionRects } from '../model/placement';
import { LanguageProvider, useStrings } from '../i18n/LanguageContext';
import { ElementSearchDialog } from './ElementSearchDialog';
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
import { DocumentationPage } from './DocumentationPage';
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
      <LanguageProvider language={props.language ?? 'en'}>
        {/* The uploaded logo library reaches nodes through context rather than
            through every node's props: a mark is decoration on an element that
            otherwise knows nothing about where marks come from. */}
        <LogoLibraryProvider value={props.logoLibrary ?? EMPTY_LOGO_LIBRARY}>
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
  const { t } = useStrings();
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
   * The view settings, seeded from the host and reported back on every change.
   *
   * Read ONCE, in the state initialiser: these are preferences, not a controlled
   * value. A host that persists them writes on `onPreferencesChange` and hands
   * the same object back on the next mount, and re-reading the prop would make
   * that round trip fight whatever the user just clicked.
   */
  const initialPreferences = useState(() => mergePreferences(props.initialPreferences))[0];
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
  // ⌘F. The dialog owns its own query; this is only whether it is up.
  const [searchOpen, setSearchOpen] = useState(false);
  /** The element whose documentation page is open; session state, never saved. */
  const [documentationId, setDocumentationId] = useState<ElementId | undefined>(undefined);
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
   * The host request already adopted. It starts EMPTY, not at `props.focusElement`:
   * an editor mounted with a focus request already on the prop (a host that opens
   * the editor straight onto an element from its coverage drawer) would otherwise
   * see `seen === hostFocus` on the very first effect run and drop the request in
   * silence — the one case the pre-4B code, which passed the prop through to
   * `useFocusElement`, handled without thinking about it.
   */
  const hostFocusRef = useRef<SolutionDesignEditorProps['focusElement']>(undefined);
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

  const readOnly = props.readOnly ?? false;
  const activeDiagram = state.effectiveModel.diagrams.find((d) => d.id === props.activeDiagramId);

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
  const hostFocus = props.focusElement;
  useEffect(() => {
    const seen = hostFocusRef.current;
    if (!hostFocus) return;
    if (seen && seen.id === hostFocus.id && seen.nonce === hostFocus.nonce) return;
    hostFocusRef.current = hostFocus;
    focusNonce.current += 1;
    setFocusRequest({ id: hostFocus.id, nonce: focusNonce.current });
  }, [hostFocus]);

  useFocusElement({
    focusElement: focusRequest,
    model: state.effectiveModel,
    activeDiagramId: props.activeDiagramId,
    setSelection: state.setSelection,
    onActiveDiagramChange: props.onActiveDiagramChange,
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
  const { onPreferencesChange } = props;
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
      const connection = state.effectiveModel.connections.find((c) => c.id === connectionId);
      const summary = deletionSummary(state.effectiveModel, {
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
    [readOnly, state.effectiveModel, state.actions],
  );

  const requestDeleteSelection = useCallback(
    (selection: Selection) => {
      if (readOnly) return;
      const summary = deletionSummary(state.effectiveModel, selection);
      if (!needsDeleteConfirmation(summary)) {
        state.actions.deleteSelection(selection);
        return;
      }
      setConfirmDelete({ summary, run: () => state.actions.deleteSelection(selection) });
    },
    [readOnly, state.effectiveModel, state.actions],
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
      state.actions.upsertDomainGroup(
        newDomainGroupRect({ layoutConfig: activeDiagram?.layoutConfig, translate: t, ...seed }),
      );
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
      props.onLayoutError?.(message);
    },
    [props.onLayoutError],
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
          ? await tidyLayer7(state.effectiveModel, activeDiagram, options)
          : await tidyContainer(state.effectiveModel, activeDiagram, options);
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
    state.effectiveModel,
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
    requested: props.layoutOnOpenDiagramIds,
    options: tidyOptions,
    run: (override) => handleTidy(override, true),
    onSettled: props.onLayoutSettled,
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
          state.effectiveModel,
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
        reportLayoutError(t('error.tidyGroupFailed'), error);
      } finally {
        setBusy(undefined);
      }
    },
    [
      activeDiagram,
      busy,
      state.effectiveModel,
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
          state.effectiveModel,
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
      state.effectiveModel,
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
   * row filtered out), because `state.effectiveModel` is still the render before
   * the commit: routing against it would find the old row in the preserve set
   * and hand it straight back.
   */
  const rerouteAfterRouteEdit = useCallback(
    async (token: CommitToken, diagram: DesignDiagram) => {
      setBusy('route');
      try {
        const result = await routeDiagramEdges(
          state.effectiveModel,
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
    [state.actions, state.effectiveModel, reportLayoutError, reportSkippedTiers, t],
  );
  const handleResetRoute = useCallback(
    async (connectionId: string) => {
      if (!activeDiagram || readOnly || busy) return;
      const token = state.actions.resetEdgeRoute(connectionId);
      if (autoRoute) return;
      await rerouteAfterRouteEdit(token, {
        ...activeDiagram,
        edgeRoutes: (activeDiagram.edgeRoutes ?? []).filter((r) => r.connectionId !== connectionId),
      });
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
      await rerouteAfterRouteEdit(token, {
        ...activeDiagram,
        edgeRoutes: withRouteRow(activeDiagram.edgeRoutes, row),
      });
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
    (activeDiagram?.edgeRoutes?.length ?? 0) > 0 &&
    (activeDiagram?.edgeRoutes ?? []).every((r) => routeSource(r) === 'manual');

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

  const handleExport = useCallback(async () => {
    if (!wrapperRef.current || !activeDiagram || exporting) return;
    setExporting(true);
    const nodesBounds = getNodesBounds(getNodes());
    const bounds: Rect =
      activeDiagram.kind === 'layer7'
        ? (unionRects([canvasRect(activeDiagram.layoutConfig), nodesBounds]) as Rect)
        : nodesBounds;
    const blob = await exportDiagramPng({
      container: wrapperRef.current,
      bounds,
      background: theme.palette.background.default,
      onImagesMissing: props.onExportImagesMissing,
      // A diagram that says it carries no title block gets none; `titleBlock`
      // has always been optional, so this needs nothing of the exporter.
      titleBlock: activeDiagram.showTitleBlock === false ? undefined : {
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
          ?? state.effectiveModel.customerName,
        title: `${state.effectiveModel.name} — ${activeDiagram.name}`,
        author: activeDiagram.author ?? props.exportTitleBlock?.author,
        // Absent = the day of export, which is the exporter's own default.
        date: activeDiagram.documentDate || undefined,
        // The legend lists this diagram's configured aspect columns so badge
        // codes stay readable on paper. A diagram with no columns gets no row.
        legend:
          activeDiagram.kind === 'layer7' && aspectConfigFor(activeDiagram).length > 0
            ? aspectConfigFor(activeDiagram)
                .map((entry) => entry.label)
                .join(' · ')
            : undefined,
      },
    });
    downloadBlob(blob, pngFilename(state.effectiveModel.customerName, activeDiagram));
  }, [activeDiagram, exporting, getNodes, props.exportTitleBlock, state.effectiveModel, theme, t]);

  /**
   * Rasterising a large board takes seconds; without a spinner the button looks
   * dead and gets pressed again. `finally` frees it either way — a failed export
   * that left the button disabled would be worse than the failure.
   */
  const runExport = useCallback(() => {
    void handleExport().catch((error: unknown) => {
      reportLayoutError(t('error.export'), error);
    }).finally(() => setExporting(false));
  }, [handleExport, reportLayoutError, t]);

  const handleDoubleClick = useCallback(
    (elementId: ElementId) => {
      const element = state.effectiveModel.elements.find((e) => e.id === elementId);
      if (!element) return;
      // Double-click opens what is inside: an application's container diagram,
      // and for everything else its documentation.
      if (element.kind !== 'application') {
        openDocumentation(elementId);
        return;
      }
      const existing = state.effectiveModel.diagrams.find(
        (d) => d.kind === 'container' && d.applicationElementId === elementId,
      );
      if (existing) props.onActiveDiagramChange(existing.id);
      else props.onCreateContainerDiagram(elementId);
    },
    [state.effectiveModel, props, openDocumentation],
  );

  // ONE owner of canvas keys (DK4): the declarative keymap-driven hook replaces
  // the former ad-hoc handler (Escape / Cmd-C·V / Delete). It bails inside text
  // inputs, drives copy/paste/cut/duplicate/nudge/select-all through the same
  // batched actions, and calls the view actions from useReactFlow(). Delete
  // still routes through the confirm dialog via onRequestDeleteElement, and
  // React Flow's own Delete stays off (deleteKeyCode={null} on DiagramCanvas).
  const setShortcutContainer = useCanvasShortcuts({
    readOnly,
    model: state.effectiveModel,
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

  if (!activeDiagram) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">{t('error.diagramNotFound')}</Typography>
      </Box>
    );
  }

  const deleteElement = deleteTarget
    ? state.effectiveModel.elements.find((e) => e.id === deleteTarget)
    : undefined;
  // An element deleted (or undone out of existence) while its page is open
  // simply has no page any more.
  const documentationElement = documentationId
    ? state.effectiveModel.elements.find((e) => e.id === documentationId)
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
        model={state.effectiveModel}
        activeDiagram={activeDiagram}
        readOnly={readOnly}
        busy={busy}
        onActiveDiagramChange={props.onActiveDiagramChange}
        onCreateLayer7Diagram={props.onCreateLayer7Diagram}
        // Caught, not `void`ed: `handleTidy` rethrows so the unattended caller in
        // `useAutoLayout` can tell "laid out" from "did not", and `void` discards the
        // value without attaching a rejection handler — so a failed Tidy reported its
        // toast AND went to the console as an unhandled rejection. The button has
        // already been told; there is nothing further to do with the error here.
        onTidy={() => void handleTidy().catch(() => {})}
        tidyOptions={tidyOptions}
        onTidyOptionsChange={setTidyOptions}
        onRouteEdges={() => void handleRouteEdges()}
        autoRoute={autoRoute}
        onToggleAutoRoute={handleToggleAutoRoute}
        autoRouteNote={autoRouteNote}
        onFitView={() => fitView({ padding: 0.1, duration: 300 })}
        onExport={runExport}
        exportBusy={exporting}
        onOpenHelp={() => setHelpOpen(true)}
        showLifecycle={showLifecycle}
        onToggleLifecycle={() => setShowLifecycle((on) => !on)}
        onUndo={state.undo}
        onRedo={state.redo}
        canUndo={state.canUndo}
        canRedo={state.canRedo}
        onOpenFullscreen={props.onOpenFullscreen}
        extras={props.renderDesignPanelExtras?.()}
        onRenameDiagram={
          props.onRenameDiagram ? (id, name) => setRenameDiagramTarget({ id, name }) : undefined
        }
        onOpenDiagramSettings={
          props.onDiagramSettingsChange ? (id) => setSettingsDiagramId(id) : undefined
        }
        onDuplicateDiagram={props.onDuplicateDiagram}
        onDeleteDiagram={props.onDeleteDiagram}
        onOpenSearch={() => setSearchOpen(true)}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap((on) => !on)}
        onLanguageChange={props.onLanguageChange}
      />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {!readOnly && (
          <ElementPalette
            kinds={activeDiagram.kind === 'layer7' ? LAYER7_PALETTE : CONTAINER_PALETTE}
            onAdd={handlePaletteAdd}
            onAddDomainGroup={activeDiagram.kind === 'layer7' ? addDomainGroup : undefined}
            logoLibrary={props.logoLibrary}
            onRequestLogoUpload={props.onRequestLogoUpload}
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
        <CanvasForDiagram
          diagram={activeDiagram}
          props={props}
          state={state}
          readOnly={readOnly}
          autoRoute={autoRoute}
          snapToGrid={snapToGrid}
          onToggleSnapToGrid={() => setSnapToGrid((on) => !on)}
          showGrid={showGrid}
          onToggleShowGrid={() => setShowGrid((on) => !on)}
          showLifecycle={showLifecycle}
          showMinimap={showMinimap}
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
              model={state.effectiveModel}
              diagram={activeDiagram}
              readOnly={readOnly}
              parameterSpecs={props.parameterSpecs(state.selectedElement)}
              actions={state.actions}
              onRequestDelete={() => setDeleteTarget(state.selectedElement?.id)}
              renderMarkdown={props.renderMarkdown}
              extras={props.renderInspectorExtras?.(state.selectedElement)}
              renameRequest={renameRequest}
              onRequestLogoUpload={readOnly ? undefined : props.onRequestLogoUpload}
              onOpenDocumentation={openDocumentation}
            />
          ) : state.selectedConnection ? (
            <ConnectionInspector
              connection={state.selectedConnection}
              model={state.effectiveModel}
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
              onRequestLogoUpload={readOnly ? undefined : props.onRequestLogoUpload}
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
          hasComponents={state.effectiveModel.elements.some(
            (e) => e.parentApplicationId === deleteElement.id,
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
      {documentationElement && (
        <DocumentationPage
          key={documentationElement.id}
          element={documentationElement}
          model={state.effectiveModel}
          diagram={activeDiagram}
          readOnly={readOnly}
          actions={state.actions}
          parameterSpecs={props.parameterSpecs(documentationElement)}
          renderMarkdown={props.renderMarkdown}
          onNavigate={openDocumentation}
          onClose={() => setDocumentationId(undefined)}
          onRequestDelete={() => {
            setDocumentationId(undefined);
            setDeleteTarget(documentationElement.id);
          }}
          onRequestLogoUpload={props.onRequestLogoUpload}
          windowChrome={props.windowChrome}
        />
      )}
      <ElementSearchDialog
        open={searchOpen}
        model={state.effectiveModel}
        activeDiagramId={props.activeDiagramId}
        onClose={() => setSearchOpen(false)}
        onFocus={requestFocus}
      />
      {props.onRenameDiagram && (
        <RenameDiagramDialog
          target={renameDiagramTarget}
          onRename={props.onRenameDiagram}
          onClose={() => setRenameDiagramTarget(undefined)}
        />
      )}
      {props.onDiagramSettingsChange && (
        <DiagramSettingsDialog
          target={state.effectiveModel.diagrams.find((d) => d.id === settingsDiagramId)}
          defaultClient={props.exportTitleBlock?.client ?? state.effectiveModel.customerName}
          onSave={props.onDiagramSettingsChange}
          onClose={() => setSettingsDiagramId(undefined)}
        />
      )}
    </Box>
  );
}

function CanvasForDiagram({
  diagram,
  props,
  state,
  readOnly,
  autoRoute,
  snapToGrid,
  onToggleSnapToGrid,
  showGrid,
  onToggleShowGrid,
  showLifecycle,
  showMinimap,
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
  props: SolutionDesignEditorProps;
  state: ReturnType<typeof useEditorState>;
  readOnly: boolean;
  /** Live auto-routing — drives the canvas's waypoint-free drag preview only. */
  autoRoute: boolean;
  snapToGrid: boolean;
  onToggleSnapToGrid(): void;
  showGrid: boolean;
  onToggleShowGrid(): void;
  showLifecycle: boolean;
  showMinimap: boolean;
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
    model: state.effectiveModel,
    diagram,
    decorations: props.decorations,
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
    showMinimap,
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
      scopeSummary={props.scopeSummary}
      onTidyGroup={onTidyGroup}
      groupTidyOptions={groupTidyOptions}
      onGroupTidyOptionsChange={onGroupTidyOptionsChange}
    />
  ) : (
    <ContainerCanvas {...shared} />
  );
}

function pngFilename(customerName: string, diagram: DesignDiagram): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `${slug(customerName) || 'design'}-${slug(diagram.name) || 'diagram'}.png`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
