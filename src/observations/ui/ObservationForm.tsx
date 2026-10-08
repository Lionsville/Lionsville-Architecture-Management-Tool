// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The form that records an observation (ADR-0032 §6): one dialog, two
 * columns over a table.
 *
 * On the left the facts — title, where, observed by and when seen, all four
 * required, and the impact — each with an example under it that a refusal
 * replaces with what is missing. On the right the three questions a sighting
 * answers, a field each — what was seen, the evidence, and who or what it
 * affected, the last required — which make the body under the template's
 * headings, with Edit and Preview over the whole. Under the
 * title two hints that never block: *Seen before?*, the observations of the
 * chosen scope whose titles share words with this one, each with *Seen
 * again* — a sighting on that one, and nothing new recorded — and a wording
 * hint when the title reads as a cause, a fix or blame.
 *
 * Below, the causes: new ones written in place, and existing ones picked from
 * the chosen scope. Nothing is made until the form is recorded, and then the
 * observation, the new causes and the links are one step, which the button
 * says. A scope below may be chosen where the page offers one, and the causes
 * of the scope before are taken off the list, since a cause is linked in its
 * own scope.
 *
 * The form says what it wants and the page performs it: the page owns the
 * lists, the numbering and where the step lands.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import { AddIcon, EyeIcon, LinkIcon } from '../../widgets/icons'
import {
  causeLabel, formatObservationNumber, liveObservations, OBSERVATION_IMPACTS,
} from '../observation'
import type { Cause, CauseStrength, Observation } from '../observation'
import { newObservationProblems, observationBody } from '../form'
import type { CauseChoice, CauseDraft, ObservationFields, ObservationSections, RequiredField } from '../form'
import { hintWords, similarTitles, wordingHint } from '../wording'
import { IMPACT_LABEL } from '../observationScope'
import { CauseDraftFields, CausePicker, ExampleField, LinkRowsTable, LookAlikes, SectionsField, SubPanel } from './FormParts'
import type { LinkRow } from './FormParts'

/** A scope an observation may be recorded in, and what the form reads of it. */
export type FormScope = {
  /** Its path; absent for the scope the page is on. */
  scope?: string
  /** What the select calls it. */
  label: string
  observations: readonly Observation[]
  causes: readonly Cause[]
}

export type RecordRequest = { scope?: string; fields: ObservationFields; causes: CauseChoice[] }

export type NewObservationDialogProps = {
  open: boolean
  /** The scopes it may be made in, this one first; a select is drawn where there is more than one. */
  scopes: readonly FormScope[]
  /** `yyyy-mm-dd`. */
  today: string
  onCancel: () => void
  onRecord: (request: RecordRequest) => void
  /** A sighting on an observation already written down, in place of a new one. */
  onSeenAgain: (scope: string | undefined, id: string) => void
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  s: Translate
}

const EXAMPLE = {
  title: 'observation.formTitleExample', where: 'observation.formWhereExample', by: 'observation.formByExample', date: 'observation.formDateExample',
} as const
const MISSING = {
  title: 'observation.formTitleMissing', where: 'observation.formWhereMissing', by: 'observation.formByMissing', date: 'observation.formDateMissing',
} as const

/** What stands in a field's place when it is refused, or nothing. */
export function problemText(field: RequiredField, problem: 'missing' | 'future' | undefined, s: Translate): string | undefined {
  if (!problem) return undefined
  return problem === 'future' ? s('observation.formDateFuture') : s(MISSING[field])
}

/** The example under a required field. */
export function exampleFor(field: RequiredField, s: Translate): string {
  return s(EXAMPLE[field])
}

const blankDraft = (): CauseDraft => ({ title: '', why: '', root: false, strength: 'normal' })

type Row = CauseChoice & { key: string }

/** A field the form refuses: the four facts, and who or what it affected. */
type Refused = RequiredField | 'affected'

const SECTIONS = [
  { key: 'saw', label: 'observation.tplSaw', example: 'observation.formSawExample' },
  { key: 'evidence', label: 'observation.tplEvidence', example: 'observation.formEvidenceExample' },
  { key: 'affected', label: 'observation.tplAffected', example: 'observation.formAffectedExample' },
] as const

const blankSections = (): ObservationSections => ({ saw: '', evidence: '', affected: '' })

