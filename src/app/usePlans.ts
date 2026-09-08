/**
 * The roadmap, a plan's page and the Replace… dialog, wired to the session
 * (ADR-0009, ADR-0010).
 *
 * The three screens share one story: a replacement opens a plan, a plan sits
 * over the roadmap, and every one of their actions is a command through the
 * session so it is one undo step and one Activity line, like a node dragged.
 * What lives here is which page is up, what each may do, and where a person
 * lands when they leave one for the board or a decision. The pages
 * themselves stay in `roadmap/`; this is only the shell's side of them.
 *
 * Navigation out of the pages is the caller's: showing an element or a
 * decision means opening something this hook does not own, so it closes its
 * own pages and hands over. The caller closes them the same way, through
 * `closeAll`, before it opens a page of its own — the toolbar's pages are one
 * at a time.
 */
import { useCallback, useMemo, useState } from 'react'
import type { Translate } from '../i18n'
import {
  addDays, isDay, nextTransitionNumber, portCommands, portsOf, replacementCommands, shiftDays,
  transaction, transitionList, transitionsOf, unplannedPorts, unportCommands,
} from '../model'
import type { Command, DesignElement, ElementId, Transition } from '../model'
import type { MakeId } from '../model/keys'
import { planBodyTemplate } from '../roadmap'
import type { PlanActions, ReplaceAnswer, RoadmapActions } from '../roadmap'
import type { ModelSession } from './useModelSession'

/** Where a person goes when they leave these pages for something else. */
export type PlanNavigation = {
  /** Show an element on the canvas. */
  toElement: (id: ElementId) => void
  /** Open a decision record. */
  toDecision: (adrId: string) => void
}

export type Plans = {
  /** The axis, and the plans over it. */
  roadmapOpen: boolean
  openRoadmap: () => void
  closeRoadmap: () => void
  /** The plan being read on its own page; the roadmap stays open under it. */
  planId: string | undefined
  plan: Transition | undefined
  openPlan: (id: string) => void
  closePlan: () => void
  /** The element a replacement is being started from. */
  replacing: DesignElement | undefined
  startReplace: (elementId: ElementId) => void
  cancelReplace: () => void
  /** Replace… answered: everything it takes, as one transaction, then the plan. */
  confirmReplace: (answer: ReplaceAnswer) => void
  /** Every page and dialog of this hook, closed. */
  closeAll: () => void
  roadmapActions: RoadmapActions
  planActions: PlanActions
}

