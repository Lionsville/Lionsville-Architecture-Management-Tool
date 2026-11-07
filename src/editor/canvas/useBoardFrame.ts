// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a board stands when it is first shown, and how far off it is read.
 *
 * The frame is worked out before anything is drawn: from the nodes' own positions
 * and declared sizes, in the layout effect, with the drawing hidden until then.
 * There is no fit of React Flow's to race with, and nothing is animated, so a first
 * open cannot paint one corner at full zoom and then fly out of it. A board whose
 * members nobody has placed yet stays hidden until the pass has placed them, since
 * a frame over members all at one point is that same corner; a pass that never ends
 * lets it go after a while, with what there is.
 *
 * The distance is written straight on the canvas's element, because a zoom must not
 * render the cards: Card, Zone and Line read it through CSS (`canvasZoomProps`).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useStoreApi, type Node, type Viewport } from '@xyflow/react';
import { canvasZoomProps } from '../../widgets/kit/zoom';
import type { Rect } from '../../model/types';
import { viewportOverNodes, viewportOverRect } from './fitAll';

/** How long a board waits for a layout pass before it is shown as it stands. */
const LAYOUT_WAIT_MS = 5000;
/** A canvas with no size yet is asked again, a frame at a time, for about a second. */
const SIZE_TRIES = 60;

export function useBoardFrame({ container, nodes, kept, awaiting, ready, emptyFrame, setViewport }: {
  container: RefObject<HTMLDivElement | null>;
  nodes: readonly Node[];
  /** Where this board was left earlier in the session: it goes back there, as React Flow's default. */
  kept: Viewport | undefined;
  /** Nobody has placed its members yet, and a pass is on its way. */
  awaiting: boolean;
  /** React Flow can take a viewport. */
  ready: boolean;
  /** What to frame on a board with nothing on it: its sheet. */
  emptyFrame?: Rect;
  setViewport: (viewport: Viewport) => unknown;
}): { framed: boolean } {
  const flow = useStoreApi();
  const [framed, setFramed] = useState(kept !== undefined);
  const settled = useRef(kept !== undefined);
  const latest = useRef({ nodes, emptyFrame, setViewport });
  latest.current = { nodes, emptyFrame, setViewport };

  useLayoutEffect(() => {
    if (settled.current || !ready || awaiting) return undefined;
    let cancelled = false;
    let tries = 0;
    const frame = () => {
      if (cancelled) return;
      const box = container.current?.getBoundingClientRect();
      const { width: paneWidth, height: paneHeight } = flow.getState();
      // What React Flow has measured where the element says nothing yet.
      const width = box?.width || paneWidth;
      const height = box?.height || paneHeight;
      if ((width === 0 || height === 0) && tries++ < SIZE_TRIES) {
        requestAnimationFrame(frame);
        return;
      }
      settled.current = true;
      const { nodes: held, emptyFrame: sheet, setViewport: put } = latest.current;
      if (width > 0 && height > 0) {
        const viewport = held.length > 0
          ? viewportOverNodes(held, width, height)
          : sheet && viewportOverRect(sheet, width, height);
        if (viewport) put(viewport);
      }
      setFramed(true);
    };
    frame();
    return () => { cancelled = true; };
  }, [ready, awaiting, container, flow]);

  useEffect(() => {
    if (!awaiting || framed) return undefined;
    const timer = setTimeout(() => setFramed(true), LAYOUT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [awaiting, framed]);

  return { framed };
}

/** Keeps the canvas's element told how far the reader is, with no render. */
export function useReadingDistance(container: RefObject<HTMLDivElement | null>): void {
  const flow = useStoreApi();
  useLayoutEffect(() => {
    let last = Number.NaN;
    const apply = (zoom: number) => {
      const element = container.current;
      if (!element || zoom === last || element.dataset.capturing) return;
      last = zoom;
      const said = canvasZoomProps(zoom);
      element.dataset.distance = said['data-distance'];
      element.dataset.labels = said['data-labels'];
      element.style.setProperty('--canvas-zoom', said.style['--canvas-zoom']);
    };
    apply(flow.getState().transform[2]);
    return flow.subscribe((state) => apply(state.transform[2]));
  }, [flow, container]);
}

/**
 * A picture is drawn at its own size, whatever the window's zoom: the capture
 * inlines what is computed, so the canvas is told so for as long as it takes.
 */
export function atFullSize(element: Element | null | undefined): () => void {
  const canvas = element?.closest<HTMLElement>('[data-distance]');
  if (!canvas) return () => undefined;
  const { distance, labels } = canvas.dataset;
  const zoom = canvas.style.getPropertyValue('--canvas-zoom');
  canvas.dataset.capturing = 'true';
  canvas.dataset.distance = 'middle';
  canvas.dataset.labels = 'words';
  canvas.style.setProperty('--canvas-zoom', '1');
  return () => {
    delete canvas.dataset.capturing;
    if (distance) canvas.dataset.distance = distance;
    if (labels) canvas.dataset.labels = labels;
    canvas.style.setProperty('--canvas-zoom', zoom);
  };
}
