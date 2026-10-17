// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who holds which role in which unit, as an agent reads it (ADR-0036 §4,
 * §13): `assignments.list`, across the tree.
 *
 * Read off the tree the shell holds, with the open scope's own assignments as
 * its session has them now, so what was just assigned is what is listed.
 * Each line names its unit and its role by id and by name, and its person by
 * id and by what the register says — the name, or a pseudonym where the
 * organisation's policy gives agents pseudonyms; never an address. Asked
 * about one unit, it also says the unit's slots against who holds them on
 * the day, and who manages it (§12) — which core works out and grants
 * nothing from. Each holder is answered as they are (ADR-0039, amended 17
 * October 2026): who manages them by their own line where they have one,
 * their own lines as written, and an exception placement said. The day is today unless one is asked for, and the
 * organisation is that day's: every plan's moves of that day included, the
 * open scope's plans as its session has them (§6).
 */
import { isDay, today as clockToday } from '../model/lifecycle'
import { pickedPerson } from '../model/person'
import type { HostModel } from '../model/hostModel'
import type { Role, UnitType } from '../model/operatingModel'
import { movesOfPlans } from '../model/transition'
import {
  holdersOn, isExceptionPlacement, isUnit, linesOfHolder, managersOf, managersOfHolder, parentOn, personOf, runsOn, shareOf, slotsOf,
} from '../model/units'
import type { Assignment, Organisation } from '../model/units'
import type { Person } from '../people/person'
import type { PeoplePolicy } from '../people/policy'
import { registerOf, resolvePerson, shownEnglish, shownPerson } from '../people/shown'
import type { PeopleView } from './people'
import type { AgentAnswer } from './tools'
import { checkArguments, json, refused, toolSpec } from './tools'
import type { TreeView } from './tree'

export const ASSIGNMENTS_LIST = 'assignments.list'

/** The open scope as the read lays it over the tree: its path, and its document as the session has it. */
export type OpenDocument = { path: string; current: HostModel; today: string }

type Args = Record<string, unknown>

/** The tree's assignments with the open scope's in place of what the index read of it. */
export function assignmentsNow(tree: Pick<TreeView, 'assignments'> | undefined, open: OpenDocument | undefined): { scope: string; assignment: Assignment }[] {
  const indexed = (tree?.assignments?.() ?? []).filter((one) => one.scope !== open?.path)
  if (!open) return indexed
  return [...indexed, ...(open.current.assignments ?? []).map((assignment) => ({ scope: open.path, assignment }))]
}

/** The organisation as the read has it: the tree's units and operating model, the open scope's laid over them. */
export function organisationNow(
  tree: Pick<TreeView, 'units' | 'operatingModel' | 'moves'> | undefined, open: OpenDocument | undefined, assignments: readonly Assignment[],
): Organisation {
  const here = (open?.current.elements ?? []).filter((one) => one.ref === undefined && isUnit(one))
  const ids = new Set(here.map((one) => one.id))
  const units = [...(tree?.units?.() ?? []).filter((one) => !ids.has(one.unit.id) && one.scope !== open?.path).map((one) => one.unit), ...here]
  const atRoot = open?.path === ''
  const operating = tree?.operatingModel?.()
  const moves = [
    ...(tree?.moves?.() ?? []).filter((one) => one.scope !== open?.path).map((one) => one.move),
    ...movesOfPlans(open?.current.transitions),
  ]
  return {
    units,
    assignments,
    roles: atRoot ? open.current.roles ?? [] : operating?.roles ?? [],
    unitTypes: atRoot ? open.current.unitTypes ?? [] : operating?.unitTypes ?? [],
    ...(moves.length ? { moves } : {}),
  }
}

/** What a person reads as to an agent: their name, or their pseudonym where the policy says so. */
export function personName(id: string, people: readonly Person[] | undefined, policy: PeoplePolicy | undefined): string | undefined {
  if (!people) return undefined
  return shownEnglish(shownPerson(pickedPerson(id), registerOf(people), { withhold: policy?.agentsSee === 'pseudonyms' }))
}

