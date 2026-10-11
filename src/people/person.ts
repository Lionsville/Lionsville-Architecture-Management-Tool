// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An entry in the people register (ADR-0036): who a person is to the
 * organisation, and nothing else.
 *
 * **Outside the history.** The register is not model: no step changes it,
 * nothing undoes it, and no history keeps what it said. That is what lets a
 * name be forgotten — the history, the index and every snapshot hold an id
 * (`model/person.ts`), and the name is asked of the register when a screen
 * draws it.
 *
 * **As little as a person needs to be found again.** A name, a work address
 * where one is known, whether they are of the organisation or from outside,
 * and where they are in leaving: no notes, no photo, nothing a reader would
 * have to keep from anyone.
 *
 * **Every entry has a pseudonym from the day it is made**, drawn at random
 * (`pseudonym.ts`): what it reads as once it is forgotten, what an agent
 * reads where the organisation says agents see pseudonyms, and what a file
 * exported without names carries in place of the name.
 */
import type { PersonId } from '../model/person'

export type { PersonId } from '../model/person'

/** Of the organisation, or from outside it. */
export const PERSON_KINDS = ['internal', 'external'] as const
export type PersonKind = (typeof PERSON_KINDS)[number]

/**
 * Where a person is in leaving. `left` keeps the name for the period the
 * policy says; `forgotten` has no name and no address, and reads as its
 * pseudonym everywhere. A removed entry is not a state: it is not there.
 */
export const PERSON_STATES = ['active', 'left', 'forgotten'] as const
export type PersonState = (typeof PERSON_STATES)[number]

export type Person = {
  readonly id: PersonId
  /**
   * What they are called. Absent once forgotten, on a redirect left by a
   * merge, and on every entry of a file exported without names.
   */
  readonly name?: string
  /** A work address, where one is known; absent where the name is. */
  readonly email?: string
  /** Drawn at random when the entry is made, and never derived from the name (`pseudonym.ts`). */
  readonly pseudonym: string
  readonly kind: PersonKind
  readonly state: PersonState
  /** Their last day, once they have left. */
  readonly leftOn?: string
  /** The day the name was forgotten. */
  readonly forgottenOn?: string
  /**
   * The entry this one was merged into: a redirect, with no name, so every id
   * in the history still resolves (`shown.ts`). Final.
   */
  readonly mergedInto?: PersonId
}

/** What a new entry is told about itself. */
export type NewPerson = {
  name: string
  email?: string
  kind?: PersonKind
}

/** A correction to an entry: a name, an address, a kind. `null` takes the address out. */
export type PersonPatch = {
  name?: string
  email?: string | null
  kind?: PersonKind
}

/**
 * What the register says no with: a key, never a sentence, the way every
 * refusal in the domain is said (`people/strings`).
 */
export const PEOPLE_REFUSALS = [
  /** No entry has that id. */
  'people.unknown',
  /** The entry is a redirect: a merge made it, and it is changed no more. */
  'people.merged',
  /** A name is required, and there was none. */
  'people.nameRequired',
  /** The address is not one: one `@`, something either side of it. */
  'people.badEmail',
  /** The day is not a `yyyy-mm-dd` day. */
  'people.badDay',
  /** Only someone active can leave. */
  'people.notActive',
  /** A forgotten entry has nothing left to correct. */
  'people.forgotten',
  /** Only a forgotten entry is removed: forgetting comes first. */
  'people.notForgotten',
  /** An entry is not merged into itself, and not into one that is a redirect or forgotten. */
  'people.badMerge',
  /** An active entry merged into one that has left: the merge is told which is true, still here or left. */
  'people.mergeAsks',
  /** An entry is not answered as somebody other than itself. */
  'people.badDistinct',
] as const

export type PeopleRefusal = (typeof PEOPLE_REFUSALS)[number]

/**
 * What is true of a person whose active entry is merged into one that has
 * left (ADR-0036 §9), which the merge is told rather than guesses:
 *
 * - `stillHere`: they are here; the leaving is cleared, the entry kept is
 *   active again and the policy's clock stops;
 * - `left`: they left on the leaving day; the roles of the entry absorbed end
 *   on it, as leaving ends them (`leave.ts`).
 */
