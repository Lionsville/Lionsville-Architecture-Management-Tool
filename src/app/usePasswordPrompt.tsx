// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import type { PasswordAbout, PasswordAnswer, PasswordMode } from './dialogs/PasswordDialog'

export type { PasswordAnswer }

/** `file`: the file being opened, by name, which the dialog says. */
export type AskPassword = (mode: PasswordMode, error?: string, file?: string) => Promise<PasswordAnswer | undefined>

type Asking = { mode: PasswordMode; error?: string; file?: string }

export function usePasswordPrompt(s: Translate, copying?: () => PasswordAbout): { askPassword: AskPassword; dialog: React.ReactElement } {
  const [asking, setAsking] = useState<Asking | undefined>(undefined)
  const resolveRef = useRef<((answer: PasswordAnswer | undefined) => void) | undefined>(undefined)

  // Asked as the dialog opens, for what the organisation holds now.
  const copyingRef = useRef(copying)
  copyingRef.current = copying

  const settle = useCallback((answer: PasswordAnswer | undefined) => {
    const resolve = resolveRef.current
    resolveRef.current = undefined
    setAsking(undefined)
    resolve?.(answer)
  }, [])

  const askPassword = useCallback<AskPassword>((mode, error, file) => {
    resolveRef.current?.(undefined)
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setAsking({ mode, ...(error ? { error } : {}), ...(file ? { file } : {}) })
    })
  }, [])

  const dialog = useMemo(() => (
    <PasswordDialog
      open={asking !== undefined}
      mode={asking?.mode ?? 'enter'}
      error={asking?.error}
      about={asking?.mode === 'set' ? copyingRef.current?.() : asking?.file ? { file: asking.file } : undefined}
      onCancel={() => settle(undefined)}
      onConfirm={settle}
      s={s}
    />
  ), [asking, settle, s])

  return { askPassword, dialog }
}
