// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the organisation chart and the Conway map are drawn from (ADR-0036
 * §7), as a window with one scope open has it: the organisation off the
 * index with the open scope's session laid over it (`organisationHere`), the
 * units a view in this scope is of, and the applications, the interfaces
 * between them and the interactions between the units.
 *
 * **A view is of its scope.** One kept at the organisation is of every unit;
 * one kept in a domain is of the units filed there or below, and of the
 * units that serve it from above — a cluster filed at the top that serves
 * three domains is on each of their charts. A Conway map in a scope is of the
 * applications filed there or below and of those its units, and the units
 * below them, own.
 *
 * Off the index the shell already holds and the session: nothing loads for it.
 */
import type { ConwayApplication, ConwayInput, ConwayInteraction, ConwayRow } from '../../model/conway'
import type { HostModel } from '../../model/hostModel'
import type { ElementId, Relation } from '../../model/types'
import { isUnit, unitsBelow } from '../../model/units'
import type { UnitLike } from '../../model/units'
import type { OrganisationAt } from '../../projects/checks'
import type { ScopeIndex } from '../../projects/scopeIndex'
import { isWithinScope } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { organisationHere } from './organisationHere'

export type UnitViewsHere = {
  /** The organisation, the open scope's session laid over the index. */
  at: OrganisationAt
  /** Whether a unit is this scope's view's: filed here or below, or serving a scope here or below. */
  includes: (unit: UnitLike) => boolean
  /** The scope that answers for a unit or an application, where the tree knows it. */
  scopeOf: (id: ElementId) => ScopePath | undefined
  /** Whether the open scope holds it — so it is chosen here, and its people and rows are changed here. */
  heldHere: (id: ElementId) => boolean
  /** What to call a unit, a party or an application. */
  name: (id: ElementId) => string
}

export function unitViewsHere(index: ScopeIndex, scope: ScopePath, model: HostModel): UnitViewsHere {
  const at = organisationHere(index, scope, model)
  const held = new Set(model.elements.filter((element) => element.ref === undefined).map((element) => element.id))
  const scopeOf = (id: ElementId): ScopePath | undefined => (held.has(id) ? scope : at.unitAt(id)?.scope ?? index.lookup(id)?.master)
  const names = new Map(model.elements.map((element) => [element.id, element.name]))
  return {
    at,
    includes: (unit) => {
      const filed = scopeOf(unit.id)
      return (filed !== undefined && isWithinScope(filed, scope)) || (unit.scopes ?? []).some((one) => isWithinScope(one, scope))
    },
    scopeOf,
    heldHere: (id) => held.has(id),
    name: (id) => names.get(id) ?? at.unitAt(id)?.name ?? index.lookup(id)?.name ?? id,
  }
}

/**
 * What a Conway map in this scope is drawn from: the applications filed here
 * or below and those the view's units own, with each one's owner as the
 * scope that answers for it says; the interfaces between them; and every
 * interaction between two units. The open scope's own rows are its session's.
 */
export function conwayInputHere(index: ScopeIndex, scope: ScopePath, model: HostModel, here: UnitViewsHere): ConwayInput {
  const { organisation } = here.at
  const units = organisation.units.filter(isUnit)
  // The view's units and every unit below them, as the chart draws them.
  const included = new Set(units.filter(here.includes).flatMap((unit) => [unit.id, ...unitsBelow(units, unit.id)]))
  const applications = applicationsHere(index, scope, model, included)
  const reach = new Set(applications.map((app) => app.id))
  return {
    units,
    unitTypes: organisation.unitTypes,
    applications,
    flows: rowsHere(index, scope, model, reach, 'flow'),
    interactions: rowsHere(index, scope, model, new Set(units.map((unit) => unit.id)), 'interacts')
      .map((row): ConwayInteraction => ({ ...row, ...(row.mode !== undefined ? { mode: row.mode } : {}) })),
    owns: here.at.owns,
  }
}

/** The applications of this scope's map, by id, each once: the session's for the open scope, the index's for the rest. */
function applicationsHere(index: ScopeIndex, scope: ScopePath, model: HostModel, units: ReadonlySet<ElementId>): ConwayApplication[] {
  const found = new Map<ElementId, ConwayApplication>()
  for (const element of model.elements) {
    if (element.kind !== 'application' || element.ref !== undefined) continue
    found.set(element.id, { id: element.id, name: element.name, ...(element.partyId !== undefined ? { partyId: element.partyId } : {}) })
  }
  for (const entry of index.register()) {
    if (found.has(entry.id) || entry.master === scope || entry.master === undefined) continue
    const filed = isWithinScope(entry.master, scope)
    if (!filed && (entry.partyId === undefined || !units.has(entry.partyId))) continue
    found.set(entry.id, { id: entry.id, name: entry.name, ...(entry.partyId !== undefined ? { partyId: entry.partyId } : {}) })
  }
  return [...found.values()]
}

/**
 * The rows of one type touching the ids given, each once: the open scope's
 * from its session, every other scope's from the index.
 */
function rowsHere(
  index: ScopeIndex, scope: ScopePath, model: HostModel, ends: ReadonlySet<ElementId>, type: 'flow' | 'interacts',
): (ConwayRow & Pick<Relation, 'mode'>)[] {
  const found = new Map<string, Relation>()
  for (const row of model.relations) {
    if (row.type === type && (ends.has(row.sourceId) || ends.has(row.targetId))) found.set(row.id, row)
  }
  for (const id of ends) {
    for (const { scope: kept, relation } of index.rowsOf(id)) {
      if (kept === scope || relation.type !== type || found.has(relation.id)) continue
      found.set(relation.id, relation)
    }
  }
  return [...found.values()]
}
