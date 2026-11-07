// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two questions asked before a working file lands (ADR-0025), as
 * promises: where it goes, and — when a chosen folder is not empty — whether
 * to write over what is there.
 *
 * The same shape as `usePasswordPrompt`, for the same reason: the flow that
 * asks is a sequence, and a sequence reads as one when the dialog is an
 * `await`. `undefined` and `false` are a cancel, and a cancel is silent.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Translate } from '../i18n'
import { ConfirmDialog } from '../widgets/ConfirmDialog'
import { OpenIntoDialog } from './dialogs/OpenIntoDialog'
import type { DestinationQuestion, LandingPrompts } from './workingFileFlows'

type Asking =
  | ({ kind: 'destination' } & DestinationQuestion)
  | { kind: 'replace'; name: string }

/** What the question says of where a file goes, while it is that question that is up. */
function destinationWords(asking: Asking | undefined, copyFirst: () => void) {
  if (asking?.kind !== 'destination') return { file: '', here: '', canGoElsewhere: false }
  const { file, here, canGoElsewhere, puttingBack, keepsHistory, below, holdsName, holds, canSaveCopyFirst } = asking
  return {
    file, here, canGoElsewhere, puttingBack: puttingBack === true, keepsHistory: keepsHistory === true, below: below ?? 0,
    ...(holdsName !== undefined ? { holdsName, holds: holds ?? '' } : {}),
    ...(canSaveCopyFirst ? { onSaveCopyFirst: copyFirst } : {}),
  }
}

export function useOpenIntoPrompt(s: Translate): { prompts: LandingPrompts; dialogs: React.ReactElement } {
  const [asking, setAsking] = useState<Asking | undefined>(undefined)
  const resolveRef = useRef<((answer: unknown) => void) | undefined>(undefined)

  const settle = useCallback((answer: unknown) => {
    const resolve = resolveRef.current
    resolveRef.current = undefined
    setAsking(undefined)
    resolve?.(answer)
  }, [])

  const ask = useCallback(<T,>(next: Asking): Promise<T> => {
    resolveRef.current?.(undefined)
    return new Promise<T>((resolve) => {
      resolveRef.current = resolve as (answer: unknown) => void
      setAsking(next)
    })
  }, [])

  const prompts = useMemo<LandingPrompts>(() => ({
    askDestination: (question) => ask<'here' | 'elsewhere' | 'copyFirst' | undefined>({ kind: 'destination', ...question }),
    confirmReplace: (name) => ask<boolean | undefined>({ kind: 'replace', name }).then(Boolean),
  }), [ask])

  const dialogs = useMemo(() => (
    <>
      <OpenIntoDialog
        open={asking?.kind === 'destination'}
        {...destinationWords(asking, () => settle('copyFirst'))}
        onCancel={() => settle(undefined)}
        onHere={() => settle('here')}
        onElsewhere={() => settle('elsewhere')}
        s={s}
      />
      <ConfirmDialog
        open={asking?.kind === 'replace'}
        title={s('openInto.occupiedTitle')}
        body={s('openInto.occupiedBody', { name: asking?.kind === 'replace' ? asking.name : '' })}
        confirmLabel={s('openInto.occupiedConfirm', { name: asking?.kind === 'replace' ? asking.name : '' })}
        cancelLabel={s('common.cancel')}
        onCancel={() => settle(false)}
        onConfirm={() => settle(true)}
      />
    </>
  ), [asking, settle, s])

  return { prompts, dialogs }
}
