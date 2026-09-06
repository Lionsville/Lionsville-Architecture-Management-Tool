/**
 * The two questions the decisions page asks in a dialog: what a new record is
 * called, and which record replaces one being superseded.
 *
 * Both say what they want and let the page perform it — the page owns the
 * lists, the numbering and the date.
 */
import { useEffect, useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import type { Translate } from '../../i18n'
import { formatAdrNumber } from '../adr'
import type { Adr } from '../adr'

export type NewAdrDialogProps = {
  open: boolean
  onCancel: () => void
  onCreate: (title: string) => void
  s: Translate
}

export function NewAdrDialog({ open, onCancel, onCreate, s }: NewAdrDialogProps) {
  const [title, setTitle] = useState('')
  useEffect(() => { if (open) setTitle('') }, [open])
  const ready = title.trim().length > 0
  const submit = () => { if (ready) onCreate(title.trim()) }

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{s('adr.new')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={s('adr.newTitleField')}
          helperText={s('adr.newTitleHelp')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit() } }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={submit}>{s('adr.create')}</Button>
      </DialogActions>
    </Dialog>
  )
}

export type SupersedeDialogProps = {
  /** The record being superseded; the dialog is closed while undefined. */
  target?: Adr
  /** The other records in the same list — the only ones a link can point at. */
  candidates: readonly Adr[]
  onCancel: () => void
  onConfirm: (successorId: string) => void
  s: Translate
}

export function SupersedeDialog({ target, candidates, onCancel, onConfirm, s }: SupersedeDialogProps) {
  const [successor, setSuccessor] = useState('')
  useEffect(() => { if (target) setSuccessor(candidates[0]?.id ?? '') }, [target, candidates])

  return (
    <Dialog open={Boolean(target)} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{s('adr.supersedeTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 14, mb: 2 }}>{s('adr.supersedeBody')}</DialogContentText>
        {candidates.length === 0 ? (
          <DialogContentText sx={{ fontSize: 13 }}>{s('adr.noSuccessor')}</DialogContentText>
        ) : (
          <TextField
            select
            fullWidth
            size="small"
            label={s('adr.successor')}
            value={successor}
            onChange={(event) => setSuccessor(event.target.value)}
          >
            {candidates.map((adr) => (
              <MenuItem key={adr.id} value={adr.id}>
                {formatAdrNumber(adr.number)} · {adr.title}
              </MenuItem>
            ))}
          </TextField>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!successor} onClick={() => onConfirm(successor)}>
          {s('adr.statusSuperseded')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
