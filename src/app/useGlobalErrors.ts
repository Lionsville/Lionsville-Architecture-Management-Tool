/**
 * The throws and rejections nobody caught.
 *
 * A boundary only sees what happens during a render. Everything else — a
 * listener, a timer, a promise with no rejection handler — goes to
 * `window.onerror` and `unhandledrejection`, which this app did not listen to
 * at all: the failure happened, the screen carried on looking fine, and nothing
 * was written down.
 *
 * **Registered here and not in the composition root**, although that is where
 * the seams are chosen, because saying something needs the toast bar and the
 * language, and both live inside `App`. The root keeps the boot catch, which
 * runs before any of this exists.
 *
 * **One message, throttled.** A broken interval fires sixty times a second, and
 * sixty notices is the same as none. Every one is reported; at most one in the
 * throttle window is shown.
 */
import { useEffect, useRef } from 'react'
import type { Translate } from '../i18n'
import type { Diagnostic } from '../platform/diagnostics'
import type { Notify } from './useToasts'

/** How long a notice keeps the next one quiet. */
export const ERROR_TOAST_THROTTLE_MS = 10_000

export function useGlobalErrors(deps: {
  diagnostics: { report(entry: Diagnostic): void }
  notify: Notify
  s: Translate
  /** Injected so a test does not have to wait ten seconds. */
  throttleMs?: number
  now?: () => number
}): void {
  const { diagnostics, notify, s, throttleMs = ERROR_TOAST_THROTTLE_MS, now = Date.now } = deps

  // In refs, so re-registering the listeners is not a consequence of a new
  // translator: the throttle would reset with them.
  const latest = useRef({ diagnostics, notify, s, throttleMs, now })
  latest.current = { diagnostics, notify, s, throttleMs, now }
  const lastShown = useRef(-Infinity)

  useEffect(() => {
    const announce = (where: string, message: string, cause: unknown) => {
      const it = latest.current
      it.diagnostics.report({ level: 'error', where, message, cause })
      if (it.now() - lastShown.current < it.throttleMs) return
      lastShown.current = it.now()
      it.notify(it.s('shell.unexpectedError'), 'error')
    }

    const onError = (event: ErrorEvent) =>
      announce('window', 'uncaught error', event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent) =>
      announce('window', 'unhandled rejection', event.reason)

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
}
