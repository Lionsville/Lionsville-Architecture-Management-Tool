// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The reading pane of the observations page, wired: whichever record is
 * selected, read with the reader for its kind, and every action the reader
 * offers turned into a change to the page's lists — or, for a record of a
 * scope below, into that scope's step (ADR-0032 §2).
 *
 * The page hands in what it holds and what it asks for in a dialog; the
 * one-line changes are made here, through the same rules the page and the
 * agent use.
 */
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import type { DocumentImages } from '../../documentation/ui/DocumentSource'
import type { Adr } from '../../model/adr'
import type { Transition } from '../../model/transition'
import {
  causeLabel, explainedBy, formatObservationNumber, isRootCause, makeCause, makeRootCause, setArchived, unlinkCause,
  updateCause, updateObservation,
} from '../observation'
import type { Cause, CauseAbove, CauseLink, Observation, ScopeAnalysis } from '../observation'
import { nodeKey, pictureKey } from '../graph'
import {
  alternatives, experimentsFor, implementedOn, moveSolution, openItems, previousState, restoreSolution, seenSinceImplemented,
  solutionGate, solutionPhase, solutionQuestions, unaddressCause, underneath, updateExperiment, updateSolution, waiveExperiment,
} from '../solution'
import type { Experiment, ExperimentOutcome, Solution, SolutionContext, SolutionPlan, SolutionState } from '../solution'
import { experimentKey, solutionKey } from '../solutionGraph'
import { formatExperimentNumber, formatSolutionNumber } from '../solution'
import { PHASE_LABEL } from '../observationScope'
import { rootToggle } from './ObservationLifecycle'
import { CauseReader, ObservationReader, ScopeStrip, causeBar, observationBar } from './Readers'
import { ReaderActions } from './ActionButton'
import { openScopeAction, toMenu } from './readerActions'
import type { CausePanel, CauseReaderProps, MergedInto, ObservationReaderProps } from './Readers'
import { ExperimentReader, SolutionReader, experimentBar, solutionBar } from './SolutionReaders'
import type { ExperimentReaderProps, SolutionReaderProps } from './SolutionReaders'
import type { LinkTarget, Mode } from './readerActions'
import type { MenuAction } from './PictureMenu'
import type { ObservationWork } from './ObservationsPage'

/** What a change to a scope below is, as the page hands it over: that scope's lists in, what they become out. */
export type WorkChange = (work: ObservationWork) => ObservationWork | undefined

/** What the readers ask of the page's writes: a link dialog, and a scope below written as its own step. */
export type ReaderWrites = {
  openLink: (target: LinkTarget) => void
  /** The dialog links a cause here to a cause below, from either end (ADR-0032 §4). */
  across?: boolean
  /** Absent where nothing below may be written from here. */
  changeBelow?: (scope: string, change: WorkChange, landed?: () => void) => void
}

const ADR_STATUS_KEY = {
  proposed: 'adr.statusProposed', reviewing: 'adr.statusReviewing', accepted: 'adr.statusAccepted',
  rejected: 'adr.statusRejected', superseded: 'adr.statusSuperseded',
} as const
const PLAN_STATUS_KEY = {
  draft: 'plan.draft', agreed: 'plan.agreed', running: 'plan.running', done: 'plan.done', abandoned: 'plan.abandoned',
} as const

const label4 = (prefix: string, number: number) => `${prefix}-${String(Math.max(0, Math.trunc(number))).padStart(4, '0')}`

/** What is selected, as the page resolves a key. */
export type Selected =
  | { kind: 'observation'; observation: Observation }
  | { kind: 'below'; scope: string; observation: Observation }
  | { kind: 'cause'; cause: Cause }
  | { kind: 'causeBelow'; scope: string; cause: Cause }
  | { kind: 'solution'; solution: Solution }
  | { kind: 'solutionBelow'; scope: string; solution: Solution }
  | { kind: 'experiment'; experiment: Experiment }
  | { kind: 'experimentBelow'; scope: string; experiment: Experiment }

