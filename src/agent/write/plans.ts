// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Plans as records (ADR-0009): made, written, removed, their milestones — and
 * the two moves a plan makes over the lines (ADR-0010), a replacement and its
 * interfaces ported to what it introduces.
 */
import { transaction } from '../../model/commands'
import { toArrays, decisionsOf, transitionList } from '../../model/normalised'
import { isDay } from '../../model/lifecycle'
import { portCommands, portsOf, unplannedPorts, unportCommands } from '../../model/porting'
import { replacementCommands } from '../../model/replacement'
import { nextTransitionNumber, transitionLabel, transitionsFrom as planTransitionsFrom } from '../../model/transition'
import type { Transition, TransitionElement, TransitionMilestone, TransitionRole, TransitionStatus } from '../../model/transition'
import type { ElementId } from '../../model/types'
import type { ReadView } from '../answer'
import { planEntry } from '../answer'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Args, Handler, Prepared } from './shared'
import { merged, planBody, planOf } from './shared'

// --- a replacement, and its interfaces (ADR-0010) ----------------------------------------

/**
 * The words a replacement started by an agent carries. English, like the
 * tool vocabulary: the agent is a client of the protocol, and what it writes
 * into a plan is content it can rewrite the next moment.
 */
const REPLACE_WORDS = {
  tapLabel: 'shadow tap',
  shadowMilestone: 'Shadow run starts',
  cutoverMilestone: 'Cutover',
}

/** What a replacement replaces with, or why it cannot be read. */
function replacementTarget(args: Args, view: ReadView, elementId: string): { newName: string; existingId?: string } | AgentAnswer {
  const { model } = view
  const newName = typeof args.newName === 'string' ? args.newName.trim() : ''
  const existingId = args.existingId as string | undefined
  if (!newName && !existingId) return refused('agent.badArguments', 'give newName or existingId')
  if (newName && existingId) return refused('agent.badArguments', 'give newName or existingId, not both')
  if (existingId !== undefined) {
    if (!model.elements[existingId]) return refused('agent.unknownId', `element ${existingId}`)
    if (existingId === elementId) return refused('agent.badArguments', 'an element cannot replace itself')
  }
  return { newName, ...(existingId !== undefined ? { existingId } : {}) }
}

export const replace: Handler = (args, view) => {
  const { model } = view
  const elementId = args.elementId as string
  const subject = model.elements[elementId]
  if (!subject) return refused('agent.unknownId', `element ${elementId}`)
  const target = replacementTarget(args, view, elementId)
  if ('ok' in target) return target
  const { newName, existingId } = target
  const also = (args.alsoRetiring as string[] | undefined) ?? []
  for (const id of also) if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
  const shadowFrom = args.shadowFrom as string
  const cutover = args.cutover as string
  if (!isDay(shadowFrom) || !isDay(cutover)) return refused('agent.badArguments', 'shadowFrom and cutover must be yyyy-mm-dd')
  if (cutover < shadowFrom) return refused('agent.badArguments', 'cutover must not be before shadowFrom')

  const toName = existingId !== undefined ? model.elements[existingId].name : newName
  const { commands, planId, toId } = replacementCommands(view.current(), {
    from: [
      { elementId, role: args.stays === true ? 'changes' : 'retires' },
      ...also.map((id) => ({ elementId: id, role: 'retires' as const })),
    ],
    to: existingId !== undefined ? { elementId: existingId } : { name: newName },
    shadowFrom,
    cutover,
    words: {
      ...REPLACE_WORDS,
      planTitle: `Replace ${subject.name} with ${toName}`,
      body: planBody(),
      ...(subject.owner ? { owner: subject.owner } : {}),
    },
  }, {
    element: (name) => view.ids.element(name),
    connection: () => view.ids.connection(),
    transition: view.makeId('tr'),
  }, nextTransitionNumber(transitionList(model)))
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({ planId, toId, shadowFrom, cutover }),
  }
}

