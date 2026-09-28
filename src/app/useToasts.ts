// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The messages along the bottom, as state.
 *
 * Separate from the bar that draws them ({@link ToastBar}), because six places
 * report and only one place shows. This hook has no outward dependency — no
 * storage, no language — so it takes a few lines to test.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type { AlertColor } from '@mui/material/Alert'

/** What a toast may offer to do about itself — one button, at most. */
export type ToastAction = { label: string; onClick: () => void }

/**
 * One message. The key restarts the bar when a new message arrives.
 *
 * `repeats` counts the times the same words arrived again while they were
 * still up: the bar restarts its timer on it rather than drawing the message a
 * second time (`ToastBar`).
 */
export type Toast = { key: number; message: string; severity: AlertColor; action?: ToastAction; repeats?: number }

/** What every place with something to report is handed. */
export type Notify = (message: string, severity?: AlertColor, action?: ToastAction) => void

export type Toasts = {
  toast: Toast | null
  /**
   * Open is separate from content: while sliding away the text stays put until
   * the transition finishes, instead of going blank halfway through.
   */
  open: boolean
  notify: Notify
  close: () => void
  exited: () => void
}

export function useToasts(): Toasts {
  const [toast, setToast] = useState<Toast | null>(null)
  const [open, setOpen] = useState(false)
  const seq = useRef(0)

  /**
   * What is up, as of now rather than as of the last render: two reports of
   * one failure can land in the same tick, and the second has to see the first.
   */
  const standing = useRef<Toast | null>(null)

  /**
   * A new message replaces the standing one. **The same message again, while
   * it is still up, is not a new one**: it keeps its key — a new key remounts
   * the bar, which is the same words sliding in twice — and restarts its
   * timer, so the last report of it is the one the time is counted from. Only
   * a message without an offer: an action is a closure, and two of them are
   * never known to be the same one.
   */
  const notify = useCallback<Notify>((message, severity = 'info', action) => {
    const held = standing.current
    let next: Toast
    if (held && !action && !held.action && held.message === message && held.severity === severity) {
      next = { ...held, repeats: (held.repeats ?? 0) + 1 }
    } else {
      seq.current += 1
      next = { key: seq.current, message, severity, ...(action ? { action } : {}) }
    }
    standing.current = next
    setToast(next)
    setOpen(true)
  }, [])

  const close = useCallback(() => { standing.current = null; setOpen(false) }, [])
  const exited = useCallback(() => setToast(null), [])

  /**
   * One object, kept until something in it actually moves.
   *
   * A fresh literal every render would be correct and invisible here, and a
   * loop one layer up: anything that memoises on these — `App`'s `failed`, and
   * the effects that depend on it — would be re-created every render, and an
   * effect that sets state would then re-run forever.
   */
  return useMemo(
    () => ({ toast, open, notify, close, exited }),
    [toast, open, notify, close, exited],
  )
}
