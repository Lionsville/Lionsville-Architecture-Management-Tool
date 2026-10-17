// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who holds which role in which unit, written (ADR-0036 §4, §13): an
 * assignment added and ended, as the unit's section adds and ends one — one
 * command each, under the agent's name, in the scope that keeps the unit.
 *
 * What a request names is checked against what is there: the unit is an
 * actor with a type that this scope keeps, the role is one the organisation
 * holds, and the person is an entry of the register still with the
 * organisation — a merged id written as the entry it was merged into. What
 * the organisation then contradicts — a slot over its maximum, a person over
 * 100% — is a finding the checks report, never a refusal here. An agent adds
 * and assigns people; it never forgets, removes or merges one (ADR-0036 §13).
 *
 * **Exceptions to the model** (ADR-0039, amended 17 October 2026) are written
 * here as any other field, and said in the answer: a role outside the unit's
 * slots answers `exception: true`, and a holder's own lines (`reportsTo`) —
 * refused where they point at the holder's own role in their own unit or
 * close a loop — answer `override: true`. Whether to write one is the tools'
 * descriptions' to say: only when the person asks for that exception.
 */
import { isDay } from '../../model/lifecycle'
import { assignmentsOf, rolesOf } from '../../model/normalised'
import { pickedPerson } from '../../model/person'
import { refusePersonLines } from '../../model/reporting'
import type { Assignment, AssignmentReportingLine } from '../../model/units'
import { isExceptionPlacement, isUnit } from '../../model/units'
import { registerOf, resolvePerson } from '../../people/shown'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import { lineRefused, organisationOfView, personLinesAnswer, personLinesOf } from './reporting'
import type { Args, Handler, WriteView } from './shared'

/** The organisation's roles as this scope can see them: its own at the organisation, the tree's anywhere else. */
function rolesKnown(view: WriteView): readonly { id: string }[] | undefined {
  if (view.scopePath === '') return Object.values(rolesOf(view.model))
  return view.tree?.operatingModel?.().roles
}

/** The register entry a person id stands for now, or the refusal: unknown, forgotten or left. */
function personFor(view: WriteView, id: string): string | AgentAnswer {
  const people = view.people?.()
  if (!people) return id
  const person = resolvePerson(id, registerOf(people))
  if (!person) return refused('agent.unknownId', `person ${id}`)
  if (person.state !== 'active') {
    return refused('agent.badArguments', `${id} has ${person.state === 'left' ? 'left' : 'been forgotten'}: only someone still with the organisation is assigned`)
  }
  return person.id
}

/** An assignment id nothing in this scope holds yet. */
function freshId(view: WriteView): string {
  const taken = assignmentsOf(view.model)
  const id = view.makeId('as')
  let held = id
  for (let n = 2; held in taken; n += 1) held = `${id}-${n}`
  return held
}

export const addAssignment: Handler = (args, view) => {
  const unitId = args.unitId as string
  const unit = view.model.elements[unitId]
  if (!unit) return refused('agent.unknownId', `element ${unitId}`)
  if (unit.ref !== undefined) {
    return refused('agent.scopeNotOpen', `${unitId} is kept in ${unit.ref || 'the organisation'}; its people are assigned there`)
  }
  if (!isUnit(unit)) return refused('agent.badArguments', `"unitId" ${unitId} is not a unit: give the actor a unitTypeId first (element.update)`)
  const roleId = args.roleId as string
  const roles = rolesKnown(view)
  if (roles && !roles.some((role) => role.id === roleId)) return refused('agent.unknownId', `role ${roleId}`)
  const person = personFor(view, args.personId as string)
  if (typeof person !== 'string') return person
  for (const key of ['from', 'until'] as const) {
    if (args[key] !== undefined && !isDay(args[key])) return refused('agent.badArguments', `"${key}" must be yyyy-mm-dd`)
  }
  const share = typeof args.share === 'number' && args.share < 100 ? { share: args.share / 100 } : {}
  const reportsTo = personLinesOf(args.reportsTo, view)
  if (!Array.isArray(reportsTo)) return reportsTo
  const assignment: Assignment = {
    id: freshId(view), unitId, roleId, person: pickedPerson(person), ...share,
    from: (args.from as string | undefined) ?? view.today(),
    ...(typeof args.until === 'string' ? { until: args.until } : {}),
    ...(args.acting === true ? { acting: true as const } : {}),
    ...(reportsTo.length ? { reportsTo } : {}),
  }
  const organisation = organisationOfView(view)
  const refusal = reportsTo.length ? refusePersonLines(organisation, assignment, reportsTo, view.today()) : undefined
  if (refusal) return lineRefused(refusal, organisation)
  return {
    command: { type: 'assignment.add', assignment, origin: 'agent' },
    answer: json({
      id: assignment.id, unitId, roleId, personId: person, from: assignment.from,
      ...exceptionsOf(organisation, assignment, reportsTo),
    }),
  }
}

