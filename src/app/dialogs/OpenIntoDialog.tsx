/**
 * Where a working file goes (ADR-0025).
 *
 * A working file is a whole organisation, and opening one used to write it
 * over whatever the app had open without a word — which is how a person's
 * working folder became the shipped example one evening. The question is
 * asked now, every time, and the two answers are as different as they look:
 * a **new folder** makes the file a working folder of its own and the app
 * moves there, leaving what was open untouched; **replace here** does what
 * opening always did, said out loud, with the warning as part of the button
 * and the words under it.
 *
 * The folder button is absent where no folder can be chosen — a browser tab
 * with no directory picker — and the dialog is then the confirmation before
 * an overwrite, which is the least it has to be.
 */
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import type { Translate } from '../../i18n'

export type OpenIntoDialogProps = {
  open: boolean
  /** The file, by name. */
  file: string
  /** What replacing writes over: the open scope, or the home's. */
  here: string
  /** Can a folder be chosen on this host? */
  canChooseFolder: boolean
  onCancel: () => void
  onFolder: () => void
  onHere: () => void
  s: Translate
}

export function OpenIntoDialog({
  open, file, here, canChooseFolder, onCancel, onFolder, onHere, s,
}: OpenIntoDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: 16 }}>{s('openInto.title', { name: file })}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 13, mb: 1.5 }}>{s('openInto.body')}</DialogContentText>
        <DialogContentText sx={{ fontSize: 13, color: 'warning.main' }}>
          {s('openInto.hereWarning', { scope: here })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button color="warning" onClick={onHere} data-testid="open-into-here">
          {s('openInto.here', { scope: here })}
        </Button>
        {canChooseFolder && (
          <Button variant="contained" onClick={onFolder} data-testid="open-into-folder">
            {s('openInto.newFolder')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