/**
 * What a key names, as the page keys its records: a solution or an
 * experiment by its prefix, a record of this scope by its id, one of a scope
 * below as `scope#id` — the reader it opens and the menu it gets are both
 * read off this, so a record the picture draws is a record the pane reads.
 */
export function resolveSelected(key: string, work: ObservationWork, below: readonly ScopeAnalysis[]): Selected | undefined {
  const solution = work.solutions.find((one) => solutionKey(one.id) === key)
  if (solution) return { kind: 'solution', solution }
  const experiment = work.experiments.find((one) => experimentKey(one.id) === key)
  if (experiment) return { kind: 'experiment', experiment }
  const cause = work.causes.find((one) => one.id === key)
  if (cause) return { kind: 'cause', cause }
  const observation = work.observations.find((one) => one.id === key)
  if (observation) return { kind: 'observation', observation }
  for (const { scope, observations, causes, solutions, experiments } of below) {
    const seen = observations.find((one) => nodeKey(one.id, scope) === key)
    if (seen) return { kind: 'below', scope, observation: seen }
    const why = causes.find((one) => nodeKey(one.id, scope) === key)
    if (why) return { kind: 'causeBelow', scope, cause: why }
    const done = solutions.find((one) => nodeKey(solutionKey(one.id), scope) === key)
    if (done) return { kind: 'solutionBelow', scope, solution: done }
    const tried = experiments.find((one) => nodeKey(experimentKey(one.id), scope) === key)
    if (tried) return { kind: 'experimentBelow', scope, experiment: tried }
  }
  return undefined
}

export type DeleteKind = 'observation' | 'cause' | 'solution' | 'experiment'

/** Everything the reading pane reads and asks of the page. */
export type ReaderContext = {
  /** The path of the scope the page reads. */
  here: string
  work: ObservationWork
  below: readonly ScopeAnalysis[]
  plans: readonly SolutionPlan[]
  context: SolutionContext
  decisions: readonly Adr[]
  transitions: readonly Transition[]
  /** The causes above that explain this scope's records, by the id explained. */
  explainedAbove?: ReadonlyMap<string, readonly CauseAbove[]>
  /** The same for a scope below, by its path: every scope over it, this one included. */
  explainedAboveOf?: (scope: string) => ReadonlyMap<string, readonly CauseAbove[]> | undefined
  readOnly: boolean
  /** `yyyy-mm-dd`. */
  today: () => string
  scopeName: string
  s: Translate
  nameOf: (id: string, scope?: string) => string
  scopeLabel: (path: string) => string
  commit: (next: Partial<ObservationWork>) => void
  forms: ReaderWrites
  lifecycle: {
    seeAgain: (observation: Observation, scope?: string) => void
    verify: (cause: Cause) => void
    moveExperiment: (experiment: Experiment, to: ExperimentOutcome) => void
  }
  /** The questions the page asks in a dialog of its own. */
  ask: {
    archive: (observation: Observation) => void
    merge: (observation: Observation, scope?: string) => void
    /** The merge screen, opened on a cause of this scope or of `scope` (ADR-0035). */
    mergeCause: (cause: Cause, scope?: string) => void
    remove: (kind: DeleteKind, id: string) => void
    propose: (causeId: string) => void
    address: (solution: Solution) => void
    plan: (solution: Solution) => void
    drop: (solution: Solution) => void
  }
  mergedLabel: (observation: Observation) => MergedInto | undefined
  /** Where a cause went when it was merged, of this scope or of `scope`. */
  mergedCause: (cause: Cause, scope?: string) => MergedInto | undefined
  openKey: (key: string) => void
  /** The question the right-click last asked of a cause, by the key it is selected by: its reader shows it. */
  asked?: { key: string; panel: CausePanel } | undefined
  /** Open the page of another scope, closing this one. */
  openScope?: (path: string) => void
  onDecide?: (solutionId: string) => void
  onStartPlan?: (solutionId: string) => void
  onOpenDecision?: (adrId: string) => void
  onOpenPlan?: (planId: string) => void
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
  /** *Copy link* to the record on show, where the host can make one (ADR-0033): every reader offers it, read-only too. */
  copyLink?: ((selected: Selected) => void) | undefined
}

