// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The editor as a host sees it: the handle it hands out (ADR-0007), and where
 * a double-click on a card or a line takes the reader.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CommandMeta } from '../model/commands';
import type { DesignDiagram, ElementId, Rect } from '../model/types';
import { useStrings } from '../i18n/LanguageContext';
import type { Translate } from '../i18n/strings';
import { EditorRefused, type EditorHandle, type SolutionDesignEditorProps } from './props';
import { doubleClickTarget, lineDoubleClickTarget } from './doubleClick';
import type { DoubleClickTarget, DrawingOffer } from './doubleClick';
import { selectAllContent, type EditorState } from './useEditorState';
import type { DeleteRequests } from './useDeleteRequests';

export interface HandleArgs {
  onHandle: SolutionDesignEditorProps['onHandle'];
  state: EditorState;
  diagram: DesignDiagram | undefined;
  /** The board as drawn, where it is not `diagram`: see `EditorHandle.drawn`. */
  drawn?: DesignDiagram;
  readOnly: boolean;
  busy: boolean;
  tidy(meta?: CommandMeta): Promise<void>;
  routeEdges(meta?: CommandMeta): Promise<void>;
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
  const { onHandle, state, diagram, drawn, readOnly, busy, tidy, routeEdges, capture, showShortcuts } = args;
  const { setDeleteTarget, requestDeleteConnection, requestDeleteSelection } = args.deletes;
  useEffect(() => {
    if (!onHandle) return;
    const handle: EditorHandle = {
      activeDiagramId: diagram?.id,
      busy,
      ...(drawn ? { drawn } : {}),
      tidy: (meta) => (busy ? Promise.reject(new EditorRefused('busy')) : tidy(meta)),
      routeEdges: (meta) => (busy ? Promise.reject(new EditorRefused('busy')) : routeEdges(meta)),
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
  }, [onHandle, diagram, drawn, busy, tidy, routeEdges, capture, readOnly, state, setDeleteTarget, requestDeleteConnection, requestDeleteSelection, showShortcuts]);
}

/** One place a double-click can open, when the element has more than one. */
export type InsideOffer = { key: string; label: string; open: () => void };

/**
 * Where a double-click goes. On a card: its page, its owner's scope, its
 * container diagram, the drawings anchored to it, or the report of a platform
 * or a service — a page, not a board, handed to the host, which draws it
 * (ADR-0013). One place opens at once. Several are offered, and nothing is
 * made. On a landscape line, the way down (ADR-0013): where this interface
 * actually arrives, with its landings selected — the target's container
 * diagram, the source's failing that, and nothing where neither exists.
 */
export function useDoubleClicks(
  props: Pick<SolutionDesignEditorProps, 'ownership' | 'document' | 'diagrams'>,
  state: EditorState,
  diagram: DesignDiagram | undefined,
  openDocumentation: (elementId: ElementId) => void,
) {
  const { t } = useStrings();
  const [offers, setOffers] = useState<readonly InsideOffer[] | undefined>(undefined);
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
  const openDiagram = useCallback((id: string) => {
    const held = state.model.diagrams.find((one) => one.id === id);
    if (held?.kind === 'drawing' && diagrams.onOpenDrawing) diagrams.onOpenDrawing(id);
    else document.onActiveDiagramChange(id);
  }, [state.model.diagrams, diagrams, document]);
  const handleDoubleClick = useCallback((elementId: ElementId) => {
    const target = doubleClickTarget(state.model, elementId, ownership);
    if (!target) return;
    const places = placesOf(target, elementId, { t, openDocumentation, openDiagram, diagrams });
    if (places.length === 0) return;
    if (places.length === 1) { places[0].open(); return; }
    setOffers(places);
  }, [state.model, ownership, t, openDocumentation, openDiagram, diagrams]);

  const dismissOffers = useCallback(() => setOffers(undefined), []);
  return { handleLineDoubleClick, handleDoubleClick, offers, dismissOffers };
}

/**
 * The places a double-click offers. One is opened at once; more than one is
 * a choice. Drawings sit beside the container view, the page, or the report.
 */
function placesOf(
  target: DoubleClickTarget,
  elementId: ElementId,
  open: {
    t: Translate;
    openDocumentation: (elementId: ElementId) => void;
    openDiagram: (id: string) => void;
    diagrams: Pick<SolutionDesignEditorProps['diagrams'], 'onOpenPlatformReport' | 'onOpenServiceReport'>;
  },
): InsideOffer[] {
  const { t, openDocumentation, openDiagram, diagrams } = open;
  const places: InsideOffer[] = [];
  switch (target.kind) {
    case 'documentation':
      places.push({ key: 'documentation', label: t('menu.openDocumentation'), open: () => openDocumentation(elementId) });
      break;
    case 'owner':
      places.push({ key: 'owner', label: t('menu.openOwner'), open: target.show });
      break;
    case 'container':
      places.push({ key: `container:${target.diagramId}`, label: t('menu.openContainer'), open: () => openDiagram(target.diagramId) });
      break;
    case 'platformReport':
      places.push({
        key: `platform:${target.platformId}`, label: t('menu.platformReport'),
        open: () => diagrams.onOpenPlatformReport?.(target.platformId),
      });
      break;
    case 'serviceReport':
      places.push({
        key: `service:${target.serviceId}`, label: t('menu.serviceReport'),
        open: () => diagrams.onOpenServiceReport?.(target.serviceId),
      });
      break;
    case 'drawings':
      break;
    default: {
      const unexpected: never = target;
      return unexpected;
    }
  }
  for (const drawing of drawingsOf(target)) {
    places.push({ key: `drawing:${drawing.id}`, label: drawing.name, open: () => openDiagram(drawing.id) });
  }
  return places;
}

function drawingsOf(target: DoubleClickTarget): readonly DrawingOffer[] {
  return target.kind === 'drawings' ? target.drawings : target.drawings ?? [];
}
