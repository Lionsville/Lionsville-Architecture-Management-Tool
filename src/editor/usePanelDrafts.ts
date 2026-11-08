// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useCallback, useRef } from 'react';
import { leaveWithDrafts, useDraftSurface } from '../widgets/kit/drafts';
import type { DraftSurface } from '../widgets/kit/drafts';
import { selectionEquals } from './useEditorState';
import type { EditorState, Selection } from './useEditorState';

/** The board's side panel as a surface for drafts, and the person's way to change what it shows. */
export type PanelDrafts = {
  /** What the panel and a laid-out page's record are drawn on (`kit/drafts`). */
  readonly surface: DraftSurface;
  /** A selection the person makes — a card, the empty board, Escape, a row — asking first about a draft on the panel. */
  readonly choose: (next: Selection) => void;
};

/**
 * The panel shows what is selected, so selecting something else, or nothing,
 * leaves it and drops a comment being written there. A press on a card, on
 * the empty board, an Escape and a pick in a page's list each change the
 * selection here, and ask first; a selection the editor makes itself (after a
 * delete, a paste, a level) does not pass here.
 *
 * Kept writing, the board is handed its selection again: the canvas marked
 * the card pressed as it was pressed, and only a new selection redraws it.
 */
export function usePanelDrafts(state: Pick<EditorState, 'selection' | 'setSelection'>): PanelDrafts {
  const surface = useDraftSurface();
  const held = useRef(state.selection);
  held.current = state.selection;
  const { setSelection } = state;
  /** The selection asked about: the canvas says a press more than once, and it is asked once. */
  const asking = useRef<Selection | undefined>(undefined);
  const choose = useCallback((next: Selection) => {
    if (selectionEquals(next, held.current)) { setSelection(next); return; }
    if (asking.current && selectionEquals(next, asking.current)) return;
    asking.current = next;
    leaveWithDrafts(
      () => { asking.current = undefined; setSelection(next); },
      () => { asking.current = undefined; setSelection({ ...held.current }); },
      surface,
    );
  }, [setSelection, surface]);
  return { surface, choose };
}
