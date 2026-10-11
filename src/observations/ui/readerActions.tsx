// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which actions a reader offers, in its own words (ADR-0032 §7): the labels
 * and the full sentences the mockup the owner approved said, one builder per
 * kind of record. The readers draw them with `ReaderActions`; what a press
 * does is the page's.
 *
 * What is offered follows the record: an observation of a scope below takes a
 * sighting and a cause there and is merged here, and is changed nowhere else
 * from here; a root cause takes a solution and never a deeper cause; the
 * scope that reads the scopes below links a cause of its own to a cause of
 * theirs, from either end.
 *
 * The pictures' right-click offers the same list (`toMenu`), in the same
 * order and the same words, so the two cannot drift apart.
 */
import type { Translate } from '../../i18n'
import {
  ArchiveIcon, BackIcon, CheckIcon, CloseIcon, CopyIcon, DeeperIcon, DocGlyph, ExperimentIcon, EyeIcon, GlobeIcon, LinkIcon,
  MakeCauseIcon, MakeRootIcon, MergeIcon, MinusIcon, PencilIcon, RootCauseIcon, ScopeIcon, SolutionIcon, TrashIcon, UndoIcon,
} from '../../widgets/icons'
import type { ExperimentOutcome } from '../solution'
import type { ReaderAction } from './ActionButton'
import type { MenuAction } from './PictureMenu'

export type Mode = 'read' | 'edit'

/** Edit, or back to reading: one button that says where it goes. */
export function modeAction(mode: Mode, switchMode: (next: Mode) => void, tip: string, s: Translate): ReaderAction {
  return mode === 'edit'
    ? { key: 'read', icon: <DocGlyph size={14} />, label: s('observation.read'), tip: s('observation.tipRead'), onClick: () => switchMode('read'), testId: 'reader-read' }
    : { key: 'edit', icon: <PencilIcon size={14} />, label: s('observation.edit'), tip, onClick: () => switchMode('edit'), testId: 'reader-edit' }
}

/** Delete, the last of the occasional ones and the one drawn in red. */
export function deleteAction(tip: string, onClick: () => void, s: Translate): ReaderAction {
  return { key: 'delete', icon: <TrashIcon size={14} />, label: s('observation.delete'), tip, onClick, occasional: true, danger: true, opensDialog: true }
}

/**
 * A reader's actions as the right-click offers them: the everyday ones and
 * Edit, then `steps` where the page has more for the record, then the
 * occasional ones with Delete last — each with "…" where a dialog or a
 * question follows.
 */
export function toMenu(actions: readonly ReaderAction[], steps: readonly MenuAction[] = []): MenuAction[] {
  const item = (one: ReaderAction): MenuAction => ({
    key: one.key, label: one.opensDialog ? `${one.label}…` : one.label, onClick: one.onClick,
    ...(one.danger ? { danger: true, divider: true } : {}),
  })
  const head = [...actions.filter((one) => !one.occasional).map(item), ...steps]
  const tail = actions.filter((one) => one.occasional).map(item)
  // A rule between the two, and above Delete; never one at the top.
  return [...head, ...tail.map((one, index) => (index === 0 ? { ...one, divider: head.length > 0 } : one))]
}

export function observationActions(o: {
  s: Translate
  /** Its own, standing and writable: the whole set. */
  own: boolean
  /** A sighting and a cause may be added: its own, or one below that may be written. */
  mayAdd: boolean
  /** Where a cause for it is written, for the tooltip. */
  scope: string
  mayMerge: boolean
  onSeenAgain: () => void
  onLink: () => void
  onMerge: () => void
  onArchive: () => void
  onDelete: () => void
}): ReaderAction[] {
  const { s } = o
  const seen: ReaderAction = {
    key: 'seen', icon: <EyeIcon size={14} />, label: s('observation.seenAgain'), tip: s('observation.tipSeen'),
    onClick: o.onSeenAgain, opensDialog: true, testId: 'observation-seen-again', guide: 'observation.seenAgain',
  }
  const cause: ReaderAction = {
    key: 'cause', icon: <LinkIcon size={14} />, label: s('observation.actCause'), tip: s('observation.tipCause', { scope: o.scope }),
    onClick: o.onLink, primary: true, opensDialog: true, testId: 'observation-cause', guide: 'observation.cause',
  }
  const merge: ReaderAction = {
    key: 'merge', icon: <MergeIcon size={14} />, label: s('observation.actMerge'), tip: s('observation.tipMerge'),
    onClick: o.onMerge, occasional: true, opensDialog: true, testId: 'observation-merge', guide: 'observation.merge',
  }
  const archive: ReaderAction = {
    key: 'archive', icon: <ArchiveIcon size={14} />, label: s('observation.actArchive'), tip: s('observation.tipArchive'),
    onClick: o.onArchive, occasional: true, opensDialog: true, testId: 'observation-archive',
  }
  return [
    ...(o.mayAdd ? [seen, cause] : []),
    ...(o.mayMerge ? [merge] : []),
    ...(o.own ? [archive, deleteAction(s('observation.tipDelete'), o.onDelete, s)] : []),
  ]
}