/** What a reader is handed to copy a link to the record it reads. */
type Link = { onCopyLink?: () => void }

export function RecordReader({ selected, selectedKey, ctx }: { selected: Selected | undefined; selectedKey: string | undefined; ctx: ReaderContext }) {
  if (!selected) return <Box sx={{ p: 5, color: 'text.secondary' }}><Typography>{ctx.s('observation.noneSelected')}</Typography></Box>
  const copy = ctx.copyLink
  const link: Link = copy ? { onCopyLink: () => copy(selected) } : {}
  switch (selected.kind) {
    case 'solution': return solutionReader(selected.solution, ctx, link)
    case 'solutionBelow': return solutionBelowReader(selected.solution, selected.scope, ctx, link)
    case 'experiment': return experimentReader(selected.experiment, ctx, link)
    case 'experimentBelow': return experimentBelowReader(selected.experiment, selected.scope, ctx, link)
    case 'cause': return causeReader(selected.cause, undefined, ctx, link)
    case 'causeBelow': return causeReader(selected.cause, selected.scope, ctx, link)
    case 'below': return observationReader(selected.observation, selected.scope, selectedKey, ctx, link)
    case 'observation': return observationReader(selected.observation, undefined, selectedKey, ctx, link)
  }
}

/** The lists of the scope a record lives in: this one's, or a scope below's as read. */
function listsOf(scope: string | undefined, ctx: ReaderContext): ObservationWork {
  if (scope === undefined) return ctx.work
  const held = ctx.below.find((one) => one.scope === scope)
  return {
    observations: [...(held?.observations ?? [])], causes: [...(held?.causes ?? [])],
    solutions: [...(held?.solutions ?? [])], experiments: [...(held?.experiments ?? [])],
  }
}

/**
 * What a record of `scope` is called, as that scope names it: its label and
 * title, with no scope after it — and a record of another scope as the page
 * names that one, with its scope. What a reader of a record below links to
 * is read in the record's own scope, never in the page's.
 */
function nameWithin(scope: string, ctx: ReaderContext): (id: string, at?: string) => string {
  const lists = listsOf(scope, ctx)
  return (id, at) => {
    if (at !== undefined && at !== scope) return at === ctx.here ? ctx.nameOf(id) : ctx.nameOf(id, at)
    const seen = lists.observations.find((one) => one.id === id)
    if (seen) return `${formatObservationNumber(seen.number)} ${seen.title}`
    const why = lists.causes.find((one) => one.id === id)
    if (why) return `${causeLabel(why)} ${why.title}`
    const done = lists.solutions.find((one) => one.id === id)
    if (done) return `${formatSolutionNumber(done.number)} ${done.title}`
    const tried = lists.experiments.find((one) => one.id === id)
    return tried ? `${formatExperimentNumber(tried.number)} ${tried.title}` : ctx.nameOf(id, scope)
  }
}

function observationReader(one: Observation, scope: string | undefined, selectedKey: string | undefined, ctx: ReaderContext, link: Link) {
  return <ObservationReader key={selectedKey} {...observationProps(one, scope, selectedKey, ctx)} {...link} />
}

