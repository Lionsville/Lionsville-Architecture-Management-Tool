// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The inspector docked right, and the seam beside it while it is open: the
 * selected element's, line's or group's, the multi-selection's, or the empty
 * state.
 */
import type { DesignDiagram } from '../model/types';
import type { AttachSidesPatch } from '../model/routes';
import { useStrings } from '../i18n/LanguageContext';
import { PanelResizer } from './PanelResizer';
import { ConnectionInspector } from './ConnectionInspector';
import { DomainGroupInspector } from './DomainGroupInspector';
import { ElementInspector } from './ElementInspector';
import { InspectorEmptyState, InspectorPanel } from './InspectorPanel';
import { MultiSelectionInspector } from './MultiSelectionInspector';
import { moveFor } from './EditorDocumentationPage';
import { selectionCount } from './useEditorState';
import type { EditorParts } from './editorParts';

export function InspectorDock({ parts, diagram }: { parts: EditorParts; diagram: DesignDiagram }) {
  const { view } = parts;
  const { t } = useStrings();
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
        <SelectionInspector parts={parts} diagram={diagram} />
      </InspectorPanel>
    </>
  );
}

function SelectionInspector({ parts, diagram }: { parts: EditorParts; diagram: DesignDiagram }) {
  const { state, readOnly, view, layout, deletes } = parts;
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
  if (selectionCount(state.selection) > 0) {
    return (
      <MultiSelectionInspector
        selection={state.selection}
        diagram={diagram}
        readOnly={readOnly}
        actions={state.actions}
        onRequestLogoUpload={writable(parts.props.logos?.onRequestUpload)}
      />
    );
  }
  return <InspectorEmptyState />;
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
      onShowOnTechnology={props.diagrams.onOpenTechnologyFor}
      onCreateContainer={readOnly ? undefined : props.diagrams.onCreateContainer}
    />
  );
}
