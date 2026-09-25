// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Everything a scope observed in one place, and the analysis the team makes
 * of it (ADR-0021): a register of the observations — this scope's own and the
 * ones the scopes below shared — with the record beside it, and a second tab
 * that draws the observations analysed into causes and causes into root
 * causes, with the same reading pane for whatever is clicked. A third tab
 * (ADR-0026) takes the causes on: solutions proposed for them, vetted through
 * their gates, tested, decided and built, and asked afterwards whether the
 * sightings stopped.
 *
 * **One list per scope, read upward.** This scope's observations and causes
 * are two arrays on its model and go back whole (`onChange`), so the caller
 * commits one model change. An observation a scope below marked `shared` is
 * read here off the tree, may be linked to a cause here and may be folded
 * into an observation here — and is otherwise **edited where it lives**, the
 * rule every record follows.
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
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { LanguageProvider } from '../../i18n'
import { matchesQuery } from '../../model'
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
import {
  absorbShared, absorbedBy, explainedBy, formatCauseNumber, formatObservationNumber, isMerged, isRootCause,
  linkCause, liveObservations, mergeObservations, newCause, newObservation, nextCauseNumber,
  isArchived, nextObservationNumber, removeCause, removeObservation, seenAgain, setArchived, setShared,
  sortCauses, sortObservations, unlinkCause, updateCause, updateObservation,
} from '../observation'
import type {
  Analysis, Cause, CauseLink, CausePatch, Observation, ObservationPatch, SharedObservation,
} from '../observation'
import { nodeKey } from '../graph'
import { IMPACT_COLOR, IMPACT_LABEL, STATE_COLOR, STATE_LABEL } from '../observationScope'
import { AnalysisPicture, PictureLegend } from './AnalysisPicture'
import { ArchiveDialog, LinkDialog, MergeDialog, NewCauseDialog, NewObservationDialog } from './ObservationDialogs'
import { CauseReader, ObservationReader } from './Readers'
import {
  addressCause, alternatives, concludeExperiment, defaultStrength, dropSolution, experimentsFor, forgetCause,
  formatExperimentNumber, formatSolutionNumber, implementedOn, isLive, moveSolution, newExperiment, newSolution,
  nextExperimentNumber, nextSolutionNumber, planExperiment, removeExperiment, removeSolution, restoreSolution,
  rootsWithoutSolution, seenSinceImplemented, solutionGate, solutionPhase, solutionQuestions, unaddressCause, underneath,
  updateExperiment, updateSolution, waiveExperiment,
} from '../solution'
import type {
  Experiment, ExperimentOutcome, ExperimentPatch, Solution, SolutionContext, SolutionPatch, SolutionPhase,
  SolutionPlan, SolutionState, SolutionWork,
} from '../solution'
import { causesForProposal, experimentKey, solutionGraph, solutionKey } from '../solutionGraph'
import { PHASE_COLOR, PHASE_LABEL, QUESTION_LABEL } from '../observationScope'
import { SolutionLegend, SolutionPicture } from './SolutionPicture'
import { ExperimentReader, SolutionReader } from './SolutionReaders'
import { AddressDialog, DropDialog, NewExperimentDialog, NewSolutionDialog } from './SolutionDialogs'

/** Everything the page hands back: the analysis and what is being done about it. */
export type ObservationWork = Analysis & SolutionWork

const ADR_STATUS_KEY = {
  proposed: 'adr.statusProposed', reviewing: 'adr.statusReviewing', accepted: 'adr.statusAccepted',
  rejected: 'adr.statusRejected', superseded: 'adr.statusSuperseded',
} as const
const PLAN_STATUS_KEY = {
  draft: 'plan.draft', agreed: 'plan.agreed', running: 'plan.running', done: 'plan.done', abandoned: 'plan.abandoned',
} as const

const label4 = (prefix: string, number: number) => `${prefix}-${String(Math.max(0, Math.trunc(number))).padStart(4, '0')}`

