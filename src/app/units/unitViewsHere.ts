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
 * below them, own. A plan's day is held against a map around the units it
 * changes, across the whole organisation (`conwayInputAround`).
 *
 * Off the index the shell already holds and the session: nothing loads for it.
 * The plans that bring a unit and end it are read the same way — the open
 * scope's as its session has them, the rest the index's — so the chart names
 * the plan beside a unit's first and last day.
 */
import { conwayApplication } from '../../model/conway'
import type { ConwayApplication, ConwayInput, ConwayInteraction, ConwayRow } from '../../model/conway'
import type { HostModel } from '../../model/hostModel'
import type { ElementId, Relation } from '../../model/types'
import { isUnit, organisationOn, unitsBelow } from '../../model/units'
import type { UnitLike } from '../../model/units'
import type { OrganisationAt } from '../../projects/checks'
import { unitPlansOf } from '../../projects/scopeIndex'
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
  /** The plans that bring a unit and end it, where one does: the first of each the tree names. */
  plansOf: (id: ElementId) => UnitPlans
}

/** A plan, as a badge names it: by its number, `TR-0007`. */
export type PlanNamed = { id: string; number: number }

/** The plan that introduces a unit and the one that retires it. */
export type UnitPlans = { introduces?: PlanNamed; retires?: PlanNamed }

const NO_PLANS: UnitPlans = {}

export function unitViewsHere(index: ScopeIndex, scope: ScopePath, model: HostModel): UnitViewsHere {
  const at = organisationHere(index, scope, model)
  const held = new Set(model.elements.filter((element) => element.ref === undefined).map((element) => element.id))
  const scopeOf = (id: ElementId): ScopePath | undefined => (held.has(id) ? scope : at.unitAt(id)?.scope ?? index.lookup(id)?.master)
  const names = new Map(model.elements.map((element) => [element.id, element.name]))
  const plans = new Map<ElementId, UnitPlans>()
  for (const { unitId, role, plan } of [...index.unitPlans().filter((one) => one.scope !== scope), ...unitPlansOf(scope, model)]) {
    const held = plans.get(unitId) ?? {}
    if (held[role] === undefined) plans.set(unitId, { ...held, [role]: plan })
  }
  return {
    at,
    includes: (unit) => {
      const filed = scopeOf(unit.id)
      return (filed !== undefined && isWithinScope(filed, scope)) || (unit.scopes ?? []).some((one) => isWithinScope(one, scope))
    },
    scopeOf,
    heldHere: (id) => held.has(id),
    name: (id) => names.get(id) ?? at.unitAt(id)?.name ?? index.lookup(id)?.name ?? id,
    plansOf: (id) => plans.get(id) ?? NO_PLANS,
  }
}

/**
 * What a Conway map in this scope is drawn from: the applications filed here
 * or below and those the view's units own, with each one's owner as the
 * scope that answers for it says; the interfaces between them; and every
 * interaction between two units. The open scope's own rows are its session's.
 * `day` is the map's: the units below the view's are those below on that day,
 * under the parents the plans' moves give them then.
 */
export function conwayInputHere(index: ScopeIndex, scope: ScopePath, model: HostModel, here: UnitViewsHere, day?: string): ConwayInput {
  const { organisation } = here.at
  const units = organisation.units.filter(isUnit)
  // The view's units and every unit below them on the day, as the chart draws them.
  const tree = day === undefined ? units : organisationOn(organisation, day).units.filter(isUnit)
  const included = new Set(units.filter(here.includes).flatMap((unit) => [unit.id, ...unitsBelow(tree, unit.id)]))
  const applications = applicationsHere(index, scope, model, included)
  const reach = new Set(applications.map((app) => app.id))
  return {
    units,
    ...(organisation.moves ? { moves: organisation.moves } : {}),
    unitTypes: organisation.unitTypes,
    applications,
    flows: rowsHere(index, scope, model, reach, 'flow'),
    interactions: rowsHere(index, scope, model, new Set(units.map((unit) => unit.id)), 'interacts')
      .map((row): ConwayInteraction => ({ ...row, ...(row.mode !== undefined ? { mode: row.mode } : {}) })),
    owns: here.at.owns,
  }
}