export function usePlans(deps: {
  session: ModelSession
  makeId: MakeId
  s: Translate
  navigate: PlanNavigation
}): Plans {
  const { session, makeId, s, navigate } = deps
  const [roadmapOpen, setRoadmapOpen] = useState(false)
  const [planId, setPlanId] = useState<string | undefined>(undefined)
  const [replacingId, setReplacingId] = useState<ElementId | undefined>(undefined)

  const closeAll = useCallback(() => {
    setRoadmapOpen(false)
    setPlanId(undefined)
    setReplacingId(undefined)
  }, [])
  const leaveFor = useCallback((go: () => void) => { closeAll(); go() }, [closeAll])

  /**
   * What the roadmap may do (ADR-0009). Every one of them is a command, so a
   * plan written, moved or thrown away is one undo step and one Activity line.
   */
  const roadmapActions = useMemo<RoadmapActions>(() => ({
    addTransition(title) {
      const model = session.indexed()
      const list = transitionList(model)
      const number = nextTransitionNumber(list)
      const id = makeId('tr')
      session.dispatch({
        type: 'transition.add',
        transition: {
          id, number, title, status: 'draft',
          elements: [], decisions: [], milestones: [], body: planBodyTemplate(s),
        },
      })
      setPlanId(id)
    },
    onOpenPlan(id) { setPlanId(id) },
    setAsOf(day) {
      const id = session.currentActiveId()
      if (!id) return
      session.dispatch({ type: 'diagram.update', id, patch: { asOf: day }, coalesce: `asOf:${id}` })
    },
    onOpenElement(id) { leaveFor(() => navigate.toElement(id)) },
  }), [session, makeId, s, navigate, leaveFor])

  /**
   * What a plan's page may do (ADR-0010). The dates on an element the plan
   * introduces or retires are written to the element, not to the plan — the
   * page is where they are set together, the element is where they live.
   */
  const planActions = useMemo<PlanActions>(() => ({
    updateTransition(id, patch) {
      session.dispatch({ type: 'transition.update', id, patch, coalesce: `plan:${id}` })
    },
    removeTransition(id) {
      session.dispatch({ type: 'transition.remove', id })
    },
    // The shift moves the plan's own window and the dates on the elements it
    // introduces and retires, in one transaction, because a plan slipping is
    // one thing that happened.
    shiftTransition(id, days) {
      const model = session.indexed()
      const plan = transitionsOf(model)[id]
      if (!plan || !days) return
      const moved = shiftDays(plan, days)
      const commands: Command[] = [{ type: 'transition.update', id, patch: moved }]
      for (const one of plan.elements) {
        if (one.role === 'changes') continue
        const element = model.elements[one.elementId]
        const dates = element?.lifecycleDates
        if (!element || !dates) continue
        const shifted = Object.fromEntries(
          Object.entries(dates).map(([phase, day]) => [phase, isDay(day) ? addDays(day, days) : day]),
        )
        commands.push({ type: 'element.update', id: one.elementId, patch: { lifecycleDates: shifted } })
      }
      session.dispatch(transaction(commands))
    },
    updateElementDates(id, lifecycleDates) {
      session.dispatch({ type: 'element.update', id, patch: { lifecycleDates }, coalesce: `dates:${id}` })
    },
    // A port is read off the live model at the moment it is written, so a
    // twin drawn since — by the agent, by hand — is re-dated rather than
    // doubled. Each is one transaction: the twin and the closed original.
    port(planId, connectionId, toId, on) {
      const plan = transitionsOf(session.indexed())[planId]
      const port = plan && portsOf(session.current(), plan).find((one) => one.from.id === connectionId)
      if (!port) return
      session.dispatch(transaction(portCommands(port, toId, on, () => session.ids.connection())))
    },
    portAll(planId, toId, on) {
      const plan = transitionsOf(session.indexed())[planId]
      if (!plan) return
      // Not dated by this plan, and not closed by another one either: a
      // line some other plan already moved is that plan's, and stays.
      const remaining = unplannedPorts(portsOf(session.current(), plan))
      if (remaining.length === 0) return
      session.dispatch(transaction(remaining.flatMap((port) => portCommands(port, toId, on, () => session.ids.connection()))))
    },
    unport(planId, connectionId) {
      const plan = transitionsOf(session.indexed())[planId]
      const port = plan && portsOf(session.current(), plan).find((one) => one.from.id === connectionId)
      if (!port) return
      session.dispatch(transaction(unportCommands(port)))
    },
    onOpenElement(id) { leaveFor(() => navigate.toElement(id)) },
    onOpenDecision(adrId) { leaveFor(() => navigate.toDecision(adrId)) },
  }), [session, navigate, leaveFor])

  /**
   * Replace… answered (ADR-0010): the new element, the dates, the successor,
   * the tap and the plan, as one transaction — then the plan's page, because
   * the next thing to do is on it.
   */
  const confirmReplace = useCallback((answer: ReplaceAnswer) => {
    const current = session.current()
    const from = current.elements.find((e) => e.id === answer.from[0]?.elementId)
    const to = answer.to
    const toName = 'name' in to ? to.name : current.elements.find((e) => e.id === to.elementId)?.name ?? ''
    const { commands, planId: id } = replacementCommands(current, {
      ...answer,
      words: {
        planTitle: s('replace.planTitle', { from: from?.name ?? '', to: toName }),
        tapLabel: s('replace.tap'),
        shadowMilestone: s('replace.shadowMilestone'),
        cutoverMilestone: s('replace.cutoverMilestone'),
        body: planBodyTemplate(s),
        owner: from?.owner,
      },
    }, {
      element: (name) => session.ids.element(name),
      connection: () => session.ids.connection(),
      transition: makeId('tr'),
    }, nextTransitionNumber(transitionList(session.indexed())))
    session.dispatch(transaction(commands))
    setReplacingId(undefined)
    setPlanId(id)
  }, [session, makeId, s])

  // Read off the model on every render rather than held: a plan deleted under
  // its page, or an element renamed under the dialog, is what is on screen.
  const plan = planId ? session.model.transitions?.find((one) => one.id === planId) : undefined
  const replacing = replacingId ? session.model.elements.find((e) => e.id === replacingId) : undefined

  return {
    roadmapOpen,
    openRoadmap: useCallback(() => setRoadmapOpen(true), []),
    closeRoadmap: useCallback(() => setRoadmapOpen(false), []),
    planId,
    plan,
    openPlan: useCallback((id: string) => setPlanId(id), []),
    closePlan: useCallback(() => setPlanId(undefined), []),
    replacing,
    startReplace: useCallback((elementId: ElementId) => setReplacingId(elementId), []),
    cancelReplace: useCallback(() => setReplacingId(undefined), []),
    confirmReplace,
    closeAll,
    roadmapActions,
    planActions,
  }
}
