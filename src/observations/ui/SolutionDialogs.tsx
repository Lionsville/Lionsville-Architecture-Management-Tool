// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The questions the Solutions tab asks in a dialog (ADR-0026): what a new
 * solution is and which cause it is for, which cause a solution addresses,
 * what an experiment is to find out, and why a solution is being dropped.
 *
 * Each says what it wants and lets the page perform it, as the observation
 * dialogs do: the page owns the lists, the numbering and the date.
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
import { CAUSE_STRENGTHS, formatCauseNumber } from '../observation'
import type { Cause, CauseStrength } from '../observation'
import { STRENGTH_LABEL } from '../observationScope'

const NONE = '__none'

export type NewSolutionDialogProps = {
  open: boolean
  /** The causes it could be for, roots first. */
  causes: readonly Cause[]
  /** The cause it is proposed for, when it was proposed from one. */
  causeId?: string
  onCancel: () => void
  onCreate: (fields: { title: string; causeId?: string }) => void
  s: Translate
}

export function NewSolutionDialog({ open, causes, causeId, onCancel, onCreate, s }: NewSolutionDialogProps) {
  const [title, setTitle] = useState('')
  const [cause, setCause] = useState(NONE)
  useEffect(() => { if (open) { setTitle(''); setCause(causeId ?? NONE) } }, [open, causeId])
  const ready = title.trim().length > 0
  const submit = () => { if (ready) onCreate({ title: title.trim(), ...(cause !== NONE ? { causeId: cause } : {}) }) }
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{s('solution.new')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={s('solution.newTitleField')}
          helperText={s('solution.newTitleHelp')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit() } }}
          slotProps={{ htmlInput: { 'data-testid': 'new-solution-title' } }}
        />
        <TextField
          select
          fullWidth
          size="small"
          label={s('solution.newCauseField')}
          value={cause}
          onChange={(event) => setCause(event.target.value)}
          slotProps={{ htmlInput: { 'aria-label': s('solution.newCauseField') } }}
        >
          <MenuItem value={NONE}>{s('solution.noCause')}</MenuItem>
          {causes.map((one) => <MenuItem key={one.id} value={one.id}>{formatCauseNumber(one.number)} · {one.title}</MenuItem>)}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={submit} data-testid="new-solution-create">{s('solution.create')}</Button>
      </DialogActions>
    </Dialog>
  )
}

export type AddressDialogProps = {
  /** What addresses; the dialog is closed while undefined. */
  subject?: { label: string }
  candidates: readonly Cause[]
  onCancel: () => void
  onConfirm: (choice: { causeId: string; strength: CauseStrength }) => void
  s: Translate
}

export function AddressDialog({ subject, candidates, onCancel, onConfirm, s }: AddressDialogProps) {
  const [causeId, setCauseId] = useState('')
  const [strength, setStrength] = useState<CauseStrength>('strong')
  useEffect(() => { if (subject) { setCauseId(''); setStrength('strong') } }, [subject])
  return (
    <Dialog open={Boolean(subject)} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{subject ? s('solution.addressTitle', { name: subject.label }) : ''}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField
          select fullWidth size="small" label={s('solution.addressPick')} value={causeId}
          onChange={(event) => setCauseId(event.target.value)}
          slotProps={{ htmlInput: { 'aria-label': s('solution.addressPick') } }}
        >
          {candidates.map((one) => <MenuItem key={one.id} value={one.id}>{formatCauseNumber(one.number)} · {one.title}</MenuItem>)}
        </TextField>
        <TextField
          select size="small" label={s('observation.linkStrength')} value={strength}
          onChange={(event) => setStrength(event.target.value as CauseStrength)}
          slotProps={{ htmlInput: { 'aria-label': s('observation.linkStrength') } }}
        >
          {CAUSE_STRENGTHS.map((one) => <MenuItem key={one} value={one}>{s(STRENGTH_LABEL[one])}</MenuItem>)}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!causeId} onClick={() => onConfirm({ causeId, strength })}>{s('solution.addressConfirm')}</Button>
      </DialogActions>
    </Dialog>
  )
}

export type NewExperimentDialogProps = {
  /** What it tests; the dialog is closed while undefined. */
  subject?: { label: string }
  onCancel: () => void
  onCreate: (fields: { title: string; hypothesis: string; measure: string }) => void
  s: Translate
}

export function NewExperimentDialog({ subject, onCancel, onCreate, s }: NewExperimentDialogProps) {
  const [title, setTitle] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [measure, setMeasure] = useState('')
  useEffect(() => { if (subject) { setTitle(''); setHypothesis(''); setMeasure('') } }, [subject])
  const ready = title.trim().length > 0 && hypothesis.trim().length > 0
  return (
    <Dialog open={Boolean(subject)} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{s('solution.newExperiment')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {subject && <DialogContentText>{subject.label}</DialogContentText>}
        <TextField autoFocus fullWidth size="small" label={s('solution.titleField')} value={title} onChange={(event) => setTitle(event.target.value)} slotProps={{ htmlInput: { 'data-testid': 'new-experiment-title' } }} />
        <TextField fullWidth size="small" multiline label={s('solution.hypothesis')} helperText={s('solution.hypothesisHelp')} value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} slotProps={{ htmlInput: { 'data-testid': 'new-experiment-hypothesis' } }} />
        <TextField fullWidth size="small" label={s('solution.measure')} value={measure} onChange={(event) => setMeasure(event.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={() => onCreate({ title: title.trim(), hypothesis: hypothesis.trim(), measure: measure.trim() })} data-testid="new-experiment-create">
          {s('solution.createExperiment')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export type DropDialogProps = {
  subject?: { label: string }
  onCancel: () => void
  onConfirm: (note: string) => void
  s: Translate
}

export function DropDialog({ subject, onCancel, onConfirm, s }: DropDialogProps) {
  const [note, setNote] = useState('')
  useEffect(() => { if (subject) setNote('') }, [subject])
  return (
    <Dialog open={Boolean(subject)} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{subject ? s('solution.dropTitle', { name: subject.label }) : ''}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{s('solution.dropBody')}</DialogContentText>
        <TextField autoFocus fullWidth size="small" multiline label={s('solution.dropNote')} value={note} onChange={(event) => setNote(event.target.value)} slotProps={{ htmlInput: { 'data-testid': 'drop-note' } }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!note.trim()} onClick={() => onConfirm(note.trim())} data-testid="drop-confirm">{s('solution.dropConfirm')}</Button>
      </DialogActions>
    </Dialog>
  )
}
