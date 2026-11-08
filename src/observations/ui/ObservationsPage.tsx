// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Everything a scope observed in one place, and the analysis the team makes of it
 * (ADR-0021), as the chain it is: Seen, Why, Solve, Did it work. The analysis went
 * unused while the screens followed how it was stored: recording ended the journey,
 * what waited was off screen, and asking why was a dialog that wanted the ending
 * first. So what waits is first, each record says its next question, and a group can
 * be asked about at once.
 *
 * A row is the item and nothing else. Selecting one opens the large preview over the
 * list, by the record's own address; a new observation and the ladder are panels
 * beside the list, which stays in view; Why and Solve are also maps, with the record
 * in a panel beside them; a record is edited in a full window (`RecordEditor`).
 *
 * **One list per scope, read upward.** This scope's observations and causes
 * are two arrays on its model and go back whole (`onChange`), so the caller
 * commits one model change. The analysis of every scope below is read here
 * off the tree (ADR-0032 §1), with nothing shared first; an observation of
 * one may be folded into an observation here, and is otherwise **edited
 * where it lives**, the rule every record follows. A change to a scope
 * below made from here is that scope's step (`onChangeBelow`).
 *
 * The page never writes anywhere itself.
 */
import type { Citation } from '../../model/citable'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import { LanguageProvider } from '../../i18n'
import type { Language, StringKey, Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import type { HostModel } from '../../model/hostModel'
import type { Comment } from '../../model/comment'
import { hasMap, stageOfTab } from '../tabs'
import type { ChainLens, ObservationStage, ObservationTab } from '../tabs'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { List } from '../../widgets/kit/List'
import type { ListGroup } from '../../widgets/kit/List'
import { Segmented } from '../../widgets/kit/Segmented'
import { Tabs } from '../../widgets/kit/Tabs'
import { PageBack, PageClose, useBackToReading } from '../../widgets/PageClose'
import { PageDialog } from '../../widgets/PageDialog'
import { SeamResizer } from '../../widgets/SeamResizer'
import { useSeamWidth, useSeamWidthsOf } from '../../widgets/useSeamWidth'
import { useLocatedIn } from '../../widgets/useLocated'
import type { DocumentImages } from '../../documentation/ui/MarkdownEditor'
import type { MakeId } from '../../model/keys'
import type { CommandRefusal } from '../../model/reducer'
import { usePersonNames } from '../../people/ui/names'
import {
  absorbedBy, causeLabel, explainedBy, formatObservationNumber, isArchived, isCauseMerged, isMerged, isMoved, isRootCause, movedTo,
  isScopeBelow, linkCause, linkRefusal, liveObservations, observationsBelow, removeCause, removeObservation,
  rootCauses, setArchived, setNoted, updateCause, updateObservation, unlinkCause,
} from '../observation'
import type {
  Analysis, Cause, CauseAbove, CauseLink, Observation, ObservationBelow, ScopeAnalysis,
} from '../observation'
import type { SavedFilters } from '../filter'
import { FAR_BELOW, nodeKey, openEnds, pictureLinks } from '../graph'
import type { PictureCounts } from '../graph'
import { CHAINS_ALL, CHAINS_FIRST, chainsOf, mapWindow } from '../chain'
import { AnalysisPicture, PictureLegend } from './AnalysisPicture'
import { useMerge } from './useMerge'
import { usePageMove } from './useMove'
import { mergedTo, recordName } from '../mergeScreen'
import type { MergeKind } from '../merge'
import { formatDay } from '../../i18n/dates'
import { plural } from '../../i18n/strings'
import { inSentence } from '../../i18n/languages'
import { preselectedCause, useLifecycle } from './ObservationLifecycle'
import { PictureMenu } from './PictureMenu'
import type { MenuAction, PictureTarget } from './PictureMenu'
import { BulkActions, ChainEmpty, ChainFilter, HiddenBar, MapWindowBar, ResultsSaid } from './ChainBars'
import { RecordDialogs, pictureMenuActions, useSolveMap } from './ChainWiring'
import { hiddenRows, observationColumns, recordsBelow, stageGroups } from './ChainLists'
import type { StageData } from './ChainLists'
import type { MergedInto, CausePanel } from './Readers'
import { crossScope, resolveSelected } from './PageReaders'
import type { DeleteKind, ReaderContext, Selected } from './PageReaders'
import { RecordFull, RecordPanel, RecordPreview } from './RecordViews'
import { RecordEditor } from './RecordEditor'
import type { RecordEditing } from './RecordEditor'
import { useAnalysisForms } from './useAnalysisForms'
import {
  addressCause, dropSolution, forgetCause, formatExperimentNumber, formatSolutionNumber, newExperiment,
  newSolution, nextExperimentNumber, nextSolutionNumber, planExperiment, removeExperiment, removeSolution,
  rootsWithoutSolution, solutionPhase, solutionPlanOf,
  updateExperiment, updateSolution,
} from '../solution'
import type { Solution, SolutionContext, SolutionPhase, SolutionPlan, SolutionWork } from '../solution'
import { causesForProposal, experimentKey, solutionKey } from '../solutionGraph'
import { PHASE_LABEL } from '../observationScope'
import { SolutionLegend, SolutionPicture } from './SolutionPicture'
import type { NewSolution } from './SolutionDialogs'
import { usePictureFilters, usePictureView } from './usePictureFilters'
import './Chain.css'

/** Everything the page hands back: the analysis and what is being done about it. */
export type ObservationWork = Analysis & SolutionWork & {
  /**
   * The scope's comments (ADR-0037), handed back where a change moves a
   * thread — a merge carries an absorbed record's to its survivor. Absent,
   * the comments are as they were.
   */
  comments?: Comment[]
  /** The scope's citations of principles (ADR-0041 §7), handed back where a merge or a move carries a record's. Absent, as they were. */
  citations?: readonly Citation[]
}

/**
 * A change to the analysis of a scope below, landed as that scope's step
 * (ADR-0032 §2). `change` is handed its four lists as they stand and answers
 * what they become, or nothing for no change; it may be called more than
 * once, over a scope that moved in between, so it must do nothing but answer.
 */
export type ChangeBelow = (
  path: string, change: (work: ObservationWork) => ObservationWork | undefined,
) => Promise<ChangedBelow>

/**
 * Where a change below went: landed, refused by that scope's writer with its
 * key, refused because the person may read that scope and not change it
 * (`shell.scopeReadOnly`, from a source that decides who may write), or not
 * made — nothing may be written from here (`readOnly`), no such scope, or
 * nothing to change.
 */
export type ChangedBelow =
  | { ok: true }
  | { ok: false; reason: CommandRefusal | 'shell.scopeReadOnly' | 'readOnly' | 'gone' | 'unchanged' }

/**
 * A change to the analysis of several scopes as one (ADR-0035 §5): `paths`
 * are read — the open scope from this page, as it stands — and `change` is
 * handed each one's four lists and answers what those it writes become, or a
 * refusal of its own (`{ refused }`), or nothing. It may be called more than
 * once, over a scope that moved in between, so it must do nothing but answer.
 */
export type ChangeAcross = (
  paths: readonly string[],
  change: (held: ReadonlyMap<string, ObservationWork>) => ReadonlyMap<string, ObservationWork> | { refused: string } | undefined,
) => Promise<ChangedAcross>

/**
 * Where a change across went: landed on `changed` (the open scope among them
 * where it was written, as a step on this page's stack with a barrier when
 * others were written too; `unsaved` where that step is not written yet), or
 * refused — by `change` itself, by a writer with its key, by a scope the
 * person may read and not change (`scope` names it), or not made: nothing may
 * be written from here, a scope gone, or nothing to change. `partial` is the
 * one that should never be met: the other scopes landed and this page's
 * session then refused its own part.
 */
export type ChangedAcross =
  | { ok: true; changed: readonly string[]; unsaved?: true }
  | { ok: false; reason: 'refused'; refused: string }
  | { ok: false; reason: 'shell.scopeReadOnly'; scope?: string }
  | { ok: false; reason: 'partial'; changed: readonly string[] }
  | { ok: false; reason: CommandRefusal | 'shell.scopeMoved' | 'readOnly' | 'gone' | 'unchanged' }

const label4 = (prefix: string, number: number) => `${prefix}-${String(Math.max(0, Math.trunc(number))).padStart(4, '0')}`

export type ObservationsPageProps = {
  open: boolean
  onClose: () => void
  model: HostModel
  groupName: string
  /**
   * Every scope above this one, root first, named — the bar's crumbs. Drawn
   * before this scope's name; where absent, the group's name stands in, and
   * a name that is empty is left out rather than drawn as an empty crumb.
   */
  crumbs?: readonly { path: string; name: string }[]
  /**
   * This scope's path: the rules about links across the tree (ADR-0032 §4)
   * read it, and the filters name this scope by it. The root where absent.
   */
  path?: string
  /** The analysis of every scope below this one (ADR-0032 §1), off the tree. */
  below?: readonly ScopeAnalysis[]
  /**
   * The analysis of every scope the person can read — above, below and
   * beside — off the tree: what the merge screen searches across scopes
   * (ADR-0035 §2). Where absent, it searches this scope and those below.
   */
  tree?: readonly ScopeAnalysis[]
  /**
   * Every scope the person can read, by path, those with no analysis yet
   * included: where the move screen offers to move an observation to
   * (ADR-0038 §5). Where absent, the scopes of `tree`.
   */
  scopes?: readonly string[]
  /**
   * May the person change the scope at this path? A record of a scope they
   * may only read is listed by the merge screen and cannot be picked
   * (ADR-0035 §2). Where absent, every scope is as writable as this one.
   */
  writable?: (path: string) => boolean
  /** The causes of the scopes above that explain this scope's records, by the id explained (ADR-0032 §4). */
  explainedAbove?: ReadonlyMap<string, readonly CauseAbove[]>
  /**
   * The same for a scope below, by its path: the causes of every scope over
   * it, this one included, that explain its records. What makes a cause
   * below explained from a scope the picture does not draw.
   */
  explainedAboveOf?: (path: string) => ReadonlyMap<string, readonly CauseAbove[]>
  /**
   * Land a change on the analysis of a scope below, as that scope's step
   * (ADR-0032 §2): in its Activity list and undone there, never on this
   * page's stack. Absent where the host cannot write another scope.
   */
  onChangeBelow?: ChangeBelow
  /**
   * Land a change on several scopes as one — a merge across the tree
   * (ADR-0035 §5): the other scopes in one apply, this one as a step here.
   * Absent where nothing may be written from here.
   */
  onChangeAcross?: ChangeAcross
  /** What a scope below is called, for the headings; the path where the host cannot say. */
  scopeLabel?: (path: string) => string
  /**
   * What a scope is called where one is picked: its path from the
   * organisation down, so two scopes of one name are told apart — in the new
   * observation's *Scope* and the merge's rows and search. Absent, `scopeLabel`.
   */
  scopeTrail?: (path: string) => string
  /** The filters this person saved, offered in every scope (ADR-0032 §8); absent, nothing can be saved. */
  savedFilters?: SavedFilters
  /** This scope's own observations that a scope above folded into one of its own, by id. */
  absorbedAbove?: ReadonlyMap<string, { by: string; into: string; intoTitle: string; date: string }>
  /**
   * Open the observations page of another scope: the one an observation from
   * below lives in, or the one above that one of these was merged into — on
   * that record, where an id is given.
   */
  onOpenScope?: (path: string, id?: string) => void
  onChange: (next: ObservationWork) => void
  /**
   * Propose the decision record for a solution (ADR-0026): the host writes
   * the record and the link in one step, because a record of the Decisions
   * page is not this page's to write.
   */
  onDecide?: (solutionId: string) => void
  /** Start the plan that builds an adopted solution, likewise. */
  onStartPlan?: (solutionId: string) => void
  onOpenDecision?: (adrId: string) => void
  onOpenPlan?: (planId: string) => void
  /**
   * Open straight onto this record: its preview over the list, or brought on screen
   * and ringed for a moment in the map, with its panel (ADR-0033, amended).
   */
  initialId?: string
  /**
   * Open on this stage, and on this lens where the tab names one: with `initialId`
   * too, the tab named wins over the one the record would open on, and the record is
   * selected there.
   */
  initialTab?: ObservationTab
  /** The request's own number: the same record asked for again is a new one, and lands again. */
  initialNonce?: number
  /**
   * Which record is on show, by its id, whenever that changes, with the
   * number of the request the page has landed on and the tab that is up:
   * what the agent is told the page is on.
   */
  onShown?: (key: string | undefined, nonce: number | undefined, tab: Tab) => void
  /**
   * Copy a link to a record and show it (ADR-0033, amended 11 October 2026):
   * the record by its own id, in the scope that keeps it where that is one
   * below, on the tab it was copied from where it is an observation or a
   * cause. Offered read-only too; absent, nothing offers one.
   */
  onCopyLink?: (to: RecordLink) => void
  readOnly?: boolean
  s: Translate
  language: Language
  makeId: MakeId
  /** `yyyy-mm-dd`. Injected: a clock inside a component cannot be tested. */
  today: () => string
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
  windowChrome?: WindowChrome
}

/** The page's stages, in the words a destination names them by (`agent/screen.ts`). */
type Tab = ObservationStage

/** How wide the panel beside a map is, in pixels: dragged at the seam, put back with a double-click. */
const READER = { default: 480, min: 320, max: 900 } as const

/** Each map's panel at its own width until it is dragged. */
const READER_WIDTHS = { analysis: READER.default, solutions: READER.default }

/** A lens as the number it is kept by: a seam keeps a positive number and reads anything else as nothing kept. */
const LENS_KEPT = { map: 1, list: 2 } as const

/**
 * List or map, per stage. Why opens as its map, since that is where a chain is seen;
 * Solve as its list, the plain menu of what has no answer and what is being done.
 * A press is the person's and is kept. An address that names a lens opens it for this
 * visit and keeps nothing: following one link to a map must not change how the tab
 * opens from then on. Solve's seam is named anew in 4.0.0, because the one before it
 * could hold a lens no person chose.
 */
function useChainLens(stage: Tab) {
  const [whyKept, keepWhy] = useSeamWidth('observations.lens.analysis', LENS_KEPT.map)
  const [solveKept, keepSolve] = useSeamWidth('observations.lens.solve', LENS_KEPT.list)
  const [named, setNamed] = useState<{ stage: Tab; lens: ChainLens } | undefined>(undefined)
  const kept: ChainLens = (stage === 'analysis' ? whyKept : solveKept) === LENS_KEPT.map ? 'map' : 'list'
  const lens: ChainLens = !hasMap(stage) ? 'list' : named?.stage === stage ? named.lens : kept
  const press = (next: ChainLens) => {
    setNamed(undefined)
    if (stage === 'analysis') keepWhy(LENS_KEPT[next])
    else keepSolve(LENS_KEPT[next])
  }
  return { lens, press, name: setNamed }
}

/**
 * The id a selection is told by: a record's own, as the lists and the agent
 * know it, rather than the key the picture tells a solution or an experiment
 * apart by. One shared from below keeps its key, which names its scope;
 * a key that names nothing any more is nothing on show.
 */
function recordIdOf(selected: Selected | undefined, key: string | undefined): string | undefined {
  if (!selected) return undefined
  return selected.kind === 'solution' ? selected.solution.id : selected.kind === 'experiment' ? selected.experiment.id : key
}

/**
 * Where an opening lands: on nothing, unless asked for a record, since a preview
 * opens only by selecting a row. A record names the stage it belongs to, by its key
 * or its bare id (ADR-0026). A tab asked for wins over all of that, and the record is
 * selected on it.
 */
function landingFor(id: string | undefined, work: ObservationWork, asked?: Tab, below: readonly ScopeAnalysis[] = []): { tab?: Tab; key: string | undefined } {
  const on = (tab: Tab | undefined, key: string | undefined) => ({ ...((asked ?? tab) ? { tab: asked ?? tab } : {}), key })
  if (!id) return on(undefined, undefined)
  const solution = work.solutions.find((one) => id === one.id || id === solutionKey(one.id))
  if (solution) return on('solutions', solutionKey(solution.id))
  const experiment = work.experiments.find((one) => id === one.id || id === experimentKey(one.id))
  if (experiment) return on('solutions', experimentKey(experiment.id))
  const held = resolveSelected(id, work, below)
  return on(held?.kind === 'cause' || held?.kind === 'causeBelow' ? 'analysis' : held?.kind === 'solutionBelow' || held?.kind === 'experimentBelow' ? 'solutions' : 'register', id)
}

/**
 * Each opening lands once (`landingFor`), and each request again, by its
 * number, so the same record asked for again after the person moved off it
 * lands again. The records are read through a ref, so one changing while the
 * page is up does not reset the selection. What is on show goes to
 * `onShown` whenever it changes, with the number of the request it landed on
 * — what the agent is told the page is on.
 *
 * A record asked for is also located (ADR-0033, amended 11 October 2026):
 * brought on screen and ringed for a moment, in the list or the picture,
 * wherever it carries its key as `data-key`. What comes back is the ref for
 * where to look and the ring for its `sx`.
 */
function useOpening(deps: {
  open: boolean
  request: { id: string | undefined; nonce: number | undefined; tab: Tab | undefined }
  work: ObservationWork
  below: readonly ScopeAnalysis[]
  shown: string | undefined
  /** The tab that is up, said with what is on show. */
  tab: Tab
  land: (at: { tab?: Tab; key: string | undefined }) => void
  /** Select a record by key, as the page does: what locating one selects with. */
  select: (key: string) => void
  onShown: ((id: string | undefined, nonce: number | undefined, tab: Tab) => void) | undefined
}) {
  const { open, shown, tab: up } = deps
  const { id, nonce, tab } = deps.request
  const [landed, setLanded] = useState<number | undefined>(undefined)
  const located = useLocatedIn(deps.select, 'data-key')
  const latest = useRef({ ...deps, locate: located.locate })
  latest.current = { ...deps, locate: located.locate }
  useEffect(() => {
    if (!open) return
    const at = landingFor(id, latest.current.work, tab, latest.current.below)
    latest.current.land(at)
    if (id !== undefined && at.key !== undefined) latest.current.locate(at.key)
    setLanded(nonce)
  }, [open, id, nonce, tab])
  useEffect(() => {
    if (open) latest.current.onShown?.(shown, landed, up)
  }, [open, shown, landed, up])
  return { ref: located.ref, ring: located.ring }
}

/** A record a link names: its own id, the scope below that keeps it where it is not this one's, and the tab. */
export type RecordLink = { readonly id: string; readonly scope?: string; readonly tab?: ObservationTab }

/**
 * The link to a record on show: an observation or a cause on the tab it was
 * copied from, a solution or an experiment on theirs, which the page finds by
 * itself; one of a scope below in that scope, where its id means something.
 */
export function recordLinkOf(selected: Selected, tab: Tab): RecordLink {
  switch (selected.kind) {
    case 'observation': return { id: selected.observation.id, tab }
    case 'cause': return { id: selected.cause.id, tab }
    case 'solution': return { id: selected.solution.id }
    case 'experiment': return { id: selected.experiment.id }
    case 'below': return { id: selected.observation.id, scope: selected.scope, tab }
    case 'causeBelow': return { id: selected.cause.id, scope: selected.scope, tab }
    case 'solutionBelow': return { id: selected.solution.id, scope: selected.scope }
    case 'experimentBelow': return { id: selected.experiment.id, scope: selected.scope }
  }
}

/** *Copy link* for a record on show, where the host offers one. */
function copyLinkOf(props: ObservationsPageProps, tab: Tab): ((selected: Selected) => void) | undefined {
  const { onCopyLink } = props
  return onCopyLink && ((selected) => onCopyLink(recordLinkOf(selected, tab)))
}

/**
 * A node's menu with *Copy link* last, read-only included — reading is what
 * a link is for. A line has no link of its own.
 */
function withCopyLink(
  actions: MenuAction[], target: PictureTarget, resolve: (key: string) => Selected | undefined,
  copy: ((selected: Selected) => void) | undefined, s: Translate,
): MenuAction[] {
  const held = target.kind === 'node' ? resolve(target.key) : undefined
  if (!copy || !held) return actions
  return [...actions, { key: 'copy-link', label: s('common.copyLink'), divider: actions.length > 0, onClick: () => copy(held) }]
}

/** What a merged record's note reads, and the ways to where it went. */
type Away = {
  /** Every scope read, this one as the page holds it. */
  everywhere: readonly ScopeAnalysis[]
  here: string
  scopeLabel: (path: string) => string
  select: (key: string) => void
  openScope?: (path: string, id: string) => void
}

/**
 * Where a record went when it was merged (ADR-0035 §4): the survivor its
 * history names, or the one of its scope that says it absorbed it — selected
 * here or below, or opened on the page of the scope that keeps it.
 */
function mergedAway(kind: MergeKind, id: string, scope: string, from: Away): MergedInto | undefined {
  const lists = from.everywhere.find((one) => one.scope === scope)
  const to = lists && mergedTo(lists, kind, id)
  if (!to) return undefined
  const { openScope, select, here } = from
  const open = to.scope === here ? () => select(to.id)
    : isScopeBelow(to.scope, here) ? () => select(nodeKey(to.id, to.scope))
      : openScope ? () => openScope(to.scope, to.id) : undefined
  return { label: recordName(from.everywhere, here, from.scopeLabel, to), ...(open ? { open } : {}) }
}

/**
 * Where a tombstone's observation went (ADR-0038 §1): the number it has in
 * the scope it moved to, and that scope — opened on it, or selected where it
 * is a scope below.
 */
function movedAway(one: Observation, from: Away): MergedInto | undefined {
  const to = movedTo(one.history)
  if (!to) return undefined
  const there = from.everywhere.find((held) => held.scope === to.scope)?.observations.find((held) => held.id === to.id)
  const number = there?.number ?? to.number
  const { openScope, select, here } = from
  const open = isScopeBelow(to.scope, here) ? () => select(nodeKey(to.id, to.scope))
    : openScope ? () => openScope(to.scope, to.id) : undefined
  return {
    label: number !== undefined ? formatObservationNumber(number) : to.id, scope: from.scopeLabel(to.scope), date: to.date, moved: true,
    ...(open ? { open } : {}),
  }
}

/**
 * Where an observation of this scope went: as {@link mergedAway} says, or —
 * written by a build before a merge wrote both ends — into one a scope above
 * keeps, read off the tree (ADR-0021).
 */
function mergedIntoOf(one: Observation, from: Away & { absorbedAbove: ObservationsPageProps['absorbedAbove'] }): MergedInto | undefined {
  const moved = movedAway(one, from)
  if (moved) return moved
  const away = mergedAway('observation', one.id, from.here, from)
  if (away) return away
  const above = from.absorbedAbove?.get(one.id)
  if (!above) return undefined
  const { openScope } = from
  return {
    label: above.intoTitle, scope: from.scopeLabel(above.by), date: above.date,
    ...(openScope ? { open: () => openScope(above.by, above.into) } : {}),
  }
}

/**
 * What an observation was analysed into, read in its own scope: that scope's
 * causes, keyed as the page keys a record below, and any cause of this scope
 * that still explains one below (ADR-0032 §9).
 */
function analysedIntoOf(causes: readonly Cause[], below: readonly ScopeAnalysis[]) {
  return (id: string, scope?: string) => [
    ...(scope === undefined ? [] : explainedBy(below.find((one) => one.scope === scope)?.causes ?? [], id))
      .map((cause) => ({ key: nodeKey(cause.id, scope), label: causeLabel(cause) })),
    ...explainedBy(causes, id, scope).map((cause) => ({ key: cause.id, label: causeLabel(cause) })),
  ]
}

/**
 * The counts over the picture, in order, each with the colour its number is
 * drawn in: the problems' and the causes', then — only where there are any —
 * the bright spots', counted apart in the success colour (ADR-0038 §6).
 */
type PhaseRow = { readonly keys: { one: StringKey; other: StringKey }; readonly count: number; readonly color: string | undefined }

/** The word beside a count, in the number the count has: *1 root cause*, *2 root causes*; a participle is the same in both. */
const phase = (one: StringKey, other: StringKey, count: number, color?: string): PhaseRow => ({ keys: { one, other }, count, color })

function phaseRows(counted: PictureCounts): PhaseRow[] {
  const plain = [
    phase('observation.phaseObserved', 'observation.phaseObserved', counted.observed),
    phase('observation.phaseAnalysed', 'observation.phaseAnalysed', counted.analysed),
    phase('observation.phaseAssumed', 'observation.phaseAssumed', counted.assumed),
    phase('observation.phaseVerified', 'observation.phaseVerified', counted.verified),
    phase('observation.phaseRootsOne', 'observation.phaseRoots', counted.roots),
    phase('observation.phaseOpenEndsOne', 'observation.phaseOpenEnds', counted.openEnds),
  ]
  const { bright } = counted
  const lit = bright.observed > 0 || bright.openEnds > 0 ? [
    phase('observation.phaseBrightOne', 'observation.phaseBright', bright.observed, 'success.main'),
    phase('observation.phaseBrightAnalysedOne', 'observation.phaseBrightAnalysed', bright.analysed, 'success.main'),
    phase('observation.phaseBrightOpenEndsOne', 'observation.phaseBrightOpenEnds', bright.openEnds, 'success.main'),
  ] : []
  return [...plain, ...lit]
}

export function ObservationsPage(props: ObservationsPageProps) {
  const {
    open, onClose, model, below = [], onChange, initialId, initialNonce, readOnly = false, s, today, makeId,
    absorbedAbove,
  } = props
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const observations = useMemo(() => model.observations ?? [], [model.observations])
  const causes = useMemo(() => model.causes ?? [], [model.causes])
  const analysis = useMemo<Analysis>(() => ({ observations: [...observations], causes: [...causes] }), [observations, causes])
  const solutions = useMemo(() => model.solutions ?? [], [model.solutions])
  const experiments = useMemo(() => model.experiments ?? [], [model.experiments])
  const work = useMemo<ObservationWork>(() => ({ ...analysis, solutions: [...solutions], experiments: [...experiments], comments: [...model.comments ?? []], citations: [...model.citations ?? []] }),
    [analysis, solutions, experiments, model.comments, model.citations])
  const plans = useMemo<SolutionPlan[]>(() => (model.transitions ?? []).map(solutionPlanOf), [model.transitions])
  const context = useMemo<SolutionContext>(() => ({
    causes, experiments, plans, decisions: (model.decisions ?? []).map((one) => ({ id: one.id, status: one.status })),
  }), [causes, experiments, plans, model.decisions])
  const scopeLabel = props.scopeLabel ?? ((path: string) => path)
  const here = useMemo<ScopeAnalysis>(() => ({ scope: props.path ?? '', ...work }), [props.path, work])
  /** Every scope read, this one as it stands here: what a merge searches and plans over (ADR-0035). */
  const everywhere = useMemo(
    () => [here, ...(props.tree ?? below).filter((one) => one.scope !== here.scope)], [here, props.tree, below])
  /** The filters, the scopes in view and the look of the picture (ADR-0032 §8), over every stage. */
  const f = usePictureFilters({ here, below, saved: props.savedFilters, name: model.name, scopeLabel })
  const solveView = usePictureView(true)
  const { labelOf } = f
  const { explainedAbove, explainedAboveOf } = props
  /** What the scopes over a scope explain of it: this one's handed in, one below's asked of the tree. */
  const aboveOf = useCallback(
    (scope: string) => (scope === here.scope ? explainedAbove : explainedAboveOf?.(scope)),
    [here.scope, explainedAbove, explainedAboveOf],
  )

  const [stage, setStageRaw] = useState<Tab>('register')
  const [readerWidth, setReaderWidth] = useSeamWidthsOf<'analysis' | 'solutions'>('observations.reader', READER_WIDTHS)
  // The person's own choices, kept with their other preferences through the seam a width is kept by: a number per name.
  const { lens, press: pressLens, name: nameLens } = useChainLens(stage)
  // How many chains the map shows is kept per person and scope.
  const [chainsKept, keepChains] = useSeamWidth(`observations.chains.${here.scope}`, CHAINS_FIRST)
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set())
  const [wholeChain, setWholeChain] = useState(false)
  const [showDropped, setShowDropped] = useState(false)
  /** A solution being proposed, from a cause or from the bar. */
  const [proposing, setProposing] = useState<{ causeId?: string } | undefined>(undefined)
  const [addressing, setAddressing] = useState<Solution | undefined>(undefined)
  const [planning, setPlanning] = useState<Solution | undefined>(undefined)
  const [dropping, setDropping] = useState<Solution | undefined>(undefined)
  const [selectedKey, setSelectedKeyRaw] = useState<string | undefined>(undefined)
  /** The whole record is up, of what is selected: links, history, comments. */
  const [full, setFull] = useState(false)
  const setSelectedKey = useCallback((key: string | undefined) => { setSelectedKeyRaw(key); if (key === undefined) setFull(false) }, [])
  /** The record in the full-window editor, by key. */
  const [editingKey, setEditingKey] = useState<string | undefined>(undefined)
  /** A right-click on a picture: what it landed on, and where. */
  const [menu, setMenu] = useState<{ target: PictureTarget; at: { x: number; y: number } } | undefined>(undefined)
  /** A cause's question asked of it, shown in its reader: a new object each time it is asked. */
  const [asked, setAsked] = useState<{ key: string; panel: CausePanel } | undefined>(undefined)
  const [showMerged, setShowMerged] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set())
  const [shownColumns, setShownColumns] = useState<readonly string[]>([])
  const [reading, setReading] = useState(false)
  /** What is being archived: a dialog asks why first. */
  const [archiving, setArchiving] = useState<Observation | undefined>(undefined)
  /** What is being noted: a dialog asks why, and takes no answer. */
  const [noting, setNoting] = useState<{ observation: Observation; scope?: string } | undefined>(undefined)
  const [deleting, setDeleting] = useState<{ kind: DeleteKind; id: string; label: string } | undefined>(undefined)
  const setStage = useCallback((next: Tab) => { setStageRaw(next); setSelectedKey(undefined); setEditingKey(undefined); setTicked(new Set()) }, [setSelectedKey])

  // --- what is where ------------------------------------------------------------------

  /** The observations from below this scope has not folded into its own, and that are still open below. */
  const belowAll = useMemo(() => observationsBelow(below), [below])
  const belowShown = useMemo(
    () => belowAll.filter((one) => (
      !absorbedBy(observations, one.observation.id, one.scope) && !isArchived(one.observation)
      && !one.observation.history.some((event) => event.kind === 'merged') && !isMoved(one.observation)
    )),
    [belowAll, observations],
  )
  /**
   * The ones below a cause here still explains: links ADR-0021 allowed and
   * nothing makes any more (ADR-0032 §9), drawn so they can be seen and put
   * right. The rest are that scope's to explain.
   */
  const belowLinked = useMemo(
    () => belowShown.filter((one) => explainedBy(causes, one.observation.id, one.scope).length > 0), [belowShown, causes],
  )
  const belowByScope = useMemo(() => {
    const groups = new Map<string, ObservationBelow[]>()
    for (const one of belowShown) groups.set(one.scope, [...(groups.get(one.scope) ?? []), one])
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [belowShown])

  const nameOf = useCallback((id: string, scope?: string): string => {
    if (scope !== undefined) {
      const held = belowAll.find((one) => one.scope === scope && one.observation.id === id)
      const cause = below.find((one) => one.scope === scope)?.causes.find((one) => one.id === id)
      const named = held ? `${formatObservationNumber(held.observation.number)} ${held.observation.title}` : cause ? `${causeLabel(cause)} ${cause.title}` : id
      return `${named} (${scopeLabel(scope)})`
    }
    const observation = observations.find((one) => one.id === id)
    if (observation) return `${formatObservationNumber(observation.number)} ${observation.title}`
    const cause = causes.find((one) => one.id === id)
    if (cause) return `${causeLabel(cause)} ${cause.title}`
    const solution = solutions.find((one) => one.id === id)
    if (solution) return `${formatSolutionNumber(solution.number)} ${solution.title}`
    const experiment = experiments.find((one) => one.id === id)
    if (experiment) return `${formatExperimentNumber(experiment.number)} ${experiment.title}`
    const decision = model.decisions?.find((one) => one.id === id)
    if (decision) return `${label4('ADR', decision.number)} ${decision.title}`
    const plan = model.transitions?.find((one) => one.id === id)
    return plan ? `${label4('TR', plan.number)} ${plan.title}` : id
  }, [below, belowAll, observations, causes, solutions, experiments, model.decisions, model.transitions, scopeLabel])

  /** What a key names: the reader it opens and the menu it gets are both read off this. */
  const resolve = useCallback((key: string) => resolveSelected(key, work, below), [work, below])
  const selected = useMemo(() => (selectedKey ? resolve(selectedKey) : undefined), [selectedKey, resolve])

  const located = useOpening({
    open, request: { id: initialId, nonce: initialNonce, tab: props.initialTab ? stageOfTab(props.initialTab).stage : undefined }, work, below, shown: recordIdOf(selected, selectedKey), tab: stage,
    onShown: props.onShown, select: setSelectedKey,
    land: ({ tab: to, key }) => {
      f.clear()
      if (to) setStageRaw(to)
      setFull(false)
      const named = props.initialTab ? stageOfTab(props.initialTab) : undefined
      nameLens(named?.lens && hasMap(named.stage) ? { stage: named.stage, lens: named.lens } : undefined)
      setSelectedKey(key)
    },
  })

  // --- changes ---------------------------------------------------------------------------

  /** Hand the lists back whole; what is not said is what it was. */
  const commit = useCallback((next: Partial<ObservationWork>) => {
    if (!readOnly) onChange({ ...work, ...next })
  }, [onChange, readOnly, work])
  /** The readers' context, read by the ladder after the forms are made: what explains a cause from above is the page's to say. */
  const readerRef = useRef<ReaderContext | undefined>(undefined)
  /** The new observation, the ladder and the link dialog, and where what they make lands (ADR-0032 §2, §6). */
  const forms = useAnalysisForms({
    work, below, local: f.viewLocal, path: props.path, scopeName: model.name, commit, readOnly, onChangeBelow: props.onChangeBelow,
    makeId, today, s, scopeLabel, scopeTrail: props.scopeTrail, nameOf, select: setSelectedKey, renderMarkdown: props.renderMarkdown,
    rootStep: (id, scope) => {
      const ctx = readerRef.current
      const list = scope === undefined ? causes : below.find((one) => one.scope === scope)?.causes ?? []
      const cause = list.find((one) => one.id === id)
      return ctx && cause ? crossScope(cause, scope, ctx).toggle : {}
    },
    onPropose: (causeId) => setProposing({ causeId }),
  })
  /** Seen again, verified, an experiment concluded or reopened: the moves that ask first. */
  const lifecycle = useLifecycle({ lists: work, commit, today, nameOf, s, changeBelow: forms.changeBelow })
  const { dialogs } = lifecycle

  const archive = (id: string, note: string) => {
    commit({ ...analysis, observations: setArchived(observations, id, true, today(), note) })
    setArchiving(undefined)
  }
  const note = (reason: string) => {
    if (!noting) return
    const { observation, scope } = noting
    setNoting(undefined)
    if (scope === undefined) commit({ observations: setNoted(observations, observation.id, true, today(), reason) })
    else forms.changeBelow?.(scope, (held) => ({ ...held, observations: setNoted(held.observations, observation.id, true, today(), reason) }))
  }
  /** The merge screen (ADR-0035): over this page, planned over every scope read, landed here or across. */
  const merging = useMerge({
    here: here.scope, scopes: everywhere, writable: props.writable, readOnly, commit, onChangeAcross: props.onChangeAcross,
    today, t: s, scopeLabel, scopeTrail: props.scopeTrail, day: (date) => formatDay(date, props.language), select: setSelectedKey,
  })
  const mergeAt = (kind: MergeKind, id: string, scope?: string) => merging.open(kind, { scope: scope ?? here.scope, id })
  /** The move screen (ADR-0038 §5): over this page, to any scope read, landed across; it closes on the record where it went. */
  const moving = usePageMove({
    here: here.scope, scopes: everywhere, paths: props.scopes, writable: props.writable, readOnly, onChangeAcross: props.onChangeAcross,
    today, t: s, scopeLabel, scopeTrail: props.scopeTrail, select: setSelectedKey, onOpenScope: props.onOpenScope, onClose,
  })
  const unlink = (causeId: string, target: Pick<CauseLink, 'id' | 'scope'>) => (
    commit({ ...analysis, causes: unlinkCause(causes, causeId, target.id, target.scope) })
  )
  const remove = () => {
    if (!deleting) return
    if (deleting.kind === 'observation') commit(removeObservation(analysis, deleting.id))
    else if (deleting.kind === 'cause') commit({ ...removeCause(analysis, deleting.id), solutions: forgetCause(solutions, deleting.id) })
    else if (deleting.kind === 'solution') commit(removeSolution({ solutions: [...solutions], experiments: [...experiments] }, deleting.id))
    else commit({ experiments: removeExperiment(experiments, deleting.id) })
    if (selectedKey === deleting.id || selectedKey === solutionKey(deleting.id) || selectedKey === experimentKey(deleting.id)) setSelectedKey(undefined)
    setDeleting(undefined)
  }

  // --- solutions (ADR-0026) ----------------------------------------------------------------

  const proposeSolution = (fields: NewSolution) => {
    const fresh = newSolution({
      id: makeId('so'), number: nextSolutionNumber(solutions), title: fields.title, date: today(), t: s,
      body: fields.body, addresses: fields.addresses,
    })
    commit({ solutions: [...solutions, fresh] })
    setProposing(undefined)
    setStageRaw('solutions')
    setSelectedKey(solutionKey(fresh.id))
  }
  const addExperiment = (solution: Solution, fields: { title: string; hypothesis: string; measure: string }) => {
    const fresh = newExperiment({
      id: makeId('ex'), number: nextExperimentNumber(experiments), tests: [solution.id], t: s, from: today(), ...fields,
    })
    commit(planExperiment({ solutions, experiments }, fresh, today()))
    setPlanning(undefined)
    setSelectedKey(experimentKey(fresh.id))
  }

  const phaseOf = (one: Solution): SolutionPhase => solutionPhase(one, plans)
  const orphanRoots = rootsWithoutSolution(causes, solutions)

  // --- the lists -----------------------------------------------------------------------

  const { shows } = f
  const analysedInto = analysedIntoOf(causes, below)
  const away: Away = {
    everywhere, here: here.scope, scopeLabel, select: setSelectedKey,
    ...(props.onOpenScope ? { openScope: (path: string, id: string) => { onClose(); props.onOpenScope?.(path, id) } } : {}),
  }
  const mergedLabel = (one: Observation) => mergedIntoOf(one, { ...away, absorbedAbove })
  const mergedCause = (cause: Cause, scope?: string) => mergedAway('cause', cause.id, scope ?? here.scope, away)
  const names = usePersonNames()
  const openEndKeys = useMemo(() => openEnds(f.inView, here.scope, aboveOf), [f.inView, here.scope, aboveOf])
  const stageData: StageData = {
    here: here.scope, observations, causes, solutions, experiments, plans,
    below: f.rowsBelow(belowByScope), belowAll,
    analysisBelow: recordsBelow(below, here.scope, f.viewLocal, shows, showArchived, showMerged),
    analysedInto, mergedInto: mergedLabel, causeMergedInto: mergedCause, isOpenEnd: (key) => openEndKeys.has(key), shows,
    showMerged, showArchived, scopeLabel, names, language: props.language, s,
  }
  const groups: ListGroup[] = stageGroups(stage, stageData)
  const columns = stage === 'register' ? observationColumns(s).filter((one) => shownColumns.includes(one.id)) : []

  /** What the readers read and ask, and the right-click on a record below, which offers what its reader does. */
  const { onOpenScope } = props
  const readerCtx: ReaderContext = {
    here: here.scope, work, below, plans, context, decisions: model.decisions ?? [], transitions: model.transitions ?? [],
    ...(explainedAbove ? { explainedAbove } : {}), explainedAboveOf: aboveOf,
    readOnly, today, scopeName: model.name, s, nameOf, scopeLabel, commit, forms, lifecycle,
    ask: {
      archive: setArchiving, merge: (observation, scope) => mergeAt('observation', observation.id, scope),
      mergeCause: (cause, scope) => mergeAt('cause', cause.id, scope),
      move: moving.ask,
      note: (observation, scope) => setNoting({ observation, ...(scope !== undefined ? { scope } : {}) }),
      remove: (kind, id) => setDeleting({ kind, id, label: nameOf(id) }), propose: (causeId) => setProposing({ causeId }),
      address: setAddressing, plan: setPlanning, drop: setDropping,
    },
    mergedLabel, mergedCause, openKey: setSelectedKey, asked,
    ...(onOpenScope ? { openScope: (path: string) => { onClose(); onOpenScope(path) } } : {}),
    onDecide: props.onDecide, onStartPlan: props.onStartPlan, onOpenDecision: props.onOpenDecision, onOpenPlan: props.onOpenPlan,
    renderMarkdown: props.renderMarkdown, onAddImage: props.onAddImage, images: props.images,
    copyLink: copyLinkOf(props, stage),
  }
  readerRef.current = readerCtx
  const pageWrites = { edit: (key: string) => setEditingKey(key), ask: (key: string, panel: CausePanel) => setAsked({ key, panel }) }

  // --- the right-click ------------------------------------------------------------------

  /** A right-click selects what it landed on, the way a click does, and offers what can be done with it. */
  const openMenu = (target: PictureTarget, at: { x: number; y: number }) => {
    if (target.kind === 'node') setSelectedKey(target.key)
    setMenu({ target, at })
  }
  const menuActions = (target: PictureTarget): MenuAction[] => pictureMenuActions(target, {
    readOnly, s, commit, analysis, causes, solutions, experiments, resolve, readerCtx,
    edit: (key) => setEditingKey(key), ask: (key, panel) => setAsked({ key, panel }), unlink,
  })

  // --- the maps -------------------------------------------------------------------------

  const records = useMemo(() => chainsOf(f.inView, here.scope), [f.inView, here.scope])
  const links = useMemo(() => pictureLinks(f.inView, here.scope), [f.inView, here.scope])
  const filteredKeys = f.result.filtering ? f.result.visible : undefined
  const chainWindow = useMemo(
    () => mapWindow(records, here.scope, { limit: chainsKept === CHAINS_ALL ? 'all' : chainsKept, opened }, links, filteredKeys),
    [records, here.scope, chainsKept, opened, links, filteredKeys],
  )
  const counted = f.counts(aboveOf)
  const phases = phaseRows(counted)
  /** A line drawn from one card to another: what is explained to what explains it, or a root to what addresses it. */
  const dragLink = (from: string, to: string) => {
    const left = resolve(from)
    const right = resolve(to)
    if (!left || !right) return
    const seen = left.kind === 'observation' ? left.observation.id : left.kind === 'cause' ? left.cause.id : undefined
    if (right.kind === 'cause' && seen !== undefined) {
      if (linkRefusal(causes, right.cause.id, { id: seen }) === undefined) commit({ causes: linkCause(causes, right.cause.id, { id: seen, strength: 'normal' }) })
      return
    }
    if (right.kind === 'solution' && left.kind === 'cause' && isRootCause(left.cause)) {
      commit({ solutions: addressCause(solutions, right.solution.id, { id: left.cause.id, strength: 'normal' }) })
    }
  }
  const sizeSwitch = (
    <Segmented
      label={s('observation.size')} value={f.view.size} onChange={f.view.setSize} data-guide="observations.size"
      options={[{ value: 'large', label: s('observation.sizeLarge') }, { value: 'small', label: s('observation.sizeSmall') }]}
    />
  )
  const howToRead = <Button variant="quiet" size="small" onClick={() => setReading(true)} data-testid="how-to-read">{s('observation.howToRead')}</Button>
  const picture = (
    <AnalysisPicture
      scopes={f.inView}
      here={here.scope}
      filter={f.result}
      explainedAbove={aboveOf}
      view={f.view}
      scopeLabel={labelOf}
      hereLabel={f.hereLabel(s)}
      selectedKey={selectedKey}
      onSelect={setSelectedKey}
      onMenu={openMenu}
      window={chainWindow}
      showOverview={chainsKept === CHAINS_ALL}
      onMore={(card) => {
        if (card.more === 'pile') { setStage('register'); return }
        const { chain } = card
        if (chain) setOpened((held) => new Set(held).add(chain))
      }}
      {...(readOnly ? {} : {
        onAsk: (key: string) => {
          const held = resolve(key)
          if (held?.kind === 'observation') forms.openLink({ mode: 'cause', id: held.observation.id })
          else if (held?.kind === 'below') forms.openLink({ mode: 'cause', id: held.observation.id, scope: held.scope })
          else if (held?.kind === 'cause') forms.openLink({ mode: 'deeper', id: held.cause.id })
          else if (held?.kind === 'causeBelow') forms.openLink({ mode: 'deeper', id: held.cause.id, scope: held.scope })
        },
        onDragLink: dragLink,
      })}
      dockExtra={<>{sizeSwitch}{howToRead}</>}
      s={s}
    />
  )
  const { graph, flags } = useSolveMap({
    observations, causes, solutions, experiments, plans, belowLinked, belowAll, analysis, context, orphanRoots, wholeChain, showDropped, result: f.result, nameOf, s,
  })
  const phaseCounts = (['idea', 'shaped', 'testing', 'proven', 'adopted', 'implemented'] as const)
    .map((phase) => [phase, solutions.filter((one) => phaseOf(one) === phase).length] as const)
  const solutionsMap = (
    <SolutionPicture
      graph={graph} selectedKey={selectedKey} onSelect={setSelectedKey} flags={flags} onMenu={openMenu} view={solveView} s={s}
      dockExtra={(
        <>
          <Button variant="quiet" size="small" aria-pressed={wholeChain} onClick={() => setWholeChain((on) => !on)} data-testid="solution-whole-chain">{s('solution.wholeChain')}</Button>
          <Button variant="quiet" size="small" aria-pressed={showDropped} onClick={() => setShowDropped((on) => !on)} data-testid="solution-show-dropped">{s('solution.showDropped')}</Button>
          {howToRead}
        </>
      )}
    />
  )

  // --- what stands on the page ----------------------------------------------------------

  const liveCount = liveObservations(observations).length
  const rootCount = rootCauses(causes).length
  const stageSaid: Record<Tab, ReactNode> = {
    register: <span data-testid="stage-said">{s('observation.saidSeen', { seen: liveCount, waiting: liveObservations(observations).filter((one) => !one.noted && analysedInto(one.id).length === 0).length })}</span>,
    analysis: <span data-testid="stage-said">{s('observation.saidWhy', { causes: causes.filter((one) => !isCauseMerged(causes, one.id)).length, open: counted.openEnds })}</span>,
    solutions: (
      <span data-testid="solution-phases" data-guide="solutions.phases">
        <span data-testid="solution-coverage">
          {plural(s, { one: 'solution.coverageOne', other: 'solution.coverageOther' }, rootCount, { count: rootCount - orphanRoots.length, total: rootCount })}
        </span>
      </span>
    ),
    results: <ResultsSaid solutions={solutions} plans={plans} analysis={analysis} belowAll={belowAll} s={s} />,
  }
  const nothingYet = !f.result.filtering && liveCount === 0 && causes.length === 0 && solutions.length === 0 && experiments.length === 0
    && f.inView.every((one) => one.observations.length === 0 && one.causes.length === 0 && one.solutions.length === 0)
    && !observations.some((one) => isArchived(one) || isMerged(observations, one.id))

  const onMap = lens === 'map' && hasMap(stage)
  const tickable = !readOnly && (stage === 'register' || (stage === 'analysis' && lens === 'list'))
  const bulk = (
    <BulkActions
      ticked={ticked} stage={stage} here={here.scope} s={s} onClear={() => setTicked(new Set())}
      onAsk={forms.askGroup} onMerge={merging.open}
    />
  )
  const actions = (
    <span className="chain-page__actions">
      <span className="chain-page__said" data-testid="picture-count">
        {stageSaid[stage]}
      </span>
      <Button
        variant="quiet" size="small" aria-pressed={f.viewLocal} {...(f.hasBelow ? { title: s('observation.viewLocalTip') } : { reason: s('observation.viewLocalNone') })}
        onClick={() => f.setViewLocal(!f.viewLocal)} data-testid="view-local" data-guide="observations.viewLocal"
      >
        {f.viewLocal ? s('observation.scopesBelowOn') : s('observation.scopesBelowOff')}
      </Button>
      {hasMap(stage) && (
        <Segmented
          label={s('observation.lens')} value={lens} onChange={(next) => { pressLens(next); setSelectedKey(undefined) }}
          data-guide="observations.lens"
          options={[{ value: 'list', label: s('observation.lensList') }, { value: 'map', label: s('observation.lensMap') }]}
        />
      )}
      {!readOnly && (stage === 'solutions' || stage === 'results'
        ? <Button variant="primary" onClick={() => setProposing(preselectedCause(causes, selected))} data-testid="solution-new" data-guide="solutions.new">{s('solution.new')}</Button>
        : <Button variant="primary" onClick={forms.openNew} data-testid="observation-new" data-guide="observations.new">{s('observation.new')}</Button>)}
    </span>
  )

  const groupOf = selectedKey ? groups.find((one) => one.rows.some((row) => row.id === selectedKey)) : undefined
  const previewIds = groupOf ? groupOf.rows.map((row) => row.id) : []
  const listWord = groupOf && inSentence(groupOf.label, props.language)
  // The merge and move screens are places under the frame: a modal over them would hide them from everybody.
  const showPreview = !onMap && !full && selected !== undefined && selectedKey !== undefined && !merging.state && !moving.state

  const listHidden = () => hiddenRows(stage, stageData, belowByScope, recordsBelow(below, here.scope, true, () => true, showArchived, showMerged))
  const hidden = <HiddenBar f={f} onMap={onMap} listHidden={listHidden} s={s} />
  const list = (
    <List
      label={s(STAGE_WORD[stage])}
      groups={groups}
      wrap
      columns={columns}
      {...(columns.length ? { itemLabel: s('observation.colTitle') } : {})}
      selectedId={selectedKey ?? null}
      onOpen={setSelectedKey}
      {...(tickable ? { checked: ticked, onCheckedChange: setTicked, bulkActions: bulk } : {})}
      dataGuide="observations.register"
      rowGuide="observations.row"
      more={hidden}
      empty={<EmptyStage stage={stage} f={f} observations={observations} showArchived={showArchived} onShowArchived={() => setShowArchived(true)} s={s} />}
    />
  )
  const leaving = useBackToReading(full, () => setFull(false), onClose, s('observation.close'))
  // A panel opened from a preview replaces it: what it asks about stands beside it in the list.
  const panelUp = forms.panel !== undefined && forms.panel !== null
  useEffect(() => { if (panelUp && !onMap) setSelectedKey(undefined) }, [panelUp, onMap, setSelectedKey])
  const side = forms.panel ?? (onMap && selected && selectedKey ? (
    <>
      <SeamResizer
        orientation="vertical" region="after" value={readerWidth[stage as 'analysis' | 'solutions']} min={READER.min} max={READER.max} defaultValue={READER.default}
        onChange={(next) => setReaderWidth(stage as 'analysis' | 'solutions', next)} label={s('observation.resizeReader')}
      />
      <RecordPanel held={selected} heldKey={selectedKey} ctx={readerCtx} page={pageWrites} width={readerWidth[stage as 'analysis' | 'solutions']} onClose={() => setSelectedKey(undefined)} />
    </>
  ) : undefined)

  const editing = editingKey ? editingOf(resolve(editingKey), readerCtx) : undefined

  return (
    <PageDialog open={open} topInset={chrome.topInset} onClose={leaving.leave} aria-label={s('observation.title')}>
      <LanguageProvider language={props.language}>
        <Box className="chain-page" ref={located.ref} sx={located.ring}>
          <div className="chain-page__tabs" data-testid="observation-topbar">
            {/* The whole record has one way back, its named crumb (‹ Seen); Escape goes the same way. */}
            {!full && <PageBack onBack={leaving.leave} label={leaving.said} />}
            <Tabs<Tab>
              label={s('observation.title')} value={stage} onChange={setStage}
              items={[
                { value: 'register', label: s('observation.stageSeen'), guide: 'observations.tabRegister', testId: 'observation-tab-register' },
                { value: 'analysis', label: s('observation.stageWhy'), guide: 'observations.tabAnalysis', testId: 'observation-tab-analysis' },
                { value: 'solutions', label: s('observation.stageSolve'), guide: 'observations.tabSolutions', testId: 'observation-tab-solutions' },
                { value: 'results', label: s('observation.stageResults'), guide: 'observations.tabResults', testId: 'observation-tab-results' },
              ]}
            />
            <span className="chain-page__tabsGrow" />
            {!full && <PageClose onClose={leaving.leave} label={leaving.closeSaid} />}
          </div>
          {full && selected && selectedKey ? (
            <RecordFull held={selected} heldKey={selectedKey} ctx={readerCtx} page={pageWrites} backLabel={s(STAGE_WORD[stage])} onBack={() => setFull(false)} />
          ) : nothingYet && !forms.panel ? (
            <ChainEmpty {...(readOnly ? {} : { onNew: forms.openNew })} s={s} />
          ) : (
            <>
              <div className="chain-page__tools">
                <ChainFilter
                  f={f} scopeLabel={labelOf} showMerged={showMerged} onShowMerged={setShowMerged} showArchived={showArchived} onShowArchived={setShowArchived}
                  {...(stage === 'register' ? { columns: { choices: observationColumns(s), shown: shownColumns, onChange: setShownColumns } } : {})}
                  actions={actions} s={s}
                />
              </div>
              <div className="chain-page__work" data-testid="observation-body" data-map={onMap || undefined}>
                <div className="chain-page__main">
                  {!onMap ? list : stage === 'analysis' ? picture : solutionsMap}
                  {onMap && stage === 'analysis' && !f.result.filtering && (
                    <MapWindowBar window={chainWindow} kept={chainsKept} loose={records.loose.length} belowInView={f.viewLocal} onKeep={keepChains} s={s} />
                  )}
                  {onMap && hidden}
                </div>
                {side}
              </div>
            </>
          )}
        </Box>
        {showPreview && (
          <RecordPreview
            held={selected} heldKey={selectedKey} ctx={readerCtx} page={pageWrites} ids={previewIds} {...(listWord ? { listWord } : {})}
            onSelect={(key) => setSelectedKey(key ?? undefined)} onFull={() => setFull(true)}
          />
        )}
        <RecordEditor
          editing={editing} onClose={() => setEditingKey(undefined)} today={today()}
          renderMarkdown={props.renderMarkdown} onAddImage={props.onAddImage} images={props.images} s={s}
        />
        <PictureMenu at={menu?.at} actions={menu ? withCopyLink(menuActions(menu.target), menu.target, resolve, copyLinkOf(props, stage), s) : []} onClose={() => setMenu(undefined)} />
        <HowToRead
          open={reading} onClose={() => setReading(false)} stage={stage} size={f.view.size === 'large' && f.view.zoom < FAR_BELOW ? 'far' : f.view.size} local={f.viewLocal}
          phases={phases} phaseCounts={phaseCounts} language={props.language} s={s}
        />
        {forms.dialogs}
        {dialogs}
        <RecordDialogs
          noteLabel={noting ? nameOf(noting.observation.id, noting.scope) : undefined} onNoteCancel={() => setNoting(undefined)} onNote={note}
          archiving={archiving ? { id: archiving.id, label: nameOf(archiving.id) } : undefined} onArchiveCancel={() => setArchiving(undefined)} onArchive={(reason) => { if (archiving) archive(archiving.id, reason) }}
          merging={merging} moving={moving} windowChrome={props.windowChrome} renderMarkdown={props.renderMarkdown}
          proposing={proposing} causes={causes} onProposeCancel={() => setProposing(undefined)} onPropose={proposeSolution}
          addressing={addressing ? { id: addressing.id, label: nameOf(addressing.id) } : undefined}
          addressCandidates={causesForProposal(causes).filter((one) => !addressing?.addresses.some((address) => address.id === one.id))}
          onAddressCancel={() => setAddressing(undefined)}
          onAddress={({ causeId, strength }) => {
            if (addressing) commit({ solutions: addressCause(solutions, addressing.id, { id: causeId, strength }) })
            setAddressing(undefined)
          }}
          planning={planning ? { id: planning.id, label: nameOf(planning.id) } : undefined} onPlanCancel={() => setPlanning(undefined)} onPlan={(fields) => { if (planning) addExperiment(planning, fields) }}
          dropping={dropping ? { id: dropping.id, label: nameOf(dropping.id) } : undefined} onDropCancel={() => setDropping(undefined)}
          onDrop={(reason) => {
            if (dropping) commit({ solutions: dropSolution(solutions, dropping.id, reason, today()) })
            setDropping(undefined)
          }}
          deleting={deleting} onDeleteCancel={() => setDeleting(undefined)} onDelete={remove} s={s}
        />
      </LanguageProvider>
    </PageDialog>
  )
}

