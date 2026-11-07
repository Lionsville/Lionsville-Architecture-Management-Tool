// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The inspector docked right, and the seam beside it while it is open: the
 * selected element's, line's or group's, the multi-selection's, a laid-out
 * page's own choice (`EditorPages.inspector`) — also while the one id
 * selected is one the model does not hold — or the empty state.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { DesignDiagram } from '../model/types';
import type { AttachSidesPatch } from '../model/routes';
import { useStrings } from '../i18n/LanguageContext';
import { PanelResizer } from './PanelResizer';
import { ConnectionInspector } from './ConnectionInspector';
import { DomainGroupInspector } from './DomainGroupInspector';
import { ElementInspector } from './ElementInspector';
import { InspectorPanel } from './InspectorPanel';
import { MultiSelectionInspector } from './MultiSelectionInspector';
import { moveFor } from './EditorDocumentationPage';
import { ThisViewPanel } from './inspector/ThisViewPanel';
import { selectionCount } from './useEditorState';
import type { EditorParts } from './editorParts';

/**
 * With nothing selected there is no panel: the board has the width, and pressing
 * the view's name opens *This view*. A folded panel stays a rail only while there
 * is something to unfold it for.
 */
export function InspectorDock({ parts, diagram }: { parts: EditorParts; diagram: DesignDiagram }) {
  const { view } = parts;
  const { t } = useStrings();
  // Asking about something else, or another view, is leaving this one.
  const { state, dialogs: { setThisViewOpen } } = parts;
  const selected = selectionCount(state.selection) > 0;
  useEffect(() => { if (selected) setThisViewOpen(false); }, [selected, setThisViewOpen]);
  useEffect(() => () => setThisViewOpen(false), [diagram.id, setThisViewOpen]);
  const inspector = selectionInspector(parts, diagram);
  if (inspector === undefined || inspector === null) return null;
  return (
    <>
      {!view.inspectorCollapsed && (
        <PanelResizer kind="inspector" side="right" width={view.inspectorWidth} onWidth={view.setInspectorWidth} label={t('inspector.resize')} />
      )}
      <InspectorPanel
        collapsed={view.inspectorCollapsed}
        onToggleCollapsed={() => view.setInspectorCollapsed((on) => !on)}
        width={view.inspectorWidth}
      >
        {inspector}
      </InspectorPanel>
    </>
  );
}

/** What the panel holds for what is selected, for a page that keeps the record itself. */
export function SelectionInspector({ parts, diagram }: { parts: EditorParts; diagram: DesignDiagram }) {
  return selectionInspector(parts, diagram) ?? null;
}

function selectionInspector(parts: EditorParts, diagram: DesignDiagram): ReactNode {
  const { state, readOnly, view, layout, deletes, dialogs } = parts;
  const writable = <T,>(handler: T) => (readOnly ? undefined : handler);
  if (state.selectedElement) return <SelectedElementInspector parts={parts} diagram={diagram} />;
  if (state.selectedConnection) {
    return (
      <ConnectionInspector
        connection={state.selectedConnection}
        model={state.model}
        diagram={diagram}
        readOnly={readOnly}
        actions={state.actions}
        onResetRoute={writable((id: string) => void layout.handleResetRoute(id))}
        onSetRouteSides={writable((id: string, sides: AttachSidesPatch) => void layout.handleSetRouteSides(id, sides))}
        onRequestDelete={writable(deletes.requestDeleteConnection)}
        onOpenLanding={parts.clicks.handleLineDoubleClick}
      />
    );
  }
  if (state.selectedDomainGroup) {
    return (
      <DomainGroupInspector
        name={state.selectedDomainGroup}
        diagram={diagram}
        elements={state.model.elements}
        readOnly={readOnly}
        actions={state.actions}
        onTidy={writable((name: string) => void layout.handleTidyGroup(name))}
        // The same state the canvas's right-click popover edits, so both
        // entry points offer — and remember — one set of group settings.
        tidyOptions={view.groupTidyOptions}
        onTidyOptionsChange={writable(view.setGroupTidyOptions)}
      />
    );
  }
  // Several things selected. One the model does not hold — an id another
  // scope keeps, picked before the page knew — is not several: it falls to
  // the page's own inspector, never to the panel for a multi-selection.
  if (selectionCount(state.selection) > 1) {
    return (
      <MultiSelectionInspector
        selection={state.selection}
        model={state.model}
        diagram={diagram}
        readOnly={readOnly}
        actions={state.actions}
        onRequestLogoUpload={writable(parts.props.logos?.onRequestUpload)}
        onSelectionChange={state.setSelection}
        onRequestDelete={writable(deletes.requestDeleteSelection)}
      />
    );
  }
  // A laid-out page's own choice, which is not an element — on the day the page is drawn on.
  const own = parts.props.pages?.inspector?.(parts.board.shownDiagram ?? diagram);
  if (own !== undefined && own !== null) return own;
  return dialogs.thisViewOpen ? <ThisViewPanel parts={parts} diagram={diagram} onClose={() => dialogs.setThisViewOpen(false)} /> : undefined;
}

function SelectedElementInspector({ parts, diagram }: { parts: EditorParts; diagram: DesignDiagram }) {
  const { props, state, readOnly } = parts;
  const { ownership } = props;
  const element = state.selectedElement;
  if (!element) return null;
  return (
    <ElementInspector
      element={element}
      model={state.model}
      diagram={diagram}
      readOnly={readOnly}
      actions={state.actions}
      onRequestDelete={() => parts.deletes.setDeleteTarget(state.selectedElement?.id)}
      renderMarkdown={props.renderMarkdown}
      renameRequest={parts.requests.renameRequest}
      onRequestLogoUpload={readOnly ? undefined : props.logos?.onRequestUpload}
      onOpenDocumentation={parts.docs.open}
      onReplace={readOnly ? undefined : props.plans?.onReplace}
      owned={ownership?.ownerOf(element.id)}
      move={moveFor(ownership, element.id)}
      offeredBeyond={ownership?.offeredBeyond?.(element.id)}
      leverage={ownership?.leverageOf?.(element.id)}
      technology={ownership?.technology}
      parties={ownership?.parties}
      // Who holds what takes the day it is looking at, so a look does not lock it (ADR-0027, amended).
      unitSection={element.kind === 'actor' ? ownership?.unitSection?.(element, !parts.writable) : undefined}
      answeredBy={ownership?.answeredBy?.(element)}
      onShowOnTechnology={props.diagrams.onOpenTechnologyFor}
      onCreateContainer={readOnly ? undefined : props.diagrams.onCreateContainer}
      onCreateDrawing={readOnly ? undefined : props.diagrams.onCreateDrawingFor}
      onOpenDrawing={props.diagrams.onOpenDrawing}
      plans={props.plans ? { list: props.plans.list, onOpen: props.plans.onOpen } : undefined}
      onOpenView={props.document.onActiveDiagramChange}
    />
  );
}
