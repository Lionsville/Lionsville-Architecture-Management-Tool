// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The question a folder pick asks when there is work kept in this browser to
 * bring along.
 *
 * Choosing a folder used to copy whatever browser storage held into it, once
 * per folder and without a word. That is right exactly once — the first time
 * somebody moves their work out of the app and into files — and wrong every
 * time after it: a folder made to start something new arrived with somebody
 * else's landscape already in it.
 *
 * So the copy is an answer rather than a side effect, and asked only when it
 * can mean something: the folder was just chosen, nothing has been rescued
 * anywhere yet, this folder has not been asked already, and there is work to
 * bring. A dialog nothing but its two answers closes — a question clicked away
 * would be asked again at the next pick, and answered by nobody.
 *
 * Both answers are safe, and the text says so: nothing is deleted either way,
 * and the work stays in this browser until somebody moves it on purpose. A no
 * is remembered per folder, because a browser hands out a folder permission
 * that rarely survives a restart: the same folder is picked again on the next
 * boot, and a question already answered must not be asked twice. A copy that
 * did not finish is recorded as neither, and asked again.
 *
 * A yes stays on screen until the copy is done, busy while it runs — a copy
 * of a large landscape takes a while, and a dialog that closed at once said
 * it was done before it was — and then says what came of it: how many scopes
 * were copied, which could not be, or why nothing was. What the open scope
 * held unwritten is written first, so the copy never writes over an edit.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n'
import { reasonOf } from '../../platform/errors'
import { copyScopes, holdsWork } from '../../projects/copyScopes'
import type { CopyTally } from '../../projects/copyScopes'
import type { SourceChromeProps } from '../../ports/ProviderParts'
import type { FolderAdoption, FolderOwn } from './folderOwn'
import { mayOfferAdoption, readDeclinedFolders, readMigratedFolders } from './remembered'

type AdoptionProps = Pick<SourceChromeProps<FolderOwn>, 'preferences' | 'reread' | 'flush'> & {
  own: FolderOwn
  adoption: FolderAdoption
}

/** Where the question stands: not up, asked, copying, or saying what came of the copy. */
type Stage =
  | { at: 'closed' }
  | { at: 'asking' }
  | { at: 'copying' }
  | { at: 'said'; severity: 'success' | 'warning' | 'error'; text: string }

export function FolderAdoptionQuestion({ own, adoption, preferences, reread, flush }: AdoptionProps) {
  const { t: s } = useStrings()
  const [stage, setStage] = useState<Stage>({ at: 'closed' })
  // Once, as the folder opens: whether to ask at all. An answer given while
  // the question is up is what closes it, and it is not decided again.
  const decided = useRef(false)
  useEffect(() => {
    if (decided.current) return
    decided.current = true
    if (!mayOfferAdoption(preferences.read(), adoption.root)) return
    void holdsWork(adoption.from).then((holds) => { if (holds) setStage({ at: 'asking' }) })
  }, [adoption, preferences])

  const copied = useCallback((tally: CopyTally) => {
    // A scope the old place could not read is left behind, and the line says
    // so at the level a person looking for lost work reads.
    own.note(tally.unread > 0 ? 'warn' : 'info', 'migration',
      `copied ${tally.scopes} scopes, kept ${tally.kept}, failed ${tally.failed}, unread ${tally.unread}`)
    // A copy that wrote nothing because the folder already held it all has
    // rescued the work as surely as one that wrote every scope.
    if (tally.scopes > 0 || tally.failed === 0) {
      preferences.write({ migratedFolders: [...new Set([...readMigratedFolders(preferences.read()), adoption.root])] })
    }
    reread()
    const missed = tally.missed.length
    setStage(missed === 0
      ? { at: 'said', severity: 'success', text: s('folder.adoptDone', { copied: tally.scopes, name: adoption.name }) }
      : {
          at: 'said', severity: 'warning',
          text: s('folder.adoptPartly', { copied: tally.scopes, failed: missed, paths: tally.missed.map((path) => path || '/').join(', ') }),
        })
  }, [own, adoption, preferences, reread, s])

  const copy = useCallback(() => {
    setStage({ at: 'copying' })
    void flush()
      .then(() => copyScopes(adoption.from, adoption.into))
      .then(copied, (cause: unknown) => {
        own.report('migration', cause)
        setStage({ at: 'said', severity: 'error', text: s('folder.adoptFailed', { message: reasonOf(cause) }) })
      })
  }, [own, adoption, flush, copied, s])

  const skip = useCallback(() => {
    setStage({ at: 'closed' })
    preferences.write({ declinedFolders: [...new Set([...readDeclinedFolders(preferences.read()), adoption.root])] })
  }, [adoption, preferences])

  const close = useCallback(() => setStage({ at: 'closed' }), [])

  return (
    <Dialog open={stage.at !== 'closed'} maxWidth="sm" fullWidth aria-busy={stage.at === 'copying'}>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 600 }}>{s('folder.adoptTitle')}</DialogTitle>
      <DialogContent data-testid="adopt-folder">
        {stage.at === 'asking' && <Typography sx={{ fontSize: 13 }}>{s('folder.adoptBody', { name: adoption.name })}</Typography>}
        {stage.at === 'copying' && (
          <>
            <Typography sx={{ fontSize: 13, mb: 1.5 }} role="status">{s('folder.adoptCopying', { name: adoption.name })}</Typography>
            <CircularProgress size={20} data-testid="adopt-busy" />
          </>
        )}
        {stage.at === 'said' && (
          <Alert severity={stage.severity} role={stage.severity === 'error' ? 'alert' : 'status'} data-testid="adopt-outcome" sx={{ fontSize: 13 }}>
            {stage.text}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        {stage.at === 'asking' && (
          <>
            <Button size="small" onClick={skip} data-testid="adopt-skip">{s('folder.adoptSkip')}</Button>
            <Button size="small" variant="contained" onClick={copy} data-testid="adopt-copy">{s('folder.adoptCopy')}</Button>
          </>
        )}
        {stage.at === 'said' && (
          <Button size="small" variant="contained" onClick={close} data-testid="adopt-close">{s('folder.adoptClose')}</Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
