// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useEffect } from 'react';
import { useStore, useStoreApi } from '@xyflow/react';
import { spreadLabels } from '../../widgets/kit/labelSpread';
import { useRouteEditing } from './RouteEditingContext';

/** After the zoom has settled, not at each step of it. */
const SETTLE_MS = 80;

/**
 * Keeps the labels on a canvas clear of each other and of its cards: measured, because how much a
 * label takes depends on its words, the language and the zoom, and written straight
 * on the label, so that moving them renders no line. A label a person placed is one
 * like any other: it moves off another only as far as it must.
 */
export function LabelSpread({ maxMove }: { /** On screen: how far from its line a label may go. */ maxMove?: number } = {}) {
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
      const nudged = (label: HTMLElement) => Number.parseFloat(label.style.getPropertyValue('--lv-nudge-y')) || 0;
      const boxes = labels.map((label, index) => {
        const inner = (label.firstElementChild ?? label).getBoundingClientRect();
        return { id: String(index), x: inner.x, y: inner.y - nudged(label) * zoom, width: inner.width, height: inner.height };
      });
      const cards = [...root.querySelectorAll<HTMLElement>('.react-flow__node:not(.react-flow__node-applicationBoundary)')].map((card, index) => {
        const box = card.getBoundingClientRect();
        return { id: `card${index}`, x: box.x, y: box.y, width: box.width, height: box.height };
      });
      const moved = spreadLabels(boxes, cards, maxMove);
      labels.forEach((label, index) => {
        const by = moved.get(String(index));
        if (by === undefined) label.style.removeProperty('--lv-nudge-y');
        else label.style.setProperty('--lv-nudge-y', `${by / zoom}px`);
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
    const chip = (node: Node) => node instanceof HTMLElement && (node.classList.contains('lv-edge-chip') || node.querySelector('.lv-edge-chip') !== null);
    const root = flow.getState().domNode;
    const watch = typeof MutationObserver === 'undefined' || !root ? undefined : new MutationObserver((changes) => {
      if (changes.some((change) => [...change.addedNodes].some(chip))) spread();
    });
    if (root) watch?.observe(root, { childList: true, subtree: true });
    return () => { clearTimeout(timer); unsubscribe(); watch?.disconnect(); };
  }, [flow, edges, showLabels, maxMove]);
  return null;
}
