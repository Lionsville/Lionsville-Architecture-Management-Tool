// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The register's half of a search (ADR-0036 §8): which entries a word of the
 * query names, by id — so a search finds the records that point at a person
 * without any index holding the person's name.
 *
 * A word names an entry when it occurs in what the entry reads as to the one
 * searching: the name, or — once forgotten, or where names are withheld — the
 * pseudonym. A redirect a merge left reads as the entry it points at, so a
 * record that still holds the merged id is found by the name of the one kept.
 * An id the register no longer holds reads *a former colleague* and is named
 * by no word: nothing connects it to anyone.
 */
import { fold } from '../model/textSearch'
import type { PersonId } from '../model/person'
import type { Person } from './person'
import { registerOf, resolvePerson, shownEntry } from './shown'
import type { Shown, Showing } from './shown'

/** For one folded word, the register ids it names. */
export type PeopleMatching = (token: string) => ReadonlySet<PersonId>

/**
 * A match over a register as it is now. `words` says an entry in the reader's
 * words — the screen's language, or English for an agent — and `showing`
 * whether names are withheld. Each word is answered once and kept.
 */
export function peopleMatching(
  people: readonly Person[], words: (shown: Shown) => string, showing: Showing = {},
): PeopleMatching {
  const register = registerOf(people)
  const read = new Map<PersonId, string>()
  for (const entry of people) {
    const kept = resolvePerson(entry.id, register)
    if (kept) read.set(entry.id, fold(words(shownEntry(kept, showing))))
  }
  const answered = new Map<string, ReadonlySet<PersonId>>()
  return (token) => {
    const held = answered.get(token)
    if (held) return held
    const named = new Set<PersonId>()
    for (const [id, text] of read) if (text.includes(token)) named.add(id)
    answered.set(token, named)
    return named
  }
}
