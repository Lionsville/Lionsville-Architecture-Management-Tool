// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The dialogs the editor keeps over its board: the two delete questions,
 * the shortcuts, the export, ⌘F, and a diagram's rename and settings.
 */
import { useCallback, useState } from 'react';
import type { ComponentProps } from 'react';
import { deletionSummary, rolesEndedSentences } from '../model/deletion';
import type { DeletionSummary } from '../model/deletion';
import type { DesignDiagram } from '../model/types';
import { useStrings } from '../i18n/LanguageContext';
import { usePersonNames } from '../people/ui/names';
import { ElementSearchDialog } from '../search/ui/ElementSearchDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { DeleteElementDialog } from './DeleteElementDialog';
import type { DiagramSettingsDialog as DiagramSettingsDialogShape } from './DiagramSettingsDialog';
import { RenameDiagramDialog } from './RenameDiagramDialog';
import { ShortcutsHelpDialog } from './ShortcutsHelpDialog';
import type { ExportDialog as ExportDialogShape } from './export/ExportDialog';
import { lazyPart } from '../widgets/lazyPart';
import type { EditorOwnership, SolutionDesignEditorProps } from './props';
import type { EditorState } from './useEditorState';
import type { DeleteRequests } from './useDeleteRequests';
import type { ExportDialogState } from './useExport';

/**
 * The export and a diagram's settings are asked for from a menu, never part
 * of the board: each arrives the first time it is opened, in a script of its
 * own (`widgets/lazyPart`).
 */
const ExportDialog = lazyPart<ComponentProps<typeof ExportDialogShape>>(
  () => import('./export/ExportDialog').then((held) => held.ExportDialog), { until: (props) => props.open },
);
const DiagramSettingsDialog = lazyPart<ComponentProps<typeof DiagramSettingsDialogShape>>(
  () => import('./DiagramSettingsDialog').then((held) => held.DiagramSettingsDialog), { until: (props) => props.target !== undefined },
);

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
export function EditorDialogs({ state, diagram, deletes, exports, dialogs, roles, unitDeletion }: {
  state: EditorState;
  diagram: DesignDiagram;
  deletes: DeleteRequests;
  exports: ExportDialogState;
  dialogs: EditorDialogState;
  roles?: EditorOwnership['roles'];
  unitDeletion?: EditorOwnership['unitDeletion'];
}) {
  const { exportOptions, exportSize } = exports;
  return (
    <>
      <DeleteDialogs state={state} diagram={diagram} deletes={deletes} roles={roles} unitDeletion={unitDeletion} />
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

/**
 * Who stops being what, as a delete's confirmation says it (ADR-0036, amended
 * 12 October 2026): the person by the register, the role by the operating
 * model the host hands in, the unit by this document.
 */
function useRolesEnded(state: EditorState, roles: EditorOwnership['roles']): (summary: DeletionSummary) => string[] {
  const { t } = useStrings();
  const names = usePersonNames();
  return (summary) => rolesEndedSentences(summary, {
    person: (id) => names.text({ person: id }),
    role: (id) => roles?.name(id) ?? id,
    unit: (id) => state.model.elements.find((e) => e.id === id)?.name ?? id,
  }, t);
}

function DeleteDialogs({ state, diagram, deletes, roles, unitDeletion }: {
  state: EditorState;
  diagram: DesignDiagram;
  deletes: DeleteRequests;
  roles: EditorOwnership['roles'];
  unitDeletion: EditorOwnership['unitDeletion'];
}) {
  const { deleteTarget, setDeleteTarget, confirmDelete, setConfirmDelete } = deletes;
  const deleteElement = deleteTarget ? state.model.elements.find((e) => e.id === deleteTarget) : undefined;
  // A unit's own question (3.6.2), asked when the dialog is up and not before.
  const units = deleteElement ? unitDeletion?.([deleteElement.id]) : undefined;
  const rolesEnded = useRolesEnded(state, roles);
  const one = (id: string) => deletionSummary(state.model, { elementIds: [id], connectionIds: [], domainGroups: [] }, roles?.today);
  return (
    <>
      {deleteElement && (
        <DeleteElementDialog
          element={deleteElement}
          isBoundaryApplication={diagram.kind === 'container' && diagram.applicationElementId === deleteElement.id}
          hasComponents={state.model.elements.some((e) => e.parentId === deleteElement.id)}
          endsRoles={rolesEnded(one(deleteElement.id))}
          units={units}
          onRemoveFromDiagram={() => {
            state.actions.removeFromDiagram(deleteElement.id);
            setDeleteTarget(undefined);
          }}
          onDeleteFromModel={(choice) => {
            if (units && choice !== undefined) state.actions.deleteFromModel(deleteElement.id, (here) => units.run(choice, here));
            else state.actions.deleteFromModel(deleteElement.id);
            setDeleteTarget(undefined);
          }}
          onClose={() => setDeleteTarget(undefined)}
        />
      )}
      {confirmDelete && (
        <ConfirmDeleteDialog
          summary={confirmDelete.summary}
          endsRoles={rolesEnded(confirmDelete.summary)}
          subject={confirmDelete.subject}
          landings={confirmDelete.landings}
          units={confirmDelete.units}
          onConfirm={(choice) => {
            if (choice !== undefined && confirmDelete.runUnits) confirmDelete.runUnits(choice);
            else confirmDelete.run();
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
