// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useCallback } from 'react';
import { getNodesBounds, useReactFlow, useStoreApi, type Node, type Viewport } from '@xyflow/react';
import type { Rect } from '../../model/types';
import { canvasInsets } from '../../widgets/kit/canvasRoom';
import { frameInRoom, NO_INSETS, ZOOM_CEILING, ZOOM_FLOOR } from '../../widgets/kit/zoom';
import type { Insets } from '../../widgets/kit/zoom';

/**
 * The options every "fit the board" shares.
 *
 * React Flow's fit counts only the nodes it has measured, and the canvas
 * virtualises: on a board of two thousand cards only the ones in view are
 * drawn, so a fit pressed while zoomed in on one card framed that one card.
 * `includeHiddenNodes` makes it fall back to a node's declared size — and
 * every node here declares one (`graph.ts`), so the whole board is what gets
 * framed, drawn or not. A fit stops at 100%: three cards fill no screen, and
 * one card at 250% is a magnified fragment, not the board.
 */
export const FIT_ALL = { padding: 0.1, includeHiddenNodes: true, maxZoom: 1 } as const;

/** How far the canvas zooms out and in, as every canvas does; the first framing is held to the same. */
export const MIN_ZOOM = ZOOM_FLOOR;
export const MAX_ZOOM = ZOOM_CEILING;

/**
 * The viewport that frames these nodes in a pane of this size, or `undefined`
 * when there is nothing to frame or nowhere to frame it.
 *
 * From the nodes' own positions and DECLARED sizes, through the pure
 * `getNodesBounds` — never the instance's, which reads what React Flow has
 * measured. Right after nodes land or move its store has measured none of them
 * yet, and a fit over nothing is maximum zoom on one corner: the first open of
 * a freshly laid-out board used to look exactly like that. The first framing
 * and the frame after a layout pass both come through here, so they cannot
 * disagree about what "the whole board" is.
 */
export function viewportOverNodes<N extends Node>(
  nodes: readonly N[],
  width: number,
  height: number,
  insets: Insets = NO_INSETS,
): Viewport | undefined {
  if (nodes.length === 0 || !(width > 0) || !(height > 0)) return undefined;
  const bounds = getNodesBounds([...nodes]);
  if (!(bounds.width > 0) || !(bounds.height > 0)) return undefined;
  return viewportOverRect(bounds, width, height, insets);
}

/**
 * The viewport that frames this rectangle of the board in a pane of this size, in
 * the room its dock and its key leave (`widgets/kit/canvasRoom`). A board too large
 * for the room even at the floor starts at its top left there, and the rest is a pan.
 */
export function viewportOverRect(rect: Rect, width: number, height: number, insets: Insets = NO_INSETS): Viewport | undefined {
  return frameInRoom(rect, { width, height }, insets, { floor: MIN_ZOOM, ceiling: FIT_ALL.maxZoom });
}

/**
 * Fit, for every way a board is asked to: the dock, ⇧ 1, the menus and a layout
 * pass. The room is read from the board as it is drawn now, since a key comes and
 * goes with the colouring; React Flow's own `fitView` knows nothing of the panels
 * over it, and framed the bottom row under the dock.
 */
export function useFitBoard(): (duration?: number) => void {
  const { getNodes, setViewport } = useReactFlow();
  const flow = useStoreApi();
  return useCallback((duration = 300) => {
    const { width, height, domNode } = flow.getState();
    const viewport = viewportOverNodes(getNodes(), width, height, domNode ? canvasInsets(domNode) : NO_INSETS);
    if (viewport) void setViewport(viewport, { duration });
  }, [flow, getNodes, setViewport]);
}
