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
  causeLabel, explainedBy, isRootCause, makeCause, makeRootCause, setArchived, unlinkCause, updateCause, updateObservation,
} from '../observation'
import type { Cause, CauseAbove, CauseLink, Observation, ScopeAnalysis } from '../observation'
import { nodeKey } from '../graph'
import {
  alternatives, experimentsFor, implementedOn, moveSolution, restoreSolution, seenSinceImplemented, solutionGate,
  solutionPhase, solutionQuestions, unaddressCause, underneath, updateExperiment, updateSolution, waiveExperiment,
} from '../solution'
import type { Experiment, ExperimentOutcome, Solution, SolutionContext, SolutionPlan, SolutionState } from '../solution'
import { experimentKey, solutionKey } from '../solutionGraph'
import { PHASE_LABEL } from '../observationScope'
import { rootToggle } from './ObservationLifecycle'
import { CauseReader, ObservationReader } from './Readers'
import type { MergedInto } from './Readers'
import { ExperimentReader, SolutionReader } from './SolutionReaders'
import type { LinkTarget } from './readerActions'
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
  | { kind: 'experiment'; experiment: Experiment }

export type DeleteKind = 'observation' | 'cause' | 'solution' | 'experiment'

/** Everything the reading pane reads and asks of the page. */
export type ReaderContext = {
  work: ObservationWork
  below: readonly ScopeAnalysis[]
  plans: readonly SolutionPlan[]
  context: SolutionContext
  decisions: readonly Adr[]
  transitions: readonly Transition[]
  /** The causes above that explain this scope's records, by the id explained. */
  explainedAbove?: ReadonlyMap<string, readonly CauseAbove[]>
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
    remove: (kind: DeleteKind, id: string) => void
    propose: (causeId: string) => void
    address: (solution: Solution) => void
    plan: (solution: Solution) => void
    drop: (solution: Solution) => void
  }
  mergedLabel: (observation: Observation) => MergedInto | undefined
  openKey: (key: string) => void
  /** Open the page of another scope, closing this one. */
  openScope?: (path: string) => void
  onDecide?: (solutionId: string) => void
  onStartPlan?: (solutionId: string) => void
  onOpenDecision?: (adrId: string) => void
  onOpenPlan?: (planId: string) => void
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
}

