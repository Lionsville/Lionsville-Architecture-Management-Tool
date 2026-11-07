// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { getNodesBounds, getViewportForBounds, type Node, type Viewport } from '@xyflow/react';
import type { Rect } from '../../model/types';
import { ZOOM_CEILING, ZOOM_FLOOR } from '../../widgets/kit/zoom';

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
): Viewport | undefined {
  if (nodes.length === 0 || !(width > 0) || !(height > 0)) return undefined;
  const bounds = getNodesBounds([...nodes]);
  if (!(bounds.width > 0) || !(bounds.height > 0)) return undefined;
  return viewportOverRect(bounds, width, height);
}

/** The viewport that frames this rectangle of the board in a pane of this size. */
export function viewportOverRect(rect: Rect, width: number, height: number): Viewport {
  return getViewportForBounds(rect, width, height, MIN_ZOOM, FIT_ALL.maxZoom, FIT_ALL.padding);
}
