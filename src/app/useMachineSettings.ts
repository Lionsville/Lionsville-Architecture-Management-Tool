// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The preferences dialog, and its one section read from somewhere other than
 * the preferences blob: the desktop's update settings (ADR-0006). What this
 * machine does about the source that is open is the source's provider's own
 * section (`App`'s `SourcePreferencesPanel`).
 */
import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { Translate } from '../i18n'
import { reasonOf } from '../platform/errors'
import type { UpdateSettings, UpdateSettingsPatch } from '../platform/updateSettings'
import type { UpdateSettingsStore } from '../ports/UpdateSettings'
import type { Failed } from './useShellServices'
import type { Notify } from './useToasts'

export type MachineSettings = {
  /** The preferences dialog, open or not. */
  open: boolean
  setOpen: (open: boolean) => void
  updates: UpdateSettings | undefined
  changeUpdates: (patch: UpdateSettingsPatch) => void
}

export function useMachineSettings(deps: {
  updateSettings: UpdateSettingsStore | undefined
  failedRef: RefObject<Failed>
  notify: Notify
  s: Translate
  /** The dialog open from the first paint: an address asked for it. */
  initiallyOpen?: boolean
}): MachineSettings {
  const { updateSettings, failedRef, notify, s, initiallyOpen = false } = deps
  // Open at the first paint where the address asked for it (`bootLanding`).
  const [open, setOpen] = useState(initiallyOpen)
  /**
   * Read when the dialog opens, not at boot: the update settings are a round
   * trip to main, and not needed until somebody is looking.
   */
  const [updates, setUpdates] = useState<UpdateSettings | undefined>(undefined)
  useEffect(() => {
    if (!open || !updateSettings) return
    let live = true
    void updateSettings.read().then(
      (held) => { if (live) setUpdates(held) },
      (cause: unknown) => failedRef.current('updateSettings', cause),
    )
    return () => { live = false }
  }, [open, updateSettings, failedRef])

  const changeUpdates = useCallback((patch: UpdateSettingsPatch) => {
    if (!updateSettings) return
    // Optimistic, and put back from what the host says is now in force.
    setUpdates((held) => held && { ...held, ...patch })
    void updateSettings.write(patch).then(setUpdates, (cause: unknown) => {
      failedRef.current('updateSettings.write', cause)
      notify(s('prefs.writeFailed', { message: reasonOf(cause) }), 'error')
      void updateSettings.read().then(setUpdates, () => undefined)
    })
  }, [updateSettings, failedRef, notify, s])
  return { open, setOpen, updates, changeUpdates }
}
