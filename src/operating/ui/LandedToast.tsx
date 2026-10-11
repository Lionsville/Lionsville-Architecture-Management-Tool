// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The toast after a library is brought in: what the one step did, and *Undo*.
 *
 * Drawn inside the operating model's page rather than by the shell's bar,
 * because the page is a dialog: a toast outside it is out of the keyboard's
 * reach while the page holds the focus. It says what the step did and offers
 * the undo for that step alone (`useLibraryStep`); a click elsewhere does not
 * close it, as the shell's own bar does not.
 */
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import type { Landed } from './useLibraryStep'

/** How long it stays up: long enough to read and reach *Undo*. */
const HIDE_AFTER_MS = 8_000

export function LandedToast({ landed, onUndo, onClose }: { landed: Landed | undefined; onUndo(): void; onClose(): void }) {
  const { t } = useStrings()
  const offer = landed?.kind === 'brought' && landed.undo !== undefined
  return (
    <Snackbar
      key={landed?.key} open={landed !== undefined} autoHideDuration={HIDE_AFTER_MS} disableWindowBlurListener
      onClose={(_event, reason) => { if (reason !== 'clickaway') onClose() }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Alert
        severity={landed?.kind === 'notUndone' ? 'warning' : 'success'} variant="filled" onClose={onClose} data-testid="operating-landed"
        sx={{ maxWidth: 640, fontSize: 13 }}
        action={offer ? <Button color="inherit" size="small" onClick={onUndo}>{t('operating.undo')}</Button> : undefined}
      >
        {landed ? landedWords(landed, t) : ''}
      </Alert>
    </Snackbar>
  )
}

/** What the step did, in a sentence: what it made from which library, and how many of the organisation's own it used. */
export function landedWords(landed: Landed, t: Translate): string {
  if (landed.kind === 'notUndone') return t('operating.notUndone')
  const { made, reused, library } = landed.brought
  const what = made > 0
    ? t(made === 1 ? 'operating.landedOne' : 'operating.landedOther', { count: made, library: library.name })
    : t('operating.landedNothing', { library: library.name })
  const used = reused > 0 ? ` ${t(reused === 1 ? 'operating.landedReusedOne' : 'operating.landedReusedOther', { count: reused })}` : ''
  return made > 0 ? `${what}${used} ${t('operating.landedNew')}` : `${what}${used}`
}
