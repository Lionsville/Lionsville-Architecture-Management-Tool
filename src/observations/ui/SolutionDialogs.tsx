// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The questions the Solutions tab asks in a dialog (ADR-0026): what a new
 * solution is and which cause it is for, which cause a solution addresses,
 * what an experiment is to find out, why a solution is being dropped, and —
 * since 28 September 2026 — what an experiment found and the day it ended.
 *
 * Each says what it wants and lets the page perform it, as the observation
 * dialogs do: the page owns the lists, the numbering and the date.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useFreshFor } from '../../widgets/useFreshFor'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { causeLabel, CAUSE_STRENGTHS } from '../observation'
import type { Cause, CauseStrength } from '../observation'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import { RootCauseIcon } from '../../widgets/icons'
import { solutionTemplate } from '../solution'
import type { ExperimentOutcome, SolutionLink } from '../solution'
import { CausePicker, DescriptionField, ExampleField, LinkRowsTable } from './FormParts'
import type { LinkRow } from './FormParts'
import { OUTCOME_LABEL, STRENGTH_LABEL } from '../observationScope'

/** What a new solution is proposed with: its title, its body, and the root causes it addresses. */
export type NewSolution = { title: string; body: string; addresses: SolutionLink[] }

export type NewSolutionDialogProps = {
  open: boolean
  /** The root causes it could address: a solution addresses root causes only (ADR-0026). */
  causes: readonly Cause[]
  /** The cause it is proposed for, when it was proposed from one. */
  causeId?: string
  onCancel: () => void
  onCreate: (fields: NewSolution) => void
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  s: Translate
}

/**
 * The solution form (ADR-0032 §6), in the pattern of the observation form:
 * the title on the left with an example, the optional body with Edit and
 * Preview on the right, and under them the root causes it addresses, made on
 * submit with it as one step.
 */
