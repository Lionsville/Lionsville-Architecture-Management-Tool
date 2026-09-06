/**
 * The messages along the bottom, as state.
 *
 * Separate from the bar that draws them ({@link ToastBar}), because six places
 * report and only one place shows. This hook has no outward dependency — no
 * storage, no language — so it takes a few lines to test.
 */
import { useCallback, useRef, useState } from 'react'
import type { AlertColor } from '@mui/material/Alert'

/** One message. The key restarts the bar when a new message arrives. */
export type Toast = { key: number; message: string; severity: AlertColor }

/** What every place with something to report is handed. */
export type Notify = (message: string, severity?: AlertColor) => void

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

  const notify = useCallback<Notify>((message, severity = 'info') => {
    seq.current += 1
    setToast({ key: seq.current, message, severity })
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])
  const exited = useCallback(() => setToast(null), [])

  return { toast, open, notify, close, exited }
}
