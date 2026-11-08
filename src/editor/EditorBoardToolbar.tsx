// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The toolbar over the board, wired to the editor's state: the diagram tabs
 * and what they can do, the layout passes, the day, the view toggles.
 */
import type { DesignDiagram } from '../model/types';
import { cancelElkLayout, canCancelElkLayout } from '../layout/elkLayout';
import { EditorToolbar, type EditorToolbarProps, type NewViewProps } from './EditorToolbar';
import { labelsOn } from './useViewSettings';
import { addableKinds } from './AddPicker';
import { paletteLabel } from './canvas/paletteItems';
import { useStrings } from '../i18n/LanguageContext';
import type { BoardBarAdd } from './BoardBar';
import type { SolutionDesignEditorProps } from './props';
import { EMPTY_SELECTION } from './useEditorState';
import type { BoardView } from './useBoardView';
import type { EditorDialogState } from './EditorDialogs';
import type { EditorParts } from './editorParts';

export function BoardToolbar({ parts, diagram, laidOut, onPageBar }: { parts: EditorParts; diagram: DesignDiagram; laidOut: boolean; onPageBar?: (node: HTMLElement | null) => void }) {
  const { props, state, writable, looking, view, board, layout, exports, dialogs } = parts;
  const add = useBoardAdd(parts, diagram);
  return (
    <EditorToolbar
      model={state.model}
      activeDiagram={diagram}
      readOnly={!writable}
      looking={looking}
      {...(parts.cameFrom ? { cameFrom: parts.cameFrom } : {})}
      busy={layout.busy}
      laidOut={laidOut}
      {...(onPageBar ? { onPageBar } : {})}
      dated={isDated(diagram.kind)}
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
      {...(diagram.kind === 'container' && writable ? { onLayersByCategory: () => void layout.handleLayers() } : {})}
      onRouteEdgesAll={() => void layout.handleRouteEdgesAll()}
      {...(add ? { add } : {})}
      show={{
        ...(diagram.kind === 'container'
          ? { status: view.containerStatus, onStatus: view.setContainerStatus }
          : { status: view.showStatus, onStatus: view.setShowStatus }),
        descriptions: view.cardDescriptions, onDescriptions: view.setShowDescriptions,
        showKey: view.showKey, onKey: view.setShowKey,
      }}
      autoRoute={layout.autoRoute}
      onToggleAutoRoute={layout.handleToggleAutoRoute}
      autoRouteNote={layout.autoRouteNote}
      onExport={exports.openExport}
      exportBusy={exports.exporting}
      onOpenHelp={dialogs.openHelp}
      showLifecycle={view.showLifecycle}
      onToggleLifecycle={() => view.setShowLifecycle((on) => !on)}
      {...boardControls(diagram, board, writable)}
      {...dayControls(diagram, board, props.ownership?.roles?.today)}
      onUndo={state.undo}
      onRedo={state.redo}
      canUndo={state.canUndo}
      canRedo={state.canRedo}
      onOpenSearch={dialogs.openSearch}
      showMinimap={view.showMinimap}
      onToggleMinimap={() => view.setShowMinimap((on) => !on)}
      showEdgeLabels={labelsOn(view, diagram)}
      onToggleEdgeLabels={() => (diagram.kind === 'container' ? view.setContainerLabels : view.setShowEdgeLabels)((on) => !on)}
      onLanguageChange={props.language?.onChange}
      onOpenThisView={!laidOut ? () => { dialogs.setThisViewOpen(true); state.setSelection(EMPTY_SELECTION); } : undefined}
    />
  );
}

/** What Add offers, each opening the picker at the middle of the board. */
function useBoardAdd(parts: EditorParts, diagram: DesignDiagram): BoardBarAdd | undefined {
  const { t } = useStrings();
  const { adding, view, props } = parts;
  if (diagram.kind !== 'layer7' && diagram.kind !== 'container') return undefined;
  const existing = diagram.kind === 'layer7' ? props.ownership?.onAddExisting : undefined;
  return {
    kinds: addableKinds(diagram).map((kind) => ({
      label: paletteLabel(kind, t),
      onPress: () => adding.ask({ screen: boardMiddle(), kind }),
    })),
    ...(existing ? { onExisting: () => existing() } : {}),
    keepOpen: view.keepRail,
    onKeepOpen: view.setKeepRail,
  };
}

