// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the observations page wires and does not draw: every question it asks in a
 * dialog of its own, what a right-click on a map offers, and what the Solve map is
 * drawn from. Apart, so that the page reads as what stands on it.
 */
import { useMemo, type ReactNode } from 'react'
import type { Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import type { WindowChrome } from '../../platform/windowChrome'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { addressCause, seenSinceImplemented, setTestStrength, solutionQuestions, unaddressCause, untestSolution } from '../solution'
import type { Experiment, Solution, SolutionContext, SolutionPlan } from '../solution'
import { causesForProposal, experimentKey, solutionGraph, solutionKey } from '../solutionGraph'
import { linkCause } from '../observation'
import type { Analysis, Cause, CauseLink, Observation, ObservationBelow } from '../observation'
import type { FilterResult } from '../filter'
import { nodeKey } from '../graph'
import { QUESTION_LABEL, STRENGTH_LABEL } from '../observationScope'
import { ArchiveDialog } from './ObservationDialogs'
import { MergePage } from './MergePage'
import { MovePage } from './MovePage'
import type { useMerge } from './useMerge'
import type { usePageMove } from './useMove'
import { recordMenu } from './PageReaders'
import type { DeleteKind, ReaderContext, Selected } from './PageReaders'
import type { MenuAction, PictureTarget } from './PictureMenu'
import type { CausePanel } from './Readers'
import { AddressDialog, DropDialog, NewExperimentDialog, NewSolutionDialog, WaiveDialog } from './SolutionDialogs'
import type { NewSolution } from './SolutionDialogs'
import { NotedDialog } from './NotedDialog'

const DELETE_TITLE = {
  observation: 'observation.deleteTitle', cause: 'observation.deleteCauseTitle',
  solution: 'solution.deleteTitle', experiment: 'solution.deleteTitle',
} as const
const DELETE_BODY = {
  observation: 'observation.deleteBody', cause: 'observation.deleteCauseBody',
  solution: 'solution.deleteBody', experiment: 'solution.deleteExperimentBody',
} as const

/** The two questions of why a solution asks: why drop it, and why it needs no experiment. */
export type SolutionAsk = 'drop' | 'waive'

type Subject = { id: string; label: string } | undefined

export function RecordDialogs(props: {
  noteLabel: string | undefined
  onNoteCancel: () => void
  onNote: (reason: string) => void
  archiving: Subject
  onArchiveCancel: () => void
  onArchive: (reason: string) => void
  merging: ReturnType<typeof useMerge>
  moving: ReturnType<typeof usePageMove>
  windowChrome?: WindowChrome | undefined
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  proposing: { causeId?: string } | undefined
  causes: readonly Cause[]
  onProposeCancel: () => void
  onPropose: (fields: NewSolution) => void
  addressing: Subject
  addressCandidates: readonly Cause[]
  onAddressCancel: () => void
  onAddress: (choice: { causeId: string; strength: CauseLink['strength'] }) => void
  planning: Subject
  onPlanCancel: () => void
  onPlan: (fields: { title: string; hypothesis: string; measure: string }) => void
  /** A solution being dropped, or its experiment waived. */
  asking: { id: string; label: string; what: SolutionAsk } | undefined
  onAskCancel: () => void
  onAsk: (reason: string) => void
  deleting: { kind: DeleteKind; id: string; label: string } | undefined
  onDeleteCancel: () => void
  onDelete: () => void
  s: Translate
}) {
  const { s, merging, moving, deleting } = props
  return (
    <>
      <ArchiveDialog subject={props.archiving} onCancel={props.onArchiveCancel} onConfirm={props.onArchive} s={s} />
      <NotedDialog label={props.noteLabel} onCancel={props.onNoteCancel} onConfirm={props.onNote} s={s} />
      <MergePage state={merging.state} note={merging.note} onNoteClose={merging.clearNote} s={s} renderMarkdown={props.renderMarkdown} windowChrome={props.windowChrome} />
      <MovePage state={moving.state} note={moving.note} onNoteClose={moving.clearNote} s={s} windowChrome={props.windowChrome} />
      <NewSolutionDialog
        open={Boolean(props.proposing)} causes={causesForProposal(props.causes)} causeId={props.proposing?.causeId}
        onCancel={props.onProposeCancel} onCreate={props.onPropose} renderMarkdown={props.renderMarkdown} s={s}
      />
      <AddressDialog subject={props.addressing} candidates={props.addressCandidates} onCancel={props.onAddressCancel} onConfirm={props.onAddress} s={s} />
      <NewExperimentDialog subject={props.planning} onCancel={props.onPlanCancel} onCreate={props.onPlan} s={s} />
      <DropDialog subject={props.asking?.what === 'drop' ? props.asking : undefined} onCancel={props.onAskCancel} onConfirm={props.onAsk} s={s} />
      <WaiveDialog subject={props.asking?.what === 'waive' ? props.asking : undefined} onCancel={props.onAskCancel} onConfirm={props.onAsk} s={s} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={deleting ? s(DELETE_TITLE[deleting.kind], { name: deleting.label }) : ''}
        body={deleting ? s(DELETE_BODY[deleting.kind]) : ''}
        confirmLabel={s('observation.delete')}
        cancelLabel={s('common.cancel')}
        onCancel={props.onDeleteCancel}
        onConfirm={props.onDelete}
      />
    </>
  )
}

/**
 * What the menu offers: the reader's own actions for a record, in its own
 * words, and for a line the one thing a line is — how strong the link is,
 * or no link at all. Read-only offers nothing, so the menu does not open.
 */
export function pictureMenuActions(target: PictureTarget, d: {
  readOnly: boolean
  s: Translate
  commit: ReaderContext['commit']
  analysis: Analysis
  causes: readonly Cause[]
  solutions: readonly Solution[]
  experiments: readonly Experiment[]
  resolve: (key: string) => Selected | undefined
  readerCtx: ReaderContext
  edit: (key: string) => void
  ask: (key: string, panel: CausePanel) => void
  unlink: (causeId: string, target: Pick<CauseLink, 'id' | 'scope'>) => void
}): MenuAction[] {
  const { s, commit, analysis, causes, solutions, experiments } = d
  if (d.readOnly) return []
  const strengths = (current: CauseLink['strength'], choose: (strength: CauseLink['strength']) => void): MenuAction[] => (
    (['strong', 'normal', 'weak'] as const).map((strength) => ({
      key: `strength-${strength}`, label: s(STRENGTH_LABEL[strength]), checked: strength === current,
      onClick: () => { if (strength !== current) choose(strength) },
    }))
  )
  const unlinkEntry = (onClick: () => void): MenuAction => ({ key: 'unlink', label: s('observation.unlink'), divider: true, danger: true, onClick })
  if (target.kind === 'explains') {
    const link = { id: target.id, ...(target.scope !== undefined ? { scope: target.scope } : {}) }
    return [
      ...strengths(target.strength, (strength) => commit({ ...analysis, causes: linkCause(causes, target.causeId, { ...link, strength }) })),
      unlinkEntry(() => d.unlink(target.causeId, link)),
    ]
  }
  if (target.kind === 'addresses') {
    return [
      ...strengths(target.strength, (strength) => commit({ solutions: addressCause(solutions, target.solutionId, { id: target.causeId, strength }) })),
      unlinkEntry(() => commit({ solutions: unaddressCause(solutions, target.solutionId, target.causeId) })),
    ]
  }
  if (target.kind === 'tests') {
    return [
      ...strengths(target.strength, (strength) => commit({ experiments: setTestStrength(experiments, target.experimentId, target.solutionId, strength) })),
      unlinkEntry(() => commit({ experiments: untestSolution(experiments, target.experimentId, target.solutionId) })),
    ]
  }
  const { key } = target
  const held = d.resolve(key)
  if (!held) return []
  return recordMenu(held, key, d.readerCtx, { edit: () => d.edit(key), ask: (panel) => d.ask(key, panel) })
}

/** What the Solve map draws, what the filters left of it as Why does, and what it flags. */
export function useSolveMap(d: {
  observations: readonly Observation[]
  causes: readonly Cause[]
  solutions: readonly Solution[]
  experiments: readonly Experiment[]
  plans: readonly SolutionPlan[]
  belowLinked: readonly ObservationBelow[]
  belowAll: readonly ObservationBelow[]
  analysis: Analysis
  context: SolutionContext
  orphanRoots: readonly Cause[]
  wholeChain: boolean
  showDropped: boolean
  result: FilterResult
  nameOf: (id: string, scope?: string) => string
  s: Translate
}) {
  const { observations, causes, solutions, experiments, plans, belowLinked, belowAll, analysis, context, orphanRoots, wholeChain, showDropped, nameOf, s } = d
  const { visible, filtering } = d.result
  const graph = useMemo(() => {
    const keep = <T,>(list: readonly T[], key: (one: T) => string) => (filtering ? list.filter((one) => visible.has(key(one))) : [...list])
    return solutionGraph(
      { observations: keep(observations, (one) => one.id), causes: keep(causes, (one) => one.id) },
      { solutions: keep(solutions, (one) => solutionKey(one.id)), experiments: keep(experiments, (one) => experimentKey(one.id)) },
      plans,
      { below: keep(belowLinked, (one) => nodeKey(one.observation.id, one.scope)), wholeChain, showDropped },
    )
  }, [observations, causes, solutions, experiments, plans, belowLinked, wholeChain, showDropped, visible, filtering])
  const flags = useMemo(() => {
    const found = new Map<string, { text: string; strong?: boolean }>()
    for (const cause of orphanRoots) found.set(cause.id, { text: s('solution.flagNoSolution') })
    for (const one of solutions) {
      const seenAgain = seenSinceImplemented(one, analysis, belowAll, plans)
      const questions = solutionQuestions(one, context)
      if (seenAgain.length) found.set(solutionKey(one.id), { text: s('solution.findingSeenAgain', { names: seenAgain.map((held) => nameOf(held.id, held.scope)).join(', ') }), strong: true })
      else if (questions.length) found.set(solutionKey(one.id), { text: questions.map((question) => s(QUESTION_LABEL[question])).join(' ') })
    }
    return found
  }, [orphanRoots, solutions, analysis, belowAll, plans, context, s, nameOf])
  return { graph, flags }
}
