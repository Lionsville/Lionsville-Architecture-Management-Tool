// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *What we hold* about a person (ADR-0036): the answer to a request for
 * access, as one document a person can read and hand over. An erasure asked
 * for is answered by the same page's *Forget*.
 *
 * What the register holds is said whole: the entry, and every entry merged
 * into it. What the model holds is said by what points at the person — the
 * assignments they hold (once units and roles have them) and the records that
 * name them by id. What nothing can reach is said honestly: names typed as
 * text before the register existed, which a search across the tree finds and
 * a forget does not touch.
 */
import type { Person, PersonId } from './person'

/** A record that names a person in its text, as a search across the tree finds it. */
export type Mention = { scope: string; kind: string; id: string; title: string }

/** What else the organisation holds that points at a person, gathered by whoever can read the tree. */
export type HeldElsewhere = {
  /** The records that name the person by id: empty until the name fields take a person (3.6.0, step 6). */
  namedIn?: readonly string[]
  /** The assignments they hold: empty until units and roles have them (3.6.0, step 3). */
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
    mentions: [...(elsewhere.mentions ?? [])],
  }
}

/** The account as text, to read on screen and to copy. */
export function holdText(held: WhatWeHold): string {
  return JSON.stringify(held, null, 2)
}
