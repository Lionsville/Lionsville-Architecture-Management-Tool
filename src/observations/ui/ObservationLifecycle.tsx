// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The moves on the observations page that ask a question first (ADR-0021 and
 * ADR-0026, amended 28 September 2026): seen again (on which day, with what
 * note), verified (what confirmed it, where the body does not say), an
 * experiment concluded (the result and the day it ended) or reopened (and
 * which proof that withdraws). The page hands in its lists and its commit;
 * this holds which question is open, asks it, and commits the answer
 * through the same rules the agent uses.
 *
 * Beside it, the small pieces the page reads off the same records: the words
 * for an experiment's moves, making a root cause and a cause again, the
 * register's empty line, the cause a new solution starts from, and the crumbs.
 */
import { useState, type ReactNode } from 'react'
import Button from '@mui/material/Button'
import type { Translate } from '../../i18n'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { causeEvidence, isArchived, isMerged, isRootCause, makeCause, makeRootCause, seenAgain, verifyCause } from '../observation'
import type { Cause, Observation } from '../observation'
import { concludeExperiment, experimentMovesFrom, formatSolutionNumber, isConcluded, reopenWithdraws } from '../solution'
import type { Experiment, ExperimentOutcome, Solution } from '../solution'
import { causesForProposal } from '../solutionGraph'
import { OUTCOME_LABEL } from '../observationScope'
import { SeenDialog, VerifyDialog } from './ObservationDialogs'
import { ConcludeDialog } from './SolutionDialogs'
import type { MenuAction } from './PictureMenu'

/** What the lifecycle reads of the page's lists. */
export type LifecycleLists = {
  observations: Observation[]
  causes: Cause[]
  solutions: Solution[]
  experiments: Experiment[]
}

export type Lifecycle = {
  /** Ask on which day it was seen again, and for a note. */
  seeAgain: (observation: Observation) => void
  /** Verified straight away where the body holds the evidence; otherwise ask what confirmed it. */
  verify: (cause: Cause) => void
  /** Move an experiment as `experimentMovesFrom` allows, asking first where a move needs it. */
  moveExperiment: (experiment: Experiment, to: ExperimentOutcome) => void
  /** The dialogs, to be drawn once in the page. */
  dialogs: ReactNode
}

export function useLifecycle(args: {
  lists: LifecycleLists
  commit: (next: Partial<LifecycleLists>) => void
  today: () => string
  nameOf: (id: string) => string
  s: Translate
}): Lifecycle {
  const { lists, commit, today, nameOf, s } = args
  const [seeing, setSeeing] = useState<Observation | undefined>(undefined)
  const [verifying, setVerifying] = useState<Cause | undefined>(undefined)
  const [concluding, setConcluding] = useState<{ experiment: Experiment; outcome: ExperimentOutcome } | undefined>(undefined)
  const [reopening, setReopening] = useState<Experiment | undefined>(undefined)

  const conclude = (id: string, outcome: ExperimentOutcome, fields: { result?: string; to?: string } = {}) => {
    const result = concludeExperiment(lists.experiments, id, outcome, today(), fields)
    if (result.ok) commit({ experiments: result.experiments })
  }
  const verify = (cause: Cause) => {
    if (causeEvidence(cause.body).complete) commit({ causes: verifyCause(lists.causes, cause.id, { date: today(), t: s }) })
    else setVerifying(cause)
  }
  // A conclusion asks for the result and the day first, and a reopen asks
  // to be confirmed; starting one and sending it back to planned are single steps.
  const moveExperiment = (one: Experiment, to: ExperimentOutcome) => {
    if (isConcluded(to)) setConcluding({ experiment: one, outcome: to })
    else if (isConcluded(one.outcome)) setReopening(one)
    else conclude(one.id, to)
  }
  const withdraws = reopening ? reopenWithdraws(lists, reopening.id).map((one) => formatSolutionNumber(one.number)) : []

  const dialogs = (
    <>
      <SeenDialog
        subject={seeing ? { id: seeing.id, label: nameOf(seeing.id), firstSeen: seeing.date } : undefined}
        today={today()}
        onCancel={() => setSeeing(undefined)}
        onConfirm={({ date, note }) => {
          if (seeing) commit({ observations: seenAgain(lists.observations, seeing.id, date, note) })
          setSeeing(undefined)
        }}
        s={s}
      />
      <VerifyDialog
        subject={verifying ? { id: verifying.id, label: nameOf(verifying.id) } : undefined}
        onCancel={() => setVerifying(undefined)}
        onConfirm={(confirmed) => {
          if (verifying) commit({ causes: verifyCause(lists.causes, verifying.id, { date: today(), t: s, confirmed }) })
          setVerifying(undefined)
        }}
        s={s}
      />
      <ConcludeDialog
        subject={concluding ? concludeSubject(concluding.experiment, concluding.outcome, nameOf) : undefined}
        today={today()}
        onCancel={() => setConcluding(undefined)}
        onConfirm={(fields) => {
          if (concluding) conclude(concluding.experiment.id, concluding.outcome, fields)
          setConcluding(undefined)
        }}
        s={s}
      />
      <ConfirmDialog
        open={Boolean(reopening)}
        title={reopening ? s('solution.reopenTitle', { name: nameOf(reopening.id) }) : ''}
        body={reopenBody(withdraws, s)}
        confirmLabel={s('solution.reopenConfirm')}
        cancelLabel={s('common.cancel')}
        onCancel={() => setReopening(undefined)}
        onConfirm={() => {
          if (reopening) conclude(reopening.id, 'running')
          setReopening(undefined)
        }}
      />
    </>
  )
  return { seeAgain: setSeeing, verify, moveExperiment, dialogs }
}

