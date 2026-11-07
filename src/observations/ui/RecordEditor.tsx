// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A record edited with nothing else on screen (the owner's comment on the designs,
 * 7 November 2026): the kit's full window, Write and Preview in its bar, and one
 * save that is one step for Undo. Cancel asks first where anything changed.
 *
 * The three parts of an observation's description are written apart, each with its
 * own hint, and saved in the same text as ever, so nothing needs converting; a
 * record with other headings or none gets one Description field. Everything a
 * reader edited in its pane is here, with the same refusals: the four facts of an
 * observation are never blanked, a title never, and the day is never after today.
 */
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import { MarkdownEditor } from '../../documentation/ui/MarkdownEditor'
import type { DocumentImages } from '../../documentation/ui/MarkdownEditor'
import { usePersonNames } from '../../people/ui/names'
import { PersonRefField } from '../../people/ui/PersonRefField'
import { isBlankRef } from '../../model/person'
import type { PersonRef } from '../../model/person'
import { SelectField, TextField } from '../../widgets/kit/Field'
import { FocusedWindow } from '../../widgets/kit/FocusedWindow'
import type { FocusedWindowChrome } from '../../widgets/kit/FocusedWindow'
import { Segmented } from '../../widgets/kit/Segmented'
import { observationBody, observationProblems, observationSections } from '../form'
import type { ObservationSections } from '../form'
import {
  causeLabel, causeTemplate, formatObservationNumber, OBSERVATION_IMPACTS, OBSERVATION_TONES, toneOf,
} from '../observation'
import type { Cause, Observation, ObservationImpact, ObservationPatch, ObservationTone } from '../observation'
import { IMPACT_LABEL, SIZE_LABEL, TONE_WORD } from '../observationScope'
import { experimentTemplate, formatExperimentNumber, formatSolutionNumber, SOLUTION_SIZES, solutionTemplate } from '../solution'
import type { Experiment, Solution, SolutionSize } from '../solution'
import { exampleFor, problemText } from './ObservationForm'

export type RecordEditing =
  | { kind: 'observation'; record: Observation; onSave: (patch: ObservationPatch) => void }
  | { kind: 'cause'; record: Cause; onSave: (patch: Partial<Pick<Cause, 'title' | 'body'>>) => void }
  | { kind: 'solution'; record: Solution; onSave: (patch: Partial<Pick<Solution, 'title' | 'body' | 'benefit' | 'cost' | 'whyNow'>>) => void }
  | { kind: 'experiment'; record: Experiment; onSave: (patch: Partial<Pick<Experiment, 'title' | 'body' | 'hypothesis' | 'measure' | 'where' | 'by' | 'from' | 'to' | 'result'>>) => void }

export type RecordEditorProps = {
  /** Closed while undefined. */
  editing: RecordEditing | undefined
  onClose: () => void
  today: string
  windowChrome: FocusedWindowChrome
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  onAddImage?: ((file: File) => Promise<string | undefined>) | undefined
  images?: DocumentImages | undefined
  s: Translate
}

type View = 'write' | 'preview'

/** Every field of a record while it is written, as text. */
type Draft = Record<string, string> & { title: string; body: string }
const BY_FIELD = 'by'

const SECTIONS = [
  { key: 'saw', label: 'observation.tplSaw', hint: 'observation.editSawHint' },
  { key: 'evidence', label: 'observation.tplEvidence', hint: 'observation.editEvidenceHint' },
  { key: 'affected', label: 'observation.tplAffected', hint: 'observation.editAffectedHint' },
] as const

function draftOf(editing: RecordEditing): Draft {
  const { record } = editing
  const base = { title: record.title, body: record.body }
  switch (editing.kind) {
    case 'observation': return { ...base, where: editing.record.where ?? '', date: editing.record.date, impact: editing.record.impact, tone: toneOf(editing.record) }
    case 'cause': return base
    case 'solution': return { ...base, benefit: editing.record.benefit ?? '', cost: editing.record.cost ?? '', whyNow: editing.record.whyNow ?? '' }
    case 'experiment': return {
      ...base, hypothesis: editing.record.hypothesis, measure: editing.record.measure ?? '', where: editing.record.where ?? '',
      from: editing.record.from ?? '', to: editing.record.to ?? '', result: editing.record.result ?? '',
    }
  }
}

const numberOf = (editing: RecordEditing): string => {
  switch (editing.kind) {
    case 'observation': return formatObservationNumber(editing.record.number)
    case 'cause': return causeLabel(editing.record)
    case 'solution': return formatSolutionNumber(editing.record.number)
    case 'experiment': return formatExperimentNumber(editing.record.number)
  }
}

