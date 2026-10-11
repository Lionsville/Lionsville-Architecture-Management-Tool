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

/**
 * What leaving does beyond the register, once the register has said *left*:
 * the person as they now stand, and their last day. Answers how many things
 * it ended, for a person to be told.
 */
export type LeaveConsequence = (person: Person, lastDay: string) => Promise<number>

type PeopleRefused = { refused: PeopleRefusal }

/** As much of a register as leaving needs. */
export type LeavingRegister = {
  read(id: PersonId): Promise<Person | undefined>
  leave(id: PersonId, on: string): Promise<{ person: Person } | PeopleRefused>
  forget(id: PersonId, on: string): Promise<{ person: Person } | PeopleRefused>
}

/** A leave or a forget made: the entry as it now stands, and how many things its consequences ended. */
export type Left = { person: Person; ended: number }

async function consequencesOf(consequences: readonly LeaveConsequence[], person: Person, lastDay: string): Promise<number> {
  let ended = 0
  for (const consequence of consequences) ended += await consequence(person, lastDay)
  return ended
}

/** Mark someone as left on `on`, then everything leaving does beyond the register. */
export async function leavePerson(
  register: LeavingRegister, consequences: readonly LeaveConsequence[], id: PersonId, on: string,
): Promise<Left | PeopleRefused> {
  const answer = await register.leave(id, on)
  if ('refused' in answer) return answer
  return { person: answer.person, ended: await consequencesOf(consequences, answer.person, on) }
}

/**
 * Forget someone on `on`. One still active has left that day as well, and
 * what leaving does is done first: an erasure asked for is the same action.
 */
export async function forgetPerson(
  register: LeavingRegister, consequences: readonly LeaveConsequence[], id: PersonId, on: string,
): Promise<Left | PeopleRefused> {
  const before = await register.read(id)
  const answer = await register.forget(id, on)
  if ('refused' in answer) return answer
  const ended = before?.state === 'active' ? await consequencesOf(consequences, answer.person, on) : 0
  return { person: answer.person, ended }
}
