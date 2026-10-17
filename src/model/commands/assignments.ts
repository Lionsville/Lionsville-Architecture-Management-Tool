// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who holds which role in which unit (ADR-0036 §4): an assignment added,
 * corrected or ended, and removed — the three moves every record family has,
 * and the same inverses. Ending one is a correction that sets its last day,
 * so it is `assignment.update` and undo takes the day off again.
 *
 * **One rule is the writer's**: an assignment's days run forwards, as an
 * element's lifecycle dates must, so the agent, a paste and an undo all get
 * the same answer. Everything else an assignment can contradict — a unit or a
 * role nobody holds any more, a person over all of their time, a role over
 * its maximum — is a finding (`model/units.ts`), never a refusal, because a
 * reorganisation passes through every one of them.
 */
import { isDay } from '../lifecycle'
import { assignmentsOf } from '../normalised'
import type { Assignment } from '../units'
import { gone, ok, outOfOrder, taken } from './handler'
import type { CommandTable, PatchKeys } from './handler'
import { drop, patched, put, withAssignments } from './rows'
import { patchWrites } from './writes'

/** Every field of an assignment but its id. */
const ASSIGNMENT_FIELDS: PatchKeys<'assignment.update'> = {
  unitId: true, roleId: true, person: true, share: true, from: true, until: true, acting: true, reportsTo: true,
}

/** Whether an assignment's days run forwards: no last day before its first. */
export function assignmentDaysInOrder(assignment: Pick<Assignment, 'from' | 'until'>): boolean {
  return !(isDay(assignment.from) && isDay(assignment.until) && assignment.until < assignment.from)
}

export const ASSIGNMENT_COMMANDS = {
  'assignment.add': {
    carries: { assignment: true },
    writes: (command) => [`assignment/${command.assignment.id}`],
    apply(model, command, { meta }) {
      const { assignment, at } = command
      if (assignment.id in assignmentsOf(model)) return taken
      if (!assignmentDaysInOrder(assignment)) return outOfOrder
      const rows = put(assignmentsOf(model), model.order.assignments, assignment.id, assignment, at)
      return ok(withAssignments(model, rows), { type: 'assignment.remove', id: assignment.id }, meta)
    },
  },

  'assignment.update': {
    carries: { id: true, patch: true },
    patch: { keys: ASSIGNMENT_FIELDS, row: (model, command) => assignmentsOf(model)[command.id] },
    writes: (command) => patchWrites(`assignment/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const held = assignmentsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      if (!assignmentDaysInOrder(row)) return outOfOrder
      const rows = put(assignmentsOf(model), model.order.assignments, command.id, row)
      return ok(withAssignments(model, rows), { type: 'assignment.update', id: command.id, patch: inverse }, meta)
    },
  },

  'assignment.remove': {
    carries: { id: true },
    writes: (command) => [`assignment/${command.id}`],
    apply(model, command, { meta }) {
      const held = assignmentsOf(model)[command.id]
      if (!held) return gone
      const at = model.order.assignments.indexOf(command.id)
      const rows = drop(assignmentsOf(model), model.order.assignments, command.id)
      return ok(withAssignments(model, rows), { type: 'assignment.add', assignment: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>
