// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { RefObject } from 'react';
import type { ClipboardPayload } from '../model/clipboard';
import type { SolutionDesignEditorProps } from './props';
import type { EditorState } from './useEditorState';
import type { ViewSettings } from './useViewSettings';
import type { BoardView } from './useBoardView';
import type { LayoutActions } from './useLayoutActions';
import type { CanvasRequests, Documentation } from './useEditorRequests';
import type { DeleteRequests } from './useDeleteRequests';
import type { ExportDialogState } from './useExport';
import type { EditorDialogState } from './EditorDialogs';
import type { useDoubleClicks } from './useEditorHandle';
import type { ViewportMemory } from './canvas/viewportMemory';

/**
 * The editor body's state, as the hooks that hold it hand it out: one object
 * per concern, so a panel names the concerns it reads rather than forty
 * values one by one. Built once per render by `EditorBody`.
 */
export interface EditorParts {
  props: SolutionDesignEditorProps;
  state: EditorState;
  readOnly: boolean;
  view: ViewSettings;
  board: BoardView;
  layout: LayoutActions;
  requests: CanvasRequests;
  docs: Documentation;
  deletes: DeleteRequests;
  exports: ExportDialogState;
  dialogs: EditorDialogState;
  clicks: ReturnType<typeof useDoubleClicks>;
  /** The whole board is mounted for a capture a host asked for (ADR-0007). */
  capturing: boolean;
  /** Where each diagram was left, for the session (`viewportMemory.ts`). */
  viewports: ViewportMemory;
  /**
   * The in-memory clipboard, scoped to this editor session (cross-diagram,
   * same tab), and how many times it has been pasted: each paste offsets one
   * grid step further so repeated ⌘V cascades instead of stacking.
   */
  clipboardRef: RefObject<ClipboardPayload | null>;
  pasteCountRef: RefObject<number>;
}
