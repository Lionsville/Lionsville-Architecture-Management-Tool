// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The documentation page as the editor opens it: over the board, or in place
 * of it where a scope has no board — an organisation, whose views are a sheet
 * and a map, has no canvas to draw, but its capabilities and stakeholders
 * have pages, and the sheet's *Details ›* is the way to them.
 */
import type { ComponentProps } from 'react';
import type { DesignDiagram, DesignElement, ElementId } from '../model/types';
import type { DocumentationPage as DocumentationPageShape } from '../documentation/ui/DocumentationPage';
import { lazyPart } from '../widgets/lazyPart';
import { ArrivingPage } from '../widgets/Arriving';
import { elementMenu } from './ElementInspector';
import type { ElementInspectorProps } from './ElementInspectorProps';
import { RecordSectionBody, recordSectionsOf } from './inspector/elementRows';
import { useStrings } from '../i18n/LanguageContext';
import { useLeaveThrough } from '../widgets/kit/drafts';
import type { ShowOnDoor, SolutionDesignEditorProps } from './props';
import type { EditorState } from './useEditorState';
import type { Documentation } from './useEditorRequests';

/**
 * An element's page is opened from a board, a sheet or a record, never the
 * first view: its script, with the editor of its document, arrives with the
 * first page opened (`widgets/lazyPart`).
 */
const DocumentationPage = lazyPart<ComponentProps<typeof DocumentationPageShape>>(
  () => import('../documentation/ui/DocumentationPage').then((held) => held.DocumentationPage),
  { fallback: (props) => <ArrivingPage topInset={props.windowChrome?.topInset ?? 0} /> },
);

/**
 * What the inspector beside the page is handed where the scope draws nothing:
 * a view with nothing on it, so every row that reads a placement reads none.
 */
const NO_VIEW: DesignDiagram = { id: '', kind: 'layer7', name: '', members: [] };

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

/** A door from a record's page: the page steps out of the way before the view opens. */
function leavingFirst(door: ShowOnDoor, leave: () => void): ShowOnDoor {
  return { places: door.places, want: door.want, open: (elementId, key) => { leave(); door.open(elementId, key); } };
}

export function EditorDocumentationPage({ props, state, readOnly, docs, onRequestDelete }: {
  props: SolutionDesignEditorProps;
  state: EditorState;
  readOnly: boolean;
  docs: Documentation;
  onRequestDelete(elementId: ElementId): void;
}) {
  const { element, diagram } = docs;
  const { t } = useStrings();
  // No view is no reason to refuse the page: a scope that draws nothing still
  // keeps records with pages (a domain's units, an element nothing draws), and a
  // link to one opens it (ADR-0033, amended 17 October 2026).
  if (!element) return null;
  const inspector = recordInspector({ props, state, readOnly, docs, element, diagram: diagram ?? NO_VIEW, onRequestDelete });
  return (
    <DocumentationPage
      element={element}
      model={state.model}
      diagram={diagram}
      readOnly={readOnly}
      nameLocked={inspector.owned?.fields.includes('name') === true}
      actions={state.actions}
      renderMarkdown={props.renderMarkdown}
      onAddImage={readOnly ? undefined : props.onAddImage}
      images={readOnly ? undefined : props.images}
      recordSections={(shown) => recordSectionsOf(shown, t).map((section) => ({
        id: section.id,
        heading: section.heading,
        children: <SectionThroughDoors inspector={inspector} section={section.id} />,
      }))}
      menu={elementMenu({ ...inspector, onRequestDelete: () => { docs.close(); onRequestDelete(element.id); } }, t, { drawing: true, kinds: false })}
      onNavigate={docs.open}
      onClose={docs.close}
      onOpenHistory={props.history?.onDescription
        ? () => props.history?.onDescription?.(element.id)
        : undefined}
      windowChrome={props.windowChrome}
      railWidth={{ value: docs.railWidth, onChange: docs.setRailWidth }}
    />
  );
}

