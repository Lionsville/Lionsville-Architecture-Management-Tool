// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The fixes that are one field or one press, as commands, so a finding is put
 * right where it is read rather than on another screen with the sentence lost.
 * Each says what writes it and what puts it back: nothing is open here, so no ⌘Z
 * reaches it, and the way back is a step of its own in the same scope.
 *
 * A finding with none of these (a line's dates, a retirement) only opens, on the
 * field that fixes it. Pure, and over as much of the index as it reads.
 */
import type { Command, ElementId } from '../../model'
import { transaction } from '../../model/commands'
import { acceptImplied, impliedInterfacesOn } from '../../model/implied'
import type { PersonId } from '../../model/person'
import type { InteractionMode } from '../../model/types'
import type { ScopeModel } from '../../projects/scope'
import { ownerPatch } from '../../model/ownerField'
import type { OwnerChoice } from '../../model/ownerField'
import type { Assignment } from '../../model/units'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import type { CheckInstance } from './treeChecks'

/** One fix: where it is written, and the commands each way. */
export type Fix = { readonly scope: ScopePath; readonly commands: readonly Command[]; readonly back: readonly Command[] }

type Index = Pick<ScopeIndex, 'lookup' | 'assignments' | 'rowsOf'>

/** Where a record's own fields are written: the scope that answers for it. */
function masterOf(index: Index, id: ElementId): ScopePath | undefined {
  return index.lookup(id)?.master
}

/** The application's owner set: both keys said each way, so the field stays one answer and an undo brings both back. */
export function setOwnerFix(index: Index, id: ElementId, choice: OwnerChoice): Fix | undefined {
  const entry = index.lookup(id)
  const scope = masterOf(index, id)
  if (!entry || scope === undefined) return undefined
  return {
    scope,
    commands: [{ type: 'element.update', id, patch: ownerPatch(choice) }],
    back: [{ type: 'element.update', id, patch: { owner: entry.owner, partyId: entry.partyId } }],
  }
}

export function markSharedFix(index: Index, id: ElementId): Fix | undefined {
  const scope = masterOf(index, id)
  if (scope === undefined) return undefined
  return {
    scope,
    commands: [{ type: 'element.update', id, patch: { shared: true } }],
    back: [{ type: 'element.update', id, patch: { shared: undefined } }],
  }
}

/** The assignment a finding is about, by the id the finding says, and the scope that keeps it. */
function assignmentOf(index: Index, instance: CheckInstance): { scope: ScopePath; assignment: Assignment } | undefined {
  const id = 'fields' in instance.finding ? instance.finding.fields?.[0] : undefined
  return id === undefined ? undefined : index.assignments().find((one) => one.assignment.id === id)
}

/** An assignment past its unit's or role's end: ended on the day before it would read wrong, today. */
export function endAssignmentFix(index: Index, instance: CheckInstance, today: string): Fix | undefined {
  const held = assignmentOf(index, instance)
  if (!held) return undefined
  return {
    scope: held.scope,
    commands: [{ type: 'assignment.update', id: held.assignment.id, patch: { until: today } }],
    back: [{ type: 'assignment.update', id: held.assignment.id, patch: { until: held.assignment.until } }],
  }
}

/** An assignment whose unit is not there: taken away, and put back whole. */
export function removeAssignmentFix(index: Index, instance: CheckInstance): Fix | undefined {
  const held = assignmentOf(index, instance)
  if (!held) return undefined
  return {
    scope: held.scope,
    commands: [{ type: 'assignment.remove', id: held.assignment.id }],
    back: [{ type: 'assignment.add', assignment: held.assignment }],
  }
}

/** An interaction no interface needs: its row taken away, and put back whole. */
export function removeInteractionFix(index: Index, instance: CheckInstance): Fix | undefined {
  const { finding } = instance
  if (!('kind' in finding) || finding.kind !== 'unused') return undefined
  const { sourceId } = finding.interaction
  const row = index.rowsOf(sourceId).find(({ relation }) => relation.id === finding.interaction.id)
  if (!row) return undefined
  return {
    scope: row.scope,
    commands: [{ type: 'relation.delete', id: row.relation.id }],
    back: [{ type: 'relation.create', relation: row.relation }],
  }
}

/** A role a unit should have somebody in: the person picked, holding it from today, and taken away again. */
export function assignFix(index: Index, instance: CheckInstance, person: PersonId, id: string, today: string): Fix | undefined {
  const unitId = instance.about
  const roleId = 'fields' in instance.finding ? instance.finding.fields?.[0] : undefined
  const scope = unitId !== undefined ? masterOf(index, unitId) : undefined
  if (unitId === undefined || roleId === undefined || scope === undefined) return undefined
  return {
    scope,
    commands: [{ type: 'assignment.add', assignment: { id, unitId, roleId, person: { person }, from: today } }],
    back: [{ type: 'assignment.remove', id }],
  }
}

/** An interface between two groups with nothing declared: the interaction, kept where the interface's row is. */
export function declareFix(instance: CheckInstance, mode: InteractionMode, id: string): Fix | undefined {
  const { finding, scope } = instance
  if (!('kind' in finding) || finding.kind !== 'undeclared' || scope === undefined) return undefined
  return {
    scope,
    commands: [{ type: 'relation.create', relation: { id, type: 'interacts', sourceId: finding.from, targetId: finding.to, mode } }],
    back: [{ type: 'relation.delete', id }],
  }
}

/** Container lines that add up to an interface nobody drew: the interface accepted, with the lines landed on it, and all of that taken back. */
export function acceptFix(
  model: Pick<ScopeModel['model'], 'elements' | 'relations'> | undefined, instance: CheckInstance, id: string, today: string,
  nameOf: (element: ElementId) => string,
): Fix | undefined {
  const { finding, scope } = instance
  if (!model || scope === undefined || !('subject' in finding)) return undefined
  const implied = impliedInterfacesOn({ elements: [...model.elements], relations: [...model.relations] }, today)
    .find((one) => one.relations.some((row) => row.id === finding.id))
  if (!implied) return undefined
  return {
    scope,
    commands: [acceptImplied(implied, id, nameOf)],
    back: [transaction([
      ...implied.relations.map((row) => ({ type: 'relation.update' as const, id: row.id, patch: { refines: row.refines } })),
      { type: 'relation.delete', id },
    ])],
  }
}
