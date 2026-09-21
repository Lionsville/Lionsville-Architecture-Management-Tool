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
import type { StoragePressure } from '../ports/ScopeStore'
import type { Notify } from './useToasts'

/**
 * `report(true)` after a successful write, `report(false)` after a failed one —
 * with whatever the write was refused with, where the caller has it.
 *
 * The cause is here for one reader: a source that says in its own words what a
 * refusal where it keeps work means. Optional because most of the places that
 * report one have only the fact — a read that came back empty, a preference that
 * would not write — and a source is asked either way.
 */
export type StorageNotice = (ok: boolean, cause?: unknown) => void

/**
 * @param sourceFailure What the source this work is kept in says a refusal there
 * means ({@link SourceFailure}). Absent for the three sources that ship, and the
 * sentence is then this tree's own, exactly as it always was.
 */
export function useStorageNotice(
  notify: Notify, s: Translate, sourceFailure?: SourceFailure,
): StorageNotice {
  const failed = useRef(false)
  return useCallback((ok: boolean, cause?: unknown) => {
    if (ok && failed.current) {
      failed.current = false
      notify(s('shell.storageRecovered'), 'success')
      return
    }
    if (ok || failed.current) return
    // Our sentence is about this browser's storage, so it is the right one for
    // the three sources that ship and the wrong one everywhere else: it names
    // the wrong place and recommends a working file to somebody whose work is
    // kept where a working file is not the copy that matters.
    const said = sourceFailure ? sourceFailure(cause) : s('shell.storageFailed')
    // Nothing from the source is the source saying it has this one covered
    // somewhere of its own. The latch stays open on purpose: nothing was said,
    // so there is nothing to take back with "saving works again", and the next
    // refusal is asked about afresh — by then the provider may have a word for
    // it.
    if (!said) return
    failed.current = true
    notify(said, 'error')
  }, [notify, s, sourceFailure])
}

/**
 * Say once that the place things are kept is nearly full.
 *
 * A browser's quota is small, fixed, shared with everything else on the origin,
 * and reached in silence: the first anybody hears of it is a save that did not
 * happen, at which point the afternoon's work is only in the tab. So it is worth
 * saying early — and exactly once, because a warning on every autosave is a
 * warning nobody reads, and because the number moves by a hair each time.
 *
 * Said again if it drops back under and climbs a second time, which is a
 * different situation from the first and worth hearing about.
 */
export type PressureNotice = (pressure: StoragePressure) => void

/** Above this share of what a store will hold, say so. */
export const NEARLY_FULL = 0.8

export function useNearlyFullNotice(notify: Notify, s: Translate): PressureNotice {
  const said = useRef(false)
  return useCallback((pressure: StoragePressure) => {
    const full = pressure.budget > 0 && pressure.used / pressure.budget >= NEARLY_FULL
    if (!full) {
      said.current = false
      return
    }
    if (said.current) return
    said.current = true
    notify(s('shell.storageNearlyFull', {
      percent: Math.round((pressure.used / pressure.budget) * 100),
    }), 'warning')
  }, [notify, s])
}
