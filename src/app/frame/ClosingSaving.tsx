// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The page's half of a desktop window's close (`electron/main/windowGuard.ts`).
 *
 * *Saving…* while the window waits for a write before it closes — the page's
 * own, and a field typed in and not left, which is sent then: main holds a
 * close, a quit among them, until the work on screen is written, and says so
 * with `closing`. Without a word the window would sit there for as long as the
 * write takes and look frozen. It needs no answer and offers none: the window
 * goes when the write lands, and main asks its own question if it does not.
 *
 * And *Leave with a draft?*, the page's own question, where the window closes
 * over a draft (`closeAsked`): the window goes only where the person leaves it.
 */
import { useEffect, useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { Dialog } from '../../widgets/kit/Dialog'
import { leaveWithDrafts } from '../../widgets/kit/drafts'
import type { CommandStream } from '../useHostCommands'

export function ClosingSaving({ on, leave, keep, send }: {
  on: CommandStream; leave?: (() => void) | undefined; keep?: (() => void) | undefined
  /** Send what is typed and not sent yet (`writeRefusals.sendUnsent`): the window waits for it, and it is kept. */
  send?: (() => void) | undefined
}) {
  const { t } = useStrings()
  const [closing, setClosing] = useState(false)
  useEffect(() => on((command) => {
    if (command.type === 'closing') setClosing(command.saving)
    // Asked to write before the window goes: a field typed in and not left is written too.
    if ((command.type === 'save' || (command.type === 'closing' && command.saving)) && send) send()
    // Where the draft has gone by the time the question would be asked, the window simply goes.
    if (command.type === 'closeAsked' && leave) leaveWithDrafts(leave, keep)
  }), [on, leave, keep, send])
  return (
    <Dialog open={closing} title={t('shell.saving')} working onClose={() => undefined} data-testid="closing-saving">
      <p>{t('shell.savingBeforeClose')}</p>
    </Dialog>
  )
}