export function NewSolutionDialog({ open, causes, causeId, onCancel, onCreate, renderMarkdown, s }: NewSolutionDialogProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [addresses, setAddresses] = useState<SolutionLink[]>([])
  const [picking, setPicking] = useState(false)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    if (!open) return
    setTitle(''); setBody(solutionTemplate(s)); setMissing(false); setPicking(false)
    setAddresses(causeId && causes.some((one) => one.id === causeId) ? [{ id: causeId, strength: 'strong' }] : [])
  }, [open, causeId, causes, s])
  const submit = () => {
    if (!title.trim()) { setMissing(true); return }
    onCreate({ title: title.trim(), body, addresses })
  }
  const rows: LinkRow[] = addresses.map((one) => {
    const held = causes.find((cause) => cause.id === one.id)
    return { key: one.id, label: held ? `${causeLabel(held)} ${held.title}` : one.id, kind: 'existing', root: true, strength: one.strength }
  })
  const label = addresses.length === 0
    ? s('solution.formPropose')
    : addresses.length === 1 ? s('solution.formProposeOne') : s('solution.formProposeMany', { count: addresses.length })
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="lg" fullWidth aria-labelledby="new-solution-title">
      <DialogTitle id="new-solution-title">{s('solution.new')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 13, mb: 2 }}>{s('solution.formIntro')}</DialogContentText>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 3, pt: 0.5 }}>
          <Box sx={{ alignContent: 'start', display: 'grid' }}>
            <ExampleField
              required autoFocus label={s('solution.newTitleField')} value={title}
              onChange={(value) => { setTitle(value); if (value.trim()) setMissing(false) }}
              example={s('solution.newTitleHelp')} problem={missing ? s('solution.formTitleMissing') : undefined}
              testId="new-solution-title"
            />
          </Box>
          <DescriptionField
            label={s('solution.formBody')} value={body} onChange={setBody} example={s('solution.formBodyExample')}
            renderMarkdown={renderMarkdown} s={s} minRows={8}
          />
        </Box>
        <Box component="section" aria-labelledby="new-solution-addresses" sx={{ borderTop: 1, borderColor: 'divider', mt: 2.5, pt: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography id="new-solution-addresses" component="h3" sx={{ fontSize: 15, fontWeight: 600 }}>{s('solution.formAddresses')}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{s('solution.formAddressesNote')}</Typography>
            <Tooltip title={s('solution.formAddRootTip')} describeChild>
              <Button size="small" variant="outlined" startIcon={<RootCauseIcon size={14} />} onClick={() => setPicking(true)} sx={{ textTransform: 'none' }} data-testid="new-solution-add-root">
                {s('observation.rootCause')}
              </Button>
            </Tooltip>
          </Box>
          <LinkRowsTable
            rows={rows} s={s} testId="new-solution-rows" empty={s('solution.formNoRoots')}
            onStrength={(key, strength) => setAddresses((held) => held.map((one) => (one.id === key ? { ...one, strength } : one)))}
            onRemove={(key) => setAddresses((held) => held.filter((one) => one.id !== key))}
          />
          {picking && (
            <CausePicker
              heading={s('solution.formAddresses')}
              candidates={causes.map((one) => ({ id: one.id, label: `${causeLabel(one)} ${one.title}`, root: true }))}
              taken={new Set(addresses.map((one) => one.id))}
              onPick={(id) => setAddresses((held) => [...held, { id, strength: 'strong' }])}
              onClose={() => setPicking(false)} s={s}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} sx={{ textTransform: 'none' }}>{s('common.cancel')}</Button>
        <Button variant="contained" onClick={submit} sx={{ textTransform: 'none' }} data-testid="new-solution-create">{label}</Button>
      </DialogActions>
    </Dialog>
  )
}

export type AddressDialogProps = {
  /** What addresses, by its id and its name; the dialog is closed while undefined. */
  subject?: { id: string; label: string }
  candidates: readonly Cause[]
  onCancel: () => void
  onConfirm: (choice: { causeId: string; strength: CauseStrength }) => void
  s: Translate
}

export function AddressDialog({ subject, candidates, onCancel, onConfirm, s }: AddressDialogProps) {
  const [causeId, setCauseId] = useState('')
  const [strength, setStrength] = useState<CauseStrength>('strong')
  useFreshFor(subject, (one) => one.id, () => { setCauseId(''); setStrength('strong') })
  return (
    <Dialog open={Boolean(subject)} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{subject ? s('solution.addressTitle', { name: subject.label }) : ''}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField
          select fullWidth size="small" label={s('solution.addressPick')} value={causeId}
          onChange={(event) => setCauseId(event.target.value)}
          slotProps={{ htmlInput: { 'aria-label': s('solution.addressPick') } }}
        >
          {candidates.map((one) => <MenuItem key={one.id} value={one.id}>{causeLabel(one)} · {one.title}</MenuItem>)}
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
        <Button sx={{ textTransform: 'none' }} onClick={onCancel}>{s('common.cancel')}</Button>
        <Button sx={{ textTransform: 'none' }} variant="contained" disabled={!causeId} onClick={() => onConfirm({ causeId, strength })}>{s('solution.addressConfirm')}</Button>
      </DialogActions>
    </Dialog>
  )
}

export type NewExperimentDialogProps = {
  /** What it tests, by its id and its name; the dialog is closed while undefined. */
  subject?: { id: string; label: string }
  onCancel: () => void
  onCreate: (fields: { title: string; hypothesis: string; measure: string }) => void
  s: Translate
}

export function NewExperimentDialog({ subject, onCancel, onCreate, s }: NewExperimentDialogProps) {
  const [title, setTitle] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [measure, setMeasure] = useState('')
  useFreshFor(subject, (one) => one.id, () => { setTitle(''); setHypothesis(''); setMeasure('') })
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
        <Button sx={{ textTransform: 'none' }} onClick={onCancel}>{s('common.cancel')}</Button>
        <Button sx={{ textTransform: 'none' }} variant="contained" disabled={!ready} onClick={() => onCreate({ title: title.trim(), hypothesis: hypothesis.trim(), measure: measure.trim() })} data-testid="new-experiment-create">
          {s('solution.createExperiment')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export type DropDialogProps = {
  /** The solution being dropped, by its id and its name; the dialog is closed while undefined. */
  subject?: { id: string; label: string }
  onCancel: () => void
  onConfirm: (note: string) => void
  s: Translate
}

export function DropDialog({ subject, onCancel, onConfirm, s }: DropDialogProps) {
  const [note, setNote] = useState('')
  useFreshFor(subject, (one) => one.id, () => setNote(''))
  return (
    <Dialog open={Boolean(subject)} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{subject ? s('solution.dropTitle', { name: subject.label }) : ''}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{s('solution.dropBody')}</DialogContentText>
        <TextField autoFocus fullWidth size="small" multiline label={s('solution.dropNote')} value={note} onChange={(event) => setNote(event.target.value)} slotProps={{ htmlInput: { 'data-testid': 'drop-note' } }} />
      </DialogContent>
      <DialogActions>
        <Button sx={{ textTransform: 'none' }} onClick={onCancel}>{s('common.cancel')}</Button>
        <Button sx={{ textTransform: 'none' }} variant="contained" disabled={!note.trim()} onClick={() => onConfirm(note.trim())} data-testid="drop-confirm">{s('solution.dropConfirm')}</Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Concluding an experiment (ADR-0026, amended 28 September 2026): the result,
 * in numbers where there are numbers, and the day it ended — today unless
 * said, never before it started. Without a result there is no conclusion to
 * make, so the button waits for one.
 */
export type ConcludeDialogProps = {
  /** The experiment, by its id and the name the page shows, the outcome it is concluded as, and what it holds already; closed when absent. */
  subject?: { id: string; label: string; outcome: ExperimentOutcome; result?: string; from?: string }
  /** `yyyy-mm-dd`. */
  today: string
  onCancel: () => void
  onConfirm: (fields: { result: string; to: string }) => void
  s: Translate
}

export function ConcludeDialog({ subject, today, onCancel, onConfirm, s }: ConcludeDialogProps) {
  const [result, setResult] = useState('')
  const [to, setTo] = useState(today)
  const { language } = useStrings()
  useFreshFor(subject, (one) => one.id, (one) => { setResult(one.result ?? ''); setTo(today) })
  const early = Boolean(subject?.from && to && to < subject.from)
  const ready = result.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(to) && !early
  return (
    <Dialog open={Boolean(subject)} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{subject ? s('solution.concludeTitle', { name: subject.label, outcome: s(OUTCOME_LABEL[subject.outcome]).toLowerCase() }) : ''}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField
          autoFocus fullWidth multiline size="small"
          label={s('solution.result')} helperText={s('solution.concludeResultHelp')}
          value={result} onChange={(event) => setResult(event.target.value)}
          slotProps={{ htmlInput: { 'data-testid': 'conclude-result' } }}
        />
        <TextField
          type="date" size="small" label={s('solution.toField')} value={to}
          error={early}
          helperText={early && subject?.from ? s('solution.concludeBeforeFrom', { date: formatDay(subject.from, language) }) : undefined}
          onChange={(event) => setTo(event.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: subject?.from, 'data-testid': 'conclude-to' } }}
        />
      </DialogContent>
      <DialogActions>
        <Button sx={{ textTransform: 'none' }} onClick={onCancel}>{s('common.cancel')}</Button>
        <Button sx={{ textTransform: 'none' }} variant="contained" disabled={!ready} onClick={() => onConfirm({ result: result.trim(), to })} data-testid="conclude-confirm">
          {s('solution.concludeConfirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