/** What the Record button says it will make: *Record observation with 1 new cause and 1 link*. */
export function recordLabel(rows: readonly CauseChoice[], s: Translate): string {
  const made = rows.filter((one) => one.kind === 'new').length
  const linked = rows.length - made
  const parts = [
    ...(made ? [made === 1 ? s('observation.formNewCausesOne') : s('observation.formNewCausesMany', { count: made })] : []),
    ...(linked ? [linked === 1 ? s('observation.formLinksOne') : s('observation.formLinksMany', { count: linked })] : []),
  ]
  if (!parts.length) return s('observation.formRecord')
  const what = parts.length === 2 ? s('observation.formAnd', { first: parts[0], second: parts[1] }) : parts[0]
  return s('observation.formRecordWith', { what })
}

export function NewObservationDialog(props: NewObservationDialogProps) {
  const { open, scopes, today, s } = props
  const [scopeIndex, setScopeIndex] = useState(0)
  const [fields, setFields] = useState<ObservationFields>(() => freshFields(today))
  const [sections, setSections] = useState<ObservationSections>(blankSections)
  const [shown, setShown] = useState<Partial<Record<Refused, 'missing' | 'future'>>>({})
  const [rows, setRows] = useState<Row[]>([])
  const [dropped, setDropped] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!open) return
    setScopeIndex(0); setFields(freshFields(today)); setSections(blankSections()); setShown({}); setRows([]); setDropped(false)
  }, [open, today, s])

  const scope = scopes[scopeIndex] ?? scopes[0]
  const alike = useMemo(
    () => (fields.title.trim().length >= 6 && scope ? similarTitles(fields.title, liveObservations(scope.observations)) : []),
    [fields.title, scope],
  )
  const hint = wordingHint(fields.title, hintWords(s('observation.formHintWords')))
  const forget = (key: string) => {
    if (key in shown) setShown((held) => { const next = { ...held }; delete next[key as Refused]; return next })
  }
  const set = (key: keyof ObservationFields, value: string) => {
    setFields((held) => ({ ...held, [key]: value }))
    forget(key)
  }
  const setSection = (key: keyof ObservationSections, value: string) => {
    setSections((held) => ({ ...held, [key]: value }))
    forget(key)
  }
  const body = observationBody(sections, s)
  const changeScope = (index: number) => {
    const before = rows.length
    const kept = rows.filter((one) => one.kind === 'new')
    setScopeIndex(index)
    setRows(kept)
    setDropped(kept.length < before)
  }
  const problems = newObservationProblems({ ...fields, affected: sections.affected }, today)
  const record = () => {
    if (Object.keys(problems).length) { setShown(problems); return }
    props.onRecord({
      ...(scope?.scope !== undefined ? { scope: scope.scope } : {}),
      fields: { ...fields, title: fields.title.trim(), where: fields.where.trim(), by: fields.by.trim(), body },
      causes: rows.map(({ key: _key, ...choice }) => { void _key; return choice }),
    })
  }
  const shownCount = Object.keys(shown).length

  return (
    <Dialog
      open={open} onClose={props.onCancel} maxWidth="lg" fullWidth aria-labelledby="new-observation-title"
      // The page is a dialog too, and its focus trap takes back a focus the
      // title claims while this one is still opening: the title is focused
      // again once it has.
      slotProps={{ transition: { onEntered: () => titleRef.current?.focus() } }}
    >
      <DialogTitle id="new-observation-title">{s('observation.new')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 13, mb: 2 }}>{s('observation.formIntro')}</DialogContentText>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 3, pt: 0.5 }}>
          <Box sx={{ display: 'grid', gap: 2, alignContent: 'start' }}>
            {scopes.length > 1 && (
              <ExampleField
                select label={s('observation.formScope')} value={String(scopeIndex)} onChange={(value) => changeScope(Number(value))}
                example={s('observation.formScopeHelp')} testId="form-scope"
              >
                {scopes.map((one, index) => <MenuItem key={one.scope ?? ''} value={String(index)}>{one.label}</MenuItem>)}
              </ExampleField>
            )}
            <ExampleField
              required autoFocus inputRef={titleRef} label={s('observation.titleField')} value={fields.title} onChange={(value) => set('title', value)}
              example={exampleFor('title', s)} problem={problemText('title', shown.title, s)} testId="form-title"
            />
            <LookAlikes
              testId="form-seen-before"
              title={s('observation.formSeenBefore')}
              action={{ label: s('observation.seenAgain'), icon: <EyeIcon size={14} /> }}
              rows={alike.map((one) => ({
                id: one.id, label: `${formatObservationNumber(one.number)} ${one.title}`, note: s('observation.seenTimes', { count: one.seen }),
                tip: s('observation.formSeenAgainTip', { name: formatObservationNumber(one.number) }),
                onUse: () => props.onSeenAgain(scope?.scope, one.id),
              }))}
            />
            {hint && (
              <Alert severity="warning" variant="outlined" data-testid="form-wording-hint" sx={{ py: 0, fontSize: 13 }}>
                {s('observation.formWordingHint', { word: hint })}
              </Alert>
            )}
            <ExampleField
              required label={s('observation.newWhereField')} value={fields.where} onChange={(value) => set('where', value)}
              example={exampleFor('where', s)} problem={problemText('where', shown.where, s)} testId="form-where"
            />
            <ExampleField
              required label={s('observation.newByField')} value={fields.by} onChange={(value) => set('by', value)}
              example={exampleFor('by', s)} problem={problemText('by', shown.by, s)} testId="form-by"
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 1.5 }}>
              <ExampleField
                required type="date" max={today} label={s('observation.formDateField')} value={fields.date} onChange={(value) => set('date', value)}
                example={exampleFor('date', s)} problem={problemText('date', shown.date, s)} testId="form-date"
              />
              <ExampleField
                select label={s('observation.newImpactField')} value={fields.impact} onChange={(value) => set('impact', value)}
                example={s('observation.formImpactExample')}
              >
                {OBSERVATION_IMPACTS.map((one) => <MenuItem key={one} value={one}>{s(IMPACT_LABEL[one])}</MenuItem>)}
              </ExampleField>
            </Box>
          </Box>
          <SectionsField
            label={s('observation.formDescription')} body={body} renderMarkdown={props.renderMarkdown} s={s}
            sections={SECTIONS.map((one) => ({
              key: one.key, label: s(one.label), value: sections[one.key], onChange: (value: string) => setSection(one.key, value),
              example: s(one.example),
              ...(one.key === 'affected'
                ? { required: true, ...(shown.affected ? { problem: s('observation.formAffectedMissing') } : {}) }
                : {}),
            }))}
          />
        </Box>

        {scope && (
          <CausesSection
            key={scopeIndex} scope={scope} rows={rows} onRows={setRows} s={s}
            dropped={dropped} onDismissDropped={() => setDropped(false)}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Typography role="alert" color="error" sx={{ fontSize: 13, flex: 1 }} data-testid="form-problems">
          {shownCount === 0 ? '' : shownCount === 1 ? s('observation.formProblemsOne') : s('observation.formProblemsMany', { count: shownCount })}
        </Typography>
        <Button onClick={props.onCancel} sx={{ textTransform: 'none' }}>{s('common.cancel')}</Button>
        <Button variant="contained" onClick={record} sx={{ textTransform: 'none' }} data-testid="form-record" data-guide="observationForm.record">
          {recordLabel(rows, s)}
        </Button>
      </DialogActions>
    </Dialog>
  )
}


