// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The dialogs the editor keeps over its board: the two delete questions,
 * the shortcuts, the export, ⌘F, and a diagram's rename and settings.
 */
import { useCallback, useState } from 'react';
import type { DesignDiagram } from '../model/types';
import { ElementSearchDialog } from '../search/ui/ElementSearchDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { DeleteElementDialog } from './DeleteElementDialog';
import { DiagramSettingsDialog } from './DiagramSettingsDialog';
import { RenameDiagramDialog } from './RenameDiagramDialog';
import { ShortcutsHelpDialog } from './ShortcutsHelpDialog';
import { ExportDialog } from './export/ExportDialog';
import type { SolutionDesignEditorProps } from './props';
import type { EditorState } from './useEditorState';
import type { DeleteRequests } from './useDeleteRequests';
import type { ExportDialogState } from './useExport';

/** Which of the plain dialogs is up. ⌘F's dialog owns its own query; this is only whether it is up. */
export function useEditorDialogs() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // "Rename diagram…" and "Settings…" from a tab: the dialog lives here, the
  // change lands on the host.
  const [settingsDiagramId, setSettingsDiagramId] = useState<string | undefined>(undefined);
  const [renameDiagramTarget, setRenameDiagramTarget] = useState<{ id: string; name: string } | undefined>(undefined);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  return {
    helpOpen, setHelpOpen, openHelp, searchOpen, setSearchOpen, openSearch,
    settingsDiagramId, setSettingsDiagramId, renameDiagramTarget, setRenameDiagramTarget,
  };
}

export type EditorDialogState = ReturnType<typeof useEditorDialogs>;

/** What comes before the documentation page: the two delete questions, the shortcuts and the export. */
export function EditorDialogs({ state, diagram, deletes, exports, dialogs }: {
  state: EditorState;
  diagram: DesignDiagram;
  deletes: DeleteRequests;
  exports: ExportDialogState;
  dialogs: EditorDialogState;
}) {
  const { exportOptions, exportSize } = exports;
  return (
    <>
      <DeleteDialogs state={state} diagram={diagram} deletes={deletes} />
      <ShortcutsHelpDialog open={dialogs.helpOpen} onClose={() => dialogs.setHelpOpen(false)} />
      {exportOptions && exportSize && (
        <ExportDialog
          open
          options={exportOptions}
          onChange={exports.setExportOptions}
          preview={exports.exportPreview}
          previewBusy={exports.previewBusy}
          size={exportSize}
          exporting={exports.exporting}
          onExport={exports.confirmExport}
          onClose={exports.closeExport}
        />
      )}
    </>
  );
}

/**
 * What follows the documentation page: ⌘F, and a diagram's rename and
 * settings where the host takes them.
 */
export function EditorLateDialogs({ props, state, dialogs, onFocus }: {
  props: SolutionDesignEditorProps;
  state: EditorState;
  dialogs: EditorDialogState;
  onFocus(elementId: string): void;
}) {
  const { onRename, onSettingsChange } = props.diagrams;
  return (
    <>
      <ElementSearchDialog
        open={dialogs.searchOpen}
        model={state.model}
        activeDiagramId={props.document.activeDiagramId}
        onClose={() => dialogs.setSearchOpen(false)}
        onFocus={onFocus}
      />
      {onRename && (
        <RenameDiagramDialog
          target={dialogs.renameDiagramTarget}
          onRename={onRename}
          onClose={() => dialogs.setRenameDiagramTarget(undefined)}
        />
      )}
      {onSettingsChange && (
        <DiagramSettingsDialog
          target={state.model.diagrams.find((d) => d.id === dialogs.settingsDiagramId)}
          defaultClient={props.exportTitleBlock?.client ?? state.model.name}
          onSave={onSettingsChange}
          onClose={() => dialogs.setSettingsDiagramId(undefined)}
        />
      )}
    </>
  );
}

function DeleteDialogs({ state, diagram, deletes }: {
  state: EditorState;
  diagram: DesignDiagram;
  deletes: DeleteRequests;
}) {
  const { deleteTarget, setDeleteTarget, confirmDelete, setConfirmDelete } = deletes;
  const deleteElement = deleteTarget ? state.model.elements.find((e) => e.id === deleteTarget) : undefined;
  return (
    <>
      {deleteElement && (
        <DeleteElementDialog
          element={deleteElement}
          isBoundaryApplication={diagram.kind === 'container' && diagram.applicationElementId === deleteElement.id}
          hasComponents={state.model.elements.some((e) => e.parentId === deleteElement.id)}
          onRemoveFromDiagram={() => {
            state.actions.removeFromDiagram(deleteElement.id);
            setDeleteTarget(undefined);
          }}
          onDeleteFromModel={() => {
            state.actions.deleteFromModel(deleteElement.id);
            setDeleteTarget(undefined);
          }}
          onClose={() => setDeleteTarget(undefined)}
        />
      )}
      {confirmDelete && (
        <ConfirmDeleteDialog
          summary={confirmDelete.summary}
          subject={confirmDelete.subject}
          landings={confirmDelete.landings}
          onConfirm={() => {
            confirmDelete.run();
            setConfirmDelete(undefined);
          }}
          onConfirmWithLandings={confirmDelete.runWithLandings && (() => {
            confirmDelete.runWithLandings?.();
            setConfirmDelete(undefined);
          })}
          onClose={() => setConfirmDelete(undefined)}
        />
      )}
    </>
  );
}