const STAGE_WORD = { register: 'observation.stageSeen', analysis: 'observation.stageWhy', solutions: 'observation.stageSolve', results: 'observation.stageResults' } as const

/** What the full window edits, wired to the rules; only what lives in this scope is edited from here (ADR-0032 §2). */
function editingOf(held: Selected | undefined, ctx: ReaderContext): RecordEditing | undefined {
  const { work, commit } = ctx
  switch (held?.kind) {
    case 'observation': return { kind: 'observation', record: held.observation, onSave: (patch) => commit({ observations: updateObservation(work.observations, held.observation.id, patch) }) }
    case 'cause': return { kind: 'cause', record: held.cause, onSave: (patch) => commit({ causes: updateCause(work.causes, held.cause.id, patch) }) }
    case 'solution': return { kind: 'solution', record: held.solution, onSave: (patch) => commit({ solutions: updateSolution(work.solutions, held.solution.id, patch) }) }
    case 'experiment': return { kind: 'experiment', record: held.experiment, onSave: (patch) => commit({ experiments: updateExperiment(work.experiments, held.experiment.id, patch) }) }
    default: return undefined
  }
}

/** What a stage says with nothing in it, and it says which it is: filtered away is not nothing there. */
function EmptyStage({ stage, f, observations, showArchived, onShowArchived, s }: {
  stage: Tab
  f: ReturnType<typeof usePictureFilters>
  observations: readonly Observation[]
  showArchived: boolean
  onShowArchived: () => void
  s: Translate
}) {
  if (f.result.filtering) return <p className="chain-note chain-empty__line" data-testid="observation-register-empty">{s('observation.filterNothing')}</p>
  const archived = observations.filter((one) => isArchived(one) && !isMerged(observations, one.id)).length
  if (stage === 'register' && archived > 0 && !showArchived) {
    return (
      <div className="chain-empty__do chain-empty__line" data-testid="observation-register-empty">
        <span className="chain-note">{s('observation.listArchivedOnly', { count: archived })}</span>
        <Button size="small" onClick={onShowArchived} data-testid="observation-show-archived">{s('observation.showArchived')}</Button>
      </div>
    )
  }
  return <p className="chain-note chain-empty__line" data-testid="observation-register-empty">{s(EMPTY_WORD[stage])}</p>
}

