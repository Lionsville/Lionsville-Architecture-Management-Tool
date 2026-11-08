// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A card's lines come next after it in the tab order (4.0.0 review, C9). React
 * Flow draws every line ahead of every card, so the lines of the card selected,
 * which take a tab, sat before all of the cards: Tab from a card went on to the
 * next card, and its lines were two dozen Shift+Tabs away. Tab on the selected
 * card now goes to its first line, from line to line, and from its last line on
 * to the card after it; Shift+Tab walks the same way back to the card.
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useStoreApi } from '@xyflow/react';

const quoted = (id: string) => `"${id.replace(/["\\]/g, '\\$&')}"`;

/** The order a Tab walks from a card: the card, its lines that take a tab, then on. Pure, for the test. */
export function tabAfterCard(
  at: { kind: 'card' | 'line'; id: string },
  card: string,
  lines: readonly string[],
  back: boolean,
): { kind: 'card' | 'line'; id: string } | 'after' | undefined {
  const walk: { kind: 'card' | 'line'; id: string }[] = [{ kind: 'card', id: card }, ...lines.map((id) => ({ kind: 'line' as const, id }))];
  const here = walk.findIndex((one) => one.kind === at.kind && one.id === at.id);
  if (here < 0 || lines.length === 0) return undefined;
  const next = here + (back ? -1 : 1);
  if (next < 0) return undefined;
  return next >= walk.length ? 'after' : walk[next];
}

export function useLinesAfterCard(container: RefObject<HTMLDivElement | null>): void {
  const flow = useStoreApi();
  useEffect(() => {
    const element = container.current;
    if (!element) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.altKey || event.metaKey || event.ctrlKey || event.defaultPrevented) return;
      const active = document.activeElement as HTMLElement | null;
      const node = active?.closest<HTMLElement>('.react-flow__node');
      const edge = active?.closest<HTMLElement>('.react-flow__edge');
      const { nodes, edges } = flow.getState();
      const selected = nodes.filter((one) => one.selected).map((one) => one.id);
      const at = node?.dataset.id !== undefined ? { kind: 'card' as const, id: node.dataset.id } : edge?.dataset.id !== undefined ? { kind: 'line' as const, id: edge.dataset.id } : undefined;
      if (!at) return;
      const home = at.kind === 'card' ? at.id : selected.find((id) => edges.some((one) => one.id === at.id && (one.source === id || one.target === id)));
      if (home === undefined || !selected.includes(home)) return;
      const lines = [...element.querySelectorAll<HTMLElement>('.react-flow__edge[tabindex="0"]')]
        .map((one) => one.dataset.id ?? '')
        .filter((id) => edges.some((one) => one.id === id && (one.source === home || one.target === home)));
      const next = tabAfterCard(at, home, lines, event.shiftKey);
      if (next === undefined) return;
      let target: HTMLElement | null | undefined;
      if (next === 'after') {
        const cards = [...element.querySelectorAll<HTMLElement>('.react-flow__node[tabindex="0"]')];
        target = cards[cards.findIndex((one) => one.dataset.id === home) + 1];
      } else {
        target = element.querySelector<HTMLElement>(`.react-flow__${next.kind === 'card' ? 'node' : 'edge'}[data-id=${quoted(next.id)}]`);
      }
      if (!target) return;
      event.preventDefault();
      target.focus();
    };
    element.addEventListener('keydown', onKey);
    return () => element.removeEventListener('keydown', onKey);
  }, [container, flow]);
}
