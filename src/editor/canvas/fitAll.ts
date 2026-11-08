// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { getNodesBounds, useReactFlow, useStoreApi, type Node, type Viewport } from '@xyflow/react';
import type { Rect } from '../../model/types';
import { canvasRooms } from '../../widgets/kit/canvasRoom';
import { frameInRooms, NO_INSETS, ZOOM_CEILING, ZOOM_FLOOR } from '../../widgets/kit/zoom';
import type { Insets } from '../../widgets/kit/zoom';
import { textScale } from '../../widgets/kit/tokens';

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
  rooms: Insets | readonly Insets[] = NO_INSETS,
  sheet?: Rect,
): Viewport | undefined {
  if (nodes.length === 0 || !(width > 0) || !(height > 0)) return undefined;
  const bounds = getNodesBounds([...nodes]);
  if (!(bounds.width > 0) || !(bounds.height > 0)) return undefined;
  return viewportOverRect(sheet ? union(bounds, sheet) : bounds, width, height, rooms);
}

/** Both rectangles: a landscape's bands are drawn round its cards, and a frame that cut a band's top cut its heading. */
function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

/** The attribute a board's sheet carries, its rectangle in the board's own units, for a fit to frame it whole. */
export const CANVAS_SHEET = 'data-canvas-sheet';

/** The sheet drawn on this board, where it draws one. */
export function sheetOf(board: ParentNode): Rect | undefined {
  const said = board.querySelector(`[${CANVAS_SHEET}]`)?.getAttribute(CANVAS_SHEET)?.split(',').map(Number);
  if (!said || said.length !== 4 || said.some((one) => !Number.isFinite(one))) return undefined;
  const [x, y, width, height] = said as [number, number, number, number];
  return { x, y, width, height };
}

/**
 * The viewport that frames this rectangle of the board in a pane of this size, in
 * the room its dock and its key leave (`widgets/kit/canvasRoom`). A board too large
 * for the room even at the floor starts at its top left there, and the rest is a pan.
 */
export function viewportOverRect(rect: Rect, width: number, height: number, rooms: Insets | readonly Insets[] = NO_INSETS): Viewport | undefined {
  // At a larger text size the drawing is framed larger, all of it (`canvasZoomProps`): its floor and its 100% scale with it.
  const scale = textScale();
  return frameInRooms(rect, { width, height }, Array.isArray(rooms) ? rooms : [rooms as Insets], { floor: Math.min(MIN_ZOOM * scale, MAX_ZOOM), ceiling: Math.min(FIT_ALL.maxZoom * scale, MAX_ZOOM) });
}

/**
 * Fit, for every way a board is asked to: the dock, ⇧ 1, the menus and a layout
 * pass. The room is read from the board as it is drawn now, since a key comes and
 * goes with the colouring; React Flow's own `fitView` knows nothing of the panels
 * over it, and framed the bottom row under the dock.
 */
export function useFitBoard(options: { onPrint?: boolean } = {}): (duration?: number) => void {
  const { getNodes, setViewport } = useReactFlow();
  // The board's own canvas frames itself for the browser's Print as well; a dock's fit does not listen twice.
  usePrintFit(options.onPrint === true);
  const flow = useStoreApi();
  return useCallback((duration = 300) => {
    const { width, height, domNode } = flow.getState();
    const viewport = viewportOverNodes(getNodes(), width, height, domNode ? canvasRooms(domNode) : NO_INSETS, domNode ? sheetOf(domNode) : undefined);
    if (viewport) void setViewport(viewport, { duration });
  }, [flow, getNodes, setViewport]);
}

/**
 * The room a board is printed into, in CSS pixels: an A4 or Letter sheet
 * upright, inside the browser's own margins — the smallest sheet a person
 * prints on, so the board is whole on any of them.
 */
export const PRINT_ROOM = { width: 700, height: 940 } as const;

/** Room left round a printed board, in the sheet's pixels: a band's heading drawn over its top edge stays on it. */
const PRINT_MARGIN = 24;

/** The viewport that puts these nodes — and the sheet drawn round them, where there is one — whole into the print's room, top left, never over 100%. */
export function printViewport(nodes: readonly Node[], room: { width: number; height: number } = PRINT_ROOM, sheet?: Rect): Viewport | undefined {
  if (nodes.length === 0) return undefined;
  const nodeBounds = getNodesBounds([...nodes]);
  const bounds = sheet ? union(nodeBounds, sheet) : nodeBounds;
  if (!(bounds.width > 0) || !(bounds.height > 0)) return undefined;
  const zoom = Math.min((room.width - 2 * PRINT_MARGIN) / bounds.width, (room.height - 2 * PRINT_MARGIN) / bounds.height, 1);
  return { x: PRINT_MARGIN - bounds.x * zoom, y: PRINT_MARGIN - bounds.y * zoom, zoom };
}

/**
 * The browser's own Print — File › Print, or ⌘P while a dialog keeps the key
 * from Export — over a board: the board is framed whole on the sheet while it
 * prints, and put back where the person had it after. Without it the canvas
 * printed as it stood on the screen, cut at the sheet's right edge.
 */
export function usePrintFit(listening = true): void {
  const { getNodes, getViewport, setViewport } = useReactFlow();
  const flow = useStoreApi();
  useEffect(() => {
    if (!listening) return undefined;
    let was: Viewport | undefined;
    const before = () => {
      const { domNode } = flow.getState();
      const framed = printViewport(getNodes(), PRINT_ROOM, domNode ? sheetOf(domNode) : undefined);
      if (!framed) return;
      was = getViewport();
      // Drawn before the handler returns: the print is laid out as soon as it has.
      flushSync(() => { void setViewport(framed); });
    };
    const after = () => {
      if (was) void setViewport(was);
      was = undefined;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [getNodes, getViewport, setViewport, listening, flow]);
}
