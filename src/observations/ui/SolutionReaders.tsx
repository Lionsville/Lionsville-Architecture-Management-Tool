// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The reading pane for a solution and for an experiment (ADR-0026).
 *
 * A solution's reader is where it is vetted: the questions its record asks,
 * what it addresses, the answers the next gate needs — each with its control
 * beside it, so nobody has to go looking for the field a gate is waiting on —
 * and the button that moves it on, which stays disabled until the list is
 * clear. Once it is implemented the reader asks whether it worked: the
 * observations under what it addresses, and whether any was seen since.
 *
 * Title and body follow the other readers: a local draft, committed when it
 * has been quiet for a moment and when the mode switches back to read.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import { DocumentSheet } from '../../documentation/ui/DocumentSheet'
import { DocumentSource } from '../../documentation/ui/DocumentSource'
import type { DocumentImages } from '../../documentation/ui/DocumentSource'
import { EXPERIMENT_OUTCOMES, SOLUTION_SIZES, formatExperimentNumber, formatSolutionNumber, previousState } from '../solution'
import type {
  EarlierAttempt, Experiment, ExperimentOutcome, ExperimentPatch, Gate, Solution, SolutionPatch, SolutionPhase,
  SolutionQuestion, SolutionSize, SolutionState,
} from '../solution'
import type { CauseStrength } from '../observation'
import {
  GATE_LABEL, OUTCOME_COLOR, OUTCOME_LABEL, PHASE_COLOR, PHASE_LABEL, QUESTION_LABEL, SIZE_LABEL, STRENGTH_LABEL,
} from '../observationScope'
import { LinkList, Term, Value, useDraft } from './Readers'
import type { Mode } from './Readers'

const MONO = 'ui-monospace, Menlo, monospace'

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <Box sx={{ mt: 3 }} data-testid={testId}>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>{title}</Typography>
      {children}
    </Box>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <Box component="span" sx={{ color: 'text.secondary' }}>{children}</Box>
}

/** A line of text written on blur rather than on every key, for the one-line answers. */
function AnswerField(props: { label: string; value: string; onSave: (value: string) => void; disabled: boolean; testId?: string; multiline?: boolean }) {
  const [draft, setDraft] = useState(props.value)
  useEffect(() => setDraft(props.value), [props.value])
  return (
    <TextField
      size="small"
      fullWidth
      multiline={props.multiline}
      label={props.label}
      value={draft}
      disabled={props.disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => { if (draft !== props.value) props.onSave(draft) }}
      slotProps={{ htmlInput: { 'data-testid': props.testId } }}
    />
  )
}

// --- one solution -------------------------------------------------------------------------

export type SolutionReaderProps = {
  solution: Solution
  phase: SolutionPhase
  gate?: Gate
  questions: readonly SolutionQuestion[]
  /** What it addresses, resolved by the page. */
  addresses: readonly { id: string; label: string; strength: CauseStrength; root: boolean }[]
  experiments: readonly { key: string; label: string; outcome: ExperimentOutcome }[]
  alternatives: readonly { key: string; label: string; phase: SolutionPhase }[]
  decision?: { label: string; status: string }
  plan?: { label: string; status: string }
  /** Once implemented: the day it counts from, and the observations under it. */
  implemented?: {
    since: string
    observations: readonly { key: string; label: string; seenOn?: string }[]
  }
  readOnly: boolean
  s: Translate
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  nameOf: (id: string) => string
  onUpdate: (patch: SolutionPatch) => void
  onMove: (to: SolutionState) => void
  onWaive: (reason: string) => void
  onAddress: () => void
  onUnaddress: (causeId: string) => void
  onPlanExperiment: () => void
  onDecide?: () => void
  onStartPlan?: () => void
  onOpenDecision?: () => void
  onOpenPlan?: () => void
  onDrop: () => void
  onRestore: () => void
  onDelete: () => void
  onOpen: (key: string) => void
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
}

