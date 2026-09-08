/**
 * A plan for changing the landscape (ADR-0009).
 *
 * Dates on the facts say *what* will be true and *when*. This says who decided
 * it, why, over what window, and what it costs — the missing link between a
 * retirement date on an application and the decision record that argued for it.
 *
 * ## Why it is a record and not a description
 *
 * A plan written as prose on an element is a plan nothing can list, filter or
 * check. As a record it is one file, numbered per project, and it arrives in
 * the folder, in git, in search, in the diff, in the Activity list and at the
 * agent for free — because every one of those already knows how to handle a
 * numbered record with a body.
 *
 * ## Why it does not lock, when a decision does
 *
 * `updateAdr` refuses an accepted record, because a decision records a moment
 * and a record that can be rewritten afterwards is not a record of one. A plan
 * is the opposite: it describes work, work changes, and a plan that could not
 * be corrected would be abandoned for a spreadsheet within a week. What locking
 * was protecting — knowing what the plan said last Tuesday — is what ADR-0008
 * built, and a plan gets it by being one file in a folder with a history.
 *
 * `done` and `abandoned` end a plan for the roadmap's purposes. They do not
 * seal it.
 *
 * ## What it owns, and what it does not
 *
 * It **names** elements and decisions. It does **not** own the dates on those
 * elements: those are fields on the elements themselves, so the canvas can draw
 * a landscape on a day without knowing that plans exist. What it offers instead
 * is {@link shiftDays} — move this plan and everything it introduced by N days,
 * as one step, because a plan slipping is one thing that happened.
 */
import { isDay } from './lifecycle'
import type { ElementId } from './types'

export type TransitionStatus = 'draft' | 'agreed' | 'running' | 'done' | 'abandoned'

/** In workflow order, which is the order a status picker shows them in. */
export const TRANSITION_STATUSES: readonly TransitionStatus[] =
  ['draft', 'agreed', 'running', 'done', 'abandoned']

/**
 * What a plan does to one element.
 *
 * Three verbs and no more. "Introduces" and "retires" are the two halves of a
 * replacement and are what the roadmap's checks read; "changes" is everything
 * else that is worth naming without being either.
 */
export type TransitionRole = 'introduces' | 'retires' | 'changes'

export type TransitionElement = {
  elementId: ElementId
  role: TransitionRole
}

export type TransitionMilestone = {
  /** `yyyy-mm-dd`. */
  date: string
  name: string
}

export type Transition = {
  /** Stable, never shown. The number is what people call it. */
  id: string
  /** Sequential within the project; `TR-0003` on screen. Never reused. */
  number: number
  title: string
  status: TransitionStatus
  /** The window the work runs over, `yyyy-mm-dd`. Either may be absent. */
  from?: string
  to?: string
  /** Who answers for it. */
  owner?: string
  /** What it does to the landscape. */
  elements: TransitionElement[]
  /** The ids of the decision records it rests on. */
  decisions: string[]
  milestones: TransitionMilestone[]
  /**
   * Markdown: the goal, the approach, the phases, the risks and the rollback —
   * and the ```business-case block, which is where the money lives.
   */
  body: string
}

/** Ended for the roadmap's purposes. Not sealed: see the note at the top. */
export function isTransitionFinished(transition: Pick<Transition, 'status'>): boolean {
  return transition.status === 'done' || transition.status === 'abandoned'
}

/**
 * Where a plan may go from here.
 *
 * Every arrow is reversible except the two that end it, and even those can be
 * reopened by going back to `running` — a plan that turned out not to be
 * finished is a normal thing, where a decision that turned out not to be
 * decided is not.
 */
export function transitionsFrom(status: TransitionStatus): readonly TransitionStatus[] {
  switch (status) {
    case 'draft': return ['agreed', 'abandoned']
    case 'agreed': return ['running', 'draft', 'abandoned']
    case 'running': return ['done', 'agreed', 'abandoned']
    case 'done': return ['running']
    case 'abandoned': return ['draft']
  }
}

/** Move a plan to another status, or leave it exactly as it is. */
export function setTransitionStatus(
  transition: Transition,
  next: TransitionStatus,
): Transition {
  if (!transitionsFrom(transition.status).includes(next)) return transition
  return { ...transition, status: next }
}

/** The next number for a project's plans. Sequential, and never reused. */
export function nextTransitionNumber(list: readonly Transition[]): number {
  return list.reduce((highest, one) => Math.max(highest, one.number), 0) + 1
}

/** `TR-0003`, which is what people say out loud. */
export function transitionLabel(transition: Pick<Transition, 'number'>): string {
  return `TR-${String(Math.max(0, Math.trunc(transition.number))).padStart(4, '0')}`
}

/**
 * A plan by its id or by what people call it — `TR-3`, `tr-0003`, or the bare
 * number — because the label is what a document names and what an agent is
 * handed back by every list. The id wins when both would match.
 */
export function findTransition<T extends Pick<Transition, 'id' | 'number'>>(
  list: readonly T[],
  idOrLabel: string,
): T | undefined {
  const byId = list.find((one) => one.id === idOrLabel)
  if (byId) return byId
  const match = /^(?:tr-?)?0*(\d+)$/i.exec(idOrLabel.trim())
  if (!match) return undefined
  const number = Number(match[1])
  return list.find((one) => one.number === number)
}

/** Oldest first, which is the order a plan of work reads in. */
export function sortTransitions(list: readonly Transition[]): Transition[] {
  return [...list].sort((a, b) => a.number - b.number)
}

/** The plans that touch this element, in number order. */
export function transitionsForElement(
  list: readonly Transition[],
  elementId: ElementId,
): Transition[] {
  return sortTransitions(list.filter((one) => one.elements.some((e) => e.elementId === elementId)))
}

/** The elements a plan gives this role to. */
export function elementsWithRole(transition: Transition, role: TransitionRole): ElementId[] {
  return transition.elements.filter((e) => e.role === role).map((e) => e.elementId)
}

/**
 * Every day this plan has an opinion about, in order: the window's ends and
 * every milestone.
 */
export function transitionDays(transition: Transition): string[] {
  const days = [transition.from, transition.to, ...transition.milestones.map((m) => m.date)]
  return [...new Set(days.filter(isDay))].sort()
}

/**
 * The same plan, moved by a number of days.
 *
 * Every date it owns and nothing else — the window and the milestones. The
 * dates on the elements it introduces and retires are the elements' own, and
 * the caller moves those in the same transaction (which is what makes a slip
 * one undo step). Doing it here would mean this file writing to elements it
 * only names.
 */
export function shiftDays(transition: Transition, days: number): Transition {
  const move = (day: string | undefined) => (isDay(day) ? addDays(day, days) : day)
  return {
    ...transition,
    ...(transition.from !== undefined ? { from: move(transition.from) } : {}),
    ...(transition.to !== undefined ? { to: move(transition.to) } : {}),
    milestones: transition.milestones.map((milestone) => (
      isDay(milestone.date) ? { ...milestone, date: addDays(milestone.date, days) } : milestone
    )),
  }
}

/**
 * A day, moved.
 *
 * UTC throughout, because a `yyyy-mm-dd` is a calendar day and not an instant:
 * building a local `Date` from one and adding days crosses a daylight-saving
 * boundary twice a year and lands on the day before.
 */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const moved = new Date(Date.UTC(year, month - 1, date + days))
  return moved.toISOString().slice(0, 10)
}