/**
 * A record's section with its doors out — to a view, a plan, another page —
 * going through the surface it stands on: on the page they ask about a draft
 * before the page goes, and in the full-window editor's column of facts they are
 * that editor's Cancel first, so its text is put back rather than written
 * without Save (`useLeaveThrough`).
 */
function SectionThroughDoors({ inspector, section }: { inspector: ElementInspectorProps; section: Parameters<typeof RecordSectionBody>[0]['section'] }) {
  const through = useLeaveThrough();
  return <RecordSectionBody props={doorsThrough(inspector, through)} section={section} unit={inspector.unitSection?.section} />;
}

function doorsThrough(p: ElementInspectorProps, through: (go: () => void) => void): ElementInspectorProps {
  const via = <A extends unknown[]>(go: (...args: A) => void) => (...args: A) => through(() => go(...args));
  return {
    ...p,
    onRequestDelete: via(p.onRequestDelete),
    ...(p.onReplace ? { onReplace: via(p.onReplace) } : {}),
    ...(p.showOnTechnology ? { showOnTechnology: { ...p.showOnTechnology, open: via(p.showOnTechnology.open) } } : {}),
    ...(p.onCreateContainer ? { onCreateContainer: via(p.onCreateContainer) } : {}),
    ...(p.onCreateDrawing ? { onCreateDrawing: via(p.onCreateDrawing) } : {}),
    ...(p.onOpenDrawing ? { onOpenDrawing: via(p.onOpenDrawing) } : {}),
    ...(p.plans ? { plans: { ...p.plans, onOpen: via(p.plans.onOpen) } } : {}),
    ...(p.onOpenView ? { onOpenView: via(p.onOpenView) } : {}),
    ...(p.onNavigate ? { onNavigate: via(p.onNavigate) } : {}),
  };
}

/** What the record's rows are handed: what the panel beside the board is, and where each door goes from a page. */
function recordInspector({ props, state, readOnly, docs, element, diagram, onRequestDelete }: {
  props: SolutionDesignEditorProps;
  state: EditorState;
  readOnly: boolean;
  docs: Documentation;
  element: DesignElement;
  diagram: DesignDiagram;
  onRequestDelete(elementId: ElementId): void;
}): ElementInspectorProps {
  const { ownership, diagrams } = props;
  return {
    element,
    model: state.model,
    diagram,
    readOnly,
    actions: state.actions,
    onRequestDelete: () => { docs.leave(); onRequestDelete(element.id); },
    renderMarkdown: props.renderMarkdown,
    onRequestLogoUpload: readOnly ? undefined : props.logos?.onRequestUpload,
    onReplace: readOnly ? undefined : props.plans?.onReplace,
    owned: ownership?.ownerOf(element.id),
    move: moveFor(ownership, element.id),
    offeredBeyond: ownership?.offeredBeyond?.(element.id),
    leverage: ownership?.leverageOf?.(element.id),
    technology: ownership?.technology,
    parties: ownership?.parties,
    unitSection: element.kind === 'actor' ? ownership?.unitSection?.(element, readOnly) : undefined,
    answeredBy: ownership?.answeredBy?.(element),
    showOnTechnology: diagrams.showOnTechnology
      ? leavingFirst(diagrams.showOnTechnology, docs.leave)
      : undefined,
    onCreateContainer: readOnly ? undefined : diagrams.onCreateContainer,
    onCreateDrawing: !readOnly && diagrams.onCreateDrawingFor
      ? (id) => { docs.close(); diagrams.onCreateDrawingFor?.(id); }
      : undefined,
    onOpenDrawing: (diagrams.onOpenDrawing ?? props.document.onActiveDiagramChange)
      ? (id) => { docs.close(); (diagrams.onOpenDrawing ?? props.document.onActiveDiagramChange)(id); }
      : undefined,
    // The plan takes the page's place, at its own address, as a decision's *Linked to* does: Back comes back to this page.
    plans: props.plans ? { list: props.plans.list, onOpen: (id) => { docs.close(); props.plans?.onOpen(id); } } : undefined,
    onOpenView: (id) => { docs.close(); props.document.onActiveDiagramChange(id); },
    onNavigate: docs.open,
  };
}
