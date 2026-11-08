// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useEffect, useRef, useState } from 'react';
import { FieldsDialog } from '../widgets/CompactForms';
import { DialogFooter } from '../widgets/kit/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { FieldBox } from '../widgets/kit/FieldBox'
import { useStrings } from '../i18n/LanguageContext';

export interface RenameDiagramDialogProps {
  /** The diagram being renamed; the dialog is closed while undefined. */
  target?: { id: string; name: string };
  onRename(diagramId: string, name: string): void;
  onClose(): void;
}

/**
 * "Rename diagram…" from a tab's menu: one field, the current name preselected,
 * Enter or Save commits a non-empty, changed name. Lives in the package so the
 * `onRenameDiagram(id, name)` contract means what it says — the host gets the
 * new name and applies it, nothing to prompt for on its side.
 */
export function RenameDiagramDialog({ target, onRename, onClose }: RenameDiagramDialogProps) {
  const { t } = useStrings();
  const [draft, setDraft] = useState(target?.name ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  // A fresh target resets the draft; the same target keeps what was typed.
  const [seenId, setSeenId] = useState(target?.id);
  if (target && seenId !== target.id) {
    setSeenId(target.id);
    setDraft(target.name);
  }
  useEffect(() => {
    if (!target) return;
    // MUI's `autoFocus` lands focus; the selection is ours to make.
    const frame = requestAnimationFrame(() => inputRef.current?.select());
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const trimmed = draft.trim();
  const canSave = Boolean(target) && trimmed.length > 0 && trimmed !== target?.name;
  const commit = () => {
    if (!target || !canSave) return;
    onRename(target.id, trimmed);
    onClose();
  };

  return (
    <FieldsDialog open={target !== undefined} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('dialog.renameDiagram')}</DialogTitle>
      <DialogContent>
        <FieldBox
          autoFocus
          inputRef={inputRef}
          label={t('field.name')}
          value={draft}
          fullWidth
          margin="dense"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            commit();
          }}
        />
      </DialogContent>
      <DialogFooter
        cancel={{ onClick: onClose, label: t('common.cancel') }}
        outcome={{ onClick: commit, disabled: !canSave, label: t('common.save') }}
      />
    </FieldsDialog>
  );
}
