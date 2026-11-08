// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Say once that storage is refusing, and once that it works again.
 *
 * Storage that will not write is a nuisance, not a fault: everything keeps
 * working until you close the tab. But it is a nuisance you need to know about,
 * and without this brake the message would come back on every keystroke — at
 * which point nobody reads it any more.
 */
import { useCallback, useRef } from 'react'
import type { Translate } from '../i18n'
import type { SourceFailure } from '../platform/sourceProvider'
import { notKeptSentence } from './notKept'
import type { KeepFailedKey } from './notKept'
import type { Notify, ToastAction } from './useToasts'

/**
 * `report(true)` after a successful write, `report(false)` after a failed one —
 * with whatever the write was refused with, where the caller has it.
 *
 * The cause is here for one reader: a source that says in its own words what a
 * refusal where it keeps work means. Optional because most of the places that
 * report one have only the fact — a read that came back empty, a preference that
 * would not write — and a source is asked either way.
 */
export type KeepNotice = (ok: boolean, cause?: unknown) => void

/**
 * @param sourceFailure What the source this work is kept in says a refusal there
 * means ({@link SourceFailure}). Absent for the sources that ship, and the
 * sentence is then the source's key for it with the refusal's reason after it
 * (`notKept`).
 * @param keepFailedKey That key (`SourceProvider.keepFailedKey`); absent, words that name no place.
 * @param seeWork The toast's one button: *Your work*, where the change is tried again or put back.
 */
export function useKeepNotice(
  notify: Notify, s: Translate, sourceFailure?: SourceFailure, keepFailedKey?: KeepFailedKey, seeWork?: ToastAction,
): KeepNotice {
  const failed = useRef(false)
  return useCallback((ok: boolean, cause?: unknown) => {
    if (ok && failed.current) {
      failed.current = false
      notify(s('shell.keptAgain'), 'success')
      return
    }
    if (ok || failed.current) return
    // The place's own truth, never another's: this used to be one sentence
    // about a browser's storage, said over a folder on the desktop too.
    const said = sourceFailure ? sourceFailure(cause) : notKeptSentence(s, keepFailedKey, cause)
    // Nothing from the source is the source saying it has this one covered
    // somewhere of its own. The latch stays open on purpose: nothing was said,
    // so there is nothing to take back with "saving works again", and the next
    // refusal is asked about afresh — by then the provider may have a word for
    // it.
    if (!said) return
    failed.current = true
    notify(said, 'error', ...(seeWork ? [seeWork] : []))
  }, [notify, s, sourceFailure, keepFailedKey, seeWork])
}