/** Where a picker asked for from the bar or the rail opens: the middle of the board, or of the window. */
export function boardMiddle(): { x: number; y: number } {
  const box = document.querySelector('[data-guide="board.canvas"]')?.getBoundingClientRect();
  return box ? { x: box.left + box.width / 2 - 160, y: box.top + box.height / 3 } : { x: window.innerWidth / 2, y: window.innerHeight / 3 };
}

/** The ways to make a view, for the `+` beside the tabs and for the one row two keeps where there are none. */
export function newViewProps(diagrams: SolutionDesignEditorProps['diagrams']): NewViewProps {
  return {
    onCreateLayer7Diagram: diagrams.onCreateLayer7,
    onCreateSheet: diagrams.onCreateSheet,
    onCreateMap: diagrams.onCreateMap,
    onCreateTechnology: diagrams.onCreateTechnology,
    onCreateDrawing: diagrams.onCreateDrawing,
    onNewView: diagrams.onNewView,
    onCreateChart: diagrams.onCreateChart,
    onCreateConway: diagrams.onCreateConway,
  };
}

/** The tabs' own menus: open, make, rename, settings, duplicate, delete, history. */
function diagramMenus(
  props: SolutionDesignEditorProps,
  dialogs: EditorDialogState,
): Pick<EditorToolbarProps,
  | 'onActiveDiagramChange' | 'onCreateLayer7Diagram' | 'onOpenSheet' | 'onCreateSheet' | 'onOpenMap' | 'onCreateMap'
  | 'onOpenTechnology' | 'onCreateTechnology' | 'onOpenDrawing' | 'onCreateDrawing' | 'onNewView'
  | 'onOpenChart' | 'onCreateChart' | 'onOpenConway' | 'onCreateConway' | 'onRenameDiagram' | 'onOpenDiagramSettings' | 'onDuplicateDiagram'
  | 'onDeleteDiagram' | 'onDiagramHistory'> {
  const { diagrams } = props;
  return {
    ...newViewProps(diagrams),
    onActiveDiagramChange: props.document.onActiveDiagramChange,
    onOpenSheet: diagrams.onOpenSheet,
    onOpenMap: diagrams.onOpenMap,
    onOpenTechnology: diagrams.onOpenTechnology,
    onOpenDrawing: diagrams.onOpenDrawing,
    onOpenChart: diagrams.onOpenChart,
    onOpenConway: diagrams.onOpenConway,
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
 * lands. A lens writes nothing until *Keep with the view* (ADR-0027, amended),
 * offered to whoever may write; the deployment boxes still write, and the
 * session refuses that under readOnly.
 */
function boardControls(diagram: DesignDiagram, board: BoardView, writable: boolean): Partial<Pick<EditorToolbarProps,
  'colourBy' | 'overlayBands' | 'overlayCandidates' | 'onColourByChange' | 'onKeepColourBy' | 'showDeployment' | 'onToggleDeployment'>> {
  if (diagram.kind === 'layer7') {
    return {
      colourBy: board.colourBy,
      overlayBands: board.overlay,
      overlayCandidates: board.overlayCandidates,
      onColourByChange: board.chooseColourBy,
      ...(writable && board.lensIsOwn ? { onKeepColourBy: board.keepLens } : {}),
    };
  }
  if (diagram.kind === 'container') {
    return { showDeployment: board.showDeployment, onToggleDeployment: board.toggleDeployment };
  }
  return {};
}

/**
 * Whether a view of this kind is drawn on a day: a board, and the
 * organisation chart and the Conway map (ADR-0036 §7), which keep the day
 * control when the canvas's other controls are put away. A sheet and a map
 * are of the model as it is, a technology landscape of what runs now, and a
 * drawing is a picture somebody drew.
 */
export function isDated(kind: DesignDiagram['kind']): boolean {
  switch (kind) {
    case 'layer7':
    case 'container':
    case 'chart':
    case 'conway':
      return true
    case 'sheet':
    case 'map':
    case 'technology':
    case 'drawing':
      return false
    default: {
      const unexpected: never = kind
      return unexpected
    }
  }
}

/** The day the board is looked at (ADR-0027). */
function dayControls(
  diagram: DesignDiagram,
  board: BoardView,
  today: string | undefined,
): Pick<EditorToolbarProps, 'asOf' | 'onAsOfChange' | 'today'> {
  return {
    asOf: board.lookingAt,
    today: today ?? new Date().toISOString().slice(0, 10),
    onAsOfChange: (day) => board.viewing.show(diagram.id, day),
  };
}
