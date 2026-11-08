// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The editor's body under the toolbar: the palette docked left, the board or
 * a laid-out view in the middle, the inspector docked right.
 */
import Box from '@mui/material/Box';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import type { CSSProperties, ReactNode } from 'react';
import { tokenVariables } from '../widgets/kit/tokens';
import type { DesignDiagram } from '../model/types';
import type { AttachSidesPatch } from '../model/routes';
import { aspectConfigFor } from '../model/aspects';
import { ElementPalette } from './canvas/ElementPalette';
import { addableKinds } from './AddPicker';
import { boardMiddle } from './EditorBoardToolbar';
import { CanvasForDiagram } from './CanvasForDiagram';
import { EMPTY_SELECTION, selectElement } from './useEditorState';
import { standInsFor, heldIdsOf } from './elementInspectorFacts';
import type { EditorParts } from './editorParts';
import { labelsOn } from './useViewSettings';
import { SelectionInspector } from './EditorInspectorDock';
import { usePersonNames } from '../people/ui/names';
import type { PersonRef } from '../model/person';

/** The rail of kinds, kept open by whoever keeps it open. */
export function PaletteDock({ parts, diagram }: { parts: EditorParts; diagram: DesignDiagram }) {
  const { adding, props, view } = parts;
  const existing = diagram.kind === 'layer7' ? props.ownership?.onAddExisting : undefined;
  if (!view.keepRail) return null;
  return (
    <ElementPalette
      kinds={addableKinds(diagram)}
      onPress={(kind) => adding.ask({ screen: boardMiddle(), kind })}
      {...(existing ? { onAddExisting: () => existing() } : {})}
    />
  );
}

/**
 * A laid-out view drawn in the tab (ADR-0016): the host's page where the
 * canvas would be. The landscape's write gesture (ADR-0020) is the same
 * actions the inspector calls, with the stand-in for a target another scope
 * defines resolved here, off the ownership seam.
 */
export function LaidOutView({ parts, diagram, pageBar, onDock }: { parts: EditorParts; diagram: DesignDiagram; pageBar: HTMLElement | null; onDock?: (shown: boolean) => void }) {
  const { props, state, readOnly, view, board } = parts;
  const looking = board.viewing.days[diagram.id] !== undefined;
  const technology = props.ownership?.technology;
  const names = usePersonNames();
  return (
    <Box data-testid="laid-out-view" sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {props.pages?.render(diagram, {
        readOnly,
        pageBar,
        outline: { width: view.outlineWidth, onWidth: view.setOutlineWidth },
        ...(diagram.kind === 'technology' ? {
          record: <SelectionInspector parts={parts} diagram={diagram} />,
          ...(readOnly ? {} : { onDelete: (elementId: string) => parts.deletes.setDeleteTarget(elementId) }),
          onDay: (day: string | undefined) => parts.board.viewing.show(diagram.id, day),
          ownerText: (owner: PersonRef) => names.text(owner),
        } : {}),
        ...(onDock ? { onDock } : {}),
        day: {
          looking,
          onChange: (day) => board.viewing.show(diagram.id, day),
          ...(!readOnly && looking ? {
            onKeep: () => { state.actions.setAsOf(board.lookingAt); board.viewing.forget(diagram.id); },
          } : {}),
        },
        ...(state.selectedElement ? { selectedId: state.selectedElement.id } : {}),
        onSelect: (elementId) => state.setSelection(elementId === undefined ? EMPTY_SELECTION : selectElement(elementId)),
        onAdd: (seed) => state.actions.addElement(seed),
        onHost: (elementId, platformId) => {
          const standIn = technology?.standInFor(platformId);
          if (standIn) state.actions.setHostedOn(elementId, platformId, standIn);
          else state.actions.setHostedOn(elementId, platformId);
        },
        onUse: (elementId, targetIds) => {
          const standIns = standInsFor(targetIds, heldIdsOf(state.model), technology?.standInFor);
          if (standIns.length > 0) state.actions.setUses(elementId, targetIds, standIns);
          else state.actions.setUses(elementId, targetIds);
        },
      })}
    </Box>
  );
}

/**
 * The board, under the export's theme while the dialog is open and its own
 * the rest of the time. Nested on purpose: the palette and the inspector stay
 * in the window's theme, the picture does not.
 */
