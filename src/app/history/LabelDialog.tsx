/**
 * One field: what to call this snapshot (ADR-0008). The copy says what a
 * label is — beside the subject, never instead of it, and shared — because
 * "rename" is what a person will reach for, and this is deliberately not that.
 */
import { useEffect, useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
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
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: 16 }}>{s('history.labelTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 13, mb: 2 }}>{s('history.labelBody')}</DialogContentText>
        <TextField
          autoFocus
          fullWidth
          label={s('history.labelField')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && name.trim()) onLabel(name.trim()) }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={name.trim().length === 0} onClick={() => onLabel(name.trim())}>
          {s('history.labelConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
