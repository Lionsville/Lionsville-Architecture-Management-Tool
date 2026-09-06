import { useEffect, useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
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
    <Dialog open={target !== undefined} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('dialog.renameDiagram')}</DialogTitle>
      <DialogContent>
        <TextField
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
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={commit} disabled={!canSave}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
