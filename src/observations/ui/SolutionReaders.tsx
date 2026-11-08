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
 * It offers only what its state allows (ADR-0026, amended 28 September
 * 2026): a cause is taken on while it is an idea or shaped, an experiment is
 * planned while it is shaped or testing, and where there is no step back the
 * reader says how to get one.
 *
 * An experiment's reader moves it as `experimentMovesFrom` allows, one button
 * per move; concluding and reopening ask first, through the page.
 *
 * Being edited it is a full window (`RecordEditor`). A size or a *why now* that is
 * answered reads as text and is changed there, so a record does not look like an
 * empty form; what the gate still waits for keeps its control where it is asked.
 */
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import { Button as KitButton } from '../../widgets/kit/Button'
import Link from '@mui/material/Link'
import { Tooltip } from '../../widgets/kit/Tooltip'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { inSentence } from '../../i18n/languages'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import type { DocumentImages } from '../../documentation/ui/MarkdownEditor'
import {
  SOLUTION_PHASES, experimentMovesFrom, formatSolutionNumber, mayAddress, mayPlanExperiment, previousState,
} from '../solution'
import type {
  Experiment, ExperimentOutcome, ExperimentPatch, Gate, GateItem, Solution, SolutionPatch, SolutionPhase,
  SolutionQuestion, SolutionSize, SolutionState,
} from '../solution'
import type { CauseStrength } from '../observation'
import {
  GATE_HINT, GATE_LABEL, OUTCOME_LABEL, PHASE_LABEL, QUESTION_LABEL, SIZE_LABEL, STRENGTH_LABEL,
} from '../observationScope'
import { MarkdownDocument } from '../../documentation/ui/MarkdownDocument'
import { LinkList, ReaderRoot, Term, Value } from './Readers'
import type { ReaderPart } from './Readers'
import { StepLadder } from '../../widgets/kit/NextStep'
import { SectionHeading } from '../../widgets/CompactForms'
import type { ReaderAction } from './ActionButton'
import { deleteAction, experimentMoveButtons, modeAction, restoreAction, solutionActions } from './readerActions'
import type { Mode } from './readerActions'
import { experimentMoveLabel } from './ObservationLifecycle'
import { usePersonNames } from '../../people/ui/names'
import { CommentThread } from '../../comments/ui/threadPart'
import { CitationsSection } from '../../principles/ui/CitationsSection'
import { RecordChanges } from '../../comments/ui/RecordChanges'
import { solutionKey } from '../solutionGraph'

/** A section of the reader, under the same heading every panel's sections wear. */
function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <Box sx={{ mt: 3 }} data-testid={testId}>
      <SectionHeading sx={{ mb: 0.5 }}>{title}</SectionHeading>
      {children}
    </Box>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <Box component="span" sx={{ color: 'text.secondary' }}>{children}</Box>
}

// --- one solution -------------------------------------------------------------------------

export type SolutionReaderProps = {
  solution: Solution
  part?: ReaderPart
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
  /** False while it is adopted and its decision record stands accepted: the record is locked, and so is the step back. */
  mayGoBack: boolean
  /** Where there is no step back, the record to supersede for one: `ADR-0003`. */
  reopenBy?: string
  readOnly: boolean
  s: Translate
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  nameOf: (id: string) => string
  onUpdate: (patch: SolutionPatch) => void
  onMove: (to: SolutionState) => void
  /** Asks why no experiment is needed, and waives it. */
  onWaive: () => void
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
  /** *Copy link* to this record, where the page can make one: offered read-only too. */
  onCopyLink?: (() => void) | undefined
}

/**
 * What a solution's reader offers in its bar, read off the same props it is
 * drawn from — and the right-click on it, which passes how Edit is reached.
 */