export function BoardCanvas({ parts, diagram }: { parts: EditorParts; diagram: DesignDiagram }) {
  const { props, state, readOnly, view, board, layout, requests, deletes, exports, clicks } = parts;
  const writable = <T,>(handler: T) => (readOnly ? undefined : handler);
  const windowMode = useTheme().palette.mode;
  return (
    <ThemeProvider theme={exports.exportTheme}>
      <ExportTokens theme={exports.exportTheme} windowMode={windowMode}>
      <CanvasForDiagram
        diagram={diagram}
        state={state}
        readOnly={readOnly}
        autoRoute={layout.autoRoute}
        snapToGrid={view.snapToGrid}
        onToggleSnapToGrid={() => view.setSnapToGrid((on) => !on)}
        showGrid={view.showGrid}
        onToggleShowGrid={() => view.setShowGrid((on) => !on)}
        showLifecycle={view.showLifecycle}
        noteFor={props.ownership?.noteFor}
        showMinimap={view.showMinimap}
        onToggleMinimap={() => view.setShowMinimap((on) => !on)}
        showEdgeLabels={exports.exportOptions ? exports.exportOptions.showLabels : labelsOn(view, diagram)}
        mountEveryElement={parts.capturing || exports.exportOptions !== undefined}
        onElementDoubleClick={clicks.handleDoubleClick}
        onCreateContainer={writable(props.diagrams.onCreateContainer)}
        onCreateDrawing={writable(props.diagrams.onCreateDrawingFor)}
        viewports={parts.viewports}
        onLineDoubleClick={clicks.handleLineDoubleClick}
        showDeployment={board.showDeployment}
        platformTree={props.ownership?.platformTree}
        overlayMarks={board.overlayMarks}
        overlayFaded={board.overlayFaded}
        overlayLegend={board.colourBy !== undefined ? {
          colourBy: board.colourBy,
          bands: board.overlay,
          aspectColumns: aspectConfigFor(diagram),
          onClose: () => board.chooseColourBy(undefined),
          ...(parts.writable && board.lensIsOwn ? { onKeep: board.keepLens } : {}),
        } : undefined}
        onOpenDocumentation={parts.docs.open}
        onTidyGroup={writable((name: string) => void layout.handleTidyGroup(name))}
        groupTidyOptions={view.groupTidyOptions}
        onGroupTidyOptionsChange={writable(view.setGroupTidyOptions)}
        onTidy={writable(() => void layout.handleTidy().catch(() => {}))}
        onRouteConnections={writable(() => void layout.handleRouteEdges())}
        onRouteConnectionsAll={writable(() => void layout.handleRouteEdgesAll())}
        onRouteLines={writable((lines: readonly string[]) => void layout.handleRouteLines(lines))}
        onResetRoute={writable((id: string) => void layout.handleResetRoute(id))}
        onSetRouteSides={writable((id: string, sides: AttachSidesPatch) => void layout.handleSetRouteSides(id, sides))}
        layoutBusy={layout.busy !== undefined}
        clipboardRef={parts.clipboardRef}
        pasteCountRef={parts.pasteCountRef}
        onRequestRename={requests.requestRename}
        onRequestDeleteElement={deletes.setDeleteTarget}
        onRequestDeleteConnection={deletes.requestDeleteConnection}
        onRequestDeleteSelection={deletes.requestDeleteSelection}
        menuRequest={requests.menuRequest}
        onAddExistingAt={writable(props.ownership?.onAddExisting)}
        onAskAdd={writable(parts.adding.ask)}
        showStatus={diagram.kind === 'container' ? view.containerStatus : view.showStatus}
        showDescriptions={view.cardDescriptions}
        showKey={view.showKey}
        routeNote={layout.autoRouteNote}
      />
      </ExportTokens>
    </ThemeProvider>
  );
}

/**
 * The board's tokens in the picture's own mode while it is the other one: the
 * cards, bands and groups paint with the custom properties the window's root
 * sets, so a dark picture taken from a light window kept the light fills on a
 * dark ground. Set on a box that lays nothing out, from which they are inherited.
 */
function ExportTokens({ theme, windowMode, children }: { theme: Theme; windowMode: Theme['palette']['mode']; children: ReactNode }) {
  if (theme.palette.mode === windowMode) return <>{children}</>;
  return <div data-testid="export-tokens" style={{ display: 'contents', ...tokenVariables(theme.palette.mode, theme.tokens?.shades) } as CSSProperties}>{children}</div>;
}
