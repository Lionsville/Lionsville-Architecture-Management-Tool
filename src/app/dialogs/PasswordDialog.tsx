/**
 * The password a working file leaves under, and the one it is opened with
 * (ADR-0023).
 *
 * Two shapes of the same dialog, because the two moments differ in what a
 * mistake costs. *Set* asks twice: a typo in a password nobody can recover
 * is the file lost, and the second field is the only check there is. *Enter*
 * asks once and carries the last answer's verdict as an error under the
 * field, so a wrong password is a second try and not a second toast.
 *
 * Confirm is disabled rather than refused: an empty password is not a
 * sealed file, and the field says so by not offering the button.
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

export type PasswordMode = 'set' | 'enter'

export type PasswordDialogProps = {
  open: boolean
  mode: PasswordMode
  /** What went wrong with the last answer, under the field. */
  error?: string
  onCancel: () => void
  onConfirm: (password: string) => void
  s: Translate
}

export function PasswordDialog({ open, mode, error, onCancel, onConfirm, s }: PasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  useEffect(() => { if (open) { setPassword(''); setRepeat('') } }, [open, mode])

  const mismatch = mode === 'set' && repeat.length > 0 && repeat !== password
  const ready = password.length > 0 && (mode === 'enter' || repeat === password)
  const confirm = () => { if (ready) onConfirm(password) }

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: 16 }}>{s(mode === 'set' ? 'seal.setTitle' : 'seal.enterTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 13, mb: 2 }}>
          {s(mode === 'set' ? 'seal.setBody' : 'seal.enterBody')}
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          type="password"
          autoComplete={mode === 'set' ? 'new-password' : 'current-password'}
          label={s('seal.password')}
          value={password}
          error={mode === 'enter' && Boolean(error)}
          helperText={mode === 'enter' ? error : undefined}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') confirm() }}
          inputProps={{ 'data-testid': 'password' }}
        />
        {mode === 'set' && (
          <TextField
            fullWidth
            type="password"
            autoComplete="new-password"
            label={s('seal.repeat')}
            value={repeat}
            error={mismatch}
            helperText={mismatch ? s('seal.mismatch') : undefined}
            onChange={(event) => setRepeat(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') confirm() }}
            inputProps={{ 'data-testid': 'password-repeat' }}
            sx={{ mt: 2 }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={confirm} data-testid="password-confirm">
          {s(mode === 'set' ? 'seal.confirmSet' : 'seal.confirmEnter')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