/** What the conclude dialog is told: the id and the name, the outcome, and what the record already holds. */
function concludeSubject(experiment: Experiment, outcome: ExperimentOutcome, nameOf: (id: string) => string) {
  return {
    id: experiment.id, label: nameOf(experiment.id), outcome,
    ...(experiment.result ? { result: experiment.result } : {}),
    ...(experiment.from ? { from: experiment.from } : {}),
  }
}

/** The reopen confirmation: what reopening does, and the proof it withdraws, named. */
function reopenBody(withdraws: readonly string[], s: Translate): string {
  if (!withdraws.length) return s('solution.reopenBody')
  const key = withdraws.length === 1 ? 'solution.reopenWithdraws' : 'solution.reopenWithdrawsMany'
  return `${s('solution.reopenBody')} ${s(key, { names: withdraws.join(', ') })}`
}

/**
 * Make a root cause, or a cause again (ADR-0032 §3), as the menu and the
 * reader offer it. The rules refuse and name what stands in the way; this
 * says that in the page's words, and the action is off while it stands. The
 * reader is offered nothing where nothing may be written.
 */
export function rootToggle(cause: Cause, deps: {
  lists: Pick<LifecycleLists, 'causes' | 'solutions'>
  commit: (next: Partial<LifecycleLists>) => void
  nameOf: (id: string) => string
  s: Translate
  readOnly: boolean
}): { action: MenuAction; reader: { onRoot?: () => void; rootRefused?: string } } {
  const { lists, commit, nameOf, s } = deps
  const change = isRootCause(cause) ? makeCause(lists.causes, cause.id, lists.solutions) : makeRootCause(lists.causes, cause.id)
  const refused = change.ok ? undefined : change.refusal === 'command.rootExplained'
    ? s('observation.refusedRootExplained', { names: change.causes.map((one) => nameOf(one.id)).join(', ') })
    : s('observation.refusedRootAddressed', { names: change.solutions.map((one) => nameOf(one.id)).join(', ') })
  const onRoot = () => { if (change.ok) commit({ causes: change.causes }) }
  return {
    action: {
      key: 'root', label: isRootCause(cause) ? s('observation.makeCause') : s('observation.makeRoot'),
      disabled: refused !== undefined, onClick: onRoot,
    },
    reader: deps.readOnly ? {} : { onRoot, ...(refused !== undefined ? { rootRefused: refused } : {}) },
  }
}

/** The words for a move of an experiment from where it stands: Start, Reopen…, Back to planned, Confirmed…. */
export function experimentMoveLabel(from: ExperimentOutcome, to: ExperimentOutcome, s: Translate): string {
  if (to === 'running') return from === 'planned' ? s('solution.moveStart') : s('solution.moveReopen')
  if (to === 'planned') return s('solution.moveToPlanned')
  return s('solution.moveConclude', { outcome: s(OUTCOME_LABEL[to]) })
}

/**
 * An experiment's moves as the right-click offers them: the outcome it has
 * now, checked and not a move, then the moves from there in the reader's words.
 */
export function experimentMoveActions(one: Experiment, s: Translate, onMove: (to: ExperimentOutcome) => void): MenuAction[] {
  return [
    { key: `outcome-${one.outcome}`, label: s(OUTCOME_LABEL[one.outcome]), checked: true, divider: true, disabled: true, onClick: () => {} },
    ...experimentMovesFrom(one.outcome).map((to) => ({
      key: `outcome-${to}`, checked: false, label: experimentMoveLabel(one.outcome, to, s), onClick: () => onMove(to),
    })),
  ]
}

/**
 * The line an empty register shows with no search typed: how many archived
 * records it is hiding and the way to show them, so an empty list does not
 * read as nothing ever seen — or, where nothing is hidden, that nothing was.
 */
export function EmptyRegister({ observations, showArchived, onShowArchived, s }: {
  observations: readonly Observation[]
  showArchived: boolean
  onShowArchived: () => void
  s: Translate
}) {
  const archived = observations.filter((one) => isArchived(one) && !isMerged(observations, one.id)).length
  if (archived === 0 || showArchived) return <>{s('observation.listEmpty')}</>
  return (
    <>
      {s('observation.listArchivedOnly', { count: archived })}
      <Button size="small" onClick={onShowArchived} sx={{ ml: 1 }} data-testid="observation-show-archived">
        {s('observation.showArchived')}
      </Button>
    </>
  )
}

/**
 * The cause a new solution is for, from what is selected: the root cause
 * being read, or the first root cause the solution being read addresses.
 * Only a cause the dialog offers — a root — is preselected.
 */
export function preselectedCause(
  causes: readonly Cause[],
  selected: { kind: string; cause?: Cause; solution?: Solution } | undefined,
): { causeId?: string } {
  const roots = causesForProposal(causes)
  const offered = (id: string) => roots.some((one) => one.id === id)
  if (selected?.cause && offered(selected.cause.id)) return { causeId: selected.cause.id }
  const first = selected?.solution?.addresses.find((address) => offered(address.id))
  return first ? { causeId: first.id } : {}
}

/**
 * Where the page is, root first: the scopes above as the bar names them —
 * the group's name where the host gives no crumbs — then this one. An empty
 * name, the root before anybody named it, is left out rather than drawn as a
 * crumb with nothing in it.
 */
export function crumbTrail(
  crumbs: readonly { name: string }[] | undefined, groupName: string, scopeName: string,
): string[] {
  return [...(crumbs ? crumbs.map((crumb) => crumb.name) : [groupName]), scopeName]
    .map((name) => name.trim())
    .filter(Boolean)
}