/** An observation's reader, wired: what the pane draws and what the right-click offers are read off these. */
function observationProps(one: Observation, scope: string | undefined, selectedKey: string | undefined, ctx: ReaderContext): ObservationReaderProps {
  const { s, work, forms } = ctx
  const own = scope === undefined
  // Its own scope's causes, and a cause here that ADR-0021 let explain one below.
  const explainers = [
    ...explainedBy(listsOf(scope, ctx).causes, one.id).map((cause) => ({ cause, scope })),
    ...(own ? [] : explainedBy(work.causes, one.id, scope).map((cause) => ({ cause, scope: undefined }))),
  ]
  const unlink = (causeId: string, at?: string) => {
    if (at === undefined) ctx.commit({ causes: unlinkCause(work.causes, causeId, one.id, scope) })
    else forms.changeBelow?.(at, (held) => ({ ...held, causes: unlinkCause(held.causes, causeId, one.id) }))
  }
  const openScope = ctx.openScope
  return {
    observation: one,
    fromScope: scope !== undefined ? { path: scope, label: ctx.scopeLabel(scope) } : undefined,
    explainedBy: explainers.map(({ cause, scope: at }) => ({
      cause, link: cause.explains.find((held) => held.id === one.id)!, ...(at !== undefined ? { scope: at } : {}),
    })),
    mergedInto: own ? ctx.mergedLabel(one) : undefined,
    readOnly: ctx.readOnly,
    mayChangeBelow: Boolean(forms.changeBelow),
    today: ctx.today(),
    s,
    renderMarkdown: ctx.renderMarkdown,
    nameOf: ctx.nameOf,
    onUpdate: (patch) => ctx.commit({ observations: updateObservation(work.observations, one.id, patch) }),
    onSeenAgain: () => ctx.lifecycle.seeAgain(one, scope),
    onArchive: () => ctx.ask.archive(one),
    onRestore: () => ctx.commit({ observations: restoreObservation(work.observations, one.id, ctx.today()) }),
    onMerge: () => ctx.ask.merge(one, scope),
    onLink: () => forms.openLink({ mode: 'cause', id: one.id, ...(scope !== undefined ? { scope } : {}) }),
    onUnlink: unlink,
    onDelete: () => ctx.ask.remove('observation', one.id),
    onOpenScope: scope !== undefined && openScope ? () => openScope(scope) : undefined,
    onOpen: ctx.openKey,
    onAddImage: ctx.onAddImage,
    images: ctx.images,
  }
}

function restoreObservation(list: readonly Observation[], id: string, date: string): Observation[] {
  return setArchived(list, id, false, date)
}

/**
 * A cause, of this scope or of one below. Deeper and root causes are linked,
 * and the root step taken, in the scope it lives in; a cause of this scope
 * may explain one below (*Local cause*), and one below may be explained by a
 * cause of this scope (*Org cause*), which is this scope's link (ADR-0032 §4).
 */
/**
 * What explains a cause from another scope, and its root step, wherever it
 * lives: one above explains one here; one here — or, off the tree, any scope
 * over it — explains one below, and the root step below is refused for all of
 * them, not only for the ones this scope's page draws.
 */
function crossScope(cause: Cause, scope: string | undefined, ctx: ReaderContext) {
  const { work, forms } = ctx
  const own = scope === undefined
  const across: readonly CauseAbove[] = own
    ? ctx.explainedAbove?.get(cause.id) ?? []
    : work.causes.flatMap((held) => held.explains.filter((link) => link.id === cause.id && link.scope === scope)
      .map((link) => ({ scope: ctx.here, cause: held, strength: link.strength })))
  const fromTree = own ? undefined : ctx.explainedAboveOf?.(scope)?.get(cause.id)
  const above = fromTree ?? across
  const toggle = rootToggle(cause, {
    lists: listsOf(scope, ctx), above, commit: ctx.commit, nameOf: (id) => ctx.nameOf(id, scope),
    scopeLabel: (path) => (own || fromTree ? ctx.scopeLabel(path) : ctx.scopeName),
    s: ctx.s, readOnly: ctx.readOnly || (!own && !forms.changeBelow),
    ...(own ? {} : {
      apply: () => forms.changeBelow?.(scope, (held) => {
        const change = isRootCause(cause) ? makeCause(held.causes, cause.id, held.solutions) : makeRootCause(held.causes, cause.id, above)
        return change.ok ? { ...held, causes: change.causes } : undefined
      }),
    }),
  })
  return { across, above, toggle }
}

/**
 * What explains a cause from another scope, as its reader lists it: for a
 * cause of this scope, the causes above, each opening where it lives; for one
 * below, the causes of this scope — unlinked from here, where the link is
 * kept — and those of the scopes over this one, read off the tree.
 */
