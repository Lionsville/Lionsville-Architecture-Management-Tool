// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A dialog's fields, started afresh for each thing it is asked about — and
 * only then.
 *
 * Every question dialog here is opened by handing it a subject and shut by
 * taking the subject away, and each used to clear its fields in an effect
 * that followed the subject object. The pages build that object inline, so
 * it is a new one on every render of the page — and the page renders for
 * reasons that have nothing to do with the dialog: the autosave going from
 * dirty to saving to saved, a blur that saves, a reader's commit a second
 * after typing, an agent's step, a sync from the server. Each of those
 * wiped what the person had typed, and a picker went back to its first
 * choice, so a confirm could act on the wrong record.
 *
 * So the reset follows who the dialog is about, as a string (an id, a path),
 * and runs when that changes to something — which includes the same record
 * asked about again after the dialog was shut, since shutting it takes the
 * subject away. `MoveRecordDialog` reasons the same way about its offers.
 * The reset is handed the subject as it is now and read through a ref, so
 * it may close over the latest props without its own identity counting as
 * a change.
 */
import { useEffect, useRef } from 'react'

export function useFreshFor<T>(subject: T | undefined, identify: (subject: T) => string, reset: (subject: T) => void): void {
  const identity = subject === undefined ? undefined : identify(subject)
  const latest = useRef({ subject, reset })
  latest.current = { subject, reset }
  useEffect(() => {
    const { subject: now, reset: afresh } = latest.current
    if (now !== undefined) afresh(now)
  }, [identity])
}