const EMPTY_WORD = {
  register: 'observation.listEmpty', analysis: 'observation.emptyStageWhy', solutions: 'solution.emptyStageSolve', results: 'solution.emptyStageResults',
} as const

/** The legend and the full counts, said when asked: what was always on screen says nothing to somebody who has read it. */
function HowToRead({ open, onClose, stage, size, local, phases, phaseCounts, language, s }: {
  open: boolean
  onClose: () => void
  stage: Tab
  size: 'large' | 'small' | 'far'
  local: boolean
  phases: readonly PhaseRow[]
  phaseCounts: readonly (readonly [SolutionPhase, number])[]
  language: Language
  s: Translate
}) {
  const mac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform ?? '')
  const mod = mac ? '⌘' : 'Ctrl'
  const shift = mac ? '⇧' : 'Shift'
  return (
    <Dialog
      open={open} size="m" title={s('observation.howToRead')} onClose={onClose}
      actions={<Button variant="primary" onClick={onClose}>{s('common.close')}</Button>}
    >
      <div className="chain-read" data-testid="how-to-read-body">
        {stage === 'solutions' ? (
          <>
            <p className="chain-counts">
              {phaseCounts.map(([phase, count]) => <span key={phase}><b>{count}</b> {inSentence(s(PHASE_LABEL[phase]), language)}</span>)}
            </p>
            <SolutionLegend s={s} />
          </>
        ) : (
          <>
            <p className="chain-counts" data-testid="analysis-phases">
              {phases.map(({ keys, count }) => <span key={keys.other}><b>{count}</b> {plural(s, keys, count)}</span>)}
            </p>
            <PictureLegend size={size} local={local} s={s} />
          </>
        )}
        <section>
          <h3>{s('observation.zoomTitle')}</h3>
          <table>
            <tbody>
              <tr><th scope="row">{s('observation.zoomIn')}</th><td>{mod} +</td></tr>
              <tr><th scope="row">{s('observation.zoomOut')}</th><td>{mod} −</td></tr>
              <tr><th scope="row">{s('observation.zoomWheel')}</th><td>{s('observation.zoomWheelKeys', { mod })}</td></tr>
              <tr><th scope="row">{s('observation.zoomHome')}</th><td>{mod} 0</td></tr>
              <tr><th scope="row">{s('observation.zoomFit')}</th><td>{shift} 1</td></tr>
              <tr><th scope="row">{s('observation.zoomMove')}</th><td>{s('observation.zoomMoveKeys')}</td></tr>
            </tbody>
          </table>
          <p className="chain-note">{s('observation.zoomSaid')}</p>
        </section>
      </div>
    </Dialog>
  )
}
