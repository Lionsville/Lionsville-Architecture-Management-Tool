// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The people register of one source (ADR-0036; ADR-0031 §1, the sixth
 * repository): who the organisation's people are, kept outside the history.
 *
 * **Not a scope's, and not a step.** The register belongs to the organisation,
 * and every change to it is made in place: no step, no undo, no entry in any
 * history. The history, the index and every snapshot hold a person's id
 * (`model/person.ts`) and never a name, so forgetting someone is one change
 * here, and every screen that asks the register for the name reads the
 * pseudonym from then on.
 *
 * **The rules are written once** (`people/register.ts`): what each change
 * does, what it refuses, and how entries carried in from a working file are
 * taken. An implementation keeps the entries and their revision, and hands
 * each change to those rules.
 *
 * **A refusal is an answer, never a failure**, as it is for scopes: a key
 * (`people/person.ts`, `PEOPLE_REFUSALS`), and nothing written. A promise
 * rejects only where the implementation itself could not answer.
 *
 * **It has a revision, and says what changed since one**, as the index does:
 * a reader that holds the register asks for what changed rather than for all
 * of it again.
 *
 * `PeopleRepository.contract.ts`, beside this seam, is the behaviour every
 * implementation must show.
 */
import type { NewPerson, PeopleRefusal, Person, PersonId, PersonPatch } from '../people/person'
import type { Revision } from '../projects/scopeState'

/** The whole register, at a revision: every entry, the redirects a merge left included. */
export type PeopleRead = {
  revision: Revision
  people: readonly Person[]
}

/**
 * What changed since a revision: every entry added or changed since then, as
 * it is now, and every id removed — and no entry nothing happened to.
 */
export type PeopleChanges = {
  revision: Revision
  changed: readonly Person[]
  removed: readonly PersonId[]
}

/**
 * A change made: the register's revision after it, and the entry as it now
 * is. A leave or a forget of somebody still active may say `ended`: how many
 * things leaving ended, where the repository does what leaving does beyond the
 * register itself — a server that ends a leaver's assignments as it marks them
 * — and the caller then ends nothing more (`people/leave.ts`).
 */
export type PersonWritten = { revision: Revision; person: Person; ended?: number }

/** An entry removed: the register's revision after it, and every id that went (its redirects too). */
export type PersonRemoved = { revision: Revision; removed: readonly PersonId[] }

/** Entries carried in: the register's revision after them, and the ids that changed. */
export type PeopleBrought = { revision: Revision; changed: readonly PersonId[] }

/** What a refusal says. */
export type PeopleRefused = { refused: PeopleRefusal }

export interface PeopleRepository {
  /** Which repository this is, in plain words, for a message and the trail to name. */
  readonly id: string

  /** Every entry, and the revision. Equal revisions are the same register. */
  list(): Promise<PeopleRead>

  /** One entry as it is kept — a redirect as a redirect — or `undefined` where none has that id. */
  read(id: PersonId): Promise<Person | undefined>

  /** A new entry, active, with an id and a pseudonym drawn at random. */
  add(person: NewPerson): Promise<PersonWritten | PeopleRefused>

  /** A correction: a name, an address, a kind. Refused on a forgotten entry and on a redirect. */
  change(id: PersonId, patch: PersonPatch): Promise<PersonWritten | PeopleRefused>

  /**
   * Marked as left, with their last day. Only someone active leaves. What
   * leaving does beyond the register is the caller's (`people/leave.ts`) —
   * unless the answer says `ended`, which is the repository having done it.
   */
  leave(id: PersonId, on: string): Promise<PersonWritten | PeopleRefused>

  /**
   * One entry kept and the other made a redirect into it, with no name and no
   * address. Final. The answer is the entry kept.
   */
  merge(from: PersonId, into: PersonId): Promise<PersonWritten | PeopleRefused>

  /** The name and the address taken away, on a day. Final. */
  forget(id: PersonId, on: string): Promise<PersonWritten | PeopleRefused>

  /** A forgotten entry taken away, with every redirect into it. */
  remove(id: PersonId): Promise<PersonRemoved | PeopleRefused>

  /**
   * Entries carried in from elsewhere — a working file — each under its own
   * id. Never gives a name back to an entry forgotten here, never undoes a
   * merge, and never takes an entry away (`people/register.ts`).
   */
  bringIn(people: readonly Person[]): Promise<PeopleBrought>

  /**
   * What changed since `revision`, which this register answered with before.
   * A revision it cannot answer from — one it never gave, or one further back
   * than it keeps — is answered `undefined`, and the reader reads the whole
   * register again rather than holding one that is quietly incomplete.
   */
  since(revision: Revision): Promise<PeopleChanges | undefined>
}
