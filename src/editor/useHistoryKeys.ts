// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * ⌘Z and ⌘⇧Z where there is no canvas to own them.
 *
 * The canvas's shortcuts carry undo on the web (`use-canvas-shortcuts.ts`),
 * and they are mounted only with a view on screen. A scope whose last view
 * was just removed shows its empty place instead, and the one step a person
 * most wants there is the removal taken back. So the empty place listens for
 * the history's three chords itself, on the same terms as the canvas: only
 * while it is on screen, only for a key pressed on it or on nothing in
 * particular, never from a field, and never where the host's menu owns them.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorHistory } from './props';
import { CANVAS_SHORTCUTS, detectPlatform, matchEvent } from './keymap';
import { isEditableTarget, isShortcutIgnoredTarget } from './isEditableTarget';

const HISTORY = CANVAS_SHORTCUTS.filter((def) => def.id === 'undo' || def.id === 'redo' || def.id === 'redo-alt');

/** The ref goes on the empty place's root: what is on it, and whether it is seen. */
export function useHistoryKeys(history: EditorHistory, readOnly: boolean): (node: HTMLElement | null) => void {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const held = useRef({ history, readOnly });
  held.current = { history, readOnly };
  useEffect(() => {
    if (!node) return undefined;
    const platform = detectPlatform();
    const onKeyDown = (event: KeyboardEvent) => {
      const { history: h, readOnly: ro } = held.current;
      if (ro || h.keysOwnedByHost) return;
      if (!node.isConnected) return;
      const target = event.target as globalThis.Node | null;
      // A key pressed on the place itself is proof it is seen; one pressed on
      // nothing in particular counts only while the place takes up room.
      const inside = target != null && node.contains(target);
      const nowhere = target == null || target === document.body || target === document;
      const here = inside || (nowhere && node.getClientRects().length > 0);
      if (!here || isEditableTarget(event.target) || isShortcutIgnoredTarget(event.target)) return;
      const def = HISTORY.find((d) => matchEvent(event, d, platform));
      if (!def) return;
      event.preventDefault();
      if (def.id === 'undo') h.undo(); else h.redo();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [node]);
  return useCallback((next: HTMLElement | null) => setNode(next), []);
}
