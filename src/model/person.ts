// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A person, as the model names one (ADR-0036).
 *
 * The model holds no person. People are kept in a register outside the
 * history (`people/`, `ports/PeopleRepository.ts`), so that a name can be
 * forgotten without rewriting a step, a record, the index or a snapshot. What
 * the model holds is a **reference**: the id of an entry in that register, or
 * — as every name field held before 3.6.0, and still may — plain text.
 *
 * Here rather than in `people/`, because the fields that will hold one are the
 * model's own (`owner`, `by`, `proposedBy`, `signers`), and the model is the
 * bottom of the tree: it may name the shape of a reference and nothing about
 * the register it points into. What a reference reads as on a screen is the
 * register's to say (`people/shown.ts`).
 */

/** An entry in the register: random, never derived from the name, and never reused. */
export type PersonId = string

/** A person picked from the register, by id. */
export type PickedPerson = { readonly person: PersonId }

/**
 * A name field's value: a person picked from the register, or text as typed.
 * Text is what every name field held before the register existed, and what
 * one still holds where nobody picked an entry.
 */
export type PersonRef = PickedPerson | string

/** Whether a reference points into the register. */
export function isPicked(ref: PersonRef | undefined): ref is PickedPerson {
  return typeof ref === 'object' && ref !== null && typeof ref.person === 'string' && ref.person.length > 0
}

/** The register id a reference points at; `undefined` for text and for nothing. */
export function personIdOf(ref: PersonRef | undefined): PersonId | undefined {
  return isPicked(ref) ? ref.person : undefined
}

/** A reference to an entry. */
export function pickedPerson(id: PersonId): PickedPerson {
  return { person: id }
}

/**
 * Whether a value read from a file or a call is a reference: text, or an
 * object with a `person` id and nothing else a reader would have to keep.
 */
export function isPersonRef(value: unknown): value is PersonRef {
  if (typeof value === 'string') return true
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0] === 'person' && typeof (value as PickedPerson).person === 'string'
    && (value as PickedPerson).person.length > 0
}

/**
 * A reference as a field keeps it: text trimmed, a picked entry as it is, and
 * nothing for blank text or a value that is no reference at all. What every
 * writer of a name field runs, so an emptied field is removed rather than kept
 * empty and a file read back holds the shape it was written in.
 */
export function personRefOf(value: unknown): PersonRef | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  return isPersonRef(value) && isPicked(value) ? pickedPerson(value.person) : undefined
}

/**
 * Whether a reference says nothing: absent, or text that is blank. A picked
 * entry always says someone.
 */
export function isBlankRef(ref: PersonRef | undefined): boolean {
  return personRefOf(ref) === undefined
}

/**
 * Whether two references name the same person as far as the model can tell:
 * the same entry, or the same text ignoring case and the space around it. An
 * entry and text are never the same — the model does not ask the register
 * what a name is; `canonical` maps an id to the entry a merge kept.
 */
export function sameRef(
  one: PersonRef | undefined, other: PersonRef | undefined, canonical: (id: PersonId) => PersonId = (id) => id,
): boolean {
  const a = personRefOf(one)
  const b = personRefOf(other)
  if (a === undefined || b === undefined) return false
  if (isPicked(a) || isPicked(b)) return isPicked(a) && isPicked(b) && canonical(a.person) === canonical(b.person)
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * The text of a reference, for a reader that has no register: the text as
 * typed, and nothing for a picked entry — whose name is the register's to
 * say (`people/shown.ts`). What a search folds and what a filter matches, so
 * no register name is ever kept beside a record.
 */
export function refText(ref: PersonRef | undefined): string | undefined {
  return typeof ref === 'string' ? ref : undefined
}

/**
 * A reference as one string, for a screen that offers values to choose from
 * and compares them as strings — the merge's rows of values: text as it is,
 * a picked entry as its JSON. {@link personRefFromKey} reads it back.
 */
export function personRefKey(ref: PersonRef | undefined): string | undefined {
  if (ref === undefined) return undefined
  return isPicked(ref) ? JSON.stringify(pickedPerson(ref.person)) : ref
}

/** A reference back from {@link personRefKey}. */
export function personRefFromKey(key: string): PersonRef {
  if (key.startsWith('{"person":')) {
    try {
      const read: unknown = JSON.parse(key)
      if (isPersonRef(read) && isPicked(read)) return pickedPerson(read.person)
    } catch {
      return key
    }
  }
  return key
}

/**
 * Every register id a value names, wherever in it a reference sits: a model,
 * a record, a step. Read by shape rather than by field, so a field that takes
 * a person later is found without this learning its name — what lets a
 * working file made from part of the tree carry the entries that part names,
 * and a test say that no step holds anything but an id.
 */
export function personIdsIn(value: unknown, into: Set<PersonId> = new Set()): Set<PersonId> {
  if (Array.isArray(value)) {
    for (const item of value) personIdsIn(item, into)
  } else if (typeof value === 'object' && value !== null) {
    if (isPersonRef(value)) into.add((value as PickedPerson).person)
    else for (const item of Object.values(value)) personIdsIn(item, into)
  }
  return into
}
