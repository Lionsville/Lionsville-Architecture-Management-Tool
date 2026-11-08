// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a saved copy goes (ADR-0025).
 *
 * A saved copy is a whole organisation, and opening one used to write it over
 * whatever the app had open without a word — which is how a person's working
 * folder became the shipped example one evening. So the question says what is in
 * the file and what would happen here, for this place only: the app knows which
 * case it is in, and a conditional sentence at the moment of danger makes a
 * person reason where they should be told.
 *
 * Three shapes of one question. Where another place can be chosen, two rows naming
 * each outcome. Where none can and a history is kept, one outcome and its way
 * back. Where none can and no history is kept, the danger block, with the way to
 * save what is here first.
 */
import { useEffect, useState } from 'react'
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { Dialog, DialogChoices, DialogDanger, DialogFacts } from '../../widgets/kit/Dialog'

export type OpenIntoDialogProps = {
  open: boolean
  /** The file, by name. */
  file: string
  /** What the file says it is, and what it holds in words. */
  holdsName?: string
  holds?: string
  /** What replacing writes over: the open scope, or the home's. */
  here: string
  /** How many scopes are filed under it. */
  below?: number
  /** Can somewhere else be chosen on this host? */
  canGoElsewhere: boolean
  /** A snapshot is taken before replacing, so it can be restored from History. */
  keepsHistory?: boolean
  /**
   * What is here could not be read whole: replacing it puts it back from the
   * file, and keeps what could not be read first (`ScopeState.unreadable`).
   */
  puttingBack?: boolean
  onCancel: () => void
  onElsewhere: () => void
  onHere: () => void
  /** Save a copy of what is here, then come back to this question. */
  onSaveCopyFirst?: () => void
  s: Translate
}

export function OpenIntoDialog({
  open, file, holdsName, holds, here, below = 0, canGoElsewhere, keepsHistory = false, puttingBack = false, onCancel, onElsewhere, onHere, onSaveCopyFirst, s,
}: OpenIntoDialogProps) {
  const [choice, setChoice] = useState<'elsewhere' | 'here'>('elsewhere')
  useEffect(() => { if (open) setChoice('elsewhere') }, [open])
  const facts = holdsName !== undefined && (
    <DialogFacts title={s('openInto.inFile', { name: holdsName })}>{holds}</DialogFacts>
  )
  const writesOver = below > 0 ? s('openInto.writesOverBelow', { scope: here, count: below }) : s('openInto.writesOver', { scope: here })
  const hereEffect = puttingBack
    ? s('openInto.herePutsBack', { scope: here })
    : keepsHistory ? `${writesOver} ${s('openInto.snapshotFirst')}` : `${writesOver} ${s('openInto.noWayBack')}`
  const cancel = <Button variant="quiet" onClick={onCancel}>{s('common.cancel')}</Button>

  if (canGoElsewhere) {
    return (
      <Dialog
        open={open} size="m" title={s('openInto.title', { name: file })} onClose={onCancel}
        actions={(
          <>
            {cancel}
            {choice === 'elsewhere'
              ? <Button variant="primary" onClick={onElsewhere} data-testid="open-into-elsewhere">{s('openInto.elsewhere')}</Button>
              : <Button variant={keepsHistory || puttingBack ? 'primary' : 'danger'} onClick={onHere} data-testid="open-into-here">{s('openInto.here', { scope: here })}</Button>}
          </>
        )}
      >
        {facts}
        <DialogChoices
          label={s('openInto.title', { name: file })}
          value={choice}
          onChange={setChoice}
          options={[
            { value: 'elsewhere', label: s('openInto.newPlace'), effect: s('openInto.newPlaceEffect'), 'data-testid': 'open-into-choose-elsewhere' },
            { value: 'here', label: s('openInto.here', { scope: here }), effect: hereEffect, danger: !keepsHistory && !puttingBack, 'data-testid': 'open-into-choose-here' },
          ]}
        />
      </Dialog>
    )
  }
  if (keepsHistory || puttingBack) {
    return (
      <Dialog
        open={open} size="m" title={s('openInto.title', { name: file })} onClose={onCancel}
        actions={<>{cancel}<Button variant="primary" onClick={onHere} data-testid="open-into-here">{s('openInto.here', { scope: here })}</Button></>}
      >
        {facts}
        <p>{hereEffect}</p>
      </Dialog>
    )
  }
  return (
    <Dialog
      open={open} size="m" title={s('openInto.replaceTitle', { name: file })} onClose={onCancel}
      actions={(
        <>
          {onSaveCopyFirst && <Button variant="quiet" onClick={onSaveCopyFirst} data-testid="open-into-copy-first">{s('openInto.copyFirst', { scope: here })}</Button>}
          {cancel}
          <Button variant="danger" onClick={onHere} data-testid="open-into-here">{s('openInto.replaceAndLose')}</Button>
        </>
      )}
    >
      {facts}
      <DialogDanger title={below > 0 ? s('openInto.goneBelow', { scope: here, count: below }) : s('openInto.gone', { scope: here })}>
        {s('openInto.noHistoryHere')}
      </DialogDanger>
    </Dialog>
  )
}
