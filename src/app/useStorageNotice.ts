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
import type { StoragePressure } from '../ports/ProjectStore'
import type { Notify } from './useToasts'

/** `report(true)` after a successful write, `report(false)` after a failed one. */
export type StorageNotice = (ok: boolean) => void

export function useStorageNotice(notify: Notify, s: Translate): StorageNotice {
  const failed = useRef(false)
  return useCallback((ok: boolean) => {
    if (ok && failed.current) {
      failed.current = false
      notify(s('shell.storageRecovered'), 'success')
      return
    }
    if (ok || failed.current) return
    failed.current = true
    notify(s('shell.storageFailed'), 'error')
  }, [notify, s])
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