const TITLE = {
  observation: 'observation.editingObservation', cause: 'observation.editingCause', solution: 'solution.editingSolution', experiment: 'solution.editingExperiment',
} as const

export function RecordEditor(props: RecordEditorProps) {
  const { editing, s } = props
  if (!editing) return null
  return <OpenEditor key={`${editing.kind}:${editing.record.id}`} {...props} editing={editing} s={s} />
}

function OpenEditor({ editing, onClose, today, windowChrome, renderMarkdown, onAddImage, images, s }: RecordEditorProps & { editing: RecordEditing }) {
  const [view, setView] = useState<View>('write')
  const [draft, setDraft] = useState<Draft>(() => draftOf(editing))
  const [by, setBy] = useState<PersonRef | undefined>(() => (editing.kind === 'observation' || editing.kind === 'experiment' ? editing.record.by : undefined))
  // Three parts where that is what the text holds; one field otherwise, so a record is never rewritten by being opened.
  const [sections, setSections] = useState<ObservationSections | undefined>(() => (editing.kind === 'observation' ? observationSections(editing.record.body, s) : undefined))
  const names = usePersonNames()
  const set = (field: string, value: string) => setDraft((held) => ({ ...held, [field]: value }))
  const body = sections ? observationBody(sections, s) : draft.body
  // Opened on the template's text, with nothing typed, is unchanged.
  const startBody = useMemo(() => (sections ? observationBody(observationSections(editing.record.body, s) as ObservationSections, s) : editing.record.body), [editing.record.body, s])
  const start = useMemo(() => draftOf(editing), [editing])

  const problems = editing.kind === 'observation'
    ? observationProblems({ title: draft.title, where: draft.where, by: by ?? '', date: draft.date }, today)
    : {}
  const titleMissing = !draft.title.trim()
  const refusals = Object.keys(problems).length + (editing.kind !== 'observation' && titleMissing ? 1 : 0)
  const changedFields = Object.keys(draft).filter((key) => key !== 'body' && draft[key] !== start[key])
  const byChanged = (editing.kind === 'observation' || editing.kind === 'experiment') && JSON.stringify(by ?? '') !== JSON.stringify(editing.record.by ?? '')
  const changed = changedFields.length > 0 || body !== startBody || byChanged

  const save = () => {
    if (changed) {
      const patch: Record<string, unknown> = {}
      for (const key of changedFields) patch[key] = draft[key] === '' && (key === 'benefit' || key === 'cost') ? undefined : draft[key]
      if (body !== startBody) patch.body = body
      if (byChanged) patch[BY_FIELD] = isBlankRef(by) ? '' : by
      ;(editing.onSave as (patch: Record<string, unknown>) => void)(patch)
    }
    onClose()
  }
  const refused = refusals === 0 ? undefined : refusals === 1 ? s('observation.formProblemsOne') : s('observation.formProblemsMany', { count: refusals })
  // Said at the field as soon as it is so, as well as by the save button, which a press then does nothing on.
  const shown = (key: 'title' | 'where' | 'by' | 'date') => problemText(key, problems[key], s)

  const mdField = (label: string, value: string, onChange: (next: string) => void, more: { hint?: string; template?: { label: string; text: string }; rows?: number; autoFocus?: boolean } = {}) => (
    <MarkdownEditor
      label={label} value={value} onChange={onChange} minRows={more.rows ?? 4} maxRows={24}
      {...(more.hint ? { helper: more.hint } : {})} {...(more.template ? { template: more.template } : {})}
      {...(onAddImage ? { onAddImage } : {})} {...(images ? { images } : {})}
    />
  )
  const description = (template?: string) => mdField(s('observation.formDescription'), draft.body, (next) => set('body', next), { rows: 12, ...(template ? { template: { label: s('md.fromTemplate'), text: template } } : {}) })

  const titleField = (hint: string, missing: string) => (
    <TextField
      label={s('observation.titleField')} rows={2} required value={draft.title} onChange={(value) => set('title', value)} hint={hint}
      {...(titleMissing ? { error: missing } : {})} data-testid="editor-title" autoFocus
    />
  )

  const main = (() => {
    switch (editing.kind) {
      case 'observation': return (
        <>
          <TextField
            label={s('observation.titleField')} rows={2} required value={draft.title} onChange={(value) => set('title', value)}
            hint={s('observation.editTitleHint')} {...(shown('title') ? { error: shown('title') as string } : {})} data-testid="editor-title" autoFocus
          />
          {sections
            ? SECTIONS.map((one) => (
              <div key={one.key}>{mdField(s(one.label), sections[one.key], (next) => setSections({ ...sections, [one.key]: next }), { hint: s(one.hint) })}</div>
            ))
            : description()}
        </>
      )
      case 'cause': return <>{titleField(s('observation.causeTitleExample'), s('observation.causeTitleMissing'))}{description(causeTemplate(s))}</>
      case 'solution': return <>{titleField(s('solution.newTitleHelp'), s('solution.formTitleMissing'))}{description(solutionTemplate(s))}</>
      case 'experiment': return (
        <>
          {titleField(s('solution.experimentTitleExample'), s('solution.experimentTitleMissing'))}
          <TextField label={s('solution.hypothesis')} rows={2} value={draft.hypothesis} onChange={(value) => set('hypothesis', value)} />
          <TextField label={s('solution.measure')} rows={2} value={draft.measure} onChange={(value) => set('measure', value)} />
          <TextField label={s('solution.result')} rows={2} value={draft.result} onChange={(value) => set('result', value)} />
          {description(experimentTemplate(s))}
        </>
      )
    }
  })()

  const personField = (label: string, testId: string, error?: string, hint?: string) => (
    <PersonRefField
      label={label} value={by ?? ''} names={names} onChange={(next) => setBy(next)} testId={testId} s={s}
      {...(error ? { error: true, helperText: error } : hint ? { helperText: hint } : {})} {...(editing.kind === 'observation' ? { required: true } : {})}
    />
  )

  const sizes = [{ value: '', label: s('solution.unset') }, ...SOLUTION_SIZES.map((size: SolutionSize) => ({ value: size, label: s(SIZE_LABEL[size]) }))]
  const aside = (() => {
    switch (editing.kind) {
      case 'observation': return (
        <>
          <SelectField
            label={s('observation.toneField')} value={draft.tone}
            options={OBSERVATION_TONES.map((one: ObservationTone) => ({ value: one, label: s(TONE_WORD[one]) }))}
            onChange={(value) => set('tone', value)} data-guide="observationForm.tone"
          />
          <SelectField
            label={s('observation.impactField')} value={draft.impact}
            options={OBSERVATION_IMPACTS.map((one: ObservationImpact) => ({ value: one, label: s(IMPACT_LABEL[one]) }))}
            onChange={(value) => set('impact', value)}
          />
          <TextField
            label={s('observation.dateField')} type="date" max={today} required value={draft.date} onChange={(value) => set('date', value)}
            {...(shown('date') ? { error: shown('date') as string } : {})} data-testid="editor-date"
          />
          <TextField
            label={s('observation.whereField')} rows={2} required value={draft.where} onChange={(value) => set('where', value)}
            hint={exampleFor('where', s)} {...(shown('where') ? { error: shown('where') as string } : {})} data-testid="editor-where"
          />
          {personField(s('observation.byField'), 'observation-by-field', shown('by'), exampleFor('by', s))}
        </>
      )
      case 'solution': return (
        <>
          <SelectField label={s('solution.benefitField')} value={draft.benefit} options={sizes} onChange={(value) => set('benefit', value)} />
          <SelectField label={s('solution.costField')} value={draft.cost} options={sizes} onChange={(value) => set('cost', value)} />
          <TextField label={s('solution.whyNowField')} rows={3} value={draft.whyNow} onChange={(value) => set('whyNow', value)} />
        </>
      )
      case 'experiment': return (
        <>
          <TextField label={s('solution.whereField')} value={draft.where} onChange={(value) => set('where', value)} />
          {personField(s('solution.byField'), 'experiment-by-field')}
          <TextField label={s('solution.fromField')} type="date" value={draft.from} onChange={(value) => set('from', value)} />
          <TextField label={s('solution.toField')} type="date" value={draft.to} onChange={(value) => set('to', value)} />
        </>
      )
      case 'cause': return undefined
    }
  })()

  return (
    <FocusedWindow
      open
      title={s(TITLE[editing.kind])}
      number={numberOf(editing)}
      windowChrome={windowChrome}
      middle={(
        <Segmented
          label={s('observation.editView')} value={view} onChange={setView}
          options={[{ value: 'write', label: s('observation.editWrite') }, { value: 'preview', label: s('observation.editPreview') }]}
        />
      )}
      {...(aside && view === 'write' ? { aside } : {})}
      changed={changed}
      saveLabel={s('observation.editSave')}
      onSave={save}
      {...(refused ? { saveRefused: refused } : {})}
      onCancel={onClose}
    >
      {view === 'write'
        ? <div className="chain-editor">{main}</div>
        : (
          <div className="chain-editor" data-testid="editor-preview">
            <h2 className="chain-editor__title">{draft.title}</h2>
            <div className="chain-body" data-document>{renderMarkdown(body)}</div>
          </div>
        )}
    </FocusedWindow>
  )
}