/** What an answer says of the exceptions to the model it wrote: a role outside the slots, and the holder's own lines. */
function exceptionsOf(
  organisation: ReturnType<typeof organisationOfView>, assignment: Pick<Assignment, 'unitId' | 'roleId'>, reportsTo: readonly AssignmentReportingLine[] | undefined,
) {
  return {
    ...(isExceptionPlacement(organisation, assignment) ? { exception: true, note: 'An exception placement: the role is not one of the unit\'s slots. Say so to the person.' } : {}),
    ...(reportsTo?.length ? { reportsTo: personLinesAnswer(reportsTo), override: true } : {}),
  }
}

/** The fields of `assignment.update` given, as a patch: null clears what may be cleared. */
function patchOf(args: Args, view: WriteView, held: Assignment): Partial<Assignment> | AgentAnswer {
  const patch: Partial<Assignment> = {}
  for (const key of ['from', 'until'] as const) {
    if (args[key] !== undefined && args[key] !== null && !isDay(args[key])) return refused('agent.badArguments', `"${key}" must be yyyy-mm-dd`)
  }
  if (args.from === null) return refused('agent.badArguments', '"from" may be moved and not cleared: an assignment begins on a day')
  if (typeof args.from === 'string') patch.from = args.from
  if (args.until !== undefined) patch.until = typeof args.until === 'string' ? args.until : undefined
  if (args.share !== undefined) patch.share = typeof args.share === 'number' && args.share < 100 ? args.share / 100 : undefined
  if (args.acting !== undefined) patch.acting = args.acting === true ? true : undefined
  if (args.reportsTo !== undefined) {
    const lines = personLinesOf(args.reportsTo, view)
    if (!Array.isArray(lines)) return lines
    patch.reportsTo = lines.length ? lines : undefined
  }
  // A field said as it already is changes nothing, and is not written.
  for (const key of Object.keys(patch) as (keyof Assignment)[]) {
    if (JSON.stringify(patch[key]) === JSON.stringify(held[key])) delete patch[key]
  }
  return patch
}

export const updateAssignment: Handler = (args, view) => {
  const id = args.id as string
  const held = assignmentsOf(view.model)[id]
  if (!held) return refused('agent.unknownId', `assignment ${id}: one this scope keeps (assignments.list says the scope of each)`)
  const patch = patchOf(args, view, held)
  if ('ok' in patch) return patch
  if (Object.keys(patch).length === 0) return refused('agent.badArguments', `nothing to change: ${id} already says that`)
  const organisation = organisationOfView(view)
  if (patch.reportsTo) {
    const refusal = refusePersonLines(organisation, held, patch.reportsTo, view.today())
    if (refusal) return lineRefused(refusal, organisation)
  }
  const after = { ...held, ...patch }
  return {
    command: { type: 'assignment.update', id, patch, origin: 'agent' },
    answer: json({
      id, changed: Object.keys(patch),
      ...exceptionsOf(organisation, after, after.reportsTo),
      ...('reportsTo' in patch && !patch.reportsTo ? { reportsTo: [], note: 'The holder reports where the model says again.' } : {}),
    }),
  }
}

export const endAssignment: Handler = (args, view) => {
  const id = args.id as string
  const held = assignmentsOf(view.model)[id]
  if (!held) return refused('agent.unknownId', `assignment ${id}`)
  if (args.on !== undefined && !isDay(args.on)) return refused('agent.badArguments', '"on" must be yyyy-mm-dd')
  const on = (args.on as string | undefined) ?? view.today()
  if (isDay(held.from) && held.from > on) {
    return refused('agent.badArguments', `${id} begins on ${held.from}, after ${on}: it was never held, and a person removes it`)
  }
  if (isDay(held.until) && held.until <= on) return refused('agent.badArguments', `${id} ended on ${held.until} already`)
  return {
    command: { type: 'assignment.update', id, patch: { until: on }, origin: 'agent' },
    answer: json({ id, until: on }),
  }
}
