/**
 * The one question before a restore, and the copy that says what a restore IS
 * (ADR-0008): a new change on top of everything since, not a slider back.
 * Written here rather than on the button because the surprise is the whole
 * risk: a person expecting the timeline to rewind sees it grow instead, and
 * should have read that before, not after.
 */
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import type { Translate } from '../../i18n'

export type RestoreDialogProps = {
  open: boolean
  /** What is being restored; absent is the whole project. */
  name?: string
  /** The snapshot's day, as the person reads it. */
  date: string
  onCancel: () => void
  onRestore: () => void
  s: Translate
}

export function RestoreDialog({ open, name, date, onCancel, onRestore, s }: RestoreDialogProps) {
  const project = name === undefined
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm" aria-labelledby="restore-title">
      <DialogTitle id="restore-title" sx={{ fontSize: 16 }}>
        {project ? s('history.restoreProjectTitle', { date }) : s('history.restoreTitle', { name: name ?? '', date })}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 13 }}>
          {project ? s('history.restoreProjectBody') : s('history.restoreBody', { name: name ?? '' })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" color={project ? 'warning' : 'primary'} onClick={onRestore}>
          {s('history.restoreConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
