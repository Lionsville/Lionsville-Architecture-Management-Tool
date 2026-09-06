import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { describeDeletion, type DeletionSummary } from '../model/deletion';
import { useStrings } from '../i18n/LanguageContext';

export interface ConfirmDeleteDialogProps {
  summary: DeletionSummary;
  /** Named when the delete is about one thing (a connection's label, say). */
  subject?: string;
  onConfirm(): void;
  onClose(): void;
}

/**
 * The confirmation for the two deletes that used to happen in silence: one
 * connection, and a whole multi-selection. Both were a single keystroke away
 * from removing model content with nothing on screen to say so.
 *
 * It states the count rather than asking "are you sure", and it names the
 * cascade — connections nobody selected that die with an endpoint — because that
 * is the part of a delete people do not see coming. Undo still works; the dialog
 * exists so the undo is rarely needed rather than to replace it.
 */
export function ConfirmDeleteDialog(props: ConfirmDeleteDialogProps) {
  const { t } = useStrings();
  const { summary, subject } = props;
  // One unlabeled connection has no name to quote; "this connection" reads as
  // the thing under the cursor, which is what it is.
  const single =
    summary.elements === 0 && summary.domainGroups === 0 && summary.connections === 1;
  const what = subject
    ? `“${subject}”`
    : single
      ? t('dialog.deleteThisConnection')
      : describeDeletion(summary, t);
  const cascade = summary.cascadingConnections;
  return (
    <Dialog open onClose={props.onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('dialog.deleteTitle', { what })}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 14 }}>
          {subject || single
            ? t('dialog.deleteFromModel', { what: describeDeletion(summary, t) })
            : t('dialog.deleteThemFromModel')}
          {cascade > 0 &&
            (cascade === 1 ? t('dialog.cascadeOne') : t('dialog.cascadeOther', { count: cascade }))}
          {summary.domainGroups > 0 && t('dialog.groupBoxesRemoved')}
          {t('dialog.canUndo')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>{t('common.cancel')}</Button>
        <Button color="error" variant="contained" onClick={props.onConfirm} autoFocus>
          {t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
