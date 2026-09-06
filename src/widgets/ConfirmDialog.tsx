/**
 * "Are you sure?" — one component for both places that ask.
 *
 * A MUI dialog and not `window.confirm`: that one blocks the thread, ignores the
 * theme, and is not always visible in an embedded view.
 *
 * `confirmDisabled` is there for the case where the question may be asked but
 * the answer may not be given: deleting the last landscape would leave a shell
 * with nothing to work on, and a dialog with a dead button is then more honest
 * than a button that is absent — you can see *why* it cannot be done.
 */
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open, title, body, confirmLabel, cancelLabel, confirmDisabled = false, onCancel, onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 14 }}>{body}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button color="error" variant="contained" disabled={confirmDisabled} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
