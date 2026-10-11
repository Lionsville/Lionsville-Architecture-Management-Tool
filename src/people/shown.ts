// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a reference to a person reads as (ADR-0036): the one place a name is
 * asked of the register, so every screen, search and export that shows a
 * person shows the same thing — and a forget, made once in the register,
 * reaches all of them at once.
 *
 * - An entry with its name reads as that name, and one that has left as its
 *   name until the policy forgets it.
 * - A forgotten entry reads as its pseudonym: *Former colleague 4K7Q*.
 * - An entry a merge made a redirect reads as the entry it points at, so an
 *   id in the history resolves for as long as the one kept is there.
 * - An id the register no longer holds — the entry removed — reads *a former
 *   colleague*, with nothing to connect it to any other.
 * - Text reads as the text: what a name field held before the register, or
 *   where nobody picked anyone.
 *
 * Where names are withheld — an agent the organisation lets see pseudonyms
 * only — every entry reads as its pseudonym, *Person 4K7Q*.
 */
import type { StringKey, StringParams } from '../i18n/table'
import type { PersonId, PersonRef } from '../model/person'
import { personIdOf } from '../model/person'
import type { Person } from './person'

/** The register as a reader holds it: by id, the redirects included. */
export type Register = ReadonlyMap<PersonId, Person>

/** A register from its entries. */
export function registerOf(people: readonly Person[]): Register {
  return new Map(people.map((person) => [person.id, person]))
}

/** How far a redirect is followed: a merge keeps them one step long, so anything longer is a loop. */
const HOPS = 8

/** The entry an id stands for now: itself, or the one a merge kept; `undefined` for one removed. */
export function resolvePerson(id: PersonId, register: Register): Person | undefined {
  let held = register.get(id)
  for (let hop = 0; held?.mergedInto !== undefined && hop < HOPS; hop++) held = register.get(held.mergedInto)
  return held?.mergedInto === undefined ? held : undefined
}

/** What a reference reads as, before it is put in words. */
export type Shown =
  | { as: 'name'; person: Person; name: string }
  | { as: 'left'; person: Person; name: string }
  | { as: 'pseudonym'; person: Person; code: string }
  | { as: 'withheld'; person: Person; code: string }
  | { as: 'former' }
  | { as: 'text'; text: string }

/** Whether names are shown, or withheld behind pseudonyms. */
export type Showing = { withhold?: boolean }

/** What an entry reads as. */
export function shownEntry(person: Person, showing: Showing = {}): Shown {
  if (person.state === 'forgotten' || person.name === undefined) {
    return person.state === 'forgotten' ? { as: 'pseudonym', person, code: person.pseudonym } : { as: 'withheld', person, code: person.pseudonym }
  }
  if (showing.withhold) return { as: 'withheld', person, code: person.pseudonym }
  return person.state === 'left' ? { as: 'left', person, name: person.name } : { as: 'name', person, name: person.name }
}

/** What a reference reads as, through the register. */
export function shownPerson(ref: PersonRef | undefined, register: Register, showing: Showing = {}): Shown {
  const id = personIdOf(ref)
  if (id === undefined) return { as: 'text', text: typeof ref === 'string' ? ref : '' }
  const person = resolvePerson(id, register)
  return person ? shownEntry(person, showing) : { as: 'former' }
}

/** A translate: the registry's `t`, or one over a single table (`translateFrom`). */
export type Translate = (key: StringKey, params?: StringParams) => string

/** What is shown, in words. */
export function shownText(shown: Shown, t: Translate): string {
  switch (shown.as) {
    case 'name':
    case 'left':
      return shown.name
    case 'pseudonym':
      return t('people.former', { code: shown.code })
    case 'withheld':
      return t('people.withheld', { code: shown.code })
    case 'former':
      return t('people.formerUnknown')
    case 'text':
      return shown.text
    default: {
      const unexpected: never = shown
      return unexpected
    }
  }
}

/** A reference, in words: the render every screen that shows a person uses. */
export function personText(ref: PersonRef | undefined, register: Register, t: Translate, showing: Showing = {}): string {
  return shownText(shownPerson(ref, register, showing), t)
}

/** The English words, for a reader with no screen — an agent's answer, a log line — that has no table. */
export const ENGLISH_SHOWN = {
  former: (code: string) => `Former colleague ${code}`,
  withheld: (code: string) => `Person ${code}`,
  formerUnknown: 'A former colleague',
} as const

/** What is shown, in English: for a protocol answer, which is English by rule (`agent/tools.ts`). */
export function shownEnglish(shown: Shown): string {
  switch (shown.as) {
    case 'pseudonym': return ENGLISH_SHOWN.former(shown.code)
    case 'withheld': return ENGLISH_SHOWN.withheld(shown.code)
    case 'former': return ENGLISH_SHOWN.formerUnknown
    case 'text': return shown.text
    default: return shown.name
  }
}

/**
 * The register as a file made without names carries it: every entry as its
 * pseudonym, with no name and no address. The ids, the states and the
 * redirects stay, so every reference in the file still resolves — to a
 * pseudonym.
 */
export function withoutNames(people: readonly Person[]): Person[] {
  return people.map(({ name: _name, email: _email, ...rest }) => rest)
}