export type ObservationsPageProps = {
  open: boolean
  onClose: () => void
  model: HostModel
  groupName: string
  /** The observations the scopes below shared (ADR-0021), off the tree. */
  shared?: readonly SharedObservation[]
  /** What a scope below is called, for the headings; the path where the host cannot say. */
  scopeLabel?: (path: string) => string
  /** This scope's own observations that a scope above folded into one of its own, by id. */
  absorbedAbove?: ReadonlyMap<string, { by: string; into: string; intoTitle: string; date: string }>
  /** Whether there is a scope above to share with: the root has none. */
  canShare: boolean
  /** Open the scope an observation from below lives in. */
  onOpenScope?: (path: string) => void
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

export function ObservationsPage(props: ObservationsPageProps) {
  const {
    open, onClose, model, groupName, shared = [], onChange, initialId, readOnly = false, s, today, makeId,
    canShare, absorbedAbove,
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
  const plans = useMemo<SolutionPlan[]>(() => (model.transitions ?? []).map((one) => ({
    id: one.id, status: one.status, ...(one.to ? { to: one.to } : {}), elements: one.elements,
  })), [model.transitions])
  const context = useMemo<SolutionContext>(() => ({
    causes, experiments, plans, decisions: (model.decisions ?? []).map((one) => ({ id: one.id, status: one.status })),
  }), [causes, experiments, plans, model.decisions])
  const scopeLabel = props.scopeLabel ?? ((path: string) => path)

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
  const [query, setQuery] = useState('')
  const [showMerged, setShowMerged] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  /** What is being archived: a dialog asks why first. */
  const [archiving, setArchiving] = useState<Observation | undefined>(undefined)
  const [creatingCause, setCreatingCause] = useState(false)
  /** What is being merged away: one of this scope's, or one a scope below shared. */
  const [merging, setMerging] = useState<{ observation: Observation; scope?: string } | undefined>(undefined)
  const [linking, setLinking] = useState<{ key: string; label: string; link: Omit<CauseLink, 'strength'> } | undefined>(undefined)
  const [deleting, setDeleting] = useState<{ kind: 'observation' | 'cause' | 'solution' | 'experiment'; id: string; label: string } | undefined>(undefined)

  // --- what is where ------------------------------------------------------------------

  /** The observations from below this scope has not folded into its own, and that are still open below. */
  const sharedShown = useMemo(
    () => shared.filter((one) => !absorbedBy(observations, one.observation.id, one.scope) && !isArchived(one.observation)),
    [shared, observations],
  )
  const sharedByScope = useMemo(() => {
    const groups = new Map<string, SharedObservation[]>()
    for (const one of sharedShown) groups.set(one.scope, [...(groups.get(one.scope) ?? []), one])
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [sharedShown])

  const nameOf = useCallback((id: string, scope?: string): string => {
    if (scope !== undefined) {
      const held = shared.find((one) => one.scope === scope && one.observation.id === id)
      return held ? `${formatObservationNumber(held.observation.number)} ${held.observation.title} (${scopeLabel(scope)})` : `${id} (${scopeLabel(scope)})`
    }
    const observation = observations.find((one) => one.id === id)
    if (observation) return `${formatObservationNumber(observation.number)} ${observation.title}`
    const cause = causes.find((one) => one.id === id)
    if (cause) return `${formatCauseNumber(cause.number)} ${cause.title}`
    const solution = solutions.find((one) => one.id === id)
    if (solution) return `${formatSolutionNumber(solution.number)} ${solution.title}`
    const experiment = experiments.find((one) => one.id === id)
    if (experiment) return `${formatExperimentNumber(experiment.number)} ${experiment.title}`
    const decision = model.decisions?.find((one) => one.id === id)
    if (decision) return `${label4('ADR', decision.number)} ${decision.title}`
    const plan = model.transitions?.find((one) => one.id === id)
    return plan ? `${label4('TR', plan.number)} ${plan.title}` : id
  }, [shared, observations, causes, solutions, experiments, model.decisions, model.transitions, scopeLabel])

  const selected = useMemo(() => {
    if (!selectedKey) return undefined
    const solution = solutions.find((one) => solutionKey(one.id) === selectedKey)
    if (solution) return { kind: 'solution' as const, solution }
    const experiment = experiments.find((one) => experimentKey(one.id) === selectedKey)
    if (experiment) return { kind: 'experiment' as const, experiment }
    const cause = causes.find((one) => one.id === selectedKey)
    if (cause) return { kind: 'cause' as const, cause }
    const own = observations.find((one) => one.id === selectedKey)
    if (own) return { kind: 'observation' as const, observation: own }
    const below = shared.find((one) => nodeKey(one.observation.id, one.scope) === selectedKey)
    return below ? { kind: 'shared' as const, ...below } : undefined
  }, [selectedKey, causes, observations, shared, solutions, experiments])

  // Each opening starts on the newest standing observation — unless asked for
  // one, which the id honours. Read through a ref so a record changing while
  // the page is up does not reset the selection.
  const latestObservations = useRef(observations)
  latestObservations.current = observations
  const latestWork = useRef({ solutions, experiments })
  latestWork.current = { solutions, experiments }
  useEffect(() => {
    if (!open) return
    setQuery('')
    if (initialId) {
      // A solution or an experiment opens on its own tab, by its key or its bare id (ADR-0026).
      const solution = latestWork.current.solutions.find((one) => initialId === one.id || initialId === solutionKey(one.id))
      const experiment = latestWork.current.experiments.find((one) => initialId === one.id || initialId === experimentKey(one.id))
      const key = solution ? solutionKey(solution.id) : experiment ? experimentKey(experiment.id) : initialId
      if (solution || experiment) setTab('solutions')
      setSelectedKey(key)
      return
    }
    setTab('register')
    setSelectedKey(sortObservations(liveObservations(latestObservations.current))[0]?.id)
  }, [open, initialId])

  // --- changes ---------------------------------------------------------------------------

  /** Hand the lists back whole; what is not said is what it was. */
  const commit = useCallback((next: Partial<ObservationWork>) => {
    if (!readOnly) onChange({ ...work, ...next })
  }, [onChange, readOnly, work])

  const create = (fields: { title: string; where: string; by: string; impact: Observation['impact']; shared: boolean }) => {
    const fresh = newObservation({
      id: makeId('ob'), number: nextObservationNumber(observations), date: today(), t: s, ...fields,
    })
    commit({ observations: [...observations, fresh], causes: [...causes] })
    setCreating(false)
    setSelectedKey(fresh.id)
  }
  const createCause = (title: string): Cause => {
    const fresh = newCause({ id: makeId('ca'), number: nextCauseNumber(causes), title, t: s })
    return fresh
  }
  const addCause = (title: string) => {
    const fresh = createCause(title)
    commit({ observations: [...observations], causes: [...causes, fresh] })
    setCreatingCause(false)
    setSelectedKey(fresh.id)
  }
  const patchObservation = (id: string, patch: ObservationPatch) => commit({ ...analysis, observations: updateObservation(observations, id, patch) })
  const patchCause = (id: string, patch: CausePatch) => commit({ ...analysis, causes: updateCause(causes, id, patch) })
  const seen = (id: string) => commit({ ...analysis, observations: seenAgain(observations, id, today()) })
  const share = (id: string, on: boolean) => commit({ ...analysis, observations: setShared(observations, id, on, today()) })
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
  const absorb = (from: SharedObservation, into: string) => {
    commit(absorbShared(analysis, from, into, today()))
    setMerging(undefined)
    setSelectedKey(into)
  }
  const link = (choice: { causeId?: string; newTitle?: string; strength: CauseLink['strength'] }) => {
    if (!linking) return
    let list = [...causes]
    let causeId = choice.causeId
    if (!causeId) {
      const fresh = createCause(choice.newTitle ?? '')
      list = [...list, fresh]
      causeId = fresh.id
    }
    const linked = linkCause(list, causeId, { ...linking.link, strength: choice.strength })
    commit({ observations: [...observations], causes: linked })
    setLinking(undefined)
    setSelectedKey(causeId)
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

  const proposeSolution = (fields: { title: string; causeId?: string }) => {
    const fresh = newSolution({
      id: makeId('so'), number: nextSolutionNumber(solutions), title: fields.title, date: today(), t: s,
      ...(fields.causeId ? { addresses: [{ id: fields.causeId, strength: defaultStrength(fields.causeId, causes) }] } : {}),
    })
    commit({ solutions: [...solutions, fresh] })
    setProposing(undefined)
    setTab('solutions')
    setSelectedKey(solutionKey(fresh.id))
  }
  const patchSolution = (id: string, patch: SolutionPatch) => commit({ solutions: updateSolution(solutions, id, patch) })
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
  const patchExperiment = (id: string, patch: ExperimentPatch) => commit({ experiments: updateExperiment(experiments, id, patch) })
  const conclude = (id: string, outcome: ExperimentOutcome) => commit({ experiments: concludeExperiment(experiments, id, outcome) })

  const phaseOf = (one: Solution): SolutionPhase => solutionPhase(one, plans)
  const solutionsFor = (causeId: string) => solutions.filter((one) => one.addresses.some((address) => address.id === causeId))
  const orphanRoots = rootsWithoutSolution(causes, solutions)

  // --- the register --------------------------------------------------------------------

  const trimmed = query.trim()
  const matches = (one: Observation) => !trimmed || matchesQuery(trimmed, [one.title, one.body, one.where ?? '', one.by ?? '', formatObservationNumber(one.number)])
  const ownRows = sortObservations(observations)
    .filter((one) => (showMerged || !isMerged(observations, one.id)) && (showArchived || !isArchived(one)) && matches(one))
  const causeRows = sortCauses(causes).filter((one) => !trimmed || matchesQuery(trimmed, [one.title, one.body, formatCauseNumber(one.number)]))
  const solutionRows = [...solutions].sort((a, b) => b.number - a.number)
    .filter((one) => (showArchived || isLive(one)) && (!trimmed || matchesQuery(trimmed, [one.title, one.body, formatSolutionNumber(one.number)])))
  const experimentRows = [...experiments].sort((a, b) => b.number - a.number)
    .filter((one) => !trimmed || matchesQuery(trimmed, [one.title, one.body, one.hypothesis, formatExperimentNumber(one.number)]))

  const analysedInto = (id: string, scope?: string) => explainedBy(causes, id, scope)
  const mergedLabel = (one: Observation): { label: string; scope?: string; date?: string } | undefined => {
    const here = absorbedBy(observations, one.id)
    if (here) return { label: nameOf(here.id) }
    const above = absorbedAbove?.get(one.id)
    return above ? { label: above.intoTitle, scope: scopeLabel(above.by), date: above.date } : undefined
  }

  const observationRow = (one: Observation, scope?: string) => {
    const key = nodeKey(one.id, scope)
    const into = analysedInto(one.id, scope)
    const merged = scope === undefined ? mergedLabel(one) : undefined
    const archived = isArchived(one)
    return (
      <TableRow
        key={key}
        hover
        selected={key === selectedKey}
        onClick={() => setSelectedKey(key)}
        sx={{ cursor: 'pointer', opacity: merged || archived ? 0.55 : 1 }}
        data-testid={`observation-row-${key}`}
      >
        <TableCell sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {formatObservationNumber(one.number)}
        </TableCell>
        <TableCell sx={{ fontWeight: 600 }}>
          {one.title}
          {archived && <Chip size="small" variant="outlined" label={s('observation.archivedMark')} sx={{ height: 18, fontSize: 10, ml: 1 }} />}
        </TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>{one.date}</TableCell>
        <TableCell sx={{ fontSize: 12 }}>{one.where ?? ''}</TableCell>
        <TableCell><Chip size="small" color={IMPACT_COLOR[one.impact]} label={s(IMPACT_LABEL[one.impact])} sx={{ height: 18, fontSize: 10 }} /></TableCell>
        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{s('observation.seenTimes', { count: one.seen })}</TableCell>
        <TableCell sx={{ fontSize: 12 }}>
          {merged
            ? <Typography variant="caption" color="text.secondary">{merged.scope !== undefined ? s('observation.mergedAbove', { name: merged.label, scope: merged.scope, date: merged.date ?? '' }) : s('observation.mergedInto', { name: merged.label })}</Typography>
            : into.length
              ? into.map((cause) => <Chip key={cause.id} size="small" variant="outlined" label={formatCauseNumber(cause.number)} sx={{ height: 18, fontSize: 10, mr: 0.5 }} onClick={(event) => { event.stopPropagation(); setSelectedKey(cause.id) }} />)
              : <Typography variant="caption" color="text.secondary">{s('observation.notAnalysed')}</Typography>}
        </TableCell>
      </TableRow>
    )
  }

  const heading = (text: string) => (
    <TableRow>
      <TableCell colSpan={7} sx={{ bgcolor: 'background.default', py: 0.5, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'text.secondary' }}>{text}</TableCell>
    </TableRow>
  )

  const register = (
    <Box data-testid="observation-register" sx={{ overflow: 'auto', minHeight: 0, minWidth: 0, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={s('observation.searchPlaceholder')}
          slotProps={{ htmlInput: { 'aria-label': s('observation.searchField'), autoComplete: 'off' } }}
          sx={{ flex: 1 }}
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={showMerged} onChange={(event) => setShowMerged(event.target.checked)} />}
          label={<Typography sx={{ fontSize: 12 }}>{s('observation.showMerged')}</Typography>}
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />}
          label={<Typography sx={{ fontSize: 12 }}>{s('observation.showArchived')}</Typography>}
        />
      </Box>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>{s('observation.colNumber')}</TableCell>
            <TableCell>{s('observation.colTitle')}</TableCell>
            <TableCell>{s('observation.colDate')}</TableCell>
            <TableCell>{s('observation.colWhere')}</TableCell>
            <TableCell>{s('observation.colImpact')}</TableCell>
            <TableCell>{s('observation.colSeen')}</TableCell>
            <TableCell>{s('observation.colCauses')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {heading(s('observation.scopeHere'))}
          {ownRows.map((one) => observationRow(one))}
          {ownRows.length === 0 && (
            <TableRow><TableCell colSpan={7} sx={{ color: 'text.secondary' }}>{trimmed ? s('observation.searchEmpty', { query: trimmed }) : s('observation.listEmpty')}</TableCell></TableRow>
          )}
          {sharedByScope.map(([scope, held]) => (
            <Fragment key={scope}>
              {heading(s('observation.fromBelow', { scope: scopeLabel(scope) }))}
              {held.filter((one) => matches(one.observation)).map((one) => observationRow(one.observation, one.scope))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
      <List dense disablePadding data-testid="cause-list">
        <ListSubheader disableSticky sx={{ lineHeight: '32px', bgcolor: 'background.default' }}>{s('observation.causes')}</ListSubheader>
        {causeRows.map((cause) => (
          <ListItemButton key={cause.id} selected={cause.id === selectedKey} onClick={() => setSelectedKey(cause.id)} sx={{ py: 0.5 }}>
            <ListItemText
              primary={`${formatCauseNumber(cause.number)} ${cause.title}`}
              slotProps={{ primary: { fontSize: 13 } }}
            />
            {isRootCause(cause, causes) && <Chip size="small" variant="outlined" color="secondary" label={s('observation.rootCause')} sx={{ height: 18, fontSize: 10, mr: 1 }} />}
            <Chip size="small" color={STATE_COLOR[cause.state]} label={s(STATE_LABEL[cause.state])} sx={{ height: 18, fontSize: 10 }} />
          </ListItemButton>
        ))}
      </List>
      <List dense disablePadding data-testid="solution-list">
        <ListSubheader disableSticky sx={{ lineHeight: '32px', bgcolor: 'background.default' }}>{s('solution.solutions')}</ListSubheader>
        {solutionRows.map((one) => {
          const phase = phaseOf(one)
          return (
            <ListItemButton key={one.id} selected={solutionKey(one.id) === selectedKey} onClick={() => setSelectedKey(solutionKey(one.id))} sx={{ py: 0.5, opacity: isLive(one) ? 1 : 0.55 }}>
              <ListItemText primary={`${formatSolutionNumber(one.number)} ${one.title}`} slotProps={{ primary: { fontSize: 13 } }} />
              <Chip size="small" color={PHASE_COLOR[phase]} label={s(PHASE_LABEL[phase])} sx={{ height: 18, fontSize: 10 }} />
            </ListItemButton>
          )
        })}
      </List>
      <List dense disablePadding data-testid="experiment-list">
        <ListSubheader disableSticky sx={{ lineHeight: '32px', bgcolor: 'background.default' }}>{s('solution.experiments')}</ListSubheader>
        {experimentRows.map((one) => (
          <ListItemButton key={one.id} selected={experimentKey(one.id) === selectedKey} onClick={() => setSelectedKey(experimentKey(one.id))} sx={{ py: 0.5 }}>
            <ListItemText primary={`${formatExperimentNumber(one.number)} ${one.title}`} secondary={one.tests.map((id) => nameOf(id)).join(', ')} slotProps={{ primary: { fontSize: 13 }, secondary: { fontSize: 11 } }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )

  // --- the analysis ----------------------------------------------------------------------

  const queue = liveObservations(observations).filter((one) => analysedInto(one.id).length === 0)
  const sharedQueue = sharedShown.filter((one) => analysedInto(one.observation.id, one.scope).length === 0)
  const phases = [
    ['observation.phaseObserved', liveObservations(observations).length + sharedShown.length],
    ['observation.phaseAnalysed', liveObservations(observations).length + sharedShown.length - queue.length - sharedQueue.length],
    ['observation.phaseAssumed', causes.filter((one) => one.state === 'assumed').length],
    ['observation.phaseVerified', causes.filter((one) => one.state === 'verified').length],
    ['observation.phaseRoots', causes.filter((one) => isRootCause(one, causes)).length],
  ] as const

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
      <AnalysisPicture analysis={analysis} shared={sharedShown} selectedKey={selectedKey} onSelect={setSelectedKey} s={s} />
      <PictureLegend s={s} />
    </Box>
  )

  const graph = useMemo(
    () => solutionGraph(analysis, { solutions: [...solutions], experiments: [...experiments] }, plans, { shared: sharedShown, wholeChain, showDropped }),
    [analysis, solutions, experiments, plans, sharedShown, wholeChain, showDropped],
  )
  const flags = useMemo(() => {
    const found = new Map<string, { text: string; strong?: boolean }>()
    for (const cause of orphanRoots) found.set(cause.id, { text: s('solution.flagNoSolution') })
    for (const one of solutions) {
      const seenAgain = seenSinceImplemented(one, analysis, shared, plans)
      const questions = solutionQuestions(one, context)
      if (seenAgain.length) found.set(solutionKey(one.id), { text: s('solution.findingSeenAgain', { names: seenAgain.map((held) => nameOf(held.id, held.scope)).join(', ') }), strong: true })
      else if (questions.length) found.set(solutionKey(one.id), { text: questions.map((question) => s(QUESTION_LABEL[question])).join(' ') })
    }
    return found
  }, [orphanRoots, solutions, analysis, shared, plans, context, s, nameOf])
  const rootCount = causes.filter((one) => isRootCause(one, causes)).length
  const phaseCounts = (['idea', 'shaped', 'testing', 'proven', 'adopted', 'implemented'] as const)
    .map((phase) => [phase, solutions.filter((one) => phaseOf(one) === phase).length] as const)

  const solutionsView = (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <Box data-testid="solution-phases" sx={{ display: 'flex', gap: 3, px: 2, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexWrap: 'wrap', alignItems: 'center' }}>
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
      <SolutionPicture graph={graph} selectedKey={selectedKey} onSelect={setSelectedKey} flags={flags} s={s} />
      <SolutionLegend s={s} />
    </Box>
  )

  const toAnalyse = (queue.length + sharedQueue.length) > 0 && (
    <Box data-testid="analysis-queue" sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', maxHeight: '40%', overflow: 'auto' }}>
      <ListSubheader disableSticky sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>{s('observation.toAnalyse')}</ListSubheader>
      <List dense disablePadding>
        {queue.map((one) => (
          <ListItemButton key={one.id} selected={one.id === selectedKey} onClick={() => setSelectedKey(one.id)} sx={{ py: 0.25 }}>
            <ListItemText primary={`${formatObservationNumber(one.number)} ${one.title}`} slotProps={{ primary: { fontSize: 12, noWrap: true } }} />
            <Chip size="small" color={IMPACT_COLOR[one.impact]} label={s(IMPACT_LABEL[one.impact])} sx={{ height: 18, fontSize: 10 }} />
          </ListItemButton>
        ))}
        {sharedQueue.map((one) => {
          const key = nodeKey(one.observation.id, one.scope)
          return (
            <ListItemButton key={key} selected={key === selectedKey} onClick={() => setSelectedKey(key)} sx={{ py: 0.25 }}>
              <ListItemText primary={`${formatObservationNumber(one.observation.number)} ${one.observation.title}`} secondary={scopeLabel(one.scope)} slotProps={{ primary: { fontSize: 12, noWrap: true }, secondary: { fontSize: 11 } }} />
              <Chip size="small" color={IMPACT_COLOR[one.observation.impact]} label={s(IMPACT_LABEL[one.observation.impact])} sx={{ height: 18, fontSize: 10 }} />
            </ListItemButton>
          )
        })}
      </List>
    </Box>
  )

  // --- the reading pane ---------------------------------------------------------------------

  const openKey = (key: string) => setSelectedKey(key)
  const solutionReader = (one: Solution) => {
    const phase = phaseOf(one)
    const since = implementedOn(one, plans)
    const seenAgain = seenSinceImplemented(one, analysis, shared, plans)
    const decision = model.decisions?.find((held) => held.id === one.decision)
    const plan = model.transitions?.find((held) => held.id === one.plan)
    return (
      <SolutionReader
        key={one.id}
        solution={one}
        phase={phase}
        gate={solutionGate(one, context)}
        mayGoBack={!(one.state === 'adopted' && decision?.status === 'accepted')}
        questions={solutionQuestions(one, context)}
        addresses={one.addresses.map((address) => {
          const cause = causes.find((held) => held.id === address.id)
          return { id: address.id, label: nameOf(address.id), strength: address.strength, root: cause ? isRootCause(cause, causes) : false }
        })}
        experiments={experimentsFor(experiments, one.id).map((held) => ({ key: experimentKey(held.id), label: nameOf(held.id), outcome: held.outcome }))}
        alternatives={alternatives(one, solutions).map((held) => ({ key: solutionKey(held.id), label: nameOf(held.id), phase: phaseOf(held) }))}
        {...(decision ? { decision: { label: nameOf(decision.id), status: s(ADR_STATUS_KEY[decision.status]).toLowerCase() } } : {})}
        {...(plan ? { plan: { label: nameOf(plan.id), status: s(PLAN_STATUS_KEY[plan.status]).toLowerCase() } } : {})}
        {...(since ? {
          implemented: {
            since,
            observations: underneath(one, analysis).map((held) => ({
              key: nodeKey(held.id, held.scope),
              label: nameOf(held.id, held.scope),
              ...(() => {
                const seenOn = seenAgain.find((again) => again.id === held.id && again.scope === held.scope)?.date
                return seenOn ? { seenOn } : {}
              })(),
            })),
          },
        } : {})}
        readOnly={readOnly}
        s={s}
        renderMarkdown={props.renderMarkdown}
        nameOf={(id) => nameOf(id)}
        onUpdate={(patch) => patchSolution(one.id, patch)}
        onMove={(to) => move(one.id, to)}
        onWaive={(reason) => commit({ solutions: waiveExperiment(solutions, one.id, reason, today()) })}
        onAddress={() => setAddressing(one)}
        onUnaddress={(causeId) => commit({ solutions: unaddressCause(solutions, one.id, causeId) })}
        onPlanExperiment={() => setPlanning(one)}
        {...(props.onDecide ? { onDecide: () => props.onDecide?.(one.id) } : {})}
        {...(props.onStartPlan ? { onStartPlan: () => props.onStartPlan?.(one.id) } : {})}
        {...(decision && props.onOpenDecision ? { onOpenDecision: () => props.onOpenDecision?.(decision.id) } : {})}
        {...(plan && props.onOpenPlan ? { onOpenPlan: () => props.onOpenPlan?.(plan.id) } : {})}
        onDrop={() => setDropping(one)}
        onRestore={() => commit({ solutions: restoreSolution(solutions, one.id, today()) })}
        onDelete={() => setDeleting({ kind: 'solution', id: one.id, label: nameOf(one.id) })}
        onOpen={openKey}
        onAddImage={props.onAddImage}
        images={props.images}
      />
    )
  }
  const experimentReader = (one: Experiment) => (
    <ExperimentReader
      key={one.id}
      experiment={one}
      tests={one.tests.map((id) => ({ key: solutionKey(id), label: nameOf(id) }))}
      readOnly={readOnly}
      s={s}
      renderMarkdown={props.renderMarkdown}
      onUpdate={(patch) => patchExperiment(one.id, patch)}
      onConclude={(outcome) => conclude(one.id, outcome)}
      onDelete={() => setDeleting({ kind: 'experiment', id: one.id, label: nameOf(one.id) })}
      onOpen={openKey}
      onAddImage={props.onAddImage}
      images={props.images}
    />
  )

  const reader = !selected ? (
    <Box sx={{ p: 5, color: 'text.secondary' }}><Typography>{s('observation.noneSelected')}</Typography></Box>
  ) : selected.kind === 'solution' ? solutionReader(selected.solution)
    : selected.kind === 'experiment' ? experimentReader(selected.experiment)
    : selected.kind === 'cause' ? (
    <CauseReader
      key={selected.cause.id}
      cause={selected.cause}
      causes={causes}
      readOnly={readOnly}
      s={s}
      renderMarkdown={props.renderMarkdown}
      nameOf={nameOf}
      onUpdate={(patch) => patchCause(selected.cause.id, patch)}
      onLinkDeeper={() => setLinking({ key: selected.cause.id, label: nameOf(selected.cause.id), link: { id: selected.cause.id } })}
      onUnlink={(target) => unlink(selected.cause.id, target)}
      onUnlinkFrom={(causeId) => unlink(causeId, { id: selected.cause.id })}
      onDelete={() => setDeleting({ kind: 'cause', id: selected.cause.id, label: nameOf(selected.cause.id) })}
      onOpen={openKey}
      solutions={solutionsFor(selected.cause.id).map((one) => ({
        key: solutionKey(one.id), label: nameOf(one.id), note: s(PHASE_LABEL[phaseOf(one)]).toLowerCase(),
      }))}
      {...(readOnly ? {} : { onPropose: () => setProposing({ causeId: selected.cause.id }) })}
      onAddImage={props.onAddImage}
      images={props.images}
    />
  ) : (
    <ObservationReader
      key={selectedKey}
      observation={selected.observation}
      fromScope={selected.kind === 'shared' ? { path: selected.scope, label: scopeLabel(selected.scope) } : undefined}
      explainedBy={analysedInto(selected.observation.id, selected.kind === 'shared' ? selected.scope : undefined)
        .map((cause) => ({ cause, link: cause.explains.find((held) => held.id === selected.observation.id)! }))}
      mergedInto={selected.kind === 'observation' ? mergedLabel(selected.observation) : undefined}
      readOnly={readOnly}
      canShare={canShare}
      s={s}
      renderMarkdown={props.renderMarkdown}
      nameOf={nameOf}
      onUpdate={(patch) => patchObservation(selected.observation.id, patch)}
      onSeenAgain={() => seen(selected.observation.id)}
      onShare={(on) => share(selected.observation.id, on)}
      onArchive={() => setArchiving(selected.observation)}
      onRestore={() => restore(selected.observation.id)}
      onMerge={() => setMerging({ observation: selected.observation, ...(selected.kind === 'shared' ? { scope: selected.scope } : {}) })}
      onLink={() => setLinking({
        key: selectedKey!,
        label: nameOf(selected.observation.id, selected.kind === 'shared' ? selected.scope : undefined),
        link: { id: selected.observation.id, ...(selected.kind === 'shared' ? { scope: selected.scope } : {}) },
      })}
      onUnlink={(causeId) => unlink(causeId, { id: selected.observation.id, ...(selected.kind === 'shared' ? { scope: selected.scope } : {}) })}
      onDelete={() => setDeleting({ kind: 'observation', id: selected.observation.id, label: nameOf(selected.observation.id) })}
      onOpenScope={selected.kind === 'shared' && props.onOpenScope
        ? () => { onClose(); props.onOpenScope?.(selected.scope) }
        : undefined}
      onOpen={openKey}
      onAddImage={props.onAddImage}
      images={props.images}
    />
  )

  return (
    <PageDialog open={open} topInset={chrome.topInset} onClose={onClose} aria-label={s('observation.title')}>
      <LanguageProvider language={props.language}>
        <Box
          data-testid="observation-topbar"
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, px: 1.5,
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
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {groupName} &nbsp;/&nbsp; {model.name} &nbsp;/&nbsp;
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{s('observation.title')}</Box>
          </Typography>
          <ToggleButtonGroup exclusive size="small" value={tab} onChange={(_e, value: Tab | null) => { if (value) setTab(value) }} sx={{ ml: 2 }}>
            <ToggleButton value="register" data-testid="observation-tab-register">{s('observation.tabRegister')}</ToggleButton>
            <ToggleButton value="analysis" data-testid="observation-tab-analysis">{s('observation.tabAnalysis')}</ToggleButton>
            <ToggleButton value="solutions" data-testid="observation-tab-solutions">{s('solution.tab')}</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ flex: 1 }} />
          {!readOnly && (
            <>
              <Button size="small" onClick={() => setCreatingCause(true)}>+ {s('observation.newCause')}</Button>
              {tab === 'solutions'
                ? <Button size="small" variant="contained" onClick={() => setProposing({})} data-testid="solution-new">+ {s('solution.new')}</Button>
                : <Button size="small" variant="contained" onClick={() => setCreating(true)}>+ {s('observation.new')}</Button>}
            </>
          )}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: `minmax(0, 1fr) auto ${readerWidth[tab]}px`, flex: 1, minHeight: 0 }}>
          {tab === 'register' ? register : tab === 'analysis' ? picture : solutionsView}
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
          <Box sx={{ minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{reader}</Box>
            {tab === 'analysis' && toAnalyse}
          </Box>
        </Box>

        <NewObservationDialog open={creating} canShare={canShare} onCancel={() => setCreating(false)} onCreate={create} s={s} />
        <NewCauseDialog open={creatingCause} onCancel={() => setCreatingCause(false)} onCreate={addCause} s={s} />
        <ArchiveDialog
          subject={archiving ? { label: nameOf(archiving.id) } : undefined}
          onCancel={() => setArchiving(undefined)}
          onConfirm={(note) => { if (archiving) archive(archiving.id, note) }}
          s={s}
        />
        {/* A shared observation from below is merged INTO one of this scope's:
            the rules absorb it here without touching the scope it lives in. */}
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
        <LinkDialog
          subject={linking ? { label: linking.label } : undefined}
          candidates={causes.filter((one) => one.id !== linking?.key)}
          onCancel={() => setLinking(undefined)}
          onConfirm={link}
          s={s}
        />
        <NewSolutionDialog
          open={Boolean(proposing)}
          causes={causesForProposal(causes)}
          causeId={proposing?.causeId}
          onCancel={() => setProposing(undefined)}
          onCreate={proposeSolution}
          s={s}
        />
        <AddressDialog
          subject={addressing ? { label: nameOf(addressing.id) } : undefined}
          candidates={causesForProposal(causes).filter((one) => !addressing?.addresses.some((address) => address.id === one.id))}
          onCancel={() => setAddressing(undefined)}
          onConfirm={({ causeId, strength }) => {
            if (addressing) commit({ solutions: addressCause(solutions, addressing.id, { id: causeId, strength }) })
            setAddressing(undefined)
          }}
          s={s}
        />
        <NewExperimentDialog
          subject={planning ? { label: nameOf(planning.id) } : undefined}
          onCancel={() => setPlanning(undefined)}
          onCreate={(fields) => { if (planning) addExperiment(planning, fields) }}
          s={s}
        />
        <DropDialog
          subject={dropping ? { label: nameOf(dropping.id) } : undefined}
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
