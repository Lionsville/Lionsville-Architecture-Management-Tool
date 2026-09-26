// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useCallback, useRef, type JSX, type RefObject } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { DesignDiagram, UploadedLogo } from '../model/types';
import type { ClipboardPayload } from '../model/clipboard';
import { isBoardKind } from '../model/placement';
import type { SolutionDesignEditorProps } from './props';
import { LogoLibraryProvider } from './nodes/logoRegistry';
import { LanguageProvider, useStrings } from '../i18n/LanguageContext';
import { ViewportMemory } from './canvas/viewportMemory';
import { useEditorState } from './useEditorState';
import { useCanvasShortcuts } from './use-canvas-shortcuts';
import { useViewSettings } from './useViewSettings';
import { useBoardView } from './useBoardView';
import { useCanvasRequests, useDocumentation } from './useEditorRequests';
import { useDeleteRequests } from './useDeleteRequests';
import { useLayoutActions } from './useLayoutActions';
import { useBoardCapture, useExportDialog } from './useExport';
import { useDoubleClicks, useEditorHandle } from './useEditorHandle';
import { EditorDialogs, EditorLateDialogs, useEditorDialogs } from './EditorDialogs';
import { EditorDocumentationPage } from './EditorDocumentationPage';
import { BoardToolbar } from './EditorBoardToolbar';
import { BoardCanvas, LaidOutView, PaletteDock } from './EditorPanels';
import { InspectorDock } from './EditorInspectorDock';
import type { EditorParts } from './editorParts';

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
 * The editor's body: its state is the hooks beside it (`useEditorParts`), and
 * what it draws is the toolbar, the three docked panels and the dialogs, each
 * a component of its own over those parts.
 */
function EditorBody(props: SolutionDesignEditorProps) {
  const { t } = useStrings();
  const { parts, activeDiagram, setWrapperNode } = useEditorParts(props);
  const { state, readOnly } = parts;
  const documentationPage = (
    <EditorDocumentationPage
      props={props}
      state={state}
      readOnly={readOnly}
      docs={parts.docs}
      onRequestDelete={parts.deletes.setDeleteTarget}
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
  // A laid-out view in the tab (ADR-0016). The technology landscape authors
  // the layer's two kinds, so it keeps the palette and the inspector docked;
  // the sheet and the map carry their own and take the whole body.
  const laidOut = !isBoardKind(activeDiagram.kind);
  const docked = activeDiagram.kind === 'technology' || !laidOut;
  const shown = parts.board.shownDiagram ?? activeDiagram;
  return (
    <Box
      ref={setWrapperNode}
      sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}
    >
      <BoardToolbar parts={parts} diagram={activeDiagram} laidOut={laidOut} />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {!readOnly && docked && <PaletteDock parts={parts} diagram={activeDiagram} />}
        {laidOut ? <LaidOutView parts={parts} diagram={shown} /> : <BoardCanvas parts={parts} diagram={shown} />}
        {docked && <InspectorDock parts={parts} diagram={activeDiagram} />}
      </Box>
      <EditorDialogs state={state} diagram={activeDiagram} deletes={parts.deletes} exports={parts.exports} dialogs={parts.dialogs} />
      {documentationPage}
      <EditorLateDialogs props={props} state={state} dialogs={parts.dialogs} onFocus={parts.requests.requestFocus} />
    </Box>
  );
}

/**
 * Every piece of the body's state, one hook per concern, composed in the
 * order they read each other: the view settings and the board's look first,
 * the requests and the deletes over the selection, the layout passes, the
 * export over those, and the doors a host and the keyboard come in by last.
 */
