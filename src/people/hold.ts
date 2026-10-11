// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *What we hold* about a person (ADR-0036): the answer to a request for
 * access, as one document a person can read and hand over. An erasure asked
 * for is answered by the same page's *Forget*.
 *
 * What the register holds is said whole: the entry, and every entry merged
 * into it. What the model holds is said by what points at the person — the
 * assignments they hold, the records that name them by id, the signatures
 * that kept their name, and what the operating model's rules work out they
 * own today. What nothing can reach is said honestly: names typed as text,
 * which a search across the tree finds and a forget does not touch.
 */
import type { Pointer, PointerField } from '../model/pointers'
import type { Person, PersonId } from './person'

/**
 * One assignment a person holds, as the People page shows it (ADR-0036 §4):
 * the role and the unit by the names the organisation gives them, the scope
 * that keeps it, and its days. Gathered by whoever can read the tree.
 */
export type HeldAssignment = {
  id: string
  scope: string
  unit: string
  role: string
  share?: number
  from?: string
  until?: string
  acting?: true
}

/** A person's assignments on a day: those that run on it, those still to begin, and those over. */
export function heldOn(held: readonly HeldAssignment[], day: string): {
  now: HeldAssignment[]; later: HeldAssignment[]; before: HeldAssignment[]
} {
  const later = held.filter((one) => one.from !== undefined && one.from > day)
  const before = held.filter((one) => one.until !== undefined && one.until < day)
  const now = held.filter((one) => !later.includes(one) && !before.includes(one))
  return { now, later, before }
}

/**
 * What leaving on `lastDay` would do to these assignments, as leaving does it
 * (`model/units.endingFor`): how many run past the day and would end on it,
 * and how many only began after it and would be taken away — a role is never
 * ended on a day before it began. What a merge into an entry that has left
 * says before it asks *still here* or *left* (ADR-0036 §9).
 */
export function leavingOn(held: readonly HeldAssignment[], lastDay: string): { ends: number; later: number } {
  const later = held.filter((one) => one.from !== undefined && one.from > lastDay).length
  const ends = held.filter((one) => !(one.from !== undefined && one.from > lastDay) && (one.until === undefined || one.until > lastDay)).length
  return { ends, later }
}

/** One assignment as a line of *What we hold*: role, unit, where, and when. English, as a protocol answer is. */
export function heldLine(one: HeldAssignment): string {
  const share = one.share !== undefined && one.share < 1 ? `, ${Math.round(one.share * 100)}%` : ''
  const days = `${one.from ?? '…'} – ${one.until ?? '…'}`
  return `${one.role} in ${one.unit} (${one.scope || 'the organisation'})${share}${one.acting ? ', acting' : ''}, ${days}`
}

/** A record that names a person in its text, as a search across the tree finds it. */
export type Mention = { scope: string; kind: string; id: string; title: string }

/** A record whose field points at a person by id (ADR-0036 §8), and the scope that keeps it. */
export type PointedAt = Pointer & { scope: string }

/**
 * What a rule of the operating model makes a person own on a day (ADR-0036
 * §2): an application whose unit they hold the rule's role in, or a domain
 * whose serving unit they do. Worked out, never stored.
 */
export type OwnedByRule = { kind: 'application' | 'domain'; scope: string; id: string; name: string; day: string }

/** What everything that points at a person comes to: the records, the signatures and what is worked out. */
export type PointsAt = { pointers: readonly PointedAt[]; byRule: readonly OwnedByRule[] }

const FIELD_WORDS: Record<PointerField, string> = {
  owner: 'owner', seenBy: 'seen by', runBy: 'run by', proposed: 'proposed', signer: 'signer',
}

/** Whether a pointer is a signature that kept its name: the one place a name stays (ADR-0036 §8). */
export function keptName(pointer: Pick<Pointer, 'signedAs'>): boolean {
  return pointer.signedAs !== undefined
}

const where = (scope: string) => scope || 'the organisation'

/**
 * A record that points at a person, as a line of *What we hold*. English, as
 * a protocol answer is. `apart` is an entry that is forgotten: a signature
 * that kept a name is then said to exist and no more — the name as signed is
 * the decision's, and said beside the pseudonym it would undo the forgetting
 * (ADR-0036 §8).
 */
export function pointerLine(one: PointedAt, apart = false): string {
  const named = `${one.label ? `${one.label} ` : ''}${one.title}`
  if (one.signedAs !== undefined) {
    const how = one.field === 'proposed' ? 'proposed' : 'signed'
    return apart ? `${named} (${where(one.scope)}), ${how}` : `${named} (${where(one.scope)}), ${how} as ${one.signedAs}`
  }
  return `${named} (${where(one.scope)}): ${FIELD_WORDS[one.field]}`
}

/** What a rule makes a person own, as a line of *What we hold*. */
export function ruleLine(one: OwnedByRule): string {
  const what = one.kind === 'domain' ? `the domain ${one.name || where(one.scope)}` : `${one.name} (${where(one.scope)})`
  return `Owner of ${what} on ${one.day}, worked out from the role`
}

/** What else the organisation holds that points at a person, gathered by whoever can read the tree. */
export type HeldElsewhere = {
  /** The records that name the person by id, each as a line: their fields, not a name. */
  namedIn?: readonly string[]
  /** The signatures that kept the person's name, each as a line with the name as signed. */
  signed?: readonly string[]
  /** What a rule of the operating model makes them own today, each as a line. */
  derived?: readonly string[]
  /** The assignments they hold, past, present and to come, each as a line. */
  assignments?: readonly string[]
  /** Records whose text holds the name: what a forget cannot reach. */
  mentions?: readonly Mention[]
  /** Whether this install takes this entry to be the person using it (*This is me*). */
  thisIsMe?: boolean
}

export type WhatWeHold = {
  register: {
    id: PersonId
    name: string | null
    email: string | null
    pseudonym: string
    kind: Person['kind']
    state: Person['state']
    leftOn: string | null
    forgottenOn: string | null
  }
  mergedFrom: PersonId[]
  thisIsMe: boolean
  assignments: string[]
  namedIn: string[]
  signed: string[]
  derived: string[]
  mentions: Mention[]
}

/** The account of one entry: what the register holds, and what points at it. */
export function whatWeHold(person: Person, people: readonly Person[], elsewhere: HeldElsewhere = {}): WhatWeHold {
  return {
    register: {
      id: person.id,
      name: person.name ?? null,
      email: person.email ?? null,
      pseudonym: person.pseudonym,
      kind: person.kind,
      state: person.state,
      leftOn: person.leftOn ?? null,
      forgottenOn: person.forgottenOn ?? null,
    },
    mergedFrom: people.filter((one) => one.mergedInto === person.id).map((one) => one.id),
    thisIsMe: elsewhere.thisIsMe ?? false,
    assignments: [...(elsewhere.assignments ?? [])],
    namedIn: [...(elsewhere.namedIn ?? [])],
    signed: [...(elsewhere.signed ?? [])],
    derived: [...(elsewhere.derived ?? [])],
    mentions: [...(elsewhere.mentions ?? [])],
  }
}

/** The account as text, to read on screen and to copy. */
export function holdText(held: WhatWeHold): string {
  return JSON.stringify(held, null, 2)
}
