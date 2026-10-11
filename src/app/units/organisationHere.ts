// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation as a window with one scope open has it (ADR-0036 §3): the
 * tree as the index read it, with the open scope's own units, assignments
 * and — at the organisation — operating model as its session holds them now.
 *
 * The index follows the steps once they are written; the session has them
 * the moment they are made. A unit's section reads this, so an assignment
 * made a second ago is a holder, fills a vacancy and counts towards a
 * person's load at once — and everything kept elsewhere is the index's. The
 * open scope's plans are laid over the tree's the same way, so a move just
 * put on a plan moves the unit on its day at once (ADR-0036 §6).
 */
import type { HostModel } from '../../model/hostModel'
import { isUnit } from '../../model/units'
import type { Assignment } from '../../model/units'
import type { ElementId } from '../../model/types'
import { organisationAt } from '../../projects/checks'
import type { OrganisationAt } from '../../projects/checks'
import { movesOf } from '../../projects/scopeIndex'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'

export function organisationHere(index: ScopeIndex, scope: ScopePath, model: HostModel): OrganisationAt {
  const base = organisationAt(index)
  const units = model.elements.filter((element) => element.ref === undefined && isUnit(element))
  const unitsHere = new Map(units.map((unit) => [unit.id, unit]))
  const indexedHere = new Set(index.units().filter((one) => one.scope === scope).map((one) => one.unit.id))
  const assignments = model.assignments ?? []
  const assignmentsHere = new Set<Assignment>(assignments)
  const keptHere = new Set(index.assignments().filter((one) => one.scope === scope).map((one) => one.assignment))
  const atRoot = scope === ''
  const owned = new Map<ElementId, number>()
  for (const entry of index.register()) {
    if (entry.partyId !== undefined && entry.master !== scope) owned.set(entry.partyId, (owned.get(entry.partyId) ?? 0) + 1)
  }
  for (const element of model.elements) {
    if (element.kind === 'application' && element.ref === undefined && element.partyId !== undefined) {
      owned.set(element.partyId, (owned.get(element.partyId) ?? 0) + 1)
    }
  }
  const moves = [
    ...index.moves().filter((one) => one.scope !== scope),
    ...movesOf(scope, model),
  ].map((one) => one.move)
  return {
    organisation: {
      units: [...base.organisation.units.filter((unit) => !unitsHere.has(unit.id) && !indexedHere.has(unit.id)), ...units],
      assignments: [...base.organisation.assignments.filter((one) => !keptHere.has(one)), ...assignments],
      roles: atRoot ? model.roles ?? [] : base.organisation.roles,
      unitTypes: atRoot ? model.unitTypes ?? [] : base.organisation.unitTypes,
      ...(moves.length ? { moves } : {}),
    },
    unitAt: (id) => {
      const unit = unitsHere.get(id)
      return unit ? { scope, name: unit.name, type: unit.unitTypeId ?? '' } : base.unitAt(id)
    },
    assignmentAt: (assignment) => (assignmentsHere.has(assignment) ? scope : base.assignmentAt(assignment)),
    owns: (id) => owned.get(id) ?? 0,
  }
}
