// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Taking a snapshot, and — the first time — deciding to keep a history at all.
 *
 * One dialog for both because they are one decision from where the user is
 * standing: they pressed Snapshot, and either this folder already keeps a
 * history or it is about to start. Splitting it into a consent dialog and then
 * a message dialog would be two clicks to record one thing.
 *
 * The message arrives drafted from the command log (ADR-0002) and is editable,
 * because sometimes the honest message is not the list of what happened but the
 * reason for it.
 */
import { useEffect, useState } from 'react'
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextField } from '../../widgets/kit/Field'

export type SnapshotDialogProps = {
  open: boolean
  /** False the first time in a folder: the dialog then explains what starting one means. */
  keeping: boolean
  /** What the command log suggests. Editable, and often edited. */
  draft: string
  onCancel: () => void
  onTake: (message: string) => void
  /**
   * Where the history is kept, in the source's provider's sentence: said
   * where a person starts one, because *in this browser* and *for as long as
   * this tab is open* are facts they should know first.
   */
  note?: string
  /** What the snapshot is of, for the title: the scope that is open, or the home's. */
  of?: string
  s: Translate
}

export function SnapshotDialog({ open, keeping, draft, onCancel, onTake, note, of, s }: SnapshotDialogProps) {
  const [message, setMessage] = useState(draft)

  // The draft is worked out when the dialog opens, not when it was declared.
  useEffect(() => { if (open) setMessage(draft) }, [open, draft])

  const ready = message.trim().length > 0
  const title = of ? s('history.snapshotOf', { name: of }) : s(keeping ? 'history.snapshot' : 'history.start')
  return (
    <Dialog
      open={open} size="m" title={title} onClose={onCancel} onSubmit={() => { if (ready) onTake(message.trim()) }}
      actions={(
        <>
          <Button onClick={onCancel}>{s('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={!ready} data-testid="snapshot-take">{s('history.take')}</Button>
        </>
      )}
    >
      <p>{keeping ? s('history.snapshotWhy') : note ? `${s('history.startBody')} ${note}` : s('history.startBody')}</p>
      <TextField autoFocus rows={2} label={s('history.message')} hint={s('history.messageHint')} value={message} onChange={setMessage} />
    </Dialog>
  )
}