export function RecordReader({ selected, selectedKey, ctx }: { selected: Selected | undefined; selectedKey: string | undefined; ctx: ReaderContext }) {
  if (!selected) return <Box sx={{ p: 5, color: 'text.secondary' }}><Typography>{ctx.s('observation.noneSelected')}</Typography></Box>
  switch (selected.kind) {
    case 'solution': return solutionReader(selected.solution, ctx)
    case 'experiment': return experimentReader(selected.experiment, ctx)
    case 'cause': return causeReader(selected.cause, undefined, ctx)
    case 'causeBelow': return causeReader(selected.cause, selected.scope, ctx)
    case 'below': return observationReader(selected.observation, selected.scope, selectedKey, ctx)
    case 'observation': return observationReader(selected.observation, undefined, selectedKey, ctx)
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

function observationReader(one: Observation, scope: string | undefined, selectedKey: string | undefined, ctx: ReaderContext) {
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
  return (
    <ObservationReader
      key={selectedKey}
      observation={one}
      fromScope={scope !== undefined ? { path: scope, label: ctx.scopeLabel(scope) } : undefined}
      explainedBy={explainers.map(({ cause, scope: at }) => ({
        cause, link: cause.explains.find((held) => held.id === one.id)!, ...(at !== undefined ? { scope: at } : {}),
      }))}
      mergedInto={own ? ctx.mergedLabel(one) : undefined}
      readOnly={ctx.readOnly}
      mayChangeBelow={Boolean(forms.changeBelow)}
      today={ctx.today()}
      s={s}
      renderMarkdown={ctx.renderMarkdown}
      nameOf={ctx.nameOf}
      onUpdate={(patch) => ctx.commit({ observations: updateObservation(work.observations, one.id, patch) })}
      onSeenAgain={() => ctx.lifecycle.seeAgain(one, scope)}
      onArchive={() => ctx.ask.archive(one)}
      onRestore={() => ctx.commit({ observations: restoreObservation(work.observations, one.id, ctx.today()) })}
      onMerge={() => ctx.ask.merge(one, scope)}
      onLink={() => forms.openLink({ mode: 'cause', id: one.id, ...(scope !== undefined ? { scope } : {}) })}
      onUnlink={unlink}
      onDelete={() => ctx.ask.remove('observation', one.id)}
      onOpenScope={scope !== undefined && openScope ? () => openScope(scope) : undefined}
      onOpen={ctx.openKey}
      onAddImage={ctx.onAddImage}
      images={ctx.images}
    />
  )
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
function causeReader(cause: Cause, scope: string | undefined, ctx: ReaderContext) {
  const { s, work, forms } = ctx
  const own = scope === undefined
  const lists = listsOf(scope, ctx)
  // What explains it from another scope: one above explains one here, one here explains one below.
  const across: readonly CauseAbove[] = own
    ? ctx.explainedAbove?.get(cause.id) ?? []
    : work.causes.flatMap((held) => held.explains.filter((link) => link.id === cause.id && link.scope === scope)
      .map((link) => ({ scope: '', cause: held, strength: link.strength })))
  const toggle = rootToggle(cause, {
    lists, above: across, commit: ctx.commit, nameOf: (id) => ctx.nameOf(id, scope), scopeLabel: (path) => (own ? ctx.scopeLabel(path) : ctx.scopeName),
    s, readOnly: ctx.readOnly || (!own && !forms.changeBelow),
    ...(own ? {} : {
      apply: () => forms.changeBelow?.(scope, (held) => {
        const change = isRootCause(cause) ? makeCause(held.causes, cause.id, held.solutions) : makeRootCause(held.causes, cause.id, across)
        return change.ok ? { ...held, causes: change.causes } : undefined
      }),
    }),
  })
  const onCauses = (change: (list: Cause[]) => Cause[]) => (own
    ? ctx.commit({ causes: change(work.causes) })
    : forms.changeBelow?.(scope, (held) => ({ ...held, causes: change(held.causes) })))
  const hasBelow = ctx.below.some((one) => one.causes.some((held) => !isRootCause(held)))
  const solutions = own ? work.solutions.filter((one) => one.addresses.some((address) => address.id === cause.id)) : []
  const openScope = ctx.openScope
  return (
    <CauseReader
      key={nodeKey(cause.id, scope)}
      cause={cause}
      causes={lists.causes}
      {...(own ? {} : { fromScope: { label: ctx.scopeLabel(scope), ...(openScope ? { onOpenScope: () => openScope(scope) } : {}) } })}
      explainedFrom={own
        ? (ctx.explainedAbove?.get(cause.id) ?? []).map((one) => ({
          key: `${one.scope}#${one.cause.id}`, label: `${causeLabel(one.cause)} ${one.cause.title} (${ctx.scopeLabel(one.scope)})`,
          ...(openScope ? { open: () => openScope(one.scope) } : {}),
        }))
        : across.map((one) => ({
          key: one.cause.id, label: ctx.nameOf(one.cause.id),
          onRemove: () => ctx.commit({ causes: unlinkCause(work.causes, one.cause.id, cause.id, scope) }),
        }))}
      readOnly={ctx.readOnly}
      mayChangeBelow={Boolean(forms.changeBelow)}
      across={!forms.across ? [] : own ? (hasBelow ? ['local'] : []) : ['org']}
      here={ctx.scopeName}
      {...(!own && isRootCause(cause) ? { orgRefused: s('observation.orgRefused', { label: ctx.nameOf(cause.id, scope) }) } : {})}
      s={s}
      renderMarkdown={ctx.renderMarkdown}
      nameOf={ctx.nameOf}
      onUpdate={(patch) => ctx.commit({ causes: updateCause(work.causes, cause.id, patch) })}
      onVerify={() => ctx.lifecycle.verify(cause)}
      {...toggle.reader}
      onLink={(mode) => forms.openLink({ mode, id: cause.id, ...(scope !== undefined ? { scope } : {}) })}
      onUnlink={(target: CauseLink) => onCauses((list) => unlinkCause(list, cause.id, target.id, target.scope))}
      onUnlinkFrom={(causeId) => onCauses((list) => unlinkCause(list, causeId, cause.id))}
      onDelete={() => ctx.ask.remove('cause', cause.id)}
      onOpen={ctx.openKey}
      {...(own ? {
        solutions: solutions.map((one) => ({
          key: solutionKey(one.id), label: ctx.nameOf(one.id), note: s(PHASE_LABEL[solutionPhase(one, ctx.plans)]).toLowerCase(),
        })),
      } : {})}
      {...(ctx.readOnly || !own || !isRootCause(cause) ? {} : { onPropose: () => ctx.ask.propose(cause.id) })}
      onAddImage={ctx.onAddImage}
      images={ctx.images}
    />
  )
}

function solutionReader(one: Solution, ctx: ReaderContext) {
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
  return (
    <SolutionReader
      key={one.id}
      solution={one}
      phase={phase}
      gate={solutionGate(one, context)}
      mayGoBack={!locked}
      {...(locked && decision ? { reopenBy: label4('ADR', decision.number) } : {})}
      questions={solutionQuestions(one, context)}
      addresses={one.addresses.map((address) => {
        const cause = work.causes.find((held) => held.id === address.id)
        return { id: address.id, label: ctx.nameOf(address.id), strength: address.strength, root: cause ? isRootCause(cause) : false }
      })}
      experiments={experimentsFor(work.experiments, one.id).map((held) => ({ key: experimentKey(held.id), label: ctx.nameOf(held.id), outcome: held.outcome }))}
      alternatives={alternatives(one, work.solutions).map((held) => ({ key: solutionKey(held.id), label: ctx.nameOf(held.id), phase: solutionPhase(held, plans) }))}
      {...(decision ? { decision: { label: ctx.nameOf(decision.id), status: s(ADR_STATUS_KEY[decision.status]).toLowerCase() } } : {})}
      {...(plan ? { plan: { label: ctx.nameOf(plan.id), status: s(PLAN_STATUS_KEY[plan.status]).toLowerCase() } } : {})}
      {...(since ? {
        implemented: {
          since,
          observations: underneath(one, analysis).map((held) => {
            const seenOn = seenAgain.find((again) => again.id === held.id && again.scope === held.scope)?.date
            return { key: nodeKey(held.id, held.scope), label: ctx.nameOf(held.id, held.scope), ...(seenOn ? { seenOn } : {}) }
          }),
        },
      } : {})}
      readOnly={ctx.readOnly}
      s={s}
      renderMarkdown={ctx.renderMarkdown}
      nameOf={(id) => ctx.nameOf(id)}
      onUpdate={(patch) => ctx.commit({ solutions: updateSolution(work.solutions, one.id, patch) })}
      onMove={move}
      onWaive={(reason) => ctx.commit({ solutions: waiveExperiment(work.solutions, one.id, reason, ctx.today()) })}
      onAddress={() => ctx.ask.address(one)}
      onUnaddress={(causeId) => ctx.commit({ solutions: unaddressCause(work.solutions, one.id, causeId) })}
      onPlanExperiment={() => ctx.ask.plan(one)}
      {...(ctx.onDecide ? { onDecide: () => ctx.onDecide?.(one.id) } : {})}
      {...(ctx.onStartPlan ? { onStartPlan: () => ctx.onStartPlan?.(one.id) } : {})}
      {...(decision && ctx.onOpenDecision ? { onOpenDecision: () => ctx.onOpenDecision?.(decision.id) } : {})}
      {...(plan && ctx.onOpenPlan ? { onOpenPlan: () => ctx.onOpenPlan?.(plan.id) } : {})}
      onDrop={() => ctx.ask.drop(one)}
      onRestore={() => ctx.commit({ solutions: restoreSolution(work.solutions, one.id, ctx.today()) })}
      onDelete={() => ctx.ask.remove('solution', one.id)}
      onOpen={ctx.openKey}
      onAddImage={ctx.onAddImage}
      images={ctx.images}
    />
  )
}

function experimentReader(one: Experiment, ctx: ReaderContext) {
  return (
    <ExperimentReader
      key={one.id}
      experiment={one}
      tests={one.tests.map((id) => ({ key: solutionKey(id), label: ctx.nameOf(id) }))}
      readOnly={ctx.readOnly}
      s={ctx.s}
      renderMarkdown={ctx.renderMarkdown}
      onUpdate={(patch) => ctx.commit({ experiments: updateExperiment(ctx.work.experiments, one.id, patch) })}
      onMove={(to) => ctx.lifecycle.moveExperiment(one, to)}
      onDelete={() => ctx.ask.remove('experiment', one.id)}
      onOpen={ctx.openKey}
      onAddImage={ctx.onAddImage}
      images={ctx.images}
    />
  )
}
