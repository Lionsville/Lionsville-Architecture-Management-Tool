/**
 * A password, asked for as a promise (ADR-0023).
 *
 * The two flows that need one — sealing an export, opening a sealed file —
 * are sequences with a dialog in the middle, and a sequence reads as one when
 * the dialog is an `await`. This hook holds the one dialog the shell draws
 * for both and answers `undefined` when the person cancels, which every
 * caller treats as "then not", silently: cancelling a dialog is not an error
 * and gets no toast.
 *
 * One question at a time. A second ask while one is up answers the first with
 * a cancel, which cannot happen from a person and keeps a stuck promise from
 * being possible.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Translate } from '../i18n'
import { PasswordDialog } from './dialogs/PasswordDialog'
import type { PasswordMode } from './dialogs/PasswordDialog'

export type AskPassword = (mode: PasswordMode, error?: string) => Promise<string | undefined>

type Asking = { mode: PasswordMode; error?: string }

export function usePasswordPrompt(s: Translate): { askPassword: AskPassword; dialog: React.ReactElement } {
  const [asking, setAsking] = useState<Asking | undefined>(undefined)
  const resolveRef = useRef<((password: string | undefined) => void) | undefined>(undefined)

  const settle = useCallback((password: string | undefined) => {
    const resolve = resolveRef.current
    resolveRef.current = undefined
    setAsking(undefined)
    resolve?.(password)
  }, [])

  const askPassword = useCallback<AskPassword>((mode, error) => {
    resolveRef.current?.(undefined)
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setAsking({ mode, ...(error ? { error } : {}) })
    })
  }, [])

  const dialog = useMemo(() => (
    <PasswordDialog
      open={asking !== undefined}
      mode={asking?.mode ?? 'enter'}
      error={asking?.error}
      onCancel={() => settle(undefined)}
      onConfirm={settle}
      s={s}
    />
  ), [asking, settle, s])

  return { askPassword, dialog }
}