export const port: Handler = (args, view) => {
  const planId = args.planId as string
  const plan = planOf(planId, view)
  if (!plan) return refused('agent.unknownId', `plan ${planId}`)
  const on = args.on as string
  if (!isDay(on)) return refused('agent.badArguments', 'on must be yyyy-mm-dd')
  const targets = plan.elements.filter((one) => one.role === 'introduces').map((one) => one.elementId)
  const toId = (args.toId as string | undefined) ?? (targets.length === 1 ? targets[0] : undefined)
  if (toId === undefined) return refused('agent.badArguments', 'the plan introduces several elements: say which with toId')
  if (!targets.includes(toId)) return refused('agent.badArguments', `${toId} is not something this plan introduces`)

  const ports = portsOf(view.current(), plan)
  const connectionId = args.connectionId as string | undefined
  // A line another plan closed is not this plan's to date: "every interface
  // not yet planned" leaves it alone and says so, and naming it is refused.
  const chosen = connectionId === undefined
    ? unplannedPorts(ports)
    : ports.filter((one) => one.from.id === connectionId)
  if (connectionId !== undefined && chosen.length === 0) return refused('agent.unknownId', `interface ${connectionId} of plan ${planId}`)
  if (connectionId !== undefined && chosen[0].closedOn !== undefined) {
    return refused('agent.planned', `${connectionId} is closed on ${chosen[0].closedOn}`)
  }
  const skipped = connectionId === undefined
    ? ports.filter((one) => one.closedOn !== undefined).map((one) => ({ connectionId: one.from.id, closedOn: one.closedOn }))
    : []
  if (chosen.length === 0) {
    return refused('agent.badArguments', skipped.length
      ? `every interface of this plan is planned already; ${skipped.length} closed by another plan or by hand`
      : 'every interface of this plan is planned already')
  }
  const commands = chosen.flatMap((one) => portCommands(one, toId, on, () => view.ids.connection()))
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({
      planId: plan.id, toId, on, moved: chosen.map((one) => one.from.id),
      ...(skipped.length ? { skipped, note: 'Skipped lines were closed by another plan or by hand; plan.unport them there first.' } : {}),
    }),
  }
}

export const unport: Handler = (args, view) => {
  const plan = planOf(args.planId, view)
  if (!plan) return refused('agent.unknownId', `plan ${String(args.planId)}`)
  const connectionId = args.connectionId as string
  const port = portsOf(view.current(), plan).find((one) => one.from.id === connectionId)
  if (!port) return refused('agent.unknownId', `interface ${connectionId} of plan ${transitionLabel(plan)}`)
  if (port.closedOn !== undefined) return refused('agent.planned', `${connectionId} is closed on ${port.closedOn}`)
  if (port.on === undefined) return refused('agent.badArguments', `${connectionId} has not been ported`)
  return {
    command: transaction(unportCommands(port), { origin: 'agent' }),
    answer: json({ planId: plan.id, connectionId, unported: true, ...(port.to ? { twinRemoved: port.to.id } : {}) }),
  }
}

// --- a plan's fields --------------------------------------------------------------------

/**
 * The element lists a plan names, as given. Each role given replaces that
 * role's list whole; a role not given keeps what the plan had. An element may
 * hold one role only — a thing a plan both introduces and retires is two
 * plans, or a mistake — and every id has to exist.
 */
function planElements(args: Args, held: readonly TransitionElement[], view: ReadView): TransitionElement[] | AgentAnswer {
  const roles = ['introduces', 'retires', 'changes'] as const
  const out: TransitionElement[] = []
  const seen = new Map<ElementId, TransitionRole>()
  for (const role of roles) {
    const given = args[role] as string[] | undefined | null
    const ids = given ?? held.filter((one) => one.role === role).map((one) => one.elementId)
    for (const elementId of ids) {
      if (!view.model.elements[elementId]) return refused('agent.unknownId', `element ${elementId}`)
      const already = seen.get(elementId)
      if (already !== undefined && already !== role) {
        return refused('agent.badArguments', `${elementId} cannot be both ${already} and ${role}`)
      }
      if (already !== undefined) continue
      seen.set(elementId, role)
      out.push({ elementId, role })
    }
  }
  return out
}