/** `assignments.list`, over the tree and the open scope. */
export async function listAssignments(
  rawArgs: unknown, tree: TreeView | undefined, open: OpenDocument | undefined, people: PeopleView | undefined,
): Promise<AgentAnswer> {
  const wrong = checkArguments(toolSpec(ASSIGNMENTS_LIST).inputSchema, rawArgs)
  if (wrong) return refused('agent.badArguments', wrong)
  const args = (rawArgs ?? {}) as Args
  const day = isDay(args.on) ? args.on : open?.today ?? people?.today() ?? clockToday()
  const register = people ? await people.read() : undefined
  const held = assignmentsNow(tree, open)
  const organisation = organisationNow(tree, open, held.map((one) => one.assignment))
  const canonical = (id: string) => (register ? resolvePerson(id, registerOf(register.people))?.id ?? id : id)
  const unitName = (id: string) => organisation.units.find((one) => one.id === id)?.name ?? tree?.lookup(id)?.name ?? id
  const roleName = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const named = (id: string) => personName(id, register?.people, register?.policy)
  const asked = typeof args.personId === 'string' ? canonical(args.personId) : undefined
  // Who manages each holder, and why (ADR-0039 §4, §8): once per role in a unit, however many hold it — and once
  // more for a holder with a line of their own, which holds for them alone.
  const told = new Map<string, ReturnType<typeof managingOf>>()
  const managing = (assignment: Assignment) => {
    const key = assignment.reportsTo?.length ? `\u0001${assignment.id}` : `${assignment.unitId}\u0000${assignment.roleId}`
    if (!told.has(key)) told.set(key, managingOf(organisation, assignment, day, { roleName, unitName, named }))
    return told.get(key)!
  }
  const lines = held
    .filter(({ scope, assignment }) => (typeof args.scope !== 'string' || scope === args.scope)
      && (typeof args.unitId !== 'string' || assignment.unitId === args.unitId)
      && (typeof args.roleId !== 'string' || assignment.roleId === args.roleId)
      && (asked === undefined || canonical(personOf(assignment)) === asked)
      && (args.all === true || runsOn(assignment, day)))
    .map(({ scope, assignment }) => ({
      ...line(scope, assignment, { unitName, roleName, named, day }),
      ...(isExceptionPlacement(organisation, assignment) ? { exception: true } : {}),
      ...managing(assignment),
    }))
  const unit = typeof args.unitId === 'string' ? organisation.units.find((one) => one.id === args.unitId) : undefined
  return json({
    day,
    total: lines.length,
    assignments: lines.slice(0, typeof args.limit === 'number' ? args.limit : 500),
    ...(unit ? unitAnswer(unit, organisation, day, { roleName, unitName, named }) : {}),
  })
}

/** Who manages one holder on the day, each with why, and the dotted lines that hold for them apart. */
function managingOf(organisation: Organisation, assignment: Assignment, day: string, naming: Naming) {
  const dotted = linesOfHolder(organisation, assignment, day).filter((one) => one.kind === 'dotted' && one.state === 'lands')
  return {
    managedBy: managersOfHolder(organisation, assignment, day).map((one) => managerLine(one, naming)),
    ...(dotted.length
      ? {
        dotted: dotted.flatMap((one) => (one.to
          ? [{ unitId: one.to.unitId, unit: naming.unitName(one.to.unitId), roleId: one.to.roleId, role: naming.roleName(one.to.roleId), ...(one.override ? { override: true } : {}) }]
          : [])),
      }
      : {}),
  }
}

function managerLine(one: ReturnType<typeof managersOf>[number], naming: Naming) {
  const person = naming.named(one.person)
  return {
    personId: one.person, ...(person !== undefined ? { person } : {}),
    roleId: one.roleId, role: naming.roleName(one.roleId), unitId: one.unitId, unit: naming.unitName(one.unitId), via: one.via,
  }
}