/** Restore, the one thing an archived observation or a dropped solution offers. */
export function restoreAction(tip: string, onClick: () => void, testId: string, s: Translate): ReaderAction {
  return { key: 'restore', icon: <UndoIcon size={14} />, label: s('observation.restore'), tip, onClick, primary: true, testId }
}

/** Open the page of the scope a record lives in. */
/**
 * *Copy link*, where a reader's bar ends (ADR-0033): offered read-only too,
 * since reading is what a link is for. It is not one of the bar's builders'
 * actions — the right-click adds its own, after what the reader offers.
 */
export function copyLinkAction(onClick: () => void, s: Translate): ReaderAction {
  return { key: 'copy-link', icon: <CopyIcon size={14} />, label: s('common.copyLink'), tip: s('observation.tipCopyLink'), onClick, testId: 'reader-copy-link' }
}

export function openScopeAction(scope: string, onClick: () => void, s: Translate): ReaderAction {
  return {
    key: 'open-scope', icon: <ScopeIcon size={14} />, label: s('observation.openScope', { scope }),
    tip: s('observation.tipOpenScope', { scope }), onClick, testId: 'reader-open-scope',
  }
}

/** The links a cause may be given from its reader (ADR-0032 §4). */
export type LinkMode = 'cause' | 'deeper' | 'root' | 'org' | 'local'

/** What the reader asked a link for: the mode, and the record, with its scope where it is not this one. */
export type LinkTarget = { mode: LinkMode; id: string; scope?: string }

export function causeActions(o: {
  s: Translate
  label: string
  /** The label it would have on the other side of the step: RC- for a cause, CA- for a root cause. */
  flipped: string
  root: boolean
  verified: boolean
  /** Links and the root step may be taken: its own and writable, or one below that may be written. */
  mayAdd: boolean
  /** Its own and writable: verify, edit, delete. */
  own: boolean
  /** The links this reader offers besides deeper and root: `org` for a cause below, `local` for one here. */
  across: readonly ('org' | 'local')[]
  /** The name of the scope reading the one below, for the Org cause tooltip. */
  here: string
  mayPropose: boolean
  /** Open the merge screen on it (ADR-0035); absent where it may not be merged. */
  onMerge?: () => void
  onLink: (mode: LinkMode) => void
  onRoot?: () => void
  onVerify: () => void
  onPropose: () => void
  onDelete: () => void
}): ReaderAction[] {
  const { s } = o
  const chain: ReaderAction[] = o.root ? [] : [
    { key: 'deeper', icon: <DeeperIcon size={14} />, label: s('observation.actDeeper'), tip: s('observation.tipDeeper'), onClick: () => o.onLink('deeper'), primary: true, opensDialog: true, testId: 'cause-deeper' },
    { key: 'root', icon: <RootCauseIcon size={14} />, label: s('observation.rootCause'), tip: s('observation.tipRoot'), onClick: () => o.onLink('root'), opensDialog: true, testId: 'cause-root-link' },
  ]
  const solution: ReaderAction[] = o.root && o.mayPropose
    ? [{ key: 'solution', icon: <SolutionIcon size={14} />, label: s('observation.actSolution'), tip: s('observation.tipSolution'), onClick: o.onPropose, primary: true, opensDialog: true, testId: 'cause-solution' }]
    : []
  const onRoot = o.onRoot
  const rootStep: ReaderAction[] = onRoot ? [{
    key: 'root-toggle', icon: o.root ? <MakeCauseIcon size={14} /> : <MakeRootIcon size={14} />,
    label: o.root ? s('observation.makeCause') : s('observation.makeRoot'),
    tip: s(o.root ? 'observation.tipMakeCause' : 'observation.tipMakeRoot', { label: o.label, next: o.flipped }),
    // It asks first, or says why it is refused.
    onClick: onRoot, opensDialog: true, testId: 'cause-root-toggle', guide: 'cause.root',
  }] : []
  const across: ReaderAction[] = o.across.map((mode) => (mode === 'org'
    ? { key: 'org', icon: <GlobeIcon size={14} />, label: s('observation.actOrg'), tip: s('observation.tipOrg', { scope: o.here }), onClick: () => o.onLink('org'), opensDialog: true, testId: 'cause-org' }
    : { key: 'local', icon: <ScopeIcon size={14} />, label: s('observation.actLocal'), tip: s('observation.tipLocal'), onClick: () => o.onLink('local'), opensDialog: true, testId: 'cause-local' }))
  const verify: ReaderAction = {
    key: 'verify', icon: <CheckIcon size={14} />, label: o.verified ? s('observation.unverify') : s('observation.actVerify'),
    // Verify asks what confirmed it where the body does not say; Unverify is a step.
    tip: o.verified ? s('observation.tipAssumed') : s('observation.tipVerify'), onClick: o.onVerify, opensDialog: !o.verified, testId: 'cause-verify',
  }
  const onMerge = o.onMerge
  const merge: ReaderAction[] = onMerge ? [{
    key: 'merge', icon: <MergeIcon size={14} />, label: s('observation.actMerge'), tip: s('observation.tipMergeCause'),
    onClick: onMerge, occasional: true, opensDialog: true, testId: 'cause-merge',
  }] : []
  return [
    ...(o.mayAdd ? [...chain, ...solution, ...rootStep] : solution),
    ...across,
    ...merge,
    ...(o.own ? [verify, deleteAction(s('observation.tipDeleteCause'), o.onDelete, s)] : []),
  ]
}

