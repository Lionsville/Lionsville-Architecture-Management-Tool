// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The people register, as an agent may use it (ADR-0036 §13): `people.list`,
 * with the possible duplicates; `person.add`, which checks for them first;
 * and `person.leave`. Nothing more.
 *
 * **No tool forgets, removes or merges anyone**, and none changes the policy:
 * each is final, or decides what every screen shows, and is a person's to do
 * on the People page (ADR-0011, as ADR-0036 supersedes it in part).
 *
 * **An agent sees names, or pseudonyms** where the organisation's policy
 * says so, and is told whether an entry has an address — never the address.
 *
 * **Not a step.** The register is outside the history, so these answer with
 * no project revision and take no `ifRevision`; they work with nothing open,
 * because the register is the organisation's and not a scope's.
 */
import { isDay } from '../model/lifecycle'
import { addDays } from '../model/transition'
import type { PersonId } from '../model/person'
import { possibleDuplicates, duplicatePairs } from '../people/duplicates'
import type { Left } from '../people/leave'
import type { NewPerson, PeopleRefusal, Person, PersonKind, PersonState } from '../people/person'
import { entriesOf, isRedirect } from '../people/person'
import type { PeoplePolicy } from '../people/policy'
import { shownEnglish, shownEntry } from '../people/shown'
import { matchesQuery } from '../model/textSearch'
import type { AgentAnswer } from './tools'
import { json, refused } from './tools'

/** The register, as the shell lends it to the agent: read fresh on every call. */
export type PeopleView = {
  read(): Promise<{ people: readonly Person[]; policy: PeoplePolicy }>
  add(person: NewPerson): Promise<{ person: Person } | { refused: PeopleRefusal }>
  /** Marks them as left, and does everything leaving does beyond the register (`people/leave.ts`). */
  leave(id: PersonId, on: string): Promise<Left | { refused: PeopleRefusal }>
  today(): string
  readOnly(): boolean
}

/** The three tools, said once. */
export const PEOPLE_TOOLS = ['people.list', 'person.add', 'person.leave'] as const
export type PeopleTool = (typeof PEOPLE_TOOLS)[number]

export function isPeopleTool(tool: string): tool is PeopleTool {
  return (PEOPLE_TOOLS as readonly string[]).includes(tool)
}

/** One entry, as an agent is told it: its name or its pseudonym, and never an address. */
function told(person: Person, policy: PeoplePolicy) {
  return {
    id: person.id,
    name: shownEnglish(shownEntry(person, { withhold: policy.agentsSee === 'pseudonyms' })),
    kind: person.kind,
    state: person.state,
    ...(person.leftOn ? { leftOn: person.leftOn } : {}),
    ...(person.forgottenOn ? { forgottenOn: person.forgottenOn } : {}),
    hasAddress: person.email !== undefined,
  }
}

function listPeople(view: PeopleView, args: Record<string, unknown>): Promise<AgentAnswer> {
  return view.read().then(({ people, policy }) => {
    const state = args.state as PersonState | undefined
    const query = typeof args.query === 'string' ? args.query : ''
    const limit = typeof args.limit === 'number' ? args.limit : 200
    const shown = entriesOf(people).filter((person) => !state || person.state === state).map((person) => told(person, policy))
    const matching = query.trim() ? shown.filter((person) => matchesQuery(query, [person.name, person.id])) : shown
    return json({
      total: matching.length,
      shows: policy.agentsSee,
      people: matching.slice(0, limit),
      redirects: people.filter(isRedirect).map((person) => ({ id: person.id, mergedInto: person.mergedInto })),
      possibleDuplicates: duplicatePairs(people).map((pair) => ({
        keep: told(pair.keep, policy).name, keepId: pair.keep.id, drop: told(pair.drop, policy).name, dropId: pair.drop.id, sign: pair.sign,
      })),
    })
  })
}

async function addPerson(view: PeopleView, args: Record<string, unknown>): Promise<AgentAnswer> {
  if (view.readOnly()) return refused('agent.readOnly')
  const candidate: NewPerson = {
    name: String(args.name ?? ''),
    ...(typeof args.email === 'string' && args.email.trim() ? { email: args.email } : {}),
    ...(typeof args.kind === 'string' ? { kind: args.kind as PersonKind } : {}),
  }
  const { people, policy } = await view.read()
  const similar = possibleDuplicates(candidate, people)
  if (similar.length > 0 && args.addAnyway !== true) {
    return refused('agent.possibleDuplicate', JSON.stringify(similar.map((one) => ({ ...told(one.person, policy), sign: one.sign }))))
  }
  const answer = await view.add(candidate)
  if ('refused' in answer) return refused(answer.refused)
  return json({ added: told(answer.person, policy) })
}

async function leave(view: PeopleView, args: Record<string, unknown>): Promise<AgentAnswer> {
  if (view.readOnly()) return refused('agent.readOnly')
  const on = typeof args.on === 'string' ? args.on : view.today()
  if (!isDay(on)) return refused('people.badDay', on)
  const { policy } = await view.read()
  // A last day so far back that the policy's period is already over would have the name forgotten
  // at the next turn of the day, and agents do not forget people (ADR-0036 §13): that is a person's to say.
  if (addDays(on, policy.keepNameDays) <= view.today()) {
    return refused('agent.badArguments', `a last day of ${on} is longer ago than the ${policy.keepNameDays} days the organisation keeps a leaver's name; mark it on the People page`)
  }
  const answer = await view.leave(String(args.id), on)
  if ('refused' in answer) return refused(answer.refused)
  return json({ left: told(answer.person, policy), endedAssignments: answer.ended })
}

/** One of the three, answered over the register the shell lends; refused where it lends none. */
export function answerPeople(tool: PeopleTool, args: unknown, view: PeopleView | undefined): Promise<AgentAnswer> | AgentAnswer {
  if (!view) return refused('agent.noRegister')
  const given = (args ?? {}) as Record<string, unknown>
  switch (tool) {
    case 'people.list': return listPeople(view, given)
    case 'person.add': return addPerson(view, given)
    case 'person.leave': return leave(view, given)
    default: {
      const unexpected: never = tool
      return unexpected
    }
  }
}
