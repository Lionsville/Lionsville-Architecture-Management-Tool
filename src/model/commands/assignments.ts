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
import type { Assignment } from '../units'
import { outOfOrder } from './handler'
import type { PatchKeys } from './handler'
import { plainFamily } from './plain'

/** Every field of an assignment but its id. */
const ASSIGNMENT_FIELDS: PatchKeys<'assignment.update'> = {
  unitId: true, roleId: true, person: true, share: true, from: true, until: true, acting: true, reportsTo: true, endedByLeaving: true,
}

/** Whether an assignment's days run forwards: no last day before its first. */
export function assignmentDaysInOrder(assignment: Pick<Assignment, 'from' | 'until'>): boolean {
  return !(isDay(assignment.from) && isDay(assignment.until) && assignment.until < assignment.from)
}

export const ASSIGNMENT_COMMANDS = plainFamily('assignments', {
  fields: ASSIGNMENT_FIELDS,
  refuses: (_model, assignment) => (assignmentDaysInOrder(assignment) ? undefined : outOfOrder),
})