// --- solutions and experiments (ADR-0026) ----------------------------------------------------

export function solutionActions(o: {
  s: Translate
  canEdit: boolean
  mayAddress: boolean
  mayPlan: boolean
  mayDrop: boolean
  onAddress: () => void
  onPlanExperiment: () => void
  onDrop: () => void
  onDelete: () => void
}): ReaderAction[] {
  const { s } = o
  if (!o.canEdit) return []
  return [
    ...(o.mayAddress ? [{
      key: 'address', icon: <RootCauseIcon size={14} />, label: s('solution.actAddress'), tip: s('solution.tipAddress'),
      onClick: o.onAddress, primary: true, opensDialog: true, testId: 'solution-address',
    }] : []),
    ...(o.mayPlan ? [{
      key: 'experiment', icon: <ExperimentIcon size={14} />, label: s('solution.actExperiment'), tip: s('solution.tipExperiment'),
      onClick: o.onPlanExperiment, primary: !o.mayAddress, opensDialog: true, testId: 'solution-plan-experiment', guide: 'solution.planExperiment',
    }] : []),
    ...(o.mayDrop ? [{
      key: 'drop', icon: <CloseIcon size={14} />, label: s('solution.actDrop'), tip: s('solution.tipDrop'),
      onClick: o.onDrop, occasional: true, opensDialog: true, testId: 'solution-drop',
    }] : []),
    deleteAction(s('solution.tipDelete'), o.onDelete, s),
  ]
}

const MOVE_ICON = {
  planned: <BackIcon size={14} />, running: <ExperimentIcon size={14} />, confirmed: <CheckIcon size={14} />,
  refuted: <CloseIcon size={14} />, inconclusive: <MinusIcon size={14} />,
} as const
const MOVE_TIP = {
  planned: 'solution.tipToPlanned', confirmed: 'solution.tipConfirmed', refuted: 'solution.tipRefuted', inconclusive: 'solution.tipInconclusive',
} as const

/**
 * An experiment's moves from where it stands, each saying what it does: a
 * conclusion asks for the result first, and a reopen asks to be confirmed.
 */
export function experimentMoveButtons(o: {
  s: Translate
  from: ExperimentOutcome
  moves: readonly ExperimentOutcome[]
  label: (to: ExperimentOutcome) => string
  onMove: (to: ExperimentOutcome) => void
}): ReaderAction[] {
  const { s } = o
  return o.moves.map((to) => ({
    key: to, icon: to === 'running' && o.from !== 'planned' ? <UndoIcon size={14} /> : MOVE_ICON[to], label: o.label(to),
    tip: to === 'running' ? s(o.from === 'planned' ? 'solution.tipStart' : 'solution.tipReopen') : s(MOVE_TIP[to]),
    onClick: () => o.onMove(to), primary: to === 'running' && o.from === 'planned',
    opensDialog: to !== 'planned' && (to !== 'running' || o.from !== 'planned'), testId: `experiment-outcome-${to}`,
  }))
}