function planDecisions(args: Args, view: ReadView): string[] | AgentAnswer | undefined {
  const ids = args.decisionIds as string[] | undefined | null
  if (ids === undefined || ids === null) return undefined
  const own = decisionsOf(view.model)
  for (const id of ids) {
    if (!own[id] && !view.ancestorDecisions.some((adr) => adr.id === id)) return refused('agent.unknownId', `decision ${id}`)
  }
  return [...new Set(ids)]
}

/** The window as given: a day, or null to clear; anything else is refused. */
function planDays(args: Args): { from?: string | null; to?: string | null } | AgentAnswer {
  const out: { from?: string | null; to?: string | null } = {}
  for (const key of ['from', 'to'] as const) {
    const value = args[key]
    if (value === undefined) continue
    if (value === null) { out[key] = null; continue }
    if (!isDay(value)) return refused('agent.badArguments', `${key} must be yyyy-mm-dd`)
    out[key] = value
  }
  return out
}

export const createPlan: Handler = (args, view) => {
  const title = (args.title as string).trim()
  if (!title) return refused('agent.badArguments', '"title" must not be blank')
  const elements = planElements(args, [], view)
  if ('ok' in elements) return elements
  const decisions = planDecisions(args, view)
  if (decisions !== undefined && 'ok' in decisions) return decisions
  const days = planDays(args)
  if ('ok' in days) return days
  if (days.from && days.to && days.to < days.from) return refused('agent.badArguments', 'to must not be before from')

  const plan: Transition = {
    id: view.makeId('tr'),
    number: nextTransitionNumber(transitionList(view.model)),
    title,
    status: (args.status as TransitionStatus | undefined) ?? 'draft',
    ...(days.from ? { from: days.from } : {}),
    ...(days.to ? { to: days.to } : {}),
    ...(typeof args.owner === 'string' && args.owner.trim() ? { owner: args.owner.trim() } : {}),
    ...(args.initiative === true ? { initiative: true as const } : {}),
    elements,
    decisions: decisions ?? [],
    milestones: [],
    body: typeof args.body === 'string' && args.body.trim() ? args.body : planBody(),
  }
  return {
    command: { type: 'transition.add', transition: plan, origin: 'agent' },
    answer: json(planEntry(plan, toArrays(view.model))),
  }
}

export const updatePlan: Handler = (args, view) => {
  const held = planOf(args.id, view)
  if (!held) return refused('agent.unknownId', `plan ${String(args.id)}`)
  const patch: Partial<Transition> = {}
  const wrong = planHeading(args, held, patch) ?? planWindow(args, held, patch)
  if (wrong) return wrong
  planWords(args, patch)
  const lists = planLists(args, held, view, patch)
  if (lists) return lists
  const next = merged(held, patch)
  return {
    command: { type: 'transition.update', id: held.id, patch, origin: 'agent' },
    answer: json({ changed: Object.keys(patch), ...planEntry(next, toArrays(view.model)) }),
  }
}

/** The title, and a status one step on from the one it has. */
function planHeading(args: Args, held: Transition, patch: Partial<Transition>): AgentAnswer | undefined {
  if (typeof args.title === 'string') {
    if (!args.title.trim()) return refused('agent.badArguments', '"title" must not be blank')
    patch.title = args.title.trim()
  }
  if (typeof args.status === 'string' && args.status !== held.status) {
    const allowed = planTransitionsFrom(held.status)
    if (!allowed.includes(args.status as TransitionStatus)) {
      return refused('agent.badArguments', `${held.status} can only move to ${allowed.join(', ')}`)
    }
    patch.status = args.status as TransitionStatus
  }
  return undefined
}

/** The window, checked forwards against what the plan keeps for the half not given. */
function planWindow(args: Args, held: Transition, patch: Partial<Transition>): AgentAnswer | undefined {
  const days = planDays(args)
  if ('ok' in days) return days
  const from = days.from === undefined ? held.from : days.from ?? undefined
  const to = days.to === undefined ? held.to : days.to ?? undefined
  if (from && to && to < from) return refused('agent.badArguments', 'to must not be before from')
  if (days.from !== undefined) patch.from = days.from ?? undefined
  if (days.to !== undefined) patch.to = days.to ?? undefined
  return undefined
}

