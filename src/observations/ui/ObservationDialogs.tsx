// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The short questions the observations page asks in a dialog: why an
 * observation is being archived (ADR-0021); since 28 September 2026 also when
 * it was seen again, and what confirmed a cause that is being marked verified
 * without its evidence written down. The forms that make records — an observation with
 * its causes, a cause with its links — are `ObservationForm` and `LinkForm`
 * (ADR-0032 §6). Which records are one thing is asked on a screen of its
 * own, the merge screen (ADR-0035).
 *
 * Each says what it wants and lets the page perform it — the page owns the
 * lists, the numbering and the date.
 */
import { useState } from 'react'
import { useFreshFor } from '../../widgets/useFreshFor'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { seenDayProblem } from '../observation'

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
        <Button sx={{ textTransform: 'none' }} onClick={onCancel}>{s('common.cancel')}</Button>
        <Button sx={{ textTransform: 'none' }} variant="contained" onClick={() => onConfirm(note.trim())}>{s('observation.archiveConfirm')}</Button>
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
        <Button sx={{ textTransform: 'none' }} onClick={onCancel}>{s('common.cancel')}</Button>
        <Button sx={{ textTransform: 'none' }} variant="contained" disabled={problem !== undefined} onClick={submit} data-testid="seen-confirm">{s('observation.seenAgain')}</Button>
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
        <Button sx={{ textTransform: 'none' }} onClick={onCancel}>{s('common.cancel')}</Button>
        <Button sx={{ textTransform: 'none' }} variant="contained" disabled={!ready} onClick={() => onConfirm(answer.trim())} data-testid="verify-confirm">{s('observation.verify')}</Button>
      </DialogActions>
    </Dialog>
  )
}
