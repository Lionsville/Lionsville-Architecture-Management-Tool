// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Decision records: proposed, written, moved through their states, and removed.
 *
 * A move asks the same gate the decisions page draws as a checklist
 * (ADR-0008, amended 28 September 2026), and a refusal names the lines still
 * open, so an agent knows what to write before it asks again.
 */
import type { Adr, AdrSigner, AdrStatus, AdrVerdict } from '../../model/adr'
import type { Command } from '../../model/commands'
import { transaction } from '../../model/commands'
import { decisionList, decisionsOf } from '../../model/normalised'
import { isDay } from '../../model/lifecycle'
import {
  adrGate, adrOpenItems, formatAdrNumber, isAdrDeletable, isAdrLocked, newAdr, nextAdrNumber, selfAccepted,
  setAdrStatus, transitionsFrom,
} from '../../decisions/adr'
import type { ReadView } from '../answer'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Args, Handler } from './shared'
import { planOf } from './shared'

export const proposeDecision: Handler = (args, view) => {
  const { model } = view
  const title = (args.title as string).trim()
  if (!title) return refused('agent.badArguments', '"title" must not be blank')
  // `applicationId` is accepted as an alias for one beta (ADR-0012 §7): every
  // agent that learnt the old word keeps working, and `tools.ts` says which is
  // the name.
  const subjectId = (args.subjectId ?? args.applicationId) as string | undefined
  if (subjectId !== undefined && !model.elements[subjectId]) return refused('agent.unknownId', `element ${subjectId}`)
  // Numbers are per list: the scope's own, and each subject's.
  const list = model.order.decisions
    .map((id) => model.decisions![id])
    .filter((adr) => (adr.subjectId ?? undefined) === subjectId)
  const decision: Adr = newAdr({
    id: view.makeId('adr'), number: nextAdrNumber(list), title, date: view.today(), t: view.translate, subjectId,
  })
  if (typeof args.body === 'string' && args.body.trim()) decision.body = args.body
  const signers = signersOf(args)
  if (signers !== undefined) {
    if ('ok' in signers) return signers
    decision.signers = signers
  }
  const replaces = supersedesOf(args, decision.id, view)
  if (replaces !== undefined) {
    if ('ok' in replaces) return replaces
    if (replaces.length) decision.supersedes = replaces
  }
  if (typeof args.proposedBy === 'string' && args.proposedBy.trim()) decision.proposedBy = args.proposedBy.trim()
  // Linked from the plan's side, because that is where the link lives: a
  // plan names the decisions it rests on, and a decision names nothing.
  const linked: Command[] = []
  for (const idOrLabel of (args.planIds as string[] | undefined) ?? []) {
    const plan = planOf(idOrLabel, view)
    if (!plan) return refused('agent.unknownId', `plan ${idOrLabel}`)
    if (plan.decisions.includes(decision.id) || linked.some((c) => c.type === 'transition.update' && c.id === plan.id)) continue
    linked.push({ type: 'transition.update', id: plan.id, patch: { decisions: [...plan.decisions, decision.id] } })
  }
  return {
    command: transaction([{ type: 'decision.add', decision }, ...linked], { origin: 'agent' }),
    answer: json({
      id: decision.id, number: decision.number, label: formatAdrNumber(decision.number), title, status: decision.status, subjectId,
      ...(linked.length ? { plans: linked.map((c) => (c.type === 'transition.update' ? c.id : '')) } : {}),
    }),
  }
}

/** A project's own record, or why it cannot be had: a group's is read-only here, and a stranger's is unknown. */
function ownDecision(id: string, view: ReadView): Adr | AgentAnswer {
  const held = decisionsOf(view.model)[id]
  if (held) return held
  return view.ancestorDecisions.some((adr) => adr.id === id)
    ? refused('agent.readOnly', 'a group\'s records are changed on the decisions page')
    : refused('agent.unknownId', `decision ${id}`)
}

/**
 * The records a proposal replaces, as given: accepted records of this scope,
 * never itself. Only what is in force can be superseded — a proposal named
 * here would be superseded before it was decided.
 */
function supersedesOf(args: Args, self: string, view: ReadView): string[] | AgentAnswer | undefined {
  const given = args.supersedes as string[] | undefined | null
  if (given === undefined || given === null) return undefined
  const own = decisionsOf(view.model)
  for (const id of given) {
    if (id === self) return refused('agent.badArguments', 'a record cannot supersede itself')
    if (!own[id]) return refused('agent.unknownId', `decision ${id}`)
    if (own[id].status !== 'accepted') return refused('agent.badArguments', `${id} is ${own[id].status}; only an accepted record can be superseded`)
  }
  return [...new Set(given)]
}

/** The signers as given, or nothing when they were not. */
function signersOf(args: Args): AdrSigner[] | AgentAnswer | undefined {
  const given = args.signers as Record<string, unknown>[] | undefined | null
  if (given === undefined || given === null) return undefined
  const out: AdrSigner[] = []
  for (const [index, one] of given.entries()) {
    const name = typeof one.name === 'string' ? one.name.trim() : ''
    if (!name) return refused('agent.badArguments', `signers[${index}].name must not be blank`)
    if (one.signedAt !== undefined && one.signedAt !== null && !isDay(one.signedAt)) {
      return refused('agent.badArguments', `signers[${index}].signedAt must be yyyy-mm-dd`)
    }
    out.push({
      name,
      ...(typeof one.role === 'string' && one.role.trim() ? { role: one.role.trim() } : {}),
      ...(typeof one.verdict === 'string' ? { verdict: one.verdict as AdrVerdict } : {}),
      ...(isDay(one.signedAt) ? { signedAt: one.signedAt } : {}),
    })
  }
  return out
}

