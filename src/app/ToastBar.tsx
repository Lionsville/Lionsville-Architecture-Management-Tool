// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The message bar along the bottom. Draws what {@link useToasts} keeps, and
 * nothing else.
 */
import Alert from '@mui/material/Alert'
import type { AlertColor } from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import { Toast } from '../widgets/kit/Toast'
import type { Toast as ShellToast } from './useToasts'

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
  toast: ShellToast | null
  open: boolean
  onClose: () => void
  onExited: () => void
}

/**
 * The duration handed to the bar, which is how a repeated message restarts
 * its timer without being drawn again.
 *
 * MUI starts the timer when the bar opens and again whenever the duration
 * changes, and offers no other way in from outside; a remount would restart it
 * too, and would slide the same words in a second time. So each repeat moves
 * the duration by a millisecond, alternately, which nobody can see and the
 * timer cannot miss.
 */
export function hideAfterFor(toast: ShellToast | null): number {
  return hideAfter(toast?.severity) + ((toast?.repeats ?? 0) % 2)
}

export function ToastBar({ toast, open, onClose, onExited }: ToastBarProps) {
  // A change with its Undo is the kit's toast, the same one every page's own change raises.
  if (toast?.undo) {
    return <Toast toast={open ? { key: toast.key, message: toast.message, undo: toast.undo } : null} onClose={() => { onClose(); onExited() }} />
  }
  return (
    <Snackbar
      key={toast?.key}
      open={toast !== null && open}
      autoHideDuration={hideAfterFor(toast)}
      // A message is timed while it is up, not while this window has focus:
      // paused on blur, an error read in another window stayed up for good.
      disableWindowBlurListener
      onClose={(_e, reason) => { if (reason !== 'clickaway') onClose() }}
      slotProps={{ transition: { onExited } }}
      // Centred under the work, never over the tree's foot at the left.
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      {/* Separate from the Snackbar props: the Alert carries both the colour and
          the close button, so a long error does not tick away before you are
          done reading it. */}
      <Alert
        severity={toast?.severity ?? 'info'}
        variant="filled"
        onClose={onClose}
        sx={{ maxWidth: 640, fontSize: 'var(--t-body)' }}
        // An offer, when the toast has one: the button closes the toast and
        // does the thing, so it cannot be pressed twice.
        action={toast?.action
          ? (
            // On one line: an offer broken over three reads as three words, not one button.
            <Button color="inherit" size="small" sx={{ whiteSpace: 'nowrap', flex: 'none' }} onClick={() => { onClose(); toast.action?.onClick() }}>
              {toast.action.label}
            </Button>
          )
          : undefined}
      >
        {toast?.message}
      </Alert>
    </Snackbar>
  )
}
