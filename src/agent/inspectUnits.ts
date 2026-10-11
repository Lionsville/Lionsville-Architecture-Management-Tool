// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `diagram.inspect` on an organisation chart and a Conway map (ADR-0036 §7):
 * neither has geometry, so each reports what it draws, worked out by the
 * model's own arithmetic over the tree the shell holds with the open scope
 * laid over it — the units as a tree with each role's holders and vacancies
 * on the view's day; the units over their applications, the interfaces that
 * cross between them, and the findings.
 *
 * A person is reported by register id, as every assignment is: who they
 * are is `people.list`'s and `assignments.list`'s to say, under the
 * organisation's policy.
 */
import { conwayApplication, conwayMap, ownsOf } from '../model/conway'
import type { ConwayApplication, ConwayInteraction, ConwayRow } from '../model/conway'
import type { HostModel } from '../model/hostModel'
import { isDay } from '../model/lifecycle'
import { orgChart } from '../model/orgChart'
import type { ChartUnit } from '../model/orgChart'
import type { DesignDiagram, ElementId, Relation } from '../model/types'
import { isUnit, organisationOn, unitsBelow } from '../model/units'
import type { UnitLike } from '../model/units'
import { assignmentsNow, organisationNow } from './assignments'
import type { OpenDocument } from './assignments'
import type { TreeView } from './tree'

/** Is `path` this scope, or one filed anywhere beneath it? The organisation is "". */
function within(path: string, scope: string): boolean {
  return scope === '' || path === scope || path.startsWith(`${scope}/`)
}

/** The scope that keeps each unit: the open scope for its own, the tree's for the rest. */
function filedIn(tree: TreeView | undefined, open: OpenDocument): (id: ElementId) => string | undefined {
  const here = new Set(open.current.elements.filter((one) => one.ref === undefined).map((one) => one.id))
  const kept = new Map((tree?.units?.() ?? []).map((one) => [one.unit.id, one.scope]))
  return (id) => (here.has(id) ? open.path : kept.get(id) ?? tree?.lookup(id)?.master)
}

/** Whether a unit is a view's in this scope: filed here or below, or serving a scope here or below. */
function includes(tree: TreeView | undefined, open: OpenDocument): (unit: UnitLike) => boolean {
  const scopeOf = filedIn(tree, open)
  return (unit) => {
    const filed = scopeOf(unit.id)
    return (filed !== undefined && within(filed, open.path)) || (unit.scopes ?? []).some((one) => within(one, open.path))
  }
}

function dayOf(diagram: Pick<DesignDiagram, 'asOf'>, open: OpenDocument): string {
  return isDay(diagram.asOf) ? diagram.asOf : open.today
}

/** The organisation chart: its units as a tree, each role against who holds it on the day. */
export function inspectChart(tree: TreeView | undefined, open: OpenDocument, diagram: Pick<DesignDiagram, 'id' | 'asOf'>, limit = 200) {
  const day = dayOf(diagram, open)
  const held = assignmentsNow(tree, open)
  const organisation = organisationNow(tree, open, held.map((one) => one.assignment))
  const chart = orgChart(organisation, day, { include: includes(tree, open) })
  const scopeOf = filedIn(tree, open)
  const roles = new Map(organisation.roles.map((role) => [role.id, role.name]))
  const types = new Map(organisation.unitTypes.map((type) => [type.id, type.name]))
  let left = limit
  const unit = (one: ChartUnit): Record<string, unknown> | undefined => {
    if (left <= 0) return undefined
    left -= 1
    return {
      id: one.id, name: one.name, scope: scopeOf(one.id),
      ...(one.unitTypeId !== undefined ? { unitTypeId: one.unitTypeId, unitType: types.get(one.unitTypeId) } : {}),
      ...(one.serves.length > 0 ? { serves: one.serves } : {}),
      ...(one.ended ? { ended: true } : {}),
      slots: one.slots.map((slot) => ({
        roleId: slot.roleId, role: roles.get(slot.roleId) ?? slot.roleId, min: slot.min, ...(slot.max !== undefined ? { max: slot.max } : {}),
        holders: slot.holders.map((holder) => ({
          personId: holder.person, share: Math.round(holder.share * 100), ...(holder.overloaded ? { overloaded: true } : {}),
        })),
        ...(slot.vacant > 0 ? { vacant: slot.vacant } : {}),
      })),
      ...(one.others.length > 0 ? {
        others: one.others.map((other) => ({ personId: other.person, roleId: other.assignment.roleId, ...(other.endedRole ? { endedRole: true } : {}) })),
      } : {}),
      children: one.children.map(unit).filter((child) => child !== undefined),
    }
  }
  return { kind: 'chart', id: diagram.id, day, units: chart.units, people: chart.people, roots: chart.roots.map(unit).filter((one) => one !== undefined) }
}

