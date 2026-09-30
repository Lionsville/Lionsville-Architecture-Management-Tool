// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The questions the observations page asks in a dialog: what a new observation
 * is, what a new cause is called, which observation another is the same as,
 * what lies behind a thing, and why an observation is being archived (ADR-0021).
 * Since 28 September 2026 also when it was seen again, and what confirmed a
 * cause that is being marked verified without its evidence written down.
 *
 * Each says what it wants and lets the page perform it — the page owns the
 * lists, the numbering and the date.
 */
import { useEffect, useState } from 'react'
import { useFreshFor } from '../../widgets/useFreshFor'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { causeLabel, formatObservationNumber, seenDayProblem, CAUSE_STRENGTHS, OBSERVATION_IMPACTS } from '../observation'
import type { Cause, CauseStrength, Observation, ObservationImpact } from '../observation'
import { IMPACT_LABEL, STRENGTH_LABEL } from '../observationScope'

export type NewObservationDialogProps = {
  open: boolean
  /** Whether sharing is worth asking: a root has nobody above it. */
  canShare: boolean
  onCancel: () => void
  onCreate: (fields: { title: string; where: string; by: string; impact: ObservationImpact; shared: boolean }) => void
  s: Translate
}

export function NewObservationDialog({ open, canShare, onCancel, onCreate, s }: NewObservationDialogProps) {
  const [title, setTitle] = useState('')
  const [where, setWhere] = useState('')
  const [by, setBy] = useState('')
  const [impact, setImpact] = useState<ObservationImpact>('minor')
  const [shared, setShared] = useState(false)
  useEffect(() => {
    if (open) { setTitle(''); setWhere(''); setBy(''); setImpact('minor'); setShared(false) }
  }, [open])
  const ready = title.trim().length > 0
  const submit = () => { if (ready) onCreate({ title: title.trim(), where: where.trim(), by: by.trim(), impact, shared }) }

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{s('observation.new')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={s('observation.newTitleField')}
          helperText={s('observation.newTitleHelp')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit() } }}
        />
        <TextField
          fullWidth
          size="small"
          label={s('observation.newWhereField')}
          value={where}
          onChange={(event) => setWhere(event.target.value)}
        />
        <TextField
          fullWidth
          size="small"
          label={s('observation.newByField')}
          value={by}
          onChange={(event) => setBy(event.target.value)}
        />
        <TextField
          select
          size="small"
          label={s('observation.newImpactField')}
          value={impact}
          onChange={(event) => setImpact(event.target.value as ObservationImpact)}
          slotProps={{ htmlInput: { 'aria-label': s('observation.newImpactField') } }}
        >
          {OBSERVATION_IMPACTS.map((one) => <MenuItem key={one} value={one}>{s(IMPACT_LABEL[one])}</MenuItem>)}
        </TextField>
        {canShare && (
          <FormControlLabel
            control={<Checkbox size="small" checked={shared} onChange={(event) => setShared(event.target.checked)} />}
            label={s('observation.newShareField')}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={submit}>{s('observation.create')}</Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Why an observation is being closed — fixed, addressed, no longer relevant —
 * asked once, kept beside the day in its history. The note is optional: the
 * archiving itself is the record.
 */
export type ArchiveDialogProps = {
  /** The observation being archived, by its id and the name the page shows; closed when absent. */
  subject: { id: string; label: string } | undefined
  onCancel: () => void
  onConfirm: (note: string) => void
  s: Translate
}

export function ArchiveDialog({ subject, onCancel, onConfirm, s }: ArchiveDialogProps) {
  const [note, setNote] = useState('')
  useFreshFor(subject, (one) => one.id, () => setNote(''))
  return (
    <Dialog open={Boolean(subject)} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{s('observation.archiveTitle', { name: subject?.label ?? '' })}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <DialogContentText sx={{ fontSize: 14 }}>{s('observation.archiveBody')}</DialogContentText>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={s('observation.archiveNote')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onConfirm(note.trim()) } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" onClick={() => onConfirm(note.trim())}>{s('observation.archiveConfirm')}</Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Seen again: on which day — today unless said, never in the future and
 * never before it was first seen — and, if there is one, a word about it.
 * The rules keep the day and the note in the observation's history.
 */
export type SeenDialogProps = {
  /** The observation, by its id and the name the page shows, and the day it was first seen; closed when absent. */
  subject: { id: string; label: string; firstSeen: string } | undefined
  /** `yyyy-mm-dd`. */
  today: string
  onCancel: () => void
  onConfirm: (seen: { date: string; note: string }) => void
  s: Translate
}

export function SeenDialog({ subject, today, onCancel, onConfirm, s }: SeenDialogProps) {
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const { language } = useStrings()
  useFreshFor(subject, (one) => one.id, () => { setDate(today); setNote('') })
  const problem = subject ? seenDayProblem({ date: subject.firstSeen }, date, today) : undefined
  const help = problem === 'future'
    ? s('observation.seenFuture')
    : problem === 'beforeFirst' && subject
      ? s('observation.seenBeforeFirst', { date: formatDay(subject.firstSeen, language) })
      : undefined
  const submit = () => { if (!problem) onConfirm({ date, note: note.trim() }) }
  return (
    <Dialog open={Boolean(subject)} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{s('observation.seenTitle', { name: subject?.label ?? '' })}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <DialogContentText sx={{ fontSize: 14 }}>{s('observation.seenBody')}</DialogContentText>
        <TextField
          type="date"
          size="small"
          label={s('observation.seenDate')}
          value={date}
          error={problem !== undefined}
          helperText={help}
          onChange={(event) => setDate(event.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today, min: subject?.firstSeen, 'data-testid': 'seen-date' } }}
        />
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={s('observation.seenNote')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit() } }}
          slotProps={{ htmlInput: { 'data-testid': 'seen-note' } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={problem !== undefined} onClick={submit} data-testid="seen-confirm">{s('observation.seenAgain')}</Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * What confirmed a cause (ADR-0021, amended 28 September 2026): asked when it
 * is marked verified while its body does not yet say why the team thinks so
 * and how it was verified. The answer is kept in the body, dated, under How
 * to verify; verifying without one is not offered.
 */
export type VerifyDialogProps = {
  /** The cause, by its id and the name the page shows; closed when absent. */
  subject: { id: string; label: string } | undefined
  onCancel: () => void
  onConfirm: (confirmed: string) => void
  s: Translate
}

export function VerifyDialog({ subject, onCancel, onConfirm, s }: VerifyDialogProps) {
  const [answer, setAnswer] = useState('')
  useFreshFor(subject, (one) => one.id, () => setAnswer(''))
  const ready = answer.trim().length > 0
  return (
    <Dialog open={Boolean(subject)} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{s('observation.verifyTitle', { name: subject?.label ?? '' })}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <DialogContentText sx={{ fontSize: 14 }}>{s('observation.verifyBody')}</DialogContentText>
        <TextField
          autoFocus
          fullWidth
          multiline
          size="small"
          label={s('observation.verifyField')}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'verify-answer' } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={() => onConfirm(answer.trim())} data-testid="verify-confirm">{s('observation.verify')}</Button>
      </DialogActions>
    </Dialog>
  )
}

export type NewCauseDialogProps = {
  open: boolean
  onCancel: () => void
  onCreate: (title: string) => void
  s: Translate
}

export function NewCauseDialog({ open, onCancel, onCreate, s }: NewCauseDialogProps) {
  const [title, setTitle] = useState('')
  useEffect(() => { if (open) setTitle('') }, [open])
  const ready = title.trim().length > 0
  const submit = () => { if (ready) onCreate(title.trim()) }
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{s('observation.newCause')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={s('observation.newTitleField')}
          helperText={s('observation.newCauseHelp')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit() } }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={submit}>{s('observation.createCause')}</Button>
      </DialogActions>
    </Dialog>
  )
}

export type MergeDialogProps = {
  /** The observation being merged away; the dialog is closed while undefined. */
  target?: Observation
  /** This scope's standing observations it could go into. */
  candidates: readonly Observation[]
  onCancel: () => void
  onConfirm: (intoId: string) => void
  s: Translate
}

export function MergeDialog({ target, candidates, onCancel, onConfirm, s }: MergeDialogProps) {
  const [into, setInto] = useState('')
  useFreshFor(target, (one) => one.id, () => setInto(''))
  return (
    <Dialog open={Boolean(target)} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        {target ? s('observation.mergeTitle', { name: `${formatObservationNumber(target.number)} ${target.title}` }) : ''}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{s('observation.mergeBody')}</DialogContentText>
        <TextField
          select
          fullWidth
          size="small"
          label={s('observation.mergePick')}
          value={into}
          onChange={(event) => setInto(event.target.value)}
          slotProps={{ htmlInput: { 'aria-label': s('observation.mergePick') } }}
        >
          {candidates.map((one) => (
            <MenuItem key={one.id} value={one.id}>{formatObservationNumber(one.number)} · {one.title}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!into} onClick={() => onConfirm(into)}>{s('observation.mergeConfirm')}</Button>
      </DialogActions>
    </Dialog>
  )
}

export type LinkDialogProps = {
  /** What is being explained, by its id and its name; the dialog is closed while undefined. */
  subject?: { id: string; label: string }
  /** The causes it may be linked to. */
  candidates: readonly Cause[]
  onCancel: () => void
  onConfirm: (choice: { causeId?: string; newTitle?: string; strength: CauseStrength }) => void
  s: Translate
}

const NEW = '__new'

export function LinkDialog({ subject, candidates, onCancel, onConfirm, s }: LinkDialogProps) {
  const [causeId, setCauseId] = useState(NEW)
  const [title, setTitle] = useState('')
  const [strength, setStrength] = useState<CauseStrength>('normal')
  useFreshFor(subject, (one) => one.id, () => { setCauseId(NEW); setTitle(''); setStrength('normal') })
  const ready = causeId !== NEW || title.trim().length > 0
  const submit = () => {
    if (!ready) return
    onConfirm(causeId === NEW ? { newTitle: title.trim(), strength } : { causeId, strength })
  }
  return (
    <Dialog open={Boolean(subject)} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{subject ? s('observation.linkTitle', { name: subject.label }) : ''}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField
          select
          fullWidth
          size="small"
          label={s('observation.linkPick')}
          value={causeId}
          onChange={(event) => setCauseId(event.target.value)}
          slotProps={{ htmlInput: { 'aria-label': s('observation.linkPick') } }}
        >
          <MenuItem value={NEW}>{s('observation.linkNew')}</MenuItem>
          {candidates.map((one) => (
            <MenuItem key={one.id} value={one.id}>{causeLabel(one)} · {one.title}</MenuItem>
          ))}
        </TextField>
        {causeId === NEW && (
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={s('observation.linkNewTitle')}
            helperText={s('observation.newCauseHelp')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit() } }}
          />
        )}
        <TextField
          select
          size="small"
          label={s('observation.linkStrength')}
          value={strength}
          onChange={(event) => setStrength(event.target.value as CauseStrength)}
          slotProps={{ htmlInput: { 'aria-label': s('observation.linkStrength') } }}
        >
          {CAUSE_STRENGTHS.map((one) => <MenuItem key={one} value={one}>{s(STRENGTH_LABEL[one])}</MenuItem>)}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={submit}>{s('observation.linkConfirm')}</Button>
      </DialogActions>
    </Dialog>
  )
}
