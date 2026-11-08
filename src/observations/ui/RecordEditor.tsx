// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A record edited with nothing else on screen (the owner's comment on the designs,
 * 7 November 2026): the kit's full window, and one save that is one step for Undo.
 * Cancel asks first where anything changed.
 *
 * It is written as the document it will be read as. The title and the parts of its
 * text stand in one flow, each as tall as what it holds, under one bar of the one
 * editor (`MarkdownFlow`), and the page has one scroll. *Preview* is that document
 * as its reader draws it, through the same words and the same measures in the same
 * column, so going to it moves nothing; where the window has the room it can stand
 * beside the writing, and opens so on a wide one, as a document did before 4.0.
 *
 * The three parts of an observation's description are written apart, each with its
 * own hint, and saved in the same text as ever, so nothing needs converting; a
 * record with other headings, or text with none, is written as one text. Everything a
 * reader edited in its pane is here, with the same refusals: the four facts of an
 * observation are never blanked, a title never, and the day is never after today.
 */
import { Fragment, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Translate } from '../../i18n'
import { useStrings } from '../../i18n/LanguageContext'
import { formatDay } from '../../i18n/dates'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import { wordCount } from '../../documentation/markdownEditing'
import { MarkdownDocument } from '../../documentation/ui/MarkdownDocument'
import { FlowPlainPart, MarkdownEditor } from '../../documentation/ui/MarkdownEditor'
import { MarkdownFlow, MarkdownFlowBar } from '../../documentation/ui/MarkdownFlow'
import type { DocumentImages } from '../../documentation/ui/MarkdownEditor'
import { usePersonNames } from '../../people/ui/names'
import { PersonRefField } from '../../people/ui/PersonRefField'
import { isBlankRef } from '../../model/person'
import type { PersonRef } from '../../model/person'
import { SelectField, DateField, TextField, TitleField, TitleRead } from '../../widgets/kit/Field'
import { FocusedWindow } from '../../widgets/kit/FocusedWindow'
import { PreviewFact } from '../../widgets/kit/Preview'
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
import { observationFacts, renderedBody } from './Readers'

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
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  onAddImage?: ((file: File) => Promise<string | undefined>) | undefined
  images?: DocumentImages | undefined
  s: Translate
}

type View = 'write' | 'side' | 'preview'

/** From where a document and its reading fit beside each other and the facts, and from where that is how it opens. */
const ROOM_BESIDE = '(min-width: 1280px)'
const OPENS_BESIDE = '(min-width: 1600px)'

/** An experiment's fields that its reader draws as they stand, so they are plain words here too. */
const PLAIN_PARTS = [
  { key: 'hypothesis', label: 'solution.hypothesis' },
  { key: 'measure', label: 'solution.measure' },
  { key: 'result', label: 'solution.result' },
] as const

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

