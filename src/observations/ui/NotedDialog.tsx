// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useEffect, useState } from 'react'
import type { Translate } from '../../i18n'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextField } from '../../widgets/kit/Field'

/** Noted (decision 13): it leaves the waiting list with a mark, and the reason, where there is one, stays in its history. */
export function NotedDialog({ label, onCancel, onConfirm, s }: { label: string | undefined; onCancel: () => void; onConfirm: (reason: string) => void; s: Translate }) {
  const [reason, setReason] = useState('')
  useEffect(() => { if (label) setReason('') }, [label])
  return (
    <Dialog
      open={label !== undefined} title={s('observation.notedTitle')} onClose={onCancel} onSubmit={() => onConfirm(reason.trim())}
      actions={{
        cancel: { onClick: onCancel, label: s('common.cancel') },
        outcome: { type: 'submit', 'data-testid': 'noted-confirm', label: s('observation.notedConfirm') },
      }}
    >
      <p>{s('observation.notedBody', { name: label ?? '' })}</p>
      <TextField label={s('observation.notedReason')} value={reason} onChange={setReason} autoFocus data-testid="noted-reason" />
    </Dialog>
  )
}
