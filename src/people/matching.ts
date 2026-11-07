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
 * by no word: nothing connects it to anyone. A signature that kept its name is
 * found through its entry only while that entry has a name (`apart`).
 */
import { fold } from '../model/textSearch'
import type { PersonId } from '../model/person'
import type { Person, PersonState } from './person'
import { registerOf, resolvePerson, shownEntry, signatureApart } from './shown'
import type { Shown, Showing } from './shown'

/**
 * For one folded word, the register ids it names — and which ids a signature's
 * kept name no longer links to (`signatureApart`): forgotten, or gone.
 */
export type PeopleMatching = ((token: string) => ReadonlySet<PersonId>) & {
  readonly apart: (id: PersonId) => boolean
  /**
   * The entries a query names, for a search to find the person themselves
   * (the owner, 7 November 2026): every word in what the reader may read of the
   * entry, so one forgotten or withheld is found by pseudonym and nothing else.
   * A redirect is no entry: its words are the entry's it points at. Never the
   * address, which most readers of the register are not shown.
   */
  readonly entries: (tokens: readonly string[]) => readonly { readonly id: PersonId; readonly title: string; readonly state: PersonState }[]
}

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
  const said: { id: PersonId; title: string; folded: string; state: PersonState }[] = []
  for (const entry of people) {
    const kept = resolvePerson(entry.id, register)
    if (!kept) continue
    const title = words(shownEntry(kept, showing))
    const folded = fold(title)
    read.set(entry.id, folded)
    if (kept.id === entry.id) said.push({ id: entry.id, title, folded, state: entry.state })
  }
  const answered = new Map<string, ReadonlySet<PersonId>>()
  const match = (token: string): ReadonlySet<PersonId> => {
    const held = answered.get(token)
    if (held) return held
    const named = new Set<PersonId>()
    for (const [id, text] of read) if (text.includes(token)) named.add(id)
    answered.set(token, named)
    return named
  }
  const entries = (tokens: readonly string[]) => said
    .filter((one) => tokens.every((token) => one.folded.includes(token)))
    .map(({ id, title, state }) => ({ id, title, state }))
  return Object.assign(match, { apart: (id: PersonId) => signatureApart(id, register), entries })
}