function explainedFromOf(cause: Cause, scope: string | undefined, above: readonly CauseAbove[], ctx: ReaderContext) {
  const openScope = ctx.openScope
  const elsewhere = (one: CauseAbove) => ({
    key: `${one.scope}#${one.cause.id}`, label: `${causeLabel(one.cause)} ${one.cause.title} (${ctx.scopeLabel(one.scope)})`,
    ...(openScope ? { open: () => openScope(one.scope) } : {}),
  })
  if (scope === undefined) return above.map(elsewhere)
  return above.map((one) => (one.scope !== ctx.here ? elsewhere(one) : {
    key: one.cause.id, label: ctx.nameOf(one.cause.id),
    onRemove: () => ctx.commit({ causes: unlinkCause(ctx.work.causes, one.cause.id, cause.id, scope) }),
  }))
}

function causeReader(cause: Cause, scope: string | undefined, ctx: ReaderContext, link: Link) {
  return <CauseReader key={nodeKey(cause.id, scope)} {...causeProps(cause, scope, ctx)} {...link} />
}

/** A cause's reader, wired: what the pane draws and what the right-click offers are read off these. */
function causeProps(cause: Cause, scope: string | undefined, ctx: ReaderContext): CauseReaderProps {
  const { s, work, forms } = ctx
  const own = scope === undefined
  const lists = listsOf(scope, ctx)
  const { above, toggle } = crossScope(cause, scope, ctx)
  const onCauses = (change: (list: Cause[]) => Cause[]) => (own
    ? ctx.commit({ causes: change(work.causes) })
    : forms.changeBelow?.(scope, (held) => ({ ...held, causes: change(held.causes) })))
  const hasBelow = ctx.below.some((one) => one.causes.some((held) => !isRootCause(held)))
  const solutions = own ? work.solutions.filter((one) => one.addresses.some((address) => address.id === cause.id)) : []
  const openScope = ctx.openScope
  const asked = ctx.asked
  return {
    cause,
    causes: lists.causes,
    mergedInto: ctx.mergedCause(cause, scope),
    onMerge: () => ctx.ask.mergeCause(cause, scope),
    ...(own ? {} : { fromScope: { label: ctx.scopeLabel(scope), ...(openScope ? { onOpenScope: () => openScope(scope) } : {}) } }),
    explainedFrom: explainedFromOf(cause, scope, own ? ctx.explainedAbove?.get(cause.id) ?? [] : above, ctx),
    readOnly: ctx.readOnly,
    mayChangeBelow: Boolean(forms.changeBelow),
    across: !forms.across ? [] : own ? (hasBelow ? ['local'] : []) : ['org'],
    here: ctx.scopeName,
    ...(!own && isRootCause(cause) ? { orgRefused: s('observation.orgRefused', { label: ctx.nameOf(cause.id, scope) }) } : {}),
    s,
    renderMarkdown: ctx.renderMarkdown,
    nameOf: own ? ctx.nameOf : nameWithin(scope, ctx),
    ...(own ? {} : { keyOf: (id: string, at?: string) => pictureKey(ctx.here, at ?? scope, id) }),
    onUpdate: (patch) => ctx.commit({ causes: updateCause(work.causes, cause.id, patch) }),
    onVerify: () => ctx.lifecycle.verify(cause),
    ...toggle,
    onLink: (mode) => forms.openLink({ mode, id: cause.id, ...(scope !== undefined ? { scope } : {}) }),
    onUnlink: (target: CauseLink) => onCauses((list) => unlinkCause(list, cause.id, target.id, target.scope)),
    onUnlinkFrom: (causeId) => onCauses((list) => unlinkCause(list, causeId, cause.id)),
    onDelete: () => ctx.ask.remove('cause', cause.id),
    onOpen: ctx.openKey,
    ...(own ? {
      solutions: solutions.map((one) => ({
        key: solutionKey(one.id), label: ctx.nameOf(one.id), note: s(PHASE_LABEL[solutionPhase(one, ctx.plans)]).toLowerCase(),
      })),
    } : {}),
    ...(ctx.readOnly || !own || !isRootCause(cause) ? {} : { onPropose: () => ctx.ask.propose(cause.id) }),
    onAddImage: ctx.onAddImage,
    images: ctx.images,
    ...(asked && asked.key === nodeKey(cause.id, scope) ? { asked } : {}),
  }
}

