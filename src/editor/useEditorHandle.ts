// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The editor as a host sees it: the handle it hands out (ADR-0007), and where
 * a double-click on a card or a line takes the reader.
 */
import { useCallback, useEffect } from 'react';
import type { DesignDiagram, ElementId, Rect } from '../model/types';
import { EditorRefused, type EditorHandle, type SolutionDesignEditorProps } from './props';
import { doubleClickTarget, lineDoubleClickTarget } from './doubleClick';
import { selectAllContent, type EditorState } from './useEditorState';
import type { DeleteRequests } from './useDeleteRequests';

export interface HandleArgs {
  onHandle: SolutionDesignEditorProps['onHandle'];
  state: EditorState;
  diagram: DesignDiagram | undefined;
  readOnly: boolean;
  busy: boolean;
  tidy(): Promise<void>;
  routeEdges(): Promise<void>;
  capture(options: { bounds: Rect; pixelRatio: number; padding: number }): Promise<Blob>;
  deletes: DeleteRequests;
  showShortcuts(): void;
}

/**
 * The handle, handed out whenever what it closes over changes and withdrawn
 * on unmount. `busy` is read at call time through the closure, so a pass
 * asked for while another runs is refused rather than silently dropped the
 * way the button's second press is.
 */
export function useEditorHandle(args: HandleArgs) {
  const { onHandle, state, diagram, readOnly, busy, tidy, routeEdges, capture, showShortcuts } = args;
  const { setDeleteTarget, requestDeleteConnection, requestDeleteSelection } = args.deletes;
  useEffect(() => {
    if (!onHandle) return;
    const handle: EditorHandle = {
      activeDiagramId: diagram?.id,
      busy,
      tidy: () => (busy ? Promise.reject(new EditorRefused('busy')) : tidy()),
      routeEdges: () => (busy ? Promise.reject(new EditorRefused('busy')) : routeEdges()),
      capture,
      // The same three doors the Delete key takes (`use-canvas-shortcuts`):
      // one element to the remove-or-delete question, a line and a selection
      // to the confirmation.
      deleteSelection: () => {
        if (readOnly || !diagram) return;
        if (state.selectedElement) setDeleteTarget(state.selectedElement.id);
        else if (state.selectedConnection) requestDeleteConnection(state.selectedConnection.id);
        else requestDeleteSelection(state.selection);
      },
      selectAll: () => { if (diagram) state.setSelection(selectAllContent(state.model, diagram)); },
      showShortcuts,
    };
    onHandle(handle);
    return () => onHandle(undefined);
  }, [onHandle, diagram, busy, tidy, routeEdges, capture, readOnly, state, setDeleteTarget, requestDeleteConnection, requestDeleteSelection, showShortcuts]);
}

/**
 * Where a double-click goes. On a card: its page, its owner's scope, its
 * container diagram, or the report of a platform or a service — a page, not
 * a board, handed to the host, which draws it (ADR-0013). On a landscape
 * line, the way down (ADR-0013): where this interface actually arrives, with
 * its landings selected — the target's container diagram, the source's
 * failing that, and nothing where neither exists.
 */
export function useDoubleClicks(
  props: Pick<SolutionDesignEditorProps, 'ownership' | 'document' | 'diagrams'>,
  state: EditorState,
  diagram: DesignDiagram | undefined,
  openDocumentation: (elementId: ElementId) => void,
) {
  const handleLineDoubleClick = useCallback((relationId: string) => {
    if (!diagram) return;
    const target = lineDoubleClickTarget(state.model, diagram, relationId);
    if (!target) return;
    // Selected first, then the switch: the selection is pruned by what the
    // model holds rather than by what the board draws, so it survives.
    state.setSelection({ elementIds: [], connectionIds: [...target.select], domainGroups: [] });
    props.document.onActiveDiagramChange(target.diagramId);
  }, [state, diagram, props.document]);

  const { ownership, document, diagrams } = props;
  const handleDoubleClick = useCallback((elementId: ElementId) => {
    const target = doubleClickTarget(state.model, elementId, ownership);
    switch (target?.kind) {
      case 'documentation': openDocumentation(elementId); return;
      case 'owner': target.show(); return;
      case 'container': document.onActiveDiagramChange(target.diagramId); return;
      case 'platformReport': diagrams.onOpenPlatformReport?.(target.platformId); return;
      case 'serviceReport': diagrams.onOpenServiceReport?.(target.serviceId); return;
      default: return;
    }
  }, [state.model, ownership, document, diagrams, openDocumentation]);

  return { handleLineDoubleClick, handleDoubleClick };
}
