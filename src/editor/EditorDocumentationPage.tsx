// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The documentation page as the editor opens it: over the board, or in place
 * of it where a scope has no board — an organisation, whose views are a sheet
 * and a map, has no canvas to draw, but its capabilities and stakeholders
 * have pages, and the sheet's *Details ›* is the way to them.
 */
import type { DesignDiagram, DesignElement, ElementId } from '../model/types';
import { DocumentationPage } from '../documentation/ui/DocumentationPage';
import { ElementInspector } from './ElementInspector';
import type { SolutionDesignEditorProps } from './props';
import type { EditorState } from './useEditorState';
import type { Documentation } from './useEditorRequests';

/**
 * The *Move…* button for one record, or nothing (ADR-0012 §10).
 *
 * Asked per element rather than handed down as a prop, because whether there
 * is anywhere to move a record to is a question about the tree and the tree
 * changes under a live session. The words are the host's; the editor only
 * decides where the button goes.
 */
export function moveFor(
  ownership: SolutionDesignEditorProps['ownership'],
  elementId: ElementId,
): { label: string; tip: string; onMove(): void } | undefined {
  const gestures = ownership?.gestures;
  if (!gestures?.offered(elementId)) return undefined;
  return {
    label: gestures.label,
    tip: gestures.tip,
    onMove: () => gestures.onMove(elementId),
  };
}

export function EditorDocumentationPage({ props, state, readOnly, docs, onRequestDelete }: {
  props: SolutionDesignEditorProps;
  state: EditorState;
  readOnly: boolean;
  docs: Documentation;
  onRequestDelete(elementId: ElementId): void;
}) {
  const { element, diagram } = docs;
  if (!element || !diagram) return null;
  return (
    <DocumentationPage
      element={element}
      model={state.model}
      scopeLabel={props.exportTitleBlock?.client}
      diagram={diagram}
      readOnly={readOnly}
      actions={state.actions}
      renderMarkdown={props.renderMarkdown}
      onAddImage={readOnly ? undefined : props.onAddImage}
      images={readOnly ? undefined : props.images}
      renderInspector={(shown, { readOnly: inspectorReadOnly }) => (
        <PageInspector
          props={props}
          state={state}
          readOnly={readOnly}
          inspectorReadOnly={inspectorReadOnly}
          docs={docs}
          element={shown}
          diagram={diagram}
          onRequestDelete={onRequestDelete}
        />
      )}
      plans={props.plans ? { list: props.plans.list, onOpen: props.plans.onOpen } : undefined}
      fieldsWidth={{ value: docs.fieldsWidth, onChange: docs.setFieldsWidth }}
      onNavigate={docs.open}
      onClose={docs.close}
      onRequestDelete={() => {
        docs.close();
        onRequestDelete(element.id);
      }}
      onRequestLogoUpload={props.logos?.onRequestUpload}
      onOpenHistory={props.history?.onDescription
        ? () => props.history?.onDescription?.(element.id)
        : undefined}
      windowChrome={props.windowChrome}
    />
  );
}

/** The inspector the page lays out stacked beside its document, with the description left to the page. */
function PageInspector({ props, state, readOnly, inspectorReadOnly, docs, element, diagram, onRequestDelete }: {
  props: SolutionDesignEditorProps;
  state: EditorState;
  readOnly: boolean;
  inspectorReadOnly: boolean;
  docs: Documentation;
  element: DesignElement;
  diagram: DesignDiagram;
  onRequestDelete(elementId: ElementId): void;
}) {
  const { ownership, diagrams } = props;
  return (
    <ElementInspector
      element={element}
      model={state.model}
      diagram={diagram}
      readOnly={inspectorReadOnly}
      actions={state.actions}
      onRequestDelete={() => {
        docs.leave();
        onRequestDelete(element.id);
      }}
      renderMarkdown={props.renderMarkdown}
      onRequestLogoUpload={readOnly ? undefined : props.logos?.onRequestUpload}
      onReplace={readOnly ? undefined : props.plans?.onReplace}
      owned={ownership?.ownerOf(element.id)}
      move={moveFor(ownership, element.id)}
      offeredBeyond={ownership?.offeredBeyond?.(element.id)}
      leverage={ownership?.leverageOf?.(element.id)}
      technology={ownership?.technology}
      onShowOnTechnology={diagrams.onOpenTechnologyFor
        ? (id) => { docs.leave(); diagrams.onOpenTechnologyFor?.(id); }
        : undefined}
      layout="stacked"
      hideDescription
    />
  );
}
