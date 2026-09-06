/**
 * The name for a new landscape.
 *
 * The name is the state: `null` means closed. That way there is no second flag
 * beside it that can drift out of step with it.
 */
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import type { Translate } from '../../i18n'

export type NewDiagramDialogProps = {
  /** The name as typed, or `null` when the dialog is closed. */
  name: string | null
  onNameChange: (name: string | null) => void
  onConfirm: () => void
  s: Translate
}

export function NewDiagramDialog({ name, onNameChange, onConfirm, s }: NewDiagramDialogProps) {
  const empty = (name ?? '').trim().length === 0
  return (
    <Dialog open={name !== null} onClose={() => onNameChange(null)} maxWidth="xs" fullWidth>
      <DialogTitle>{s('shell.newDiagram')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label={s('common.name')}
          value={name ?? ''}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !empty) onConfirm() }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onNameChange(null)}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={empty} onClick={onConfirm}>{s('shell.add')}</Button>
      </DialogActions>
    </Dialog>
  )
}
