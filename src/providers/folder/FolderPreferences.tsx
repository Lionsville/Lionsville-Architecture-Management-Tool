// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What this machine does about the folder's remote (ADR-0005), in
 * Preferences: pull when the folder opens, push after every entry.
 *
 * Read when the dialog shows it, not when the folder opens: the settings are
 * a round trip to main, and nothing needs them until somebody is looking.
 * Drawn only where there is a remote to reach and a git to reach it with — a
 * browser tab has neither, and offering sync there would be offering
 * something that cannot happen. Kept by this install and not in the folder,
 * and not in the app's preferences either: another machine that opens the
 * folder decides for itself.
 */
import { useCallback, useEffect, useState } from 'react'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n'
import { reasonOf } from '../../platform/errors'
import type { SourcePreferencesPanelProps } from '../../ports/ProviderParts'
import type { FolderOwn, SyncSettings } from './folderOwn'

export function FolderPreferences({ own, notify }: SourcePreferencesPanelProps<FolderOwn>) {
  const { t: s } = useStrings()
  const [held, setHeld] = useState<SyncSettings | undefined>(undefined)
  useEffect(() => {
    const sync = own?.sync
    if (!own || !sync) return
    let live = true
    void sync.available().then(async (can) => {
      if (!can) return
      const read = await own.readSettings()
      if (live) setHeld(read)
    }, (cause: unknown) => own.report('folderSettings', cause))
    return () => { live = false }
  }, [own])

  const change = useCallback((patch: Partial<SyncSettings>) => {
    if (!own) return
    // Optimistic, and put back from what is now kept.
    setHeld((was) => was && { ...was, ...patch })
    void own.writeSettings(patch).then(setHeld, (cause: unknown) => {
      own.report('folderSettings.write', cause)
      notify(s('prefs.writeFailed', { message: reasonOf(cause) }), 'error')
      void own.readSettings().then(setHeld, () => undefined)
    })
  }, [own, notify, s])

  if (!held) return null
  return (
    <Stack spacing={1}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'text.secondary' }}>
        {s('prefs.thisMachine')}
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('prefs.thisMachineNote')}</Typography>
      <FormControlLabel
        control={(
          <Checkbox
            size="small"
            checked={held.pullOnOpen}
            onChange={(e) => change({ pullOnOpen: e.target.checked })}
          />
        )}
        label={<Typography sx={{ fontSize: 13 }}>{s('prefs.pullOnOpen')}</Typography>}
      />
      <FormControlLabel
        control={(
          <Checkbox
            size="small"
            checked={held.pushAfterSnapshot}
            onChange={(e) => change({ pushAfterSnapshot: e.target.checked })}
          />
        )}
        label={<Typography sx={{ fontSize: 13 }}>{s('prefs.pushAfterSnapshot')}</Typography>}
      />
    </Stack>
  )
}
