// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What leaving does beyond the register, composed once for the People page
 * and the agent alike (`people/leave.ts`, ADR-0036 §10).
 *
 * **The seam the assignments hook into.** Marking someone as left ends their
 * assignments on their last day, in one step — and until units and roles
 * have assignments there is nothing to end, so the list is empty. The step
 * that brings assignments adds the consequence that ends them here: a
 * `LeaveConsequence` that finds the person's assignments across the tree and
 * writes their ends as one step per scope, answering how many it ended.
 */
import type { LeaveConsequence } from '../../people/leave'
import type { Repositories } from '../../ports/Repositories'

export function leaveConsequences(_deps: { repositories: Pick<Repositories, 'scopes'> }): readonly LeaveConsequence[] {
  return []
}
