// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** Decision records: proposed, written, moved through their states, and removed. */
import type { Adr, AdrSigner, AdrStatus, AdrVerdict } from '../../model/adr'
import type { Command } from '../../model/commands'
import { transaction } from '../../model/commands'
import { decisionsOf } from '../../model/normalised'
import { isDay } from '../../model/lifecycle'
import { formatAdrNumber, isAdrDeletable, isAdrLocked, newAdr, nextAdrNumber, transitionAdr, transitionsFrom } from '../../decisions/adr'
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
  return {
    command: { type: 'decision.update', id, patch, origin: 'agent' },
    answer: json({ id, label: formatAdrNumber(held.number), changed: Object.keys(patch) }),
  }
}

export const transitionDecision: Handler = (args, view) => {
  const { model } = view
  const id = args.id as string
  // A group's record is known but not this project's to change: it is kept
  // with the group, and the page is where it is moved.
  const held = ownDecision(id, view)
  if ('ok' in held) return held
  const status = args.status as AdrStatus
  if (isAdrLocked(held)) return refused('agent.locked', id)
  if (!transitionsFrom(held.status).includes(status)) {
    return refused('agent.badArguments', `${held.status} can only move to ${transitionsFrom(held.status).join(', ') || 'nothing'}`)
  }
  const supersededBy = args.supersededBy as string | undefined
  if (status === 'superseded') {
    if (!supersededBy) return refused('agent.badArguments', '"supersededBy" is required for superseded')
    if (!model.decisions?.[supersededBy] || supersededBy === id) return refused('agent.unknownId', `decision ${supersededBy}`)
  }
  const next = transitionAdr(held, status, view.today(), { supersededBy })
  if (next === held) return refused('agent.badArguments', 'that transition is not allowed')
  const patch: Partial<Adr> = { status: next.status, date: next.date }
  if (next.supersededBy !== undefined) patch.supersededBy = next.supersededBy
  return {
    command: { type: 'decision.update', id, patch, origin: 'agent' },
    answer: json({ id, number: held.number, status: next.status, date: next.date, supersededBy: next.supersededBy }),
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