export function solutionBar(props: SolutionReaderProps, mode: Mode, switchMode: (next: Mode) => void): ReaderAction[] {
  const { solution, s, readOnly } = props
  const dropped = solution.state === 'dropped'
  const canEdit = !readOnly && !dropped
  return [
    ...solutionActions({
      s, canEdit, mayAddress: mayAddress(solution), mayPlan: mayPlanExperiment(solution), mayDrop: solution.state !== 'adopted',
      onAddress: props.onAddress, onPlanExperiment: props.onPlanExperiment, onDrop: props.onDrop, onDelete: props.onDelete,
    }),
    ...(canEdit ? [modeAction(mode, switchMode, s('solution.tipEdit'), s)] : []),
    ...(dropped && !readOnly ? [restoreAction(s('solution.tipRestore'), props.onRestore, 'solution-restore', s)] : []),
  ]
}

export function SolutionReader(props: SolutionReaderProps) {
  const { solution, phase, gate, s, renderMarkdown, readOnly, part = 'full' } = props
  const dropped = solution.state === 'dropped'
  const canEdit = !readOnly && !dropped
  const rendered = solution.body.trim() ? renderMarkdown(solution.body) : <Typography color="text.secondary">{s('common.empty')}</Typography>
  const label = formatSolutionNumber(solution.number)
  const back = props.mayGoBack ? previousState(solution.state) : undefined
  const { language } = useStrings()
  const day = (date: string) => formatDay(date, language)

  // A reading: every answer is written in Edit, and an unanswered one says so here.
  const size = (value: SolutionSize | undefined) => (value ? s(SIZE_LABEL[value]) : <Muted>{s('solution.unset')}</Muted>)

  return (
    <ReaderRoot testId="solution-reader">
            <div data-testid="solution-phase"><SolutionLadder phase={phase} s={s} /></div>
            {gate && !dropped && (
              <SolutionGate
                gate={gate} solution={solution} canEdit={canEdit} s={s}
                onPlanExperiment={props.onPlanExperiment} onDecide={props.onDecide}
              />
            )}
            {!back && props.reopenBy && !dropped && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }} data-testid="solution-reopen-hint">
                {s('solution.reopenBySuperseding', { label: props.reopenBy })}
              </Typography>
            )}
            {dropped && (
              <Typography data-testid="solution-dropped-note" color="text.secondary" sx={{ mt: 1 }}>
                {s('solution.droppedNote', { note: solution.dropNote ?? '' })}
              </Typography>
            )}
            {props.questions.map((question) => (
              <Box key={question} data-testid={`solution-question-${question}`} sx={{ mt: 1.5, px: 1.5, py: 1, border: 1, borderColor: 'warning.main', borderRadius: 1, fontSize: 'var(--t-body)' }}>
                {s(QUESTION_LABEL[question])}
              </Box>
            ))}
            {props.implemented?.observations.some((one) => one.seenOn) && (
              <Box data-testid="solution-seen-again" sx={{ mt: 1.5, px: 1.5, py: 1, border: 1, borderColor: 'error.main', borderRadius: 1, fontSize: 'var(--t-body)' }}>
                {s('solution.findingSeenAgain', {
                  names: props.implemented.observations.filter((one) => one.seenOn).map((one) => one.label).join(', '),
                })}
              </Box>
            )}

            <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'minmax(88px, 26%) minmax(0, 1fr)', columnGap: 2, rowGap: 1, mt: 2, mb: 0, fontSize: 'var(--t-body)', alignItems: 'start' }}>
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
                        note: `${inSentence(s(STRENGTH_LABEL[one.strength]), language)}${one.root ? ` · ${inSentence(s('observation.rootCause'), language)}` : ''}`,
                        ...(canEdit ? { onRemove: () => props.onUnaddress(one.id), removeLabel: s('solution.tipUnaddress', { from: label, to: one.label }) } : {}),
                      }))}
                    />
                  )}
              </Value>
              <Term>{s('solution.benefitField')}</Term><Value testId="solution-benefit">{size(solution.benefit)}</Value>
              <Term>{s('solution.costField')}</Term><Value testId="solution-cost">{size(solution.cost)}</Value>
              <Term>{s('solution.validatedWith')}</Term>
              <Value testId="solution-validated-with">
                {solution.validatedWith.length === 0 ? <Muted>{s('solution.notAnswered')}</Muted> : solution.validatedWith.join(', ')}
              </Value>
              <Term>{s('solution.attempts')}</Term>
              <Value testId="solution-attempts">
                {solution.attempts.length === 0
                  ? <Muted>{solution.noneKnown ? s('solution.noneKnown') : s('solution.notAnswered')}</Muted>
                  : (
                    <Box component="ul" sx={{ m: 0, pl: 2 }}>
                      {solution.attempts.map((one, index) => (
                        <li key={index}>{one.when ? <b>{one.when}: </b> : null}{one.what}{one.why ? <> — <i>{one.why}</i></> : null}</li>
                      ))}
                    </Box>
                  )}
              </Value>
              {(solution.attempts.length > 0 || solution.whyNow) && (
                <>
                  <Term>{s('solution.whyNow')}</Term>
                  <Value testId="solution-why-now">{solution.whyNow ?? <Muted>{s('solution.notAnswered')}</Muted>}</Value>
                </>
              )}
              <Term>{s('solution.experiments')}</Term>
              <Value testId="solution-experiments">
                {props.experiments.length === 0
                  ? <Muted>{s('solution.none')}</Muted>
                  : <LinkList onOpen={props.onOpen} links={props.experiments.map((one) => ({ key: one.key, label: one.label, note: inSentence(s(OUTCOME_LABEL[one.outcome]), language) }))} />}
                {solution.waived && <Typography sx={{ fontSize: 'var(--t-body)', mt: 0.5 }}>{s('solution.waived', { reason: solution.waived })}</Typography>}
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
                    ? <KitButton size="small" onClick={props.onStartPlan} data-testid="solution-start-plan">{s('solution.startPlan')}</KitButton>
                    : <Muted>{s('solution.noPlan')}</Muted>}
              </Value>
              <Term>{s('solution.alternatives')}</Term>
              <Value testId="solution-alternatives">
                {props.alternatives.length === 0
                  ? <Muted>{s('solution.none')}</Muted>
                  : <LinkList onOpen={props.onOpen} links={props.alternatives.map((one) => ({ key: one.key, label: one.label, note: inSentence(s(PHASE_LABEL[one.phase]), language) }))} />}
              </Value>
            </Box>

            {props.implemented && (
              <Section title={s('solution.didItWork')} testId="solution-did-it-work">
                <Typography variant="body2" color="text.secondary">{s('solution.didItWorkHelp')}</Typography>
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mt: 1, fontSize: 'var(--t-body)' }}>
                  {props.implemented.observations.map((one) => (
                    <Box component="li" key={one.key} sx={{ display: 'flex', gap: 1, py: 0.25 }}>
                      <Link component="button" type="button" onClick={() => props.onOpen(one.key)} sx={{ flex: 1, textAlign: 'left' }}>{one.label}</Link>
                      <Typography variant="caption" color={one.seenOn ? 'error' : 'text.secondary'} sx={{ flexShrink: 0 }}>
                        {one.seenOn === undefined
                          ? s('solution.heldSince', { date: day(props.implemented!.since) })
                          : one.seenOn === props.implemented!.since
                            ? s('solution.seenSameDay', { date: day(one.seenOn) })
                            : s('solution.seenSince', { date: day(one.seenOn) })}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Section>
            )}

            <MarkdownDocument className="chain-body">{rendered}</MarkdownDocument>

            {part === 'full' && (<>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 4 }}>{s('observation.history')}</Typography>
            <Box component="ol" data-testid="solution-history" sx={{ listStyle: 'none', m: 0, p: 0, fontSize: 'var(--t-body)' }}>
              {solution.history.map((event, index) => (
                <Box component="li" key={index} sx={{ display: 'flex', gap: 2, py: 0.25, borderBottom: 1, borderColor: 'divider' }}>
                  <Box component="span" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{day(event.date)}</Box>
                  <Box component="span">
                    {event.kind === 'moved' && event.to
                      ? s('solution.eventMoved', { state: inSentence(s(PHASE_LABEL[event.to as SolutionState] ?? 'solution.phaseIdea'), language) })
                      : event.kind === 'linked'
                        ? s('solution.eventLinked', { name: props.nameOf(event.id ?? '') })
                        : s(EVENT_KEY[event.kind])}
                    {event.note ? ` — ${event.note}` : ''}
                  </Box>
                </Box>
              ))}
            </Box>
            <SolutionFooter id={solution.id} subject={`${solution.title}\n${solution.body}`} nameOf={props.nameOf} onOpen={props.onOpen} />
            </>)}
    </ReaderRoot>
  )
}