export function SolutionReader(props: SolutionReaderProps) {
  const { solution, phase, gate, s, renderMarkdown, readOnly } = props
  const dropped = solution.state === 'dropped'
  const canEdit = !readOnly && !dropped
  const stored = useMemo(() => ({ title: solution.title, body: solution.body }), [solution])
  const { mode, draft, setDraft, commit, switchMode } = useDraft(stored, (patch) => props.onUpdate(patch), canEdit)
  const [previewShown, setPreviewShown] = useState(true)
  const showPreview = mode === 'read' || previewShown
  const text = mode === 'edit' ? draft.body : solution.body
  const rendered = text.trim() ? renderMarkdown(text) : <Typography color="text.secondary">{s('common.empty')}</Typography>
  const label = formatSolutionNumber(solution.number)
  const back = previousState(solution.state)
  const open = gate ? gate.items.filter((one) => !one.ok) : []

  const [name, setName] = useState('')
  const [attempt, setAttempt] = useState<EarlierAttempt>({ when: '', what: '', why: '' })
  const [waiver, setWaiver] = useState('')
  const addName = () => {
    if (!name.trim()) return
    props.onUpdate({ validatedWith: [...solution.validatedWith, name] })
    setName('')
  }
  const addAttempt = () => {
    if (!attempt.what.trim() && !attempt.why.trim()) return
    props.onUpdate({ attempts: [...solution.attempts, attempt], noneKnown: false })
    setAttempt({ when: '', what: '', why: '' })
  }

  const sizePicker = (field: 'benefit' | 'cost', value: SolutionSize | undefined) => (
    canEdit ? (
      <ToggleButtonGroup
        exclusive size="small" value={value ?? null}
        onChange={(_e, next: SolutionSize | null) => props.onUpdate({ [field]: next ?? undefined })}
        aria-label={s(field === 'benefit' ? 'solution.benefitField' : 'solution.costField')}
        data-testid={`solution-${field}`}
      >
        {SOLUTION_SIZES.map((size) => <ToggleButton key={size} value={size} sx={{ py: 0, px: 1, fontSize: 11 }}>{s(SIZE_LABEL[size])}</ToggleButton>)}
      </ToggleButtonGroup>
    ) : value ? s(SIZE_LABEL[value]) : <Muted>{s('solution.unset')}</Muted>
  )

  return (
    <Box data-testid="solution-reader" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexWrap: 'wrap' }}>
        <Chip size="small" color={PHASE_COLOR[phase]} label={s(PHASE_LABEL[phase])} data-testid="solution-phase" />
        <Box sx={{ flex: 1 }} />
        {canEdit && (
          <>
            <Button size="small" variant="outlined" onClick={props.onAddress}>{s('solution.addressCause')}</Button>
            <Button size="small" variant="outlined" onClick={props.onPlanExperiment}>{s('solution.planExperiment')}</Button>
            {solution.state !== 'adopted' && <Button size="small" onClick={props.onDrop} data-testid="solution-drop">{s('solution.drop')}</Button>}
            <Button size="small" color="error" onClick={props.onDelete}>{s('observation.delete')}</Button>
          </>
        )}
        {dropped && !readOnly && (
          <Button size="small" variant="outlined" onClick={props.onRestore} data-testid="solution-restore">{s('solution.restore')}</Button>
        )}
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_e, value: Mode | null) => switchMode(value)}>
          <ToggleButton value="read">{s('observation.read')}</ToggleButton>
          {canEdit && <ToggleButton value="edit">{s('observation.edit')}</ToggleButton>}
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: mode === 'edit' && showPreview ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
        {mode === 'edit' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <TextField size="small" fullWidth label={s('solution.titleField')} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} onBlur={commit} />
            </Box>
            <DocumentSource
              value={draft.body}
              onChange={(body) => setDraft((d) => ({ ...d, body }))}
              onBlur={commit}
              label={s('solution.source')}
              onAddImage={props.onAddImage}
              images={props.images}
              preview={{ shown: previewShown, onToggle: () => setPreviewShown((on) => !on) }}
            />
          </Box>
        )}
        {showPreview && (
          <DocumentSheet dense={mode === 'edit'}>
            <Typography variant="overline" color="text.secondary">{label}</Typography>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {mode === 'edit' ? draft.title : solution.title}
            </Typography>

            {dropped && (
              <Typography data-testid="solution-dropped-note" color="text.secondary" sx={{ mt: 1 }}>
                {s('solution.droppedNote', { note: solution.dropNote ?? '' })}
              </Typography>
            )}
            {props.questions.map((question) => (
              <Box key={question} data-testid={`solution-question-${question}`} sx={{ mt: 1.5, px: 1.5, py: 1, border: 1, borderColor: 'warning.main', borderRadius: 1, fontSize: 13 }}>
                {s(QUESTION_LABEL[question])}
              </Box>
            ))}
            {props.implemented?.observations.some((one) => one.seenOn) && (
              <Box data-testid="solution-seen-again" sx={{ mt: 1.5, px: 1.5, py: 1, border: 1, borderColor: 'error.main', borderRadius: 1, fontSize: 13 }}>
                {s('solution.findingSeenAgain', {
                  names: props.implemented.observations.filter((one) => one.seenOn).map((one) => one.label).join(', '),
                })}
              </Box>
            )}

            <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 1, mt: 2, mb: 0, fontSize: 14, alignItems: 'center' }}>
              <Term>{s('solution.addresses')}</Term>
              <Value testId="solution-addresses">
                {props.addresses.length === 0
                  ? <Muted>{s('observation.noLinks')}</Muted>
                  : (
                    <LinkList
                      onOpen={props.onOpen}
                      links={props.addresses.map((one) => ({
                        key: one.id,
                        label: one.label,
                        note: `${s(STRENGTH_LABEL[one.strength]).toLowerCase()}${one.root ? ` · ${s('observation.rootCause').toLowerCase()}` : ''}`,
                        ...(canEdit ? { onRemove: () => props.onUnaddress(one.id), removeLabel: s('observation.unlink') } : {}),
                      }))}
                    />
                  )}
              </Value>
              <Term>{s('solution.benefitField')}</Term><Value>{sizePicker('benefit', solution.benefit)}</Value>
              <Term>{s('solution.costField')}</Term><Value>{sizePicker('cost', solution.cost)}</Value>
              <Term>{s('solution.validatedWith')}</Term>
              <Value testId="solution-validated-with">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                  {solution.validatedWith.length === 0 && !canEdit && <Muted>—</Muted>}
                  {solution.validatedWith.map((one) => (
                    <Chip key={one} size="small" label={one} {...(canEdit ? { onDelete: () => props.onUpdate({ validatedWith: solution.validatedWith.filter((held) => held !== one) }) } : {})} />
                  ))}
                  {canEdit && (
                    <>
                      <TextField
                        size="small" placeholder={s('solution.validatedField')} value={name}
                        onChange={(event) => setName(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addName() } }}
                        slotProps={{ htmlInput: { 'aria-label': s('solution.validatedWith'), 'data-testid': 'solution-validated-field' } }}
                        sx={{ minWidth: 180 }}
                      />
                      <Button size="small" onClick={addName} data-testid="solution-validated-add">{s('solution.add')}</Button>
                    </>
                  )}
                </Box>
              </Value>
              <Term>{s('solution.attempts')}</Term>
              <Value testId="solution-attempts">
                {solution.attempts.length === 0 && (
                  canEdit
                    ? <FormControlLabel control={<Checkbox size="small" checked={solution.noneKnown === true} onChange={(event) => props.onUpdate({ noneKnown: event.target.checked })} data-testid="solution-none-known" />} label={<Typography sx={{ fontSize: 13 }}>{s('solution.noneKnown')}</Typography>} />
                    : <Muted>{solution.noneKnown ? s('solution.noneKnown') : s('solution.notAnswered')}</Muted>
                )}
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {solution.attempts.map((one, index) => (
                    <li key={index}>
                      {one.when ? <b>{one.when}: </b> : null}{one.what}{one.why ? <> — <i>{one.why}</i></> : null}
                      {canEdit && <Button size="small" sx={{ minWidth: 0, px: 0.5, fontSize: 11 }} onClick={() => props.onUpdate({ attempts: solution.attempts.filter((_, at) => at !== index) })}>{s('solution.remove')}</Button>}
                    </li>
                  ))}
                </Box>
              </Value>
              {canEdit && (
                <>
                  <Term>{null}</Term>
                  <Value>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr auto', gap: 0.5 }}>
                      <TextField size="small" placeholder={s('solution.attemptWhen')} value={attempt.when} onChange={(e) => setAttempt((a) => ({ ...a, when: e.target.value }))} slotProps={{ htmlInput: { 'aria-label': s('solution.attemptWhen') } }} />
                      <TextField size="small" placeholder={s('solution.attemptWhat')} value={attempt.what} onChange={(e) => setAttempt((a) => ({ ...a, what: e.target.value }))} slotProps={{ htmlInput: { 'aria-label': s('solution.attemptWhat'), 'data-testid': 'solution-attempt-what' } }} />
                      <TextField size="small" placeholder={s('solution.attemptWhy')} value={attempt.why} onChange={(e) => setAttempt((a) => ({ ...a, why: e.target.value }))} slotProps={{ htmlInput: { 'aria-label': s('solution.attemptWhy'), 'data-testid': 'solution-attempt-why' } }} />
                      <Button size="small" onClick={addAttempt} data-testid="solution-attempt-add">{s('solution.attemptAdd')}</Button>
                    </Box>
                  </Value>
                </>
              )}
              {(solution.attempts.length > 0 || solution.whyNow) && (
                <>
                  <Term>{s('solution.whyNow')}</Term>
                  <Value>
                    {canEdit
                      ? <AnswerField label={s('solution.whyNowField')} value={solution.whyNow ?? ''} onSave={(whyNow) => props.onUpdate({ whyNow })} disabled={false} testId="solution-why-now" multiline />
                      : solution.whyNow ?? <Muted>{s('solution.notAnswered')}</Muted>}
                  </Value>
                </>
              )}
              <Term>{s('solution.experiments')}</Term>
              <Value testId="solution-experiments">
                {props.experiments.length === 0
                  ? <Muted>{s('solution.none')}</Muted>
                  : <LinkList onOpen={props.onOpen} links={props.experiments.map((one) => ({ key: one.key, label: one.label, note: s(OUTCOME_LABEL[one.outcome]).toLowerCase() }))} />}
                {solution.waived && <Typography sx={{ fontSize: 13, mt: 0.5 }}>{s('solution.waived', { reason: solution.waived })}</Typography>}
              </Value>
              <Term>{s('solution.decision')}</Term>
              <Value testId="solution-decision">
                {props.decision
                  ? <>{props.onOpenDecision ? <Link component="button" type="button" onClick={props.onOpenDecision}>{props.decision.label}</Link> : props.decision.label} <Muted>· {props.decision.status}</Muted></>
                  : <Muted>{s('solution.none')}</Muted>}
              </Value>
              <Term>{s('solution.plan')}</Term>
              <Value testId="solution-plan">
                {props.plan
                  ? <>{props.onOpenPlan ? <Link component="button" type="button" onClick={props.onOpenPlan}>{props.plan.label}</Link> : props.plan.label} <Muted>· {props.plan.status}</Muted></>
                  : solution.state === 'adopted' && canEdit && props.onStartPlan
                    ? <Button size="small" variant="outlined" onClick={props.onStartPlan} data-testid="solution-start-plan">{s('solution.startPlan')}</Button>
                    : <Muted>{s('solution.noPlan')}</Muted>}
              </Value>
              <Term>{s('solution.alternatives')}</Term>
              <Value testId="solution-alternatives">
                {props.alternatives.length === 0
                  ? <Muted>{s('solution.none')}</Muted>
                  : <LinkList onOpen={props.onOpen} links={props.alternatives.map((one) => ({ key: one.key, label: one.label, note: s(PHASE_LABEL[one.phase]).toLowerCase() }))} />}
              </Value>
            </Box>

            {gate && !dropped && (
              <Section title={s('solution.gateTitle', { state: s(PHASE_LABEL[gate.to]).toLowerCase() })} testId="solution-gate">
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, fontSize: 14 }}>
                  {gate.items.map((one) => (
                    <Box component="li" key={one.item} data-testid={`solution-gate-${one.item}`} data-ok={one.ok ? 'true' : 'false'} sx={{ display: 'flex', gap: 1, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                      <Box component="span" aria-hidden sx={{ width: 16, fontWeight: 700, color: one.ok ? 'success.main' : 'text.disabled' }}>{one.ok ? '✓' : '○'}</Box>
                      <Box component="span" sx={{ flex: 1 }}>{s(GATE_LABEL[one.item])}</Box>
                      {!one.ok && canEdit && one.item === 'experimentPlanned' && <Button size="small" onClick={props.onPlanExperiment}>{s('solution.planExperiment')}</Button>}
                      {!one.ok && canEdit && one.item === 'decisionAccepted' && !solution.decision && props.onDecide && (
                        <Button size="small" onClick={props.onDecide} data-testid="solution-decide">{s('solution.proposeDecision')}</Button>
                      )}
                    </Box>
                  ))}
                </Box>
                {canEdit && gate.items.some((one) => one.item === 'experimentConfirmed' && !one.ok) && (
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <TextField size="small" fullWidth label={s('solution.waiveField')} value={waiver} onChange={(event) => setWaiver(event.target.value)} slotProps={{ htmlInput: { 'data-testid': 'solution-waive-field' } }} />
                    <Button size="small" disabled={!waiver.trim()} onClick={() => { props.onWaive(waiver); setWaiver('') }} data-testid="solution-waive">{s('solution.waive')}</Button>
                  </Box>
                )}
                {canEdit && (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1.5 }}>
                    <Button variant="contained" size="small" disabled={open.length > 0} onClick={() => props.onMove(gate.to)} data-testid="solution-move">
                      {s('solution.moveOn', { state: s(PHASE_LABEL[gate.to]).toLowerCase() })}
                    </Button>
                    {open.length > 0 && <Typography variant="caption" color="text.secondary">{s('solution.toGo', { count: open.length })}</Typography>}
                    <Box sx={{ flex: 1 }} />
                    {back && <Button size="small" onClick={() => props.onMove(back)} data-testid="solution-back">{s('solution.moveBack', { state: s(PHASE_LABEL[back]).toLowerCase() })}</Button>}
                  </Box>
                )}
              </Section>
            )}
            {!gate && solution.state === 'adopted' && canEdit && back && (
              <Box sx={{ mt: 2 }}>
                <Button size="small" onClick={() => props.onMove(back)} data-testid="solution-back">{s('solution.moveBack', { state: s(PHASE_LABEL[back]).toLowerCase() })}</Button>
              </Box>
            )}

            {props.implemented && (
              <Section title={s('solution.didItWork')} testId="solution-did-it-work">
                <Typography variant="body2" color="text.secondary">{s('solution.didItWorkHelp')}</Typography>
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mt: 1, fontSize: 14 }}>
                  {props.implemented.observations.map((one) => (
                    <Box component="li" key={one.key} sx={{ display: 'flex', gap: 1, py: 0.25 }}>
                      <Link component="button" type="button" onClick={() => props.onOpen(one.key)} sx={{ flex: 1, textAlign: 'left' }}>{one.label}</Link>
                      <Typography variant="caption" color={one.seenOn ? 'error' : 'text.secondary'}>
                        {one.seenOn ? s('solution.seenSince', { date: one.seenOn }) : s('solution.heldSince', { date: props.implemented!.since })}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Section>
            )}

            <Box sx={{ fontSize: 15, mt: 3 }} data-document>{rendered}</Box>

            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 4 }}>{s('observation.history')}</Typography>
            <Box component="ol" data-testid="solution-history" sx={{ listStyle: 'none', m: 0, p: 0, fontSize: 13 }}>
              {solution.history.map((event, index) => (
                <Box component="li" key={index} sx={{ display: 'flex', gap: 2, py: 0.25, borderBottom: 1, borderColor: 'divider' }}>
                  <Box component="span" sx={{ fontFamily: MONO, color: 'text.secondary', whiteSpace: 'nowrap' }}>{event.date}</Box>
                  <Box component="span">
                    {event.kind === 'moved' && event.to
                      ? s('solution.eventMoved', { state: s(PHASE_LABEL[event.to as SolutionState] ?? 'solution.phaseIdea').toLowerCase() })
                      : event.kind === 'linked'
                        ? s('solution.eventLinked', { name: props.nameOf(event.id ?? '') })
                        : s(EVENT_KEY[event.kind])}
                    {event.note ? ` — ${event.note}` : ''}
                  </Box>
                </Box>
              ))}
            </Box>
          </DocumentSheet>
        )}
      </Box>
    </Box>
  )
}

