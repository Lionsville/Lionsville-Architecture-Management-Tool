// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What leaving does beyond the register, composed once for the People page
 * and the agent alike (`people/leave.ts`, ADR-0036 §10).
 *
 * **Leaving ends the person's assignments.** Every assignment of theirs that
 * runs past their last day ends on it, and one that would only begin after it
 * is taken away (`model/units.endingFor`) — under their own id and under
 * every id a merge folded into theirs. Each scope that keeps one gets **one
 * step**, and the scopes are written together: the others in one `apply`
 * over the source's repositories, each expecting what was read, so all of
 * them land or none does (`changeScopes`).
 *
 * **The open scope's part goes through its session**, never through the
 * repository, for the reason a change across the tree gives
 * (`useChangeAcross.ts`): the session may hold work it has not written yet,
 * and writes expecting the revision it last saw. So the open scope is read
 * from the session and its step dispatched there — one step on its undo
 * stack — after the other scopes have landed.
 *
 * Which scopes keep one is read off the organisation's index, which lists
 * every assignment with its scope; the open scope is asked as well, since it
 * may hold one the index has not seen yet.
 */
import { transaction } from '../../model/commands'
import type { Command } from '../../model/commands'
import { assignmentList, fromArrays } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import type { PersonId } from '../../model/person'
import { endingFor } from '../../model/units'
import type { Ending } from '../../model/units'
import type { LeaveConsequence } from '../../people/leave'
import type { Person } from '../../people/person'
import type { Repositories } from '../../ports/Repositories'
import { changeScopes } from '../../projects/scopeAccess'
import type { ScopeCommand } from '../../projects/scopeState'

/** The scope open in this window, as leaving reads and writes it: through its session. */
export type OpenScope = {
  scopePath(): string
  indexed(): Model
  /** The one way in. Answers nothing where the reducer refused. */
  dispatch(command: Command): unknown
}

export type LeavingDeps = {
  repositories: Pick<Repositories, 'scopes' | 'index' | 'people'>
  /** The scope open in this window, where one is. */
  openScope?: () => OpenScope | undefined
  /** Whose steps these are, where not the person's: an agent's leave marks every step its own. */
  origin?: 'agent'
}

export function leaveConsequences(deps: LeavingDeps): readonly LeaveConsequence[] {
  return [endAssignments(deps)]
}

/** The one step a scope's ends make, under whose name they are. */
function stepOf(ends: readonly Ending[], origin: 'agent' | undefined): Command {
  const meta = origin ? { origin } : {}
  return ends.length === 1 ? { ...ends[0], ...meta } : transaction([...ends], meta)
}

/** Every id that is this person's: the entry, and each one a merge folded into it. */
async function idsOf(person: Person, deps: LeavingDeps): Promise<Set<PersonId>> {
  const { people } = await deps.repositories.people.list()
  return new Set([person.id, ...people.filter((one) => one.mergedInto === person.id).map((one) => one.id)])
}

function endAssignments(deps: LeavingDeps): LeaveConsequence {
  return async (person, lastDay) => {
    const ids = await idsOf(person, deps)
    const open = deps.openScope?.()
    const openPath = open?.scopePath()
    const read = await deps.repositories.index.read()
    const others = read.scopes
      .filter((scope) => scope.address !== openPath && endingFor(scope.model.assignments ?? [], ids, lastDay).length > 0)
      .map((scope) => scope.address)
    let ended = 0
    if (others.length > 0) {
      await changeScopes(deps.repositories.scopes, others, (held) => {
        ended = 0
        const steps = new Map<string, ScopeCommand[]>()
        for (const [path, scope] of held) {
          const ends = endingFor(assignmentList(fromArrays(scope.model)), ids, lastDay)
          if (ends.length === 0) continue
          ended += ends.length
          steps.set(path, [stepOf(ends, deps.origin)])
        }
        return steps
      })
    }
    if (open) {
      const ends = endingFor(assignmentList(open.indexed()), ids, lastDay)
      if (ends.length > 0 && open.dispatch(stepOf(ends, deps.origin)) !== undefined) ended += ends.length
    }
    return ended
  }
}