/**
 * The gate to the next state, one line per thing it asks, each saying on
 * hover and on focus where on the page it is answered (`GATE_HINT`).
 *
 * *Tried before* and *why now* are two lines answered by one tick while no
 * earlier attempt is listed — "None known" says both that nothing was tried
 * and that there is nothing to explain — and the *why now* field is not even
 * on the page until an attempt is. So the second line says, in its own words
 * and not only on hover, that the same tick answers it.
 */
/** Where a solution stands, in words: *Idea › Shaped › Testing*. */
function SolutionLadder({ phase, s }: { phase: SolutionPhase; s: Translate }) {
  const at = SOLUTION_PHASES.indexOf(phase)
  const steps = SOLUTION_PHASES.map((one, index) => ({
    id: one, label: s(PHASE_LABEL[one]), state: index < at ? 'done' as const : index === at ? 'current' as const : 'todo' as const,
  }))
  return <StepLadder steps={steps} />
}

/** What the next state asks, a line each; the step itself is the Next band's, and Waive… and the step back are with it. */
function SolutionGate({ gate, solution, canEdit, s, onPlanExperiment, onDecide }: {
  gate: Gate
  solution: Solution
  canEdit: boolean
  s: Translate
  onPlanExperiment: () => void
  onDecide?: () => void
}) {
  const { language } = useStrings()
  const label = (item: GateItem) => (
    item === 'whyNow' && solution.attempts.length === 0 ? s('solution.gateWhyNowNoneKnown') : s(GATE_LABEL[item])
  )
  return (
    <Section title={s('solution.gateTitle', { state: inSentence(s(PHASE_LABEL[gate.to]), language) })} testId="solution-gate">
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, fontSize: 'var(--t-body)' }}>
        {gate.items.map((one) => (
          <Box component="li" key={one.item} data-testid={`solution-gate-${one.item}`} data-ok={one.ok ? 'true' : 'false'} sx={{ display: 'flex', gap: 1, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
            <Box component="span" aria-hidden sx={{ width: 16, fontWeight: 700, color: one.ok ? 'success.main' : 'text.secondary' }}>{one.ok ? '✓' : '○'}</Box>
            {/* The hint describes the line rather than naming it, and the line
                takes focus, so the hint is not for the mouse only. Above it, never over
                the rows under it, whose ⋯ a pointer left on the line would reach for. */}
            <Tooltip placement="top" title={s(GATE_HINT[one.item])}>
              <Box component="span" tabIndex={0} data-gate-line sx={{ flex: 1, cursor: 'help' }}>{label(one.item)}</Box>
            </Tooltip>
            {!one.ok && canEdit && one.item === 'experimentPlanned' && <KitButton size="small" onClick={onPlanExperiment}>{s('solution.planExperiment')}</KitButton>}
            {!one.ok && canEdit && one.item === 'decisionAccepted' && !solution.decision && onDecide && (
              <KitButton size="small" onClick={onDecide} data-testid="solution-decide" data-guide="solution.decide">{s('solution.proposeDecision')}</KitButton>
            )}
          </Box>
        ))}
      </Box>
    </Section>
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
  part?: ReaderPart
  /** The solutions it tests, resolved by the page. */
  tests: readonly { key: string; label: string }[]
  readOnly: boolean
  s: Translate
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  onUpdate: (patch: ExperimentPatch) => void
  /**
   * Move it to one of the outcomes `experimentMovesFrom` offers. The page
   * asks for the result and the day before a conclusion, and confirms a
   * reopen, naming the proof it takes away.
   */
  onMove: (to: ExperimentOutcome) => void
  onDelete: () => void
  onOpen: (key: string) => void
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
  /** *Copy link* to this record, where the page can make one: offered read-only too. */
  onCopyLink?: (() => void) | undefined
}

/** An experiment's moves from where it stands, and what the bar offers beside them; none where it is read only. */
export function experimentBar(props: ExperimentReaderProps, mode: Mode, switchMode: (next: Mode) => void) {
  const { experiment, s } = props
  if (props.readOnly) return { moves: [], actions: [] }
  return {
    moves: experimentMoveButtons({
      s, from: experiment.outcome, moves: experimentMovesFrom(experiment.outcome),
      label: (to) => experimentMoveLabel(experiment.outcome, to, s), onMove: props.onMove,
    }),
    actions: [modeAction(mode, switchMode, s('solution.tipExperimentEdit'), s), deleteAction(s('solution.tipDeleteExperiment'), props.onDelete, s)],
  }
}

export function ExperimentReader(props: ExperimentReaderProps) {
  const { experiment, s, renderMarkdown, part = 'full' } = props
  // Who runs it, by the register's name or pseudonym, or the text typed (ADR-0036 §8).
  const names = usePersonNames()
  const rendered = experiment.body.trim() ? renderMarkdown(experiment.body) : <Typography color="text.secondary">{s('common.empty')}</Typography>
  const shown = (value: string | undefined) => (value ? value : <Muted>—</Muted>)
  const { language } = useStrings()
  const shownDay = (value: string | undefined) => (value ? formatDay(value, language) : <Muted>—</Muted>)
  return (
    <ReaderRoot testId="experiment-reader">
      <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 0.5, mb: 0, fontSize: 'var(--t-body)' }}>
        <Term>{s('solution.outcomeField')}</Term><Value testId="experiment-outcome">{s(OUTCOME_LABEL[experiment.outcome])}</Value>
        <Term>{s('solution.tests')}</Term>
        <Value testId="experiment-tests">
          {props.tests.length === 0 ? <Muted>{s('solution.none')}</Muted> : <LinkList onOpen={props.onOpen} links={props.tests} />}
        </Value>
        <Term>{s('solution.hypothesis')}</Term><Value testId="experiment-hypothesis">{shown(experiment.hypothesis)}</Value>
        <Term>{s('solution.measure')}</Term><Value>{shown(experiment.measure)}</Value>
        <Term>{s('solution.whereField')}</Term><Value>{shown(experiment.where)}</Value>
        <Term>{s('solution.byField')}</Term><Value testId="experiment-by">{shown(names.text(experiment.by))}</Value>
        <Term>{s('solution.fromField')}</Term><Value>{shownDay(experiment.from)}</Value>
        <Term>{s('solution.toField')}</Term><Value>{shownDay(experiment.to)}</Value>
        <Term>{s('solution.result')}</Term><Value testId="experiment-result">{shown(experiment.result)}</Value>
      </Box>
      {experiment.outcome === 'refuted' && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{s('solution.refutedNote')}</Typography>}
      <MarkdownDocument className="chain-body">{rendered}</MarkdownDocument>
      {part === 'full' && (
        <>
          <RecordChanges about={{ kind: 'experiment', id: experiment.id }} first="proposed" />
          <CommentThread about={{ kind: 'experiment', id: experiment.id }} />
        </>
      )}
    </ReaderRoot>
  )
}

/** Under a solution: the principles it follows (ADR-0041), who proposed and changed it (ADR-0038, amended §11), and its thread (ADR-0037). */
function SolutionFooter({ id, subject, nameOf, onOpen }: { id: string; subject: string; nameOf: (id: string) => string; onOpen: (key: string) => void }) {
  return (
    <>
      <CitationsSection about={{ kind: 'solution', id }} subject={subject} />
      <RecordChanges about={{ kind: 'solution', id }} first="proposed" />
      <CommentThread about={{ kind: 'solution', id }} nameOf={(from) => nameOf(from.id)} openFrom={(from) => () => onOpen(solutionKey(from.id))} />
    </>
  )
}
