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
 */
import { isDay } from '../../model/lifecycle'
import { assignmentsOf, rolesOf } from '../../model/normalised'
import { pickedPerson } from '../../model/person'
import type { Assignment } from '../../model/units'
import { isUnit } from '../../model/units'
import { registerOf, resolvePerson } from '../../people/shown'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Handler, WriteView } from './shared'

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
  const assignment: Assignment = {
    id: freshId(view), unitId, roleId, person: pickedPerson(person), ...share,
    from: (args.from as string | undefined) ?? view.today(),
    ...(typeof args.until === 'string' ? { until: args.until } : {}),
    ...(args.acting === true ? { acting: true as const } : {}),
  }
  return {
    command: { type: 'assignment.add', assignment, origin: 'agent' },
    answer: json({ id: assignment.id, unitId, roleId, personId: person, from: assignment.from }),
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