/**
 * The causes under the form: rows new and existing, a new one written in
 * place with an *already written down?* list under its title, and a picker
 * over the chosen scope's causes. Keyed on the scope, so a scope chosen
 * again starts with nothing half-written.
 */
function CausesSection({ scope, rows, onRows, dropped, onDismissDropped, s }: {
  scope: FormScope
  rows: readonly Row[]
  onRows: (update: (rows: Row[]) => Row[]) => void
  dropped: boolean
  onDismissDropped: () => void
  s: Translate
}) {
  const [sub, setSub] = useState<'new' | 'existing' | undefined>(undefined)
  const [draft, setDraft] = useState<CauseDraft>(blankDraft)
  const [draftProblem, setDraftProblem] = useState(false)
  const [serial, setSerial] = useState(0)
  const causeOf = (id: string) => scope.causes.find((one) => one.id === id)
  const addDraft = () => {
    if (!draft.title.trim()) { setDraftProblem(true); return }
    const made: Row = { kind: 'new', draft: { ...draft, title: draft.title.trim(), why: draft.why.trim() }, key: `new-${serial}` }
    onRows((held) => [...held, made])
    setSerial((n) => n + 1)
    setDraft(blankDraft()); setDraftProblem(false); setSub(undefined)
  }
  const addExisting = (causeId: string) => {
    onRows((held) => (held.some((one) => one.kind === 'existing' && one.causeId === causeId)
      ? held : [...held, { kind: 'existing', causeId, strength: 'normal', key: `link-${causeId}` }]))
    if (sub === 'new') { setDraft(blankDraft()); setSub(undefined) }
  }
  const setStrength = (key: string, strength: CauseStrength) => onRows((held) => held.map((one) => (
    one.key !== key ? one : one.kind === 'new' ? { ...one, draft: { ...one.draft, strength } } : { ...one, strength }
  )))
  const tableRows: LinkRow[] = rows.map((one) => {
    if (one.kind === 'new') return { key: one.key, label: one.draft.title, kind: 'new', root: one.draft.root, strength: one.draft.strength }
    const held = causeOf(one.causeId)
    return { key: one.key, label: held ? `${causeLabel(held)} ${held.title}` : one.causeId, kind: 'existing', root: held?.root === true, strength: one.strength }
  })
  const draftAlike = draft.title.trim().length >= 6 ? similarTitles(draft.title, scope.causes) : []
  return (
    <Box component="section" aria-labelledby="new-observation-causes" sx={{ borderTop: 1, borderColor: 'divider', mt: 2.5, pt: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <Typography id="new-observation-causes" component="h3" sx={{ fontSize: 15, fontWeight: 600 }}>{s('observation.formCauses')}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{s('observation.formCausesNote')}</Typography>
            <Tooltip title={s('observation.formNewCauseTip')} describeChild>
              <Button size="small" variant="outlined" startIcon={<AddIcon size={14} />} onClick={() => { setSub('new'); setDraftProblem(false) }} sx={{ textTransform: 'none' }} data-testid="form-new-cause" data-guide="observations.newCause">
                {s('observation.newCause')}
              </Button>
            </Tooltip>
            <Tooltip title={s('observation.formExistingCauseTip')} describeChild>
              <Button size="small" variant="outlined" startIcon={<LinkIcon size={14} />} onClick={() => setSub('existing')} sx={{ textTransform: 'none' }} data-testid="form-existing-cause" data-guide="observationForm.existingCause">
                {s('observation.formExistingCause')}
              </Button>
            </Tooltip>
          </Box>
          {dropped && (
            <Alert severity="info" variant="outlined" onClose={onDismissDropped} data-testid="form-scope-dropped" sx={{ mb: 1, fontSize: 13 }}>
              {s('observation.formScopeDropped')}
            </Alert>
          )}
          <LinkRowsTable
            rows={tableRows} onStrength={setStrength} onRemove={(key) => onRows((held) => held.filter((one) => one.key !== key))}
            empty={s('observation.formNoCauses')} s={s} testId="form-causes" guide="observationForm.causes"
          />
          {sub === 'new' && (
            <SubPanel heading={s('observation.newCause')} onClose={() => setSub(undefined)} closeLabel={s('common.close')} testId="form-cause-draft">
              <CauseDraftFields
                autoFocus draft={draft} onChange={(next) => { setDraft(next); if (next.title.trim()) setDraftProblem(false) }}
                problem={draftProblem ? s('observation.causeTitleMissing') : undefined} s={s}
                alike={(
                  <LookAlikes
                    testId="form-cause-alike" title={s('observation.causeAlike')}
                    action={{ label: s('observation.causeUse'), icon: <LinkIcon size={14} /> }}
                    rows={draftAlike.map((one) => ({
                      id: one.id, label: `${causeLabel(one)} ${one.title}`, tip: s('observation.formExistingCauseTip'), onUse: () => addExisting(one.id),
                    }))}
                  />
                )}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
                <Button size="small" onClick={() => setSub(undefined)} sx={{ textTransform: 'none' }}>{s('common.cancel')}</Button>
                <Button size="small" variant="contained" onClick={addDraft} sx={{ textTransform: 'none' }} data-testid="form-cause-add">{s('observation.causeAddToList')}</Button>
              </Box>
            </SubPanel>
          )}
          {sub === 'existing' && (
            <CausePicker
              heading={s('observation.existingIn', { scope: scope.label })}
              candidates={scope.causes.map((one) => ({ id: one.id, label: `${causeLabel(one)} ${one.title}`, root: one.root === true }))}
              taken={new Set(rows.flatMap((one) => (one.kind === 'existing' ? [one.causeId] : [])))}
              onPick={addExisting} onClose={() => setSub(undefined)} s={s}
            />
          )}
        </Box>
  )
}

function freshFields(today: string): ObservationFields {
  return { title: '', where: '', by: '', date: today, impact: 'minor', body: '' }
}
