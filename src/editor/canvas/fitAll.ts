// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { getNodesBounds, getViewportForBounds, type Node, type Viewport } from '@xyflow/react';

/**
 * The options every "fit the board" shares.
 *
 * React Flow's fit counts only the nodes it has measured, and the canvas
 * virtualises: on a board of two thousand cards only the ones in view are
 * drawn, so a fit pressed while zoomed in on one card framed that one card.
 * `includeHiddenNodes` makes it fall back to a node's declared size — and
 * every node here declares one (`graph.ts`), so the whole board is what gets
 * framed, drawn or not.
 */
export const FIT_ALL = { padding: 0.1, includeHiddenNodes: true } as const;

/** How far the canvas zooms out and in; the first framing is held to the same. */
export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 2.5;

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
  return getViewportForBounds(bounds, width, height, MIN_ZOOM, MAX_ZOOM, FIT_ALL.padding);
}