/** The Conway map: the units over their applications, the interfaces between them, and the findings. */
export function inspectConway(tree: TreeView | undefined, open: OpenDocument, diagram: Pick<DesignDiagram, 'id' | 'asOf'>, limit = 200) {
  const day = dayOf(diagram, open)
  const organisation = organisationNow(tree, open, assignmentsNow(tree, open).map((one) => one.assignment))
  const units = organisation.units.filter(isUnit)
  const include = includes(tree, open)
  // Below on the map's day, under the parents the plans' moves give then.
  const onDay = organisationOn(organisation, day).units.filter(isUnit)
  const viewUnits = new Set(units.filter(include).flatMap((one) => [one.id, ...unitsBelow(onDay, one.id)]))
  const applications = applicationsOf(tree, open.current, open.path, viewUnits)
  // What a type's limit is held to: every application of the organisation there on the day, as the page counts them.
  const owns = ownsOf([
    ...(tree?.register() ?? []).filter((entry) => entry.master !== open.path),
    ...open.current.elements.filter((element) => element.kind === 'application' && element.ref === undefined),
  ])
  const map = conwayMap({
    units, ...(organisation.moves ? { moves: organisation.moves } : {}), unitTypes: organisation.unitTypes, applications, owns,
    flows: rowsOf(tree, open.current, applications.map((app) => app.id), 'flow'),
    interactions: rowsOf(tree, open.current, units.map((one) => one.id), 'interacts') as ConwayInteraction[],
  }, day)
  const name = (id: ElementId | undefined) => (id === undefined ? undefined : units.find((one) => one.id === id)?.name ?? tree?.lookup(id)?.name ?? id)
  return {
    kind: 'conway', id: diagram.id, day,
    groups: map.groups.map((group) => ({
      ...(group.unitId !== undefined ? { unitId: group.unitId, unit: name(group.unitId) } : { unit: null }),
      applications: group.applications.map((app) => ({ id: app.id, name: app.name })),
    })),
    crossing: map.lines.filter((line) => line.status !== 'inside').slice(0, limit).map((line) => ({
      flowId: line.flow.id, sourceId: line.flow.sourceId, targetId: line.flow.targetId, status: line.status,
      ...(line.from !== undefined ? { from: line.from } : {}), ...(line.to !== undefined ? { to: line.to } : {}),
      ...(line.interaction ? { interactionId: line.interaction.id, ...(line.interaction.mode ? { mode: line.interaction.mode } : {}) } : {}),
    })),
    interactions: map.interactions.map((row) => ({ id: row.id, sourceId: row.sourceId, targetId: row.targetId, ...(row.mode ? { mode: row.mode } : {}) })),
    findings: map.findings.slice(0, limit),
  }
}

/** The applications of a map in this scope: the open scope's own, those filed below, and those its units own. */
function applicationsOf(tree: TreeView | undefined, current: HostModel, scope: string, units: ReadonlySet<ElementId>): ConwayApplication[] {
  const found = new Map<ElementId, ConwayApplication>()
  for (const element of current.elements) {
    if (element.kind !== 'application' || element.ref !== undefined) continue
    found.set(element.id, conwayApplication(element))
  }
  for (const entry of tree?.register() ?? []) {
    if (found.has(entry.id) || entry.master === undefined || entry.master === scope) continue
    if (!within(entry.master, scope) && (entry.partyId === undefined || !units.has(entry.partyId))) continue
    found.set(entry.id, conwayApplication(entry))
  }
  return [...found.values()]
}

/** The rows of one type ending on the ids given: the open scope's from its document, the rest from the tree. */
function rowsOf(tree: TreeView | undefined, current: HostModel, ids: readonly ElementId[], type: 'flow' | 'interacts'): (ConwayRow & Pick<Relation, 'mode'>)[] {
  const ends = new Set(ids)
  const found = new Map<string, Relation>()
  for (const row of current.relations) if (row.type === type && (ends.has(row.sourceId) || ends.has(row.targetId))) found.set(row.id, row)
  for (const id of ids) for (const row of tree?.rowsTo?.(id, [type]) ?? []) if (!found.has(row.id)) found.set(row.id, row)
  return [...found.values()]
}
