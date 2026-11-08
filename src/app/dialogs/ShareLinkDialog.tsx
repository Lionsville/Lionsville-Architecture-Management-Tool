// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Share with a link…*: the link to the place on screen, to read, select and
 * copy again — or the sentence that says why there is none, and what to do
 * instead (ADR-0033, amended). Presentational: the link is made, and copied the
 * first time, by `useShareLink`; this places what it is handed.
 *
 * The link is in a read-only field rather than in a paragraph, so a person
 * whose clipboard refused can select all of it with one click and a key, and
 * a screen reader reads it as the value of something named.
 */
import type { Translate } from '../../i18n'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextField } from '../../widgets/kit/Field'
import type { ShareAnswer } from '../useShareLink'

export function ShareLinkDialog({ answer, onCopy, onClose, onSaveCopy, place, example = false, s }: {
  /** What the last press came to; absent, the dialog is shut. */
  answer: ShareAnswer | undefined
  onCopy: () => void
  onClose: () => void
  /** The answer where no link can be made: hand the work over as a file. */
  onSaveCopy?: () => void
  /** Where the work is kept, in the source's word: a refusal says the true one. */
  place?: string
  /** The example is up: nothing of it is kept, so there is nothing a link could reach, and no copy to hand over. */
  example?: boolean
  s: Translate
}) {
  const link = answer && 'link' in answer ? answer.link : undefined
  const refused = answer && 'refused' in answer ? answer.refused : undefined
  const noAddress = refused === 'share.noAddress'
  return (
    <Dialog
      open={answer !== undefined}
      title={s(noAddress ? 'share.noLinkTitle' : 'share.title')}
      onClose={onClose}
      actions={{
        cancel: { onClick: onClose, label: s('common.close') },
        outcome: link !== undefined
          ? { onClick: onCopy, label: s('share.copy') }
          : noAddress && !example && onSaveCopy && { onClick: () => { onClose(); onSaveCopy() }, 'data-testid': 'share-save-copy', label: s('menu.exportWorkingFile') },
      }}
    >
      {link !== undefined && (
        <>
          <p>{s('share.what')}</p>
          <TextField label={s('share.linkLabel')} value={link} onChange={() => undefined} readOnly onFocus={(event) => event.target.select()} data-testid="share-link" />
        </>
      )}
      {refused && <p data-testid="share-refused">{example && noAddress ? s('share.example') : noAddress && place ? s('share.noAddressAt', { place }) : s(refused)}</p>}
      {noAddress && !example && <p>{s('share.handOver')}</p>}
    </Dialog>
  )
}
