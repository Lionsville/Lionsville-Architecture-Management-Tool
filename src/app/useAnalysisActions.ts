// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the decisions and observations pages hand back, as commands.
 *
 * The project's records live on the model, so a change to them is a change to
 * the model: a page hands back the whole list, and what actually moved becomes
 * one undo step, so ⌘Z puts back a record rather than a list.
 */
import { useCallback } from 'react'
import type { Translate } from '../i18n'
import {
  causeList, causesToCommands, decisionList, decisionsToCommands, experimentList, experimentsToCommands,
  nextTransitionNumber, observationList, observationsToCommands, replacement, solutionList, solutionsOf,
  solutionsToCommands, transaction, transitionList,
} from '../model'
import { newAdr, nextAdrNumber } from '../decisions/adr'
import type { Adr } from '../decisions/adr'
import type { ObservationWork } from '../observations/ui/ObservationsPage'
import { decisionBody, linkRecord } from '../observations/solution'
import { planBodyTemplate } from '../roadmap/planTemplate'
import type { MakeId } from './useDiagramActions'
import type { ModelSession } from './useModelSession'

export type AnalysisActions = {
  onDecisionsChange: (next: Adr[]) => void
  onAnalysisChange: (next: ObservationWork) => void
  onDecideSolution: (solutionId: string) => void
  onStartSolutionPlan: (solutionId: string) => void
}

export function useAnalysisActions(deps: {
  session: ModelSession
  makeId: MakeId
  today: () => string
  s: Translate
}): AnalysisActions {
  const { session, makeId, today, s } = deps
  const onDecisionsChange = useCallback((next: Adr[]) => {
    const commands = decisionsToCommands(session.indexed(), next)
    if (commands.length) session.dispatch(transaction(commands))
  }, [session])

  /** The observations page hands its four lists back (ADR-0021, ADR-0026); what moved is one undo step. */
  const onAnalysisChange = useCallback((next: ObservationWork) => {
    const indexed = session.indexed()
    const commands = [
      ...observationsToCommands(indexed, next.observations), ...causesToCommands(indexed, next.causes),
      ...solutionsToCommands(indexed, next.solutions), ...experimentsToCommands(indexed, next.experiments),
    ]
    if (commands.length) session.dispatch(transaction(commands))
  }, [session])

  /**
   * A solution's decision record, proposed from the Solutions tab (ADR-0026):
   * a new record on the Decisions page, every section written from the
   * records — what it addresses, what else was considered, what proved it,
   * what it brings and costs, what should stop being seen — and the link,
   * one step.
   */
  const onDecideSolution = useCallback((solutionId: string) => {
    const indexed = session.indexed()
    const solution = solutionsOf(indexed)[solutionId]
    if (!solution || solution.decision) return
    const day = today()
    const adr = newAdr({ id: makeId('adr'), number: nextAdrNumber(decisionList(indexed)), title: solution.title, date: day, t: s })
    adr.body = decisionBody(solution, {
      causes: causeList(indexed), solutions: solutionList(indexed), experiments: experimentList(indexed),
      observations: observationList(indexed),
    }, s)
    const [linked] = linkRecord([solution], solutionId, 'decision', adr.id, day)
    session.dispatch(transaction([
      { type: 'decision.add', decision: adr },
      { type: 'solution.update', id: solutionId, patch: replacement(solution, linked) },
    ]))
  }, [session, makeId, today, s])

  /** The plan that builds an adopted solution, resting on its decision record. One step. */
  const onStartSolutionPlan = useCallback((solutionId: string) => {
    const indexed = session.indexed()
    const solution = solutionsOf(indexed)[solutionId]
    if (!solution || solution.plan) return
    const id = makeId('tr')
    const [linked] = linkRecord([solution], solutionId, 'plan', id, today())
    session.dispatch(transaction([
      {
        type: 'transition.add',
        transition: {
          id, number: nextTransitionNumber(transitionList(indexed)), title: solution.title, status: 'draft',
          elements: [], decisions: solution.decision ? [solution.decision] : [], milestones: [], body: planBodyTemplate(s),
        },
      },
      { type: 'solution.update', id: solutionId, patch: replacement(solution, linked) },
    ]))
  }, [session, makeId, today, s])

  return { onDecisionsChange, onAnalysisChange, onDecideSolution, onStartSolutionPlan }
}
