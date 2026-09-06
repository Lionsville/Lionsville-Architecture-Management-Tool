/**
 * The message bar along the bottom. Draws what {@link useToasts} keeps, and
 * nothing else.
 */
import Alert from '@mui/material/Alert'
import type { AlertColor } from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import type { Toast } from './useToasts'

/** An error gets longer, because it usually says something you have to read. */
export const HIDE_AFTER_MS = { error: 12_000, other: 5_000 }

/**
 * How long this message stays up. A named function rather than a ternary in the
 * props, because "an error stays longer" is a rule worth being able to state and
 * to test — MUI keeps the duration in a timer, not in the DOM, so a ternary
 * there is a rule nothing can check.
 */
export function hideAfter(severity: AlertColor | undefined): number {
  return severity === 'error' ? HIDE_AFTER_MS.error : HIDE_AFTER_MS.other
}

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
      autoHideDuration={hideAfter(toast?.severity)}
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
