/**
 * Say once that storage is refusing, and once that it works again.
 *
 * Storage that will not write is a nuisance, not a fault: everything keeps
 * working until you close the tab. But it is a nuisance you need to know about,
 * and without this brake the message would come back on every keystroke — at
 * which point nobody reads it any more.
 */
import { useCallback, useRef } from 'react'
import type { Translate } from '@lionsville/solution-design'
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
