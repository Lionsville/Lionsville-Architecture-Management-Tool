/**
 * The message bar along the bottom. Draws what {@link useToasts} keeps, and
 * nothing else.
 */
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import type { Toast } from './useToasts'

/** An error gets longer, because it usually says something you have to read. */
const HIDE_AFTER_MS = { error: 12000, other: 5000 }

export type ToastBarProps = {
  toast: Toast | null
  open: boolean
  onClose: () => void
  onExited: () => void
}

export function ToastBar({ toast, open, onClose, onExited }: ToastBarProps) {
  return (
    <Snackbar
      key={toast?.key}
      open={toast !== null && open}
      autoHideDuration={toast?.severity === 'error' ? HIDE_AFTER_MS.error : HIDE_AFTER_MS.other}
      onClose={(_e, reason) => { if (reason !== 'clickaway') onClose() }}
      TransitionProps={{ onExited }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      {/* Separate from the Snackbar props: the Alert carries both the colour and
          the close button, so a long error does not tick away before you are
          done reading it. */}
      <Alert
        severity={toast?.severity ?? 'info'}
        variant="filled"
        onClose={onClose}
        sx={{ maxWidth: 640, fontSize: 13 }}
      >
        {toast?.message}
      </Alert>
    </Snackbar>
  )
}
