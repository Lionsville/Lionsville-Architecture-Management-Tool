// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One field: what to call this snapshot (ADR-0008). The copy says what a
 * label is — beside the subject, never instead of it, and shared — because
 * "rename" is what a person will reach for, and this is deliberately not that.
 */
import { useEffect, useState } from 'react'
import { FieldsDialog } from '../../widgets/CompactForms'
import { DialogFooter } from '../../widgets/kit/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { FieldBox } from '../../widgets/kit/FieldBox'
import type { Translate } from '../../i18n'

export type LabelDialogProps = {
  open: boolean
  onCancel: () => void
  onLabel: (name: string) => void
  s: Translate
}

export function LabelDialog({ open, onCancel, onLabel, s }: LabelDialogProps) {
  const [name, setName] = useState('')
  useEffect(() => { if (open) setName('') }, [open])

  return (
    <FieldsDialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: 'var(--t-large)' }}>{s('history.labelTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 'var(--t-body)', mb: 2 }}>{s('history.labelBody')}</DialogContentText>
        <FieldBox
          autoFocus
          fullWidth
          label={s('history.labelField')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && name.trim()) { event.preventDefault(); onLabel(name.trim()) } }}
        />
      </DialogContent>
      <DialogFooter
        cancel={{ onClick: onCancel, label: s('common.cancel') }}
        outcome={{ disabled: name.trim().length === 0, onClick: () => onLabel(name.trim()), label: s('history.labelConfirm') }}
      />
    </FieldsDialog>
  )
}
