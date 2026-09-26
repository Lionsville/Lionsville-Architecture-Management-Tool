// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The preferences dialog's two scopes that are read from somewhere other than
 * the preferences blob: the desktop's update settings, and the folder's
 * machine file (ADR-0005).
 */
import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { Translate } from '../i18n'
import { reasonOf } from '../platform/errors'
import type { UpdateSettings, UpdateSettingsPatch } from '../platform/updateSettings'
import type { LocalSettings, LocalSettingsPatch } from '../projects/folderSettings'
import type { FolderSettingsStore } from '../ports/FolderSettings'
import type { ProjectHistory } from '../ports/ProjectHistory'
import type { UpdateSettingsStore } from '../ports/UpdateSettings'
import type { Failed } from './useShellServices'
import type { Notify } from './useToasts'

export type MachineSettings = {
  /** The preferences dialog, open or not. */
  open: boolean
  setOpen: (open: boolean) => void
  updates: UpdateSettings | undefined
  local: LocalSettings | undefined
  changeUpdates: (patch: UpdateSettingsPatch) => void
  changeLocal: (patch: LocalSettingsPatch) => void
}

export function useMachineSettings(deps: {
  updateSettings: UpdateSettingsStore | undefined
  folderSettings: FolderSettingsStore | undefined
  history: ProjectHistory | undefined
  failedRef: RefObject<Failed>
  notify: Notify
  s: Translate
}): MachineSettings {
  const { updateSettings, folderSettings, history, failedRef, notify, s } = deps
  const [open, setOpen] = useState(false)
  /**
   * Read when the dialog opens, not at boot: the update settings are a round
   * trip to main and the machine file is a read from the folder, and neither
   * is needed until somebody is looking. The machine section also asks the
   * history whether it is available at all — a folder in a browser tab has
   * one seam and not the other, and offering sync there would be offering
   * something that cannot happen.
   */
  const [updates, setUpdates] = useState<UpdateSettings | undefined>(undefined)
  const [local, setLocal] = useState<LocalSettings | undefined>(undefined)
  useEffect(() => {
    if (!open) return
    let live = true
    if (updateSettings) {
      void updateSettings.read().then(
        (held) => { if (live) setUpdates(held) },
        (cause: unknown) => failedRef.current('updateSettings', cause),
      )
    }
    if (folderSettings && history) {
      void history.available().then(async (can) => {
        if (!can) return
        const held = await folderSettings.readLocal()
        if (live) setLocal(held)
      }, (cause: unknown) => failedRef.current('folderSettings', cause))
    }
    return () => { live = false }
  }, [open, updateSettings, folderSettings, history, failedRef])

  const settingFailed = useCallback((where: string, cause: unknown) => {
    failedRef.current(where, cause)
    notify(s('prefs.writeFailed', { message: reasonOf(cause) }), 'error')
  }, [failedRef, notify, s])

  const changeUpdates = useCallback((patch: UpdateSettingsPatch) => {
    if (!updateSettings) return
    // Optimistic, and put back from what the host says is now in force.
    setUpdates((held) => held && { ...held, ...patch })
    void updateSettings.write(patch).then(setUpdates, (cause: unknown) => {
      settingFailed('updateSettings.write', cause)
      void updateSettings.read().then(setUpdates, () => undefined)
    })
  }, [updateSettings, settingFailed])

  const changeLocal = useCallback((patch: LocalSettingsPatch) => {
    if (!folderSettings) return
    setLocal((held) => held && { git: { ...held.git, ...patch.git } })
    void folderSettings.writeLocal(patch).then(
      () => folderSettings.readLocal().then(setLocal),
      (cause: unknown) => {
        settingFailed('folderSettings.write', cause)
        void folderSettings.readLocal().then(setLocal, () => undefined)
      },
    )
  }, [folderSettings, settingFailed])
  return { open, setOpen, updates, local, changeUpdates, changeLocal }
}
