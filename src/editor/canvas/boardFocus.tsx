// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a card talks to, answered on the canvas: selecting or pointing at a card
 * keeps it, its lines and its neighbours, and everything else recedes. Nothing moves.
 *
 * A board draws hundreds of cards and a pointer crosses them all, so none of them
 * renders for it. What recedes is said in a stylesheet that names what is kept, and
 * only a line whose label should come up asks whether it is. Ink, not opacity, on
 * what is written: a faded word is a word nobody can read.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Edge } from '@xyflow/react';

export type BoardFocusState = { nodes: ReadonlySet<string>; lines: ReadonlySet<string> };

/** What stays for these cards and these lines, from the lines the board draws. */
export function focusOf(
  elements: Iterable<string>,
  selectedLines: Iterable<string>,
  edges: readonly Pick<Edge, 'id' | 'source' | 'target'>[],
): BoardFocusState | null {
  const cards = new Set(elements);
  const picked = new Set(selectedLines);
  if (cards.size === 0 && picked.size === 0) return null;
  const nodes = new Set(cards);
  const lines = new Set(picked);
  for (const edge of edges) {
    if (cards.has(edge.source) || cards.has(edge.target) || picked.has(edge.id)) {
      lines.add(edge.id);
      nodes.add(edge.source);
      nodes.add(edge.target);
    }
  }
  return { nodes, lines };
}

export class BoardFocus {
  private state: BoardFocusState | null = null;
  private readonly listeners = new Set<() => void>();

  set(next: BoardFocusState | null): void {
    if (next === this.state) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  readonly get = (): BoardFocusState | null => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
}

const noFocus = new BoardFocus();
export const BoardFocusContext = createContext<BoardFocus>(noFocus);
export const BoardFocusProvider = BoardFocusContext.Provider;

/** Whether this line stays under the focus. A label comes up for one that does. */
export function useLineInFocus(id: string): boolean {
  const focus = useContext(BoardFocusContext);
  return useSyncExternalStore(focus.subscribe, () => focus.get()?.lines.has(id) ?? false);
}

/** Whether something is in focus and this line is not: its label recedes with it, by its ink. */
export function useLineDimmed(id: string): boolean {
  const focus = useContext(BoardFocusContext);
  return useSyncExternalStore(focus.subscribe, () => {
    const state = focus.get();
    return state !== null && !state.lines.has(id);
  });
}

const quoted = (id: string) => `[data-id="${id.replace(/["\\]/g, '\\$&')}"]`;

/** Everything but what is kept, in one rule each: the ink of a card, its marks, a line. */
export function focusSheet(state: BoardFocusState): string {
  const not = (ids: ReadonlySet<string>) => (ids.size > 0 ? `:not(${[...ids].map(quoted).join(',')})` : '');
  const node = `.lv-board:not([data-capturing]) .react-flow__node${not(state.nodes)}`;
  const line = `.lv-board:not([data-capturing]) .react-flow__edge${not(state.lines)}`;
  return [
    `${node} .kit-card{color:var(--ink-dim);border-color:var(--line)}`,
    `${node} .kit-card__sub,${node} .kit-card__about{color:inherit}`,
    `${node} .kit-card__marks,${node} .kit-card__lead{opacity:var(--dim-opacity)}`,
    `${line}{opacity:var(--focus-fade)}`,
  ].join('\n');
}

/** The sheet for what is in focus, while something is. */
export function BoardFocusSheet({ focus }: { focus: BoardFocus }) {
  const state = useSyncExternalStore(focus.subscribe, focus.get);
  const sheet = useMemo(() => (state ? focusSheet(state) : ''), [state]);
  return sheet ? <style data-lv-focus>{sheet}</style> : null;
}

/** How long a pointer rests on a card before the board answers: crossing a board asks nothing. */
const HOVER_REST_MS = 120;

/**
 * Keeps the focus told what is selected and what the pointer rests on. A selection
 * wins over a pointer, and the lines are read when asked, so a pass over the board
 * renders nothing but the labels that come up.
 */
export function useBoardFocusing(
  selectedElements: ReadonlySet<string>,
  selectedLines: ReadonlySet<string>,
  edges: readonly Pick<Edge, 'id' | 'source' | 'target'>[],
) {
  const focus = useRef(new BoardFocus()).current;
  const hovered = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const said = useRef({ selectedElements, selectedLines, edges });
  said.current = { selectedElements, selectedLines, edges };
  const apply = useCallback(() => {
    const now = said.current;
    const nothingPicked = now.selectedElements.size === 0 && now.selectedLines.size === 0;
    const cards = nothingPicked && hovered.current !== undefined ? [hovered.current] : now.selectedElements;
    focus.set(focusOf(cards, now.selectedLines, now.edges));
  }, [focus]);
  useEffect(apply, [apply, selectedElements, selectedLines, edges]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onNodeMouseEnter = useCallback((_event: unknown, node: { id: string }) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { hovered.current = node.id; apply(); }, HOVER_REST_MS);
  }, [apply]);
  const onNodeMouseLeave = useCallback(() => {
    clearTimeout(timer.current);
    if (hovered.current === undefined) return;
    timer.current = setTimeout(() => { hovered.current = undefined; apply(); }, HOVER_REST_MS);
  }, [apply]);
  return { focus, onNodeMouseEnter, onNodeMouseLeave };
}
