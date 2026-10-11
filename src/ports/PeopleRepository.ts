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
 * **Beside the entries, the answers *not the same person*** (3.6.1): two
 * entries a person said are two people, kept as a list of pairs — not a field
 * on either — and carried through every change to the entries by the same
 * rules (`people/distinct.ts`).
 *
 * `PeopleRepository.contract.ts`, beside this seam, is the behaviour every
 * implementation must show.
 */
import type { DistinctPair } from '../people/distinct'
import type { MergeLeaving, NewPerson, PeopleRefusal, Person, PersonId, PersonPatch } from '../people/person'
import type { Revision } from '../projects/scopeState'

/**
 * The whole register, at a revision: every entry, the redirects a merge left
 * included — and every id it has removed. A removed id is kept, the id alone
 * (random, naming nobody), so that nothing carried in later brings the entry
 * back; a working file carries them, so a removal travels as a forgetting does.
 */
export type PeopleRead = {
  revision: Revision
  people: readonly Person[]
  removed: readonly PersonId[]
  /**
   * Every pair answered as not the same person, `a < b`, in id order. Absent
   * is none — what a register from before there were any answers says.
   */
  distinct?: readonly DistinctPair[]
}

/**
 * What changed since a revision: every entry added or changed since then, as
 * it is now, and every id removed — and no entry nothing happened to.
 */
export type PeopleChanges = {
  revision: Revision
  changed: readonly Person[]
  removed: readonly PersonId[]
  /** Every answer *not the same person* as it now is, where any was given, taken back or carried since; absent where none moved. */
  distinct?: readonly DistinctPair[]
}

/**
 * A change made: the register's revision after it, and the entry as it now
 * is. A leave or a forget of somebody still active, and a merge told *left*,
 * may say `ended`: how many things leaving ended, where the repository does
 * what leaving does beyond the register itself — a server that ends a
 * leaver's assignments as it marks them — and the caller then ends nothing
 * more (`people/leave.ts`).
 */
export type PersonWritten = { revision: Revision; person: Person; ended?: number }

/** An entry removed: the register's revision after it, and every id that went (its redirects too). */
export type PersonRemoved = { revision: Revision; removed: readonly PersonId[] }

/** Entries carried in: the register's revision after them, and the ids that changed. */
export type PeopleBrought = { revision: Revision; changed: readonly PersonId[] }

/** An answer given: the register's revision after it, and the pair as kept — `a < b`, on the day it was first given. */
export type DistinctAnswered = { revision: Revision; pair: DistinctPair }

/** An answer taken back: the register's revision after it, and whether there was one to take. */
export type DistinctTakenBack = { revision: Revision; taken: boolean }

/** What a refusal says. */
export type PeopleRefused = { refused: PeopleRefusal }

export interface PeopleRepository {
  /** Which repository this is, in plain words, for a message and the trail to name. */
  readonly id: string

  /**
   * This repository does what leaving does beyond the register itself — a
   * server that ends a leaver's assignments as it marks them, with its own
   * authority and in one go — and its `leave`, `forget` and a `merge` told
   * *left* answer `ended`.
   * The app then ends nothing itself. Absent, the app ends them first and
   * marks the leave after (`people/leave.ts`).
   */
  readonly endsAssignments?: boolean

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
   * unless the repository says {@link endsAssignments}, and then its answer's
   * `ended` is the repository having done it.
   */
  leave(id: PersonId, on: string): Promise<PersonWritten | PeopleRefused>

  /**
   * One entry kept and the other made a redirect into it, with no name and no
   * address. Final. The answer is the entry kept.
   *
   * An active entry merged into one that has left is told which is true
   * (`MergeLeaving`), and refused `people.mergeAsks` without: *still here*
   * makes the entry kept active again, with no `leftOn`; *left* keeps the
   * leaving, and what leaving does to the roles of the entry absorbed — ended
   * on the leaving day — is the caller's (`people/leave.ts`), unless the
   * repository says {@link endsAssignments}: then it ends them itself, before
   * the merge, and answers how many in `ended`.
   */
  merge(from: PersonId, into: PersonId, leaving?: MergeLeaving): Promise<PersonWritten | PeopleRefused>

  /** The name and the address taken away, on a day. Final. */
  forget(id: PersonId, on: string): Promise<PersonWritten | PeopleRefused>

  /**
   * A forgotten entry taken away, with every redirect into it, and each id
   * remembered as removed ({@link PeopleRead.removed}).
   */
  remove(id: PersonId): Promise<PersonRemoved | PeopleRefused>

  /**
   * Entries carried in from elsewhere — a working file — each under its own
   * id, and the ids removed there. Whichever is further gone wins: removed,
   * forgotten, merged, left, active (`people/register.ts`). So it never gives
   * a name, an address or an active state back, never undoes a merge, and
   * never brings back an id it removed; a forgetting or a removal carried in
   * is made here too, and the ids removed are remembered.
   *
   * The answers *not the same person* carried in join those held, each over
   * the entries as they stand after: one naming an id removed, here or there,
   * or forgotten, is dropped, and one naming a redirect is carried to the
   * entry it leads to. `changed` names entries only.
   */
  bringIn(people: readonly Person[], removed?: readonly PersonId[], distinct?: readonly DistinctPair[]): Promise<PeopleBrought>

  /**
   * Two entries answered as not the same person, on a day, in either order:
   * the four signs no longer pair them (`people/duplicates.ts`). Refused
   * `people.badDistinct` for one entry twice, and as a change to either
   * entry would be — unknown, a redirect, forgotten — or `people.badDay`.
   * Answered again, the pair keeps the day it was first answered. Changes no
   * entry, and no scope.
   */
  answerDistinct(a: PersonId, b: PersonId, on: string): Promise<DistinctAnswered | PeopleRefused>

  /**
   * The answer about two entries taken back, in either order: they are a
   * possible duplicate again. One never given, or already gone with its
   * entries, is nothing to take, and nothing is refused.
   */
  takeBackDistinct(a: PersonId, b: PersonId): Promise<DistinctTakenBack>

  /**
   * What changed since `revision`, which this register answered with before.
   * A revision it cannot answer from — one it never gave, or one further back
   * than it keeps — is answered `undefined`, and the reader reads the whole
   * register again rather than holding one that is quietly incomplete.
   */
  since(revision: Revision): Promise<PeopleChanges | undefined>
}
