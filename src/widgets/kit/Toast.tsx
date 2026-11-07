// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * That something landed, with Undo when it can be undone. An error that needs an
 * act is a Band or the place itself, and what somebody must keep is not a toast.
 *
 * One at a time, at the foot of the window, for six seconds, and for as long as
 * the pointer or the keyboard is on it. A new `key` starts the six seconds over.
 * In a shared log the word is *Put back*, because it adds a step rather than
 * taking one away (`shared`), and ⌘Z is not its key there.
 *
 * It goes when a dialog opens: a dialog is a question that wants all the
 * attention, and the toast would otherwise sit over its scrim, speaking of the
 * page behind it. Any dialog, the ones not yet drawn from the kit too, so it
 * watches for one coming rather than being told; and only a new one, as a toast
 * raised from inside a dialog stays.
 *
 * The live region is always there and only its words come and go, because a
 * screen reader announces a change inside a region it already knows.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStrings } from '../../i18n/LanguageContext'
import './Toast.css'

export const TOAST_MS = 6_000

export type ToastWords = {
  /** A new one starts the time over, even with the same words. */
  key?: string | number
  message: string
  undo?: {
    onPress: () => void
    /** The log is everybody's: the word is Put back. */
    shared?: boolean
    /** The key cap beside the word: ⌘Z here, Ctrl+Z there. */
    shortcut?: string
  }
}

export type ToastProps = {
  toast: ToastWords | null
  onClose: () => void
  /** For the rare toast that needs longer to read. */
  duration?: number
}

const holdsDialog = (node: Node) =>
  node instanceof Element && (node.matches('[role="dialog"]') || node.querySelector('[role="dialog"]') !== null)

export function Toast({ toast, onClose, duration = TOAST_MS }: ToastProps) {
  const { t } = useStrings()
  const [held, setHeld] = useState(false)
  const up = toast !== null

  useEffect(() => {
    if (!up || held) return undefined
    const timer = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(timer)
  }, [up, held, toast?.key, toast?.message, duration, onClose])

  useEffect(() => {
    if (!up) return undefined
    const watching = new MutationObserver((changes) => {
      if (changes.some((change) => [...change.addedNodes].some(holdsDialog))) onClose()
    })
    watching.observe(document.body, { childList: true })
    return () => watching.disconnect()
  }, [up, onClose])

  // The pointer that pressed Undo never left: the next toast must not start out held.
  useEffect(() => { if (!up) setHeld(false) }, [up])

  return createPortal(
    <div className="kit-toast-region" role="status">
      {toast && (
        <div
          className="kit-toast"
          data-testid="kit-toast"
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
        >
          <span className="kit-toast__words">{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              className="kit-toast__undo"
              onClick={() => { onClose(); toast.undo?.onPress() }}
            >
              {t(toast.undo.shared ? 'kit.toast.putBack' : 'kit.toast.undo')}
            </button>
          )}
          {toast.undo?.shortcut && !toast.undo.shared && <kbd className="kit-toast__key">{toast.undo.shortcut}</kbd>}
        </div>
      )}
    </div>,
    document.body,
  )
}
