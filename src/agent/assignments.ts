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
 * nothing from.
 */
import { isDay, today as clockToday } from '../model/lifecycle'
import { pickedPerson } from '../model/person'
import type { HostModel } from '../model/hostModel'
import type { Role, UnitType } from '../model/operatingModel'
import { holdersOn, isUnit, managersOf, personOf, runsOn, shareOf, slotsOf } from '../model/units'
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
function assignmentsNow(tree: TreeView | undefined, open: OpenDocument | undefined): { scope: string; assignment: Assignment }[] {
  const indexed = (tree?.assignments?.() ?? []).filter((one) => one.scope !== open?.path)
  if (!open) return indexed
  return [...indexed, ...(open.current.assignments ?? []).map((assignment) => ({ scope: open.path, assignment }))]
}

/** The organisation as the read has it: the tree's units and operating model, the open scope's laid over them. */
function organisationNow(tree: TreeView | undefined, open: OpenDocument | undefined, assignments: readonly Assignment[]): Organisation {
  const here = (open?.current.elements ?? []).filter((one) => one.ref === undefined && isUnit(one))
  const ids = new Set(here.map((one) => one.id))
  const units = [...(tree?.units?.() ?? []).filter((one) => !ids.has(one.unit.id) && one.scope !== open?.path).map((one) => one.unit), ...here]
  const atRoot = open?.path === ''
  const operating = tree?.operatingModel?.()
  return {
    units,
    assignments,
    roles: atRoot ? open.current.roles ?? [] : operating?.roles ?? [],
    unitTypes: atRoot ? open.current.unitTypes ?? [] : operating?.unitTypes ?? [],
  }
}

/** What a person reads as to an agent: their name, or their pseudonym where the policy says so. */
function personName(id: string, people: readonly Person[] | undefined, policy: PeoplePolicy | undefined): string | undefined {
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
  const lines = held
    .filter(({ scope, assignment }) => (typeof args.scope !== 'string' || scope === args.scope)
      && (typeof args.unitId !== 'string' || assignment.unitId === args.unitId)
      && (typeof args.roleId !== 'string' || assignment.roleId === args.roleId)
      && (asked === undefined || canonical(personOf(assignment)) === asked)
      && (args.all === true || runsOn(assignment, day)))
    .map(({ scope, assignment }) => line(scope, assignment, { unitName, roleName, named, day }))
  const unit = typeof args.unitId === 'string' ? organisation.units.find((one) => one.id === args.unitId) : undefined
  return json({
    day,
    total: lines.length,
    assignments: lines.slice(0, typeof args.limit === 'number' ? args.limit : 500),
    ...(unit ? unitAnswer(unit, organisation, day, { roleName, unitName, named }) : {}),
  })
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
    runs: runsOn(assignment, naming.day),
  }
}

/** One unit's slots against who holds them on the day, and who manages it (§12). */
function unitAnswer(unit: Organisation['units'][number], organisation: Organisation, day: string, naming: Naming) {
  const type: UnitType | undefined = organisation.unitTypes.find((one) => one.id === unit.unitTypeId)
  const roles = new Map<string, Role>(organisation.roles.map((role) => [role.id, role]))
  return {
    unit: {
      id: unit.id,
      name: unit.name,
      unitTypeId: unit.unitTypeId,
      ...(type ? { unitType: type.name } : {}),
      slots: slotsOf(unit, type).map((slot) => ({
        roleId: slot.role, role: naming.roleName(slot.role), min: slot.min, ...(slot.max !== undefined ? { max: slot.max } : {}),
        held: holdersOn(organisation.assignments, unit.id, slot.role, day).length,
        ...(roles.get(slot.role)?.manages ? { manages: true } : {}),
      })),
      managedBy: managersOf(organisation, unit.id, day).map((one) => {
        const person = naming.named(one.person)
        return {
          personId: one.person, ...(person !== undefined ? { person } : {}),
          roleId: one.roleId, role: naming.roleName(one.roleId), unitId: one.unitId, unit: naming.unitName(one.unitId),
        }
      }),
    },
  }
}