function solutionReader(one: Solution, ctx: ReaderContext, link: Link) {
  return <SolutionReader key={one.id} {...solutionProps(one, ctx)} {...link} />
}

/** A solution's reader, wired: what the pane draws and what the right-click offers are read off these. */
function solutionProps(one: Solution, ctx: ReaderContext): SolutionReaderProps {
  const { s, work, plans, context } = ctx
  const analysis = { observations: work.observations, causes: work.causes }
  const belowAll = ctx.below.flatMap(({ scope, observations }) => observations.map((observation) => ({ scope, observation })))
  const phase = solutionPhase(one, plans)
  const since = implementedOn(one, plans)
  const seenAgain = seenSinceImplemented(one, analysis, belowAll, plans)
  const decision = ctx.decisions.find((held) => held.id === one.decision)
  const plan = ctx.transitions.find((held) => held.id === one.plan)
  const move = (to: SolutionState) => {
    const result = moveSolution(work.solutions, one.id, to, ctx.today(), context)
    if (result.ok) ctx.commit({ solutions: result.solutions })
  }
  const locked = one.state === 'adopted' && decision?.status === 'accepted'
  return {
    solution: one,
    phase,
    gate: solutionGate(one, context),
    mayGoBack: !locked,
    ...(locked && decision ? { reopenBy: label4('ADR', decision.number) } : {}),
    questions: solutionQuestions(one, context),
    addresses: one.addresses.map((address) => {
      const cause = work.causes.find((held) => held.id === address.id)
      return { id: address.id, label: ctx.nameOf(address.id), strength: address.strength, root: cause ? isRootCause(cause) : false }
    }),
    experiments: experimentsFor(work.experiments, one.id).map((held) => ({ key: experimentKey(held.id), label: ctx.nameOf(held.id), outcome: held.outcome })),
    alternatives: alternatives(one, work.solutions).map((held) => ({ key: solutionKey(held.id), label: ctx.nameOf(held.id), phase: solutionPhase(held, plans) })),
    ...(decision ? { decision: { label: ctx.nameOf(decision.id), status: s(ADR_STATUS_KEY[decision.status]).toLowerCase() } } : {}),
    ...(plan ? { plan: { label: ctx.nameOf(plan.id), status: s(PLAN_STATUS_KEY[plan.status]).toLowerCase() } } : {}),
    ...(since ? {
      implemented: {
        since,
        observations: underneath(one, analysis).map((held) => {
          const seenOn = seenAgain.find((again) => again.id === held.id && again.scope === held.scope)?.date
          return { key: nodeKey(held.id, held.scope), label: ctx.nameOf(held.id, held.scope), ...(seenOn ? { seenOn } : {}) }
        }),
      },
    } : {}),
    readOnly: ctx.readOnly,
    s,
    renderMarkdown: ctx.renderMarkdown,
    nameOf: (id) => ctx.nameOf(id),
    onUpdate: (patch) => ctx.commit({ solutions: updateSolution(work.solutions, one.id, patch) }),
    onMove: move,
    onWaive: (reason) => ctx.commit({ solutions: waiveExperiment(work.solutions, one.id, reason, ctx.today()) }),
    onAddress: () => ctx.ask.address(one),
    onUnaddress: (causeId) => ctx.commit({ solutions: unaddressCause(work.solutions, one.id, causeId) }),
    onPlanExperiment: () => ctx.ask.plan(one),
    ...(ctx.onDecide ? { onDecide: () => ctx.onDecide?.(one.id) } : {}),
    ...(ctx.onStartPlan ? { onStartPlan: () => ctx.onStartPlan?.(one.id) } : {}),
    ...(decision && ctx.onOpenDecision ? { onOpenDecision: () => ctx.onOpenDecision?.(decision.id) } : {}),
    ...(plan && ctx.onOpenPlan ? { onOpenPlan: () => ctx.onOpenPlan?.(plan.id) } : {}),
    onDrop: () => ctx.ask.drop(one),
    onRestore: () => ctx.commit({ solutions: restoreSolution(work.solutions, one.id, ctx.today()) }),
    onDelete: () => ctx.ask.remove('solution', one.id),
    onOpen: ctx.openKey,
    onAddImage: ctx.onAddImage,
    images: ctx.images,
  }
}

