// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What leaving does beyond the register, composed once for the People page
 * and the agent alike (`people/leave.ts`, ADR-0036 §10).
 *
 * **Leaving ends the person's assignments.** Every assignment of theirs that
 * runs past their last day ends on it, and one that would only begin after it
 * is taken away — under their own id and under every id a merge folded into
 * theirs (`model/units.leavingStep`, which a server applying a leave itself
 * applies too). Each scope that keeps one gets **one step**, and the scopes
 * are written together: the others in one `apply` over the source's
 * repositories, each expecting what was read, so all of them land or none
 * does (`changeScopes`).
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
 *
 * **Asked before written.** The open scope's part is put to its reducer, and
 * the session asked whether it may be changed at all, before any scope is
 * written; a scope that refuses throws, and `people/leave.ts` then marks
 * nobody. **Not undone here.** The open scope's step carries a barrier: the
 * register keeps no history, so taking the ends back would leave someone who
 * has left holding everything they held.
 */
import type { StringKey } from '../../i18n'
import type { Command } from '../../model/commands'
import { assignmentList, fromArrays } from '../../model/normalised'
import { apply } from '../../model/reducer'
import { ShellError } from '../../platform/errors'
import type { Model } from '../../model/normalised'
import type { PersonId } from '../../model/person'
import { endingFor, leavingStep } from '../../model/units'
import type { LeaveConsequence } from '../../people/leave'
import type { Person } from '../../people/person'
import type { Repositories } from '../../ports/Repositories'
import { changeScopes } from '../../projects/scopeAccess'
import type { ScopeCommand } from '../../projects/scopeState'

/** Why the open scope's part of a leave cannot be undone there. */
export const LEAVE_BARRIER: StringKey = 'leave.barrier'

/** The scope open in this window, as leaving reads and writes it: through its session. */
export type OpenScope = {
  scopePath(): string
  indexed(): Model
  /** The one way in. Answers nothing where the reducer refused. */
  dispatch(command: Command): unknown
  /** Why nothing may be changed here now — the scope is only read, or has moved on — where a session says. */
  blocked?(): string | undefined
}

export type LeavingDeps = {
  repositories: Pick<Repositories, 'scopes' | 'index' | 'people'>
  /** The scope open in this window, where one is. */
  openScope?: () => OpenScope | undefined
  /** Whose steps these are, where not the person's: an agent's leave marks every step its own. */
  origin?: 'agent'
  /** Scopes other than the open one were written: the tree's index is to be read again. */
  onTreeChanged?: () => void
}

export function leaveConsequences(deps: LeavingDeps): readonly LeaveConsequence[] {
  return [endAssignments(deps)]
}

/** Every id that is this person's: the entry, and each one a merge folded into it. */
async function idsOf(person: Person, deps: LeavingDeps): Promise<Set<PersonId>> {
  const { people } = await deps.repositories.people.list()
  return new Set([person.id, ...people.filter((one) => one.mergedInto === person.id).map((one) => one.id)])
}

function endAssignments(deps: LeavingDeps): LeaveConsequence {
  return async (person, lastDay) => {
    const ids = await idsOf(person, deps)
    const meta = deps.origin ? { origin: deps.origin } : {}
    const open = deps.openScope?.()
    const openPath = open?.scopePath()
    const here = open ? leavingStep(assignmentList(open.indexed()), ids, lastDay, meta) : undefined
    if (open && here) {
      const blocked = open.blocked?.()
      if (blocked !== undefined) throw new ShellError(blocked === 'agent.conflict' ? 'shell.scopeMoved' : 'shell.scopeReadOnly')
      if (!apply(open.indexed(), here.command)?.ok) throw new ShellError('shell.scopeReadOnly')
    }
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
          const step = leavingStep(assignmentList(fromArrays(scope.model)), ids, lastDay, meta)
          if (!step) continue
          ended += step.ended
          steps.set(path, [step.command])
        }
        return steps
      })
      if (ended > 0) deps.onTreeChanged?.()
    }
    if (open && here) {
      // Read again: the session may have moved while the other scopes were written.
      const now = leavingStep(assignmentList(open.indexed()), ids, lastDay, meta)
      if (now && open.dispatch({ ...now.command, barrier: LEAVE_BARRIER }) !== undefined) ended += now.ended
    }
    return ended
  }
}
