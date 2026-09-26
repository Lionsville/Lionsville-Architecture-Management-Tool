// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The toolbar over the board, wired to the editor's state: the diagram tabs
 * and what they can do, the layout passes, the day, the view toggles.
 */
import { useReactFlow } from '@xyflow/react';
import type { DesignDiagram } from '../model/types';
import { cancelElkLayout, canCancelElkLayout } from '../layout/elkLayout';
import { EditorToolbar, type EditorToolbarProps } from './EditorToolbar';
import { FIT_ALL } from './canvas/fitAll';
import type { SolutionDesignEditorProps } from './props';
import type { EditorState } from './useEditorState';
import type { BoardView } from './useBoardView';
import type { EditorDialogState } from './EditorDialogs';
import type { EditorParts } from './editorParts';

export function BoardToolbar({ parts, diagram, laidOut }: { parts: EditorParts; diagram: DesignDiagram; laidOut: boolean }) {
  const { props, state, readOnly, view, board, layout, exports, dialogs } = parts;
  const { fitView } = useReactFlow();
  return (
    <EditorToolbar
      model={state.model}
      activeDiagram={diagram}
      readOnly={readOnly}
      busy={layout.busy}
      laidOut={laidOut}
      {...diagramMenus(props, dialogs)}
      // Caught, not `void`ed: `handleTidy` rethrows so the unattended caller in
      // `useAutoLayout` can tell "laid out" from "did not", and `void` discards the
      // value without attaching a rejection handler — so a failed Tidy reported its
      // toast AND went to the console as an unhandled rejection. The button has
      // already been told; there is nothing further to do with the error here.
      onTidy={() => void layout.handleTidy().catch(() => {})}
      onCancelTidy={canCancelElkLayout() ? cancelElkLayout : undefined}
      tidyOptions={view.tidyOptions}
      onTidyOptionsChange={view.setTidyOptions}
      onRouteEdges={() => void layout.handleRouteEdges()}
      autoRoute={layout.autoRoute}
      onToggleAutoRoute={layout.handleToggleAutoRoute}
      autoRouteNote={layout.autoRouteNote}
      onFitView={() => { void fitView({ ...FIT_ALL, duration: 300 }) }}
      onExport={exports.openExport}
      exportBusy={exports.exporting}
      onOpenHelp={dialogs.openHelp}
      showLifecycle={view.showLifecycle}
      onToggleLifecycle={() => view.setShowLifecycle((on) => !on)}
      {...boardControls(diagram, board)}
      {...dayControls(diagram, board, readOnly, state)}
      onUndo={state.undo}
      onRedo={state.redo}
      canUndo={state.canUndo}
      canRedo={state.canRedo}
      onOpenSearch={dialogs.openSearch}
      showMinimap={view.showMinimap}
      onToggleMinimap={() => view.setShowMinimap((on) => !on)}
      showEdgeLabels={view.showEdgeLabels}
      onToggleEdgeLabels={() => view.setShowEdgeLabels((on) => !on)}
      onLanguageChange={props.language?.onChange}
    />
  );
}

/** The tabs' own menus: open, make, rename, settings, duplicate, delete, history. */
function diagramMenus(
  props: SolutionDesignEditorProps,
  dialogs: EditorDialogState,
): Pick<EditorToolbarProps,
  | 'onActiveDiagramChange' | 'onCreateLayer7Diagram' | 'onOpenSheet' | 'onCreateSheet' | 'onOpenMap' | 'onCreateMap'
  | 'onOpenTechnology' | 'onCreateTechnology' | 'onRenameDiagram' | 'onOpenDiagramSettings' | 'onDuplicateDiagram'
  | 'onDeleteDiagram' | 'onDiagramHistory'> {
  const { diagrams } = props;
  return {
    onActiveDiagramChange: props.document.onActiveDiagramChange,
    onCreateLayer7Diagram: diagrams.onCreateLayer7,
    onOpenSheet: diagrams.onOpenSheet,
    onCreateSheet: diagrams.onCreateSheet,
    onOpenMap: diagrams.onOpenMap,
    onCreateMap: diagrams.onCreateMap,
    onOpenTechnology: diagrams.onOpenTechnology,
    onCreateTechnology: diagrams.onCreateTechnology,
    onRenameDiagram: diagrams.onRename ? (id, name) => dialogs.setRenameDiagramTarget({ id, name }) : undefined,
    onOpenDiagramSettings: diagrams.onSettingsChange ? (id) => dialogs.setSettingsDiagramId(id) : undefined,
    onDuplicateDiagram: diagrams.onDuplicate,
    onDeleteDiagram: diagrams.onDelete,
    onDiagramHistory: props.history?.onDiagram,
  };
}

/**
 * A landscape's overlay and a container view's deployment boxes. A reader may
 * change what a view SHOWS (the lifecycle toggle's rule), so the click always
 * lands; the write that keeps it is the session's to refuse, which it does
 * under readOnly.
 */
function boardControls(diagram: DesignDiagram, board: BoardView): Partial<Pick<EditorToolbarProps,
  'colourBy' | 'overlayBands' | 'overlayCandidates' | 'onColourByChange' | 'showDeployment' | 'onToggleDeployment'>> {
  if (diagram.kind === 'layer7') {
    return {
      colourBy: board.colourBy,
      overlayBands: board.overlay,
      overlayCandidates: board.overlayCandidates,
      onColourByChange: board.chooseColourBy,
    };
  }
  if (diagram.kind === 'container') {
    return { showDeployment: board.showDeployment, onToggleDeployment: board.toggleDeployment };
  }
  return {};
}

/** The day the board is looked at, and saving that day onto it (ADR-0027). */
function dayControls(
  diagram: DesignDiagram,
  board: BoardView,
  readOnly: boolean,
  state: EditorState,
): Pick<EditorToolbarProps, 'asOf' | 'savedAsOf' | 'onAsOfChange' | 'onSaveAsOf'> {
  return {
    asOf: board.lookingAt,
    savedAsOf: diagram.asOf,
    onAsOfChange: (day) => board.viewing.show(diagram.id, day),
    onSaveAsOf: readOnly ? undefined : () => {
      state.actions.setAsOf(board.lookingAt);
      board.viewing.forget(diagram.id);
    },
  };
}
