// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What each stage lists, as the kit's list takes it (ADR-0021, ADR-0026, ADR-0032):
 * groups once per stage, in the order they should be picked up in, this scope's first
 * and each scope below's after them under its name. A row is the item and nothing
 * else. What else is known is in the preview, or a column somebody turned on, and a
 * quiet word is only where a row differs from the rows around it.
 *
 * What is listed is what the page hands in, the filters already applied.
 */
import type { ReactNode } from 'react'
import type { Language, Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { CommentBadge } from '../../comments/ui/CommentBadge'
import type { PersonNames } from '../../people/ui/names'
import type { ListColumn, ListGroup, ListRow, ListTone } from '../../widgets/kit/List'
import { byPickUp, byProgress, splitResults, splitSeen, splitWhy } from '../chain'
import { nodeKey, pictureKey } from '../graph'
import {
  causeLabel, formatObservationNumber, isArchived, isCauseMerged, isMerged, isRootCause, sortCauses, toneOf,
} from '../observation'
import type { Cause, Observation, ObservationBelow, ObservationTone, ScopeAnalysis } from '../observation'
import { IMPACT_LABEL, OUTCOME_LABEL, PHASE_LABEL, TONE_WORD } from '../observationScope'
import { formatExperimentNumber, formatSolutionNumber, isLive, rootsWithoutSolution, solutionPhase } from '../solution'
import type { Experiment, Solution, SolutionPlan } from '../solution'
import { experimentKey, solutionKey } from '../solutionGraph'
import type { ObservationStage } from '../tabs'
import { recordedByText } from './Readers'
import type { MergedInto } from './Readers'

export type StageData = {
  here: string
  observations: readonly Observation[]
  causes: readonly Cause[]
  solutions: readonly Solution[]
  experiments: readonly Experiment[]
  plans: readonly SolutionPlan[]
  /** The scopes below, each with what the page lists of it; none while they are off. */
  below: readonly (readonly [string, readonly ObservationBelow[]])[]
  analysisBelow: readonly ScopeAnalysis[]
  belowAll: readonly ObservationBelow[]
  analysedInto: (id: string, scope?: string) => readonly { key: string; label: string }[]
  mergedInto: (one: Observation) => MergedInto | undefined
  causeMergedInto: (cause: Cause, scope?: string) => MergedInto | undefined
  isOpenEnd: (key: string) => boolean
  shows: (key: string) => boolean
  showMerged: boolean
  showArchived: boolean
  scopeLabel: (path: string) => string
  names: PersonNames
  language: Language
  s: Translate
}

/** The columns somebody can turn on: everything the register's table had. */
export const OBSERVATION_COLUMNS = ['number', 'date', 'where', 'impact', 'seen', 'recordedBy', 'causes'] as const

export function observationColumns(s: Translate): ListColumn[] {
  const said = {
    number: s('observation.colNumber'), date: s('observation.colDate'), where: s('observation.colWhere'), impact: s('observation.colImpact'),
    seen: s('observation.colSeen'), recordedBy: s('observation.colRecordedBy'), causes: s('observation.colCauses'),
  }
  return OBSERVATION_COLUMNS.map((id) => ({ id, label: said[id], width: id === 'where' || id === 'causes' ? 'minmax(120px, 1fr)' : 'minmax(84px, 120px)' }))
}

const RAIL: Record<ObservationTone, ListTone> = { bright: 'good', problem: 'bad', neutral: 'neutral' }

function observationRow(one: Observation, scope: string | undefined, d: StageData, note?: string): ListRow {
  const { s } = d
  const key = nodeKey(one.id, scope)
  const into = d.analysedInto(one.id, scope)
  const recorder = one.recordedBy ? recordedByText(one.recordedBy, d.names, s) : ''
  const tone = toneOf(one)
  const toneWord = tone === 'bright' ? s('observation.toneBright') : undefined
  const said = note ?? toneWord
  const mark: ReactNode = scope === undefined ? <CommentBadge about={{ kind: 'observation', id: one.id }} /> : undefined
  // What kind it is, at a glance down the list; named in words where the row does not already say it.
  const rail = said === toneWord && toneWord ? { tone: RAIL[tone] } : { tone: RAIL[tone], label: s(TONE_WORD[tone]) }
  return {
    id: key, text: one.title, testId: `observation-row-${key}`, rail,
    ...(mark ? { mark } : {}), ...(said ? { note: said } : {}),
    cells: {
      number: <span className="chain-mono">{formatObservationNumber(one.number)}</span>,
      date: formatDay(one.date, d.language),
      where: one.where ?? '',
      impact: s(IMPACT_LABEL[one.impact]),
      seen: s('observation.seenTimes', { count: one.seen }),
      recordedBy: <span data-testid={`observation-recorded-by-${key}`}>{recorder || '—'}</span>,
      causes: into.length ? into.map((cause) => cause.label).join(', ') : s('observation.notAnalysed'),
    },
  }
}

const group = (id: string, label: string, rows: readonly ListRow[]): ListGroup[] => (rows.length ? [{ id, label, rows }] : [])

/** Seen: what waits for a why, in the order it should be picked up; what has one; what was noted; each scope below once. */
export function seenGroups(d: StageData): ListGroup[] {
  const { s } = d
  const own = d.observations.filter((one) => d.shows(one.id))
  const split = splitSeen(own, (id) => d.analysedInto(id).length > 0)
  const notedReason = (one: Observation) => [...one.history].reverse().find((event) => event.kind === 'noted')?.note
  const merged = d.showMerged ? own.filter((one) => isMerged(d.observations, one.id)) : []
  const archived = d.showArchived ? own.filter((one) => isArchived(one) && !isMerged(d.observations, one.id)) : []
  return [
    ...group('waiting', s('observation.groupWaiting'), split.waiting.map((one) => observationRow(one, undefined, d))),
    ...group('explained', s('observation.groupHasWhy'), split.explained.map((one) => observationRow(one, undefined, d))),
    ...group('noted', s('observation.groupNoted'), split.noted.map((one) => observationRow(one, undefined, d, notedReason(one)))),
    ...group('merged', s('observation.groupMerged'), merged.map((one) => observationRow(one, undefined, d, mergedWord(d.mergedInto(one), s)))),
    ...group('archived', s('observation.groupArchived'), archived.map((one) => observationRow(one, undefined, d, s('observation.archivedMark')))),
    ...d.below.flatMap(([scope, held]) => group(`below:${scope}`, s('observation.fromBelow', { scope: d.scopeLabel(scope) }),
      [...held].sort((a, b) => byPickUp(a.observation, b.observation)).map((one) => observationRow(one.observation, one.scope, d)))),
  ]
}

function mergedWord(merged: MergedInto | undefined, s: Translate): string {
  if (!merged) return s('observation.groupMerged')
  return merged.moved ? s('observation.movedTo', { name: merged.label, scope: merged.scope ?? '' }) : s('observation.mergedInto', { name: merged.label })
}

function causeRow(cause: Cause, key: string, d: StageData, scope?: string): ListRow {
  const merged = isMergedCause(cause, d, scope)
  return {
    id: key, code: causeLabel(cause), text: cause.title, testId: `cause-row-${key}`,
    ...(merged ? { note: mergedWord(d.causeMergedInto(cause, scope), d.s) } : {}),
  }
}

function isMergedCause(cause: Cause, d: StageData, scope?: string): boolean {
  const list = scope === undefined ? d.causes : d.analysisBelow.find((one) => one.scope === scope)?.causes ?? []
  return isCauseMerged(list, cause.id)
}

/** Why: what is not finished first, the root causes last, and each scope below once. */
export function whyGroups(d: StageData): ListGroup[] {
  const { s } = d
  const own = sortCauses(d.causes).filter((one) => d.shows(one.id) && (d.showMerged || !isCauseMerged(d.causes, one.id)))
  const split = splitWhy(own, (cause) => d.isOpenEnd(cause.id))
  return [
    ...group('openEnds', s('observation.groupOpenEnds'), split.openEnds.map((one) => causeRow(one, one.id, d))),
    ...group('causes', s('observation.groupCauses'), split.causes.map((one) => causeRow(one, one.id, d))),
    ...group('roots', s('observation.groupRoots'), split.roots.map((one) => causeRow(one, one.id, d))),
    ...d.analysisBelow.flatMap(({ scope, causes }) => group(`below:${scope}`, s('observation.fromBelow', { scope: d.scopeLabel(scope) }),
      causes.map((cause) => causeRow(cause, nodeKey(cause.id, scope), d, scope)))),
  ]
}

function solutionRow(one: Solution, key: string, d: StageData): ListRow {
  return {
    id: key, code: formatSolutionNumber(one.number), text: one.title, testId: `solution-row-${key}`,
    note: d.s(PHASE_LABEL[solutionPhase(one, d.plans)]),
  }
}

function experimentRow(one: Experiment, key: string, d: StageData): ListRow {
  return { id: key, code: formatExperimentNumber(one.number), text: one.title, testId: `experiment-row-${key}`, note: d.s(OUTCOME_LABEL[one.outcome]) }
}

/** Solve: what has no answer yet, then what is being done, furthest on last, and what is being tried. */
export function solveGroups(d: StageData): ListGroup[] {
  const { s } = d
  const roots = rootsWithoutSolution(d.causes, d.solutions).filter((one) => d.shows(one.id))
  const solutions = d.solutions.filter((one) => d.shows(solutionKey(one.id)))
  const live = solutions.filter(isLive).sort(byProgress(d.plans))
  const dropped = d.showArchived ? solutions.filter((one) => !isLive(one)) : []
  const experiments = [...d.experiments].sort((a, b) => b.number - a.number).filter((one) => d.shows(experimentKey(one.id)))
  return [
    ...group('noSolution', s('solution.groupNoSolution'), roots.filter((one) => isRootCause(one)).map((one) => causeRow(one, one.id, d))),
    ...group('solutions', s('solution.solutions'), live.map((one) => solutionRow(one, solutionKey(one.id), d))),
    ...group('dropped', s('solution.groupDropped'), dropped.map((one) => solutionRow(one, solutionKey(one.id), d))),
    ...group('experiments', s('solution.experiments'), experiments.map((one) => experimentRow(one, experimentKey(one.id), d))),
    ...d.analysisBelow.flatMap(({ scope, solutions: held, experiments: tried }) => group(`below:${scope}`, s('observation.fromBelow', { scope: d.scopeLabel(scope) }), [
      ...held.map((one) => ({ ...solutionRow(one, nodeKey(solutionKey(one.id), scope), d), note: d.s(PHASE_LABEL[solutionPhase(one, [])]) })),
      ...tried.map((one) => experimentRow(one, nodeKey(experimentKey(one.id), scope), d)),
    ])),
  ]
}

/** Did it work: what came back first, because it is the reason to look. */
export function resultGroups(d: StageData): ListGroup[] {
  const { s } = d
  const split = splitResults(d.solutions, { observations: [...d.observations], causes: [...d.causes] }, d.belowAll, d.plans)
  const built = (solution: Solution, since: string): ListRow => ({
    ...solutionRow(solution, solutionKey(solution.id), d), note: s('solution.builtOn', { date: formatDay(since, d.language) }),
  })
  return [
    ...group('seenAgain', s('solution.groupSeenAgain'), split.seenAgain.map(({ solution, since }) => built(solution, since))),
    ...group('quiet', s('solution.groupQuiet'), split.quiet.map(({ solution, since }) => built(solution, since))),
    ...group('building', s('solution.groupBuilding'), split.waiting.map((one) => solutionRow(one, solutionKey(one.id), d))),
  ]
}

/** What a stage lists. */
export function stageGroups(stage: ObservationStage, d: StageData): ListGroup[] {
  return stage === 'register' ? seenGroups(d) : stage === 'analysis' ? whyGroups(d) : stage === 'solutions' ? solveGroups(d) : resultGroups(d)
}

const rowsIn = (groups: readonly ListGroup[]) => groups.reduce((sum, one) => sum + one.rows.length, 0)

/**
 * How many rows the filters and the scopes below being off keep from this stage's
 * list: the list itself drawn with neither, less the list as it stands, so the
 * number is rows a person would get back and never the page's count of records.
 * What *View* chose to leave out, merged and archived, stays left out on both sides.
 */
export function hiddenRows(
  stage: ObservationStage, d: StageData, allBelow: StageData['below'], allAnalysisBelow: StageData['analysisBelow'],
): number {
  const everything: StageData = { ...d, shows: () => true, below: allBelow, analysisBelow: allAnalysisBelow }
  return rowsIn(stageGroups(stage, everything)) - rowsIn(stageGroups(stage, d))
}

/**
 * The records of the scopes below as the lists take them: what the filters left of
 * each scope's causes, solutions and experiments — a dropped solution only where
 * archived records are shown, as here — and none while the scopes below are off.
 */
export function recordsBelow(
  below: readonly ScopeAnalysis[], here: string, viewLocal: boolean, shows: (key: string) => boolean, showArchived: boolean,
  showMerged = false,
): ScopeAnalysis[] {
  if (!viewLocal) return []
  return below.map((one) => {
    const keep = (key: string) => shows(pictureKey(here, one.scope, key))
    return {
      ...one,
      observations: [],
      causes: sortCauses(one.causes).filter((cause) => (showMerged || !isCauseMerged(one.causes, cause.id)) && keep(cause.id)),
      solutions: [...one.solutions].sort((a, b) => b.number - a.number).filter((held) => (showArchived || isLive(held)) && keep(solutionKey(held.id))),
      experiments: [...one.experiments].sort((a, b) => b.number - a.number).filter((held) => keep(experimentKey(held.id))),
    }
  })
}
