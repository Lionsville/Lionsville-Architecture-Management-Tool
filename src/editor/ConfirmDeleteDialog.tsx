// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
  /**
   * How many container interfaces have landed on this one (ADR-0013). With
   * any, the dialog asks two questions instead of one: take them too, or keep
   * them as interfaces of their own.
   */
  landings?: number;
  onConfirm(): void;
  /** Present only with `landings`: delete it and every landing, as one step. */
  onConfirmWithLandings?(): void;
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
  const landings = props.landings ?? 0;
  const bothWays = landings > 0 && props.onConfirmWithLandings !== undefined;
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
          {/* The container interfaces under it are the part nobody sees
              coming, so the question is asked rather than decided (ADR-0013). */}
          {bothWays && (landings === 1 ? t('dialog.landingOne') : t('dialog.landingOther', { count: landings }))}
          {t('dialog.canUndo')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>{t('common.cancel')}</Button>
        {bothWays && (
          <Button color="error" onClick={props.onConfirmWithLandings}>
            {landings === 1 ? t('dialog.deleteWithLandingOne') : t('dialog.deleteWithLandingOther', { count: landings })}
          </Button>
        )}
        <Button color="error" variant="contained" onClick={props.onConfirm} autoFocus>
          {bothWays ? t('dialog.keepLandings') : t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