/**
 * A solution of a scope below, read and not changed: it is worked on in its
 * own scope, whose plans and decisions this page does not read, so no gate is
 * drawn here that could not say where it stands. The strip says where it
 * lives and opens that scope.
 */
function solutionBelowReader(one: Solution, scope: string, ctx: ReaderContext, link: Link) {
  const lists = listsOf(scope, ctx)
  const nameOf = nameWithin(scope, ctx)
  const openScope = ctx.openScope
  const label = ctx.scopeLabel(scope)
  const nothing = () => {}
  return (
    <Box key={nodeKey(solutionKey(one.id), scope)} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <ScopeStrip
        testId="solution-from-below"
        text={ctx.s('observation.fromScope', { scope: label })}
        action={openScope ? <ReaderActions actions={[openScopeAction(label, () => openScope(scope), ctx.s)]} label={ctx.s('observation.fromScopeActions')} moreLabel={ctx.s('observation.more')} /> : undefined}
      />
      <SolutionReader
        solution={one}
        phase={solutionPhase(one, [])}
        questions={[]}
        addresses={one.addresses.map((address) => {
          const cause = lists.causes.find((held) => held.id === address.id)
          return { id: address.id, label: nameOf(address.id), strength: address.strength, root: cause ? isRootCause(cause) : false }
        })}
        experiments={experimentsFor(lists.experiments, one.id).map((held) => ({ key: nodeKey(experimentKey(held.id), scope), label: nameOf(held.id), outcome: held.outcome }))}
        alternatives={alternatives(one, lists.solutions).map((held) => ({ key: nodeKey(solutionKey(held.id), scope), label: nameOf(held.id), phase: solutionPhase(held, []) }))}
        mayGoBack={false}
        readOnly
        s={ctx.s}
        renderMarkdown={ctx.renderMarkdown}
        nameOf={nameOf}
        onUpdate={nothing} onMove={nothing} onWaive={nothing} onAddress={nothing} onUnaddress={nothing}
        onPlanExperiment={nothing} onDrop={nothing} onRestore={nothing} onDelete={nothing}
        onOpen={ctx.openKey}
        images={ctx.images}
        {...link}
      />
    </Box>
  )
}

/** An experiment of a scope below, read and not changed, as a solution below is: it is concluded in its own scope. */
function experimentBelowReader(one: Experiment, scope: string, ctx: ReaderContext, link: Link) {
  const nameOf = nameWithin(scope, ctx)
  const openScope = ctx.openScope
  const label = ctx.scopeLabel(scope)
  const nothing = () => {}
  return (
    <Box key={nodeKey(experimentKey(one.id), scope)} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <ScopeStrip
        testId="experiment-from-below"
        text={ctx.s('observation.fromScope', { scope: label })}
        action={openScope ? <ReaderActions actions={[openScopeAction(label, () => openScope(scope), ctx.s)]} label={ctx.s('observation.fromScopeActions')} moreLabel={ctx.s('observation.more')} /> : undefined}
      />
      <ExperimentReader
        experiment={one}
        tests={one.tests.map((id) => ({ key: nodeKey(solutionKey(id), scope), label: nameOf(id) }))}
        readOnly
        s={ctx.s}
        renderMarkdown={ctx.renderMarkdown}
        onUpdate={nothing} onMove={nothing} onDelete={nothing}
        onOpen={ctx.openKey}
        images={ctx.images}
        {...link}
      />
    </Box>
  )
}

function experimentReader(one: Experiment, ctx: ReaderContext, link: Link) {
  return <ExperimentReader key={one.id} {...experimentProps(one, ctx)} {...link} />
}

