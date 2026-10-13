// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The host's half of who is responsible for what on a sheet (ADR-0036,
 * amended 11 October 2026; `business/ui/FunctionInspector.SheetResponsible`):
 * the organisation's units to pick from — grouped by type in rank order,
 * each saying where it is filed — with this scope's other actors after them;
 * what an actor kept elsewhere is called; and whether a unit serves the
 * domain of the function it answers for, itself or through the unit above
 * it, by the rule the check reads (`projects/checks.coversDomain`).
 *
 * The organisation as this window has it — the open scope's session laid
 * over the index (`organisationHere`) — so a unit made a moment ago is on
 * offer at once. Kept once per model, index and day, so a sheet laid out
 * from it is laid out again only when one of them moves.
 *
 * And who stops being what if an actor is deleted from the sheet: a unit's
 * assignments go with it (ADR-0036, amended 12 October 2026).
 */
import { createElement } from 'react'
import type { Translate } from '../../i18n'
import type { ElementId } from '../../model'
import type { HostModel } from '../../model/hostModel'
import { deletionSummary } from '../../model/deletion'
import { isUnit } from '../../model/units'
import type { SheetResponsible } from '../../business/ui/FunctionInspector'
import { servesDomainOn } from '../../projects/checks'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { organisationHere } from './organisationHere'
import { unitChoices } from './choices'
import { RolesEndedHere } from './RolesEndedHere'

export type SheetResponsibleAt = {
  index: ScopeIndex
  scope: ScopePath
  model: HostModel
  day: string
  scopeName: (path: ScopePath) => string
  s: Translate
  /** Deleting units, as the host makes it (`useWorkspaceOwnership`, 3.6.2): absent, a unit deletes as any actor does. */
  unitDeletion?: (elementIds: readonly ElementId[]) => ReturnType<NonNullable<SheetResponsible['unitDeletion']>>
}

/** Who may be made responsible on the open scope's sheet, and what is said of them. */
export function sheetResponsibleOf(at: SheetResponsibleAt): SheetResponsible {
  const { index, scope, model, day, scopeName, s } = at
  const here = organisationHere(index, scope, model)
  const { organisation } = here
  const filedIn = (id: ElementId) => here.unitAt(id)?.scope
  const units = new Map(organisation.units.filter(isUnit).map((unit) => [unit.id, unit]))
  const others = model.elements
    .filter((element) => element.kind === 'actor' && !units.has(element.id) && !isUnit(element))
    .map((element) => ({ id: element.id, label: element.name, group: s('pick.otherActors') }))
  // The domain of a function: this scope where it defines it, its master's where it is a stand-in here.
  const domainOf = (functionId: ElementId) => {
    const held = model.elements.find((element) => element.id === functionId)
    if (held && held.ref === undefined) return scope
    return index.lookup(functionId)?.master ?? held?.ref ?? scope
  }
  return {
    choices: [...unitChoices({ organisation, filedIn, day, scopeName, s }), ...others],
    name: (id) => units.get(id)?.name ?? index.lookup(id)?.name,
    serves: (actorId, functionId) => !units.has(actorId)
      || servesDomainOn(organisation, actorId, domainOf(functionId), day, filedIn),
    rolesEnded: (actorId) => {
      const summary = deletionSummary(model, { elementIds: [actorId], connectionIds: [], domainGroups: [] }, day)
      if (summary.roles.length === 0 && summary.earlierAssignments === 0) return undefined
      const roleName = new Map(organisation.roles.map((role) => [role.id, role.name]))
      return createElement(RolesEndedHere, {
        summary, s,
        role: (id) => roleName.get(id) ?? id,
        unit: (id) => model.elements.find((element) => element.id === id)?.name ?? id,
      })
    },
    ...(at.unitDeletion ? { unitDeletion: (actorId: ElementId) => at.unitDeletion?.([actorId]) } : {}),
  }
}

/** The same answer for the same model, index, scope and day: the sheet's memo is keyed on it. */
export function sheetResponsibleFor(at: SheetResponsibleAt): SheetResponsible {
  const held = kept.get(at.model)
  if (held && held.index === at.index && held.scope === at.scope && held.day === at.day && held.scopeName === at.scopeName && held.s === at.s
    && held.unitDeletion === at.unitDeletion) {
    return held.answer
  }
  const answer = sheetResponsibleOf(at)
  kept.set(at.model, { ...at, answer })
  return answer
}
const kept = new WeakMap<HostModel, SheetResponsibleAt & { answer: SheetResponsible }>()
