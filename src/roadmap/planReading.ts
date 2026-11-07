// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a plan's page and the roadmap read off a plan, in days and ids and never in
 * words: which of the dated lines each plan moves, which boards it changes, what a
 * slip would do, and where a milestone falls against the window. Derived on every
 * read and stored nowhere, so there is nothing to keep in step.
 */
import { addDays, isDay } from '../model'
import { boardsDrawing, portsOf, shiftDays } from '../model'
import type { DesignDiagram, DesignModel, ElementId, Lifecycle, Transition } from '../model'
import type { RelationTrack } from './timeline'

/** One plan's lines, the generation that ends and the one that starts: two groups, and not forty rows. */
export type PlanLines = { plan: Transition; ending: RelationTrack[]; starting: RelationTrack[] }

export type ConnectionGroups = { byPlan: PlanLines[]; inNoPlan: RelationTrack[] }

export function connectionGroups(
  model: Pick<DesignModel, 'elements' | 'relations'>,
  plans: readonly Transition[],
  tracks: readonly RelationTrack[],
): ConnectionGroups {
  const byId = new Map(tracks.map((track) => [track.relation.id, track]))
  const claimed = new Set<string>()
  const byPlan: PlanLines[] = []
  for (const plan of plans) {
    const ending: RelationTrack[] = []
    const starting: RelationTrack[] = []
    for (const port of portsOf(model as DesignModel, plan)) {
      const from = byId.get(port.from.id)
      if (from && !claimed.has(port.from.id)) { claimed.add(port.from.id); ending.push(from) }
      const to = port.to && byId.get(port.to.id)
      if (to && !claimed.has(to.relation.id)) { claimed.add(to.relation.id); starting.push(to) }
    }
    if (ending.length + starting.length > 0) byPlan.push({ plan, ending, starting })
  }
  return { byPlan, inNoPlan: tracks.filter((track) => !claimed.has(track.relation.id)) }
}

export type PlanBoard = {
  diagram: DesignDiagram
  /** How many of what the plan names this board holds. */
  draws: number
  total: number
}

/** The boards that hold anything the plan names, most of it first. A board on a day of its own says so itself. */
export function boardsOfPlan(model: Pick<DesignModel, 'elements' | 'diagrams'>, plan: Transition, day: string): PlanBoard[] {
  const named = plan.elements.map((one) => one.elementId)
  const counts = new Map<string, { diagram: DesignDiagram; draws: number }>()
  for (const id of named) {
    for (const diagram of boardsDrawing(model, id, day)) {
      const held = counts.get(diagram.id) ?? { diagram, draws: 0 }
      held.draws += 1
      counts.set(diagram.id, held)
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.draws - a.draws)
    .map(({ diagram, draws }) => ({ diagram, draws, total: named.length }))
}

/** The day a board is best opened on from this plan: the one picked, else the next to come, else its last. */
export function dayToShow(plan: Transition, today: string, picked?: string): string | undefined {
  if (isDay(picked)) return picked
  const days = plan.milestones.map((one) => one.date).filter(isDay).sort()
  return days.find((day) => day >= today) ?? (isDay(plan.to) ? plan.to : days[days.length - 1]) ?? (isDay(plan.from) ? plan.from : undefined)
}

export type PlanSlip = {
  from?: string
  to?: string
  milestones: number
  lastMilestone?: string
  /** What the plan introduces or retires, on its new day. */
  elements: { id: ElementId; name: string; phase: Exclude<Lifecycle, 'planned'>; day: string }[]
  units: number
}

/** What moving a plan by some days would do, read before it is done. The same arithmetic the move itself runs. */
export function slipOf(plan: Transition, model: Pick<DesignModel, 'elements'>, days: number): PlanSlip {
  const moved = shiftDays(plan, days)
  const held = moved.milestones.map((one) => one.date).filter(isDay).sort()
  const last = held[held.length - 1]
  const elements: PlanSlip['elements'] = []
  for (const one of plan.elements) {
    if (one.role === 'changes') continue
    const element = model.elements.find((candidate) => candidate.id === one.elementId)
    const phase = one.role === 'introduces' ? 'live' : 'retired'
    const day = element?.lifecycleDates?.[phase]
    if (element && element.ref === undefined && isDay(day)) elements.push({ id: element.id, name: element.name, phase, day: addDays(day, days) })
  }
  return {
    ...(moved.from !== undefined ? { from: moved.from } : {}),
    ...(moved.to !== undefined ? { to: moved.to } : {}),
    milestones: held.length,
    ...(last !== undefined ? { lastMilestone: last } : {}),
    elements,
    units: (plan.moves ?? []).filter((one) => isDay(one.on)).length,
  }
}

/** A milestone against its plan's window: allowed, and said. */
export function outsideWindow(plan: Pick<Transition, 'from' | 'to'>, day: string): 'before' | 'after' | undefined {
  if (!isDay(day)) return undefined
  if (isDay(plan.from) && day < plan.from) return 'before'
  if (isDay(plan.to) && day > plan.to) return 'after'
  return undefined
}