export const updateDecision: Handler = (args, view) => {
  const id = args.id as string
  const held = ownDecision(id, view)
  if ('ok' in held) return held
  if (isAdrLocked(held)) return refused('agent.locked', id)
  const patch: Partial<Adr> = {}
  if (typeof args.title === 'string') {
    if (!args.title.trim()) return refused('agent.badArguments', '"title" must not be blank')
    patch.title = args.title.trim()
  }
  if (typeof args.body === 'string') patch.body = args.body
  if (args.date !== undefined && args.date !== null) {
    if (!isDay(args.date)) return refused('agent.badArguments', 'date must be yyyy-mm-dd')
    patch.date = args.date
  }
  const signers = signersOf(args)
  if (signers !== undefined) {
    if ('ok' in signers) return signers
    patch.signers = signers
  }
  const replaces = supersedesOf(args, id, view)
  if (replaces !== undefined) {
    if ('ok' in replaces) return replaces
    patch.supersedes = replaces.length ? replaces : undefined
  }
  if (args.proposedBy === null) patch.proposedBy = undefined
  else if (typeof args.proposedBy === 'string') patch.proposedBy = args.proposedBy.trim() || undefined
  return {
    command: { type: 'decision.update', id, patch, origin: 'agent' },
    answer: json({ id, label: formatAdrNumber(held.number), changed: Object.keys(patch) }),
  }
}

/**
 * A move, through the table and then the gate.
 *
 * The table first: an accepted record is locked AND may still be superseded,
 * so asking the lock first refused the one move a locked record has. The gate
 * second, with the record carrying what the move brings — the successor, the
 * reason — so its answer is about this move and not the record as it stood.
 * Accepting a record that supersedes others moves them in the same step.
 */
export const transitionDecision: Handler = (args, view) => {
  const { model } = view
  const id = args.id as string
  // A group's record is known but not this project's to change: it is kept
  // with the group, and the page is where it is moved.
  const held = ownDecision(id, view)
  if ('ok' in held) return held
  const status = args.status as AdrStatus
  const moves = transitionsFrom(held.status)
  if (!moves.includes(status)) {
    if (isAdrLocked(held)) return refused('agent.locked', id)
    return refused('agent.badArguments', `${held.status} can only move to ${moves.join(', ') || 'nothing'}`)
  }
  const supersededBy = args.supersededBy as string | undefined
  if (status === 'superseded') {
    if (!supersededBy) return refused('agent.badArguments', '"supersededBy" is required for superseded')
    if (!model.decisions?.[supersededBy] || supersededBy === id) return refused('agent.unknownId', `decision ${supersededBy}`)
  }
  const reason = typeof args.reason === 'string' ? args.reason.trim() : ''
  const list = decisionList(model)
  const carrying: Adr = {
    ...held,
    ...(status === 'superseded' && supersededBy ? { supersededBy } : {}),
    ...(status === 'rejected' && reason ? { reason } : {}),
  }
  const open = adrOpenItems(adrGate(carrying, status, { list }))
  if (open.length) return refused('agent.badArguments', `the gate to ${status} still needs: ${open.join(', ')}`)

  const moved = setAdrStatus(list, id, status, view.today(), { supersededBy, reason })
  // Only what moved, the record itself first, so that in the step as it is
  // replayed a predecessor is superseded by a successor already accepted.
  const byId = new Map(list.map((adr) => [adr.id, adr]))
  const changed = moved.filter((adr) => adr !== byId.get(adr.id))
    .sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : 0))
  if (!changed.some((adr) => adr.id === id)) return refused('agent.badArguments', 'that transition is not allowed')
  const commands: Command[] = changed.map((adr) => {
    const before = byId.get(adr.id)!
    const patch: Partial<Adr> = { status: adr.status, date: adr.date }
    if (adr.supersededBy !== before.supersededBy) patch.supersededBy = adr.supersededBy
    if (adr.reason !== before.reason) patch.reason = adr.reason
    return { type: 'decision.update', id: adr.id, patch }
  })
  const self = changed.find((adr) => adr.id === id)!
  const superseded = changed.filter((adr) => adr.id !== id).map((adr) => adr.id)
  return {
    command: commands.length === 1 ? { ...commands[0], origin: 'agent' } : transaction(commands, { origin: 'agent' }),
    answer: json({
      id, number: held.number, status: self.status, date: self.date, supersededBy: self.supersededBy,
      ...(self.reason !== undefined ? { reason: self.reason } : {}),
      ...(superseded.length ? { superseded } : {}),
      ...(status === 'accepted' && selfAccepted(self)
        ? { warning: 'The only approval is from the person who proposed it. Allowed, and worth a second reader.' }
        : {}),
    }),
  }
}

export const removeDecision: Handler = (args, view) => {
  const { model } = view
  const id = args.id as string
  const held = ownDecision(id, view)
  if ('ok' in held) return held
  if (!isAdrDeletable(held)) return refused('agent.locked', id)
  // Whoever said it was superseded by this one is told otherwise — the
  // same rule the decisions page follows — so no record points at nothing.
  const orphaned = model.order.decisions
    .filter((other) => decisionsOf(model)[other].supersededBy === id)
    .map((other): Command => ({ type: 'decision.update', id: other, patch: { supersededBy: undefined } }))
  return {
    command: transaction([{ type: 'decision.remove', id }, ...orphaned], { origin: 'agent' }),
    answer: json({ id, label: formatAdrNumber(held.number), title: held.title, removed: true }),
  }
}