export const MERGE_LEAVINGS = ['stillHere', 'left'] as const
export type MergeLeaving = (typeof MERGE_LEAVINGS)[number]

/** Whether a merge must be told which is true: an active entry going into one that has left. */
export function mergeAsks(absorbed: Pick<Person, 'state' | 'mergedInto'>, kept: Pick<Person, 'state' | 'mergedInto'>): boolean {
  return absorbed.state === 'active' && absorbed.mergedInto === undefined && kept.state === 'left' && kept.mergedInto === undefined
}

/**
 * The changes a person makes to the register, one kind at a time: what a
 * source that knows who may do which answers for (`SourcePeople.may`), so the
 * People page offers only what this person may do.
 */
export const PEOPLE_ACTIONS = ['add', 'change', 'leave', 'merge', 'forget', 'remove', 'policy'] as const
export type PeopleAction = (typeof PEOPLE_ACTIONS)[number]

/**
 * Why a source that applies the policy on its own schedule did not forget an
 * entry that was due (`SourcePeople.held`): their account signed in after
 * their last day, and somebody who may forget them decides.
 */
export type PolicyHold = 'signedInSinceLeaving'

export function isPeopleRefusal(value: unknown): value is PeopleRefusal {
  return (PEOPLE_REFUSALS as readonly unknown[]).includes(value)
}

/** Whether an entry is a redirect a merge left behind. */
export function isRedirect(person: Person): boolean {
  return person.mergedInto !== undefined
}

/** Where a redirect ends: the first id along it that is no redirect, or that the register does not hold. */
export function redirectEnd(byId: ReadonlyMap<PersonId, Person>, id: PersonId): PersonId {
  const seen = new Set<PersonId>()
  let at = id
  for (let held = byId.get(at); held?.mergedInto !== undefined && !seen.has(at); held = byId.get(at)) {
    seen.add(at)
    at = held.mergedInto
  }
  return at
}

/** The entries a person picks from and a list shows: everyone but the redirects. */
export function entriesOf(people: readonly Person[]): Person[] {
  return people.filter((person) => !isRedirect(person))
}

/** An address as it is kept: trimmed, lower case. */
export function normalEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Whether text is an address worth keeping: one `@`, something either side, no space. */
export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test(email.trim())
}

/** A name as it is kept: trimmed, its spaces single. */
export function normalName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** A new entry's id: `pe-` and 64 random bits, nothing taken from the name, and none an entry here holds. */
export function mintPersonId(taken: ReadonlySet<PersonId>, random: () => Uint8Array = randomBytes): PersonId {
  for (;;) {
    const id = `pe-${Array.from(random(), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
    if (!taken.has(id)) return id
  }
}

function randomBytes(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(8))
}

/**
 * An entry as a file or a store held it, where it reads as one; `undefined`
 * for anything else. Tolerant the way every reader of a saved file is: a key
 * it does not know is dropped, and an entry missing what an entry must have
 * is no entry.
 */
export function personFrom(value: unknown): Person | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const held = value as Record<string, unknown>
  const text = (key: string): string | undefined => (typeof held[key] === 'string' && held[key] !== '' ? held[key] as string : undefined)
  const id = text('id')
  const pseudonym = text('pseudonym')
  if (!id || !pseudonym) return undefined
  const kind = (PERSON_KINDS as readonly unknown[]).includes(held.kind) ? held.kind as PersonKind : 'internal'
  const state = (PERSON_STATES as readonly unknown[]).includes(held.state) ? held.state as PersonState : 'active'
  const mergedInto = text('mergedInto')
  const forgotten = state === 'forgotten' || mergedInto !== undefined
  const name = forgotten ? undefined : text('name')
  const email = forgotten ? undefined : text('email')
  const leftOn = text('leftOn')
  const forgottenOn = text('forgottenOn')
  return {
    id, pseudonym, kind, state,
    ...(name !== undefined ? { name } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(leftOn !== undefined ? { leftOn } : {}),
    ...(forgottenOn !== undefined ? { forgottenOn } : {}),
    ...(mergedInto !== undefined ? { mergedInto } : {}),
  }
}
