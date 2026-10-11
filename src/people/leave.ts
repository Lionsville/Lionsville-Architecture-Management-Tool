// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Leaving, and what it does beyond the register (ADR-0036).
 *
 * The register marks a person as left on their last day, and that is all it
 * does: it is outside the history and knows nothing of the scopes. What else
 * leaving means is the model's — above all, that the person's assignments end
 * that day — and the model changes only by steps. So a leave is the register's
 * change first and then, for each **consequence**, whatever steps it takes;
 * forgetting someone who is still active is a leave on that day too, so an
 * erasure ends what a leave would.
 *
 * The consequences are handed in by whoever composes the app, the same list
 * to the People page and to the agent, so a leave means one thing whoever
 * asks. Until assignments exist the list is empty; the step that brings them
 * adds the one that ends them.
 */
import type { PeopleRefusal, Person, PersonId } from './person'
import { changePeople } from './register'

/**
 * What leaving does beyond the register, once the register has said *left*:
 * the person as they now stand, and their last day. Answers how many things
 * it ended, for a person to be told.
 */
export type LeaveConsequence = (person: Person, lastDay: string) => Promise<number>

type PeopleRefused = { refused: PeopleRefusal }

/**
 * As much of a register as leaving needs. One that says `endsAssignments`
 * does what leaving does beyond it itself — a server ending a leaver's
 * assignments as it marks them, with its own authority, in one go — and
 * answers how many with `ended`: no consequence is run here, before or after.
 */
export type LeavingRegister = {
  readonly endsAssignments?: boolean
  read(id: PersonId): Promise<Person | undefined>
  leave(id: PersonId, on: string): Promise<{ person: Person; ended?: number } | PeopleRefused>
  forget(id: PersonId, on: string): Promise<{ person: Person; ended?: number } | PeopleRefused>
}

/** A leave or a forget made: the entry as it now stands, and how many things its consequences ended. */
export type Left = { person: Person; ended: number }

async function consequencesOf(consequences: readonly LeaveConsequence[], person: Person, lastDay: string): Promise<number> {
  let ended = 0
  for (const consequence of consequences) ended += await consequence(person, lastDay)
  return ended
}

/**
 * The entry as leaving would leave it, or why the register would refuse:
 * asked of the rules before anything is written, so a refusal is said first.
 */
function asLeft(before: Person | undefined, id: PersonId, on: string): Person | PeopleRefused {
  if (!before) return { refused: 'people.unknown' }
  const asked = changePeople([before], { kind: 'leave', id, on })
  return 'refused' in asked ? asked : asked.people[0]
}

/**
 * Mark someone as left on `on`, with everything leaving does beyond the
 * register. **What it does beyond the register is done first**: where a scope
 * will not take its part — one the person may not change, one that moved
 * meanwhile — the consequence fails, nothing is marked, and the leave can be
 * asked again. The other way round, someone would be left with every
 * assignment still running and no way to end them by leaving again.
 */
export async function leavePerson(
  register: LeavingRegister, consequences: readonly LeaveConsequence[], id: PersonId, on: string,
): Promise<Left | PeopleRefused> {
  if (register.endsAssignments) return wholly(await register.leave(id, on))
  const left = asLeft(await register.read(id), id, on)
  if ('refused' in left) return left
  const ended = await consequencesOf(consequences, left, on)
  const answer = await register.leave(id, on)
  if ('refused' in answer) return answer
  return { person: answer.person, ended: answer.ended ?? ended }
}

/** A register's own answer, where it did what leaving does itself. */
function wholly(answer: { person: Person; ended?: number } | PeopleRefused): Left | PeopleRefused {
  return 'refused' in answer ? answer : { person: answer.person, ended: answer.ended ?? 0 }
}

/**
 * Forget someone on `on`. One still active has left that day as well, and
 * what leaving does is done first — before the register, as a leave's is: an
 * erasure asked for is the same action.
 */
export async function forgetPerson(
  register: LeavingRegister, consequences: readonly LeaveConsequence[], id: PersonId, on: string,
): Promise<Left | PeopleRefused> {
  if (register.endsAssignments) return wholly(await register.forget(id, on))
  const before = await register.read(id)
  let ended = 0
  if (before?.state === 'active' && before.mergedInto === undefined) {
    const left = asLeft(before, id, on)
    if ('refused' in left) return left
    ended = await consequencesOf(consequences, left, on)
  }
  const answer = await register.forget(id, on)
  if ('refused' in answer) return answer
  return { person: answer.person, ended: answer.ended ?? ended }
}
