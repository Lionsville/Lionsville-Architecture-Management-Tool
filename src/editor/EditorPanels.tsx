// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The editor's body under the toolbar: the palette docked left, the board or
 * a laid-out view in the middle, the inspector docked right.
 */
import { useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import type { DesignDiagram, ElementKind } from '../model/types';
import type { AttachSidesPatch } from '../model/routes';
import { allowedKindsOn } from '../model/kindChange';
import { useStrings } from '../i18n/LanguageContext';
import { ElementPalette, type DomainGroupSeed, type PaletteSeed } from './canvas/ElementPalette';
import { newDomainGroup } from './canvas/domainGroupPlacement';
import { PanelResizer } from './PanelResizer';
import { CanvasForDiagram } from './CanvasForDiagram';
import { EMPTY_SELECTION, defaultElementNames, selectElement } from './useEditorState';
import { standInsFor, heldIdsOf } from './elementInspectorFacts';
import type { EditorParts } from './editorParts';

/** The palette (D1) and the seam beside it, which only exists while the panel is open. */
export function PaletteDock({ parts, diagram }: { parts: EditorParts; diagram: DesignDiagram }) {
  const { props, state, view } = parts;
  const { t } = useStrings();
  // What the palette's name field shows when you leave it blank — and exactly
  // what `addElement` will then write into the model, in the same language.
  const defaultNames = useMemo(() => defaultElementNames(t), [t]);
  const { actions } = state;
  // No position: `seedPlacement` lands it in the kind's home zone.
  const add = useCallback((kind: ElementKind, seed?: PaletteSeed) => {
    actions.addElement({ kind, ...seed });
  }, [actions]);
  // The rect comes from the shared helper, because a group dropped on the
  // board has to end up identical to one placed from the tray apart from where.
  const addDomainGroup = useCallback((seed?: DomainGroupSeed) => {
    const { group, box } = newDomainGroup({ diagram, translate: t, ...seed });
    actions.addDomainGroup(group, box);
  }, [diagram, actions]);
  const layer7 = diagram.kind === 'layer7';
  return (
    <>
      <ElementPalette
        kinds={[...allowedKindsOn(diagram)]}
        onAdd={add}
        onAddDomainGroup={layer7 ? addDomainGroup : undefined}
        onAddExisting={layer7 ? props.ownership?.onAddExisting : undefined}
        logoLibrary={props.logos?.library}
        onRequestLogoUpload={props.logos?.onRequestUpload}
        defaultNames={defaultNames}
        collapsed={view.paletteCollapsed}
        onToggleCollapsed={() => view.setPaletteCollapsed((on) => !on)}
        width={view.paletteWidth}
      />
      {/* A rail is a fixed 48 px of chevron, and a resize handle on it would
          promise a width you cannot have. */}
      {!view.paletteCollapsed && (
        <PanelResizer kind="palette" side="left" width={view.paletteWidth} onWidth={view.setPaletteWidth} label={t('palette.resize')} />
      )}
    </>
  );
}

/**
 * A laid-out view drawn in the tab (ADR-0016): the host's page where the
 * canvas would be. The landscape's write gesture (ADR-0020) is the same
 * actions the inspector calls, with the stand-in for a target another scope
 * defines resolved here, off the ownership seam.
 */
export function LaidOutView({ parts, diagram }: { parts: EditorParts; diagram: DesignDiagram }) {
  const { props, state, readOnly } = parts;
  const technology = props.ownership?.technology;
  return (
    <Box data-testid="laid-out-view" sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {props.pages?.render(diagram, {
        readOnly,
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
  return (
    <ThemeProvider theme={exports.exportTheme}>
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
        showEdgeLabels={exports.exportOptions ? exports.exportOptions.showLabels : view.showEdgeLabels}
        mountEveryElement={parts.capturing || exports.exportOptions !== undefined}
        onElementDoubleClick={clicks.handleDoubleClick}
        onCreateContainer={writable(props.diagrams.onCreateContainer)}
        viewports={parts.viewports}
        onLineDoubleClick={clicks.handleLineDoubleClick}
        showDeployment={board.showDeployment}
        platformTree={props.ownership?.platformTree}
        overlayTints={board.overlayTints}
        overlayFaded={board.overlayFaded}
        onOpenDocumentation={parts.docs.open}
        onTidyGroup={writable((name: string) => void layout.handleTidyGroup(name))}
        groupTidyOptions={view.groupTidyOptions}
        onGroupTidyOptionsChange={writable(view.setGroupTidyOptions)}
        onTidy={writable(() => void layout.handleTidy().catch(() => {}))}
        onRouteConnections={writable(() => void layout.handleRouteEdges())}
        onRouteConnectionsAll={writable(() => void layout.handleRouteEdgesAll())}
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
      />
    </ThemeProvider>
  );
}
