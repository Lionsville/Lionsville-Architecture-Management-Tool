// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How long the register keeps what it holds, and what an agent may read of it
 * (ADR-0036): the organisation's policy, kept in the organisation's settings
 * (`SettingsRepository`, `of: 'organisation'`) under `people` — a setting,
 * not a step, and set by whoever may change the organisation's settings: in
 * Team its root administrators, on the desktop whoever keeps the file.
 *
 * - A leaver's **name is kept for 90 days** after their last day, and then
 *   forgotten: replaced by the pseudonym, everywhere at once.
 * - The **entry is removed 730 days** after it was forgotten, after which a
 *   reference to it reads *a former colleague*.
 * - **Agents see names**, unless the organisation says they see pseudonyms.
 *
 * Two things are not settings: a signed decision keeps the names it was
 * signed with, and no agent forgets, removes or merges anyone.
 */
import { addDays } from '../model/transition'
import type { Person, PersonId } from './person'
import { isRedirect } from './person'

/** What agents read where a person is named. */
export const AGENT_SEES = ['names', 'pseudonyms'] as const
export type AgentSees = (typeof AGENT_SEES)[number]

export type PeoplePolicy = {
  /** Days a leaver's name is kept after their last day. */
  keepNameDays: number
  /** Days a forgotten entry is kept before it is removed. */
  removeAfterDays: number
  agentsSee: AgentSees
}

/** The owner's numbers, 11 October 2026. */
export const DEFAULT_POLICY: PeoplePolicy = { keepNameDays: 90, removeAfterDays: 730, agentsSee: 'names' }

/** The key the policy is kept under in the organisation's settings. */
export const POLICY_KEY = 'people'

/** The longest a period may be set to: a century, which is no period at all. */
const MOST_DAYS = 36_500

function days(value: unknown, otherwise: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MOST_DAYS ? value : otherwise
}

/** The policy, read from the organisation's settings; the default for anything unset or not a value it could be. */
export function policyOf(settings: { readonly [key: string]: unknown }): PeoplePolicy {
  const held = settings[POLICY_KEY]
  const set = typeof held === 'object' && held !== null && !Array.isArray(held) ? held as Record<string, unknown> : {}
  return {
    keepNameDays: days(set.keepNameDays, DEFAULT_POLICY.keepNameDays),
    removeAfterDays: days(set.removeAfterDays, DEFAULT_POLICY.removeAfterDays),
    agentsSee: (AGENT_SEES as readonly unknown[]).includes(set.agentsSee) ? set.agentsSee as AgentSees : DEFAULT_POLICY.agentsSee,
  }
}

/** A change to the policy, as the organisation's settings take one: a patch under its key. */
export function policyPatch(change: Partial<PeoplePolicy>): { [POLICY_KEY]: Partial<PeoplePolicy> } {
  const patch: Partial<PeoplePolicy> = {}
  if (change.keepNameDays !== undefined) patch.keepNameDays = days(change.keepNameDays, DEFAULT_POLICY.keepNameDays)
  if (change.removeAfterDays !== undefined) patch.removeAfterDays = days(change.removeAfterDays, DEFAULT_POLICY.removeAfterDays)
  if (change.agentsSee !== undefined && (AGENT_SEES as readonly string[]).includes(change.agentsSee)) patch.agentsSee = change.agentsSee
  return { [POLICY_KEY]: patch }
}

/** The day a leaver's name is forgotten under the policy; `undefined` for anyone who has not left. */
export function forgetDay(person: Person, policy: PeoplePolicy): string | undefined {
  return person.state === 'left' && person.leftOn ? addDays(person.leftOn, policy.keepNameDays) : undefined
}

/** The day a forgotten entry is removed under the policy; `undefined` for anyone not forgotten. */
export function removeDay(person: Person, policy: PeoplePolicy): string | undefined {
  return person.state === 'forgotten' && person.forgottenOn ? addDays(person.forgottenOn, policy.removeAfterDays) : undefined
}

/** What the policy says is due on a day: names to forget, and entries to remove. */
export type Due = { forget: PersonId[]; remove: PersonId[] }

/**
 * Who is due on `today`: every leaver whose name has been kept for the
 * period, and every forgotten entry kept for the next. A build that runs
 * things on a schedule applies it each night; where nothing does, the app
 * applies it when the organisation is opened and once a day while it stays
 * open (ADR-0036 §10).
 */
export function dueOn(people: readonly Person[], policy: PeoplePolicy, today: string): Due {
  const due: Due = { forget: [], remove: [] }
  for (const person of people) {
    if (isRedirect(person)) continue
    const forget = forgetDay(person, policy)
    if (forget !== undefined && forget <= today) due.forget.push(person.id)
    const remove = removeDay(person, policy)
    if (remove !== undefined && remove <= today) due.remove.push(person.id)
  }
  return due
}
