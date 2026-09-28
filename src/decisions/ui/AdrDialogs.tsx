// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The questions the decisions page asks in a dialog: what a new record is
 * called, which record replaces one being superseded, and why one is
 * rejected or withdrawn.
 *
 * Each says what it wants and lets the page perform it — the page owns the
 * lists, the numbering and the date.
 */
import { useEffect, useState } from 'react'
import { useFreshFor } from '../../widgets/useFreshFor'
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
  /**
   * The accepted records in the same list — the only ones a link can point
   * at: a link to another list is a dead end, and a proposal cannot replace a
   * decision in force (ADR-0008, amended 28 September 2026).
   */
  candidates: readonly Adr[]
  onCancel: () => void
  onConfirm: (successorId: string) => void
  s: Translate
}

export function SupersedeDialog({ target, candidates, onCancel, onConfirm, s }: SupersedeDialogProps) {
  const [successor, setSuccessor] = useState('')
  // Afresh for each record superseded, not for each render: the page builds
  // the candidates on every one, and following them sent the choice back to
  // the first record a second after it was made. A choice the list no
  // longer offers reads as the first one, so Confirm never names a record
  // the picker does not show.
  useFreshFor(target, (one) => one.id, () => setSuccessor(''))
  const chosen = candidates.some((adr) => adr.id === successor) ? successor : candidates[0]?.id ?? ''

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
            value={chosen}
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
        <Button variant="contained" disabled={!chosen} onClick={() => onConfirm(chosen)}>
          {s('adr.statusSuperseded')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export type ReasonDialogProps = {
  /** The record being rejected or withdrawn; the dialog is closed while undefined. */
  target?: Adr
  /** A proposal withdrawn, rather than a reviewed record rejected: the words differ, the move is the same. */
  withdraw: boolean
  /** Whether a reason must be given: always to withdraw, and to reject when no signer rejected it. */
  required: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
  s: Translate
}

/**
 * Why a record ends rejected. It keeps its number and is locked afterwards,
 * so the reason is the one thing a later reader has to go on.
 */
export function ReasonDialog({ target, withdraw, required, onCancel, onConfirm, s }: ReasonDialogProps) {
  const [reason, setReason] = useState('')
  useFreshFor(target, (one) => one.id, () => setReason(''))
  const ready = !required || reason.trim().length > 0
  const name = target ? `${formatAdrNumber(target.number)} ${target.title}` : ''

  return (
    <Dialog open={Boolean(target)} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{s(withdraw ? 'adr.withdrawTitle' : 'adr.rejectTitle', { name })}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 14, mb: 2 }}>{s(withdraw ? 'adr.withdrawBody' : 'adr.rejectBody')}</DialogContentText>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={2}
          size="small"
          required={required}
          label={s('adr.reasonField')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" color="error" disabled={!ready} onClick={() => onConfirm(reason.trim())}>
          {s(withdraw ? 'adr.withdraw' : 'adr.reject')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