function OpenEditor({ editing, onClose, today, renderMarkdown, onAddImage, images, s }: RecordEditorProps & { editing: RecordEditing }) {
  // Side by side is what the desktop's documents open on where there is room. It writes one document and reads the other in the same scroll.
  const roomBeside = useMediaQuery(ROOM_BESIDE, { noSsr: true })
  const opensBeside = useMediaQuery(OPENS_BESIDE, { noSsr: true })
  const [view, setView] = useState<View>(opensBeside ? 'side' : 'write')
  const shownView: View = view === 'side' && !roomBeside ? 'write' : view
  const [draft, setDraft] = useState<Draft>(() => draftOf(editing))
  const [by, setBy] = useState<PersonRef | undefined>(() => (editing.kind === 'observation' || editing.kind === 'experiment' ? editing.record.by : undefined))
  // Three parts where that is what the text holds; one field otherwise, so a record is never rewritten by being opened.
  const [sections, setSections] = useState<ObservationSections | undefined>(() => (editing.kind === 'observation' ? observationSections(editing.record.body, s) : undefined))
  const set = (field: string, value: string) => setDraft((held) => ({ ...held, [field]: value }))
  const body = sections ? observationBody(sections, s) : draft.body
  // Opened on the template's text, with nothing typed, is unchanged.
  const startBody = useMemo(() => (sections ? observationBody(observationSections(editing.record.body, s) as ObservationSections, s) : editing.record.body), [editing.record.body, s])
  const start = useMemo(() => draftOf(editing), [editing])
  const words = sections ? Object.values(sections).reduce((sum, one) => sum + wordCount(one), 0) : wordCount(draft.body)

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

  const part = (label: string, value: string, onChange: (next: string) => void, more: { hint?: string; template?: { label: string; text: string }; whole?: boolean } = {}) => (
    <MarkdownEditor
      variant="flow" label={label} value={value} onChange={onChange} minRows={more.whole ? 8 : 2} labelHidden={more.whole === true}
      {...(more.hint ? { helper: more.hint } : {})} {...(more.template ? { template: more.template } : {})}
      {...(onAddImage ? { onAddImage } : {})} {...(images ? { images } : {})}
    />
  )
  const description = (template?: string) => part(s('observation.formDescription'), draft.body, (next) => set('body', next), { whole: true, ...(template ? { template: { label: s('md.fromTemplate'), text: template } } : {}) })

  const titleField = (hint: string, missing: string) => (
    <TitleField
      label={s('observation.titleField')} required value={draft.title} onChange={(value) => set('title', value)} hint={hint}
      {...(titleMissing ? { error: missing } : {})} data-testid="editor-title" autoFocus
    />
  )

  const main = (() => {
    switch (editing.kind) {
      case 'observation': return (
        <>
          <TitleField
            label={s('observation.titleField')} required value={draft.title} onChange={(value) => set('title', value)}
            hint={s('observation.editTitleHint')} {...(shown('title') ? { error: shown('title') as string } : {})} data-testid="editor-title" autoFocus
          />
          {sections
            ? SECTIONS.map((one) => (
              <Fragment key={one.key}>{part(s(one.label), sections[one.key], (next) => setSections({ ...sections, [one.key]: next }), { hint: s(one.hint) })}</Fragment>
            ))
            : description()}
        </>
      )
      case 'cause': return <>{titleField(s('observation.causeTitleExample'), s('observation.causeTitleMissing'))}{description(causeTemplate(s))}</>
      case 'solution': return <>{titleField(s('solution.newTitleHelp'), s('solution.formTitleMissing'))}{description(solutionTemplate(s))}</>
      case 'experiment': return (
        <>
          {titleField(s('solution.experimentTitleExample'), s('solution.experimentTitleMissing'))}
          {PLAIN_PARTS.map((one) => <FlowPlainPart key={one.key} label={s(one.label)} value={draft[one.key] ?? ''} onChange={(value) => set(one.key, value)} />)}
          {description(experimentTemplate(s))}
        </>
      )
    }
  })()

  const aside = editing.kind === 'cause' ? undefined : (
    <RecordFacts editing={editing} draft={draft} set={set} by={by} onBy={setBy} today={today} shown={shown} reading={shownView === 'preview'} s={s} />
  )
  return (
    <FocusedWindow
      open
      title={s(TITLE[editing.kind])}
      number={numberOf(editing)}
      middle={(
        <Segmented
          label={s('observation.editView')} value={shownView} onChange={setView}
          options={[
            { value: 'write', label: s('observation.editWrite') },
            ...(roomBeside ? [{ value: 'side' as const, label: s('observation.editBeside') }] : []),
            { value: 'preview', label: s('observation.editPreview') },
          ]}
        />
      )}
      {...(aside ? { aside } : {})}
      changed={changed}
      saveLabel={s('observation.editSave')}
      onSave={save}
      {...(refused ? { saveRefused: refused } : {})}
      onCancel={onClose}
    >
      <div className="chain-editor" data-view={shownView}>
        {/* Kept while it is not shown: each part's undo and caret live in its text box. */}
        <div className="chain-editor__column" hidden={shownView === 'preview'}>
          <MarkdownFlow>
            <MarkdownFlowBar words={words} />
            <div className="md-flow">{main}</div>
          </MarkdownFlow>
        </div>
        {shownView !== 'write' && (
          <ReadingColumn parts={editing.kind === 'experiment' ? PLAIN_PARTS.filter((one) => (draft[one.key] ?? '').trim()) : []} draft={draft} body={body} renderMarkdown={renderMarkdown} s={s} />
        )}
      </div>
    </FocusedWindow>
  )
}

