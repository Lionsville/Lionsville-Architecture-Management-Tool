// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The requests the editor passes along as a nonce: open the menu, rename an
 * element, focus one, open its page. Each is handled once by whoever receives
 * it; the nonce is what tells a new request from the same one seen again.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DesignDiagram, ElementId } from '../model/types';
import { placedNodes } from '../model/placement';
import type { EditorRequests, SolutionDesignEditorProps } from './props';
import { selectElement, type EditorState } from './useEditorState';
import { useFocusElement } from './useFocusElement';
import { FIELDS_COLUMN } from '../documentation/ui/DocumentationPage';

/** Is `next` a request not yet adopted? A host re-asks for the same element by bumping only the nonce. */
export function isNewRequest(
  seen: { id: ElementId; nonce: number } | undefined,
  next: { id: ElementId; nonce: number } | undefined,
): next is { id: ElementId; nonce: number } {
  if (!next) return false;
  return !(seen && seen.id === next.id && seen.nonce === next.nonce);
}

/**
 * Keyboard-driven menu requests (Shift+F10 opens the menu for the selection,
 * F2 renames it), the inspector's rename, and ONE focus request fed by two
 * sources: the host's `focusElement` and the editor's own ⌘F finder.
 *
 * ⌘F must do exactly what a host's click-to-focus does — select, switch
 * diagram when the element lives on another one, pan and zoom — so it goes
 * through the same `useFocusElement` rather than a second, nearly-right
 * implementation. Both are re-stamped with a nonce from ONE counter here: the
 * two nonce spaces are unrelated, so comparing them would be meaningless and
 * a collision would make `useFocusElement` skip a request as already handled.
 * Re-stamping makes the ordering real: last request wins, whoever made it.
 */
export function useCanvasRequests(
  props: Pick<SolutionDesignEditorProps, 'requests' | 'document'>,
  state: EditorState,
  setInspectorCollapsed: (collapsed: boolean) => void,
) {
  const [menuRequest, setMenuRequest] = useState<{ kind: 'open' | 'rename'; nonce: number } | undefined>(undefined);
  const menuNonce = useRef(0);
  const [renameRequest, setRenameRequest] = useState<{ id: ElementId; nonce: number } | undefined>(undefined);
  const [focusRequest, setFocusRequest] = useState<{ id: ElementId; nonce: number } | undefined>(undefined);
  const focusNonce = useRef(0);
  // Starts EMPTY, not at the prop: an editor mounted with a request already on
  // it must adopt that request rather than take it for one already seen.
  const hostFocusRef = useRef<EditorRequests['focus']>(undefined);

  const { setSelection } = state;
  // Select it, make sure the inspector is open, and ask the inspector to
  // focus its Name field. Cleared once the selection moves on, so a request
  // never outlives the element it was about.
  const requestRename = useCallback((elementId: ElementId) => {
    setSelection(selectElement(elementId));
    setInspectorCollapsed(false);
    menuNonce.current += 1;
    setRenameRequest({ id: elementId, nonce: menuNonce.current });
  }, [setSelection, setInspectorCollapsed]);
  const selectedElementId = state.selectedElement?.id;
  useEffect(() => {
    if (renameRequest && renameRequest.id !== selectedElementId) setRenameRequest(undefined);
  }, [renameRequest, selectedElementId]);

  const requestMenu = useCallback((kind: 'open' | 'rename') => {
    menuNonce.current += 1;
    setMenuRequest({ kind, nonce: menuNonce.current });
  }, []);
  const requestFocus = useCallback((elementId: ElementId) => {
    focusNonce.current += 1;
    setFocusRequest({ id: elementId, nonce: focusNonce.current });
  }, []);

  const hostFocus = props.requests?.focus;
  useEffect(() => {
    if (!isNewRequest(hostFocusRef.current, hostFocus)) return;
    hostFocusRef.current = hostFocus;
    requestFocus(hostFocus.id);
  }, [hostFocus, requestFocus]);

  useFocusElement({
    focusElement: focusRequest,
    model: state.model,
    activeDiagramId: props.document.activeDiagramId,
    setSelection,
    onActiveDiagramChange: props.document.onActiveDiagramChange,
  });
  return { menuRequest, requestMenu, renameRequest, requestRename, requestFocus };
}

export type CanvasRequests = ReturnType<typeof useCanvasRequests>;

/**
 * The documentation page: which element's is open, the view it lists the
 * neighbours of, and the width of its fields column — session state, never
 * saved, and kept here because the page is remounted per element.
 *
 * Opening a page selects the element as well, so closing it lands the reader
 * on the thing they were reading about, with its inspector open. A stand-in's
 * page is the owner's page: the description is maintained where the thing is
 * defined, so every way to the page — the menu, a link in a document, the
 * inspector — goes there.
 */
export function useDocumentation(
  props: Pick<SolutionDesignEditorProps, 'requests' | 'ownership'>,
  state: EditorState,
  activeDiagram: DesignDiagram | undefined,
) {
  const [documentationId, setDocumentationId] = useState<ElementId | undefined>(undefined);
  const [diagramId, setDiagramId] = useState<string | undefined>(undefined);
  const [fieldsWidth, setFieldsWidth] = useState<number>(FIELDS_COLUMN.default);
  const { setSelection } = state;
  const open = useCallback((elementId: ElementId) => {
    const held = state.model.elements.find((e) => e.id === elementId);
    const away = held?.ref !== undefined ? props.ownership?.ownerOf(elementId)?.onDocument : undefined;
    if (away) { away(); return; }
    setSelection(selectElement(elementId));
    setDocumentationId(elementId);
  }, [setSelection, state.model.elements, props.ownership]);
  useHostDocumentation(props.requests?.documentation, state, activeDiagram, open, setDiagramId);

  const close = () => { setDocumentationId(undefined); setDiagramId(undefined); };
  // An element deleted (or undone out of existence) while its page is open
  // simply has no page any more.
  const diagram = (diagramId !== undefined ? state.model.diagrams.find((d) => d.id === diagramId) : undefined) ?? activeDiagram;
  const element = documentationId ? state.model.elements.find((e) => e.id === documentationId) : undefined;
  return { open, close, leave: () => setDocumentationId(undefined), element, diagram, fieldsWidth, setFieldsWidth };
}

export type Documentation = ReturnType<typeof useDocumentation>;

/**
 * The host's "open the documentation" — the same nonce discipline as focus.
 * Resolving WHICH element happens here rather than in the host, because the
 * selection is the editor's and a host cannot see it: the one named, else the
 * selection, else the first on the board, else the first in the model.
 */
function useHostDocumentation(
  hostDoc: EditorRequests['documentation'],
  state: EditorState,
  activeDiagram: DesignDiagram | undefined,
  open: (elementId: ElementId) => void,
  setDiagramId: (diagramId: string | undefined) => void,
) {
  const hostDocRef = useRef<EditorRequests['documentation']>(undefined);
  const selected = state.selectedElement?.id;
  const firstPlaced = activeDiagram && placedNodes(activeDiagram)[0]?.id;
  const firstInModel = state.model.elements[0]?.id;
  useEffect(() => {
    if (!hostDoc) return;
    if (hostDocRef.current && hostDocRef.current.nonce === hostDoc.nonce) return;
    hostDocRef.current = hostDoc;
    const id = hostDoc.elementId ?? selected ?? firstPlaced ?? firstInModel;
    if (!id) return;
    setDiagramId(hostDoc.diagramId);
    open(id);
  }, [hostDoc, selected, firstPlaced, firstInModel, open, setDiagramId]);
}
