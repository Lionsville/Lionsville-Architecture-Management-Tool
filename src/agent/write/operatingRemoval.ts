// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A role or a unit type taken out of the operating model (ADR-0036, amended
 * 24 November 2026): refused while anything in the organisation still uses
 * it, with what does named.
 *
 * On the page a person is asked first, told who holds the role, and the
 * removal takes a role out of the slots and the rules and a unit type out of
 * the types that may sit in it. Nothing asks an agent, so here nothing is
 * taken along: what uses the record is changed first, by the tools that
 * change it, each a thing the person may be told about.
 *
 * What uses it may be kept in any scope — a unit, an assignment, ended ones
 * among them, a line — so the answer needs the whole tree. Where the host
 * cannot say it read all of it (`TreeView.unread`), the removal is refused
 * rather than decided on part of it.
 */
import { rolesOf, toArrays } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import { linesSaid } from '../../model/operatingModel'
import type { Role, UnitType } from '../../model/operatingModel'
import type { DesignElement } from '../../model/types'
import { assignmentsNow } from '../assignments'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import { atOrganisation, prepared } from './operatingModel'
import type { Handler, WriteView } from './shared'

/** The most uses one refusal spells out; the rest are counted. */
const MOST_NAMED = 25

type UnitAt = { scope: string; unit: DesignElement }

/** The tree as a removal reads it: every unit and assignment, the organisation's own as its session has them. */
type Whole = {
  readonly model: Model
  readonly units: readonly UnitAt[]
  readonly assignments: ReturnType<typeof assignmentsNow>
  readonly scopes: readonly { path: string; name: string; unitTypeId?: string }[]
}

const at = (scope: string): string => scope || 'the organisation'

/** The whole tree, or the refusal where the host cannot say it is whole. */
function wholeTree(view: WriteView): Whole | AgentAnswer {
  const { tree, model } = view
  if (!tree?.unread || !tree.units || !tree.assignments || !tree.scopes) {
    return refused('agent.notAllRead', 'this host does not say whether it read every scope')
  }
  if (tree.listed?.() === false) return refused('agent.notAllRead', 'the tree of scopes has not been read yet')
  const unread = tree.unread()
  if (unread.length > 0) return refused('agent.notAllRead', unread.map(at).join(', '))
  const current = toArrays(model)
  return {
    model,
    units: [
      ...tree.units().filter((one) => one.scope !== view.scopePath),
      ...current.elements.filter((one) => one.ref === undefined).map((unit) => ({ scope: view.scopePath, unit })),
    ],
    assignments: assignmentsNow(tree, { path: view.scopePath, current, today: view.today() }),
    scopes: tree.scopes(),
  }
}

/** Everything that uses a record, or the removal's way on where nothing does. */
function inUse(uses: readonly string[]): AgentAnswer | undefined {
  if (uses.length === 0) return undefined
  const more = uses.length - MOST_NAMED
  return refused('agent.inUse', uses.slice(0, MOST_NAMED).join('; ') + (more > 0 ? `; and ${more} more` : ''))
}

const said = (record: { id: string; name: string }): string => `${record.name} (${record.id})`

/** What in the operating model itself names the role. */
function roleUsesInModel(role: Role, model: Model): string[] {
  const { unitTypes = [], roles = [], operatingRules = [] } = toArrays(model)
  return [
    ...unitTypes.flatMap((type) => [
      ...(type.slots.some((slot) => slot.role === role.id) ? [`unit type ${said(type)} has a slot for it`] : []),
      ...type.slots.filter((slot) => slot.role !== role.id && linesSaid(slot.reportsTo).some((line) => line.role === role.id))
        .map((slot) => `unit type ${said(type)} has ${slot.role} report to it`),
    ]),
    ...roles.filter((one) => one.id !== role.id).flatMap((one) => [
      ...(linesSaid(one.reportsTo).some((line) => line.role === role.id) ? [`role ${said(one)} reports to it`] : []),
      ...(one.successors?.includes(role.id) ? [`role ${said(one)} names it as a successor`] : []),
    ]),
    ...operatingRules.filter((rule) => rule.role === role.id).map((rule) => `the rule ${rule.id} names it`),
  ]
}

/** What in any scope names the role: a unit's own slot or line, an assignment whatever its days, a holder's line. */
function roleUsesInScopes(role: Role, whole: Whole): string[] {
  return [
    ...whole.units.flatMap(({ scope, unit }) => [
      ...(unit.extraSlots?.some((slot) => slot.role === role.id) ? [`unit ${said(unit)} in ${at(scope)} has a slot of its own for it`] : []),
      ...(unit.reportingLines?.some((line) => line.role === role.id || line.to?.role === role.id)
        ? [`unit ${said(unit)} in ${at(scope)} has a reporting line of its own with it`] : []),
    ]),
    ...whole.assignments.flatMap(({ scope, assignment }) => [
      ...(assignment.roleId === role.id
        ? [`assignment ${assignment.id} in ${at(scope)} holds it in unit ${assignment.unitId}${assignment.until !== undefined ? `, until ${assignment.until}` : ''}`] : []),
      ...(assignment.roleId !== role.id && assignment.reportsTo?.some((line) => line.to.role === role.id)
        ? [`assignment ${assignment.id} in ${at(scope)} reports to it`] : []),
    ]),
  ]
}

export const removeRole: Handler = (args, view) => {
  const wrong = atOrganisation(view)
  if (wrong) return wrong
  const role = rolesOf(view.model)[args.id as string]
  if (!role) return refused('agent.unknownId', `role ${String(args.id)}`)
  const whole = wholeTree(view)
  if ('ok' in whole) return whole
  const refusal = inUse([...roleUsesInModel(role, view.model), ...roleUsesInScopes(role, whole)])
  if (refusal) return refusal
  return prepared({ type: 'role.remove', id: role.id }, json({
    id: role.id, name: role.name, removed: true,
    // Its parts are the role's own, and go with it.
    ...(role.duties.length ? { partsRemoved: role.duties.map((duty) => ({ responsibilityId: duty.responsibility, raci: duty.raci })) } : {}),
  }))
}

function typeUses(type: UnitType, whole: Whole): string[] {
  const { unitTypes = [] } = toArrays(whole.model)
  return [
    ...unitTypes.filter((one) => one.id !== type.id).flatMap((one) => [
      ...(one.within.includes(type.id) ? [`unit type ${said(one)} may sit in it`] : []),
      ...(one.successors?.includes(type.id) ? [`unit type ${said(one)} names it as a successor`] : []),
    ]),
    ...whole.units.filter(({ unit }) => unit.unitTypeId === type.id).map(({ scope, unit }) => `unit ${said(unit)} in ${at(scope)} is one`),
    ...whole.scopes.filter((scope) => scope.unitTypeId === type.id).map((scope) => `scope ${at(scope.path)} is one`),
  ]
}

export const removeUnitType: Handler = (args, view) => {
  const wrong = atOrganisation(view)
  if (wrong) return wrong
  const type = (toArrays(view.model).unitTypes ?? []).find((one) => one.id === args.id)
  if (!type) return refused('agent.unknownId', `unit type ${String(args.id)}`)
  const whole = wholeTree(view)
  if ('ok' in whole) return whole
  const refusal = inUse(typeUses(type, whole))
  if (refusal) return refusal
  return prepared({ type: 'unitType.remove', id: type.id }, json({ id: type.id, name: type.name, removed: true }))
}