function planWords(args: Args, patch: Partial<Transition>): void {
  if (args.owner === null) patch.owner = undefined
  else if (typeof args.owner === 'string') patch.owner = args.owner.trim() || undefined
  if (typeof args.body === 'string') patch.body = args.body
  if (typeof args.initiative === 'boolean') patch.initiative = args.initiative ? true : undefined
}

function planLists(args: Args, held: Transition, view: ReadView, patch: Partial<Transition>): AgentAnswer | undefined {
  if (['introduces', 'retires', 'changes'].some((role) => Array.isArray(args[role]))) {
    const elements = planElements(args, held.elements, view)
    if ('ok' in elements) return elements
    patch.elements = elements
  }
  const decisions = planDecisions(args, view)
  if (decisions !== undefined) {
    if ('ok' in decisions) return decisions
    patch.decisions = decisions
  }
  return undefined
}

export const removePlan: Handler = (args, view) => {
  const plan = planOf(args.id, view)
  if (!plan) return refused('agent.unknownId', `plan ${String(args.id)}`)
  return {
    command: { type: 'transition.remove', id: plan.id, origin: 'agent' },
    answer: json({ id: plan.id, label: transitionLabel(plan), title: plan.title, removed: true }),
  }
}

// --- milestones -------------------------------------------------------------------------

/** A milestone is found by its name: a plan has a handful, and the name is what the roadmap shows. */
function milestoneOf(args: Args, view: ReadView): { plan: Transition; name: string; at: number } | AgentAnswer {
  const plan = planOf(args.planId, view)
  if (!plan) return refused('agent.unknownId', `plan ${String(args.planId)}`)
  const name = typeof args.name === 'string' ? args.name.trim() : ''
  if (!name) return refused('agent.badArguments', '"name" must not be blank')
  return { plan, name, at: plan.milestones.findIndex((one) => one.name === name) }
}

function withMilestones(plan: Transition, milestones: TransitionMilestone[]): Prepared {
  return {
    command: { type: 'transition.update', id: plan.id, patch: { milestones }, origin: 'agent' },
    answer: json({ planId: plan.id, label: transitionLabel(plan), milestones }),
  }
}

const byDate = (a: TransitionMilestone, b: TransitionMilestone) => a.date.localeCompare(b.date)

export const addMilestone: Handler = (args, view) => {
  const found = milestoneOf(args, view)
  if ('ok' in found) return found
  const { plan, name, at } = found
  if (!isDay(args.date)) return refused('agent.badArguments', 'date must be yyyy-mm-dd')
  if (at >= 0) return refused('agent.badArguments', `plan ${transitionLabel(plan)} already has a milestone called ${name}`)
  return withMilestones(plan, [...plan.milestones, { date: args.date, name }].sort(byDate))
}

export const updateMilestone: Handler = (args, view) => {
  const found = milestoneOf(args, view)
  if ('ok' in found) return found
  const { plan, name, at } = found
  if (at < 0) return refused('agent.unknownId', `milestone ${name} of plan ${transitionLabel(plan)}`)
  const held = plan.milestones[at]
  if (args.date !== undefined && args.date !== null && !isDay(args.date)) return refused('agent.badArguments', 'date must be yyyy-mm-dd')
  const newName = typeof args.newName === 'string' ? args.newName.trim() : ''
  if (newName && newName !== name && plan.milestones.some((one) => one.name === newName)) {
    return refused('agent.badArguments', `plan ${transitionLabel(plan)} already has a milestone called ${newName}`)
  }
  const moved: TransitionMilestone = { date: isDay(args.date) ? args.date : held.date, name: newName || held.name }
  return withMilestones(plan, plan.milestones.map((one, index) => (index === at ? moved : one)).sort(byDate))
}

export const removeMilestone: Handler = (args, view) => {
  const found = milestoneOf(args, view)
  if ('ok' in found) return found
  const { plan, name, at } = found
  if (at < 0) return refused('agent.unknownId', `milestone ${name} of plan ${transitionLabel(plan)}`)
  return withMilestones(plan, plan.milestones.filter((_one, index) => index !== at))
}
