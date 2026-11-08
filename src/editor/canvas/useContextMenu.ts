// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useCallback, useMemo, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Point } from '../../model/types';
import type { MenuTarget } from './menuItems';

/** What is open right now: for whom, where on screen, and where on the board. */
export interface ContextMenuState {
  target: MenuTarget;
  /** Client coordinates — where the MUI menu is anchored. */
  screen: Point;
  /** The same point in flow coordinates — where "Add here" and "Paste here" land. */
  flowPosition: Point;
  /** Opened with the pointer: no item takes the focus ring until a key moves to one. */
  byPointer?: boolean;
}

/** The subset of a mouse event the menu needs; real events satisfy it. */
export interface MenuOpenEvent {
  clientX: number;
  clientY: number;
  preventDefault(): void;
}

export interface ContextMenuApi {
  state: ContextMenuState | null;
  /** Open for `target` at a right-click, suppressing the browser's own menu. */
  open(target: MenuTarget, event: MenuOpenEvent): void;
  /** Open for `target` at a screen point (keyboard: the selection's centre). */
  openAt(target: MenuTarget, screen: Point): void;
  close(): void;
}

/**
 * One piece of state for every context menu on a canvas. The flow position is
 * captured at open time, because the viewport may pan or zoom while the menu is
 * up and the item must still land where the user clicked.
 */
export function useContextMenu(): ContextMenuApi {
  const { screenToFlowPosition } = useReactFlow();
  const [state, setState] = useState<ContextMenuState | null>(null);

  const openAt = useCallback(
    (target: MenuTarget, screen: Point) => {
      setState({ target, screen, flowPosition: screenToFlowPosition(screen) });
    },
    [screenToFlowPosition],
  );
  const open = useCallback(
    (target: MenuTarget, event: MenuOpenEvent) => {
      event.preventDefault();
      const screen = { x: event.clientX, y: event.clientY };
      setState({ target, screen, flowPosition: screenToFlowPosition(screen), byPointer: true });
    },
    [screenToFlowPosition],
  );
  const close = useCallback(() => setState(null), []);

  return useMemo(() => ({ state, open, openAt, close }), [state, open, openAt, close]);
}