function useEditorParts(props: SolutionDesignEditorProps) {
  const theme = useTheme();
  const { t, language } = useStrings();
  const state = useEditorState(props);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const readOnly = props.editing.readOnly ?? false;
  const activeDiagram = state.model.diagrams.find((d) => d.id === props.document.activeDiagramId);
  const view = useViewSettings(props.preferences);
  const board = useBoardView({
    model: state.model, diagram: activeDiagram, viewing: props.document.viewing,
    platformTree: props.ownership?.platformTree, theme, actions: state.actions,
  });
  const requests = useCanvasRequests(props, state, view.setInspectorCollapsed);
  const docs = useDocumentation(props, state, activeDiagram);
  const deletes = useDeleteRequests(state, activeDiagram, readOnly);
  const layout = useLayoutActions({
    props, state, diagram: activeDiagram, readOnly,
    tidyOptions: view.tidyOptions, groupTidyOptions: view.groupTidyOptions, t,
  });
  const exports = useExportDialog({
    props, wrapperRef, theme, showEdgeLabels: view.showEdgeLabels, reportLayoutError: layout.reportLayoutError,
    titleBlock: {
      diagram: activeDiagram, model: state.model, lookingAt: board.lookingAt, host: props.exportTitleBlock,
      showLifecycle: view.showLifecycle, t, language,
    },
  });
  const capture = useBoardCapture(wrapperRef, activeDiagram, theme, props.logos?.onExportImagesMissing);
  const dialogs = useEditorDialogs();
  const clicks = useDoubleClicks(props, state, activeDiagram, docs.open);
  const session = useEditorSession();
  const parts: EditorParts = {
    props, state, readOnly, view, board, layout, requests, docs, deletes, exports, dialogs, clicks,
    capturing: capture.capturing, ...session,
  };
  useEditorHandle({
    onHandle: props.onHandle, state, diagram: activeDiagram, readOnly, busy: layout.busy !== undefined,
    tidy: useCallback(() => layout.handleTidy(undefined, true), [layout.handleTidy]),
    routeEdges: layout.handleRouteEdges, capture: capture.captureBoard, deletes, showShortcuts: dialogs.openHelp,
  });
  const setWrapperNode = useKeyboard(parts, activeDiagram, wrapperRef);
  return { parts, activeDiagram, setWrapperNode };
}

/** Session state no hook owns: where each board was left, and the clipboard. */
function useEditorSession() {
  const viewports = useRef(new ViewportMemory());
  const clipboardRef = useRef<ClipboardPayload | null>(null);
  const pasteCountRef = useRef(0);
  return { viewports: viewports.current, clipboardRef, pasteCountRef };
}

/**
 * ONE owner of canvas keys (DK4): the declarative keymap-driven hook. It bails
 * inside text inputs, drives copy/paste/cut/duplicate/nudge/select-all through
 * the same batched actions, and calls the view actions from useReactFlow().
 * Delete still routes through the confirm dialog, and React Flow's own Delete
 * stays off (deleteKeyCode={null} on DiagramCanvas).
 *
 * The wrapper ref (used by the PNG export) and the shortcut hook's callback
 * ref are attached to the same node, so the listener (re)binds whenever the
 * wrapper mounts — it only renders once the active diagram resolves.
 */
function useKeyboard(
  parts: EditorParts,
  activeDiagram: DesignDiagram | undefined,
  wrapperRef: RefObject<HTMLDivElement | null>,
) {
  const { props, state, requests, deletes, dialogs } = parts;
  const setShortcutContainer = useCanvasShortcuts({
    readOnly: parts.readOnly,
    model: state.model,
    diagram: activeDiagram,
    selection: state.selection,
    selectedElement: state.selectedElement,
    selectedConnection: state.selectedConnection,
    actions: state.actions,
    undo: state.undo,
    redo: state.redo,
    setSelection: state.setSelection,
    clipboardRef: parts.clipboardRef,
    pasteCountRef: parts.pasteCountRef,
    onForceSave: props.onForceSave,
    onShowHelp: dialogs.openHelp,
    onRequestDeleteElement: deletes.setDeleteTarget,
    onRequestDeleteConnection: deletes.requestDeleteConnection,
    onRequestDeleteSelection: deletes.requestDeleteSelection,
    onOpenContextMenu: () => requests.requestMenu('open'),
    onRequestRename: () => requests.requestMenu('rename'),
    onOpenSearch: dialogs.openSearch,
    onOpenDocumentation: parts.docs.open,
    hostOwnsUndo: props.editing.history.keysOwnedByHost,
  });
  return useCallback((node: HTMLDivElement | null) => {
    wrapperRef.current = node;
    setShortcutContainer(node);
  }, [setShortcutContainer, wrapperRef]);
}
