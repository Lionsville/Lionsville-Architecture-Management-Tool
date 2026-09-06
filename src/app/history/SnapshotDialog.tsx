/**
 * Taking a snapshot, and — the first time — deciding to keep a history at all.
 *
 * One dialog for both because they are one decision from where the user is
 * standing: they pressed Snapshot, and either this folder already keeps a
 * history or it is about to start. Splitting it into a consent dialog and then
 * a message dialog would be two clicks to record one thing.
 *
 * The message arrives drafted from the command log (ADR-0002) and is editable,
 * because sometimes the honest message is not the list of what happened but the
 * reason for it.
 */
import { useEffect, useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import type { Translate } from '../../i18n'

export type SnapshotDialogProps = {
  open: boolean
  /** False the first time in a folder: the dialog then explains what starting one means. */
  keeping: boolean
  /** What the command log suggests. Editable, and often edited. */
  draft: string
  onCancel: () => void
  onTake: (message: string) => void
  s: Translate
}

export function SnapshotDialog({ open, keeping, draft, onCancel, onTake, s }: SnapshotDialogProps) {
  const [message, setMessage] = useState(draft)

  // The draft is worked out when the dialog opens, not when it was declared.
  useEffect(() => { if (open) setMessage(draft) }, [open, draft])

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: 16 }}>
        {s(keeping ? 'history.snapshot' : 'history.start')}
      </DialogTitle>
      <DialogContent>
        {!keeping && (
          <DialogContentText sx={{ fontSize: 13, mb: 2 }}>
            {s('history.startBody')}
          </DialogContentText>
        )}
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={2}
          maxRows={10}
          label={s('history.message')}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button
          variant="contained"
          disabled={message.trim().length === 0}
          onClick={() => onTake(message.trim())}
        >
          {s('history.take')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