/** The document as its reader will draw it. */
function ReadingColumn({ parts, draft, body, renderMarkdown, s }: {
  parts: readonly (typeof PLAIN_PARTS)[number][]
  draft: Draft
  body: string
  renderMarkdown: RecordEditorProps['renderMarkdown']
  s: Translate
}) {
  return (
    <div className="chain-editor__column" data-testid="editor-preview">
      <p className="chain-editor__caption">{s('observation.editAsRead')}</p>
      <TitleRead>{draft.title}</TitleRead>
      <div className="md-flow">
        {parts.map((one) => (
          <section key={one.key} className="md-editor" data-variant="flow">
            <div className="md-editor__flowHead"><h3 className="md-editor__flowLabel">{s(one.label)}</h3></div>
            <p className="chain-editor__plain">{draft[one.key]}</p>
          </section>
        ))}
      </div>
      <MarkdownDocument {...(parts.length ? { className: 'chain-body' } : {})}>{renderedBody(body, s, renderMarkdown)}</MarkdownDocument>
    </div>
  )
}

/** The column of facts beside the document: written, or, for an observation under Preview, read. */
function RecordFacts({ editing, draft, set, by, onBy, today, shown, reading, s }: {
  editing: Exclude<RecordEditing, { kind: 'cause' }>
  draft: Draft
  set: (field: string, value: string) => void
  by: PersonRef | undefined
  onBy: (next: PersonRef | undefined) => void
  today: string
  shown: (key: 'title' | 'where' | 'by' | 'date') => string | undefined
  reading: boolean
  s: Translate
}) {
  const names = usePersonNames()
  const personField = (label: string, testId: string, error?: string, hint?: string) => (
    <PersonRefField
      variant="field" label={label} value={by ?? ''} names={names} onChange={onBy} testId={testId} s={s}
      {...(error ? { error: true, helperText: error } : hint ? { helperText: hint } : {})} {...(editing.kind === 'observation' ? { required: true } : {})}
    />
  )

  const sizes = [{ value: '', label: s('solution.unset') }, ...SOLUTION_SIZES.map((size: SolutionSize) => ({ value: size, label: s(SIZE_LABEL[size]) }))]
  switch (editing.kind) {
      case 'observation': return reading ? <ObservationFactsRead record={readRecord(editing.record, draft, by)} s={s} /> : (
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
          <DateField
            label={s('observation.dateField')} max={today} required value={draft.date} onChange={(value) => set('date', value)}
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
          <DateField label={s('solution.fromField')} value={draft.from} onChange={(value) => set('from', value)} />
          <DateField label={s('solution.toField')} value={draft.to} onChange={(value) => set('to', value)} />
        </>
      )
  }

}

/** The record as the draft has it, for the facts its reader will show. */
function readRecord(record: Observation, draft: Draft, by: PersonRef | undefined): Observation {
  return {
    ...record, where: draft.where, date: draft.date, impact: draft.impact as ObservationImpact, tone: draft.tone as ObservationTone,
    ...(by === undefined ? {} : { by }),
  }
}

/** What the facts column says of the draft, read: the same words, in the same place, as beside the record's own text. */
function ObservationFactsRead({ record, s }: { record: Observation; s: Translate }) {
  const names = usePersonNames()
  const { language } = useStrings()
  return (
    <>
      {observationFacts(record, { names, day: (date) => formatDay(date, language), s }).map((one) => (
        <PreviewFact key={one.label} label={one.label}><span data-testid={one.testId}>{one.value}</span></PreviewFact>
      ))}
    </>
  )
}