/** An experiment's reader, wired: what the pane draws and what the right-click offers are read off these. */
function experimentProps(one: Experiment, ctx: ReaderContext): ExperimentReaderProps {
  return {
    experiment: one,
    tests: one.tests.map((id) => ({ key: solutionKey(id), label: ctx.nameOf(id) })),
    readOnly: ctx.readOnly,
    s: ctx.s,
    renderMarkdown: ctx.renderMarkdown,
    onUpdate: (patch) => ctx.commit({ experiments: updateExperiment(ctx.work.experiments, one.id, patch) }),
    onMove: (to) => ctx.lifecycle.moveExperiment(one, to),
    onDelete: () => ctx.ask.remove('experiment', one.id),
    onOpen: ctx.openKey,
    onAddImage: ctx.onAddImage,
    images: ctx.images,
  }
}

// --- the right-click -----------------------------------------------------------------------

/** What the right-click asks of the page besides what a reader's own actions do. */
export type MenuWrites = {
  /** Edit the record, with the picture stepped aside. */
  edit: () => void
  /** Show a cause's question — the root step, or Org cause on a root — in its reader, as its own press would. */
  ask: (panel: CausePanel) => void
}

/**
 * The right-click on a record offers what its reader's bar offers, read off
 * the same props, in the same order and words (`toMenu`): a reader and its
 * menu cannot drift apart. A solution adds the steps its gate offers in the
 * reader, and a record of a scope below the way to the scope it lives in.
 */
export function recordMenu(held: Selected, key: string, ctx: ReaderContext, page: MenuWrites): MenuAction[] {
  const edit = (next: Mode) => { if (next === 'edit') page.edit() }
  const openScope = ctx.openScope
  const below = (scope: string, actions: MenuAction[]): MenuAction[] => (openScope ? [...actions, {
    key: 'open-scope', label: ctx.s('observation.openScope', { scope: ctx.scopeLabel(scope) }), divider: actions.length > 0,
    onClick: () => openScope(scope),
  }] : actions)
  switch (held.kind) {
    case 'observation': return toMenu(observationBar(observationProps(held.observation, undefined, key, ctx), 'read', edit))
    case 'below': return below(held.scope, toMenu(observationBar(observationProps(held.observation, held.scope, key, ctx), 'read', edit)))
    case 'cause': return toMenu(causeBar(causeProps(held.cause, undefined, ctx), 'read', edit, page.ask))
    case 'causeBelow': return below(held.scope, toMenu(causeBar(causeProps(held.cause, held.scope, ctx), 'read', edit, page.ask)))
    case 'solution': {
      const props = solutionProps(held.solution, ctx)
      return toMenu(solutionBar(props, 'read', edit), solutionSteps(props, ctx.s))
    }
    case 'experiment': {
      const bar = experimentBar(experimentProps(held.experiment, ctx), 'read', edit)
      return toMenu([...bar.moves, ...bar.actions])
    }
    case 'solutionBelow': case 'experimentBelow': return below(held.scope, [])
  }
}

/** The steps a solution's gate offers in its reader: on to the next state, back, the decision and the plan. */
function solutionSteps(props: SolutionReaderProps, s: Translate): MenuAction[] {
  const { solution: one, gate } = props
  if (props.readOnly || one.state === 'dropped') return []
  const back = props.mayGoBack ? previousState(one.state) : undefined
  const state = (to: SolutionState) => s(PHASE_LABEL[to]).toLowerCase()
  const { onDecide, onStartPlan } = props
  const waitsOnDecision = gate?.items.some((item) => item.item === 'decisionAccepted' && !item.ok) && !one.decision
  return [
    ...(gate ? [{
      key: 'move', label: s('solution.moveOn', { state: state(gate.to) }), divider: true,
      disabled: openItems(gate).length > 0, onClick: () => props.onMove(gate.to),
    }] : []),
    ...(back ? [{ key: 'back', label: s('solution.moveBack', { state: state(back) }), divider: !gate, onClick: () => props.onMove(back) }] : []),
    ...(waitsOnDecision && onDecide ? [{ key: 'decide', label: s('solution.proposeDecision'), onClick: onDecide }] : []),
    ...(one.state === 'adopted' && !one.plan && onStartPlan ? [{ key: 'start-plan', label: s('solution.startPlan'), onClick: onStartPlan }] : []),
  ]
}
