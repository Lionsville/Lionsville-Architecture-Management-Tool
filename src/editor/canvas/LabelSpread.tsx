// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useEffect } from 'react';
import { useStore, useStoreApi } from '@xyflow/react';
import { slideAlong, spreadLabels } from '../../widgets/kit/labelSpread';
import { useRouteEditing } from './RouteEditingContext';

/** After the zoom has settled, not at each step of it. */
const SETTLE_MS = 80;

/**
 * Keeps the labels on a canvas clear of each other and of its cards: measured, because how much a
 * label takes depends on its words, the language and the zoom, and written straight
 * on the label, so that moving them renders no line. A label a person placed is one
 * like any other: it moves off another only as far as it must.
 */
export function LabelSpread({ maxMove, alongLine = false }: {
  /** On screen: how far from its line a label may go. */ maxMove?: number
  /** A label that covers a box first slides along its own line to where it is clear, and only then spreads. */
  alongLine?: boolean
} = {}) {
  const flow = useStoreApi();
  const edges = useStore((state) => state.edges);
  // Turning the labels on adds them all with no line changing.
  const { showLabels } = useRouteEditing();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const spread = () => {
      const root = flow.getState().domNode;
      if (!root) return;
      // One the distance hides has no box to keep clear.
      const labels = [...root.querySelectorAll<HTMLElement>('.lv-edge-chip')].filter((label) => label.getClientRects().length > 0);
      const zoom = flow.getState().transform[2] || 1;
      const nudged = (label: HTMLElement, axis: 'x' | 'y') => Number.parseFloat(label.style.getPropertyValue(`--lv-nudge-${axis}`)) || 0;
      const unmoved = labels.map((label, index) => {
        const inner = (label.firstElementChild ?? label).getBoundingClientRect();
        return { id: String(index), x: inner.x - nudged(label, 'x') * zoom, y: inner.y - nudged(label, 'y') * zoom, width: inner.width, height: inner.height };
      });
      const cards = [...root.querySelectorAll<HTMLElement>('.react-flow__node:not(.react-flow__node-applicationBoundary)')].map((card, index) => {
        const box = card.getBoundingClientRect();
        return { id: `card${index}`, x: box.x, y: box.y, width: box.width, height: box.height };
      });
      // A selected line's pills are kept clear too: its chip has stepped off them, and a spread that put it back would cut it again.
      const pills = [...root.querySelectorAll<HTMLElement>('.lv-edge-pill > *')].map((pill, index) => {
        const box = pill.getBoundingClientRect();
        return { id: `pill${index}`, x: box.x, y: box.y, width: box.width, height: box.height };
      });
      const slid = labels.map((label, index) => (alongLine ? slideAlong(unmoved[index], lineOf(root, label), cards) : undefined));
      const boxes = unmoved.map((box, index) => ({ ...box, x: box.x + (slid[index]?.dx ?? 0), y: box.y + (slid[index]?.dy ?? 0) }));
      const moved = spreadLabels(boxes, [...cards, ...pills], maxMove);
      labels.forEach((label, index) => {
        const x = slid[index]?.dx ?? 0;
        const y = (slid[index]?.dy ?? 0) + (moved.get(String(index)) ?? 0);
        if (x === 0) label.style.removeProperty('--lv-nudge-x');
        else label.style.setProperty('--lv-nudge-x', `${x / zoom}px`);
        if (y === 0) label.style.removeProperty('--lv-nudge-y');
        else label.style.setProperty('--lv-nudge-y', `${y / zoom}px`);
      });
    };
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(spread, SETTLE_MS);
    };
    soon();
    let zoom = flow.getState().transform[2];
    const unsubscribe = flow.subscribe((state) => {
      if (state.transform[2] !== zoom) { zoom = state.transform[2]; soon(); }
    });
    // A label that comes up on its own, under the pointer, is kept clear at once, before it
    // is painted: it stood where nothing moved it, and jumped when its line was then selected.
    const chip = (node: Node) => node instanceof HTMLElement && (node.matches('.lv-edge-chip, .lv-edge-pill') || node.querySelector('.lv-edge-chip, .lv-edge-pill') !== null);
    const root = flow.getState().domNode;
    const watch = typeof MutationObserver === 'undefined' || !root ? undefined : new MutationObserver((changes) => {
      if (changes.some((change) => [...change.addedNodes].some(chip))) spread();
    });
    if (root) watch?.observe(root, { childList: true, subtree: true });
    return () => { clearTimeout(timer); unsubscribe(); watch?.disconnect(); };
  }, [flow, edges, showLabels, maxMove, alongLine]);
  return null;
}

/** How many points along a line a label may stand at. */
const LINE_SAMPLES = 48;

/** Points along the line a label says, on screen. */
function lineOf(root: Element, label: HTMLElement): { x: number; y: number }[] {
  const id = label.dataset.testid?.replace(/^edge-label-/u, '');
  const path = id === undefined ? null : root.querySelector<SVGPathElement>(`[data-testid="rf__edge-${CSS.escape(id)}"] path.react-flow__edge-path`);
  const matrix = path?.getScreenCTM();
  if (!path || !matrix || typeof path.getTotalLength !== 'function') return [];
  const length = path.getTotalLength();
  return Array.from({ length: LINE_SAMPLES + 1 }, (_, i) => {
    const point = path.getPointAtLength((length * i) / LINE_SAMPLES);
    return { x: matrix.a * point.x + matrix.c * point.y + matrix.e, y: matrix.b * point.x + matrix.d * point.y + matrix.f };
  });
}