/** A person a line names, as an answer says them: by register id, and by name where the register lends one. */
function named(id: string, naming: Naming): { person: string; name?: string } {
  const name = naming.named(id)
  return { person: id, ...(name !== undefined ? { name } : {}) }
}

type Naming = {
  unitName: (id: string) => string
  roleName: (id: string) => string
  named: (id: string) => string | undefined
}

function line(scope: string, assignment: Assignment, naming: Naming & { day: string }) {
  const person = naming.named(personOf(assignment))
  return {
    id: assignment.id,
    scope,
    unitId: assignment.unitId,
    unit: naming.unitName(assignment.unitId),
    roleId: assignment.roleId,
    role: naming.roleName(assignment.roleId),
    personId: personOf(assignment),
    ...(person !== undefined ? { person } : {}),
    // In per cent, as the tools take it; the record keeps a fraction.
    share: Math.round(shareOf(assignment) * 100),
    ...(assignment.from !== undefined ? { from: assignment.from } : {}),
    ...(assignment.until !== undefined ? { until: assignment.until } : {}),
    ...(assignment.acting ? { acting: true } : {}),
    // The holder's own lines as written: an exception to the model for them alone (ADR-0039, amended).
    ...(assignment.reportsTo?.length
      ? {
        reportsTo: assignment.reportsTo.map((one) => ({
          to: {
            scope: one.to.scope, unitId: one.to.unit, unit: naming.unitName(one.to.unit), roleId: one.to.role, role: naming.roleName(one.to.role),
            ...(one.to.person !== undefined ? { person: named(one.to.person, naming) } : {}),
          },
          kind: one.kind, ...(one.from !== undefined ? { from: one.from } : {}), ...(one.until !== undefined ? { until: one.until } : {}),
        })),
      }
      : {}),
    runs: runsOn(assignment, naming.day),
  }
}

/** One unit's slots against who holds them on the day, and who manages it (§12). */
function unitAnswer(unit: Organisation['units'][number], organisation: Organisation, day: string, naming: Naming) {
  const type: UnitType | undefined = organisation.unitTypes.find((one) => one.id === unit.unitTypeId)
  const roles = new Map<string, Role>(organisation.roles.map((role) => [role.id, role]))
  const parentId = parentOn(unit, organisation.moves, day)
  const slotted = new Set(slotsOf(unit, type).map((slot) => slot.role))
  const outside = [...new Set(organisation.assignments
    .filter((one) => one.unitId === unit.id && runsOn(one, day) && !slotted.has(one.roleId))
    .map((one) => one.roleId))]
  return {
    unit: {
      id: unit.id,
      name: unit.name,
      unitTypeId: unit.unitTypeId,
      ...(type ? { unitType: type.name } : {}),
      // Where it sits on the day, a plan's move of that day included (ADR-0036 §6).
      ...(parentId !== undefined ? { parentId, parent: naming.unitName(parentId) } : {}),
      slots: slotsOf(unit, type).map((slot) => ({
        roleId: slot.role, role: naming.roleName(slot.role), min: slot.min, ...(slot.max !== undefined ? { max: slot.max } : {}),
        held: holdersOn(organisation.assignments, unit.id, slot.role, day).length,
        ...(roles.get(slot.role)?.manages ? { manages: true } : {}),
      })),
      // Roles held here that are none of its slots: exception placements, allowed and said (ADR-0039, amended).
      ...(type && outside.length
        ? { exceptions: outside.map((roleId) => ({ roleId, role: naming.roleName(roleId), held: holdersOn(organisation.assignments, unit.id, roleId, day).length })) }
        : {}),
      managedBy: managersOf(organisation, unit.id, day).map((one) => managerLine(one, naming)),
    },
  }
}