/**
 * What the Conway map around some units is drawn from, across the whole
 * organisation (ADR-0036 §6, §7): the applications those units own wherever
 * each is filed, the interfaces from them and the applications at their other
 * ends, and every interaction between two units — what a plan's day is held
 * against. The open scope's applications and rows are its session's.
 */
export function conwayInputAround(
  index: ScopeIndex, scope: ScopePath, model: HostModel, at: OrganisationAt, unitIds: ReadonlySet<ElementId>,
): ConwayInput {
  const { organisation } = at
  const units = organisation.units.filter(isUnit)
  const own = model.elements.filter((element) => element.kind === 'application' && element.ref === undefined)
  const kept = new Map(own.map((element) => [element.id, element]))
  const owned = [...own, ...index.register().filter((entry) => entry.master !== undefined && entry.master !== scope)]
    .filter((app) => app.partyId !== undefined && unitIds.has(app.partyId))
  const near = new Set(owned.map((app) => app.id))
  const flows = rowsHere(index, scope, model, near, 'flow')
  // The other ends: the open scope's from its session, the rest the index's.
  const far = [...new Set(flows.flatMap((row) => [row.sourceId, row.targetId]))].filter((id) => !near.has(id)).flatMap((id) => {
    const entry = index.lookup(id)
    const held = kept.get(id) ?? (entry?.kind === 'application' && entry.master !== undefined && entry.master !== scope ? entry : undefined)
    return held ? [held] : []
  })
  return {
    units,
    ...(organisation.moves ? { moves: organisation.moves } : {}),
    unitTypes: organisation.unitTypes,
    applications: [...owned, ...far].map((app) => conwayApplication(app)),
    flows,
    interactions: rowsHere(index, scope, model, new Set(units.map((unit) => unit.id)), 'interacts')
      .map((row): ConwayInteraction => ({ ...row, ...(row.mode !== undefined ? { mode: row.mode } : {}) })),
    owns: at.owns,
  }
}

/** The applications of this scope's map, by id, each once: the session's for the open scope, the index's for the rest. */
function applicationsHere(index: ScopeIndex, scope: ScopePath, model: HostModel, units: ReadonlySet<ElementId>): ConwayApplication[] {
  const found = new Map<ElementId, ConwayApplication>()
  for (const element of model.elements) {
    if (element.kind !== 'application' || element.ref !== undefined) continue
    found.set(element.id, conwayApplication(element))
  }
  for (const entry of index.register()) {
    if (found.has(entry.id) || entry.master === scope || entry.master === undefined) continue
    const filed = isWithinScope(entry.master, scope)
    if (!filed && (entry.partyId === undefined || !units.has(entry.partyId))) continue
    found.set(entry.id, conwayApplication(entry))
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

/**
 * Where a link to an element lands when the element is a unit this scope
 * keeps and the scope has an organisation chart (ADR-0036 §7): on that chart,
 * with the unit chosen, so its inspector beside the chart opens on it. Every
 * other link lands where a link to an element lands (`useShowElement`). What a
 * draw.io box that points at a unit opens.
 */
export function unitLanding<T extends { page?: string; id?: string }>(model: HostModel, to: T): T | { page: 'chart'; id: string; select: ElementId } {
  if (to.page !== 'element' || to.id === undefined) return to
  const id = to.id
  const element = model.elements.find((one) => one.id === id)
  if (!element || element.ref !== undefined || !isUnit(element)) return to
  const chart = model.diagrams.find((diagram) => diagram.kind === 'chart')
  return chart ? { page: 'chart', id: chart.id, select: id } : to
}
