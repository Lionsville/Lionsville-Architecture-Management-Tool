// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
 *
 * The buttons are in sentence case, as in every other dialog. The answer is
 * drawn as a danger unless `tone` says the step takes nothing away. What the
 * question needs answered besides yes — a choice between two things that may
 * be true — goes under the body as `children`.
 */
import type { ReactNode } from 'react'
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
  /** `danger` (the default) for a step that removes something; `primary` for one that does not. */
  tone?: 'danger' | 'primary'
  onCancel: () => void
  onConfirm: () => void
  /** What the question asks besides yes, under the body. */
  children?: ReactNode
}

export function ConfirmDialog({
  open, title, body, confirmLabel, cancelLabel, confirmDisabled = false, tone = 'danger', onCancel, onConfirm, children,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 14 }}>{body}</DialogContentText>
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} sx={{ textTransform: 'none' }}>{cancelLabel}</Button>
        <Button
          color={tone === 'danger' ? 'error' : 'primary'} variant="contained" disabled={confirmDisabled} onClick={onConfirm}
          sx={{ textTransform: 'none' }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
