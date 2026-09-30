// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Everything a scope observed in one place, and the analysis the team makes
 * of it (ADR-0021): a register of the observations — this scope's own and
 * those of the scopes below — with the record beside it, and a second tab
 * that draws the observations analysed into causes and causes into root
 * causes, with the same reading pane for whatever is clicked. A third tab
 * (ADR-0026) takes the causes on: solutions proposed for them, vetted through
 * their gates, tested, decided and built, and asked afterwards whether the
 * sightings stopped.
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
 *
 * A fullscreen dialog for the same reasons as the decisions page: it portals
 * out of the editor's DOM so the canvas's shortcuts cannot reach a reader, and
 * its top bar takes over the window's two jobs — keep clear of the traffic
 * lights, and be the surface the window is dragged by.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { LanguageProvider } from '../../i18n'
import type { Language, Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import type { HostModel } from '../../model/hostModel'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { PageDialog } from '../../widgets/PageDialog'
import { SeamResizer } from '../../widgets/SeamResizer'
import type { DocumentImages } from '../../documentation/ui/DocumentSource'
import type { MakeId } from '../../model/keys'
import type { CommandRefusal } from '../../model/reducer'
import {
  absorbedBy, absorbFromBelow, causeLabel, explainedBy, formatObservationNumber, isArchived, isMerged,
  isRootCause, linkCause, liveObservations, mergeObservations, observationsBelow, removeCause, removeObservation,
  setArchived, sortCauses, sortObservations, unlinkCause, updateCause,
} from '../observation'
import type {
  Analysis, Cause, CauseAbove, CauseLink, CausePatch, Observation, ObservationBelow, ScopeAnalysis,
} from '../observation'
import type { SavedFilters } from '../filter'
import { nodeKey } from '../graph'
import { IMPACT_COLOR, IMPACT_LABEL, STRENGTH_LABEL } from '../observationScope'
import { AnalysisPicture, PictureLegend } from './AnalysisPicture'
import { ArchiveDialog, MergeDialog } from './ObservationDialogs'
import { EmptyRegister, crumbTrail, experimentMoveActions, preselectedCause, rootToggle, useLifecycle } from './ObservationLifecycle'
import { PictureMenu } from './PictureMenu'
import type { MenuAction, PictureTarget } from './PictureMenu'
import { ReaderModeContext } from './Readers'
import { ObservationRegister, recordsBelow } from './ObservationRegister'
import { PictureToolbar } from './PictureToolbar'
import type { MergedInto } from './Readers'
import { RecordReader, belowMenuActions, resolveSelected } from './PageReaders'
import type { DeleteKind, ReaderContext, Selected } from './PageReaders'
import { useAnalysisForms } from './useAnalysisForms'
import {
  addressCause, dropSolution, forgetCause, formatExperimentNumber, formatSolutionNumber, isLive, mayAddress,
  mayPlanExperiment, moveSolution, newExperiment, newSolution, nextExperimentNumber, nextSolutionNumber, planExperiment,
  removeExperiment, removeSolution, restoreSolution, setTestStrength, openItems, previousState,
  rootsWithoutSolution, seenSinceImplemented, solutionGate, solutionPhase, solutionPlanOf, solutionQuestions,
  unaddressCause, untestSolution,
} from '../solution'
import type { Solution, SolutionContext, SolutionPhase, SolutionPlan, SolutionState, SolutionWork } from '../solution'
import { causesForProposal, experimentKey, solutionGraph, solutionKey } from '../solutionGraph'
import { PHASE_LABEL, QUESTION_LABEL } from '../observationScope'
import { SolutionLegend, SolutionPicture } from './SolutionPicture'
import { AddressDialog, DropDialog, NewExperimentDialog, NewSolutionDialog } from './SolutionDialogs'
import type { NewSolution } from './SolutionDialogs'
import { usePictureFilters } from './usePictureFilters'

/** Everything the page hands back: the analysis and what is being done about it. */
export type ObservationWork = Analysis & SolutionWork

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
  /** What a scope below is called, for the headings; the path where the host cannot say. */
  scopeLabel?: (path: string) => string
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
  /** Open straight onto this observation or cause. */
  initialId?: string
  /** The request's own number: the same record asked for again is a new one, and lands again. */
  initialNonce?: number
  /**
   * Which record is on show, by its id, whenever that changes, with the
   * number of the request the page has landed on: what the agent is told
   * the page is on.
   */
  onShown?: (key: string | undefined, nonce: number | undefined) => void
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

type Tab = 'register' | 'analysis' | 'solutions'

/**
 * How wide the reading pane is, in pixels, per tab: the register wants room
 * for its columns and the picture wants room for its lanes, so each keeps a
 * width of its own. Dragged at the seam, put back with a double-click.
 */
const READER = {
  register: { default: 640, min: 360, max: 1200 },
  analysis: { default: 420, min: 320, max: 900 },
  solutions: { default: 640, min: 380, max: 1000 },
} as const

const DELETE_TITLE = {
  observation: 'observation.deleteTitle', cause: 'observation.deleteCauseTitle',
  solution: 'solution.deleteTitle', experiment: 'solution.deleteTitle',
} as const
const DELETE_BODY = {
  observation: 'observation.deleteBody', cause: 'observation.deleteCauseBody',
  solution: 'solution.deleteBody', experiment: 'solution.deleteExperimentBody',
} as const

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
 * Where an opening lands: on the newest standing observation — unless asked
 * for a record, which the id names. A solution or an experiment opens on its
 * own tab, by its key or its bare id (ADR-0026); an observation or a cause
 * leaves the tab as it was.
 */
function landingFor(id: string | undefined, work: ObservationWork): { tab?: Tab; key: string | undefined } {
  if (!id) return { tab: 'register', key: sortObservations(liveObservations(work.observations))[0]?.id }
  const solution = work.solutions.find((one) => id === one.id || id === solutionKey(one.id))
  if (solution) return { tab: 'solutions', key: solutionKey(solution.id) }
  const experiment = work.experiments.find((one) => id === one.id || id === experimentKey(one.id))
  return experiment ? { tab: 'solutions', key: experimentKey(experiment.id) } : { key: id }
}

/**
 * Each opening lands once (`landingFor`), and each request again, by its
 * number, so the same record asked for again after the person moved off it
 * lands again. The records are read through a ref, so one changing while the
 * page is up does not reset the selection. What is on show goes to
 * `onShown` whenever it changes, with the number of the request it landed on
 * — what the agent is told the page is on.
 */
function useOpening(deps: {
  open: boolean
  request: { id: string | undefined; nonce: number | undefined }
  work: ObservationWork
  shown: string | undefined
  land: (at: { tab?: Tab; key: string | undefined }) => void
  onShown: ((id: string | undefined, nonce: number | undefined) => void) | undefined
}) {
  const { open, shown } = deps
  const { id, nonce } = deps.request
  const [landed, setLanded] = useState<number | undefined>(undefined)
  const latest = useRef(deps)
  latest.current = deps
  useEffect(() => {
    if (!open) return
    latest.current.land(landingFor(id, latest.current.work))
    setLanded(nonce)
  }, [open, id, nonce])
  useEffect(() => {
    if (open) latest.current.onShown?.(shown, landed)
  }, [open, shown, landed])
}

/**
 * Where an observation went when it was merged away, and the way there: the
 * one it was merged into, selected here, or opened on the page of the scope
 * above that keeps it.
 */
function mergedIntoOf(one: Observation, from: {
  observations: readonly Observation[]
  absorbedAbove: ObservationsPageProps['absorbedAbove']
  nameOf: (id: string) => string
  scopeLabel: (path: string) => string
  select: (id: string) => void
  openAbove?: (path: string, id: string) => void
}): MergedInto | undefined {
  const here = absorbedBy(from.observations, one.id)
  if (here) return { label: from.nameOf(here.id), open: () => from.select(here.id) }
  const above = from.absorbedAbove?.get(one.id)
  if (!above) return undefined
  const { openAbove } = from
  return {
    label: above.intoTitle, scope: from.scopeLabel(above.by), date: above.date,
    ...(openAbove ? { open: () => openAbove(above.by, above.into) } : {}),
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

export function ObservationsPage(props: ObservationsPageProps) {
  const {
    open, onClose, model, groupName, below = [], onChange, initialId, initialNonce, readOnly = false, s, today, makeId,
    absorbedAbove,
  } = props
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const observations = useMemo(() => model.observations ?? [], [model.observations])
  const causes = useMemo(() => model.causes ?? [], [model.causes])
  const analysis = useMemo<Analysis>(() => ({ observations: [...observations], causes: [...causes] }), [observations, causes])
  const solutions = useMemo(() => model.solutions ?? [], [model.solutions])
  const experiments = useMemo(() => model.experiments ?? [], [model.experiments])
  const work = useMemo<ObservationWork>(
    () => ({ ...analysis, solutions: [...solutions], experiments: [...experiments] }), [analysis, solutions, experiments])
  const plans = useMemo<SolutionPlan[]>(() => (model.transitions ?? []).map(solutionPlanOf), [model.transitions])
  const context = useMemo<SolutionContext>(() => ({
    causes, experiments, plans, decisions: (model.decisions ?? []).map((one) => ({ id: one.id, status: one.status })),
  }), [causes, experiments, plans, model.decisions])
  const scopeLabel = props.scopeLabel ?? ((path: string) => path)
  const here = useMemo<ScopeAnalysis>(() => ({ scope: props.path ?? '', ...work }), [props.path, work])
  /** The filters, View local and the look of the picture (ADR-0032 §8), over all three tabs. */
  const f = usePictureFilters({ here, below, saved: props.savedFilters, name: model.name, scopeLabel })
  const { labelOf } = f
  const { explainedAbove, explainedAboveOf } = props
  /** What the scopes over a scope explain of it: this one's handed in, one below's asked of the tree. */
  const aboveOf = useCallback(
    (scope: string) => (scope === here.scope ? explainedAbove : explainedAboveOf?.(scope)),
    [here.scope, explainedAbove, explainedAboveOf],
  )

  const [tab, setTab] = useState<Tab>('register')
  const [readerWidth, setReaderWidth] = useState<Record<Tab, number>>({
    register: READER.register.default, analysis: READER.analysis.default, solutions: READER.solutions.default,
  })
  const [wholeChain, setWholeChain] = useState(false)
  const [showDropped, setShowDropped] = useState(false)
  /** A solution being proposed, from a cause or from the bar. */
  const [proposing, setProposing] = useState<{ causeId?: string } | undefined>(undefined)
  const [addressing, setAddressing] = useState<Solution | undefined>(undefined)
  const [planning, setPlanning] = useState<Solution | undefined>(undefined)
  const [dropping, setDropping] = useState<Solution | undefined>(undefined)
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined)
  /**
   * The record being edited, by key. Edit mode is the selection's, so choosing
   * anything else reads it; while it holds, the picture steps aside and the
   * editor and its preview take the whole width.
   */
  const [editingKey, setEditingKey] = useState<string | undefined>(undefined)
  /** A right-click on a picture: what it landed on, and where. */
  const [menu, setMenu] = useState<{ target: PictureTarget; at: { x: number; y: number } } | undefined>(undefined)
  const [showMerged, setShowMerged] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  /** What is being archived: a dialog asks why first. */
  const [archiving, setArchiving] = useState<Observation | undefined>(undefined)
  /** What is being merged away: one of this scope's, or one of a scope below. */
  const [merging, setMerging] = useState<{ observation: Observation; scope?: string } | undefined>(undefined)
  const [deleting, setDeleting] = useState<{ kind: DeleteKind; id: string; label: string } | undefined>(undefined)

  // --- what is where ------------------------------------------------------------------

  /** The observations from below this scope has not folded into its own, and that are still open below. */
  const belowAll = useMemo(() => observationsBelow(below), [below])
  const belowShown = useMemo(
    () => belowAll.filter((one) => !absorbedBy(observations, one.observation.id, one.scope) && !isArchived(one.observation)),
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
  const editing = selected !== undefined && editingKey !== undefined && editingKey === selectedKey
  const readerMode = useMemo(() => ({
    mode: editing ? 'edit' as const : 'read' as const,
    setMode: (next: 'read' | 'edit') => setEditingKey(next === 'edit' ? selectedKey : undefined),
  }), [editing, selectedKey])

  useOpening({
    open, request: { id: initialId, nonce: initialNonce }, work, shown: recordIdOf(selected, selectedKey),
    onShown: props.onShown,
    land: ({ tab: to, key }) => { f.clear(); if (to) setTab(to); setSelectedKey(key) },
  })

  // --- changes ---------------------------------------------------------------------------

  /** Hand the lists back whole; what is not said is what it was. */
  const commit = useCallback((next: Partial<ObservationWork>) => {
    if (!readOnly) onChange({ ...work, ...next })
  }, [onChange, readOnly, work])
  /** The new observation and the link dialog, and where what they make lands (ADR-0032 §2, §6). */
  const forms = useAnalysisForms({
    work, below, local: f.viewLocal, path: props.path, scopeName: model.name, commit, readOnly, onChangeBelow: props.onChangeBelow,
    makeId, today, s, scopeLabel, nameOf, select: setSelectedKey, renderMarkdown: props.renderMarkdown,
  })
  /** Seen again, verified, an experiment concluded or reopened: the moves that ask first. */
  const lifecycle = useLifecycle({ lists: work, commit, today, nameOf, s, changeBelow: forms.changeBelow })
  const { seeAgain, verify, moveExperiment, dialogs } = lifecycle

  const patchCause = (id: string, patch: CausePatch) => commit({ ...analysis, causes: updateCause(causes, id, patch) })
  const rootOf = (cause: Cause) => rootToggle(cause, {
    lists: work, above: props.explainedAbove?.get(cause.id), commit, nameOf, scopeLabel, s, readOnly,
  })
  const archive = (id: string, note: string) => {
    commit({ ...analysis, observations: setArchived(observations, id, true, today(), note) })
    setArchiving(undefined)
  }
  const restore = (id: string) => commit({ ...analysis, observations: setArchived(observations, id, false, today()) })
  const merge = (from: Observation, into: string) => {
    commit(mergeObservations(analysis, from.id, into, today()))
    setMerging(undefined)
    setSelectedKey(into)
  }
  const absorb = (from: ObservationBelow, into: string) => {
    commit(absorbFromBelow(analysis, from, into, today()))
    setMerging(undefined)
    setSelectedKey(into)
  }
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
    setTab('solutions')
    setSelectedKey(solutionKey(fresh.id))
  }
  const move = (id: string, to: SolutionState) => {
    const result = moveSolution(solutions, id, to, today(), context)
    if (result.ok) commit({ solutions: result.solutions })
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

  // --- the register --------------------------------------------------------------------

  const { shows } = f
  const ownRows = sortObservations(observations)
    .filter((one) => (showMerged || !isMerged(observations, one.id)) && (showArchived || !isArchived(one)) && shows(one.id))
  const causeRows = sortCauses(causes).filter((one) => shows(one.id))
  const solutionRows = [...solutions].sort((a, b) => b.number - a.number)
    .filter((one) => (showArchived || isLive(one)) && shows(solutionKey(one.id)))
  const experimentRows = [...experiments].sort((a, b) => b.number - a.number).filter((one) => shows(experimentKey(one.id)))

  const analysedInto = analysedIntoOf(causes, below)
  const mergedLabel = (one: Observation) => mergedIntoOf(one, {
    observations, absorbedAbove, nameOf, scopeLabel,
    select: (id) => setSelectedKey(nodeKey(id)),
    ...(props.onOpenScope ? { openAbove: (path: string, id: string) => { onClose(); props.onOpenScope?.(path, id) } } : {}),
  })

  const register = (
    <ObservationRegister
      own={ownRows}
      below={f.rowsBelow(belowByScope)}
      causes={causeRows}
      solutions={solutionRows}
      experiments={experimentRows}
      analysisBelow={recordsBelow(below, here.scope, f.viewLocal, shows, showArchived)}
      empty={<EmptyRegister observations={observations} showArchived={showArchived} onShowArchived={() => setShowArchived(true)} filtering={f.result.filtering} s={s} />}
      selectedKey={selectedKey}
      onSelect={setSelectedKey}
      analysedInto={analysedInto}
      mergedInto={mergedLabel}
      phaseOf={(one) => phaseOf(one)}
      nameOf={nameOf}
      scopeLabel={scopeLabel}
      showMerged={showMerged}
      onShowMerged={setShowMerged}
      showArchived={showArchived}
      onShowArchived={setShowArchived}
      language={props.language}
      s={s}
    />
  )

  /** What the reading pane reads and asks — and the right-click on a record below, which offers what its reader does. */
  const { onOpenScope } = props
  const readerCtx: ReaderContext = {
    here: here.scope, work, below, plans, context, decisions: model.decisions ?? [], transitions: model.transitions ?? [],
    ...(explainedAbove ? { explainedAbove } : {}), explainedAboveOf: aboveOf,
    readOnly, today, scopeName: model.name, s, nameOf, scopeLabel, commit, forms, lifecycle,
    ask: {
      archive: setArchiving, merge: (observation, scope) => setMerging({ observation, ...(scope !== undefined ? { scope } : {}) }),
      remove: (kind, id) => setDeleting({ kind, id, label: nameOf(id) }), propose: (causeId) => setProposing({ causeId }),
      address: setAddressing, plan: setPlanning, drop: setDropping,
    },
    mergedLabel, openKey: setSelectedKey,
    ...(onOpenScope ? { openScope: (path: string) => { onClose(); onOpenScope(path) } } : {}),
    onDecide: props.onDecide, onStartPlan: props.onStartPlan, onOpenDecision: props.onOpenDecision, onOpenPlan: props.onOpenPlan,
    renderMarkdown: props.renderMarkdown, onAddImage: props.onAddImage, images: props.images,
  }

  // --- the analysis ----------------------------------------------------------------------

  const queue = liveObservations(observations).filter((one) => analysedInto(one.id).length === 0)
  /** The counts over the picture are the picture's: the scopes below while View local is on, less what the filters hid. */
  const counted = f.counts(aboveOf)
  const phases = [
    ['observation.phaseObserved', counted.observed], ['observation.phaseAnalysed', counted.analysed],
    ['observation.phaseAssumed', counted.assumed], ['observation.phaseVerified', counted.verified],
    ['observation.phaseRoots', counted.roots], ['observation.phaseOpenEnds', counted.openEnds],
  ] as const

  // --- the right-click ------------------------------------------------------------------

  /** A right-click selects what it landed on, the way a click does, and offers what can be done with it. */
  const openMenu = (target: PictureTarget, at: { x: number; y: number }) => {
    if (target.kind === 'node') setSelectedKey(target.key)
    setMenu({ target, at })
  }
  const editRecord = (key: string) => { setSelectedKey(key); setEditingKey(key) }
  const strengths = (current: CauseLink['strength'], choose: (strength: CauseLink['strength']) => void): MenuAction[] => (
    (['strong', 'normal', 'weak'] as const).map((strength) => ({
      key: `strength-${strength}`, label: s(STRENGTH_LABEL[strength]), checked: strength === current,
      onClick: () => { if (strength !== current) choose(strength) },
    }))
  )
  /**
   * What the menu offers: the reader's own actions for a record, in its own
   * words, and for a line the one thing a line is — how strong the link is,
   * or no link at all. Read-only offers nothing, so the menu does not open.
   */
  const menuActions = (target: PictureTarget): MenuAction[] => {
    if (readOnly) return []
    if (target.kind === 'explains') {
      const link = { id: target.id, ...(target.scope !== undefined ? { scope: target.scope } : {}) }
      return [
        ...strengths(target.strength, (strength) => commit({ ...analysis, causes: linkCause(causes, target.causeId, { ...link, strength }) })),
        { key: 'unlink', label: s('observation.unlink'), divider: true, danger: true, onClick: () => unlink(target.causeId, link) },
      ]
    }
    if (target.kind === 'addresses') {
      return [
        ...strengths(target.strength, (strength) => commit({ solutions: addressCause(solutions, target.solutionId, { id: target.causeId, strength }) })),
        {
          key: 'unlink', label: s('observation.unlink'), divider: true, danger: true,
          onClick: () => commit({ solutions: unaddressCause(solutions, target.solutionId, target.causeId) }),
        },
      ]
    }
    if (target.kind === 'tests') {
      return [
        ...strengths(target.strength, (strength) => commit({ experiments: setTestStrength(experiments, target.experimentId, target.solutionId, strength) })),
        {
          key: 'unlink', label: s('observation.unlink'), divider: true, danger: true,
          onClick: () => commit({ experiments: untestSolution(experiments, target.experimentId, target.solutionId) }),
        },
      ]
    }
    const key = target.key
    const held = resolve(key)
    if (!held) return []
    const edit: MenuAction = { key: 'edit', label: s('observation.edit'), onClick: () => editRecord(key) }
    const remove = (kind: 'observation' | 'cause' | 'solution' | 'experiment', id: string): MenuAction => ({
      key: 'delete', label: s('observation.delete'), divider: true, danger: true,
      onClick: () => setDeleting({ kind, id, label: nameOf(id) }),
    })
    switch (held.kind) {
      case 'observation': {
        const one = held.observation
        if (isArchived(one)) return [{ key: 'restore', label: s('observation.restore'), onClick: () => restore(one.id) }]
        if (mergedLabel(one)) return []
        return [
          edit,
          { key: 'seen', label: s('observation.seenAgain'), onClick: () => seeAgain(one) },
          { key: 'link', label: s('observation.link'), onClick: () => forms.openLink({ mode: 'cause', id: one.id }) },
          { key: 'merge', label: s('observation.merge'), onClick: () => setMerging({ observation: one }) },
          { key: 'archive', label: s('observation.archive'), onClick: () => setArchiving(one) },
          remove('observation', one.id),
        ]
      }
      case 'cause': {
        const one = held.cause
        return [
          edit,
          {
            key: 'verify', label: one.state === 'assumed' ? s('observation.verify') : s('observation.unverify'),
            onClick: () => (one.state === 'assumed' ? verify(one) : patchCause(one.id, { state: 'assumed' })),
          },
          rootOf(one).action,
          ...(isRootCause(one) ? [] : [{ key: 'link-deeper', label: s('observation.linkDeeper'), onClick: () => forms.openLink({ mode: 'deeper', id: one.id }) }]),
          ...(isRootCause(one) ? [{ key: 'propose', label: s('solution.proposeForCause'), onClick: () => setProposing({ causeId: one.id }) }] : []),
          remove('cause', one.id),
        ]
      }
      case 'solution': {
        const one = held.solution
        if (one.state === 'dropped') return [{ key: 'restore', label: s('solution.restore'), onClick: () => commit({ solutions: restoreSolution(solutions, one.id, today()) }) }]
        const gate = solutionGate(one, context)
        const decision = model.decisions?.find((record) => record.id === one.decision)
        const back = !(one.state === 'adopted' && decision?.status === 'accepted') ? previousState(one.state) : undefined
        const waitsOnDecision = gate?.items.some((item) => item.item === 'decisionAccepted' && !item.ok) && !one.decision && props.onDecide
        return [
          edit,
          ...(mayAddress(one) ? [{ key: 'address', label: s('solution.addressCause'), onClick: () => setAddressing(one) }] : []),
          ...(mayPlanExperiment(one) ? [{ key: 'plan-experiment', label: s('solution.planExperiment'), onClick: () => setPlanning(one) }] : []),
          ...(gate ? [{
            key: 'move', label: s('solution.moveOn', { state: s(PHASE_LABEL[gate.to]).toLowerCase() }), divider: true,
            disabled: openItems(gate).length > 0, onClick: () => move(one.id, gate.to),
          }] : []),
          ...(back ? [{ key: 'back', label: s('solution.moveBack', { state: s(PHASE_LABEL[back]).toLowerCase() }), divider: !gate, onClick: () => move(one.id, back) }] : []),
          ...(waitsOnDecision ? [{ key: 'decide', label: s('solution.proposeDecision'), onClick: () => props.onDecide?.(one.id) }] : []),
          ...(one.state === 'adopted' && !one.plan && props.onStartPlan ? [{ key: 'start-plan', label: s('solution.startPlan'), onClick: () => props.onStartPlan?.(one.id) }] : []),
          ...(one.state !== 'adopted' ? [{ key: 'drop', label: s('solution.drop'), divider: true, onClick: () => setDropping(one) }] : []),
          remove('solution', one.id),
        ]
      }
      case 'experiment': {
        const one = held.experiment
        return [edit, ...experimentMoveActions(one, s, (to) => moveExperiment(one, to)), remove('experiment', one.id)]
      }
      default:
        // A record of a scope below: what its reader offers.
        return belowMenuActions(held, readerCtx)
    }
  }

  const picture = (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <Box data-testid="analysis-phases" sx={{ display: 'flex', gap: 3, px: 2, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexWrap: 'wrap' }}>
        {phases.map(([key, count]) => (
          <Typography key={key} variant="body2" sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
            <Box component="b" sx={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{count}</Box>
            <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>{s(key)}</Box>
          </Typography>
        ))}
      </Box>
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
        s={s}
      />
      <PictureLegend size={f.view.size} local={f.viewLocal} s={s} />
    </Box>
  )

  /** The Solutions tab draws what the filters left, as the picture does. */
  const { visible, filtering } = f.result
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
  const rootCount = causes.filter((one) => isRootCause(one)).length
  const phaseCounts = (['idea', 'shaped', 'testing', 'proven', 'adopted', 'implemented'] as const)
    .map((phase) => [phase, solutions.filter((one) => phaseOf(one) === phase).length] as const)

  const solutionsView = (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <Box data-testid="solution-phases" data-guide="solutions.phases" sx={{ display: 'flex', gap: 3, px: 2, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexWrap: 'wrap', alignItems: 'center' }}>
        {phaseCounts.map(([phase, count]) => (
          <Typography key={phase} variant="body2" sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
            <Box component="b" sx={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{count}</Box>
            <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>{s(PHASE_LABEL[phase]).toLowerCase()}</Box>
          </Typography>
        ))}
        <Typography variant="caption" color="text.secondary" data-testid="solution-coverage">
          {s('solution.coverage', { count: rootCount - orphanRoots.length, total: rootCount })}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <FormControlLabel
          control={<Checkbox size="small" checked={wholeChain} onChange={(event) => setWholeChain(event.target.checked)} data-testid="solution-whole-chain" />}
          label={<Typography sx={{ fontSize: 12 }}>{s('solution.wholeChain')}</Typography>}
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={showDropped} onChange={(event) => setShowDropped(event.target.checked)} />}
          label={<Typography sx={{ fontSize: 12 }}>{s('solution.showDropped')}</Typography>}
        />
      </Box>
      <SolutionPicture graph={graph} selectedKey={selectedKey} onSelect={setSelectedKey} flags={flags} onMenu={openMenu} s={s} />
      <SolutionLegend s={s} />
    </Box>
  )

  const toAnalyse = queue.length > 0 && (
    <Box data-testid="analysis-queue" sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', maxHeight: '40%', overflow: 'auto' }}>
      <ListSubheader component="div" disableSticky sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>{s('observation.toAnalyse')}</ListSubheader>
      <List component="div" dense disablePadding>
        {queue.map((one) => (
          <ListItemButton key={one.id} selected={one.id === selectedKey} onClick={() => setSelectedKey(one.id)} sx={{ py: 0.25 }}>
            <ListItemText primary={`${formatObservationNumber(one.number)} ${one.title}`} slotProps={{ primary: { noWrap: true, sx: { fontSize: 12 } } }} />
            <Chip size="small" color={IMPACT_COLOR[one.impact]} label={s(IMPACT_LABEL[one.impact])} sx={{ height: 18, fontSize: 10 }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )

  // --- the reading pane ---------------------------------------------------------------------

  const reader = <RecordReader selected={selected} selectedKey={selectedKey} ctx={readerCtx} />

  const crumbNames = crumbTrail(props.crumbs, groupName, model.name)

  return (
    <PageDialog open={open} topInset={chrome.topInset} onClose={onClose} aria-label={s('observation.title')}>
      <LanguageProvider language={props.language}>
        <Box
          data-testid="observation-topbar"
          sx={{
            display: 'flex', flexWrap: 'wrap', rowGap: 0.5, alignItems: 'center', gap: 1, px: 1.5,
            pl: `${12 + bar.controlsInset}px`,
            WebkitAppRegion: bar.draggable ? 'drag' : undefined,
            '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
            minHeight: 48, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0,
          }}
        >
          <Tooltip title={s('observation.close')}>
            <IconButton size="small" aria-label={s('observation.close')} onClick={onClose}>
              <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>‹</Box>
            </IconButton>
          </Tooltip>
          <Typography variant="body2" color="text.secondary" data-testid="observation-crumbs" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {crumbNames.map((name, index) => <Fragment key={index}>{name} &nbsp;/&nbsp; </Fragment>)}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{s('observation.title')}</Box>
          </Typography>
          <ToggleButtonGroup exclusive size="small" value={tab} onChange={(_e, value: Tab | null) => { if (value) { setTab(value); setEditingKey(undefined) } }} sx={{ ml: 2 }}>
            <ToggleButton value="register" data-testid="observation-tab-register" data-guide="observations.tabRegister">{s('observation.tabRegister')}</ToggleButton>
            <ToggleButton value="analysis" data-testid="observation-tab-analysis" data-guide="observations.tabAnalysis">{s('observation.tabAnalysis')}</ToggleButton>
            <ToggleButton value="solutions" data-testid="observation-tab-solutions" data-guide="observations.tabSolutions">{s('solution.tab')}</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ flex: 1 }} />
          {!readOnly && (
            <>
              {tab === 'solutions'
                ? <Button size="small" variant="contained" onClick={() => setProposing(preselectedCause(causes, selected))} sx={{ textTransform: 'none' }} data-testid="solution-new" data-guide="solutions.new">+ {s('solution.new')}</Button>
                : <Button size="small" variant="contained" onClick={forms.openNew} sx={{ textTransform: 'none' }} data-guide="observations.new">+ {s('observation.new')}</Button>}
            </>
          )}
        </Box>
        {!editing && <PictureToolbar f={f} tab={tab} scopeLabel={labelOf} s={s} />}

        {/* Editing gives the record the whole width — the editor on the left, its
            preview on the right — and reading puts the picture back beside it. */}
        <Box
          data-testid="observation-body"
          data-editing={editing ? 'true' : undefined}
          sx={{ display: 'grid', gridTemplateColumns: editing ? 'minmax(0, 1fr)' : `minmax(0, 1fr) auto ${readerWidth[tab]}px`, flex: 1, minHeight: 0 }}
        >
          {!editing && (tab === 'register' ? register : tab === 'analysis' ? picture : solutionsView)}
          {!editing && (
            <SeamResizer
              orientation="vertical"
              region="after"
              value={readerWidth[tab]}
              min={READER[tab].min}
              max={READER[tab].max}
              defaultValue={READER[tab].default}
              onChange={(next) => setReaderWidth((held) => ({ ...held, [tab]: next }))}
              label={s('observation.resizeReader')}
            />
          )}
          <Box sx={{ minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <ReaderModeContext.Provider value={readerMode}>
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{reader}</Box>
            </ReaderModeContext.Provider>
            {tab === 'analysis' && !editing && toAnalyse}
          </Box>
        </Box>
        <PictureMenu at={menu?.at} actions={menu ? menuActions(menu.target) : []} onClose={() => setMenu(undefined)} />

        {forms.dialogs}
        {dialogs}
        <ArchiveDialog
          subject={archiving ? { id: archiving.id, label: nameOf(archiving.id) } : undefined}
          onCancel={() => setArchiving(undefined)}
          onConfirm={(note) => { if (archiving) archive(archiving.id, note) }}
          s={s}
        />
        {/* An observation from below is merged INTO one of this scope's: the
            rules absorb it here without touching the scope it lives in. */}
        <MergeDialog
          target={merging?.observation}
          candidates={liveObservations(observations).filter((one) => one.id !== merging?.observation.id)}
          onCancel={() => setMerging(undefined)}
          onConfirm={(into) => {
            if (!merging) return
            if (merging.scope !== undefined) absorb({ scope: merging.scope, observation: merging.observation }, into)
            else merge(merging.observation, into)
          }}
          s={s}
        />
        <NewSolutionDialog
          open={Boolean(proposing)}
          causes={causesForProposal(causes)}
          causeId={proposing?.causeId}
          onCancel={() => setProposing(undefined)}
          onCreate={proposeSolution}
          renderMarkdown={props.renderMarkdown}
          s={s}
        />
        <AddressDialog
          subject={addressing ? { id: addressing.id, label: nameOf(addressing.id) } : undefined}
          candidates={causesForProposal(causes).filter((one) => !addressing?.addresses.some((address) => address.id === one.id))}
          onCancel={() => setAddressing(undefined)}
          onConfirm={({ causeId, strength }) => {
            if (addressing) commit({ solutions: addressCause(solutions, addressing.id, { id: causeId, strength }) })
            setAddressing(undefined)
          }}
          s={s}
        />
        <NewExperimentDialog
          subject={planning ? { id: planning.id, label: nameOf(planning.id) } : undefined}
          onCancel={() => setPlanning(undefined)}
          onCreate={(fields) => { if (planning) addExperiment(planning, fields) }}
          s={s}
        />
        <DropDialog
          subject={dropping ? { id: dropping.id, label: nameOf(dropping.id) } : undefined}
          onCancel={() => setDropping(undefined)}
          onConfirm={(note) => {
            if (dropping) commit({ solutions: dropSolution(solutions, dropping.id, note, today()) })
            setDropping(undefined)
          }}
          s={s}
        />
        <ConfirmDialog
          open={Boolean(deleting)}
          title={deleting ? s(DELETE_TITLE[deleting.kind], { name: deleting.label }) : ''}
          body={deleting ? s(DELETE_BODY[deleting.kind]) : ''}
          confirmLabel={s('observation.delete')}
          cancelLabel={s('common.cancel')}
          onCancel={() => setDeleting(undefined)}
          onConfirm={remove}
        />
      </LanguageProvider>
    </PageDialog>
  )
}