const EVENT_KEY = {
  proposed: 'solution.eventProposed',
  moved: 'solution.eventMoved',
  waived: 'solution.eventWaived',
  linked: 'solution.eventLinked',
  dropped: 'solution.eventDropped',
  restored: 'solution.eventRestored',
} as const

// --- one experiment ----------------------------------------------------------------------

export type ExperimentReaderProps = {
  experiment: Experiment
  /** The solutions it tests, resolved by the page. */
  tests: readonly { key: string; label: string }[]
  readOnly: boolean
  s: Translate
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  onUpdate: (patch: ExperimentPatch) => void
  onConclude: (outcome: ExperimentOutcome) => void
  onDelete: () => void
  onOpen: (key: string) => void
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
}

export function ExperimentReader(props: ExperimentReaderProps) {
  const { experiment, s, renderMarkdown, readOnly } = props
  const canEdit = !readOnly
  const stored = useMemo(() => ({
    title: experiment.title, body: experiment.body, hypothesis: experiment.hypothesis, measure: experiment.measure ?? '',
    where: experiment.where ?? '', by: experiment.by ?? '', from: experiment.from ?? '', to: experiment.to ?? '',
    result: experiment.result ?? '',
  }), [experiment])
  const { mode, draft, setDraft, commit, switchMode } = useDraft(stored, (patch) => props.onUpdate(patch), canEdit)
  const [previewShown, setPreviewShown] = useState(true)
  const showPreview = mode === 'read' || previewShown
  const text = mode === 'edit' ? draft.body : experiment.body
  const rendered = text.trim() ? renderMarkdown(text) : <Typography color="text.secondary">{s('common.empty')}</Typography>
  type Field = 'hypothesis' | 'measure' | 'where' | 'by' | 'from' | 'to' | 'result'
  const field = (key: Field, label: string, extra: { type?: string; wide?: boolean } = {}) => (
    <TextField
      size="small" label={label} value={draft[key]} type={extra.type}
      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} onBlur={commit}
      multiline={extra.wide} sx={extra.wide ? { gridColumn: '1 / -1' } : undefined}
      slotProps={extra.type === 'date' ? { inputLabel: { shrink: true } } : undefined}
    />
  )
  const shown = (value: string | undefined) => (value ? value : <Muted>—</Muted>)

  return (
    <Box data-testid="experiment-reader" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexWrap: 'wrap' }}>
        <Chip size="small" color={OUTCOME_COLOR[experiment.outcome]} label={s(OUTCOME_LABEL[experiment.outcome])} data-testid="experiment-outcome" />
        <Box sx={{ flex: 1 }} />
        {canEdit && (
          <>
            <ToggleButtonGroup
              exclusive size="small" value={experiment.outcome}
              onChange={(_e, next: ExperimentOutcome | null) => { if (next) props.onConclude(next) }}
              aria-label={s('solution.outcome')}
            >
              {EXPERIMENT_OUTCOMES.map((one) => <ToggleButton key={one} value={one} sx={{ py: 0.25, fontSize: 11 }} data-testid={`experiment-outcome-${one}`}>{s(OUTCOME_LABEL[one])}</ToggleButton>)}
            </ToggleButtonGroup>
            <Button size="small" color="error" onClick={props.onDelete}>{s('observation.delete')}</Button>
          </>
        )}
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_e, value: Mode | null) => switchMode(value)}>
          <ToggleButton value="read">{s('observation.read')}</ToggleButton>
          {canEdit && <ToggleButton value="edit">{s('observation.edit')}</ToggleButton>}
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: mode === 'edit' && showPreview ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
        {mode === 'edit' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr' }}>
              <TextField size="small" label={s('solution.titleField')} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} onBlur={commit} sx={{ gridColumn: '1 / -1' }} />
              {field('hypothesis', s('solution.hypothesis'), { wide: true })}
              {field('measure', s('solution.measure'), { wide: true })}
              {field('where', s('solution.whereField'))}
              {field('by', s('solution.byField'))}
              {field('from', s('solution.fromField'), { type: 'date' })}
              {field('to', s('solution.toField'), { type: 'date' })}
              {field('result', s('solution.result'), { wide: true })}
            </Box>
            <DocumentSource
              value={draft.body}
              onChange={(body) => setDraft((d) => ({ ...d, body }))}
              onBlur={commit}
              label={s('solution.experimentSource')}
              onAddImage={props.onAddImage}
              images={props.images}
              preview={{ shown: previewShown, onToggle: () => setPreviewShown((on) => !on) }}
            />
          </Box>
        )}
        {showPreview && (
          <DocumentSheet dense={mode === 'edit'}>
            <Typography variant="overline" color="text.secondary">{formatExperimentNumber(experiment.number)}</Typography>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {mode === 'edit' ? draft.title : experiment.title}
            </Typography>
            <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 0.5, mt: 2, mb: 0, fontSize: 14 }}>
              <Term>{s('solution.tests')}</Term>
              <Value testId="experiment-tests">
                {props.tests.length === 0 ? <Muted>{s('solution.none')}</Muted> : <LinkList onOpen={props.onOpen} links={props.tests} />}
              </Value>
              <Term>{s('solution.hypothesis')}</Term><Value testId="experiment-hypothesis">{shown(experiment.hypothesis)}</Value>
              <Term>{s('solution.measure')}</Term><Value>{shown(experiment.measure)}</Value>
              <Term>{s('solution.whereField')}</Term><Value>{shown(experiment.where)}</Value>
              <Term>{s('solution.byField')}</Term><Value>{shown(experiment.by)}</Value>
              <Term>{s('solution.fromField')}</Term><Value>{shown(experiment.from)}</Value>
              <Term>{s('solution.toField')}</Term><Value>{shown(experiment.to)}</Value>
              <Term>{s('solution.result')}</Term><Value testId="experiment-result">{shown(experiment.result)}</Value>
            </Box>
            {experiment.outcome === 'refuted' && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{s('solution.refutedNote')}</Typography>}
            <Box sx={{ fontSize: 15, mt: 3 }} data-document>{rendered}</Box>
          </DocumentSheet>
        )}
      </Box>
    </Box>
  )
}
