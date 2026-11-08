// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * "Are you sure?" — one component for both places that ask.
 *
 * A MUI dialog and not `window.confirm`: that one blocks the thread, ignores the
 * theme, and is not always visible in an embedded view.
 *
 * `confirmDisabled` is there for the case where the question may be asked but
 * the answer may not be given: a dialog with a dead button is then more honest
 * than a button that is absent — you can see *why* it cannot be done.
 *
 * The buttons are in sentence case, as in every other dialog. The answer is
 * drawn as a danger unless `tone` says the step takes nothing away. What the
 * question needs answered besides yes — a choice between two things that may
 * be true — goes under the body as `children`.
 */
import type { ReactNode } from 'react'
import { Button } from './kit/Button'
import { Dialog } from './kit/Dialog'

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
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      actions={(
        <>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}
    >
      <p>{body}</p>
      {children}
    </Dialog>
  )
}
