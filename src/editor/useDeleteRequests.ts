// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The deletes worth stopping for. One element goes to the remove-or-delete
 * question (`deleteTarget`); a connection or a whole selection goes to the
 * confirmation (`confirmDelete`) when it takes something with it, and
 * straight through when it does not. The same three entry points feed both:
 * the keymap, the context menu and the inspector.
 */
import { useCallback, useState } from 'react';
import type { DesignDiagram, ElementId } from '../model/types';
import {
  deletableSelection, deletionSummary, needsDeleteConfirmation, type DeletionSummary,
} from '../model/deletion';
import { refinementsOf } from '../model/refines';
import type { EditorState, Selection } from './useEditorState';

/**
 * A pending confirmed delete: what it takes away, what to call it, and the one
 * thunk that performs it. The thunk is what keeps the dialog generic — it knows
 * nothing about connections or selections, only that something is about to go.
 */
export interface ConfirmDeleteState {
  summary: DeletionSummary;
  subject?: string;
  run(): void;
  /**
   * An interface with landings is two questions rather than one (ADR-0013):
   * the container interfaces under it can go with it, or stay as interfaces of
   * their own. Absent means there are none and the dialog asks the one
   * question it has always asked.
   */
  landings?: number;
  runWithLandings?(): void;
}

export function useDeleteRequests(
  state: Pick<EditorState, 'model' | 'actions'>,
  activeDiagram: DesignDiagram | undefined,
  readOnly: boolean,
) {
  const [deleteTarget, setDeleteTarget] = useState<ElementId | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | undefined>(undefined);
  const { model, actions } = state;

  /**
   * A connection delete: confirmed, unless it takes nothing with it.
   * `needsDeleteConfirmation` is asked rather than assumed so the rule lives in
   * one place — `model/deletion.ts` — and both entry points obey the same one.
   * What has landed on it (ADR-0013) makes it two questions: keeping them is
   * the plain delete — the writer clears their `refines` itself, so they
   * become interfaces of their own — and taking them too is one step with it.
   */
  const requestDeleteConnection = useCallback((connectionId: string) => {
    if (readOnly) return;
    const connection = model.relations.find((c) => c.id === connectionId);
    const summary = deletionSummary(model, { elementIds: [], connectionIds: [connectionId], domainGroups: [] });
    const landings = refinementsOf(model.relations, connectionId);
    if (!needsDeleteConfirmation(summary) && landings.length === 0) {
      actions.deleteConnection(connectionId);
      return;
    }
    setConfirmDelete({
      summary,
      subject: connection?.label || undefined,
      run: () => actions.deleteConnection(connectionId),
      ...(landings.length > 0
        ? {
          landings: landings.length,
          runWithLandings: () => actions.deleteSelection({
            elementIds: [],
            connectionIds: [connectionId, ...landings.map((row) => row.id)],
            domainGroups: [],
          }),
        }
        : {}),
    });
  }, [readOnly, model, actions]);

  // Dropped before it is counted, so the sentence says what will actually
  // go: a container view's boundary application is not its contents.
  const requestDeleteSelection = useCallback((asked: Selection) => {
    if (readOnly) return;
    const selection = deletableSelection(asked, activeDiagram);
    const summary = deletionSummary(model, selection);
    if (!needsDeleteConfirmation(summary)) {
      actions.deleteSelection(selection);
      return;
    }
    setConfirmDelete({ summary, run: () => actions.deleteSelection(selection) });
  }, [readOnly, model, actions, activeDiagram]);

  return { deleteTarget, setDeleteTarget, confirmDelete, setConfirmDelete, requestDeleteConnection, requestDeleteSelection };
}

export type DeleteRequests = ReturnType<typeof useDeleteRequests>;
